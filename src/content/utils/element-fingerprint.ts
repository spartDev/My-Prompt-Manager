/**
 * Element Fingerprinting Module
 * 
 * Provides robust element identification using multiple stable attributes
 * instead of fragile CSS selectors. This system survives DOM structure changes,
 * dynamic content loading, and A/B testing.
 */

import type { ElementFingerprint } from '../../types';
import { keepsAttribute, keepsIdentifier, keepsLabel } from '../../utils/pickedValues';

import { debug, warn } from './logger';

/**
 * Element Matching Scoring System
 *
 * This scoring system provides robust element identification that survives:
 * - CSS class name changes during deployments
 * - DOM restructuring and framework updates
 * - A/B testing variations
 * - Dynamic content loading
 *
 * DESIGN RATIONALE:
 *
 * The weights are calibrated based on attribute stability and uniqueness:
 *
 * 1. PRIMARY IDENTIFIERS (15-20 points): Highly stable, developer-assigned
 *    - These attributes are intentionally set by developers and rarely change
 *    - `id` (20 pts): Highest weight - globally unique, stable across deployments
 *    - `data-testid` (18 pts): Very high weight - specifically for testing, very stable
 *    - `data-id` (16 pts): High weight - custom identifiers, usually stable
 *    - `name` (15 pts): High weight - semantic attribute for forms, stable
 *    - `aria-label` (15 pts): High weight - accessibility label, stable
 *
 * 2. SECONDARY IDENTIFIERS (5-10 points): Moderately stable, semantic
 *    - These provide context and type information
 *    - `type` (10 pts): Important discriminator (e.g., button vs submit vs reset)
 *    - `role` (8 pts): ARIA role, semantically meaningful
 *    - `placeholder` (7 pts): Input hint text, moderately stable
 *    - `tagName` (5 pts): Must match - used for filtering, not scoring weight
 *
 * 3. CONTENT MATCHING (5-8 points): fingerprints stored before ticket My-Prompt-Manager-je37 only
 *    - A pick no longer keeps the element's text, which can be a draft the user typed
 *      (src/utils/pickedValues.ts); a fingerprint stored or shared before still holds it
 *    - `textContent` (8 pts): Exact text match - useful for buttons/labels
 *    - `textHash` (5 pts): Hash-based match - fuzzy matching fallback
 *
 * 4. STRUCTURAL CONTEXT (2-6 points): Helps disambiguation
 *    - Useful when multiple similar elements exist
 *    - `parentId` (6 pts): Parent container ID - provides strong context
 *    - `parentDataTestId` (5 pts): Parent test ID - testing-friendly context
 *    - `siblingIndexMatch` (3 pts): Position among siblings - can shift
 *    - `siblingCountMatch` (2 pts): Total sibling count - weakest signal
 *
 * 5. OTHER ATTRIBUTES (5 points each): test ids, switches and ARIA tokens
 *    - The attributes `keepsAttribute` keeps (src/utils/pickedValues.ts)
 *    - Each match adds 5 points (up to MAX_STABLE_ATTRIBUTES)
 *
 * 6. CLASS PATTERNS (2 points each): Lowest weight due to CSS-in-JS
 *    - Only semantic classes counted (not generated hashes)
 *    - Each match adds 2 points (up to MAX_CLASS_PATTERNS)
 *    - Intentionally low due to CSS class volatility
 *
 * CONFIDENCE THRESHOLDS:
 *
 * MIN_CONFIDENCE_SCORE = 30:
 *   - Requires at least 1 primary + 1 secondary identifier match
 *   - OR 1 primary + multiple context/content matches
 *   - Example: id (20) + type (10) = 30 ✓
 *   - Example: dataTestId (18) + role (8) + textContent (8) = 34 ✓
 *   - Empirically validated to provide 85%+ accuracy on real-world sites
 *
 * HIGH_CONFIDENCE_SCORE = 50:
 *   - Requires 2+ primary identifiers OR 1 primary + multiple secondary
 *   - Example: id (20) + dataTestId (18) + type (10) = 48... close!
 *   - Example: id (20) + type (10) + role (8) + textContent (8) + parentId (6) = 52 ✓
 *   - Provides 95%+ accuracy even with significant DOM changes
 *
 * VERY_HIGH_CONFIDENCE (70+): Possible future tier
 *   - Multiple primary identifiers with strong context
 *   - Essentially guaranteed to be the correct element
 *
 * REAL-WORLD EXAMPLES:
 *
 * ChatGPT "Send" button:
 *   - data-testid="send-button" (18) + tagName (5) + textContent (8)
 *     + type="submit" (10) = 41 points (medium-high confidence)
 *
 * Claude.ai input field:
 *   - data-testid="chat-input" (18) + placeholder (7) + role="textbox" (8)
 *     + parentId="composer" (6) = 39 points (medium-high confidence)
 *
 * Generic button with id="submit":
 *   - id="submit" (20) + type="button" (10) + tagName (5) = 35 points
 *     (medium confidence - could be duplicated across pages)
 */
const MATCH_WEIGHTS = {
  // Primary identifiers (15-20 points each)
  id: 20,
  dataTestId: 18,
  dataId: 16,
  name: 15,
  ariaLabel: 15,

  // Secondary identifiers (5-10 points)
  tagName: 5, // Must match (required baseline)
  type: 10,
  role: 8,
  placeholder: 7,

  // Content (5-8 points)
  textContent: 8,
  textHash: 5,

  // Context (2-6 points)
  parentId: 6,
  parentDataTestId: 5,
  siblingIndexMatch: 3,
  siblingCountMatch: 2,

  // Attributes (5 points each)
  stableAttribute: 5,

  // Class patterns (2 points each)
  classPattern: 2
} as const;

/**
 * Minimum score required to consider an element a confident match.
 *
 * Value of 30 ensures at least:
 * - One primary identifier + one secondary identifier
 * - OR one strong primary identifier + multiple context clues
 *
 * Empirically validated across Claude.ai, ChatGPT, and Perplexity to provide
 * 85%+ matching accuracy even when sites update their DOM structure.
 */
const MIN_CONFIDENCE_SCORE = 30;

/**
 * Score threshold for high-confidence matches.
 *
 * Value of 50 typically means:
 * - Multiple primary identifiers
 * - OR one primary + several secondary/context matches
 *
 * Provides 95%+ accuracy and survives significant platform changes.
 */
const HIGH_CONFIDENCE_SCORE = 50;

// Maximum DOM depth to prevent infinite loops
const MAX_DOM_DEPTH = 50;

// The text a fingerprint stored before ticket My-Prompt-Manager-je37 holds: its first 50 characters
const MAX_NORMALIZED_TEXT_LENGTH = 50;

// Attribute and class limits
const MAX_STABLE_ATTRIBUTES = 10;
const MAX_CLASS_PATTERNS = 5;
const MIN_SEMANTIC_CLASS_LENGTH = 2;
const MAX_SEMANTIC_CLASS_LENGTH = 30;

// Performance threshold for slow fingerprint matching (milliseconds)
const SLOW_MATCHING_THRESHOLD_MS = 50;

export class ElementFingerprintGenerator {
  /**
   * Generate a comprehensive fingerprint for an HTML element.
   *
   * The fingerprint captures multiple stable attributes including IDs, ARIA labels,
   * data attributes, and structural context. This multi-attribute approach provides
   * robustness against DOM changes and A/B testing. It keeps only what the rules of
   * src/utils/pickedValues.ts keep: neither the page's address nor the element's text,
   * which can be what the user typed, and no value that is not shaped as an identifier.
   *
   * @param element - The HTML element to fingerprint
   * @returns An ElementFingerprint object containing primary, secondary, content,
   *          context identifiers, and a confidence assessment
   *
   * @example
   * ```typescript
   * const generator = getElementFingerprintGenerator();
   * const button = document.querySelector('button#submit');
   * const fingerprint = generator.generate(button);
   * console.log(fingerprint.meta.confidence); // 'high' | 'medium' | 'low'
   * ```
   */
  generate(element: HTMLElement): ElementFingerprint {
    const fingerprint: ElementFingerprint = {
      primary: this.extractPrimaryIdentifiers(element),
      secondary: this.extractSecondaryIdentifiers(element),
      // The element's text is not kept: in a chat box, or around one, it is the user's draft
      content: {},
      context: this.extractContextIdentifiers(element),
      attributes: this.extractStableAttributes(element),
      classPatterns: this.extractClassPatterns(element),
      // The page's address is not kept: nothing that finds the element reads it, and its path,
      // query and fragment can name the user, a conversation or a token
      meta: {
        generatedAt: Date.now(),
        confidence: this.calculateConfidence(element)
      }
    };

    debug('[ElementFingerprint] Generated fingerprint', {
      tagName: element.tagName,
      confidence: fingerprint.meta.confidence,
      hasPrimaryId: !!fingerprint.primary.id,
      hasDataTestId: !!fingerprint.primary.dataTestId
    });

    return fingerprint;
  }

  /**
   * Find an element in the current DOM that matches the given fingerprint.
   *
   * Uses a scoring system to match elements against the fingerprint's attributes.
   * Only returns elements with a confidence score above MIN_CONFIDENCE_SCORE (30).
   * Performance is monitored and logged if matching takes longer than 50ms.
   *
   * @param fingerprint - The element fingerprint to search for
   * @returns The best matching HTML element if found with sufficient confidence,
   *          null if no confident match is found
   *
   * @example
   * ```typescript
   * const generator = getElementFingerprintGenerator();
   * const savedFingerprint = loadFromStorage();
   * const element = generator.findElement(savedFingerprint);
   * if (element) {
   *   // Element found with high confidence
   *   element.scrollIntoView();
   * }
   * ```
   */
  findElement(fingerprint: ElementFingerprint): HTMLElement | null {
    const startTime = performance.now();
    
    // Find all candidate elements with matching tag name
    const tagName = fingerprint.secondary.tagName.toUpperCase();
    const candidates = document.getElementsByTagName(tagName);
    
    if (candidates.length === 0) {
      debug('[ElementFingerprint] No elements found with tag name', { tagName });
      return null;
    }

    debug('[ElementFingerprint] Finding element', {
      tagName,
      candidates: candidates.length
    });

    let bestMatch: HTMLElement | null = null;
    let bestScore = 0;

    // Score each candidate
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i] as HTMLElement;
      const score = this.calculateMatchScore(candidate, fingerprint);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    const duration = performance.now() - startTime;

    // Performance monitoring: Log slow fingerprint matching
    if (duration > SLOW_MATCHING_THRESHOLD_MS) {
      warn('[ElementFingerprint] Slow fingerprint matching detected', {
        duration: `${duration.toFixed(2)}ms`,
        candidates: candidates.length,
        tagName,
        threshold: `${String(SLOW_MATCHING_THRESHOLD_MS)}ms`
      });
    }

    if (bestMatch && bestScore >= MIN_CONFIDENCE_SCORE) {
      debug('[ElementFingerprint] Element found', {
        score: bestScore,
        duration: `${duration.toFixed(2)}ms`,
        confidence: bestScore >= HIGH_CONFIDENCE_SCORE ? 'high' : 'medium',
        tagName: bestMatch.tagName
      });
      return bestMatch;
    }

    warn('[ElementFingerprint] No confident match found', {
      bestScore,
      minRequired: MIN_CONFIDENCE_SCORE,
      candidates: candidates.length,
      duration: `${duration.toFixed(2)}ms`
    });

    return null;
  }

  /**
   * Extract primary identifiers (highest confidence)
   */
  private extractPrimaryIdentifiers(element: HTMLElement): ElementFingerprint['primary'] {
    const primary: ElementFingerprint['primary'] = {};

    // ID
    if (keepsIdentifier(element.id)) {
      primary.id = element.id;
    }

    // data-testid (common in modern web apps)
    const dataTestId = element.getAttribute('data-testid');
    if (keepsIdentifier(dataTestId)) {
      primary.dataTestId = dataTestId;
    }

    // data-id
    const dataId = element.getAttribute('data-id');
    if (keepsIdentifier(dataId)) {
      primary.dataId = dataId;
    }

    // name attribute
    const name = element.getAttribute('name');
    if (keepsIdentifier(name)) {
      primary.name = name;
    }

    // aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (keepsLabel(ariaLabel)) {
      primary.ariaLabel = ariaLabel;
    }

    return primary;
  }

  /**
   * Extract secondary identifiers (medium confidence)
   */
  private extractSecondaryIdentifiers(element: HTMLElement): ElementFingerprint['secondary'] {
    const secondary: ElementFingerprint['secondary'] = {
      tagName: element.tagName.toLowerCase()
    };

    // type attribute (for inputs, buttons)
    const type = element.getAttribute('type');
    if (type) {
      secondary.type = type;
    }

    // role attribute
    const role = element.getAttribute('role');
    if (role) {
      secondary.role = role;
    }

    // placeholder (for inputs)
    const placeholder = element.getAttribute('placeholder');
    if (keepsLabel(placeholder)) {
      secondary.placeholder = placeholder;
    }

    return secondary;
  }

  /**
   * Extract structural context for disambiguation
   */
  private extractContextIdentifiers(element: HTMLElement): ElementFingerprint['context'] {
    const context: ElementFingerprint['context'] = {};

    // Parent information
    const parent = element.parentElement;
    if (parent) {
      context.parentTagName = parent.tagName.toLowerCase();

      if (keepsIdentifier(parent.id)) {
        context.parentId = parent.id;
      }

      const parentDataTestId = parent.getAttribute('data-testid');
      if (keepsIdentifier(parentDataTestId)) {
        context.parentDataTestId = parentDataTestId;
      }

      // Sibling information (position among same-type siblings)
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === element.tagName
      );
      context.siblingCount = siblings.length;
      context.siblingIndex = siblings.indexOf(element);
    }

    // DOM depth
    context.depth = this.getElementDepth(element);

    return context;
  }

  /**
   * Extract the other attributes a pick keeps: test ids, switches and ARIA tokens (keepsAttribute).
   * An attribute where the page may copy what the user types, such as `data-draft`, is not one.
   */
  private extractStableAttributes(element: HTMLElement): { [key: string]: string } {
    const attributes: { [key: string]: string } = {};

    for (const attr of element.attributes) {
      if (keepsAttribute(attr.name, attr.value)) {
        attributes[attr.name] = attr.value;
      }
    }

    // Limit to N attributes to keep fingerprint size reasonable
    const limited: { [key: string]: string } = {};
    const keys = Object.keys(attributes).slice(0, MAX_STABLE_ATTRIBUTES);
    for (const key of keys) {
      limited[key] = attributes[key];
    }

    return limited;
  }

  /**
   * Extract semantic class patterns (ignore generated classes)
   */
  private extractClassPatterns(element: HTMLElement): string[] | undefined {
    if (!element.className || typeof element.className !== 'string') {
      return undefined;
    }

    const classes = element.className.trim().split(/\s+/);
    const semantic: string[] = [];

    for (const cls of classes) {
      // Only keep semantic classes (not generated ones)
      // Semantic classes are typically: lowercase, use dashes/underscores, meaningful words
      if (
        /^[a-z][a-z0-9_-]*$/.test(cls) && // lowercase start, simple chars
        cls.length > MIN_SEMANTIC_CLASS_LENGTH && // not too short
        cls.length < MAX_SEMANTIC_CLASS_LENGTH && // not too long
        !/^[a-z]{3,}-[0-9a-f]{5,}$/.test(cls) // not hash-based (e.g., css-1a2b3c)
      ) {
        semantic.push(cls);
      }
    }

    // Return up to N most semantic classes
    return semantic.length > 0 ? semantic.slice(0, MAX_CLASS_PATTERNS) : undefined;
  }

  /**
   * Calculate confidence level of fingerprint uniqueness
   */
  private calculateConfidence(element: HTMLElement): 'high' | 'medium' | 'low' {
    let score = 0;

    // ID is highly unique
    if (element.id) {
      score += 20;
    }

    // data-testid is very stable
    if (element.getAttribute('data-testid')) {
      score += 18;
    }

    // Other primary identifiers
    if (element.getAttribute('data-id')) {
      score += 16;
    }
    if (element.getAttribute('name')) {
      score += 15;
    }
    if (element.getAttribute('aria-label')) {
      score += 15;
    }

    // Secondary identifiers
    if (element.getAttribute('type')) {
      score += 10;
    }
    if (element.getAttribute('role')) {
      score += 8;
    }

    // Content
    if (element.textContent && element.textContent.trim().length > 0) {
      score += 8;
    }

    if (score >= 20) {
      return 'high';
    }
    if (score >= 10) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Calculate match score between element and fingerprint
   */
  private calculateMatchScore(
    element: HTMLElement,
    fingerprint: ElementFingerprint
  ): number {
    let score = 0;

    // Tag name MUST match (required)
    if (element.tagName.toLowerCase() !== fingerprint.secondary.tagName) {
      return 0;
    }
    score += MATCH_WEIGHTS.tagName;

    // Primary identifiers
    if (fingerprint.primary.id && element.id === fingerprint.primary.id) {
      score += MATCH_WEIGHTS.id;
    }

    if (fingerprint.primary.dataTestId) {
      const dataTestId = element.getAttribute('data-testid');
      if (dataTestId === fingerprint.primary.dataTestId) {
        score += MATCH_WEIGHTS.dataTestId;
      }
    }

    if (fingerprint.primary.dataId) {
      const dataId = element.getAttribute('data-id');
      if (dataId === fingerprint.primary.dataId) {
        score += MATCH_WEIGHTS.dataId;
      }
    }

    if (fingerprint.primary.name) {
      const name = element.getAttribute('name');
      if (name === fingerprint.primary.name) {
        score += MATCH_WEIGHTS.name;
      }
    }

    if (fingerprint.primary.ariaLabel) {
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel === fingerprint.primary.ariaLabel) {
        score += MATCH_WEIGHTS.ariaLabel;
      }
    }

    // Secondary identifiers
    if (fingerprint.secondary.type) {
      const type = element.getAttribute('type');
      if (type === fingerprint.secondary.type) {
        score += MATCH_WEIGHTS.type;
      }
    }

    if (fingerprint.secondary.role) {
      const role = element.getAttribute('role');
      if (role === fingerprint.secondary.role) {
        score += MATCH_WEIGHTS.role;
      }
    }

    if (fingerprint.secondary.placeholder) {
      const placeholder = element.getAttribute('placeholder');
      if (placeholder === fingerprint.secondary.placeholder) {
        score += MATCH_WEIGHTS.placeholder;
      }
    }

    // Content matching
    if (fingerprint.content.textContent) {
      const elementText = element.textContent ? element.textContent.trim().replace(/\s+/g, ' ').substring(0, MAX_NORMALIZED_TEXT_LENGTH) : undefined;
      if (elementText === fingerprint.content.textContent) {
        score += MATCH_WEIGHTS.textContent;
      }
    }

    if (fingerprint.content.textHash) {
      const elementText = element.textContent ? element.textContent.trim().replace(/\s+/g, ' ').substring(0, MAX_NORMALIZED_TEXT_LENGTH) : undefined;
      if (elementText && this.simpleHash(elementText) === fingerprint.content.textHash) {
        score += MATCH_WEIGHTS.textHash;
      }
    }

    // Context matching
    const parent = element.parentElement;
    if (parent) {
      if (fingerprint.context.parentId && parent.id === fingerprint.context.parentId) {
        score += MATCH_WEIGHTS.parentId;
      }

      if (fingerprint.context.parentDataTestId) {
        const parentDataTestId = parent.getAttribute('data-testid');
        if (parentDataTestId === fingerprint.context.parentDataTestId) {
          score += MATCH_WEIGHTS.parentDataTestId;
        }
      }

      // Sibling position matching
      if (fingerprint.context.siblingIndex !== undefined) {
        const siblings = Array.from(parent.children).filter(
          child => child.tagName === element.tagName
        );
        const currentIndex = siblings.indexOf(element);
        
        if (currentIndex === fingerprint.context.siblingIndex) {
          score += MATCH_WEIGHTS.siblingIndexMatch;
        }

        if (siblings.length === fingerprint.context.siblingCount) {
          score += MATCH_WEIGHTS.siblingCountMatch;
        }
      }
    }

    // Stable attributes matching
    for (const [key, value] of Object.entries(fingerprint.attributes)) {
      if (element.getAttribute(key) === value) {
        score += MATCH_WEIGHTS.stableAttribute;
      }
    }

    // Class patterns matching
    if (fingerprint.classPatterns && element.className) {
      // Handle both string className (HTML) and SVGAnimatedString (SVG)
      const classNameValue = element.className;
      const classNameStr = typeof classNameValue === 'string' ? classNameValue : (classNameValue as SVGAnimatedString | undefined)?.baseVal || '';
      const elementClasses = classNameStr.split(/\s+/);
      for (const pattern of fingerprint.classPatterns) {
        if (elementClasses.includes(pattern)) {
          score += MATCH_WEIGHTS.classPattern;
        }
      }
    }

    return score;
  }

  /**
   * Get element depth in DOM tree
   */
  private getElementDepth(element: Element): number {
    let depth = 0;
    let current = element.parentElement;
    
    while (current && depth < MAX_DOM_DEPTH) {
      depth++;
      current = current.parentElement;
    }
    
    return depth;
  }

  /**
   * Simple hash function for text content
   */
  private simpleHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}

// Export singleton instance
let instance: ElementFingerprintGenerator | null = null;

/**
 * Get the singleton instance of the ElementFingerprintGenerator.
 *
 * This ensures only one generator instance exists across the application,
 * which is important for consistent fingerprint generation and matching.
 *
 * @returns The singleton ElementFingerprintGenerator instance
 *
 * @example
 * ```typescript
 * const generator = getElementFingerprintGenerator();
 * const fingerprint = generator.generate(element);
 * ```
 */
export function getElementFingerprintGenerator(): ElementFingerprintGenerator {
  if (!instance) {
    instance = new ElementFingerprintGenerator();
  }
  return instance;
}

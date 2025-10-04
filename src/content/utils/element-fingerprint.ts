/**
 * Element Fingerprinting Module
 * 
 * Provides robust element identification using multiple stable attributes
 * instead of fragile CSS selectors. This system survives DOM structure changes,
 * dynamic content loading, and A/B testing.
 */

import type { ElementFingerprint } from '../../types';

import { debug, warn } from './logger';

// Scoring weights for element matching
const MATCH_WEIGHTS = {
  // Primary identifiers (15-20 points each)
  id: 20,
  dataTestId: 18,
  dataId: 16,
  name: 15,
  ariaLabel: 15,
  
  // Secondary identifiers (5-10 points)
  tagName: 5, // Must match (required)
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

// Minimum score required to consider an element a match
const MIN_CONFIDENCE_SCORE = 30;
const HIGH_CONFIDENCE_SCORE = 50;

// Maximum DOM depth to prevent infinite loops
const MAX_DOM_DEPTH = 50;

// Sensitive patterns to exclude from fingerprints
const SENSITIVE_PATTERNS = /password|secret|token|key|credential|private|ssn|credit|card|cvv|pin|bank|account|session|auth|api|csrf|nonce/i;

export class ElementFingerprintGenerator {
  /**
   * Generate a unique fingerprint for an element
   */
  generate(element: HTMLElement): ElementFingerprint {
    const fingerprint: ElementFingerprint = {
      primary: this.extractPrimaryIdentifiers(element),
      secondary: this.extractSecondaryIdentifiers(element),
      content: this.extractContentIdentifiers(element),
      context: this.extractContextIdentifiers(element),
      attributes: this.extractStableAttributes(element),
      classPatterns: this.extractClassPatterns(element),
      meta: {
        generatedAt: Date.now(),
        url: window.location.href,
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
   * Find an element matching the given fingerprint
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
    if (duration > 50) {
      warn('[ElementFingerprint] Slow fingerprint matching detected', {
        duration: `${duration.toFixed(2)}ms`,
        candidates: candidates.length,
        tagName,
        threshold: '50ms'
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
    if (element.id && !SENSITIVE_PATTERNS.test(element.id)) {
      primary.id = element.id;
    }

    // data-testid (common in modern web apps)
    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId && !SENSITIVE_PATTERNS.test(dataTestId)) {
      primary.dataTestId = dataTestId;
    }

    // data-id
    const dataId = element.getAttribute('data-id');
    if (dataId && !SENSITIVE_PATTERNS.test(dataId)) {
      primary.dataId = dataId;
    }

    // name attribute
    const name = element.getAttribute('name');
    if (name && !SENSITIVE_PATTERNS.test(name)) {
      primary.name = name;
    }

    // aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && !SENSITIVE_PATTERNS.test(ariaLabel)) {
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
    if (placeholder && !SENSITIVE_PATTERNS.test(placeholder)) {
      secondary.placeholder = placeholder;
    }

    return secondary;
  }

  /**
   * Extract content-based identifiers
   */
  private extractContentIdentifiers(element: HTMLElement): ElementFingerprint['content'] {
    const content: ElementFingerprint['content'] = {};

    // Get visible text content
    const textContent = element.textContent ? element.textContent.trim() : undefined;
    if (textContent && textContent.length > 0 && textContent.length < 200) {
      // Normalize whitespace and take first 50 chars
      const normalized = textContent.replace(/\s+/g, ' ').substring(0, 50);
      
      // Only use if not sensitive
      if (!SENSITIVE_PATTERNS.test(normalized)) {
        content.textContent = normalized;
        content.textHash = this.simpleHash(normalized);
      }
    }

    return content;
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

      if (parent.id && !SENSITIVE_PATTERNS.test(parent.id)) {
        context.parentId = parent.id;
      }

      const parentDataTestId = parent.getAttribute('data-testid');
      if (parentDataTestId && !SENSITIVE_PATTERNS.test(parentDataTestId)) {
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
   * Extract stable attributes (non-sensitive, framework-specific)
   */
  private extractStableAttributes(element: HTMLElement): { [key: string]: string } {
    const attributes: { [key: string]: string } = {};

    // Common stable attribute patterns
    const stablePatterns = [
      /^data-(?!sensitive|private|password|token|key|secret)/i,
      /^aria-(?!label$)/i, // aria-label already captured in primary
      /^ng-/i,  // Angular
      /^v-/i,   // Vue
      /^react-/i, // React (sometimes)
    ];

    for (const attr of element.attributes) {
      // Skip if sensitive
      if (SENSITIVE_PATTERNS.test(attr.name) || SENSITIVE_PATTERNS.test(attr.value)) {
        continue;
      }

      // Check if matches stable patterns
      const isStable = stablePatterns.some(pattern => pattern.test(attr.name));
      
      if (isStable) {
        attributes[attr.name] = attr.value;
      }
    }

    // Limit to 10 attributes to keep fingerprint size reasonable
    const limited: { [key: string]: string } = {};
    const keys = Object.keys(attributes).slice(0, 10);
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
        cls.length > 2 && // not too short
        cls.length < 30 && // not too long
        !/^[a-z]{3,}-[0-9a-f]{5,}$/.test(cls) // not hash-based (e.g., css-1a2b3c)
      ) {
        semantic.push(cls);
      }
    }

    // Return up to 5 most semantic classes
    return semantic.length > 0 ? semantic.slice(0, 5) : undefined;
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
      const elementText = element.textContent ? element.textContent.trim().replace(/\s+/g, ' ').substring(0, 50) : undefined;
      if (elementText === fingerprint.content.textContent) {
        score += MATCH_WEIGHTS.textContent;
      }
    }

    if (fingerprint.content.textHash) {
      const elementText = element.textContent ? element.textContent.trim().replace(/\s+/g, ' ').substring(0, 50) : undefined;
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

export function getElementFingerprintGenerator(): ElementFingerprintGenerator {
  if (!instance) {
    instance = new ElementFingerprintGenerator();
  }
  return instance;
}

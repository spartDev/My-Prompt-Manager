/**
 * Centralized Platform Configuration
 *
 * Single source of truth for all supported AI platforms.
 * This file defines platform metadata, selectors, and default settings
 * to avoid configuration drift across multiple files.
 */

import type { BrandColorScheme } from "../constants/brandColors";

/**
 * Icon creation methods available on UIElementFactory that return HTMLElements
 */
export type PlatformIconMethod =
  | "createFloatingIcon"
  | "createRelativeIcon"
  | "createAbsoluteIcon"
  | "createChatGPTIcon"
  | "createPerplexityIcon"
  | "createMistralIcon"
  | "createCopilotIcon"
  | "createGeminiIcon";

/**
 * Where the icon goes in a Platform's composer, named by what elements are for (test ids, ARIA
 * labels, custom elements, button types), never by how they are styled.
 */
export interface IconPlacement {
  /** Nearest ancestor of the editor that bounds the composer, found with editor.closest(): anchors outside it never win. */
  composer: string;
  /** Tried in order inside the composer; the first found wins. When none is, the icon is anchored on the editor. */
  anchors: ReadonlyArray<{
    find: string;
    relation: 'before' | 'after' | 'inside-start' | 'inside-end';
  }>;
}

/**
 * Interface for comprehensive platform configuration
 */
export interface PlatformDefinition {
  /** Unique platform identifier */
  id: string;
  /** Platform hostname (e.g., 'claude.ai') */
  hostname: string;
  /** Human-readable platform name */
  displayName: string;
  /** Platform priority for strategy selection (higher = higher priority) */
  priority: number;
  /** Whether this platform is enabled by default for new users */
  defaultEnabled: boolean;
  /** CSS selectors for finding input elements */
  selectors: string[];
  /**
   * Where the icon goes in the composer: see IconPlacement. The single source: no strategy keeps a
   * copy. When no anchor is found, the icon is anchored on the editor (src/content/core/anchored-overlay.ts).
   */
  iconPlacement?: IconPlacement;
  /** Strategy class name to use for this platform */
  strategyClass: string;
  /** Additional hostname patterns to check for platform detection */
  hostnamePatterns?: string[];
  /** Brand color of the site logo when enabled (optional, the accent when omitted); every site shares one disabled state */
  brandColors?: Pick<BrandColorScheme, "enabled">;
  /** Optional icon creation method for explicit UI factory integration */
  iconMethod?: PlatformIconMethod;
  /** Platform IDs that should toggle together (bidirectional relationship) */
  linkedPlatforms?: string[];
}

/**
 * Centralized platform definitions
 *
 * IMPORTANT: When adding a new platform, only update this configuration.
 * All other files will automatically pick up the changes.
 *
 * NOTE: This object is frozen to prevent runtime mutations that could
 * compromise platform detection and security.
 */
export const SUPPORTED_PLATFORMS: Readonly<Record<string, Readonly<PlatformDefinition>>> = Object.freeze({
  claude: {
    id: "claude",
    hostname: "claude.ai",
    displayName: "Claude",
    priority: 100,
    defaultEnabled: true,
    selectors: ['div[contenteditable="true"][role="textbox"].ProseMirror'],
    iconPlacement: {
      composer: 'div:has([data-testid="chat-input-attach"], [data-testid="composer-dictate"])',
      anchors: [
        { find: '[data-testid="composer-dictate"]', relation: "before" },
        { find: 'button[data-testid="chat-input-attach"]', relation: "after" },
        { find: 'button[data-testid="chat-input-send"]', relation: "before" },
      ],
    },
    strategyClass: "ClaudeStrategy",
    hostnamePatterns: ["claude"],
    brandColors: {
      enabled: "bg-[#d37354] text-white shadow-sm",
    },
  },

  chatgpt: {
    id: "chatgpt",
    hostname: "chatgpt.com",
    displayName: "ChatGPT",
    priority: 90,
    defaultEnabled: true,
    selectors: [
      'textarea[data-testid="chat-input"]',
      'textarea[placeholder*="Message"]',
    ],
    // No test id left in the trailing actions: the ARIA labels are English, so another locale
    // falls to the anchor on the editor
    iconPlacement: {
      composer: "form, fieldset",
      anchors: [
        { find: 'button[aria-label*="dictate" i]', relation: "before" },
        { find: 'button[data-testid="send-button"]', relation: "before" },
        { find: 'button[aria-label*="voice" i]', relation: "before" },
      ],
    },
    strategyClass: "ChatGPTStrategy",
    hostnamePatterns: ["openai", "chatgpt"],
    brandColors: {
      enabled: "bg-white text-gray-800 shadow-sm border border-gray-200",
    },
  },

  mistral: {
    id: "mistral",
    hostname: "chat.mistral.ai",
    displayName: "Mistral LeChat",
    priority: 85,
    defaultEnabled: true,
    selectors: [
      'div[contenteditable="true"]',
      'textarea[placeholder*="chat"]',
      '[role="textbox"]',
    ],
    // The mode button has no label and the submit button hides while the draft is empty: the
    // ARIA labels are English, so another locale falls to the anchor on the editor
    iconPlacement: {
      composer: "form",
      anchors: [
        { find: 'button[aria-label*="voice" i]', relation: "before" },
        { find: 'button[aria-label*="settings" i]', relation: "after" },
      ],
    },
    strategyClass: "MistralStrategy",
    hostnamePatterns: ["mistral"],
    brandColors: {
      enabled: "bg-gray-700 text-white shadow-sm",
    },
    iconMethod: "createMistralIcon",
  },

  perplexity: {
    id: "perplexity",
    hostname: "www.perplexity.ai",
    displayName: "Perplexity",
    priority: 80,
    defaultEnabled: true,
    selectors: [
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="follow"]',
    ],
    // The composer is the nearest ancestor holding the search mode toggle (a test id); the
    // trailing buttons have English ARIA labels only
    iconPlacement: {
      composer: 'div:has([data-testid="ask-input-mode-toggle-indicator"])',
      anchors: [
        { find: 'button[aria-haspopup="menu"][aria-label*="model" i]', relation: "before" },
        { find: 'button[aria-label*="dictation" i]', relation: "before" },
        { find: 'button[type="submit"]', relation: "before" },
      ],
    },
    strategyClass: "PerplexityStrategy",
    hostnamePatterns: ["perplexity"],
    brandColors: {
      enabled: "bg-[#2d808c] text-white shadow-sm",
    },
  },

  gemini: {
    id: "gemini",
    hostname: "gemini.google.com",
    displayName: "Google Gemini",
    priority: 85,
    defaultEnabled: true,
    selectors: [
      'div.ql-editor[contenteditable="true"][role="textbox"]',
      "rich-textarea .ql-editor",
      '[data-placeholder*="Gemini"]',
      'div[contenteditable="true"]',
    ],
    // Custom elements and named classes, which do not follow the user's language as the labels do
    iconPlacement: {
      composer: "fieldset, input-area-v2",
      anchors: [
        { find: "speech-dictation-mic-button", relation: "after" },
        { find: ".input-buttons-wrapper-bottom", relation: "inside-end" },
        { find: ".trailing-actions-wrapper", relation: "inside-end" },
      ],
    },
    strategyClass: "GeminiStrategy",
    hostnamePatterns: ["gemini"],
    brandColors: {
      enabled: "bg-white text-gray-800 shadow-sm border border-gray-200",
    },
    iconMethod: "createGeminiIcon",
  },

  copilot: {
    id: "copilot",
    hostname: "copilot.microsoft.com",
    displayName: "Microsoft Copilot",
    priority: 80,
    defaultEnabled: true,
    selectors: [
      'textarea[data-testid="composer-input"]', // Primary selector - most specific
      "textarea#userInput", // Fallback - ID selector
      'textarea[placeholder*="Message"]', // Pattern match fallback
      'textarea[placeholder*="Copilot"]', // Additional pattern match
    ],
    // Not confirmed on the live composer, which needs sign-in: see tests/fixtures/composers/copilot.html
    iconPlacement: {
      composer: 'form, div:has(button[data-testid="audio-call-button"])',
      anchors: [
        { find: 'button[data-testid="audio-call-button"]', relation: "before" },
        { find: 'button[type="submit"]', relation: "before" },
      ],
    },
    strategyClass: "CopilotStrategy", // Uses dedicated CopilotStrategy for React integration
    hostnamePatterns: ["copilot.microsoft"],
    brandColors: {
      enabled: "bg-[#0e111b] text-white shadow-sm",
    },
    iconMethod: "createCopilotIcon",
    linkedPlatforms: ['m365copilot'],
  },

  m365copilot: {
    id: "m365copilot",
    hostname: "m365.cloud.microsoft",
    displayName: "Microsoft 365 Copilot",
    priority: 80,
    defaultEnabled: true,
    selectors: [
      'span[id="m365-chat-editor-target-element"]', // Primary selector - specific ID
      'span[data-lexical-editor="true"][contenteditable="true"]', // Lexical editor
      'span[role="combobox"][contenteditable="true"]', // Combobox role
      'div[contenteditable="true"]', // Generic contenteditable fallback
      'textarea[placeholder*="Message"]', // Legacy textarea fallback
    ],
    // Fluent's component class names, not its hashed ones. Not confirmed on the live composer,
    // which needs sign-in: see tests/fixtures/composers/m365copilot.html
    iconPlacement: {
      composer: ".fai-ChatInput",
      anchors: [
        { find: ".fai-ChatInput__actions", relation: "inside-start" },
        { find: 'button[type="submit"]', relation: "before" },
      ],
    },
    strategyClass: "M365CopilotStrategy",
    hostnamePatterns: ["m365.cloud.microsoft"],
    brandColors: {
      enabled: "bg-[#0e111b] text-white shadow-sm",
    },
    iconMethod: "createCopilotIcon",
    linkedPlatforms: ['copilot'],
  },
});

/**
 * Validate that all linked platforms exist in SUPPORTED_PLATFORMS
 *
 * This function runs at module load time to catch configuration errors early.
 * Throws an error if any platform references a non-existent linked platform.
 *
 * @throws {Error} If a platform references a non-existent linked platform
 */
function validateLinkedPlatforms(): void {
  Object.entries(SUPPORTED_PLATFORMS).forEach(([platformId, platform]) => {
    if (platform.linkedPlatforms) {
      platform.linkedPlatforms.forEach((linkedId) => {
        if (!(linkedId in SUPPORTED_PLATFORMS)) {
          throw new Error(
            `Platform ${platformId} references non-existent linked platform: ${linkedId}`,
          );
        }
      });
    }
  });
}

// Run validation at module load time
validateLinkedPlatforms();

/**
 * Helper functions for accessing platform configuration
 */

/**
 * Get list of default enabled platform hostnames
 * Used by background script and content script for consistent defaults
 */
export function getDefaultEnabledPlatforms(): string[] {
  return Object.values(SUPPORTED_PLATFORMS)
    .filter((platform) => platform.defaultEnabled)
    .sort((a, b) => b.priority - a.priority) // Sort by priority (highest first)
    .map((platform) => platform.hostname);
}

/**
 * Get platform definition by hostname
 */
export function getPlatformByHostname(
  hostname: string,
): PlatformDefinition | undefined {
  return Object.values(SUPPORTED_PLATFORMS).find(
    (platform) => platform.hostname === hostname,
  );
}

/**
 * Get platform definition by ID
 */
export function getPlatformById(id: string): PlatformDefinition | undefined {
  return SUPPORTED_PLATFORMS[id];
}

/**
 * Get all supported platform hostnames
 */
export function getAllSupportedHostnames(): string[] {
  return Object.values(SUPPORTED_PLATFORMS).map(
    (platform) => platform.hostname,
  );
}

/**
 * Get all hostname patterns for quick hostname matching (includes both exact hostnames and patterns)
 */
export function getAllHostnamePatterns(): string[] {
  const patterns: string[] = [];

  Object.values(SUPPORTED_PLATFORMS).forEach((platform) => {
    // Add exact hostname
    patterns.push(platform.hostname);

    // Add additional patterns
    if (platform.hostnamePatterns) {
      patterns.push(...platform.hostnamePatterns);
    }
  });

  return [...new Set(patterns)]; // Remove duplicates
}

/**
 * Check if hostname matches any supported platform (including pattern matching)
 */
export function isHostnameSupported(hostname: string): boolean {
  // Direct hostname match
  if (getAllSupportedHostnames().includes(hostname)) {
    return true;
  }

  // Pattern matching
  const patterns = getAllHostnamePatterns();
  return patterns.some((pattern) => hostname.includes(pattern));
}

/**
 * Get platforms sorted by priority (highest first)
 */
export function getPlatformsByPriority(): PlatformDefinition[] {
  return Object.values(SUPPORTED_PLATFORMS).sort(
    (a, b) => b.priority - a.priority,
  );
}

/**
 * Get all linked platform hostnames for a given hostname
 *
 * Returns an array containing the original hostname plus all hostnames of linked platforms.
 * This is used for toggling related platforms together (e.g., Microsoft Copilot and M365 Copilot).
 *
 * @param hostname - The hostname to get linked platforms for
 * @returns Array of hostnames including the original and all linked platforms (deduplicated)
 *
 * @example
 * ```typescript
 * getLinkedPlatformHostnames('copilot.microsoft.com')
 * // Returns: ['copilot.microsoft.com', 'm365.cloud.microsoft']
 *
 * getLinkedPlatformHostnames('claude.ai')
 * // Returns: ['claude.ai'] (no linked platforms)
 * ```
 */
export function getLinkedPlatformHostnames(hostname: string): string[] {
  // Find the platform for this hostname
  const platform = Object.values(SUPPORTED_PLATFORMS).find(
    (p) => p.hostname === hostname,
  );

  if (!platform) {
    return [hostname]; // Unknown platform, just return itself
  }

  if (!platform.linkedPlatforms || platform.linkedPlatforms.length === 0) {
    return [hostname]; // No linked platforms
  }

  // Get hostnames of all linked platforms
  const linkedHostnames = platform.linkedPlatforms
    .map((platformId) => {
      if (!(platformId in SUPPORTED_PLATFORMS)) {
        // biome-ignore lint/suspicious/noConsole: dependency-free config shared by every surface, so no logger to import
        console.error(
          `Linked platform ${platformId} not found in SUPPORTED_PLATFORMS`,
        );
        return null;
      }
      return SUPPORTED_PLATFORMS[platformId].hostname;
    })
    .filter((h): h is string => h !== null);

  // Return original hostname + all linked hostnames (deduplicated)
  return [...new Set([hostname, ...linkedHostnames])];
}

/**
 * Legacy compatibility: Get platform names as union type
 * @deprecated Use PlatformDefinition.id instead
 */
export type PlatformName =
  | "claude"
  | "chatgpt"
  | "mistral"
  | "perplexity"
  | "gemini"
  | "copilot"
  | "m365copilot"
  | "default";

/**
 * Get all platform IDs for TypeScript union types
 */
export function getAllPlatformIds(): string[] {
  return Object.keys(SUPPORTED_PLATFORMS);
}

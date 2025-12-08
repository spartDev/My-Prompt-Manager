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

const DISABLED_STATE =
  "bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400";

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
  /** CSS selector for button container where icon should be placed */
  buttonContainerSelector?: string;
  /** Strategy class name to use for this platform */
  strategyClass: string;
  /** Additional hostname patterns to check for platform detection */
  hostnamePatterns?: string[];
  /** Brand color scheme for UI elements (optional, defaults to green gradient when omitted) */
  brandColors?: BrandColorScheme;
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
    buttonContainerSelector:
      ".relative.flex-1.flex.items-center.gap-2.shrink.min-w-0",
    strategyClass: "ClaudeStrategy",
    hostnamePatterns: ["claude"],
    brandColors: {
      enabled: "bg-[#d37354] text-white shadow-sm",
      disabled: DISABLED_STATE,
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
    buttonContainerSelector:
      'div[data-testid="composer-trailing-actions"] .ms-auto.flex.items-center',
    strategyClass: "ChatGPTStrategy",
    hostnamePatterns: ["openai", "chatgpt"],
    brandColors: {
      enabled: "bg-white text-gray-800 shadow-sm border border-gray-200",
      disabled: DISABLED_STATE,
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
    buttonContainerSelector: [
      ".flex.w-full.max-w-full.items-center.justify-start.gap-3", // Main chat interface
      ".flex.w-full.items-center.justify-start.gap-3", // Compact view
      ".flex.items-center.justify-start.gap-3", // Mobile fallback
    ].join(", "),
    strategyClass: "MistralStrategy",
    hostnamePatterns: ["mistral"],
    brandColors: {
      enabled: "bg-gray-700 text-white shadow-sm",
      disabled: DISABLED_STATE,
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
    buttonContainerSelector:
      ".bg-background-50.dark\\:bg-offsetDark.flex.items-center",
    strategyClass: "PerplexityStrategy",
    hostnamePatterns: ["perplexity"],
    brandColors: {
      enabled: "bg-[#2d808c] text-white shadow-sm",
      disabled: DISABLED_STATE,
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
    buttonContainerSelector: ".input-buttons-wrapper-bottom",
    strategyClass: "GeminiStrategy",
    hostnamePatterns: ["gemini"],
    brandColors: {
      enabled: "bg-white text-gray-800 shadow-sm border border-gray-200",
      disabled: DISABLED_STATE,
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
    // Target the container with microphone button - more specific than generic .flex.gap-2
    buttonContainerSelector:
      ".relative.bottom-0.flex.justify-between.pb-0\\.5.pe-2\\.5.ps-1\\.5 > .flex.gap-2.items-center:last-child",
    strategyClass: "CopilotStrategy", // Uses dedicated CopilotStrategy for React integration
    hostnamePatterns: ["copilot.microsoft"],
    brandColors: {
      enabled: "bg-[#0e111b] text-white shadow-sm",
      disabled: DISABLED_STATE,
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
    buttonContainerSelector:
      '.fai-ChatInput__actions > span.___11i0s0y, .fai-ChatInput__actions',
    strategyClass: "M365CopilotStrategy",
    hostnamePatterns: ["m365.cloud.microsoft"],
    brandColors: {
      enabled: "bg-[#0e111b] text-white shadow-sm",
      disabled: DISABLED_STATE,
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

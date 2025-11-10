/**
 * Centralized Platform Configuration
 *
 * Single source of truth for all supported AI platforms.
 * This file defines platform metadata, selectors, and default settings
 * to avoid configuration drift across multiple files.
 */

import type { BrandColorScheme } from "../constants/brandColors";

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
}

/**
 * Centralized platform definitions
 *
 * IMPORTANT: When adding a new platform, only update this configuration.
 * All other files will automatically pick up the changes.
 */
export const SUPPORTED_PLATFORMS: Record<string, PlatformDefinition> = {
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
    strategyClass: "DefaultStrategy", // Uses default strategy (no custom class needed)
    hostnamePatterns: ["copilot.microsoft"],
    brandColors: {
      enabled: "bg-[#0e111b] text-white shadow-sm",
      disabled: DISABLED_STATE,
    },
  },
};

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
  | "default";

/**
 * Get all platform IDs for TypeScript union types
 */
export function getAllPlatformIds(): string[] {
  return Object.keys(SUPPORTED_PLATFORMS);
}

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
  /** Platform hostname (e.g., 'claude.ai'): the one its row in Settings and its Platform choice go by */
  hostname: string;
  /**
   * Other hosts the same Platform is served on, such as the host a sign-in redirects to. Each is
   * in the manifest beside `hostname`, and follows the Platform choice of the Platform.
   */
  otherHostnames?: string[];
  /** Human-readable platform name */
  displayName: string;
  /** Platform priority for strategy selection (higher = higher priority) */
  priority: number;
  /** Whether this platform is on for a user who never switched it (no Platform choice), existing users included */
  defaultEnabled: boolean;
  /** CSS selectors for finding input elements */
  selectors: string[];
  /**
   * Paths of the Platform's pages that have no composer (`/settings` covers `/settings/...`): no
   * input field is looked for there, so a search box or a form field of the page gets no Prompts button
   */
  pagesWithoutComposer?: string[];
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
    // The settings pages' Search box matched the input selectors (seen on 2026-11-15)
    pagesWithoutComposer: ["/settings"],
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
    // ARIA labels are English, so another locale falls to the anchor on the editor. Each button of
    // the action row sits alone in a block <div>: the icon goes before the voice button's <div>,
    // since in it the icon stacks above the button and wraps the row (seen on 2026-11-17)
    iconPlacement: {
      composer: "form",
      anchors: [
        { find: 'div:has(> button[aria-label*="voice" i]:only-child)', relation: "before" },
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
    // Named classes, which do not follow the user's language as the labels do. The icon goes
    // before the microphone's wrapper, not in it: in there it lands next to the microphone in its
    // container, which is 3rem wide, as wide as the microphone, so the icon overflows past the
    // field's rounded edge, which clips it (seen on 2026-11-17)
    iconPlacement: {
      composer: "fieldset, input-area-v2",
      anchors: [
        { find: ".input-buttons-wrapper-bottom", relation: "before" },
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
    // A work account lands on copilot.cloud.microsoft from m365.cloud.microsoft and from
    // copilot.microsoft.com (seen on 2026-11-15, ticket My-Prompt-Manager-axv)
    otherHostnames: ["copilot.cloud.microsoft"],
    selectors: [
      'span[id="m365-chat-editor-target-element"]', // Primary selector - specific ID
      '[data-lexical-editor][contenteditable="true"][role="textbox"]', // Lexical editor of copilot.cloud.microsoft
      'span[data-lexical-editor="true"][contenteditable="true"]', // Lexical editor
      'span[role="combobox"][contenteditable="true"]', // Combobox role
      'div[contenteditable="true"]', // Generic contenteditable fallback
      'textarea[placeholder*="Message"]', // Legacy textarea fallback
    ],
    // copilot.cloud.microsoft first: the composer is the div two levels above the editor, which
    // holds it in a span beside an empty span (or the editor alone, as a capture folds a wrapper
    // that holds one element), then the plus menu and the dictation button (nesting read on the live
    // page signed in, 2026-11-15, ticket My-Prompt-Manager-axv). The plus menu is found by its
    // test id, which does not follow the user's language; its toolbar renders after the editor,
    // so the icon waits for it (IconPlacementController.awaitToolbar). Then Fluent's component
    // class names of m365.cloud.microsoft, not its hashed ones, on the composer that holds its
    // actions or its send button (an inner .fai-ChatInput holding neither is not the composer). Neither is captured, since both need sign-in: see
    // tests/fixtures/composers/m365copilot.html.
    iconPlacement: {
      composer: 'div:has(> span > [data-lexical-editor]):has([data-testid="PlusMenuButton"]), div:has(> [data-lexical-editor]):has([data-testid="PlusMenuButton"]), .fai-ChatInput:has(.fai-ChatInput__actions, button[type="submit"])',
      anchors: [
        { find: '[data-testid="PlusMenuButton"]', relation: "after" },
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
 * The hostnames of the Platforms that are on by default, highest priority first, each followed by
 * its other hostnames: the Platforms on for a user with no Platform choice
 */
export function getDefaultEnabledPlatforms(): string[] {
  return Object.values(SUPPORTED_PLATFORMS)
    .filter((platform) => platform.defaultEnabled)
    .sort((a, b) => b.priority - a.priority) // Sort by priority (highest first)
    .flatMap(platformHostnames);
}

/** Every host a Platform is served on: its hostname, then its other hostnames */
export function platformHostnames(platform: PlatformDefinition): string[] {
  return [platform.hostname, ...(platform.otherHostnames ?? [])];
}

/**
 * Get platform definition by hostname, its other hostnames included
 */
export function getPlatformByHostname(
  hostname: string,
): PlatformDefinition | undefined {
  return Object.values(SUPPORTED_PLATFORMS).find(
    (platform) => platformHostnames(platform).includes(hostname),
  );
}

/**
 * Get platform definition by ID
 */
export function getPlatformById(id: string): PlatformDefinition | undefined {
  return SUPPORTED_PLATFORMS[id];
}

/**
 * Get all supported platform hostnames, the other hostnames of each Platform included
 */
export function getAllSupportedHostnames(): string[] {
  return Object.values(SUPPORTED_PLATFORMS).flatMap(platformHostnames);
}

/**
 * Get all hostname patterns for quick hostname matching (includes both exact hostnames and patterns)
 */
export function getAllHostnamePatterns(): string[] {
  const patterns: string[] = [];

  Object.values(SUPPORTED_PLATFORMS).forEach((platform) => {
    // Add exact hostnames
    patterns.push(...platformHostnames(platform));

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
 * Returns the hostname, then the other hosts of its Platform, then every host of the Platforms
 * linked to it. This is used for toggling related platforms together (e.g., Microsoft Copilot and
 * M365 Copilot), and for reading the Platform choice of a host that has none of its own.
 *
 * @param hostname - The hostname to get linked platforms for
 * @returns Array of hostnames including the original and all linked platforms (deduplicated)
 *
 * @example
 * ```typescript
 * getLinkedPlatformHostnames('copilot.microsoft.com')
 * // Returns: ['copilot.microsoft.com', 'm365.cloud.microsoft', 'copilot.cloud.microsoft']
 *
 * getLinkedPlatformHostnames('claude.ai')
 * // Returns: ['claude.ai'] (no linked platforms)
 * ```
 */
export function getLinkedPlatformHostnames(hostname: string): string[] {
  const platform = getPlatformByHostname(hostname);

  if (!platform) {
    return [hostname]; // Unknown platform, just return itself
  }

  // Get hostnames of all linked platforms
  const linkedHostnames = (platform.linkedPlatforms ?? []).flatMap((platformId) => {
    if (!(platformId in SUPPORTED_PLATFORMS)) {
      // biome-ignore lint/suspicious/noConsole: dependency-free config shared by every surface, so no logger to import
      console.error(
        `Linked platform ${platformId} not found in SUPPORTED_PLATFORMS`,
      );
      return [];
    }
    return platformHostnames(SUPPORTED_PLATFORMS[platformId]);
  });

  // Return original hostname + the other hosts of its Platform + all linked hostnames (deduplicated)
  return [...new Set([hostname, ...platformHostnames(platform), ...linkedHostnames])];
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

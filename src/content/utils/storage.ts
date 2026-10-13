/**
 * Storage utility module for the content script
 * Handles Chrome storage operations, data validation, and prompt list item creation
 */

import { getDefaultEnabledPlatforms } from "../../config/platforms";
import { readPrompts } from "../../services/promptAdmission";
import type { Prompt } from "../types/index";

import { DOMUtils } from "./dom";
import { warn, debug, error as logError } from "./logger";

/**
 * Interface for extension settings
 */
export interface ExtensionSettings {
  enabledSites: string[];
  customSites: CustomSite[];
  debugMode: boolean;
  floatingFallback: boolean;
}

/**
 * Interface for custom site configuration
 */
export interface CustomSite {
  hostname: string;
  displayName: string;
  icon?: string;
  enabled: boolean;
  dateAdded: number;
  positioning?: {
    mode: "custom";
    selector: string;
    placement: "before" | "after" | "inside-start" | "inside-end";
    offset?: {
      x: number;
      y: number;
    };
    zIndex?: number;
    description?: string;
  };
}

/**
 * Get extension settings with validation and defaults
 */
export async function getSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["promptLibrarySettings"], (result) => {
        if (chrome.runtime.lastError) {
          const storageError = new Error(
            `Chrome storage error: ${chrome.runtime.lastError.message ?? "Unknown error"}`,
          );
          logError("Failed to retrieve settings from storage", storageError);
          resolve(getDefaultSettings()); // Graceful fallback to defaults
          return;
        }

        const validatedSettings = validateSettingsData(
          result.promptLibrarySettings,
        );

        debug("Retrieved and validated settings from storage", {
          enabledSitesCount: validatedSettings.enabledSites.length,
          customSitesCount: validatedSettings.customSites.length,
          debugMode: validatedSettings.debugMode,
        });

        resolve(validatedSettings);
      });
    } catch (err) {
      logError(
        "Unexpected error accessing chrome storage for settings",
        err as Error,
      );
      resolve(getDefaultSettings()); // Graceful fallback
    }
  });
}

/**
 * Get default extension settings
 */
export function getDefaultSettings(): ExtensionSettings {
  return {
    enabledSites: getDefaultEnabledPlatforms(),
    customSites: [],
    debugMode: false,
    floatingFallback: true,
  };
}

/**
 * Validate settings data structure
 */
export function validateSettingsData(settings: unknown): ExtensionSettings {
  const defaults = getDefaultSettings();

  // Handle null, undefined, or non-object values
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    if (settings !== undefined && settings !== null) {
      warn("Invalid settings data structure, using defaults");
    }
    return defaults;
  }

  // Cast to record type for property access
  const settingsObj = settings as Record<string, unknown>;

  try {
    const validatedSettings: ExtensionSettings = {
      enabledSites: Array.isArray(settingsObj.enabledSites)
        ? ((settingsObj.enabledSites as unknown[]).filter(
            (site) => typeof site === "string" && site.length > 0,
          ) as string[])
        : defaults.enabledSites,
      customSites: Array.isArray(settingsObj.customSites)
        ? (settingsObj.customSites as unknown[]).filter((site) =>
            validateCustomSite(site),
          )
        : defaults.customSites,
      debugMode:
        typeof settingsObj.debugMode === "boolean"
          ? settingsObj.debugMode
          : defaults.debugMode,
      floatingFallback:
        typeof settingsObj.floatingFallback === "boolean"
          ? settingsObj.floatingFallback
          : defaults.floatingFallback,
    };

    return validatedSettings;
  } catch (err) {
    logError("Failed to validate settings data", err as Error, { settings });
    return defaults;
  }
}

/**
 * Validate custom site data structure
 */
export function validateCustomSite(site: unknown): site is CustomSite {
  if (!site || typeof site !== "object") {
    return false;
  }

  const siteObj = site as Record<string, unknown>;

  return (
    typeof siteObj.hostname === "string" &&
    typeof siteObj.displayName === "string" &&
    typeof siteObj.enabled === "boolean" &&
    typeof siteObj.dateAdded === "number" &&
    siteObj.hostname.length > 0 &&
    siteObj.displayName.length > 0
  );
}

/**
 * Check if the current site is enabled
 */
export async function isSiteEnabled(hostname: string): Promise<boolean> {
  try {
    const settings = await getSettings();

    // Check if site is in enabled sites list
    if (settings.enabledSites.includes(hostname)) {
      return true;
    }

    // Check if site is an enabled custom site
    const customSite = settings.customSites.find(
      (site) => site.hostname === hostname,
    );
    if (customSite && customSite.enabled) {
      return true;
    }

    return false;
  } catch (err) {
    logError("Failed to check if site is enabled", err as Error, { hostname });
    debug("ERROR in isSiteEnabled - defaulting to DISABLED", {
      hostname,
      error: err,
    });
    // Default to DISABLED on error to prevent unwanted icon appearance
    // This is safer than defaulting to enabled for security/privacy
    return false;
  }
}

/**
 * Get the Prompts from storage, exactly as stored (Verbatim). Reading never writes, and
 * never changes or drops a Prompt because of what its text says: only entries that are not
 * Prompts at all are skipped.
 */
export async function getPrompts(): Promise<Prompt[]> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["prompts"], (result) => {
        if (chrome.runtime.lastError) {
          const storageError = new Error(
            `Chrome storage error: ${chrome.runtime.lastError.message ?? "Unknown error"}`,
          );
          logError("Failed to retrieve prompts from storage", storageError);
          resolve([]); // Graceful fallback to empty array
          return;
        }

        const rawPrompts: unknown = result.prompts;
        const prompts = readPrompts(rawPrompts);

        const invalidCount = Array.isArray(rawPrompts)
          ? rawPrompts.length - prompts.length
          : 0;
        if (invalidCount > 0) {
          warn("Filtered out invalid prompts", {
            originalCount: prompts.length + invalidCount,
            validCount: prompts.length,
            invalidCount,
          });
        }

        debug("Retrieved prompts from storage", {
          count: prompts.length,
        });
        resolve(prompts);
      });
    } catch (err) {
      logError("Unexpected error accessing chrome storage", err as Error);
      resolve([]); // Graceful fallback
    }
  });
}

/**
 * Helper function to safely create DOM elements with text content
 * @deprecated Use DOMUtils.createElement instead
 */
export function createElement(
  tag: string,
  attributes: Record<string, string | number> = {},
  textContent: string = "",
): HTMLElement {
  return DOMUtils.createElement(tag, attributes, textContent);
}

/**
 * Helper function to create SVG elements with proper namespace
 * @deprecated Use DOMUtils.createSVGElement instead
 */
export function createSVGElement(
  tag: string,
  attributes: Record<string, string | number> = {},
): SVGElement {
  return DOMUtils.createSVGElement(tag, attributes);
}

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

/**
 * The first `maxLength` UTF-16 code units of `text`, never ending between the two halves of
 * a surrogate pair (an emoji, for example): a pair that straddles the limit is left out whole.
 * Only the two code units around the cut are read, so the cost does not grow with the text.
 */
function cutWithoutSplittingPairs(text: string, maxLength: number): string {
  const splitsPair =
    isHighSurrogate(text.charCodeAt(maxLength - 1)) &&
    isLowSurrogate(text.charCodeAt(maxLength));
  return text.substring(0, splitsPair ? maxLength - 1 : maxLength);
}

/**
 * Helper function to create a prompt list item for the Prompt selector.
 *
 * Shows the Prompt exactly as saved (Verbatim): text is set as text, so it needs no
 * escaping, and the id goes into the attribute unchanged so it can be matched later.
 */
export function createPromptListItem(
  prompt: Prompt,
  index: number,
  idPrefix: string = "prompt-item",
): HTMLElement {
  try {
    const promptItem = DOMUtils.createElement("div", {
      class: "prompt-item",
      "data-prompt-id": prompt.id,
      role: "option",
      "aria-describedby": `${idPrefix}-${String(index)}-desc`,
      tabindex: "-1",
    });

    const promptTitle = DOMUtils.createElement(
      "div",
      {
        class: "prompt-title",
      },
      prompt.title,
    );

    const promptCategory = DOMUtils.createElement(
      "div",
      {
        class: "prompt-category",
      },
      prompt.category,
    );

    const promptPreview = DOMUtils.createElement(
      "div",
      {
        class: "prompt-preview",
        id: `${idPrefix}-${String(index)}-desc`,
      },
      cutWithoutSplittingPairs(prompt.content, 100) +
        (prompt.content.length > 100 ? "..." : ""),
    );

    DOMUtils.appendChild(promptItem, promptTitle);
    DOMUtils.appendChild(promptItem, promptCategory);
    DOMUtils.appendChild(promptItem, promptPreview);

    return promptItem;
  } catch (err) {
    logError("Failed to create prompt list item", err as Error, {
      prompt,
      index,
    });
    return DOMUtils.createElement(
      "div",
      { class: "prompt-item-error" },
      "Error loading prompt",
    );
  }
}

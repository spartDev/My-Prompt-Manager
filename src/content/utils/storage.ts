/**
 * Storage utility module for the content script
 * Handles Chrome storage operations, data validation, and prompt list item creation
 */

import { readPrompts } from "../../services/promptAdmission";
import {
  defaultSiteSettings,
  isHostnameEnabled,
  readSiteSettings,
  type SiteSettings,
} from "../../services/siteSettings";
import type { SelectorCategory } from "../selector/selectorData";
import type { Prompt } from "../types/index";

import { DOMUtils } from "./dom";
import { debug, error as logError, warn } from "./logger";

/**
 * The Site settings as storage has them, validated. A store that cannot be read gives the
 * defaults, so the content script still starts.
 */
export async function getSettings(): Promise<SiteSettings> {
  try {
    const settings = await readSiteSettings();

    debug("Retrieved and validated settings from storage", {
      enabledSitesCount: settings.enabledSites.length,
      customSitesCount: settings.customSites.length,
      debugMode: settings.debugMode,
    });

    return settings;
  } catch (err) {
    logError("Failed to retrieve settings from storage", err as Error);
    return defaultSiteSettings();
  }
}

/**
 * Whether the extension works on a hostname, read from storage. A store that cannot be read
 * gives no: the Prompts button never shows on a site the user may have turned off.
 */
export async function isSiteEnabled(hostname: string): Promise<boolean> {
  try {
    return isHostnameEnabled(await readSiteSettings(), hostname);
  } catch (err) {
    logError("Failed to check if site is enabled", err as Error, { hostname });
    return false;
  }
}

/**
 * Get the Prompts from storage, exactly as stored (Verbatim). Reading never writes, and
 * never changes or drops a Prompt because of what its text says: only entries that are not
 * Prompts at all are skipped.
 */
export function getPrompts(): Promise<Prompt[]> {
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
 * The Categories of the Library, in their stored order, for the tabs of the Prompt selector.
 * A Category with no valid #RRGGBB color has none here: its dot takes the default color.
 */
export function getCategories(): Promise<SelectorCategory[]> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["categories"], (result) => {
        if (chrome.runtime.lastError) {
          logError(
            "Failed to retrieve categories from storage",
            new Error(
              `Chrome storage error: ${chrome.runtime.lastError.message ?? "Unknown error"}`,
            ),
          );
          resolve([]);
          return;
        }

        const rawCategories: unknown = result.categories;
        const categories: SelectorCategory[] = [];
        for (const category of Array.isArray(rawCategories) ? rawCategories : []) {
          const { name, color } = (category ?? {}) as { name?: unknown; color?: unknown };
          if (typeof name === "string") {
            categories.push(
              typeof color === "string" && /^#[0-9A-F]{6}$/i.test(color) ? { name, color } : { name },
            );
          }
        }
        resolve(categories);
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

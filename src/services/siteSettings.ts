/**
 * The Site settings: which Platforms and Custom sites the extension works on, and the debug
 * switch kept with them (CONTEXT.md). One shape, one validated read and one rule for "is this
 * hostname enabled", shared by the popup and side panel, the service worker and the content
 * script.
 *
 * Everything but `readSiteSettings` is pure. The module imports neither `StorageManager` nor
 * React, so the content script can load it.
 */

import { getDefaultEnabledPlatforms } from '../config/platforms';
import type { CustomSite } from '../types';

/** The `chrome.storage.local` key the Site settings are stored under */
export const SITE_SETTINGS_KEY = 'promptLibrarySettings';

export interface SiteSettings {
  /** The hostnames of the Platforms that are on */
  enabledSites: string[];
  customSites: CustomSite[];
  debugMode: boolean;
}

/** The Site settings of a store that holds none: the default Platforms on, no Custom site */
export function defaultSiteSettings(): SiteSettings {
  return {
    enabledSites: getDefaultEnabledPlatforms(),
    customSites: [],
    debugMode: false
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A Custom site entry is kept when it has a hostname, a display name, its switch and its date */
function isCustomSite(site: unknown): site is CustomSite {
  return (
    isRecord(site) &&
    typeof site.hostname === 'string' && site.hostname.length > 0 &&
    typeof site.displayName === 'string' && site.displayName.length > 0 &&
    typeof site.enabled === 'boolean' &&
    typeof site.dateAdded === 'number'
  );
}

/**
 * The Site settings a stored value stands for. A value that is not an object gives the defaults;
 * a field that is missing or of the wrong type takes its default; an entry of a list that is not
 * what the list holds is left out. Fields the Site settings no longer have are ignored.
 */
export function parseSiteSettings(stored: unknown): SiteSettings {
  const defaults = defaultSiteSettings();
  if (!isRecord(stored)) {
    return defaults;
  }

  return {
    enabledSites: Array.isArray(stored.enabledSites)
      ? stored.enabledSites.filter((site): site is string => typeof site === 'string' && site.length > 0)
      : defaults.enabledSites,
    customSites: Array.isArray(stored.customSites)
      ? stored.customSites.filter(isCustomSite)
      : defaults.customSites,
    debugMode: typeof stored.debugMode === 'boolean' ? stored.debugMode : defaults.debugMode
  };
}

/** The Custom site of a hostname, when the user has it turned on */
export function enabledCustomSite(settings: SiteSettings, hostname: string): CustomSite | null {
  return settings.customSites.find((site) => site.hostname === hostname && site.enabled) ?? null;
}

/** Whether the extension works on a hostname: a Platform that is on, or a Custom site that is on */
export function isHostnameEnabled(settings: SiteSettings, hostname: string): boolean {
  return settings.enabledSites.includes(hostname) || enabledCustomSite(settings, hostname) !== null;
}

/** Every hostname the extension works on: the Platforms that are on, then the Custom sites that are on */
export function enabledHostnames(settings: SiteSettings): string[] {
  return [
    ...settings.enabledSites,
    ...settings.customSites.filter((site) => site.enabled).map((site) => site.hostname)
  ];
}

/**
 * The Site settings as storage has them. Rejects when storage cannot be read: the caller decides
 * what a failed read means for it, and the defaults are never passed off as what is stored.
 */
export async function readSiteSettings(): Promise<SiteSettings> {
  const result = await chrome.storage.local.get([SITE_SETTINGS_KEY]);
  return parseSiteSettings(result[SITE_SETTINGS_KEY]);
}

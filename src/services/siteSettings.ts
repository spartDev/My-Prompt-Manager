/**
 * The Site settings: which Platforms and Custom sites the extension works on, and the debug
 * switch kept with them (CONTEXT.md). One shape, one validated read and one rule for "is this
 * hostname enabled", shared by the popup and side panel, the service worker and the content
 * script.
 *
 * Stored shape: the Platform choices, what the user turned on or off, Platform by Platform. A
 * Platform the user never switched takes its default, so a Platform added in a later release is on
 * for every user, and a user's choices for the Platforms they knew are kept (product decision of
 * 2026-11-15, ticket My-Prompt-Manager-dx8). Up to that release the store held the list of the
 * Platforms that were on (`enabledSites`); `parseSiteSettings` reads that list as the choices it
 * stands for, and `upgradeStoredSiteSettings` writes it back in the new shape.
 *
 * Reading: `parseSiteSettings` and the rules are pure; `readSiteSettings` reads storage.
 *
 * Saving: a save is a change (`changeSiteSettings`), applied to what storage holds at that moment
 * under a lock shared by every context of the extension. The open tabs follow the key in storage
 * (`onSiteSettingsChanged`), so nothing is sent to them. Nothing
 * saves a whole copy of the Site settings it read earlier, so a copy that is stale, or that a
 * failed read replaced with the defaults, can never be written over what is stored.
 *
 * The module imports neither `StorageManager` nor React, so the content script can load it.
 */

import { getLinkedPlatformHostnames, getPlatformByHostname, getPlatformsByPriority, platformHostnames } from '../config/platforms';
import type { CustomSite } from '../types';
import { AsyncMutex } from '../utils/asyncMutex';

/** The `chrome.storage.local` key the Site settings are stored under */
export const SITE_SETTINGS_KEY = 'promptLibrarySettings';

export interface SiteSettings {
  /**
   * The Platform choices: what the user turned on (true) or off (false), by hostname. A Platform
   * that is not in it is the user's to choose still and takes its default (`isPlatformEnabled`).
   */
  platformChoices: Record<string, boolean>;
  customSites: CustomSite[];
  debugMode: boolean;
}

/** The Site settings of a store that holds none: no choice made, so the default Platforms on, no Custom site */
export function defaultSiteSettings(): SiteSettings {
  return {
    platformChoices: {},
    customSites: [],
    debugMode: false
  };
}

/**
 * The Platforms of the releases that stored the list of the Platforms that were on, up to the one
 * that stores the Platform choices. A Platform of this list missing from a stored list is off; one
 * that is not in this list did not exist when the list was written, so it takes its default.
 * Frozen: a Platform added later is never added here.
 *
 * A stored list does not say which release wrote it. Mistral (v1.4.0), Gemini (v1.6.0) and Copilot
 * (v1.8.0) were added while the list was stored, so for a list written before them, one missing
 * from it may never have been turned off; it was off for that user all the same, and stays off
 * rather than turning on a Platform the user may have turned off. Only M365 Copilot (v1.8.1) is
 * told apart: it is switched with Copilot, so it follows Copilot.
 */
export const PLATFORMS_OF_THE_ENABLED_LIST: readonly string[] = Object.freeze([
  'claude.ai',
  'chatgpt.com',
  'chat.mistral.ai',
  'www.perplexity.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'm365.cloud.microsoft'
]);

/**
 * The Platform choices a stored list of the Platforms that were on stands for. `mayPredateM365` for
 * a list a release before the Platform choices wrote, which may be older than M365 Copilot; not for
 * one it changed after a rollback, which lists M365 Copilot as it is.
 */
function choicesOfEnabledList(enabledSites: readonly string[], mayPredateM365: boolean): Record<string, boolean> {
  const choices: Record<string, boolean> = {};
  for (const hostname of PLATFORMS_OF_THE_ENABLED_LIST) {
    choices[hostname] = enabledSites.includes(hostname);
  }
  // M365 Copilot is switched with Copilot, so a list with Copilot and without M365 Copilot was
  // written before M365 Copilot existed. Frozen like the list: a later link changes nothing here
  if (mayPredateM365 && enabledSites.some((hostname) => hostname === 'copilot.microsoft.com')) {
    choices['m365.cloud.microsoft'] = true;
  }
  // A hostname on the list that is no Platform of those releases stays on, as it was
  for (const hostname of enabledSites) {
    choices[hostname] = true;
  }
  return choices;
}

/**
 * Whether a hostname is one of the other hosts of a Platform (`otherHostnames`: none in 2.0.0,
 * copilot.cloud.microsoft for M365 Copilot once ticket My-Prompt-Manager-j74b brings it back). Such
 * a host holds no Platform choice of its own: it is on or off as its Platform is, whatever a store
 * or the list of an earlier release says of it.
 */
function followsItsPlatform(hostname: string): boolean {
  const platform = getPlatformByHostname(hostname);
  return platform !== undefined && platform.hostname !== hostname;
}

/** The choices without any for a host that follows its Platform */
function withoutOtherHosts(choices: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(choices).filter(([hostname]) => !followsItsPlatform(hostname)));
}

/** The stored Platform choices, leaving out an entry that is not a hostname and a switch */
function parsePlatformChoices(stored: Record<string, unknown>): Record<string, boolean> {
  const choices: Record<string, boolean> = {};
  for (const [hostname, enabled] of Object.entries(stored)) {
    // `__proto__` would set the prototype of the choices, not a choice
    if (hostname.length > 0 && hostname !== '__proto__' && typeof enabled === 'boolean') {
      choices[hostname] = enabled;
    }
  }
  return choices;
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

/** The hostnames of a stored list, or null when the value is not a list */
function hostnamesOf(value: unknown): string[] | null {
  return Array.isArray(value)
    ? value.filter((site): site is string => typeof site === 'string' && site.length > 0)
    : null;
}

/**
 * Whether a stored value holds the list of the Platforms that were on, as the releases before the
 * Platform choices stored it, and no Platform choices
 */
function isEnabledListStore(stored: unknown): stored is Record<string, unknown> & { enabledSites: unknown[] } {
  return isRecord(stored) && !isRecord(stored.platformChoices) && Array.isArray(stored.enabledSites);
}

/**
 * The list of the Platforms that were on, when a release before the Platform choices changed it
 * after this release stored it (a rollback): that release saves the whole object back, keeping the
 * Platform choices this release wrote as they were and changing only the list. Told by the copy of
 * the list this release writes beside it (`storedShape`), which that release keeps unchanged.
 */
function listRewrittenByEarlierRelease(stored: Record<string, unknown>): string[] | null {
  const list = hostnamesOf(stored.enabledSites);
  const written = hostnamesOf(stored.enabledSitesWritten);
  if (!isRecord(stored.platformChoices) || list === null || written === null) {
    return null;
  }
  const same = list.length === written.length && list.every((hostname) => written.includes(hostname));
  return same ? null : list;
}

/** Whether the upgrade pass has a store to write back: a list of an earlier release, or one it rewrote */
function needsUpgrade(stored: unknown): boolean {
  return isEnabledListStore(stored) || (isRecord(stored) && listRewrittenByEarlierRelease(stored) !== null);
}

/**
 * The Site settings a stored value stands for. A value that is not an object gives the defaults;
 * a field that is missing or of the wrong type takes its default; an entry of a list or of the
 * Platform choices that is not what it holds is left out. A store of an earlier release that holds
 * the list of the Platforms that were on gives the Platform choices that list stands for, and
 * Platform choices win over such a list, unless an earlier release changed the list after this one
 * wrote it (`listRewrittenByEarlierRelease`). Fields the Site settings no longer have are ignored.
 */
export function parseSiteSettings(stored: unknown): SiteSettings {
  const defaults = defaultSiteSettings();
  if (!isRecord(stored)) {
    return defaults;
  }

  let platformChoices = defaults.platformChoices;
  if (isRecord(stored.platformChoices)) {
    platformChoices = parsePlatformChoices(stored.platformChoices);
    // The switches an earlier release made after a rollback win over the choices it carried through;
    // a Platform it did not know keeps its choice
    const rewritten = listRewrittenByEarlierRelease(stored);
    if (rewritten !== null) {
      platformChoices = { ...platformChoices, ...choicesOfEnabledList(rewritten, false) };
    }
  } else if (isEnabledListStore(stored)) {
    platformChoices = choicesOfEnabledList(hostnamesOf(stored.enabledSites) ?? [], true);
  }

  return {
    platformChoices: withoutOtherHosts(platformChoices),
    // A Custom site at a host a later release made a Platform's (copilot.cloud.microsoft once ticket
    // My-Prompt-Manager-j74b does, added by hand while the extension did nothing there) gives way to
    // the Platform: its switch decides
    customSites: Array.isArray(stored.customSites)
      ? stored.customSites.filter(isCustomSite).filter((site) => getPlatformByHostname(site.hostname) === undefined)
      : defaults.customSites,
    debugMode: typeof stored.debugMode === 'boolean' ? stored.debugMode : defaults.debugMode
  };
}

/** The Custom site of a hostname, when the user has it turned on */
export function enabledCustomSite(settings: SiteSettings, hostname: string): CustomSite | null {
  return settings.customSites.find((site) => site.hostname === hostname && site.enabled) ?? null;
}

/** The choice of the user for a hostname, own entries only: `constructor` must not read what every object inherits */
function choiceOf(settings: SiteSettings, hostname: string): boolean | undefined {
  return Object.hasOwn(settings.platformChoices, hostname) ? settings.platformChoices[hostname] : undefined;
}

/**
 * Whether a Platform is on: as the user turned it; when the user never switched it, as they turned
 * a Platform linked to it, since one switch turns them together (a Platform linked to Copilot in a
 * later release stays off for a user who turned Copilot off); else as the Platform is by default.
 * One of the other hosts of a Platform holds no choice: it is on or off as its Platform is.
 * A hostname that is no Platform and that the user never turned on is off.
 */
export function isPlatformEnabled(settings: SiteSettings, hostname: string): boolean {
  const own = choiceOf(settings, hostname);
  if (own !== undefined) {
    return own;
  }
  for (const linked of getLinkedPlatformHostnames(hostname)) {
    const choice = choiceOf(settings, linked);
    if (choice !== undefined) {
      return choice;
    }
  }
  return getPlatformByHostname(hostname)?.defaultEnabled ?? false;
}

/**
 * The hostnames of the Platforms that are on, highest priority first, each followed by the other
 * hosts it is served on, then any other hostname the user has turned on (one kept from a list an
 * earlier release stored)
 */
export function enabledPlatforms(settings: SiteSettings): string[] {
  const platforms = getPlatformsByPriority().flatMap(platformHostnames);
  const others = Object.keys(settings.platformChoices).filter((hostname) => !platforms.includes(hostname));
  return [...platforms, ...others].filter((hostname) => isPlatformEnabled(settings, hostname));
}

/** Whether the extension works on a hostname: a Platform that is on, or a Custom site that is on */
export function isHostnameEnabled(settings: SiteSettings, hostname: string): boolean {
  return isPlatformEnabled(settings, hostname) || enabledCustomSite(settings, hostname) !== null;
}

/** Every hostname the extension works on: the Platforms that are on, then the Custom sites that are on */
export function enabledHostnames(settings: SiteSettings): string[] {
  return [
    ...enabledPlatforms(settings),
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

/**
 * What storage holds for the Site settings: the Site settings, and beside them the list of the
 * Platforms that are on, which a release before the Platform choices reads, so a rollback to it
 * keeps the Platforms the user turned off off, with a copy of that list that such a release keeps
 * unchanged, so the switches it makes are seen on the next update (`listRewrittenByEarlierRelease`).
 * Both can go once no rollback to v1.9.0 or earlier is possible.
 */
function storedShape(settings: SiteSettings): SiteSettings & { enabledSites: string[]; enabledSitesWritten: string[] } {
  // An earlier release switches the hosts it knows only: a host it does not know, left on its list,
  // would no longer follow its Platform once updated again
  const enabledSites = enabledPlatforms(settings).filter((hostname) => !followsItsPlatform(hostname));
  return { ...settings, enabledSites, enabledSitesWritten: [...enabledSites] };
}

/** One change the user makes to the Site settings */
export type SiteSettingsChange =
  /** Turn a Platform on or off, with the Platforms linked to it */
  | { type: 'setPlatformEnabled'; hostname: string; enabled: boolean }
  /** Add a Custom site, or replace the one of the same hostname */
  | { type: 'addCustomSite'; site: Omit<CustomSite, 'dateAdded'> }
  | { type: 'removeCustomSite'; hostname: string }
  | { type: 'setCustomSiteEnabled'; hostname: string; enabled: boolean }
  | { type: 'setDebugMode'; enabled: boolean }
  /** Back to the defaults: nothing is left stored */
  | { type: 'reset' };

/** The Site settings once a change is applied to them. `now` dates a Custom site that is added. */
export function applySiteSettingsChange(settings: SiteSettings, change: SiteSettingsChange, now: number): SiteSettings {
  switch (change.type) {
    case 'setPlatformEnabled': {
      // A Platform already as asked is left without a choice, so it keeps following its default
      const switched = getLinkedPlatformHostnames(change.hostname)
        .filter((hostname) => !followsItsPlatform(hostname) && isPlatformEnabled(settings, hostname) !== change.enabled);
      if (switched.length === 0) {
        return settings;
      }
      const platformChoices = { ...settings.platformChoices };
      for (const hostname of switched) {
        platformChoices[hostname] = change.enabled;
      }
      return { ...settings, platformChoices };
    }
    case 'addCustomSite':
      return {
        ...settings,
        customSites: [
          ...settings.customSites.filter((site) => site.hostname !== change.site.hostname),
          { ...change.site, dateAdded: now }
        ]
      };
    case 'removeCustomSite':
      return { ...settings, customSites: settings.customSites.filter((site) => site.hostname !== change.hostname) };
    case 'setCustomSiteEnabled':
      return {
        ...settings,
        customSites: settings.customSites.map((site) =>
          site.hostname === change.hostname ? { ...site, enabled: change.enabled } : site
        )
      };
    case 'setDebugMode':
      return { ...settings, debugMode: change.enabled };
    case 'reset':
      return defaultSiteSettings();
  }
}

// Shared with the popup, the side panel and the service worker through the Web Locks API, like
// the locks of StorageManager (ADR-001): two surfaces changing the Site settings at once lose
// neither change, and Clear All Data, which takes this lock after the usage history lock
// (withUsageHistoryLock) and before the icon placement repairs lock (withIconPlacementRepairsLock),
// is not undone by a change that was waiting.
const siteSettingsLock = new AsyncMutex({ scope: 'SiteSettings' });

/** Runs an operation while no context can change the Site settings */
export function withSiteSettingsLock<T>(operation: () => Promise<T>): Promise<T> {
  return siteSettingsLock.withLock(SITE_SETTINGS_KEY, operation);
}

/**
 * Applies a change to the Site settings storage holds and saves the result. Resolves with the Site
 * settings as they now are. The open tabs follow the key in storage (onSiteSettingsChanged): no
 * message is sent to them.
 *
 * Rejects, with storage untouched, when storage cannot be read or written: a change is never
 * applied to the defaults in place of what is stored. A change that changes nothing writes
 * nothing. A reset reads nothing, so it works on a store that cannot be read.
 */
export function changeSiteSettings(change: SiteSettingsChange): Promise<SiteSettings> {
  return withSiteSettingsLock(async () => {
    if (change.type === 'reset') {
      // Nothing stored is what the defaults mean: a stored copy of them would keep today's
      // Platforms and miss the ones a later version adds
      await chrome.storage.local.remove(SITE_SETTINGS_KEY);
      return defaultSiteSettings();
    }

    const before = await readSiteSettings();
    const after = applySiteSettingsChange(before, change, Date.now());
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: storedShape(after) });
    }
    return after;
  });
}

/**
 * The upgrade of stored data for the Site settings: a store an earlier release wrote with the list
 * of the Platforms that were on, or one whose list it changed after a rollback, is written back as
 * the Platform choices it stands for, under the Site settings lock. Resolves with whether it wrote. Writes nothing on any other store, so it
 * is safe to run any number of times. The tabs see the write, and change nothing on it: what the
 * extension works on is the same before and after. Rejects when storage cannot be read or written, leaving the store as it was.
 */
export function upgradeStoredSiteSettings(): Promise<boolean> {
  return withSiteSettingsLock(async () => {
    const stored = (await chrome.storage.local.get([SITE_SETTINGS_KEY]))[SITE_SETTINGS_KEY];
    if (!needsUpgrade(stored)) {
      return false;
    }
    await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: storedShape(parseSiteSettings(stored)) });
    return true;
  });
}

/**
 * Calls the listener with the Site settings each time storage changes them, whoever did: this
 * surface, another one, Clear All Data. Returns what stops it.
 */
export function onSiteSettingsChanged(listener: (settings: SiteSettings) => void): () => void {
  const handleChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && SITE_SETTINGS_KEY in changes) {
      listener(parseSiteSettings(changes[SITE_SETTINGS_KEY].newValue));
    }
  };
  chrome.storage.onChanged.addListener(handleChange);
  return () => { chrome.storage.onChanged.removeListener(handleChange); };
}

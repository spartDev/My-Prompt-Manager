/**
 * A Platform added in a later release is on for every user, a user who changed the Site settings
 * included, and the choices of the user for the Platforms they knew are kept (product decision of
 * 2026-11-15, ticket My-Prompt-Manager-dx8).
 *
 * The release is played by the Platform list of `config/platforms`: these tests start on the
 * Platforms of today, store the Site settings, then add a Platform to the list, as a later release
 * would, and read again. Storage is the in-memory storage of the test setup.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlatformDefinition } from '../../config/platforms';

const release = vi.hoisted(() => ({ added: [] as PlatformDefinition[] }));

vi.mock('../../config/platforms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/platforms')>();
  const platforms = () => [...Object.values(actual.SUPPORTED_PLATFORMS), ...release.added];
  return {
    ...actual,
    getPlatformByHostname: (hostname: string) => platforms().find((platform) => actual.platformHostnames(platform).includes(hostname)),
    getPlatformsByPriority: () => platforms().sort((a, b) => b.priority - a.priority),
    getAllSupportedHostnames: () => platforms().flatMap(actual.platformHostnames)
  };
});

// The test setup loaded the Site settings module with the real Platform list: load it again on the mocked one
vi.resetModules();
const { getDefaultEnabledPlatforms, SUPPORTED_PLATFORMS } = await import('../../config/platforms');
const {
  changeSiteSettings,
  enabledPlatforms,
  isHostnameEnabled,
  PLATFORMS_OF_THE_ENABLED_LIST,
  readSiteSettings,
  SITE_SETTINGS_KEY,
  upgradeStoredSiteSettings
} = await import('../siteSettings');

const NEW_PLATFORM: PlatformDefinition = {
  ...SUPPORTED_PLATFORMS.claude,
  id: 'newchat',
  hostname: 'chat.new-platform.example',
  displayName: 'New chat',
  priority: 10,
  linkedPlatforms: undefined
};

/** The next release: one Platform more than today */
const shipNewPlatform = () => {
  release.added = [NEW_PLATFORM];
};

const stored = async (): Promise<unknown> => (await chrome.storage.local.get([SITE_SETTINGS_KEY]))[SITE_SETTINGS_KEY];

afterEach(() => {
  release.added = [];
});

describe('a Platform added in a later release', () => {
  // Highest priority first, the order the Platforms that are on are listed in
  const today = getDefaultEnabledPlatforms();
  const onToday = today.filter((hostname) => hostname !== 'chatgpt.com');

  it('is on for a user whose store, written by the release before the Platform choices, has one Platform turned off', async () => {
    // The release before the Platform choices stored the list of the Platforms that were on
    await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: { enabledSites: onToday, customSites: [], debugMode: false } });

    shipNewPlatform();
    const settings = await readSiteSettings();

    expect(isHostnameEnabled(settings, NEW_PLATFORM.hostname)).toBe(true);
    expect(isHostnameEnabled(settings, 'chatgpt.com')).toBe(false);
    expect(enabledPlatforms(settings)).toEqual([...onToday, NEW_PLATFORM.hostname]);
  });

  it('is on for that user once the upgrade pass has written their store as Platform choices', async () => {
    await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: { enabledSites: onToday, customSites: [], debugMode: false } });

    expect(await upgradeStoredSiteSettings()).toBe(true);
    shipNewPlatform();
    const settings = await readSiteSettings();

    expect(isHostnameEnabled(settings, NEW_PLATFORM.hostname)).toBe(true);
    expect(isHostnameEnabled(settings, 'chatgpt.com')).toBe(false);
    expect(enabledPlatforms(settings)).toEqual([...onToday, NEW_PLATFORM.hostname]);
  });

  it('is on for a user who turned a Platform off with this release, whose choice is kept', async () => {
    await changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'chatgpt.com', enabled: false });

    shipNewPlatform();
    const settings = await readSiteSettings();

    expect(isHostnameEnabled(settings, NEW_PLATFORM.hostname)).toBe(true);
    expect(enabledPlatforms(settings)).toEqual([...onToday, NEW_PLATFORM.hostname]);
  });

  it('is on for a user who never changed the Site settings', async () => {
    shipNewPlatform();

    expect(enabledPlatforms(await readSiteSettings())).toEqual([...today, NEW_PLATFORM.hostname]);
  });

  it('can be turned off, and stays off', async () => {
    shipNewPlatform();
    await changeSiteSettings({ type: 'setPlatformEnabled', hostname: NEW_PLATFORM.hostname, enabled: false });

    expect(isHostnameEnabled(await readSiteSettings(), NEW_PLATFORM.hostname)).toBe(false);
  });
});

describe('upgradeStoredSiteSettings', () => {
  it('writes the list of the Platforms that were on as the Platform choices it stands for, and keeps the rest', async () => {
    const customSite = { hostname: 'chat.example.com', displayName: 'Example chat', enabled: false, dateAdded: 1 };
    await chrome.storage.local.set({
      [SITE_SETTINGS_KEY]: { enabledSites: ['claude.ai', 'gemini.google.com'], customSites: [customSite], debugMode: true }
    });

    expect(await upgradeStoredSiteSettings()).toBe(true);

    expect(await stored()).toEqual({
      platformChoices: Object.fromEntries(
        // The Platforms of the releases that stored the list: a host added since has no choice and follows its Platform
        PLATFORMS_OF_THE_ENABLED_LIST.map((hostname) => [hostname, hostname === 'claude.ai' || hostname === 'gemini.google.com'])
      ),
      customSites: [customSite],
      debugMode: true,
      // For a rollback to an earlier release, which reads only this list, and the copy that tells its changes
      enabledSites: ['claude.ai', 'gemini.google.com'],
      enabledSitesWritten: ['claude.ai', 'gemini.google.com']
    });
  });

  describe('after a rollback to a release before the Platform choices, which saves the whole object back', () => {
    // What v1.9.0 does: it changes the list and keeps every other field as it was, the Platform choices included
    const switchInEarlierRelease = async (enabledSites: string[]) => {
      const before = (await stored()) as Record<string, unknown>;
      await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: { ...before, enabledSites } });
    };

    it('keeps off a Platform the user turned off there, and on a Platform they turned on, once updated again', async () => {
      await changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'chatgpt.com', enabled: false });
      const onBefore = enabledPlatforms(await readSiteSettings());

      // There: Gemini off, ChatGPT back on
      await switchInEarlierRelease([...onBefore.filter((hostname) => hostname !== 'gemini.google.com'), 'chatgpt.com']);

      const settings = await readSiteSettings();
      expect(isHostnameEnabled(settings, 'gemini.google.com')).toBe(false);
      expect(isHostnameEnabled(settings, 'chatgpt.com')).toBe(true);

      expect(await upgradeStoredSiteSettings()).toBe(true);
      expect(await readSiteSettings()).toEqual(settings);
      expect(await upgradeStoredSiteSettings()).toBe(false);
    });

    it('keeps the choice for a Platform that release does not know', async () => {
      shipNewPlatform();
      await changeSiteSettings({ type: 'setPlatformEnabled', hostname: NEW_PLATFORM.hostname, enabled: false });
      release.added = [];

      // Back in the earlier release, which has no row for the new Platform: Claude off
      await switchInEarlierRelease(getDefaultEnabledPlatforms().filter((hostname) => hostname !== 'claude.ai'));
      shipNewPlatform();
      const settings = await readSiteSettings();

      expect(isHostnameEnabled(settings, NEW_PLATFORM.hostname)).toBe(false);
      expect(isHostnameEnabled(settings, 'claude.ai')).toBe(false);
    });
  });

  it.each([
    ['nothing stored', undefined],
    ['a store of Platform choices', { platformChoices: { 'claude.ai': false }, customSites: [], debugMode: false }],
    ['a store with neither a list nor choices', { customSites: [], debugMode: true }]
  ])('writes nothing on %s', async (_label, value) => {
    if (value !== undefined) {
      await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: value });
    }
    vi.mocked(chrome.storage.local.set).mockClear();

    expect(await upgradeStoredSiteSettings()).toBe(false);

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(await stored()).toEqual(value);
  });

  it('is safe to run again: the second pass writes nothing', async () => {
    await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: { enabledSites: [], customSites: [], debugMode: false } });

    expect(await upgradeStoredSiteSettings()).toBe(true);
    const once = await stored();
    expect(await upgradeStoredSiteSettings()).toBe(false);

    expect(await stored()).toEqual(once);
    expect(enabledPlatforms(await readSiteSettings())).toEqual([]);
  });

  it('leaves the store as it was when storage refuses the write', async () => {
    const before = { enabledSites: ['claude.ai'], customSites: [], debugMode: false };
    await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: before });
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('quota'));

    await expect(upgradeStoredSiteSettings()).rejects.toThrow('quota');

    expect(await stored()).toEqual(before);
  });

  it('loses no change made by another surface at the same time', async () => {
    await chrome.storage.local.set({ [SITE_SETTINGS_KEY]: { enabledSites: ['claude.ai'], customSites: [], debugMode: false } });

    await Promise.all([
      upgradeStoredSiteSettings(),
      changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'chatgpt.com', enabled: true }),
      changeSiteSettings({ type: 'setDebugMode', enabled: true })
    ]);

    const settings = await readSiteSettings();
    expect(enabledPlatforms(settings)).toEqual(['claude.ai', 'chatgpt.com']);
    expect(settings.debugMode).toBe(true);
    expect(await stored()).toHaveProperty('platformChoices');
  });
});

import { describe, expect, it, vi } from 'vitest';

import { getAllSupportedHostnames, getDefaultEnabledPlatforms, getLinkedPlatformHostnames } from '../../config/platforms';
import { getChromeMock } from '../../test/mocks';
import type { CustomSite } from '../../types';
import {
  applySiteSettingsChange,
  changeSiteSettings,
  defaultSiteSettings,
  enabledCustomSite,
  enabledHostnames,
  enabledPlatforms,
  isHostnameEnabled,
  isPlatformEnabled,
  onSiteSettingsChanged,
  PLATFORMS_OF_THE_ENABLED_LIST,
  parseSiteSettings,
  readSiteSettings,
  SITE_SETTINGS_KEY,
  type SiteSettings
} from '../siteSettings';
import { StorageManager } from '../storage';

const customSite = (overrides: Partial<CustomSite> = {}): CustomSite => ({
  hostname: 'chat.example.com',
  displayName: 'Example chat',
  enabled: true,
  dateAdded: 1_700_000_000_000,
  ...overrides
});

describe('parseSiteSettings', () => {
  it.each([
    ['nothing stored', undefined],
    ['null', null],
    ['a string', 'enabled'],
    ['a list', ['claude.ai']]
  ])('gives no Platform choice, so the default Platforms on, no Custom site and debug off for %s', (_label, stored) => {
    const settings = parseSiteSettings(stored);

    expect(settings).toEqual({ platformChoices: {}, customSites: [], debugMode: false });
    expect(enabledPlatforms(settings)).toEqual(getDefaultEnabledPlatforms());
  });

  it('reads the stored Platform choices', () => {
    const settings = parseSiteSettings({ platformChoices: { 'claude.ai': false, 'chatgpt.com': true } });

    expect(settings.platformChoices).toEqual({ 'claude.ai': false, 'chatgpt.com': true });
    expect(enabledPlatforms(settings)).toEqual(getDefaultEnabledPlatforms().filter((hostname) => hostname !== 'claude.ai'));
  });

  it('leaves out of the Platform choices an entry that is not a switch', () => {
    expect(parseSiteSettings({ platformChoices: { 'claude.ai': false, 'chatgpt.com': 'off', 'gemini.google.com': null } }).platformChoices)
      .toEqual({ 'claude.ai': false });
  });

  describe('a store written before the Platform choices, which held the list of the Platforms that were on', () => {
    it('gives off for every Platform of that release missing from the list, and on for the others', () => {
      const settings = parseSiteSettings({ enabledSites: ['claude.ai'] });

      expect(enabledPlatforms(settings)).toEqual(['claude.ai']);
      expect(settings.platformChoices).toEqual(
        Object.fromEntries(PLATFORMS_OF_THE_ENABLED_LIST.map((hostname) => [hostname, hostname === 'claude.ai']))
      );
    });

    it('turns M365 Copilot on with Copilot, for a list written before M365 Copilot existed', () => {
      const settings = parseSiteSettings({ enabledSites: ['claude.ai', 'copilot.microsoft.com'] });

      expect(isPlatformEnabled(settings, 'm365.cloud.microsoft')).toBe(true);
      expect(enabledPlatforms(settings)).toEqual(['claude.ai', 'copilot.microsoft.com', 'm365.cloud.microsoft']);
    });

    it('takes M365 Copilot from a list an earlier release changed after a rollback, which lists it as it is', () => {
      const settings = parseSiteSettings({
        platformChoices: { 'claude.ai': true },
        enabledSites: ['copilot.microsoft.com'],
        enabledSitesWritten: ['claude.ai', 'copilot.microsoft.com']
      });

      expect(settings.platformChoices['m365.cloud.microsoft']).toBe(false);
      expect(settings.platformChoices['claude.ai']).toBe(false);
    });

    it('gives every Platform of that release off for an empty list', () => {
      expect(enabledPlatforms(parseSiteSettings({ enabledSites: [] }))).toEqual([]);
    });

    it('leaves out of the list what is not a hostname', () => {
      expect(enabledPlatforms(parseSiteSettings({ enabledSites: ['claude.ai', '', 42, null] }))).toEqual(['claude.ai']);
    });

    it('keeps on a hostname of the list that is no Platform, as that release had it', () => {
      const settings = parseSiteSettings({ enabledSites: ['claude.ai', 'old-platform.example.com'] });

      expect(enabledPlatforms(settings)).toEqual(['claude.ai', 'old-platform.example.com']);
      expect(isHostnameEnabled(settings, 'old-platform.example.com')).toBe(true);
    });

    it('is read by its Platform choices when it holds both', () => {
      const settings = parseSiteSettings({ enabledSites: [], platformChoices: { 'claude.ai': false } });

      expect(settings.platformChoices).toEqual({ 'claude.ai': false });
    });
  });

  it('takes the default for a field that is missing or of the wrong type', () => {
    const settings = parseSiteSettings({ enabledSites: 'claude.ai', platformChoices: ['claude.ai'], customSites: {}, debugMode: 'yes' });

    expect(settings).toEqual(defaultSiteSettings());
  });

  it('keeps a Custom site with everything it was stored with', () => {
    const site = customSite({
      icon: 'E',
      positioning: { mode: 'custom', selector: '#composer', placement: 'after', offset: { x: 4, y: 0 } }
    });

    expect(parseSiteSettings({ customSites: [site] }).customSites).toEqual([site]);
  });

  it.each([
    ['no hostname', { hostname: undefined }],
    ['an empty hostname', { hostname: '' }],
    ['no display name', { displayName: undefined }],
    ['an empty display name', { displayName: '' }],
    ['no switch', { enabled: undefined }],
    ['a switch that is not a boolean', { enabled: 'true' }],
    ['no date', { dateAdded: undefined }]
  ])('drops a Custom site entry with %s and keeps the others', (_label, broken) => {
    const kept = customSite({ hostname: 'kept.example.com' });

    const settings = parseSiteSettings({ customSites: [{ ...customSite(), ...broken }, kept, null, 'site'] });

    expect(settings.customSites).toEqual([kept]);
  });

  it('reads the debug switch', () => {
    expect(parseSiteSettings({ debugMode: true }).debugMode).toBe(true);
  });

  it('ignores floatingFallback, which a store written by an earlier version holds', () => {
    const settings = parseSiteSettings({ platformChoices: {}, customSites: [], debugMode: false, floatingFallback: true });

    expect(settings).toEqual({ platformChoices: {}, customSites: [], debugMode: false });
  });
});

describe('isPlatformEnabled', () => {
  it('is the choice of the user for a Platform they switched', () => {
    const settings = parseSiteSettings({ platformChoices: { 'claude.ai': false, 'old-platform.example.com': true } });

    expect(isPlatformEnabled(settings, 'claude.ai')).toBe(false);
    expect(isPlatformEnabled(settings, 'old-platform.example.com')).toBe(true);
  });

  it('follows the choice for a linked Platform when the user never switched this one', () => {
    // As for a Platform linked to Copilot in a later release: one switch turns them together
    const settings = parseSiteSettings({ platformChoices: { 'copilot.microsoft.com': false } });

    expect(isPlatformEnabled(settings, 'm365.cloud.microsoft')).toBe(false);
    expect(isPlatformEnabled(parseSiteSettings({ platformChoices: { 'm365.cloud.microsoft': false } }), 'copilot.microsoft.com')).toBe(false);
  });

  it('is the default of a Platform the user never switched', () => {
    for (const hostname of getAllSupportedHostnames()) {
      expect(isPlatformEnabled(defaultSiteSettings(), hostname)).toBe(getDefaultEnabledPlatforms().includes(hostname));
    }
  });

  it.each(['news.example.com', 'constructor', '__proto__', 'toString'])(
    'is off for %s, a hostname that is no Platform and that the user never turned on',
    (hostname) => {
      expect(isPlatformEnabled(defaultSiteSettings(), hostname)).toBe(false);
      expect(isHostnameEnabled(defaultSiteSettings(), hostname)).toBe(false);
    }
  );
});

describe('PLATFORMS_OF_THE_ENABLED_LIST', () => {
  // The hostnames of the Platforms added after the release that started storing the Platform
  // choices. A new Platform goes here, never in the frozen list, which says which Platforms a stored
  // list of the Platforms that were on could hold (.claude/skills/add-platform/SKILL.md)
  const ADDED_AFTER_THE_PLATFORM_CHOICES: string[] = [];

  it('is every Platform of the release that started storing the Platform choices', () => {
    const platformsOfThatRelease = getAllSupportedHostnames().filter((hostname) => !ADDED_AFTER_THE_PLATFORM_CHOICES.includes(hostname));

    expect([...PLATFORMS_OF_THE_ENABLED_LIST].sort()).toEqual(platformsOfThatRelease.sort());
  });
});

describe('isHostnameEnabled', () => {
  const settings = parseSiteSettings({
    enabledSites: ['claude.ai'],
    customSites: [customSite({ hostname: 'on.example.com' }), customSite({ hostname: 'off.example.com', enabled: false })]
  });

  it.each([
    ['a Platform that is on', 'claude.ai', true],
    ['a Platform that is off', 'chatgpt.com', false],
    ['a Custom site that is on', 'on.example.com', true],
    ['a Custom site that is off', 'off.example.com', false],
    ['a site the user never added', 'news.example.com', false],
    ['a subdomain of a Platform that is on', 'www.claude.ai', false]
  ])('%s', (_label, hostname, enabled) => {
    expect(isHostnameEnabled(settings, hostname)).toBe(enabled);
  });

  it('has every default Platform on when nothing is stored', () => {
    const defaults = parseSiteSettings(undefined);

    for (const hostname of getDefaultEnabledPlatforms()) {
      expect(isHostnameEnabled(defaults, hostname)).toBe(true);
    }
  });

  it('has a Custom site off when its stored entry is malformed', () => {
    const malformed = parseSiteSettings({ enabledSites: [], customSites: [{ hostname: 'chat.example.com', enabled: true }] });

    expect(isHostnameEnabled(malformed, 'chat.example.com')).toBe(false);
  });
});

describe('enabledCustomSite', () => {
  const on = customSite({ hostname: 'on.example.com' });
  const settings = parseSiteSettings({
    enabledSites: ['claude.ai'],
    customSites: [on, customSite({ hostname: 'off.example.com', enabled: false })]
  });

  it('is the Custom site of the hostname when it is on', () => {
    expect(enabledCustomSite(settings, 'on.example.com')).toEqual(on);
  });

  it.each([
    ['a Custom site that is off', 'off.example.com'],
    ['a Platform', 'claude.ai'],
    ['a site the user never added', 'news.example.com']
  ])('is null for %s', (_label, hostname) => {
    expect(enabledCustomSite(settings, hostname)).toBeNull();
  });
});

describe('enabledHostnames', () => {
  it('lists the Platforms that are on, then the Custom sites that are on', () => {
    const settings = parseSiteSettings({
      enabledSites: ['claude.ai', 'chatgpt.com'],
      customSites: [customSite({ hostname: 'on.example.com' }), customSite({ hostname: 'off.example.com', enabled: false })]
    });

    expect(enabledHostnames(settings)).toEqual(['claude.ai', 'chatgpt.com', 'on.example.com']);
  });
});

describe('readSiteSettings', () => {
  it('gives the defaults when storage holds no Site settings', async () => {
    expect(await readSiteSettings()).toEqual(defaultSiteSettings());
  });

  it('gives what storage holds, validated', async () => {
    const kept = customSite();
    await chrome.storage.local.set({
      [SITE_SETTINGS_KEY]: { platformChoices: { 'claude.ai': false }, customSites: [kept, { hostname: 'broken.example.com' }], debugMode: true }
    });

    expect(await readSiteSettings()).toEqual({ platformChoices: { 'claude.ai': false }, customSites: [kept], debugMode: true });
  });

  it('rejects when storage cannot be read, and never answers with the defaults', async () => {
    vi.mocked(getChromeMock().storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(readSiteSettings()).rejects.toThrow('storage unavailable');
  });
});

describe('applySiteSettingsChange', () => {
  // Gemini and Copilot off, the other Platforms on by default
  const settings: SiteSettings = {
    platformChoices: { 'gemini.google.com': false, 'copilot.microsoft.com': false, 'm365.cloud.microsoft': false },
    customSites: [customSite({ hostname: 'on.example.com' })],
    debugMode: false
  };

  it('turns a Platform off as a choice of the user and leaves the others', () => {
    const after = applySiteSettingsChange(settings, { type: 'setPlatformEnabled', hostname: 'claude.ai', enabled: false }, 0);

    expect(after.platformChoices).toEqual({ ...settings.platformChoices, 'claude.ai': false });
    expect(isPlatformEnabled(after, 'claude.ai')).toBe(false);
    expect(isPlatformEnabled(after, 'chatgpt.com')).toBe(true);
  });

  it('turns a Platform back on as a choice of the user, however many times it is asked', () => {
    const on = applySiteSettingsChange(settings, { type: 'setPlatformEnabled', hostname: 'gemini.google.com', enabled: true }, 0);
    const again = applySiteSettingsChange(on, { type: 'setPlatformEnabled', hostname: 'gemini.google.com', enabled: true }, 0);

    expect(on.platformChoices['gemini.google.com']).toBe(true);
    expect(again).toEqual(on);
  });

  it('records no choice for a Platform already as asked, which keeps following its default', () => {
    expect(applySiteSettingsChange(settings, { type: 'setPlatformEnabled', hostname: 'claude.ai', enabled: true }, 0)).toBe(settings);
  });

  it('turns the Platforms linked to a Platform on and off with it', () => {
    const linked = getLinkedPlatformHostnames('copilot.microsoft.com');
    expect(linked.length).toBeGreaterThan(1);

    const on = applySiteSettingsChange(settings, { type: 'setPlatformEnabled', hostname: 'copilot.microsoft.com', enabled: true }, 0);
    const off = applySiteSettingsChange(on, { type: 'setPlatformEnabled', hostname: 'copilot.microsoft.com', enabled: false }, 0);

    for (const hostname of linked) {
      expect(isPlatformEnabled(on, hostname)).toBe(true);
      expect(isPlatformEnabled(off, hostname)).toBe(false);
    }
  });

  it('adds a Custom site, dated now', () => {
    const { dateAdded: _dateAdded, ...site } = customSite({ hostname: 'new.example.com' });

    const after = applySiteSettingsChange(settings, { type: 'addCustomSite', site }, 42);

    expect(after.customSites).toEqual([settings.customSites[0], { ...site, dateAdded: 42 }]);
  });

  it('replaces the Custom site of the same hostname when one is added again', () => {
    const { dateAdded: _dateAdded, ...site } = customSite({ hostname: 'on.example.com', displayName: 'Renamed' });

    const after = applySiteSettingsChange(settings, { type: 'addCustomSite', site }, 42);

    expect(after.customSites).toEqual([{ ...site, dateAdded: 42 }]);
  });

  it('turns a Custom site off, and removes one', () => {
    const off = applySiteSettingsChange(settings, { type: 'setCustomSiteEnabled', hostname: 'on.example.com', enabled: false }, 0);
    const removed = applySiteSettingsChange(settings, { type: 'removeCustomSite', hostname: 'on.example.com' }, 0);

    expect(off.customSites).toEqual([{ ...settings.customSites[0], enabled: false }]);
    expect(removed.customSites).toEqual([]);
  });

  it('sets the debug switch and touches nothing else', () => {
    expect(applySiteSettingsChange(settings, { type: 'setDebugMode', enabled: true }, 0)).toEqual({ ...settings, debugMode: true });
  });

  it('resets to the defaults', () => {
    expect(applySiteSettingsChange(settings, { type: 'reset' }, 0)).toEqual(defaultSiteSettings());
  });

  it('leaves the settings it was given as they were', () => {
    const before = structuredClone(settings);

    applySiteSettingsChange(settings, { type: 'setPlatformEnabled', hostname: 'claude.ai', enabled: false }, 0);
    applySiteSettingsChange(settings, { type: 'removeCustomSite', hostname: 'on.example.com' }, 0);

    expect(settings).toEqual(before);
  });
});

describe('changeSiteSettings', () => {
  // The in-memory storage of the test setup, kept to put back after a read made to fail
  const readStorage = vi.mocked(chrome.storage.local.get).getMockImplementation() as never;
  const stored = async (): Promise<unknown> => (await chrome.storage.local.get([SITE_SETTINGS_KEY]))[SITE_SETTINGS_KEY];
  const store = (settings: unknown) => chrome.storage.local.set({ [SITE_SETTINGS_KEY]: settings });
  const openTabs = (tabs: Array<Partial<chrome.tabs.Tab>>) => {
    vi.mocked(chrome.tabs.query).mockImplementation((async (query: chrome.tabs.QueryInfo) =>
      tabs.filter((tab) => query.url === undefined || (tab.url ?? '').includes(String(query.url).replace(/^\*:\/\/|\/\*$/g, '')))
    ) as never);
  };
  const sent = () => vi.mocked(chrome.tabs.sendMessage).mock.calls.map(([tabId, message]) => ({ tabId, message }));

  it('applies the change to what storage holds and resolves with the result', async () => {
    await store({ platformChoices: { 'gemini.google.com': false }, customSites: [], debugMode: true });

    const settings = await changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'claude.ai', enabled: false });

    expect(settings).toEqual({ platformChoices: { 'gemini.google.com': false, 'claude.ai': false }, customSites: [], debugMode: true });
    expect(parseSiteSettings(await stored())).toEqual(settings);
  });

  it('starts from no choice when nothing is stored, and stores only the choice made', async () => {
    await changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'chatgpt.com', enabled: false });

    expect(await stored()).toEqual({
      platformChoices: { 'chatgpt.com': false },
      customSites: [],
      debugMode: false,
      enabledSites: getDefaultEnabledPlatforms().filter((hostname) => hostname !== 'chatgpt.com'),
      enabledSitesWritten: getDefaultEnabledPlatforms().filter((hostname) => hostname !== 'chatgpt.com')
    });
  });

  it('stores beside the Platform choices the list of the Platforms that are on, which a rollback to an earlier release reads', async () => {
    await store({ enabledSites: ['claude.ai', 'chatgpt.com'], customSites: [], debugMode: false });

    await changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'gemini.google.com', enabled: true });

    // An earlier release reads only this list: the Platforms the user turned off stay off there
    expect(await stored()).toMatchObject({ enabledSites: ['claude.ai', 'chatgpt.com', 'gemini.google.com'] });
  });

  it('writes a store of an earlier release, the list of the Platforms that were on, as Platform choices on its next change', async () => {
    await store({ enabledSites: ['claude.ai', 'chatgpt.com'], customSites: [], debugMode: false });

    await changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'claude.ai', enabled: false });

    const after = parseSiteSettings(await stored());
    expect(await stored()).toHaveProperty('platformChoices');
    expect(enabledPlatforms(after)).toEqual(['chatgpt.com']);
  });

  it('loses neither change when two surfaces change the Site settings at once', async () => {
    await store({ platformChoices: {}, customSites: [], debugMode: false });
    const { dateAdded: _dateAdded, ...site } = customSite();

    await Promise.all([
      changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'claude.ai', enabled: false }),
      changeSiteSettings({ type: 'addCustomSite', site }),
      changeSiteSettings({ type: 'setDebugMode', enabled: true })
    ]);

    expect(await stored()).toMatchObject({ platformChoices: { 'claude.ai': false }, customSites: [site], debugMode: true });
  });

  it('refuses the change and leaves storage untouched when storage cannot be read', async () => {
    const before = { platformChoices: { 'chatgpt.com': false }, customSites: [], debugMode: false };
    await store(before);
    vi.mocked(chrome.storage.local.set).mockClear();
    vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'chatgpt.com', enabled: true })).rejects.toThrow('storage unavailable');

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    expect(await stored()).toEqual(before);
  });

  it('rejects and sends nothing when storage refuses the write', async () => {
    await store({ platformChoices: {}, customSites: [], debugMode: false });
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('quota'));

    await expect(changeSiteSettings({ type: 'setDebugMode', enabled: true })).rejects.toThrow('quota');

    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('writes nothing and sends nothing for a change that changes nothing', async () => {
    await store({ platformChoices: {}, customSites: [], debugMode: false });
    vi.mocked(chrome.storage.local.set).mockClear();
    openTabs([{ id: 1, url: 'https://claude.ai/chat' }]);

    await changeSiteSettings({ type: 'setPlatformEnabled', hostname: 'claude.ai', enabled: true });

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('sends the new Site settings to every web tab, and to no other', async () => {
    await store({ platformChoices: {}, customSites: [], debugMode: false });
    openTabs([
      { id: 1, url: 'https://claude.ai/chat' },
      { id: 2, url: 'http://localhost:3000/' },
      { id: 3, url: 'chrome://extensions' },
      { url: 'https://no-id.example.com/' }
    ]);

    const settings = await changeSiteSettings({ type: 'setDebugMode', enabled: true });

    expect(sent()).toEqual([
      { tabId: 1, message: { action: 'settingsUpdated', settings } },
      { tabId: 2, message: { action: 'settingsUpdated', settings } }
    ]);
  });

  it.each([
    ['added', { type: 'addCustomSite', site: { hostname: 'chat.example.com', displayName: 'Example chat', enabled: true } }],
    ['turned off', { type: 'setCustomSiteEnabled', hostname: 'chat.example.com', enabled: false }],
    ['removed', { type: 'removeCustomSite', hostname: 'chat.example.com' }]
  ] as const)('asks the tabs of a Custom site to start over when it is %s', async (label, change) => {
    await store({ platformChoices: {}, customSites: label === 'added' ? [] : [customSite()], debugMode: false });
    openTabs([{ id: 1, url: 'https://claude.ai/chat' }, { id: 2, url: 'https://chat.example.com/thread' }]);

    await changeSiteSettings(change);

    expect(sent().filter(({ message }) => (message as { action: string }).action === 'reinitialize')).toEqual([
      { tabId: 2, message: { action: 'reinitialize', reason: 'custom_site_added' } }
    ]);
  });

  it('keeps the change when a tab does not answer or the tabs cannot be listed', async () => {
    await store({ platformChoices: {}, customSites: [], debugMode: false });
    openTabs([{ id: 1, url: 'https://claude.ai/chat' }]);
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValue(new Error('no receiver'));

    await expect(changeSiteSettings({ type: 'setDebugMode', enabled: true })).resolves.toMatchObject({ debugMode: true });

    vi.mocked(chrome.tabs.query).mockRejectedValue(new Error('tabs unavailable'));

    await expect(changeSiteSettings({ type: 'setDebugMode', enabled: false })).resolves.toMatchObject({ debugMode: false });
    expect(await stored()).toMatchObject({ debugMode: false });
  });

  describe('reset', () => {
    it('leaves nothing stored, resolves with the defaults and sends them to the tabs', async () => {
      await store({ platformChoices: {}, customSites: [customSite()], debugMode: true });
      openTabs([{ id: 1, url: 'https://claude.ai/chat' }]);

      const settings = await changeSiteSettings({ type: 'reset' });

      expect(settings).toEqual(defaultSiteSettings());
      expect(await chrome.storage.local.get(null)).not.toHaveProperty(SITE_SETTINGS_KEY);
      expect(sent()).toEqual([{ tabId: 1, message: { action: 'settingsUpdated', settings } }]);
    });

    it('works on a store that cannot be read, since it reads nothing', async () => {
      await store({ platformChoices: {}, customSites: [customSite()], debugMode: true });
      vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));

      await expect(changeSiteSettings({ type: 'reset' })).resolves.toEqual(defaultSiteSettings());

      vi.mocked(chrome.storage.local.get).mockReset().mockImplementation(readStorage);
      expect(await chrome.storage.local.get(null)).not.toHaveProperty(SITE_SETTINGS_KEY);
    });

    it('removes a stored copy of the defaults, which would miss a Platform added later', async () => {
      await store(defaultSiteSettings());

      await changeSiteSettings({ type: 'reset' });

      expect(await chrome.storage.local.get(null)).not.toHaveProperty(SITE_SETTINGS_KEY);
    });
  });

  it('does not write the Site settings back after Clear All Data asked for while the change was reading them', async () => {
    await store({ platformChoices: {}, customSites: [customSite()], debugMode: false });
    // The change has read the Site settings and is paused before it writes, as in another surface
    const get = vi.mocked(chrome.storage.local.get);
    const readNow = get.getMockImplementation() as unknown as (keys: unknown) => Promise<Record<string, unknown>>;
    let resume!: () => void;
    const paused = new Promise<void>((resolve) => { resume = resolve; });
    get.mockImplementationOnce((async (keys: unknown) => {
      const result = await readNow(keys);
      await paused;
      return result;
    }) as never);

    const changed = changeSiteSettings({ type: 'setCustomSiteEnabled', hostname: 'chat.example.com', enabled: false });
    const cleared = StorageManager.getInstance().clearAllData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    resume();
    await Promise.all([changed, cleared]);

    // Clear All Data waited for the change to finish, then cleared what it wrote
    expect(await chrome.storage.local.get(null)).toEqual({});
  });
});

describe('onSiteSettingsChanged', () => {
  it('follows every change of the stored Site settings, and stops when asked', async () => {
    const seen: SiteSettings[] = [];
    const stop = onSiteSettingsChanged((settings) => seen.push(settings));

    const changed = await changeSiteSettings({ type: 'setDebugMode', enabled: true });
    await chrome.storage.local.set({ prompts: [] });
    await chrome.storage.local.clear();
    stop();
    await changeSiteSettings({ type: 'setDebugMode', enabled: true });

    expect(seen).toEqual([changed, defaultSiteSettings()]);
  });
});

import { describe, expect, it, vi } from 'vitest';

import { getDefaultEnabledPlatforms } from '../../config/platforms';
import { getChromeMock } from '../../test/mocks';
import type { CustomSite } from '../../types';
import {
  defaultSiteSettings,
  enabledCustomSite,
  enabledHostnames,
  isHostnameEnabled,
  parseSiteSettings,
  readSiteSettings,
  SITE_SETTINGS_KEY
} from '../siteSettings';

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
  ])('gives the default Platforms, no Custom site and debug off for %s', (_label, stored) => {
    expect(parseSiteSettings(stored)).toEqual({
      enabledSites: getDefaultEnabledPlatforms(),
      customSites: [],
      debugMode: false
    });
  });

  it('uses a stored list of Platforms as it is, an empty one included', () => {
    expect(parseSiteSettings({ enabledSites: ['claude.ai'] }).enabledSites).toEqual(['claude.ai']);
    expect(parseSiteSettings({ enabledSites: [] }).enabledSites).toEqual([]);
  });

  it('leaves out of the Platforms what is not a hostname', () => {
    expect(parseSiteSettings({ enabledSites: ['claude.ai', '', 42, null] }).enabledSites).toEqual(['claude.ai']);
  });

  it('takes the default for a field that is missing or of the wrong type', () => {
    const settings = parseSiteSettings({ enabledSites: 'claude.ai', customSites: {}, debugMode: 'yes' });

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
    const settings = parseSiteSettings({ enabledSites: ['claude.ai'], customSites: [], debugMode: false, floatingFallback: true });

    expect(settings).toEqual({ enabledSites: ['claude.ai'], customSites: [], debugMode: false });
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
      [SITE_SETTINGS_KEY]: { enabledSites: ['claude.ai'], customSites: [kept, { hostname: 'broken.example.com' }], debugMode: true }
    });

    expect(await readSiteSettings()).toEqual({ enabledSites: ['claude.ai'], customSites: [kept], debugMode: true });
  });

  it('rejects when storage cannot be read, and never answers with the defaults', async () => {
    vi.mocked(getChromeMock().storage.local.get).mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(readSiteSettings()).rejects.toThrow('storage unavailable');
  });
});

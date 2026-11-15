import { describe, expect, it, vi } from 'vitest';

import {
  markReleaseSeen,
  parseWhatsNewRecord,
  readWhatsNewRecord,
  recordInstall,
  WHATS_NEW_KEY
} from '../storage';

const stored = async (): Promise<unknown> => (await chrome.storage.local.get(WHATS_NEW_KEY))[WHATS_NEW_KEY];

describe('What\'s new record: reading', () => {
  it('reads a missing key as {}', async () => {
    await expect(readWhatsNewRecord()).resolves.toEqual({});
  });

  it('reads a stored record', async () => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '2.0.0' } });
    await expect(readWhatsNewRecord()).resolves.toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
  });

  it.each([
    ['a string', 'corrupted'],
    ['a number', 42],
    ['null', null],
    ['an array', ['2.0.0']],
    ['a boolean', true]
  ])('reads a malformed whatsNew value (%s) as {}', async (_label, value) => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: value });
    await expect(readWhatsNewRecord()).resolves.toEqual({});
    expect(() => parseWhatsNewRecord(value)).not.toThrow();
  });

  it('leaves out a field that is not a non-empty string and keeps the other', () => {
    expect(parseWhatsNewRecord({ installedVersion: 2, lastSeenVersion: '2.0.0' })).toEqual({ lastSeenVersion: '2.0.0' });
    expect(parseWhatsNewRecord({ installedVersion: '1.9.0', lastSeenVersion: '' })).toEqual({ installedVersion: '1.9.0' });
    expect(parseWhatsNewRecord({ other: 'x' })).toEqual({});
  });
});

describe('What\'s new record: markReleaseSeen', () => {
  it('writes lastSeenVersion in normal mode', async () => {
    await markReleaseSeen('2.0.0', { debugMode: false });

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    expect(await stored()).toEqual({ lastSeenVersion: '2.0.0' });
  });

  it('writes nothing in Debug mode', async () => {
    await markReleaseSeen('2.0.0', { debugMode: true });

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(await stored()).toBeUndefined();
  });

  it('keeps installedVersion when it writes lastSeenVersion', async () => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0' } });

    await markReleaseSeen('2.0.0', { debugMode: false });

    expect(await stored()).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
  });

  it('replaces a malformed value instead of throwing', async () => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: 'corrupted' });

    await markReleaseSeen('2.0.0', { debugMode: false });

    expect(await stored()).toEqual({ lastSeenVersion: '2.0.0' });
  });

  it('rejects, with storage untouched, when storage cannot be written', async () => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { lastSeenVersion: '1.9.0' } });
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));

    await expect(markReleaseSeen('2.0.0', { debugMode: false })).rejects.toThrow('QUOTA_BYTES');
    expect(await stored()).toEqual({ lastSeenVersion: '1.9.0' });
  });
});

describe('What\'s new record: recordInstall', () => {
  it('writes installedVersion', async () => {
    await recordInstall('2.0.0');

    expect(await stored()).toEqual({ installedVersion: '2.0.0' });
  });

  it('keeps lastSeenVersion when it writes installedVersion', async () => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { lastSeenVersion: '1.9.0' } });

    await recordInstall('2.0.0');

    expect(await stored()).toEqual({ installedVersion: '2.0.0', lastSeenVersion: '1.9.0' });
  });

  it('serializes concurrent writes so neither field is lost', async () => {
    await Promise.all([recordInstall('2.0.0'), markReleaseSeen('2.0.0', { debugMode: false })]);

    expect(await stored()).toEqual({ installedVersion: '2.0.0', lastSeenVersion: '2.0.0' });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SITE_SETTINGS_KEY } from '../../services/siteSettings';
import { buildPrompt } from '../../test/builders';
import { WELCOME_KEY } from '../../welcome/storage';
import { WHATS_NEW_KEY } from '../../whatsNew/storage';
import { type LaunchStateChange, writeLaunchState } from '../write';

const NORMAL = { debugMode: false } as const;
const DEBUG = { debugMode: true } as const;

/** The whole of chrome.storage.local, as bytes */
const snapshot = async (): Promise<string> => JSON.stringify(await chrome.storage.local.get(null));

const stored = async (key: string): Promise<unknown> => (await chrome.storage.local.get(key))[key];

/** The writes, removals and clears storage was asked for */
const storageChanges = (): unknown[] => [
  ...vi.mocked(chrome.storage.local.set).mock.calls,
  ...vi.mocked(chrome.storage.local.remove).mock.calls,
  ...vi.mocked(chrome.storage.local.clear).mock.calls
];

/** The Welcome, from its first step to its end, then What's new closed, as the owner goes through it in Debug mode */
const WHOLE_JOURNEY: readonly LaunchStateChange[] = [
  { kind: 'welcome-step', step: 0 },
  { kind: 'welcome-step', step: 1 },
  { kind: 'welcome-step', step: 2, packs: ['product', 'writing'] },
  { kind: 'welcome-done', version: '2.0.0' },
  { kind: 'release-seen', version: '2.0.0' }
];

describe('writeLaunchState', () => {
  beforeEach(async () => {
    // A user part-way through the Welcome after an update to 2.0.0, with a Library and Debug mode on
    await chrome.storage.local.set({
      [WELCOME_KEY]: { status: 'pending', step: 1, packs: ['writing'] },
      [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '1.9.0' },
      [SITE_SETTINGS_KEY]: { enabledSites: ['claude.ai'], customSites: [], debugMode: true },
      prompts: [buildPrompt({ id: 'p1', title: 'Draft email' })]
    });
    vi.mocked(chrome.storage.local.set).mockClear();
    vi.mocked(chrome.storage.local.remove).mockClear();
    vi.mocked(chrome.storage.local.clear).mockClear();
  });

  describe('in Debug mode, writes nothing', () => {
    it('the steps 0, 1, 2, the end and the Release seen leave the whole of chrome.storage.local byte-identical', async () => {
      const before = await snapshot();

      for (const change of WHOLE_JOURNEY) {
        await writeLaunchState(change, DEBUG);
      }

      expect(await snapshot()).toBe(before);
      expect(storageChanges()).toEqual([]);
    });

    it.each<[string, Record<string, unknown>]>([
      ['a pending record', { [WELCOME_KEY]: { status: 'pending', step: 0 } }],
      ['a done record', { [WELCOME_KEY]: { status: 'done' } }],
      ['no Welcome record and no What\'s new record', {}]
    ])('over %s too', async (_label, records) => {
      await chrome.storage.local.remove([WELCOME_KEY, WHATS_NEW_KEY]);
      await chrome.storage.local.set(records);
      vi.mocked(chrome.storage.local.set).mockClear();
      vi.mocked(chrome.storage.local.remove).mockClear();
      const before = await snapshot();

      for (const change of WHOLE_JOURNEY) {
        await writeLaunchState(change, DEBUG);
      }

      expect(await snapshot()).toBe(before);
      expect(storageChanges()).toEqual([]);
    });

    it('reads nothing either, so it resolves even when storage cannot be reached', async () => {
      vi.mocked(chrome.storage.local.get).mockClear();
      vi.mocked(chrome.storage.local.get).mockRejectedValue(new Error('storage unavailable'));

      for (const change of WHOLE_JOURNEY) {
        await expect(writeLaunchState(change, DEBUG)).resolves.toBeUndefined();
      }
      expect(chrome.storage.local.get).not.toHaveBeenCalled();
    });
  });

  describe('out of Debug mode, each change persists', () => {
    it('welcome-step: the step reached and the Packs selected', async () => {
      await writeLaunchState({ kind: 'welcome-step', step: 2, packs: ['product'] }, NORMAL);

      expect(await stored(WELCOME_KEY)).toEqual({ status: 'pending', step: 2, packs: ['product'] });
    });

    it('welcome-step without Packs: the step, with the Packs already stored', async () => {
      await writeLaunchState({ kind: 'welcome-step', step: 0 }, NORMAL);

      expect(await stored(WELCOME_KEY)).toEqual({ status: 'pending', step: 0, packs: ['writing'] });
    });

    it('welcome-step over no record: nothing, the popup never makes a record the service worker did not', async () => {
      await chrome.storage.local.remove(WELCOME_KEY);
      vi.mocked(chrome.storage.local.set).mockClear();

      await writeLaunchState({ kind: 'welcome-step', step: 2, packs: ['product'] }, NORMAL);

      expect(await stored(WELCOME_KEY)).toBeUndefined();
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('welcome-done: the Welcome finished, and the installed Release as the Last seen Release', async () => {
      await writeLaunchState({ kind: 'welcome-done', version: '2.0.0' }, NORMAL);

      expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' });
      expect(await stored(WHATS_NEW_KEY)).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
    });

    it('release-seen: the Last seen Release, the Release of install kept, the Welcome record untouched', async () => {
      await writeLaunchState({ kind: 'release-seen', version: '2.0.0' }, NORMAL);

      expect(await stored(WHATS_NEW_KEY)).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
      expect(await stored(WELCOME_KEY)).toEqual({ status: 'pending', step: 1, packs: ['writing'] });
    });

    it('the whole journey: the Welcome done and the Release seen, nothing else changed', async () => {
      const { [WELCOME_KEY]: _welcome, [WHATS_NEW_KEY]: _whatsNew, ...others } = await chrome.storage.local.get(null);

      for (const change of WHOLE_JOURNEY) {
        await writeLaunchState(change, NORMAL);
      }

      expect(await chrome.storage.local.get(null)).toEqual({
        ...others,
        [WELCOME_KEY]: { status: 'done' },
        [WHATS_NEW_KEY]: { installedVersion: '1.9.0', lastSeenVersion: '2.0.0' }
      });
    });
  });

  describe('done is final', () => {
    it.each<[string, LaunchStateChange]>([
      ['the first step', { kind: 'welcome-step', step: 0 }],
      ['a step with Packs', { kind: 'welcome-step', step: 2, packs: ['product'] }],
      ['the end again', { kind: 'welcome-done', version: '2.0.0' }]
    ])('a later write of %s does not reopen a finished Welcome', async (_label, change) => {
      await writeLaunchState({ kind: 'welcome-done', version: '2.0.0' }, NORMAL);

      await writeLaunchState(change, NORMAL);

      expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' });
    });

    it('a step written late, by a second popup or side panel still on the Welcome, lands before or after the end, and the end wins', async () => {
      const step = writeLaunchState({ kind: 'welcome-step', step: 2 }, NORMAL);
      const done = writeLaunchState({ kind: 'welcome-done', version: '2.0.0' }, NORMAL);
      const lateStep = writeLaunchState({ kind: 'welcome-step', step: 1 }, NORMAL);

      await Promise.all([step, done, lateStep]);

      expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' });
    });
  });

  describe('a failed write', () => {
    it('rejects when storage cannot be written', async () => {
      vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));

      await expect(writeLaunchState({ kind: 'welcome-step', step: 2 }, NORMAL)).rejects.toThrow('QUOTA_BYTES');
      expect(await stored(WELCOME_KEY)).toEqual({ status: 'pending', step: 1, packs: ['writing'] });
    });

    it('welcome-done still marks the Release seen when the Welcome record cannot be written, then rejects', async () => {
      const set = vi.mocked(chrome.storage.local.set);
      const writeNow = set.getMockImplementation() as unknown as (items: Record<string, unknown>) => Promise<void>;
      set.mockImplementation((async (items: Record<string, unknown>) => {
        if (WELCOME_KEY in items) {
          throw new Error('QUOTA_BYTES quota exceeded');
        }
        return writeNow(items);
      }) as never);

      await expect(writeLaunchState({ kind: 'welcome-done', version: '2.0.0' }, NORMAL)).rejects.toThrow('QUOTA_BYTES');

      expect(await stored(WHATS_NEW_KEY)).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
      expect(await stored(WELCOME_KEY)).toEqual({ status: 'pending', step: 1, packs: ['writing'] });
    });

    it('welcome-done still marks the Welcome finished when the Release cannot be marked seen, then rejects', async () => {
      const set = vi.mocked(chrome.storage.local.set);
      const writeNow = set.getMockImplementation() as unknown as (items: Record<string, unknown>) => Promise<void>;
      set.mockImplementation((async (items: Record<string, unknown>) => {
        if (WHATS_NEW_KEY in items) {
          throw new Error('QUOTA_BYTES quota exceeded');
        }
        return writeNow(items);
      }) as never);

      await expect(writeLaunchState({ kind: 'welcome-done', version: '2.0.0' }, NORMAL)).rejects.toThrow('QUOTA_BYTES');

      expect(await stored(WELCOME_KEY)).toEqual({ status: 'done' });
      expect(await stored(WHATS_NEW_KEY)).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '1.9.0' });
    });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { getChromeMock } from '../../test/mocks';
import { USAGE_RETENTION_DAYS, USAGE_STORAGE_KEY, type UsageEvent } from '../../types';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

type InstalledListener = (details: chrome.runtime.InstalledDetails) => void;
type StartupListener = () => void;

/**
 * Loads the background script afresh and returns the listeners it registered for
 * chrome.runtime.onInstalled and chrome.runtime.onStartup, plus the Logger that fresh copy uses.
 */
async function loadBackground(): Promise<{
  onInstalled: InstalledListener;
  onStartup: StartupListener;
  Logger: typeof import('../../utils/logger');
}> {
  vi.resetModules();

  const addInstalled = vi.mocked(getChromeMock().runtime.onInstalled.addListener);
  const addStartup = vi.mocked(getChromeMock().runtime.onStartup.addListener);
  addInstalled.mockClear();
  addStartup.mockClear();

  await import('../background');
  const Logger = await import('../../utils/logger');

  const onInstalled = addInstalled.mock.calls[addInstalled.mock.calls.length - 1]?.[0];
  if (!onInstalled) {
    throw new Error('The background script did not register a chrome.runtime.onInstalled listener');
  }
  const startupListeners = addStartup.mock.calls.map(([listener]) => listener as StartupListener);
  const onStartup: StartupListener = () => {
    for (const listener of startupListeners) {
      listener();
    }
  };

  return { onInstalled, onStartup, Logger };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = USAGE_RETENTION_DAYS * DAY_MS;

const insertion = (promptId: string, timestamp: number): UsageEvent => ({
  promptId,
  timestamp,
  platform: 'claude',
  categoryId: null
});

const storedHistory = async (): Promise<unknown> =>
  (await chrome.storage.local.get(USAGE_STORAGE_KEY))[USAGE_STORAGE_KEY];

/**
 * The usage history keeps the insertions of the retention period (USAGE_RETENTION_DAYS, the 30 days
 * Analytics shows) and no older ones (ticket My-Prompt-Manager-qk1v): the service worker removes the
 * older ones at every browser startup and on an extension update; UsageTracker.record removes them
 * at each insertion (src/services/__tests__/UsageTracker.test.ts).
 */
describe('background: the usage history keeps no insertion older than the retention period', () => {
  const UPDATE = { reason: 'update', previousVersion: '2.0.0' } as const;

  it.each([
    ['at browser startup', ({ onStartup }: Awaited<ReturnType<typeof loadBackground>>) => { onStartup(); }],
    ['on an extension update', ({ onInstalled }: Awaited<ReturnType<typeof loadBackground>>) => { onInstalled(UPDATE); }]
  ])('removes %s an insertion older than the retention period, and keeps one inside it', async (_when, fire) => {
    const now = Date.now();
    const inside = insertion('inside', now - RETENTION_MS + DAY_MS);
    const older = insertion('older', now - RETENTION_MS - DAY_MS);
    await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: [older, inside] });
    const background = await loadBackground();

    fire(background);

    await vi.waitFor(async () => {
      expect(await storedHistory()).toEqual([inside]);
    });
  });

  it('writes nothing at startup when every insertion is inside the retention period', async () => {
    const history = [insertion('inside', Date.now() - DAY_MS)];
    await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: history });
    vi.mocked(chrome.storage.local.set).mockClear();
    const { onStartup } = await loadBackground();

    onStartup();

    await vi.waitFor(() => {
      expect(chrome.action.setPopup).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    expect(await storedHistory()).toEqual(history);
  });

  it('logs a failure of the removal instead of throwing it', async () => {
    await chrome.storage.local.set({
      [USAGE_STORAGE_KEY]: [insertion('older', Date.now() - RETENTION_MS - DAY_MS)]
    });
    vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('QUOTA_EXCEEDED'));
    const { onStartup, Logger } = await loadBackground();

    expect(() => {
      onStartup();
    }).not.toThrow();

    await vi.waitFor(() => {
      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('usage history'),
        expect.objectContaining({ type: 'STORAGE_QUOTA_EXCEEDED' }),
        expect.objectContaining({ component: 'Background', phase: 'usage_retention' })
      );
    });
  });
});

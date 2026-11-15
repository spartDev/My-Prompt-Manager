import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ICON_PLACEMENT_REPAIRS_KEY } from '../../services/iconPlacementRepairs';
import { getChromeMock } from '../../test/mocks';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

type MessageListener = (
  message: { type: string; data?: Record<string, unknown> },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | undefined;

const CLAUDE_TAB = { id: 7, windowId: 3, url: 'https://claude.ai/new', active: true } as chrome.tabs.Tab;
const SEND_BUTTON = 'button[aria-label="Send"]';

/**
 * Loads the service worker afresh, as Chrome does when it starts it again: nothing it held in
 * memory is left, while chrome.storage keeps what was written. Returns its runtime.onMessage listener.
 */
async function startServiceWorker(): Promise<MessageListener> {
  vi.resetModules();
  const addListener = vi.mocked(getChromeMock().runtime.onMessage.addListener);
  addListener.mockClear();
  await import('../background');
  const listener = addListener.mock.calls[addListener.mock.calls.length - 1]?.[0];
  if (!listener) {
    throw new Error('The service worker did not register a runtime.onMessage listener');
  }
  return listener as unknown as MessageListener;
}

/** Sends a message to the service worker and waits for its answer */
function send(listener: MessageListener, message: { type: string; data?: Record<string, unknown> }, sender: chrome.runtime.MessageSender = {}): Promise<unknown> {
  return new Promise((resolve) => {
    listener(message, sender, resolve);
  });
}

const storedRepairs = async (): Promise<unknown> => (await chrome.storage.local.get(ICON_PLACEMENT_REPAIRS_KEY))[ICON_PLACEMENT_REPAIRS_KEY];

describe('background: placing the icon of a built-in Platform', () => {
  beforeEach(() => {
    const chromeMock = getChromeMock();
    Object.assign(chromeMock.tabs, { get: vi.fn().mockResolvedValue(CLAUDE_TAB) });
    Object.assign(chromeMock.tabs, { update: vi.fn().mockResolvedValue(CLAUDE_TAB) });
  });

  it('stores the pick when the service worker was stopped between opening the picker and the click', async () => {
    const beforeRestart = await startServiceWorker();
    expect(await send(beforeRestart, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } }))
      .toEqual({ success: true, tabId: CLAUDE_TAB.id });

    // Chrome stops the idle service worker while the user hovers, and starts it again for the click
    const afterRestart = await startServiceWorker();
    const response = await send(
      afterRestart,
      { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } },
      { tab: CLAUDE_TAB }
    );

    expect(response).toEqual({ success: true });
    expect(await storedRepairs()).toEqual({
      'claude.ai': { override: { mode: 'custom', placement: 'before', selector: SEND_BUTTON } }
    });
  });

  it('keeps no session once the pick is stored, so a second click stores nothing', async () => {
    const listener = await startServiceWorker();
    await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });
    await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB });

    const again = await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: 'textarea' } }, { tab: CLAUDE_TAB });

    expect(again).toEqual({ success: false, error: 'No active picker session' });
  });

  it('forgets the session of a tab that closes while the user picks', async () => {
    const listener = await startServiceWorker();
    await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });

    const onRemoved = vi.mocked(getChromeMock().tabs.onRemoved.addListener).mock.calls.at(-1)?.[0];
    onRemoved?.(CLAUDE_TAB.id as number, { windowId: 3, isWindowClosing: false });

    await vi.waitFor(async () => {
      expect(await chrome.storage.session.get(null)).toEqual({});
    });
  });

  it('refuses for good a placement report from a tab that is not on a built-in Platform', async () => {
    const listener = await startServiceWorker();

    const response = await send(
      listener,
      { type: 'ICON_PLACEMENT_REPORTED', data: { placement: 'overlay' } },
      { tab: { ...CLAUDE_TAB, url: 'https://example.com/chat' } }
    );

    expect(response).toEqual({ success: false, error: expect.any(String), permanent: true });
    expect(await storedRepairs()).toBeUndefined();
  });

  it('answers a placement report it could not save without marking it permanent, so it is sent again', async () => {
    const listener = await startServiceWorker();
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));

    const response = await send(listener, { type: 'ICON_PLACEMENT_REPORTED', data: { placement: 'overlay' } }, { tab: CLAUDE_TAB });

    expect(response).toEqual({ success: false, error: expect.stringContaining('quota') });
    expect(response).not.toHaveProperty('permanent');
  });
});

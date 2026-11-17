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
  message: { type: string; attempt?: string; data?: Record<string, unknown> },
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
function send(listener: MessageListener, message: { type: string; attempt?: string; data?: Record<string, unknown> }, sender: chrome.runtime.MessageSender = {}): Promise<unknown> {
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

  it('records no placement from a prerendered page, which is not its tab\'s page yet', async () => {
    const listener = await startServiceWorker();

    const response = await send(
      listener,
      { type: 'ICON_PLACEMENT_REPORTED', data: { placement: 'overlay' } },
      { tab: CLAUDE_TAB, documentLifecycle: 'prerender' }
    );

    expect(response).toEqual({ success: false, error: expect.any(String) });
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

describe('background: the icon placement of each tab of a Platform', () => {
  const OTHER_CLAUDE_TAB = { id: 8, windowId: 3, url: 'https://claude.ai/chat/1', active: false } as chrome.tabs.Tab;
  const report = (listener: MessageListener, tab: chrome.tabs.Tab, placement: string) =>
    send(listener, { type: 'ICON_PLACEMENT_REPORTED', data: { placement } }, { tab });
  /** Runs every listener the service worker registered for this tab event */
  const tabEvent = (event: 'onRemoved' | 'onUpdated' | 'onReplaced', ...args: unknown[]) => {
    for (const [listener] of vi.mocked(getChromeMock().tabs[event].addListener).mock.calls) {
      (listener as (...eventArgs: unknown[]) => void)(...args);
    }
  };
  /** The pick stored for Claude in the first tab, whose toolbar changed; the other tab's toolbar is found */
  const pickInClaudeTab = async (listener: MessageListener) => {
    await report(listener, CLAUDE_TAB, 'overlay');
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'overlay', override: { mode: 'custom', placement: 'before', selector: SEND_BUTTON } } } });
    await report(listener, CLAUDE_TAB, 'override');
  };

  it('keeps the pick while the tab that needs it is open, and drops it once that tab closed', async () => {
    const listener = await startServiceWorker();
    await pickInClaudeTab(listener);

    expect(await report(listener, OTHER_CLAUDE_TAB, 'toolbar')).toEqual({ success: true });
    expect(await storedRepairs()).toMatchObject({ 'claude.ai': { status: 'override' } });

    tabEvent('onRemoved', CLAUDE_TAB.id, {});
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    await report(listener, OTHER_CLAUDE_TAB, 'toolbar');
    expect(await storedRepairs()).toEqual({});
  });

  it('keeps the placement of a tab whose page Chrome replaced, under its new id', async () => {
    const listener = await startServiceWorker();
    await report(listener, OTHER_CLAUDE_TAB, 'toolbar');
    await pickInClaudeTab(listener);

    // The tab's page is swapped: it still needs the pick under its new id, then closes under it
    vi.mocked(chrome.tabs.get).mockResolvedValue({ ...CLAUDE_TAB, id: 42 } as never);
    tabEvent('onReplaced', 42, CLAUDE_TAB.id);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    await report(listener, OTHER_CLAUDE_TAB, 'toolbar');
    expect(await storedRepairs()).toMatchObject({ 'claude.ai': { status: 'override' } });

    tabEvent('onRemoved', 42, {});
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(await storedRepairs()).toEqual({});
  });

  it('forgets a replaced tab whose placement could not be moved', async () => {
    const listener = await startServiceWorker();
    await report(listener, OTHER_CLAUDE_TAB, 'toolbar');
    await pickInClaudeTab(listener);

    vi.mocked(chrome.tabs.get).mockResolvedValue({ ...CLAUDE_TAB, id: 42 } as never);
    vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    tabEvent('onReplaced', 42, CLAUDE_TAB.id);
    await new Promise((resolve) => { setTimeout(resolve, 20); });

    // The old id is gone all the same: the pick no tab is known to need is dropped
    expect(await storedRepairs()).toEqual({});
  });

  it('forgets a replaced tab whose new page is not on the Platform', async () => {
    const listener = await startServiceWorker();
    await report(listener, OTHER_CLAUDE_TAB, 'toolbar');
    await pickInClaudeTab(listener);

    vi.mocked(chrome.tabs.get).mockResolvedValue({ ...CLAUDE_TAB, id: 42, url: 'https://example.com/' } as never);
    tabEvent('onReplaced', 42, CLAUDE_TAB.id);
    await new Promise((resolve) => { setTimeout(resolve, 20); });

    expect(await storedRepairs()).toEqual({});
  });

  describe('after an extension update, which empties session storage', () => {
    /** The update: session storage is emptied, the service worker starts again, Chrome tells it of the update */
    const update = async (tabs: chrome.tabs.Tab[]) => {
      await chrome.storage.session.clear();
      vi.mocked(chrome.tabs.query).mockResolvedValue(tabs as never);
      const listener = await startServiceWorker();
      const onInstalled = vi.mocked(getChromeMock().runtime.onInstalled.addListener).mock.calls.at(-1)?.[0];
      onInstalled?.({ reason: 'update', previousVersion: '1.0.0' } as chrome.runtime.InstalledDetails);
      await vi.waitFor(async () => {
        expect((await chrome.storage.session.get('iconPlacementTabs')).iconPlacementTabs).toBeDefined();
      });
      return listener;
    };

    it.each([
      ['re-injected later', { ...CLAUDE_TAB }],
      ['discarded by Memory Saver', { ...CLAUDE_TAB, discarded: true }]
    ])('keeps the pick when a tab reports its Toolbar while the tab on the override, %s, has not reported', async (_case, onOverride) => {
      const before = await startServiceWorker();
      await report(before, OTHER_CLAUDE_TAB, 'toolbar');
      await pickInClaudeTab(before);

      const listener = await update([OTHER_CLAUDE_TAB, onOverride as chrome.tabs.Tab]);
      await report(listener, OTHER_CLAUDE_TAB, 'toolbar');
      expect(await storedRepairs()).toMatchObject({ 'claude.ai': { status: 'override' } });

      // Every tab reported again, none off the Toolbar: the pick is dropped as before
      await report(listener, CLAUDE_TAB, 'toolbar');
      expect(await storedRepairs()).toEqual({});
    });

    it('counts the open tabs before it re-injects any, so no new content script reports first', async () => {
      const before = await startServiceWorker();
      await report(before, OTHER_CLAUDE_TAB, 'toolbar');
      await pickInClaudeTab(before);
      // What the service worker knew of the tabs when it started re-injecting each one
      const knownAtInjection: unknown[] = [];
      vi.mocked(chrome.tabs.get).mockImplementation((async (tabId: number) => {
        knownAtInjection.push((await chrome.storage.session.get('iconPlacementTabs')).iconPlacementTabs);
        return tabId === CLAUDE_TAB.id ? CLAUDE_TAB : OTHER_CLAUDE_TAB;
      }) as never);

      await update([OTHER_CLAUDE_TAB, CLAUDE_TAB]);
      await vi.waitFor(() => { expect(knownAtInjection.length).toBeGreaterThan(0); });

      expect(knownAtInjection[0]).toEqual({ 'claude.ai': { [String(OTHER_CLAUDE_TAB.id)]: 'waiting', [String(CLAUDE_TAB.id)]: 'waiting' } });
    });

    it('counts no tab of a Platform the user turned off: no content script of it reports again', async () => {
      const before = await startServiceWorker();
      await report(before, OTHER_CLAUDE_TAB, 'toolbar');
      await pickInClaudeTab(before);
      await chrome.storage.local.set({ promptLibrarySettings: { platformChoices: { 'claude.ai': false }, customSites: [] } });
      await chrome.storage.session.clear();
      vi.mocked(chrome.tabs.query).mockResolvedValue([OTHER_CLAUDE_TAB, CLAUDE_TAB] as never);
      await startServiceWorker();
      const onInstalled = vi.mocked(getChromeMock().runtime.onInstalled.addListener).mock.calls.at(-1)?.[0];

      onInstalled?.({ reason: 'update', previousVersion: '1.0.0' } as chrome.runtime.InstalledDetails);
      await vi.waitFor(() => { expect(chrome.tabs.query).toHaveBeenCalledWith({}); });
      await new Promise((resolve) => { setTimeout(resolve, 50); });

      expect((await chrome.storage.session.get('iconPlacementTabs')).iconPlacementTabs).toBeUndefined();
    });
  });

  it('forgets a tab that leaves the Platform, not one that moves within it', async () => {
    const listener = await startServiceWorker();
    await pickInClaudeTab(listener);

    tabEvent('onUpdated', CLAUDE_TAB.id, { url: 'https://claude.ai/chat/2' }, { ...CLAUDE_TAB, url: 'https://claude.ai/chat/2' });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    await report(listener, OTHER_CLAUDE_TAB, 'toolbar');
    expect(await storedRepairs()).toMatchObject({ 'claude.ai': { status: 'override' } });

    // A change with no new URL (a title, a load status) is not a move
    tabEvent('onUpdated', CLAUDE_TAB.id, { status: 'complete', title: 'Claude' }, CLAUDE_TAB);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    await report(listener, OTHER_CLAUDE_TAB, 'toolbar');
    expect(await storedRepairs()).toMatchObject({ 'claude.ai': { status: 'override' } });

    tabEvent('onUpdated', CLAUDE_TAB.id, { url: 'https://example.com/' }, { ...CLAUDE_TAB, url: 'https://example.com/' });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    await report(listener, OTHER_CLAUDE_TAB, 'toolbar');
    expect(await storedRepairs()).toEqual({});
  });
});

describe('background: the picker window of a Custom site, across a service worker restart', () => {
  const PAGE_TAB = { id: 11, windowId: 3, url: 'https://example.com/chat', active: true } as chrome.tabs.Tab;
  const PICKER_WINDOW_ID = 42;

  beforeEach(() => {
    const chromeMock = getChromeMock();
    Object.assign(chromeMock.tabs, {
      get: vi.fn().mockResolvedValue(PAGE_TAB),
      update: vi.fn().mockResolvedValue(PAGE_TAB)
    });
    Object.assign(chromeMock.windows, { create: vi.fn().mockResolvedValue({ id: PICKER_WINDOW_ID }) });
  });

  /** Opens the picker window, then the Element picker from it, as the Custom site flow does */
  const openPicker = async (): Promise<void> => {
    const listener = await startServiceWorker();
    expect(await send(listener, { type: 'OPEN_PICKER_WINDOW', data: { tabId: PAGE_TAB.id } })).toEqual({ success: true });
    expect(await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: PAGE_TAB.id } }, { tab: { id: 99, windowId: PICKER_WINDOW_ID } as chrome.tabs.Tab }))
      .toEqual({ success: true, tabId: PAGE_TAB.id });
  };

  it('brings the picker window back to the front after a pick made once the service worker restarted', async () => {
    await openPicker();
    vi.mocked(chrome.windows.update).mockClear();

    const afterRestart = await startServiceWorker();
    expect(await send(afterRestart, { type: 'ELEMENT_SELECTED', data: { selector: '#send' } }, { tab: PAGE_TAB })).toEqual({ success: true });

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ELEMENT_PICKER_RESULT' }));
    expect(chrome.windows.update).toHaveBeenCalledWith(PICKER_WINDOW_ID, { focused: true });
  });

  it('stops the picker on the page when the picker window closes after a service worker restart', async () => {
    await openPicker();

    await startServiceWorker();
    const onWindowRemoved = vi.mocked(getChromeMock().windows.onRemoved.addListener).mock.calls.at(-1)?.[0];
    onWindowRemoved?.(PICKER_WINDOW_ID);

    await vi.waitFor(async () => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(PAGE_TAB.id, { type: 'DEACTIVATE_ELEMENT_PICKER', source: 'background', attempt: expect.any(String) });
      expect(await chrome.storage.session.get(null)).toEqual({});
    });
  });

  it('stops a picker whose window closes while it activates on the page', async () => {
    const listener = await startServiceWorker();
    expect(await send(listener, { type: 'OPEN_PICKER_WINDOW', data: { tabId: PAGE_TAB.id } })).toEqual({ success: true });
    const onWindowRemoved = vi.mocked(getChromeMock().windows.onRemoved.addListener).mock.calls.at(-1)?.[0];
    const messages: string[] = [];
    let answerActivation: () => void = () => undefined;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation((_tabId: number, message: unknown) => {
      const type = (message as { type?: string }).type ?? '';
      messages.push(type);
      return type === 'ACTIVATE_ELEMENT_PICKER'
        ? new Promise((resolve) => { answerActivation = () => { resolve(undefined); }; })
        : Promise.resolve(undefined);
    });

    const started = send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: PAGE_TAB.id } }, { tab: { id: 99, windowId: PICKER_WINDOW_ID } as chrome.tabs.Tab });
    await vi.waitFor(() => { expect(messages).toContain('ACTIVATE_ELEMENT_PICKER'); });
    // The user closes the picker window before the page answers the activation; its stop is handled first
    onWindowRemoved?.(PICKER_WINDOW_ID);
    await vi.waitFor(async () => {
      expect(await chrome.storage.session.get('pickerWindow')).toEqual({});
    });
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    answerActivation();

    expect(await started).toEqual({ success: false, error: 'The element picker was stopped' });
    expect(messages.at(-1)).toBe('DEACTIVATE_ELEMENT_PICKER');
    expect(await chrome.storage.session.get(null)).toEqual({});
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: '#send' } }, { tab: PAGE_TAB }))
      .toEqual({ success: false, error: 'No active picker session' });
  });

  it('leaves a start in flight alone when a window other than the picker window closes', async () => {
    const listener = await startServiceWorker();
    expect(await send(listener, { type: 'OPEN_PICKER_WINDOW', data: { tabId: PAGE_TAB.id } })).toEqual({ success: true });
    const onWindowRemoved = vi.mocked(getChromeMock().windows.onRemoved.addListener).mock.calls.at(-1)?.[0];
    let answerActivation: () => void = () => undefined;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation((_tabId: number, message: unknown) =>
      (message as { type?: string }).type === 'ACTIVATE_ELEMENT_PICKER'
        ? new Promise((resolve) => { answerActivation = () => { resolve(undefined); }; })
        : Promise.resolve(undefined));

    const started = send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: PAGE_TAB.id } }, { tab: { id: 99, windowId: PICKER_WINDOW_ID } as chrome.tabs.Tab });
    await vi.waitFor(() => { expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(PAGE_TAB.id, expect.objectContaining({ type: 'ACTIVATE_ELEMENT_PICKER' })); });
    // Another browser window closes while the page activates the picker; its closing is handled first
    onWindowRemoved?.(PICKER_WINDOW_ID + 1);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    answerActivation();

    expect(await started).toEqual({ success: true, tabId: PAGE_TAB.id });
    expect((await chrome.storage.session.get('pickerWindow')).pickerWindow).toEqual({ windowId: PICKER_WINDOW_ID, originalTabId: PAGE_TAB.id });
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: '#send' } }, { tab: PAGE_TAB })).toEqual({ success: true });
  });

  it('does not write back the picker window when it closes while a pick brings it to the front', async () => {
    await openPicker();
    const listener = await startServiceWorker();
    const onWindowRemoved = vi.mocked(getChromeMock().windows.onRemoved.addListener).mock.calls.at(-1)?.[0];
    vi.mocked(chrome.windows.update).mockImplementationOnce(async () => {
      // The user closes the picker window as it comes to the front, and its closing is handled first
      onWindowRemoved?.(PICKER_WINDOW_ID);
      await vi.waitFor(async () => {
        expect(await chrome.storage.session.get('pickerWindow')).toEqual({});
      });
      return { id: PICKER_WINDOW_ID } as chrome.windows.Window;
    });

    await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: '#send' } }, { tab: PAGE_TAB });

    await vi.waitFor(async () => {
      expect(await chrome.storage.session.get(null)).toEqual({});
    });
  });

  it('keeps a picker window opened since when an older one closes', async () => {
    await openPicker();
    const listener = await startServiceWorker();
    const onWindowRemoved = vi.mocked(getChromeMock().windows.onRemoved.addListener).mock.calls.at(-1)?.[0];
    vi.mocked(chrome.windows.create).mockResolvedValue({ id: 43 } as never);

    // A new picker window opens as the old one closes
    const reopened = send(listener, { type: 'OPEN_PICKER_WINDOW', data: { tabId: PAGE_TAB.id } });
    onWindowRemoved?.(PICKER_WINDOW_ID);
    await reopened;
    await new Promise((resolve) => { setTimeout(resolve, 20); });

    expect((await chrome.storage.session.get('pickerWindow')).pickerWindow).toEqual({ windowId: 43, originalTabId: PAGE_TAB.id });
  });

  it('keeps a picker window opened for another tab while a pick tries to bring a closed one to the front', async () => {
    await openPicker();
    const listener = await startServiceWorker();
    vi.mocked(chrome.windows.create).mockResolvedValue({ id: 43 } as never);
    vi.mocked(chrome.windows.update).mockImplementationOnce(async () => {
      // Window 42 is gone; the user opened the picker again, for tab 12
      await send(listener, { type: 'OPEN_PICKER_WINDOW', data: { tabId: 12 } });
      throw new Error('No window with id: 42');
    });

    await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: '#send' } }, { tab: PAGE_TAB });

    expect((await chrome.storage.session.get('pickerWindow')).pickerWindow).toEqual({ windowId: 43, originalTabId: 12 });
  });
});

describe('background: a picker that could not be activated leaves no session', () => {
  beforeEach(() => {
    Object.assign(getChromeMock().tabs, {
      get: vi.fn().mockResolvedValue(CLAUDE_TAB),
      update: vi.fn().mockResolvedValue(CLAUDE_TAB)
    });
  });

  it.each([
    ['the content script does not answer the activation', () => {
      vi.mocked(chrome.tabs.sendMessage).mockRejectedValue(new Error('Could not establish connection'));
    }],
    ['the content script cannot be injected', () => {
      vi.mocked(chrome.scripting.executeScript).mockRejectedValue(new Error('Cannot access contents of the page'));
    }]
  ])('stores no session when %s', async (_case, fail) => {
    const listener = await startServiceWorker();
    fail();

    const response = await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });

    expect(response).toMatchObject({ success: false });
    await vi.waitFor(async () => {
      expect(await chrome.storage.session.get(null)).toEqual({});
    });
  });

  describe('while the content script just injected does not listen yet', () => {
    const NO_LISTENER = 'Could not establish connection. Receiving end does not exist.';
    /** The tab has no content script: the start injects it */
    const notInjected = () => {
      vi.mocked(chrome.permissions.contains).mockResolvedValue(true as never);
      vi.mocked(chrome.tabs.get).mockResolvedValue({ ...CLAUDE_TAB, status: 'complete' } as never);
      vi.mocked(chrome.scripting.executeScript).mockImplementation((async (injection: { func?: unknown }) =>
        (injection.func ? [{ result: false }] : [{ result: undefined }])) as never);
    };
    const activations = () => vi.mocked(chrome.tabs.sendMessage).mock.calls
      .filter(([, message]) => (message as { type: string }).type === 'ACTIVATE_ELEMENT_PICKER');

    it('activates the picker once it listens, a moment later', async () => {
      const listener = await startServiceWorker();
      notInjected();
      let tries = 0;
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(async (_tabId: number, message: unknown) => {
        if ((message as { type: string }).type === 'ACTIVATE_ELEMENT_PICKER' && ++tries < 3) {
          throw new Error(NO_LISTENER);
        }
        return undefined;
      });

      const response = await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });

      expect(response).toMatchObject({ success: true });
      expect(tries).toBe(3);
    });

    it('fails at once in a tab just injected that answers another error than not listening', async () => {
      const listener = await startServiceWorker();
      notInjected();
      vi.mocked(chrome.tabs.sendMessage).mockRejectedValue(new Error('The page is gone'));

      const response = await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });

      expect(response).toMatchObject({ success: false });
      expect(activations()).toHaveLength(1);
    });

    it('fails at once in a tab whose content script was already there, which then does not listen at all', async () => {
      const listener = await startServiceWorker();
      vi.mocked(chrome.tabs.sendMessage).mockRejectedValue(new Error(NO_LISTENER));

      const response = await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });

      expect(response).toMatchObject({ success: false });
      expect(activations()).toHaveLength(1);
    });

    /**
     * The retries run on fake timers: each step lands inside a known retry window, whatever the
     * load of the machine. The first activation is sent within RETRY_WINDOW, the next one 100 ms on
     */
    const RETRY_WINDOW = 50;
    const onFakeTimers = async (steps: () => Promise<void>) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
      try {
        await steps();
      } finally {
        vi.useRealTimers();
      }
    };
    const neverListening = () => {
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(async (_tabId: number, message: unknown) => {
        if ((message as { type: string }).type === 'ACTIVATE_ELEMENT_PICKER') {
          throw new Error(NO_LISTENER);
        }
        return undefined;
      });
    };
    const answered = (pending: Promise<unknown>) => {
      const result: { response?: unknown } = {};
      void pending.then((response) => { result.response = response; });
      return result;
    };

    it('sends no activation again once the start is stopped', async () => {
      const listener = await startServiceWorker();
      notInjected();
      neverListening();
      await onFakeTimers(async () => {
        const started = answered(send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } }));
        await vi.advanceTimersByTimeAsync(RETRY_WINDOW);
        expect(activations()).toHaveLength(1);

        await send(listener, { type: 'STOP_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id } });
        await vi.advanceTimersByTimeAsync(300);

        expect(started.response).toMatchObject({ success: false });
        expect(activations()).toHaveLength(1);
      });
    });

    it('sends no activation again once the tab is closed', async () => {
      const listener = await startServiceWorker();
      notInjected();
      neverListening();
      await onFakeTimers(async () => {
        const started = answered(send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } }));
        await vi.advanceTimersByTimeAsync(RETRY_WINDOW);
        expect(activations()).toHaveLength(1);

        vi.mocked(chrome.tabs.get).mockRejectedValue(new Error(`No tab with id: ${String(CLAUDE_TAB.id)}.`));
        await vi.advanceTimersByTimeAsync(300);

        expect(started.response).toEqual({ success: false, error: 'The tab was closed' });
        expect(activations()).toHaveLength(1);
      });
    });

    it('sends no activation again once the start is stopped while it checks the tab is open', async () => {
      const listener = await startServiceWorker();
      notInjected();
      neverListening();
      await onFakeTimers(async () => {
        const started = answered(send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } }));
        await vi.advanceTimersByTimeAsync(RETRY_WINDOW);
        expect(activations()).toHaveLength(1);

        // The stop lands while the start asks whether the tab is still open
        vi.mocked(chrome.tabs.get).mockImplementation((async () => {
          await send(listener, { type: 'STOP_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id } });
          return { ...CLAUDE_TAB, status: 'complete' };
        }) as never);
        await vi.advanceTimersByTimeAsync(300);

        expect(started.response).toMatchObject({ success: false });
        expect(activations()).toHaveLength(1);
      });
    });

    it('gives up once it has not listened for five seconds', async () => {
      const listener = await startServiceWorker();
      notInjected();
      neverListening();
      await onFakeTimers(async () => {
        const started = answered(send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } }));
        await vi.advanceTimersByTimeAsync(4_800);
        expect(started.response).toBeUndefined();
        await vi.advanceTimersByTimeAsync(400);
        expect(started.response).toMatchObject({ success: false });
        const sent = activations().length;

        await vi.advanceTimersByTimeAsync(1_000);
        expect(activations()).toHaveLength(sent);
      });
    });

    it('stores the session of the older start when its activation, sent again, reaches the page after a newer start\'s', async () => {
      const listener = await startServiceWorker();
      notInjected();
      let listening = false;
      let held: string | undefined;
      vi.mocked(chrome.tabs.sendMessage).mockImplementation(async (_tabId: number, message: unknown) => {
        const sent = message as { type: string; attempt?: string };
        if (!listening) {
          throw new Error(NO_LISTENER);
        }
        if (sent.type === 'ACTIVATE_ELEMENT_PICKER') {
          held = sent.attempt;
        }
        return undefined;
      });
      await onFakeTimers(async () => {
        const older = answered(send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } }));
        await vi.advanceTimersByTimeAsync(RETRY_WINDOW);
        expect(activations()).toHaveLength(1);
        const [[, firstActivation]] = activations();
        const olderAttempt = (firstActivation as { attempt: string }).attempt;

        // The newer start activates, and is answered, before the older one sends again
        listening = true;
        const newer = answered(send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } }));
        await vi.advanceTimersByTimeAsync(RETRY_WINDOW / 2);
        expect(newer.response).toMatchObject({ success: true });
        expect(older.response).toBeUndefined();

        await vi.advanceTimersByTimeAsync(300);
        expect(older.response).toMatchObject({ success: true });

        // The older start's activation reached the page last: the session stored names it
        expect(held).toBe(olderAttempt);
        const [session] = Object.values(await chrome.storage.session.get(null)) as Array<{ attempt: string }>;
        expect(session?.attempt).toBe(olderAttempt);
      });
    });
  });

  it('deactivates the picker it activated when its session cannot be stored', async () => {
    const listener = await startServiceWorker();
    const messages: string[] = [];
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(async (_tabId: number, message: unknown) => {
      messages.push((message as { type?: string }).type ?? '');
      return undefined;
    });
    vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error('Session storage quota exceeded'));

    const response = await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });

    expect(response).toEqual({ success: false, error: 'Session storage quota exceeded' });
    expect(messages.filter((type) => type.endsWith('_ELEMENT_PICKER'))).toEqual(['ACTIVATE_ELEMENT_PICKER', 'DEACTIVATE_ELEMENT_PICKER']);
    // It ends its own activation, not one a start since made in the same tab
    const [activation, deactivation] = pickerMessages();
    expect(deactivation?.attempt).toBe(activation?.attempt);
    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  it('ends only its own activation when stopped, so a start made after the stop in the same tab keeps its picker', async () => {
    const listener = await startServiceWorker();
    const answer = holdActivations();

    const stoppedStart = startOn(listener);
    await vi.waitFor(() => { expect(pickerMessages()).toHaveLength(1); });
    expect(await send(listener, { type: 'STOP_ELEMENT_PICKER' })).toEqual({ success: true });
    const laterStart = startOn(listener);
    await answer(0, true);
    await answer(1, true);

    expect(await stoppedStart).toEqual({ success: false, error: 'The element picker was stopped' });
    expect(await laterStart).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    const [stoppedActivation, laterActivation, deactivation] = pickerMessages();
    expect(deactivation).toMatchObject({ type: 'DEACTIVATE_ELEMENT_PICKER', attempt: stoppedActivation?.attempt });
    expect(deactivation?.attempt).not.toBe(laterActivation?.attempt);
    const stored = (await chrome.storage.session.get(`pickerSession:${CLAUDE_TAB.id}`))[`pickerSession:${CLAUDE_TAB.id}`];
    expect(stored).toMatchObject({ attempt: laterActivation?.attempt });
  });

  it('stores no session for a start that activates while the stop reads the sessions', async () => {
    const listener = await startServiceWorker();
    const answer = holdActivations();
    // The stop's read of the sessions answers only once the start activated and asked to store its own
    let releaseRead: () => void = () => undefined;
    let reading = false;
    const realGet = vi.mocked(chrome.storage.session.get).getMockImplementation() as (keys?: unknown) => Promise<Record<string, unknown>>;
    vi.mocked(chrome.storage.session.get).mockImplementation(((keys?: unknown) => {
      const result = realGet(keys);
      if (reading || keys !== null) {
        return result;
      }
      reading = true;
      return new Promise((resolve) => { releaseRead = () => { resolve(result); }; });
    }) as never);

    const started = startOn(listener);
    await vi.waitFor(() => { expect(pickerMessages()).toHaveLength(1); });
    const stopped = send(listener, { type: 'STOP_ELEMENT_PICKER' });
    await vi.waitFor(() => { expect(reading).toBe(true); });
    await answer(0, true);
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    releaseRead();

    expect(await stopped).toEqual({ success: true });
    expect(await started).toEqual({ success: false, error: 'The element picker was stopped' });
    expect(pickerMessages().map(({ type }) => type)).toEqual(['ACTIVATE_ELEMENT_PICKER', 'DEACTIVATE_ELEMENT_PICKER']);
    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  it('stores the session of the activation the page holds when the answers come back out of order', async () => {
    const listener = await startServiceWorker();
    const answer = holdActivations();

    const earlier = startOn(listener);
    const later = startOn(listener);
    // The page received both, in send order, so it holds the later one; its answer comes back first
    await answer(1, true);
    await answer(0, true);

    expect(await later).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    expect(await earlier).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    const [, laterActivation] = pickerMessages();
    const key = `pickerSession:${CLAUDE_TAB.id}`;
    expect((await chrome.storage.session.get(key))[key]).toMatchObject({ attempt: laterActivation?.attempt });

    // So a stop ends the picker the page holds
    expect(await send(listener, { type: 'STOP_ELEMENT_PICKER' })).toEqual({ success: true });
    expect(pickerMessages().at(-1)).toMatchObject({ type: 'DEACTIVATE_ELEMENT_PICKER', attempt: laterActivation?.attempt });
  });

  it('sends no activation for a start stopped before it activates', async () => {
    const listener = await startServiceWorker();
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue(undefined);
    // The content script is being injected when the stop comes
    let finishInjection: () => void = () => undefined;
    vi.mocked(chrome.scripting.executeScript).mockImplementationOnce(() =>
      new Promise((resolve) => { finishInjection = () => { resolve([{ result: true }] as never); }; }));

    const started = startOn(listener);
    await vi.waitFor(() => { expect(chrome.scripting.executeScript).toHaveBeenCalled(); });
    expect(await send(listener, { type: 'STOP_ELEMENT_PICKER' })).toEqual({ success: true });
    finishInjection();

    expect(await started).toEqual({ success: false, error: 'The element picker was stopped' });
    expect(pickerMessages()).toEqual([]);
    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  it('forgets the older session whose picker it took over when its session cannot be stored', async () => {
    const listener = await startServiceWorker();
    expect(await startOn(listener)).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error('Session storage quota exceeded'));

    // The page takes the later activation over the older picker, then the later start ends it
    expect(await startOn(listener)).toEqual({ success: false, error: 'Session storage quota exceeded' });

    expect(pickerMessages().at(-1)).toMatchObject({ type: 'DEACTIVATE_ELEMENT_PICKER', attempt: pickerMessages().at(-2)?.attempt });
    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  it('counts a start whose session write failed among those a cancel stops', async () => {
    const listener = await startServiceWorker();
    expect(await startOn(listener)).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    const key = `pickerSession:${CLAUDE_TAB.id}`;
    const older = (await chrome.storage.session.get(key))[key];
    // The later start's write fails, and its removal of the older session too; its deactivation waits
    vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error('Session storage quota exceeded'));
    vi.mocked(chrome.storage.session.remove).mockRejectedValueOnce(new Error('Session storage quota exceeded'));
    let releaseDeactivate: () => void = () => undefined;
    let deactivating = false;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation((_tabId: number, message: unknown) => {
      if ((message as { type?: string }).type !== 'DEACTIVATE_ELEMENT_PICKER') {
        return Promise.resolve(undefined);
      }
      deactivating = true;
      return new Promise((resolve) => { releaseDeactivate = () => { resolve(undefined); }; });
    });

    const later = startOn(listener);
    await vi.waitFor(() => { expect(deactivating).toBe(true); });
    expect((await chrome.storage.session.get(key))[key]).toEqual(older);
    // The page cancels the later picker (Escape) while that start ends it
    const attempt = pickerMessages().filter(({ type }) => type === 'ACTIVATE_ELEMENT_PICKER').at(-1)?.attempt;
    expect(await send(listener, { type: 'PICKER_CANCELLED', attempt }, { tab: CLAUDE_TAB })).toEqual({ success: true });
    releaseDeactivate();

    expect(await later).toMatchObject({ success: false });
    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  /** The ACTIVATE and DEACTIVATE messages sent to the tab, in order */
  const pickerMessages = () => vi.mocked(chrome.tabs.sendMessage).mock.calls
    .map(([, message]) => message as { type?: string; attempt?: string })
    .filter((message) => message.type?.endsWith('_ELEMENT_PICKER'));

  /** The activation of the picker in the tab: answered when the test says, for each START in turn */
  const holdActivations = () => {
    const answers: Array<(ok: boolean) => void> = [];
    vi.mocked(chrome.tabs.sendMessage).mockImplementation((_tabId: number, message: unknown) => {
      if ((message as { type?: string }).type !== 'ACTIVATE_ELEMENT_PICKER') {
        return Promise.resolve(undefined);
      }
      return new Promise((resolve, reject) => {
        answers.push((ok) => { if (ok) { resolve(undefined); } else { reject(new Error('Could not establish connection')); } });
      });
    });
    return async (index: number, ok: boolean) => {
      await vi.waitFor(() => { expect(answers.length).toBeGreaterThan(index); });
      answers[index]?.(ok);
    };
  };
  const startOn = (listener: MessageListener) =>
    send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });

  it('keeps the session of a newer start when an older start on the same tab fails', async () => {
    const listener = await startServiceWorker();
    const answer = holdActivations();

    const older = startOn(listener);
    const newer = startOn(listener);
    await answer(0, false);
    await answer(1, true);

    expect(await older).toMatchObject({ success: false });
    expect(await newer).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB })).toEqual({ success: true });
  });

  it('keeps the session of an older start, whose picker is active, when a newer start on the same tab fails', async () => {
    const listener = await startServiceWorker();
    const answer = holdActivations();

    const older = startOn(listener);
    const newer = startOn(listener);
    await answer(0, true);
    await answer(1, false);

    expect(await older).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    expect(await newer).toMatchObject({ success: false });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB })).toEqual({ success: true });
    expect(await storedRepairs()).toEqual({ 'claude.ai': { override: { mode: 'custom', placement: 'before', selector: SEND_BUTTON } } });
  });

  it('leaves no session when two starts on one tab both fail', async () => {
    const listener = await startServiceWorker();
    const answer = holdActivations();

    const older = startOn(listener);
    const newer = startOn(listener);
    await answer(0, false);
    await answer(1, false);

    expect(await older).toMatchObject({ success: false });
    expect(await newer).toMatchObject({ success: false });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  // Guards the pick's take: its read and its removal are one step, so a start cannot land between them
  it('keeps the session of a start that lands while a pick takes its own (one step)', async () => {
    const listener = await startServiceWorker();
    await startOn(listener);
    let activations = 0;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(async (_tabId: number, message: unknown) => {
      if ((message as { type?: string }).type === 'ACTIVATE_ELEMENT_PICKER') {
        activations += 1;
      }
      return undefined;
    });
    // The pick's read of its session answers only once a new start is active and storing its own
    const sessionKey = `pickerSession:${CLAUDE_TAB.id}`;
    let releaseRead: () => void = () => undefined;
    let held = false;
    const realGet = vi.mocked(chrome.storage.session.get).getMockImplementation() as (keys?: unknown) => Promise<Record<string, unknown>>;
    vi.mocked(chrome.storage.session.get).mockImplementation(((keys?: unknown) => {
      const result = realGet(keys);
      if (held || keys !== sessionKey) {
        return result;
      }
      held = true;
      return new Promise((resolve) => { releaseRead = () => { resolve(result); }; });
    }) as never);

    const picked = send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB });
    await vi.waitFor(() => { expect(held).toBe(true); });
    const restarted = startOn(listener);
    await vi.waitFor(() => { expect(activations).toBe(1); });
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    releaseRead();

    expect(await picked).toEqual({ success: true });
    expect(await restarted).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB })).toEqual({ success: true });
  });

  it('keeps the session of a start that lands while the stop deactivates the pickers', async () => {
    const listener = await startServiceWorker();
    await startOn(listener);
    let releaseDeactivate: () => void = () => undefined;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation((_tabId: number, message: unknown) =>
      (message as { type?: string }).type === 'DEACTIVATE_ELEMENT_PICKER'
        ? new Promise((resolve) => { releaseDeactivate = () => { resolve(undefined); }; })
        : Promise.resolve(undefined));

    const stopped = send(listener, { type: 'STOP_ELEMENT_PICKER' });
    await vi.waitFor(() => { expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(CLAUDE_TAB.id, expect.objectContaining({ type: 'DEACTIVATE_ELEMENT_PICKER' })); });
    expect(await startOn(listener)).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    releaseDeactivate();

    expect(await stopped).toEqual({ success: true });
    // The stop ends the activation it saw, not the one of the start since
    const [firstActivation, deactivation, secondActivation] = pickerMessages();
    expect(deactivation).toMatchObject({ type: 'DEACTIVATE_ELEMENT_PICKER', attempt: firstActivation?.attempt });
    expect(secondActivation?.attempt).not.toBe(firstActivation?.attempt);
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB })).toEqual({ success: true });
  });

  // Guards the chain of session changes: the stop's read and its removal are one step
  it('keeps the session of a start that lands while the stop reads what to remove (one step)', async () => {
    const listener = await startServiceWorker();
    await startOn(listener);
    // The stop reads the sessions to remove; that read answers only once a new start was sent
    let releaseRead: () => void = () => undefined;
    let deactivating = false;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(async (_tabId: number, message: unknown) => {
      if ((message as { type?: string }).type === 'DEACTIVATE_ELEMENT_PICKER') {
        deactivating = true;
      }
      return undefined;
    });
    const realGet = vi.mocked(chrome.storage.session.get).getMockImplementation();
    vi.mocked(chrome.storage.session.get).mockImplementation(((keys?: unknown) => {
      const result = (realGet as (keys?: unknown) => Promise<Record<string, unknown>>)(keys);
      if (!deactivating || keys !== null) {
        return result;
      }
      deactivating = false;
      return new Promise((resolve) => { releaseRead = () => { resolve(result); }; });
    }) as never);

    const stopped = send(listener, { type: 'STOP_ELEMENT_PICKER' });
    await vi.waitFor(() => { expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(CLAUDE_TAB.id, expect.objectContaining({ type: 'DEACTIVATE_ELEMENT_PICKER' })); });
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    const restarted = startOn(listener);
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    releaseRead();

    expect(await stopped).toEqual({ success: true });
    expect(await restarted).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB })).toEqual({ success: true });
  });
});

describe('background: a pick cancelled in one tab', () => {
  const OTHER_TAB = { id: 8, windowId: 3, url: 'https://claude.ai/chat/1', active: false } as chrome.tabs.Tab;

  beforeEach(() => {
    Object.assign(getChromeMock().tabs, {
      get: vi.fn().mockResolvedValue(CLAUDE_TAB),
      update: vi.fn().mockResolvedValue(CLAUDE_TAB)
    });
  });

  it('ends only that tab\'s pick: a pick open in another tab goes on', async () => {
    Object.assign(getChromeMock().tabs, {
      get: vi.fn(async (tabId: number) => (tabId === OTHER_TAB.id ? OTHER_TAB : CLAUDE_TAB)),
      update: vi.fn().mockResolvedValue(CLAUDE_TAB)
    });
    const listener = await startServiceWorker();
    await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });
    await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: OTHER_TAB.id, repairHostname: 'claude.ai' } });
    vi.mocked(chrome.tabs.sendMessage).mockClear();

    // The other tab reloads: its picker sends PICKER_CANCELLED as its page unloads
    expect(await send(listener, { type: 'PICKER_CANCELLED' }, { tab: OTHER_TAB })).toEqual({ success: true });

    expect(Object.keys(await chrome.storage.session.get(null))).toEqual([`pickerSession:${CLAUDE_TAB.id}`]);
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalledWith(CLAUDE_TAB.id, expect.objectContaining({ type: 'DEACTIVATE_ELEMENT_PICKER' }));
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB })).toEqual({ success: true });
  });

  it('stops a start still activating in that tab, and only there', async () => {
    Object.assign(getChromeMock().tabs, {
      get: vi.fn(async (tabId: number) => (tabId === OTHER_TAB.id ? OTHER_TAB : CLAUDE_TAB)),
      update: vi.fn().mockResolvedValue(CLAUDE_TAB)
    });
    const listener = await startServiceWorker();
    await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });
    // A new start in each tab, its activation answered only when the test says
    const answers = new Map<number, () => void>();
    vi.mocked(chrome.tabs.sendMessage).mockImplementation((tabId: number, message: unknown) =>
      (message as { type?: string }).type === 'ACTIVATE_ELEMENT_PICKER'
        ? new Promise((resolve) => { answers.set(tabId, () => { resolve(undefined); }); })
        : Promise.resolve(undefined));
    const restarted = send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });
    const otherStart = send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: OTHER_TAB.id, repairHostname: 'claude.ai' } });
    await vi.waitFor(() => { expect(answers.size).toBe(2); });

    // The user presses Escape on the picker of the first tab before the new start activates there
    expect(await send(listener, { type: 'PICKER_CANCELLED' }, { tab: CLAUDE_TAB })).toEqual({ success: true });
    answers.get(CLAUDE_TAB.id as number)?.();
    answers.get(OTHER_TAB.id as number)?.();

    expect(await restarted).toEqual({ success: false, error: 'The element picker was stopped' });
    expect(await otherStart).toEqual({ success: true, tabId: OTHER_TAB.id });
    // It ends its own activation, by its attempt
    const restartActivation = vi.mocked(chrome.tabs.sendMessage).mock.calls
      .filter(([tabId, message]) => tabId === CLAUDE_TAB.id && (message as { type?: string }).type === 'ACTIVATE_ELEMENT_PICKER')
      .at(-1)?.[1] as { attempt?: string } | undefined;
    expect(restartActivation?.attempt).toEqual(expect.any(String));
    expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(CLAUDE_TAB.id, { type: 'DEACTIVATE_ELEMENT_PICKER', source: 'background', attempt: restartActivation?.attempt });
    expect(Object.keys(await chrome.storage.session.get(null))).toEqual([`pickerSession:${OTHER_TAB.id}`]);
  });

  it('keeps the session of a later start when the cancel of an earlier picker comes after it was stored', async () => {
    const listener = await startServiceWorker();
    await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });
    const activations = () => vi.mocked(chrome.tabs.sendMessage).mock.calls
      .map(([, message]) => message as { type?: string; attempt?: string })
      .filter((message) => message.type === 'ACTIVATE_ELEMENT_PICKER');
    const earlier = activations()[0]?.attempt;
    expect(await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } }))
      .toEqual({ success: true, tabId: CLAUDE_TAB.id });
    const later = activations()[1]?.attempt;
    vi.mocked(chrome.tabs.sendMessage).mockClear();

    // The page sent the cancel of the earlier picker (Escape) before the later activation reached it,
    // and the service worker handles it last
    expect(await send(listener, { type: 'PICKER_CANCELLED', attempt: earlier }, { tab: CLAUDE_TAB })).toEqual({ success: true });

    const key = `pickerSession:${CLAUDE_TAB.id}`;
    expect((await chrome.storage.session.get(key))[key]).toMatchObject({ attempt: later });
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB })).toEqual({ success: true });
  });

  it('forgets the session of the start whose picker the page cancelled', async () => {
    const listener = await startServiceWorker();
    await send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });
    const activation = vi.mocked(chrome.tabs.sendMessage).mock.calls
      .map(([, message]) => message as { type?: string; attempt?: string })
      .find((message) => message.type === 'ACTIVATE_ELEMENT_PICKER');

    expect(await send(listener, { type: 'PICKER_CANCELLED', attempt: activation?.attempt }, { tab: CLAUDE_TAB })).toEqual({ success: true });

    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  /** The ACTIVATE messages sent to the tab, each answered only when the test says */
  const holdTabActivations = () => {
    const held: Array<{ attempt?: string; answer: () => void }> = [];
    vi.mocked(chrome.tabs.sendMessage).mockImplementation((_tabId: number, message: unknown) => {
      const { type, attempt } = message as { type?: string; attempt?: string };
      return type === 'ACTIVATE_ELEMENT_PICKER'
        ? new Promise((resolve) => { held.push({ attempt, answer: () => { resolve(undefined); } }); })
        : Promise.resolve(undefined);
    });
    return held;
  };
  const startOnTab = (listener: MessageListener) =>
    send(listener, { type: 'START_ELEMENT_PICKER', data: { tabId: CLAUDE_TAB.id, repairHostname: 'claude.ai' } });

  it('forgets an earlier session when the page cancels the picker of a start still in flight', async () => {
    const listener = await startServiceWorker();
    expect(await startOnTab(listener)).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    const held = holdTabActivations();
    const later = startOnTab(listener);
    await vi.waitFor(() => { expect(held).toHaveLength(1); });

    // The page received the later activation, then the user pressed Escape: the cancel names the later start
    expect(await send(listener, { type: 'PICKER_CANCELLED', attempt: held[0]?.attempt }, { tab: CLAUDE_TAB })).toEqual({ success: true });
    held[0]?.answer();

    expect(await later).toEqual({ success: false, error: 'The element picker was stopped' });
    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  it('keeps the session of a start activated after the start whose picker the page cancelled', async () => {
    const listener = await startServiceWorker();
    // The first activation is answered only when the test says; the later ones at once
    let answerFirst: () => void = () => undefined;
    const activations: Array<string | undefined> = [];
    vi.mocked(chrome.tabs.sendMessage).mockImplementation((_tabId: number, message: unknown) => {
      const { type, attempt } = message as { type?: string; attempt?: string };
      if (type !== 'ACTIVATE_ELEMENT_PICKER') {
        return Promise.resolve(undefined);
      }
      activations.push(attempt);
      return activations.length === 1
        ? new Promise((resolve) => { answerFirst = () => { resolve(undefined); }; })
        : Promise.resolve(undefined);
    });
    const first = startOnTab(listener);
    await vi.waitFor(() => { expect(activations).toHaveLength(1); });
    // The page cancelled the first picker (Escape), then received the activation of a later start,
    // which the service worker stored before it handled the cancel
    expect(await startOnTab(listener)).toEqual({ success: true, tabId: CLAUDE_TAB.id });

    expect(await send(listener, { type: 'PICKER_CANCELLED', attempt: activations[0] }, { tab: CLAUDE_TAB })).toEqual({ success: true });
    answerFirst();

    expect(await first).toMatchObject({ success: false });
    const key = `pickerSession:${CLAUDE_TAB.id}`;
    expect((await chrome.storage.session.get(key))[key]).toMatchObject({ attempt: activations[1] });
  });

  it('forgets a session kept between two starts in flight when the cancel stops the later one', async () => {
    const listener = await startServiceWorker();
    // The first and third activations are answered only when the test says; the second at once
    const held = new Map<number, () => void>();
    const activations: Array<string | undefined> = [];
    vi.mocked(chrome.tabs.sendMessage).mockImplementation((_tabId: number, message: unknown) => {
      const { type, attempt } = message as { type?: string; attempt?: string };
      if (type !== 'ACTIVATE_ELEMENT_PICKER') {
        return Promise.resolve(undefined);
      }
      activations.push(attempt);
      const index = activations.length;
      return index === 2
        ? Promise.resolve(undefined)
        : new Promise((resolve) => { held.set(index, () => { resolve(undefined); }); });
    });
    const first = startOnTab(listener);
    await vi.waitFor(() => { expect(activations).toHaveLength(1); });
    expect(await startOnTab(listener)).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    const third = startOnTab(listener);
    await vi.waitFor(() => { expect(activations).toHaveLength(3); });

    // The page took the first activation, then Escape, then the second and third: it holds the third,
    // which the cancel stops; the second start's session has no picker left
    expect(await send(listener, { type: 'PICKER_CANCELLED', attempt: activations[0] }, { tab: CLAUDE_TAB })).toEqual({ success: true });
    held.get(1)?.();
    held.get(3)?.();

    expect(await first).toMatchObject({ success: false });
    expect(await third).toEqual({ success: false, error: 'The element picker was stopped' });
    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  it('forgets a session stored before the service worker restarted when the page cancels a start made after it', async () => {
    // Two starts before the restart: the session's activation is not the first one sent
    const beforeRestart = await startServiceWorker();
    expect(await startOnTab(beforeRestart)).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    expect(await startOnTab(beforeRestart)).toEqual({ success: true, tabId: CLAUDE_TAB.id });

    const afterRestart = await startServiceWorker();
    const held = holdTabActivations();
    const later = startOnTab(afterRestart);
    await vi.waitFor(() => { expect(held).toHaveLength(1); });
    expect(await send(afterRestart, { type: 'PICKER_CANCELLED', attempt: held[0]?.attempt }, { tab: CLAUDE_TAB })).toEqual({ success: true });
    held[0]?.answer();

    expect(await later).toEqual({ success: false, error: 'The element picker was stopped' });
    expect(await chrome.storage.session.get(null)).toEqual({});
  });

  it('keeps the session of a start already storing it when the cancel of an earlier picker comes', async () => {
    const listener = await startServiceWorker();
    await startOnTab(listener);
    const key = `pickerSession:${CLAUDE_TAB.id}`;
    const earlier = ((await chrome.storage.session.get(key))[key] as { attempt?: string }).attempt;
    // The next session write waits until the test says
    let releaseWrite: () => void = () => undefined;
    let writing = false;
    const realSet = vi.mocked(chrome.storage.session.set).getMockImplementation() as (items: Record<string, unknown>) => Promise<void>;
    vi.mocked(chrome.storage.session.set).mockImplementationOnce(((items: Record<string, unknown>) => {
      writing = true;
      return new Promise<void>((resolve) => { releaseWrite = () => { void realSet(items).then(resolve); }; });
    }) as never);
    vi.mocked(chrome.tabs.sendMessage).mockClear();

    // The page took the later activation after the Escape on the earlier picker; the later start is
    // storing its session when the cancel comes
    const later = startOnTab(listener);
    await vi.waitFor(() => { expect(writing).toBe(true); });
    const cancelled = send(listener, { type: 'PICKER_CANCELLED', attempt: earlier }, { tab: CLAUDE_TAB });
    releaseWrite();

    expect(await later).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    expect(await cancelled).toEqual({ success: true });
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalledWith(CLAUDE_TAB.id, expect.objectContaining({ type: 'DEACTIVATE_ELEMENT_PICKER' }));
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB })).toEqual({ success: true });
  });

  // Guards the cancel's step: its read and its removal are one step, so a start cannot store in between
  it('keeps the session of a start that stores while a cancel reads the session (one step)', async () => {
    const listener = await startServiceWorker();
    await startOnTab(listener);
    const key = `pickerSession:${CLAUDE_TAB.id}`;
    const earlier = ((await chrome.storage.session.get(key))[key] as { attempt?: string }).attempt;
    // The cancel's read of the session answers only once a new start asked to store its own
    let releaseRead: () => void = () => undefined;
    let held = false;
    const realGet = vi.mocked(chrome.storage.session.get).getMockImplementation() as (keys?: unknown) => Promise<Record<string, unknown>>;
    vi.mocked(chrome.storage.session.get).mockImplementation(((keys?: unknown) => {
      const result = realGet(keys);
      if (held || keys !== key) {
        return result;
      }
      held = true;
      return new Promise((resolve) => { releaseRead = () => { resolve(result); }; });
    }) as never);
    let activations = 0;
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(async (_tabId: number, message: unknown) => {
      if ((message as { type?: string }).type === 'ACTIVATE_ELEMENT_PICKER') {
        activations += 1;
      }
      return undefined;
    });

    const cancelled = send(listener, { type: 'PICKER_CANCELLED', attempt: earlier }, { tab: CLAUDE_TAB });
    await vi.waitFor(() => { expect(held).toBe(true); });
    const restarted = startOnTab(listener);
    await vi.waitFor(() => { expect(activations).toBe(1); });
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    releaseRead();

    expect(await cancelled).toEqual({ success: true });
    expect(await restarted).toEqual({ success: true, tabId: CLAUDE_TAB.id });
    expect(await send(listener, { type: 'ELEMENT_SELECTED', data: { selector: SEND_BUTTON } }, { tab: CLAUDE_TAB })).toEqual({ success: true });
  });

  it('stops a start that has not activated yet in that tab: it sends no activation', async () => {
    const listener = await startServiceWorker();
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue(undefined);
    // The content script is being injected when the user presses Escape on the picker of the tab
    let finishInjection: () => void = () => undefined;
    vi.mocked(chrome.scripting.executeScript).mockImplementationOnce(() =>
      new Promise((resolve) => { finishInjection = () => { resolve([{ result: true }] as never); }; }));

    const started = startOnTab(listener);
    await vi.waitFor(() => { expect(chrome.scripting.executeScript).toHaveBeenCalled(); });
    expect(await send(listener, { type: 'PICKER_CANCELLED', attempt: 'an-earlier-start' }, { tab: CLAUDE_TAB })).toEqual({ success: true });
    finishInjection();

    expect(await started).toEqual({ success: false, error: 'The element picker was stopped' });
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalledWith(CLAUDE_TAB.id, expect.objectContaining({ type: 'ACTIVATE_ELEMENT_PICKER' }));
    expect(await chrome.storage.session.get(null)).toEqual({});
  });
});

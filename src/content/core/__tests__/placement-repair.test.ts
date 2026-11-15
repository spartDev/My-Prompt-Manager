/**
 * The placement reports a content script sends the service worker (src/content/core/placement-repair.ts):
 * when they differ from the last one this tab delivered, again after a report the service worker did
 * not save (unless it refused it for good), and again when the service worker may have forgotten it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ICON_PLACEMENT_REPAIRS_KEY } from '../../../services/iconPlacementRepairs';
import { PLACEMENT_REPORT_MESSAGE, PlacementRepair } from '../placement-repair';

vi.mock('../../utils/logger', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

const PICK = { mode: 'custom', placement: 'before', selector: '#send' };
const flush = () => new Promise((done) => setTimeout(done, 0));

describe('PlacementRepair.report', () => {
  let repair: PlacementRepair;
  const sent = () => vi.mocked(chrome.runtime.sendMessage).mock.calls
    .map(([message]) => message as unknown as { type: string; data: { placement: string } })
    .filter((message) => message.type === PLACEMENT_REPORT_MESSAGE)
    .map((message) => message.data.placement);

  beforeEach(async () => {
    await chrome.storage.local.clear();
    vi.mocked(chrome.runtime.sendMessage).mockReset();
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: true } as never);
    repair = new PlacementRepair('claude.ai', vi.fn());
  });

  afterEach(() => {
    // Its pageshow listener would answer the next test's events
    repair.dispose();
  });

  it('sends nothing when storage already says the icon is in the toolbar', async () => {
    await repair.load();

    repair.report('toolbar');

    expect(sent()).toEqual([]);
  });

  /** Storage changes as the service worker writes them, with the event the content script follows */
  const storageChange = (repairs: unknown) => {
    for (const [listener] of vi.mocked(chrome.storage.onChanged.addListener).mock.calls) {
      (listener as (changes: Record<string, chrome.storage.StorageChange>, area: string) => void)(
        { [ICON_PLACEMENT_REPAIRS_KEY]: { newValue: repairs } },
        'local'
      );
    }
  };

  it('sends the toolbar report that drops an override stored with no status, as after a late pick', async () => {
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { override: PICK } } });
    await repair.load();
    expect(repair.positioning).toEqual(PICK);

    repair.report('toolbar');
    await flush();
    repair.report('toolbar');

    expect(sent()).toEqual(['toolbar']);
  });

  it('keeps the pick when its icon is in the Toolbar, for when the chain fails in this tab', async () => {
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'override', override: PICK } } });
    await repair.load();

    repair.report('toolbar');

    // Another tab still needs it, so storage keeps it and sends no change: this tab keeps it too
    expect(repair.positioning).toEqual(PICK);
  });

  it('sends its own placement though storage already has that status from another tab', async () => {
    vi.mocked(chrome.storage.onChanged.addListener).mockClear();
    await repair.load();

    // Another tab of the Platform reports the overlay, then the user picks there
    storageChange({ 'claude.ai': { status: 'overlay' } });
    repair.report('overlay');
    await flush();
    storageChange({ 'claude.ai': { status: 'override', override: PICK } });
    repair.report('override');

    // The service worker counts this tab only from its own reports
    expect(sent()).toEqual(['overlay', 'override']);
  });

  it('sends its Toolbar again when a pick is stored with no status, so the service worker drops it', async () => {
    vi.mocked(chrome.storage.onChanged.addListener).mockClear();
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'overlay' } } });
    await repair.load();
    repair.report('toolbar');
    await flush();

    // The overlay tab moved to the Toolbar and the pick came after: an override with no status
    storageChange({ 'claude.ai': { override: PICK } });
    repair.report('toolbar');

    expect(sent()).toEqual(['toolbar', 'toolbar']);
  });

  it('sends its placement again once storage dropped the repair it was counted for', async () => {
    vi.mocked(chrome.storage.onChanged.addListener).mockClear();
    await repair.load();
    repair.report('overlay');
    await flush();

    // Clear All Data
    storageChange({});
    repair.report('overlay');

    expect(sent()).toEqual(['overlay', 'overlay']);
  });

  /** happy-dom's PageTransitionEvent drops `persisted`: the event is built with it */
  const pageShow = (persisted: boolean) => window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));

  it('sends its placement again when the page comes back from the back/forward cache', async () => {
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'override', override: PICK } } });
    await repair.load();
    repair.report('toolbar');
    await flush();

    pageShow(false);
    await flush();
    expect(sent()).toEqual(['toolbar']);

    // The service worker forgot the tab when it left the Platform; its icon, in the Toolbar, is not placed again
    pageShow(true);
    await flush();

    expect(sent()).toEqual(['toolbar', 'toolbar']);
  });

  it('reads the repair again when the page comes back from the back/forward cache', async () => {
    const onOverrideChange = vi.fn();
    repair = new PlacementRepair('claude.ai', onOverrideChange);
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'override', override: PICK } } });
    await repair.load();
    repair.report('override');
    await flush();

    // While the page was frozen, the pick was dropped, with no storage event to the page
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({} as never);
    pageShow(true);
    await flush();

    expect(repair.positioning).toBeNull();
    expect(onOverrideChange).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual(['override']);
  });

  it('counts a Toolbar from a back/forward cache restore once a repair was stored meanwhile', async () => {
    await repair.load();
    repair.report('toolbar');

    // Stored while the page was frozen, with no storage event to the page
    vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'override', override: PICK } } } as never);
    pageShow(true);
    await flush();

    expect(sent()).toEqual(['toolbar']);
  });

  it('follows a repair stored by another tab while it reads storage', async () => {
    vi.mocked(chrome.storage.onChanged.addListener).mockClear();
    let answer: (value: unknown) => void = () => undefined;
    vi.mocked(chrome.storage.local.get).mockImplementationOnce((() => new Promise((resolve) => { answer = resolve; })) as never);
    const loading = repair.load();

    // Another tab reports the overlay before the read answers, with what storage held before
    storageChange({ 'claude.ai': { status: 'overlay' } });
    answer({});
    await loading;
    repair.report('toolbar');

    expect(sent()).toEqual(['toolbar']);
  });

  it('sends its placement again when the prerendered page it is in becomes the tab\'s page', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: false, error: 'Not a placement report of a built-in platform', permanent: true } as never);
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'override', override: PICK } } });
    await repair.load();
    repair.report('override');
    await flush();

    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: true } as never);
    document.dispatchEvent(new Event('prerenderingchange'));
    await flush();

    expect(sent()).toEqual(['override', 'override']);
  });

  it('sends the first placement again after the repair is loaded again', async () => {
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'override', override: PICK } } });
    await repair.load();
    repair.report('override');
    await flush();

    await repair.load();
    repair.report('override');

    expect(sent()).toEqual(['override', 'override']);
  });

  it('sends its Toolbar, placed before the Platform had a repair, once the repair is stored', async () => {
    vi.mocked(chrome.storage.onChanged.addListener).mockClear();
    await repair.load();
    repair.report('toolbar');
    expect(sent()).toEqual([]);

    // Another tab of the Platform reports the overlay: this tab is counted with its Toolbar, once
    storageChange({ 'claude.ai': { status: 'overlay' } });
    await flush();
    storageChange({ 'claude.ai': { status: 'override', override: PICK } });

    expect(sent()).toEqual(['toolbar']);
  });

  it('sends the first placement of the page when the Platform has a repair, though storage says the same', async () => {
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'override', override: PICK } } });
    await repair.load();

    repair.report('override');
    await flush();
    repair.report('override');

    // Once: the service worker now knows this tab's placement
    expect(sent()).toEqual(['override']);
  });

  it('sends a report again when the service worker did not save the one before', async () => {
    await repair.load();
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({ success: false, error: 'Storage refused' } as never);

    repair.report('overlay');
    await flush();
    repair.report('overlay');
    await flush();
    repair.report('overlay');

    expect(sent()).toEqual(['overlay', 'overlay']);
  });

  it('does not send a report again that the service worker refuses for good', async () => {
    await repair.load();
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ success: false, error: 'Not a placement report of a built-in platform', permanent: true } as never);

    repair.report('overlay');
    await flush();
    repair.report('overlay');

    expect(sent()).toEqual(['overlay']);
  });

  it('sends a report again when the service worker did not answer', async () => {
    await repair.load();
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValueOnce(new Error('Receiving end does not exist'));

    repair.report('overlay');
    await flush();
    repair.report('overlay');

    expect(sent()).toEqual(['overlay', 'overlay']);
  });
});

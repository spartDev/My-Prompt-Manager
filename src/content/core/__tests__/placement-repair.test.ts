/**
 * The placement reports a content script sends the service worker (src/content/core/placement-repair.ts):
 * only when storage says otherwise, but always when an override must be dropped, and again after a
 * report the service worker did not save, unless it refused it for good.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('sends nothing when storage already says the icon is in the toolbar', async () => {
    await repair.load();

    repair.report('toolbar');

    expect(sent()).toEqual([]);
  });

  it('sends the toolbar report that drops an override stored with no status, as after a late pick', async () => {
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { override: PICK } } });
    await repair.load();
    expect(repair.positioning).toEqual(PICK);

    repair.report('toolbar');
    await flush();
    repair.report('toolbar');

    expect(repair.positioning).toBeNull();
    expect(sent()).toEqual(['toolbar']);
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

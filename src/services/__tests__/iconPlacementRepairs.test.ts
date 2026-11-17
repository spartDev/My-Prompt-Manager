import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CustomSitePositioning, ElementFingerprint } from '../../types';
import {
  applyIconPlacementRepairChange,
  changeIconPlacementRepairs,
  forgetIconPlacementTab,
  ICON_PLACEMENT_REPAIRS_KEY,
  ICON_PLACEMENT_TABS_KEY,
  type IconPlacementRepairs,
  moveIconPlacementTab,
  overrideFromPick,
  type PlacementReport,
  parseIconPlacementRepairs,
  readIconPlacementRepairs,
  repairablePlatformHostname,
  repairForHostnames
} from '../iconPlacementRepairs';
import { StorageManager } from '../storage';

const PICK: CustomSitePositioning = { mode: 'custom', placement: 'before', selector: 'button[aria-label="Send"]' };

describe('applyIconPlacementRepairChange: the override lifecycle', () => {
  it('records the Anchored overlay, then the pick, then the override, and forgets all once the chain resolves', () => {
    let repairs: IconPlacementRepairs = {};

    repairs = applyIconPlacementRepairChange(repairs, { type: 'reportPlacement', hostname: 'claude.ai', placement: 'overlay' });
    expect(repairs).toEqual({ 'claude.ai': { status: 'overlay' } });

    repairs = applyIconPlacementRepairChange(repairs, { type: 'setOverride', hostname: 'claude.ai', positioning: PICK });
    expect(repairs).toEqual({ 'claude.ai': { status: 'overlay', override: PICK } });

    repairs = applyIconPlacementRepairChange(repairs, { type: 'reportPlacement', hostname: 'claude.ai', placement: 'override' });
    expect(repairs).toEqual({ 'claude.ai': { status: 'override', override: PICK } });

    repairs = applyIconPlacementRepairChange(repairs, { type: 'reportPlacement', hostname: 'claude.ai', placement: 'toolbar' });
    expect(repairs).toEqual({});
  });

  it('keeps the override when the picked element is not found and the icon falls back to the overlay', () => {
    const repairs = { 'claude.ai': { status: 'override' as const, override: PICK } };

    expect(applyIconPlacementRepairChange(repairs, { type: 'reportPlacement', hostname: 'claude.ai', placement: 'overlay' }))
      .toEqual({ 'claude.ai': { status: 'overlay', override: PICK } });
  });

  it('drops an override picked while no status was stored once the Toolbar is reported', () => {
    const picked = applyIconPlacementRepairChange({}, { type: 'setOverride', hostname: 'claude.ai', positioning: PICK });
    expect(picked).toEqual({ 'claude.ai': { override: PICK } });

    expect(applyIconPlacementRepairChange(picked, { type: 'reportPlacement', hostname: 'claude.ai', placement: 'toolbar' })).toEqual({});
  });

  it('leaves the other Platforms alone', () => {
    const repairs = { 'claude.ai': { status: 'overlay' as const }, 'chatgpt.com': { status: 'override' as const, override: PICK } };

    expect(applyIconPlacementRepairChange(repairs, { type: 'reportPlacement', hostname: 'claude.ai', placement: 'toolbar' }))
      .toEqual({ 'chatgpt.com': { status: 'override', override: PICK } });
  });

  it.each([
    [{}, 'toolbar'],
    [{ 'claude.ai': { status: 'overlay' as const } }, 'overlay']
  ] as const)('returns the same repairs when a report changes nothing (%j, %s), so nothing is written', (repairs, placement) => {
    expect(applyIconPlacementRepairChange(repairs, { type: 'reportPlacement', hostname: 'claude.ai', placement })).toBe(repairs);
  });
});

describe('parseIconPlacementRepairs', () => {
  it('keeps the statuses and overrides this extension writes', () => {
    const stored = { 'claude.ai': { status: 'override', override: PICK }, 'chatgpt.com': { status: 'overlay' } };

    expect(parseIconPlacementRepairs(stored)).toEqual(stored);
  });

  it.each([
    ['not an object', 'x'],
    ['an unknown status', { 'claude.ai': { status: 'toolbar' } }],
    ['an override with no element', { 'claude.ai': { override: { mode: 'custom', placement: 'before' } } }],
    ['an override with an unknown placement', { 'claude.ai': { override: { ...PICK, placement: 'over' } } }],
    ['an override of another mode', { 'claude.ai': { override: { ...PICK, mode: 'auto' } } }]
  ])('drops %s', (_case, stored) => {
    expect(parseIconPlacementRepairs(stored)).toEqual({});
  });
});

describe('storage', () => {
  beforeEach(async () => {
    await chrome.storage.local.clear();
  });

  it('applies a change to what storage holds', async () => {
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'chatgpt.com': { status: 'overlay' } } });

    await changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement: 'overlay' });

    expect(await readIconPlacementRepairs()).toEqual({ 'chatgpt.com': { status: 'overlay' }, 'claude.ai': { status: 'overlay' } });
  });

  it('does not write the repairs back after Clear All Data asked for while a change was reading them', async () => {
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: { 'claude.ai': { status: 'overlay' } } });
    // The service worker has read the repairs and is paused before it writes, as in another context
    const get = vi.mocked(chrome.storage.local.get);
    const readNow = get.getMockImplementation() as unknown as (keys: unknown) => Promise<Record<string, unknown>>;
    let resume!: () => void;
    const paused = new Promise<void>((resolve) => { resume = resolve; });
    get.mockImplementationOnce((async (keys: unknown) => {
      const result = await readNow(keys);
      await paused;
      return result;
    }) as never);

    const changed = changeIconPlacementRepairs({ type: 'setOverride', hostname: 'claude.ai', positioning: PICK });
    const cleared = StorageManager.getInstance().clearAllData();
    await new Promise((resolve) => setTimeout(resolve, 0));
    resume();
    await Promise.all([changed, cleared]);

    // Clear All Data waited for the change to finish, then cleared what it wrote
    expect(await chrome.storage.local.get(null)).toEqual({});
  });

  it('two changes at once lose neither', async () => {
    await Promise.all([
      changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement: 'overlay' }),
      changeIconPlacementRepairs({ type: 'setOverride', hostname: 'claude.ai', positioning: PICK })
    ]);

    expect(await readIconPlacementRepairs()).toEqual({ 'claude.ai': { status: 'overlay', override: PICK } });
  });
});

describe('the placements of several tabs of a Platform', () => {
  // Tab 1 is on a variant of the UI the chain does not know; tab 2 on the one it knows
  const report = (tabId: number, placement: PlacementReport) =>
    changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement, tabId });
  const pickInTab1 = async () => {
    await report(1, 'overlay');
    await changeIconPlacementRepairs({ type: 'setOverride', hostname: 'claude.ai', positioning: PICK });
    await report(1, 'override');
  };

  it('keeps the pick when another tab places the icon in its Toolbar, once or again', async () => {
    await report(2, 'toolbar');
    await pickInTab1();

    await report(2, 'toolbar');
    await report(2, 'toolbar');

    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });
  });

  it('shows the Anchored overlay while one tab has the icon there, and the override once none does', async () => {
    await pickInTab1();

    await report(2, 'overlay');
    expect((await readIconPlacementRepairs())['claude.ai']?.status).toBe('overlay');

    await report(2, 'override');
    expect((await readIconPlacementRepairs())['claude.ai']?.status).toBe('override');
  });

  it('keeps the pick while a tab waits for its toolbar or pick, and follows that tab once its wait ends', async () => {
    await pickInTab1();
    // Every tab of the Platform closed; on session restore tab 3 waits within its grace period
    await forgetIconPlacementTab(1);
    await report(3, 'waiting');

    await report(2, 'toolbar');
    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });

    await report(3, 'overlay');
    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'overlay', override: PICK });

    await report(3, 'override');
    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });

    await report(3, 'toolbar');
    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('keeps the pick when the tab that needed it closes while another waits', async () => {
    await report(2, 'toolbar');
    await pickInTab1();
    await report(2, 'waiting');

    await forgetIconPlacementTab(1);

    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });
  });

  it('creates no repair from a wait, though another tab is known on the Anchored overlay, as after Clear All Data', async () => {
    await report(1, 'overlay');
    await chrome.storage.local.remove(ICON_PLACEMENT_REPAIRS_KEY);

    await report(3, 'waiting');

    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('drops a pick with no status that only a waiting tab kept, once that tab closes and the others are in their Toolbar', async () => {
    await changeIconPlacementRepairs({ type: 'setOverride', hostname: 'claude.ai', positioning: PICK });
    await report(3, 'waiting');
    await report(2, 'toolbar');
    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ override: PICK });

    await forgetIconPlacementTab(3);

    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('never shows a wait as a status, nor records a repair for it', async () => {
    await report(3, 'waiting');
    expect(await readIconPlacementRepairs()).toEqual({});

    await changeIconPlacementRepairs({ type: 'setOverride', hostname: 'claude.ai', positioning: PICK });
    await report(3, 'waiting');
    await report(2, 'toolbar');
    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ override: PICK });
  });

  it('drops the pick once every tab places the icon in its Toolbar', async () => {
    await pickInTab1();
    await report(2, 'toolbar');

    await report(1, 'toolbar');

    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('drops the pick on the Toolbar of a tab once the tab that needed it closed', async () => {
    await pickInTab1();
    await forgetIconPlacementTab(1);

    await report(2, 'toolbar');

    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('keeps the placement of a tab still on the Platform it is forgotten for leaving', async () => {
    await pickInTab1();
    await forgetIconPlacementTab(1, 'claude.ai');

    await report(2, 'toolbar');

    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });
  });

  it('drops the pick when the tab that needed it closes while another has the icon in its Toolbar', async () => {
    await report(2, 'toolbar');
    await pickInTab1();

    await forgetIconPlacementTab(1);

    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('shows the override once the tab whose icon was on the Anchored overlay closes', async () => {
    await pickInTab1();
    await report(2, 'overlay');

    await forgetIconPlacementTab(2);

    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });
  });

  it('keeps the pick for the next tab when the last tab of the Platform closes', async () => {
    await pickInTab1();

    await forgetIconPlacementTab(1);

    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });
  });

  it('creates no repair from a Toolbar report once storage lost it, though another tab is off the Toolbar', async () => {
    await pickInTab1();
    // Clear All Data empties the repairs, not the tabs' placements
    await chrome.storage.local.clear();

    await report(2, 'toolbar');

    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('keeps the pick stored with no status when a tab closes, for the Toolbar reports to drop', async () => {
    await report(2, 'toolbar');
    await report(3, 'toolbar');
    await changeIconPlacementRepairs({ type: 'setOverride', hostname: 'claude.ai', positioning: PICK });

    await forgetIconPlacementTab(3);

    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ override: PICK });
  });

  it('moves the placement of a replaced tab to its new id, unless the new id reported its own', async () => {
    await pickInTab1();
    await report(9, 'toolbar');

    await moveIconPlacementTab(1, 9, 'claude.ai');
    await report(2, 'toolbar');

    // Tab 9's own Toolbar stands: no tab needs the pick any more
    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('drops the pick once a replaced tab\'s new id, already in its Toolbar, takes the old id\'s place', async () => {
    await report(1, 'overlay');
    // The new page reports before Chrome tells the swap: the old id still needs the overlay
    await report(9, 'toolbar');
    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'overlay' });

    await moveIconPlacementTab(1, 9, 'claude.ai');

    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('keeps showing the Anchored overlay when a tab reports the override while another is on the overlay', async () => {
    await pickInTab1();
    await report(2, 'overlay');

    await report(1, 'override');
    await report(3, 'override');

    expect((await readIconPlacementRepairs())['claude.ai']?.status).toBe('overlay');
  });

  it('keeps the pick for the next tab when a tab it never counted is replaced', async () => {
    await pickInTab1();
    await forgetIconPlacementTab(1);

    await moveIconPlacementTab(5, 6, 'claude.ai');

    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });
  });

  it('moves a replaced tab\'s placement on the Platform named only', async () => {
    await pickInTab1();

    await moveIconPlacementTab(1, 9, 'chatgpt.com');
    await forgetIconPlacementTab(1);
    await report(2, 'toolbar');

    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('counts no tab from what it did not write in session storage', async () => {
    await pickInTab1();
    // A placement it does not know, and a Platform whose tabs are not a record
    await chrome.storage.session.set({ [ICON_PLACEMENT_TABS_KEY]: { 'claude.ai': { 1: 'override', 5: 'sideways' }, 'chatgpt.com': 'override' } });

    await forgetIconPlacementTab(1);

    // No tab of claude.ai is known any more: the pick is kept for the next one
    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });
    expect((await chrome.storage.session.get(ICON_PLACEMENT_TABS_KEY))[ICON_PLACEMENT_TABS_KEY]).toEqual({ 'claude.ai': {} });
  });

  it('keeps the tabs of one Platform when a tab of another reports', async () => {
    await pickInTab1();

    await changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'chatgpt.com', placement: 'overlay', tabId: 3 });
    await report(2, 'toolbar');

    expect((await readIconPlacementRepairs())['claude.ai']).toEqual({ status: 'override', override: PICK });
  });

  it('counts no other tab for a report that names none', async () => {
    await pickInTab1();

    await changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement: 'toolbar' });

    expect(await readIconPlacementRepairs()).toEqual({});
  });

  it('counts only the tabs of the same Platform', async () => {
    await changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'chatgpt.com', placement: 'overlay', tabId: 3 });
    await pickInTab1();
    await report(1, 'toolbar');

    expect(await readIconPlacementRepairs()).toEqual({ 'chatgpt.com': { status: 'overlay' } });
  });
});

describe('repairablePlatformHostname', () => {
  it.each([
    ['https://claude.ai/new', 'claude.ai'],
    ['https://m365.cloud.microsoft/chat', 'm365.cloud.microsoft'],
    ['https://example.com/', null],
    ['http://claude.ai/', null],
    ['not a url', null],
    [undefined, null]
  ])('%s → %s', (url, hostname) => {
    expect(repairablePlatformHostname(url)).toBe(hostname);
  });
});

describe('overrideFromPick', () => {
  it('places the icon before the picked element', () => {
    const fingerprint = { meta: { confidence: 'high' } } as unknown as ElementFingerprint;

    expect(overrideFromPick({ fingerprint, selector: '#send' })).toEqual({ mode: 'custom', placement: 'before', fingerprint, selector: '#send' });
  });

  it('is null for a pick that names no element', () => {
    expect(overrideFromPick({})).toBeNull();
    expect(overrideFromPick(undefined)).toBeNull();
  });
});

describe('repairForHostnames', () => {
  it('finds a linked Platform\'s repair for its row', () => {
    const repairs = { 'm365.cloud.microsoft': { status: 'overlay' as const } };

    expect(repairForHostnames(repairs, ['copilot.microsoft.com', 'm365.cloud.microsoft'])).toEqual({ hostname: 'm365.cloud.microsoft', status: 'overlay' });
    expect(repairForHostnames(repairs, ['claude.ai'])).toBeNull();
  });

  it('shows the Anchored overlay of a linked Platform over the override of the first', () => {
    const repairs = {
      'copilot.microsoft.com': { status: 'override' as const, override: PICK },
      'm365.cloud.microsoft': { status: 'overlay' as const }
    };

    expect(repairForHostnames(repairs, ['copilot.microsoft.com', 'm365.cloud.microsoft'])).toEqual({ hostname: 'm365.cloud.microsoft', status: 'overlay' });
  });
});

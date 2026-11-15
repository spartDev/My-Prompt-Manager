import { beforeEach, describe, expect, it } from 'vitest';

import type { CustomSitePositioning, ElementFingerprint } from '../../types';
import {
  applyIconPlacementRepairChange,
  changeIconPlacementRepairs,
  ICON_PLACEMENT_REPAIRS_KEY,
  type IconPlacementRepairs,
  overrideFromPick,
  parseIconPlacementRepairs,
  readIconPlacementRepairs,
  repairablePlatformHostname,
  repairForHostnames
} from '../iconPlacementRepairs';

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

  it('two changes at once lose neither', async () => {
    await Promise.all([
      changeIconPlacementRepairs({ type: 'reportPlacement', hostname: 'claude.ai', placement: 'overlay' }),
      changeIconPlacementRepairs({ type: 'setOverride', hostname: 'claude.ai', positioning: PICK })
    ]);

    expect(await readIconPlacementRepairs()).toEqual({ 'claude.ai': { status: 'overlay', override: PICK } });
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
});

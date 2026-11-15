/**
 * Icon placement repairs: for each built-in Platform, how its content script last placed the icon
 * and the positioning the user picked when the Platform's Toolbar was not found (design
 * docs/plans/2026-11-08-icon-placement-resilience-design.md §6).
 *
 * The lifecycle of an override:
 * 1. The content script finds no anchor of the Platform's chain and puts the icon on the Anchored
 *    overlay: it reports `overlay`, and the Platform's row in Settings offers "Place the icon".
 * 2. The user picks an element of the Platform with the Element picker: the service worker stores
 *    it as the Platform's override, the content script places the icon there and reports `override`.
 * 3. Once a release fixes the chain, the content script finds its anchor again and reports
 *    `toolbar`: the Platform's entry, override included, is dropped.
 *
 * Kept under a key of its own, apart from the Site settings, and written only by the service
 * worker, under a lock shared by the extension's contexts. The module imports neither
 * `StorageManager` nor React, so the content script can read it.
 */

import { getPlatformByHostname } from '../config/platforms';
import type { CustomSitePositioning, ElementFingerprint } from '../types';
import { AsyncMutex } from '../utils/asyncMutex';

/** The `chrome.storage.local` key the repairs are stored under */
export const ICON_PLACEMENT_REPAIRS_KEY = 'iconPlacementRepairs';

/** How a content script placed the icon on a built-in Platform */
export type PlacementReport = 'toolbar' | 'overlay' | 'override';

/** What Settings shows for a Platform: absent while the icon is in its Toolbar */
export type RepairStatus = Exclude<PlacementReport, 'toolbar'>;

export interface PlatformPlacementRepair {
  status?: RepairStatus;
  /** The element the user picked, the same shape as a Custom site's positioning */
  override?: CustomSitePositioning;
}

/** By hostname of the Platform */
export type IconPlacementRepairs = Record<string, PlatformPlacementRepair>;

export type IconPlacementRepairChange =
  | { type: 'reportPlacement'; hostname: string; placement: PlacementReport }
  | { type: 'setOverride'; hostname: string; positioning: CustomSitePositioning };

const PLACEMENTS: ReadonlyArray<CustomSitePositioning['placement']> = ['before', 'after', 'inside-start', 'inside-end'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A stored override, or null when it is not one this extension wrote */
function parseOverride(value: unknown): CustomSitePositioning | null {
  if (!isRecord(value) || value.mode !== 'custom') {
    return null;
  }
  if (!PLACEMENTS.includes(value.placement as CustomSitePositioning['placement'])) {
    return null;
  }
  const hasSelector = typeof value.selector === 'string' && value.selector.length > 0;
  const hasFingerprint = isRecord(value.fingerprint) && isRecord(value.fingerprint.meta);
  if (!hasSelector && !hasFingerprint) {
    return null;
  }
  return value as unknown as CustomSitePositioning;
}

/** The repairs held in storage, without the entries this extension did not write */
export function parseIconPlacementRepairs(value: unknown): IconPlacementRepairs {
  const repairs: IconPlacementRepairs = {};
  if (!isRecord(value)) {
    return repairs;
  }
  for (const [hostname, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      continue;
    }
    const repair: PlatformPlacementRepair = {};
    if (entry.status === 'overlay' || entry.status === 'override') {
      repair.status = entry.status;
    }
    const override = parseOverride(entry.override);
    if (override) {
      repair.override = override;
    }
    if (repair.status || repair.override) {
      repairs[hostname] = repair;
    }
  }
  return repairs;
}

/**
 * The repairs after a change. Pure: the same repairs come back, unchanged, when the change
 * changes nothing, so the caller can skip the write.
 */
export function applyIconPlacementRepairChange(repairs: IconPlacementRepairs, change: IconPlacementRepairChange): IconPlacementRepairs {
  const current = repairs[change.hostname];
  if (change.type === 'setOverride') {
    return { ...repairs, [change.hostname]: { ...current, override: change.positioning } };
  }
  if (change.placement === 'toolbar') {
    // The chain resolves again: the fallback is over, and the override with it
    if (!current) {
      return repairs;
    }
    const { [change.hostname]: _dropped, ...rest } = repairs;
    return rest;
  }
  if (current?.status === change.placement) {
    return repairs;
  }
  return { ...repairs, [change.hostname]: { ...current, status: change.placement } };
}

/** Reads the repairs from storage; none when storage cannot be read */
export async function readIconPlacementRepairs(): Promise<IconPlacementRepairs> {
  try {
    const result = await chrome.storage.local.get(ICON_PLACEMENT_REPAIRS_KEY);
    return parseIconPlacementRepairs(result[ICON_PLACEMENT_REPAIRS_KEY]);
  } catch {
    return {};
  }
}

const repairsLock = new AsyncMutex({ scope: 'IconPlacementRepairs' });

/** Applies a change to what storage holds, under the lock; writes only when something changed */
export function changeIconPlacementRepairs(change: IconPlacementRepairChange): Promise<IconPlacementRepairs> {
  return repairsLock.withLock(ICON_PLACEMENT_REPAIRS_KEY, async () => {
    // A read that fails throws here: a write over storage it could not read would lose the other Platforms
    const result = await chrome.storage.local.get(ICON_PLACEMENT_REPAIRS_KEY);
    const repairs = parseIconPlacementRepairs(result[ICON_PLACEMENT_REPAIRS_KEY]);
    const next = applyIconPlacementRepairChange(repairs, change);
    if (next !== repairs) {
      await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: next });
    }
    return next;
  });
}

/** The repair of a Platform row: its own hostname's, else one of its linked Platforms' */
export function repairForHostnames(repairs: IconPlacementRepairs, hostnames: readonly string[]): { hostname: string; status: RepairStatus } | null {
  for (const hostname of hostnames) {
    const status = repairs[hostname]?.status;
    if (status) {
      return { hostname, status };
    }
  }
  return null;
}

/**
 * The hostname of the built-in Platform a tab is on, the only sites a repair is kept for; null
 * for a Custom site, whose positioning is its own, or any other page.
 */
export function repairablePlatformHostname(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== 'https:') {
      return null;
    }
    return getPlatformByHostname(hostname)?.iconPlacement ? hostname : null;
  } catch {
    return null;
  }
}

/**
 * The override stored for an element the user picked: the icon goes before it, as it goes before
 * the button a chain names. Null when the pick names no element.
 */
export function overrideFromPick(pick: { fingerprint?: ElementFingerprint; selector?: string } | undefined): CustomSitePositioning | null {
  return parseOverride({
    mode: 'custom',
    placement: 'before',
    ...(pick?.fingerprint ? { fingerprint: pick.fingerprint } : {}),
    ...(pick?.selector ? { selector: pick.selector } : {})
  });
}

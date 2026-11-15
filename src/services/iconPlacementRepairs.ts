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
 *    `toolbar`: the Platform's entry, override included, is dropped, unless another tab of the
 *    Platform still has the icon on the overlay or the override (another variant of its UI). A tab
 *    that closes, or leaves the Platform, is forgotten, and the status follows the tabs left
 *    (forgetIconPlacementTab).
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

/**
 * The service worker's answer to a placement report. `permanent` marks a report it will refuse
 * whenever it is sent (not a built-in Platform's tab), so the content script does not send it again.
 */
export type PlacementReportResponse = { success: true } | { success: false; error: string; permanent?: boolean };

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
  | {
      type: 'reportPlacement';
      hostname: string;
      placement: PlacementReport;
      /** The tab that placed the icon: its placement is kept, so another tab's Toolbar does not drop a repair it needs */
      tabId?: number;
    }
  | { type: 'setOverride'; hostname: string; positioning: CustomSitePositioning };

/**
 * The `chrome.storage.session` key of each tab's last placement, by hostname of the Platform, then
 * by tab id. Session storage: it survives a service worker restart and goes with the browser session.
 */
export const ICON_PLACEMENT_TABS_KEY = 'iconPlacementTabs';

type PlacementTabs = Record<string, Record<string, PlacementReport>>;

function parsePlacementTabs(value: unknown): PlacementTabs {
  const tabs: PlacementTabs = {};
  if (!isRecord(value)) {
    return tabs;
  }
  for (const [hostname, byTab] of Object.entries(value)) {
    if (!isRecord(byTab)) {
      continue;
    }
    const kept: Record<string, PlacementReport> = {};
    for (const [tabId, placement] of Object.entries(byTab)) {
      if (placement === 'toolbar' || placement === 'overlay' || placement === 'override') {
        kept[tabId] = placement;
      }
    }
    tabs[hostname] = kept;
  }
  return tabs;
}

/** The status the placements of these tabs call for: the overlay first, then the override; null when all are in the Toolbar */
function statusOf(placements: Iterable<PlacementReport>): RepairStatus | null {
  let status: RepairStatus | null = null;
  for (const placement of placements) {
    if (placement === 'overlay') {
      return 'overlay';
    }
    if (placement === 'override') {
      status = 'override';
    }
  }
  return status;
}

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
 *
 * @param others - For a placement report, the status the other tabs of the Platform call for
 *   (statusOf their last placements), null when none is off the Toolbar
 */
export function applyIconPlacementRepairChange(
  repairs: IconPlacementRepairs,
  change: IconPlacementRepairChange,
  others: RepairStatus | null = null
): IconPlacementRepairs {
  const current = repairs[change.hostname];
  if (change.type === 'setOverride') {
    return { ...repairs, [change.hostname]: { ...current, override: change.positioning } };
  }
  if (change.placement === 'toolbar' && !current) {
    // Nothing to drop; the other tabs' status is theirs to report, as after Clear All Data
    return repairs;
  }
  const status = change.placement === 'toolbar' ? others : statusOf([change.placement, ...(others ? [others] : [])]);
  if (!status) {
    // The chain resolves again in every tab known: the fallback is over, and the override with it
    if (!current) {
      return repairs;
    }
    const { [change.hostname]: _dropped, ...rest } = repairs;
    return rest;
  }
  if (current?.status === status) {
    return repairs;
  }
  return { ...repairs, [change.hostname]: { ...current, status } };
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

// Shared with the other contexts through the Web Locks API. Clear All Data takes it last, after
// the Site settings lock (StorageManager.clearAllData), so a repair waiting in the service worker
// is written to the cleared store, or before the clear and cleared with it, never back over it.
const repairsLock = new AsyncMutex({ scope: 'IconPlacementRepairs' });

/** Runs an operation while no context can change the repairs */
export function withIconPlacementRepairsLock<T>(operation: () => Promise<T>): Promise<T> {
  return repairsLock.withLock(ICON_PLACEMENT_REPAIRS_KEY, operation);
}

/**
 * Records a tab's placement and returns the status the Platform's other tabs call for. Called
 * under the lock. A report with no tab records nothing, and counts no other tab.
 */
async function recordTabPlacement(hostname: string, placement: PlacementReport, tabId: number | undefined): Promise<RepairStatus | null> {
  if (tabId === undefined) {
    return null;
  }
  const tabs = parsePlacementTabs((await chrome.storage.session.get(ICON_PLACEMENT_TABS_KEY))[ICON_PLACEMENT_TABS_KEY]);
  const byTab = tabs[hostname] ?? {};
  const others = statusOf(Object.entries(byTab).filter(([id]) => id !== String(tabId)).map(([, other]) => other));
  if (byTab[String(tabId)] !== placement) {
    await chrome.storage.session.set({ [ICON_PLACEMENT_TABS_KEY]: { ...tabs, [hostname]: { ...byTab, [String(tabId)]: placement } } });
  }
  return others;
}

/**
 * Forgets the placement of a tab that closed, or left the Platform for another site: it no longer
 * keeps a repair. The Platform's status then follows the tabs still known: the overlay or the
 * override they call for; none when one of them has the icon in its Toolbar and none needs the
 * repair, so the repair is dropped as a Toolbar report would drop it. When no tab of the Platform is
 * known any more, the repair is kept: the next tab that opens it may need the pick.
 *
 * @param keepHostname - The Platform the tab is on now, whose placement it reports again itself
 */
export function forgetIconPlacementTab(tabId: number, keepHostname: string | null = null): Promise<void> {
  return withIconPlacementRepairsLock(async () => {
    const tabs = parsePlacementTabs((await chrome.storage.session.get(ICON_PLACEMENT_TABS_KEY))[ICON_PLACEMENT_TABS_KEY]);
    const left: string[] = [];
    for (const [hostname, byTab] of Object.entries(tabs)) {
      if (hostname !== keepHostname && String(tabId) in byTab) {
        delete byTab[String(tabId)];
        left.push(hostname);
      }
    }
    if (left.length === 0) {
      return;
    }
    await chrome.storage.session.set({ [ICON_PLACEMENT_TABS_KEY]: tabs });

    const repairs = parseIconPlacementRepairs((await chrome.storage.local.get(ICON_PLACEMENT_REPAIRS_KEY))[ICON_PLACEMENT_REPAIRS_KEY]);
    let next = repairs;
    for (const hostname of left) {
      const remaining = Object.values(tabs[hostname] ?? {});
      if (remaining.length > 0 && next[hostname]?.status) {
        // The status the tabs still open call for, as if one of them had just reported
        const status = statusOf(remaining);
        next = applyIconPlacementRepairChange(next, { type: 'reportPlacement', hostname, placement: status ?? 'toolbar' }, status);
      }
    }
    if (next !== repairs) {
      await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: next });
    }
  });
}

/** Applies a change to what storage holds, under the lock; writes only when something changed */
export function changeIconPlacementRepairs(change: IconPlacementRepairChange): Promise<IconPlacementRepairs> {
  return withIconPlacementRepairsLock(async () => {
    // A read that fails throws here: a write over storage it could not read would lose the other Platforms
    const result = await chrome.storage.local.get(ICON_PLACEMENT_REPAIRS_KEY);
    const repairs = parseIconPlacementRepairs(result[ICON_PLACEMENT_REPAIRS_KEY]);
    const others = change.type === 'reportPlacement' ? await recordTabPlacement(change.hostname, change.placement, change.tabId) : null;
    const next = applyIconPlacementRepairChange(repairs, change, others);
    if (next !== repairs) {
      await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: next });
    }
    return next;
  });
}

/**
 * The repair a Platform row shows, of its own hostname or of its linked Platforms' (Copilot and
 * M365 Copilot share a row). The Anchored overlay comes first, wherever it is: it is the one that
 * asks the user to place the icon. Else the first override, by the order of the hostnames.
 */
export function repairForHostnames(repairs: IconPlacementRepairs, hostnames: readonly string[]): { hostname: string; status: RepairStatus } | null {
  const found = hostnames.flatMap((hostname) => {
    const status = repairs[hostname]?.status;
    return status ? [{ hostname, status }] : [];
  });
  return found.find(({ status }) => status === 'overlay') ?? found[0] ?? null;
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

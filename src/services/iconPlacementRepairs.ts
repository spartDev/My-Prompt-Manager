/**
 * Icon placement repairs: for each built-in Platform, how its content script last placed the icon
 * and the positioning the user picked when the Platform's Toolbar was not found (design
 * docs/plans/2026-11-08-icon-placement-resilience-design.md §6).
 *
 * The lifecycle of an override:
 * 1. The content script finds no anchor of the Platform's chain and puts the icon on the Anchored
 *    overlay. Still none after a grace period (a Platform may render its toolbar after its
 *    editor), it reports `overlay`, and the Platform's row in Settings offers "Place the icon".
 * 2. The user picks an element of the Platform with the Element picker: the service worker stores
 *    it as the Platform's override, the content script places the icon there and reports `override`.
 * 3. Once a release fixes the chain, or the toolbar the icon waited for renders, the content
 *    script finds its anchor again and reports `toolbar`: the Platform's entry, override
 *    included, is dropped, unless another tab of the Platform still has the icon on the overlay
 *    or the override (another variant of its UI), or waits for its toolbar or pick within the
 *    grace period (it reports `waiting`, which keeps the repair as it is and is never a status). A tab that closes, or leaves the Platform, is
 *    forgotten, and the status follows the tabs left (forgetIconPlacementTab). While the picked
 *    element is on the page, only the chain's first anchor ends the pick: a later one may show
 *    only at times (a send button), and ends it only once the grace period is over without the
 *    picked element.
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

/**
 * How a content script placed the icon on a built-in Platform. `waiting`: the icon waits within the
 * grace period for a toolbar or a pick rendered late. The tab may need the repair once its wait
 * ends, so a Toolbar elsewhere does not drop it meanwhile; a wait is never a status.
 */
export type PlacementReport = 'toolbar' | 'overlay' | 'override' | 'waiting';

const PLACEMENT_REPORTS: ReadonlyArray<PlacementReport> = ['toolbar', 'overlay', 'override', 'waiting'];

/** True for a placement a content script may report */
export function isPlacementReport(value: unknown): value is PlacementReport {
  return PLACEMENT_REPORTS.includes(value as PlacementReport);
}

/**
 * The service worker's answer to a placement report. `permanent` marks a report it will refuse
 * whenever it is sent (not a built-in Platform's tab), so the content script does not send it again.
 */
export type PlacementReportResponse = { success: true } | { success: false; error: string; permanent?: boolean };

/** What Settings shows for a Platform: absent while the icon is in its Toolbar */
export type RepairStatus = Exclude<PlacementReport, 'toolbar' | 'waiting'>;

/** What the tabs of a Platform need of its repair: a status, or only to keep it while one waits */
export type RepairNeed = RepairStatus | 'waiting';

export interface PlatformPlacementRepair {
  status?: RepairStatus;
  /** The element the user picked, the same shape as a Custom site's positioning */
  override?: CustomSitePositioning;
  /**
   * When the entry was last written, as a count above every other entry's: the newest repair of a
   * row is the one Settings shows (repairForHostnames). Data, not the order of the keys, which
   * chrome.storage does not keep (it returns them sorted). Absent on an entry from before it.
   */
  written?: number;
}

/** By hostname of the Platform */
export type IconPlacementRepairs = Record<string, PlatformPlacementRepair>;

/** The repairs with this entry written, newer than every other */
function withEntry(repairs: IconPlacementRepairs, hostname: string, entry: PlatformPlacementRepair): IconPlacementRepairs {
  const written = Math.max(0, ...Object.values(repairs).map((repair) => repair.written ?? 0)) + 1;
  return { ...repairs, [hostname]: { ...entry, written } };
}

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
      if (isPlacementReport(placement)) {
        kept[tabId] = placement;
      }
    }
    tabs[hostname] = kept;
  }
  return tabs;
}

/**
 * What the placements of these tabs need of the repair: the overlay first, then the override, then
 * a wait, which keeps the repair as it is; null when all are in the Toolbar
 */
function needOf(placements: Iterable<PlacementReport | RepairNeed>): RepairNeed | null {
  let need: RepairNeed | null = null;
  for (const placement of placements) {
    if (placement === 'overlay') {
      return 'overlay';
    }
    if (placement === 'override' || (placement === 'waiting' && need === null)) {
      need = placement;
    }
  }
  return need;
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
      if (typeof entry.written === 'number' && Number.isFinite(entry.written)) {
        repair.written = entry.written;
      }
      repairs[hostname] = repair;
    }
  }
  return repairs;
}

/**
 * The repairs after a change. Pure: the same repairs come back, unchanged, when the change
 * changes nothing, so the caller can skip the write.
 *
 * @param others - For a placement report, what the other tabs of the Platform need of the repair
 *   (needOf their last placements), null when none is off the Toolbar or waiting
 */
export function applyIconPlacementRepairChange(
  repairs: IconPlacementRepairs,
  change: IconPlacementRepairChange,
  others: RepairNeed | null = null
): IconPlacementRepairs {
  const current = repairs[change.hostname];
  if (change.type === 'setOverride') {
    return withEntry(repairs, change.hostname, { ...current, override: change.positioning });
  }
  if ((change.placement === 'toolbar' || change.placement === 'waiting') && !current) {
    // Nothing to drop, and a wait keeps only what exists; the other tabs' status is theirs to
    // report, as after Clear All Data
    return repairs;
  }
  const status = change.placement === 'toolbar' ? others : needOf([change.placement, ...(others ? [others] : [])]);
  if (status === 'waiting') {
    // A tab waits for its toolbar or its pick: the repair stays as it is, created by no wait
    return repairs;
  }
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
  return withEntry(repairs, change.hostname, { ...current, status });
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

// Shared with the other contexts through the Web Locks API. Clear All Data takes it after the
// Site settings lock and before the What's new lock (StorageManager.clearAllData), so a repair waiting in the service worker
// is written to the cleared store, or before the clear and cleared with it, never back over it.
const repairsLock = new AsyncMutex({ scope: 'IconPlacementRepairs' });

/** Runs an operation while no context can change the repairs */
export function withIconPlacementRepairsLock<T>(operation: () => Promise<T>): Promise<T> {
  return repairsLock.withLock(ICON_PLACEMENT_REPAIRS_KEY, operation);
}

/**
 * Records a tab's placement and returns what the Platform's other tabs need of the repair. Called
 * under the lock. A report with no tab records nothing, and counts no other tab.
 */
async function recordTabPlacement(hostname: string, placement: PlacementReport, tabId: number | undefined): Promise<RepairNeed | null> {
  if (tabId === undefined) {
    return null;
  }
  const tabs = parsePlacementTabs((await chrome.storage.session.get(ICON_PLACEMENT_TABS_KEY))[ICON_PLACEMENT_TABS_KEY]);
  const byTab = tabs[hostname] ?? {};
  const others = needOf(Object.entries(byTab).filter(([id]) => id !== String(tabId)).map(([, other]) => other));
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
    const keptByWait: string[] = [];
    for (const [hostname, byTab] of Object.entries(tabs)) {
      if (hostname !== keepHostname && String(tabId) in byTab) {
        if (byTab[String(tabId)] === 'waiting') {
          keptByWait.push(hostname);
        }
        delete byTab[String(tabId)];
        left.push(hostname);
      }
    }
    if (left.length === 0) {
      return;
    }
    await chrome.storage.session.set({ [ICON_PLACEMENT_TABS_KEY]: tabs });
    await settleStatus(tabs, left, keptByWait);
  });
}

/**
 * Brings the status of these Platforms to what their known tabs call for, once a tab was forgotten
 * or moved: as if one of them had just reported. Kept when no tab of the Platform is known, or when
 * the repair has no status (an override waiting for one), unless the wait of a tab forgotten, or of
 * a tab's old id once moved, was what kept it (`keptByWait`). Called under the lock.
 */
async function settleStatus(tabs: PlacementTabs, hostnames: readonly string[], keptByWait: readonly string[] = []): Promise<void> {
  const repairs = parseIconPlacementRepairs((await chrome.storage.local.get(ICON_PLACEMENT_REPAIRS_KEY))[ICON_PLACEMENT_REPAIRS_KEY]);
  let next = repairs;
  for (const hostname of hostnames) {
    const remaining = Object.values(tabs[hostname] ?? {});
    if (remaining.length > 0 && next[hostname] && (next[hostname].status || keptByWait.includes(hostname))) {
      const need = needOf(remaining);
      next = applyIconPlacementRepairChange(next, { type: 'reportPlacement', hostname, placement: need ?? 'toolbar' }, need);
    }
  }
  if (next !== repairs) {
    await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: next });
  }
}

/**
 * After an extension update or reload, or a browser restart, which empty session storage while the repairs stay: counts
 * each open tab of a Platform with a repair as waiting until its new content script reports how it
 * placed the icon, so the first tab that reports its Toolbar does not drop a pick another tab, not
 * yet re-injected or discarded by Memory Saver, still needs. A tab that already reported keeps its
 * placement. A tab that closes or leaves the Platform is forgotten as any other.
 */
export function expectIconPlacementReports(tabs: ReadonlyArray<{ tabId: number; hostname: string }>): Promise<void> {
  return withIconPlacementRepairsLock(async () => {
    const repairs = parseIconPlacementRepairs((await chrome.storage.local.get(ICON_PLACEMENT_REPAIRS_KEY))[ICON_PLACEMENT_REPAIRS_KEY]);
    const placements = parsePlacementTabs((await chrome.storage.session.get(ICON_PLACEMENT_TABS_KEY))[ICON_PLACEMENT_TABS_KEY]);
    let changed = false;
    for (const { tabId, hostname } of tabs) {
      if (!repairs[hostname]) {
        continue;
      }
      placements[hostname] ??= {};
      const byTab = placements[hostname];
      if (!(String(tabId) in byTab)) {
        byTab[String(tabId)] = 'waiting';
        changed = true;
      }
    }
    if (changed) {
      await chrome.storage.session.set({ [ICON_PLACEMENT_TABS_KEY]: placements });
    }
  });
}

/**
 * Moves a tab's placement on a Platform to the id Chrome gave the tab when it swapped its page (a
 * prerender, a discard), when the new page is on that Platform: it is the same tab, and still needs
 * what it needed. A placement the new id already reported is its own, and kept.
 */
export function moveIconPlacementTab(fromTabId: number, toTabId: number, hostname: string): Promise<void> {
  return withIconPlacementRepairsLock(async () => {
    const tabs = parsePlacementTabs((await chrome.storage.session.get(ICON_PLACEMENT_TABS_KEY))[ICON_PLACEMENT_TABS_KEY]);
    const byTab = tabs[hostname];
    const placement = byTab?.[String(fromTabId)];
    if (!byTab || !placement) {
      return;
    }
    delete byTab[String(fromTabId)];
    byTab[String(toTabId)] ??= placement;
    await chrome.storage.session.set({ [ICON_PLACEMENT_TABS_KEY]: tabs });
    // The new id's own placement replaced the old one: the status follows the tabs known, and a
    // pick only the old id's wait kept is settled, as when a tab is forgotten
    await settleStatus(tabs, [hostname], placement === 'waiting' ? [hostname] : []);
  });
}

/**
 * The hosts that redirect to this one: the Platform's main hostname, for one of its other hostnames
 * (m365.cloud.microsoft sends a work account to copilot.cloud.microsoft). None for the main hostname,
 * nor for a host of no Platform. The redirect goes one way only.
 */
export function redirectSourcesOf(hostname: string): string[] {
  const platform = getPlatformByHostname(hostname);
  return platform && platform.hostname !== hostname ? [platform.hostname] : [];
}

/**
 * A tab reported from a host a Platform redirects to: the repair of the host that redirects there,
 * with no tab known, is dropped. No tab of it would ever clear it, and Settings would offer a repair
 * for a host that cannot be opened. A host with a tab still open keeps its own, and a report from the
 * host that redirects drops nothing: the repair of the host it redirects to waits for that host's next
 * tab. Called under the lock.
 */
async function dropStaleSiblingHosts(repairs: IconPlacementRepairs, hostname: string): Promise<IconPlacementRepairs> {
  const siblings = redirectSourcesOf(hostname).filter((source) => repairs[source]);
  if (siblings.length === 0) {
    return repairs;
  }
  const tabs = parsePlacementTabs((await chrome.storage.session.get(ICON_PLACEMENT_TABS_KEY))[ICON_PLACEMENT_TABS_KEY]);
  let next = repairs;
  for (const sibling of siblings) {
    if (Object.keys(tabs[sibling] ?? {}).length === 0) {
      const { [sibling]: _stale, ...rest } = next;
      next = rest;
    }
  }
  return next;
}

/** Applies a change to what storage holds, under the lock; writes only when something changed */
export function changeIconPlacementRepairs(change: IconPlacementRepairChange): Promise<IconPlacementRepairs> {
  return withIconPlacementRepairsLock(async () => {
    // A read that fails throws here: a write over storage it could not read would lose the other Platforms
    const result = await chrome.storage.local.get(ICON_PLACEMENT_REPAIRS_KEY);
    const repairs = parseIconPlacementRepairs(result[ICON_PLACEMENT_REPAIRS_KEY]);
    const others = change.type === 'reportPlacement' ? await recordTabPlacement(change.hostname, change.placement, change.tabId) : null;
    let next = applyIconPlacementRepairChange(repairs, change, others);
    if (change.type === 'reportPlacement' && change.tabId !== undefined) {
      next = await dropStaleSiblingHosts(next, change.hostname);
    }
    if (next !== repairs) {
      await chrome.storage.local.set({ [ICON_PLACEMENT_REPAIRS_KEY]: next });
    }
    return next;
  });
}

/**
 * The repair a Platform row shows, of its own hostnames or of its linked Platforms' (Copilot and
 * M365 Copilot share a row). The Anchored overlay comes first, wherever it is: it is the one that
 * asks the user to place the icon. Else an override. Of several, the newest written: an older one
 * may be at a host that now redirects to the newer's.
 */
export function repairForHostnames(repairs: IconPlacementRepairs, hostnames: readonly string[]): { hostname: string; status: RepairStatus } | null {
  const found = hostnames
    .flatMap((hostname) => {
      const repair = repairs[hostname];
      return repair?.status ? [{ hostname, status: repair.status, written: repair.written ?? 0 }] : [];
    })
    // Newest first; entries from before `written`, by the order of the hostnames
    .sort((a, b) => b.written - a.written);
  const shown = found.find(({ status }) => status === 'overlay') ?? found[0];
  return shown ? { hostname: shown.hostname, status: shown.status } : null;
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

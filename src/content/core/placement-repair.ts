/**
 * The content script's side of an icon placement repair (src/services/iconPlacementRepairs.ts):
 * keeps the override the user picked for this Platform in memory, follows its changes in
 * storage, finds the element it names, and tells the service worker how the icon was placed.
 *
 * The service worker keeps how each tab last placed the icon, so a Toolbar in one tab does not drop
 * a repair another tab needs. The tab's placement is sent when it differs from the last one sent; a
 * Toolbar is not sent while the Platform has no repair, so a Platform whose chain resolves costs one
 * storage read per page load and no message. It is sent again, whatever it is: once the Platform has
 * a repair, so every open tab is counted, those whose icon was in the Toolbar before the repair
 * included; after a report the service worker did not save, unless it refused it for good; when
 * storage drops the repair while this tab was off the Toolbar (as by Clear All Data), or holds an
 * override with no status (a pick stored after the chain resolved); and when the page comes back from
 * the back/forward cache, since the service worker forgot the tab when it left.
 */

import {
  ICON_PLACEMENT_REPAIRS_KEY,
  type PlacementReport,
  type PlacementReportResponse,
  type PlatformPlacementRepair,
  parseIconPlacementRepairs,
  readIconPlacementRepairs
} from '../../services/iconPlacementRepairs';
import type { CustomSitePositioning } from '../../types';
import { getElementFingerprintGenerator } from '../utils/element-fingerprint';
import { debug, info, warn } from '../utils/logger';

/** The message a content script sends the service worker after placing the icon on a built-in Platform */
export const PLACEMENT_REPORT_MESSAGE = 'ICON_PLACEMENT_REPORTED';

export class PlacementRepair {
  private override: CustomSitePositioning | null = null;
  /** The placement last sent for this tab; null when the service worker may hold none, or another */
  private sent: PlacementReport | null = null;
  /** How the icon was last placed in this tab, sent or not; null before its first placement */
  private placed: PlacementReport | null = null;
  /** Whether storage holds a repair for this Platform: until it does, a Toolbar needs no report */
  private hasRepair = false;
  /** How many changes of the repairs this page followed */
  private changes = 0;
  private listening = false;
  private readonly hostname: string;
  private readonly onOverrideChange: () => void;

  /**
   * @param onOverrideChange - Called when the user picks a new element for this Platform, or the
   *   override is dropped elsewhere, while the icon is off the Toolbar, so it is placed again
   */
  constructor(hostname: string, onOverrideChange: () => void) {
    this.hostname = hostname;
    this.onOverrideChange = onOverrideChange;
  }

  /** The element the user picked for this Platform, if any */
  get positioning(): CustomSitePositioning | null {
    return this.override;
  }

  /**
   * Reads this Platform's repair and follows its changes. It listens before it reads: a repair stored
   * by another tab during the read reaches it by its storage event, which the read does not undo.
   */
  async load(): Promise<void> {
    // The first placement of the page is reported, but a Toolbar only while the Platform has a repair
    this.sent = null;
    if (!this.listening) {
      chrome.storage.onChanged.addListener(this.handleStorageChange);
      window.addEventListener('pageshow', this.handlePageShow);
      document.addEventListener('prerenderingchange', this.handlePrerenderingChange);
      this.listening = true;
    }
    const changesBefore = this.changes;
    const repair = (await readIconPlacementRepairs())[this.hostname];
    if (this.changes !== changesBefore) {
      return;
    }
    this.override = repair?.override ?? null;
    this.hasRepair = repair !== undefined;
  }

  /** Stops following storage */
  dispose(): void {
    if (this.listening) {
      chrome.storage.onChanged.removeListener(this.handleStorageChange);
      window.removeEventListener('pageshow', this.handlePageShow);
      document.removeEventListener('prerenderingchange', this.handlePrerenderingChange);
      this.listening = false;
    }
  }

  /**
   * The element the override names on the page, by its fingerprint, then by its selector. A click
   * in the Element picker lands on the deepest node, often the icon inside a button: the icon goes
   * by the button, not into it.
   */
  findAnchor(): HTMLElement | null {
    const picked = this.findPicked();
    if (!picked) {
      return null;
    }
    return picked.closest<HTMLElement>('button, [role="button"], a')
      ?? picked.closest('svg')?.parentElement
      ?? picked;
  }

  private findPicked(): HTMLElement | null {
    const positioning = this.override;
    if (!positioning) {
      return null;
    }
    if (positioning.fingerprint) {
      const found = getElementFingerprintGenerator().findElement(positioning.fingerprint);
      if (found) {
        return found;
      }
    }
    if (positioning.selector) {
      try {
        return document.querySelector<HTMLElement>(positioning.selector);
      } catch (err) {
        warn('The element picked for the icon has an invalid selector', { error: String(err) });
      }
    }
    return null;
  }

  /**
   * Tells the service worker how the icon was placed in this tab, when it differs from the last
   * report delivered. A placement in the Toolbar keeps the override here: the service worker drops
   * it, and storage says so, only when no other tab of the Platform still needs it; the chain comes
   * before the override, so it is not used while the Toolbar is found.
   */
  report(placement: PlacementReport): void {
    this.placed = placement;
    if (placement === this.sent || (placement === 'toolbar' && !this.hasRepair)) {
      return;
    }
    if ((document as Document & { prerendering?: boolean }).prerendering) {
      // Not the tab's page yet: the service worker would count it for the page it may replace.
      // It is sent once the page is activated (prerenderingchange).
      return;
    }
    if (placement === 'toolbar' && this.override !== null) {
      info('The anchor chain of this Platform resolves again in this tab', { hostname: this.hostname });
    }
    this.sent = placement;
    debug('Icon placement reported', { hostname: this.hostname, placement });
    const notSaved = (reason: string) => {
      // The next placement reports again, whatever it is
      if (this.sent === placement) {
        this.sent = null;
      }
      debug('Icon placement report not saved', { placement, reason });
    };
    chrome.runtime.sendMessage({ type: PLACEMENT_REPORT_MESSAGE, data: { placement } })
      .then((response: PlacementReportResponse | undefined) => {
        if (response?.success) {
          return;
        }
        if (response?.permanent) {
          // Refused whenever it is sent: sending it again would only be refused again
          debug('Icon placement report refused', { placement, reason: response.error });
          return;
        }
        notSaved(response?.error ?? 'no answer');
      }, (err: unknown) => {
        // The service worker may be restarting
        notSaved(String(err));
      });
  }

  private readonly handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName !== 'local' || !(ICON_PLACEMENT_REPAIRS_KEY in changes)) {
      return;
    }
    this.changes++;
    const repair = parseIconPlacementRepairs(changes[ICON_PLACEMENT_REPAIRS_KEY]?.newValue)[this.hostname];
    // The service worker no longer counts this tab off the Toolbar (the repair was dropped, as by Clear
    // All Data), or an override waits for a status: this tab's placement is sent again
    if ((!repair && this.sent !== 'toolbar') || (repair && !repair.status)) {
      this.sent = null;
    }
    this.follow(repair);
  };

  /**
   * Takes the Platform's repair as storage holds it now. A tab whose icon is off the Toolbar, or not
   * yet placed, places it again when the pick changed, and that placement is sent; any other tab sends
   * its placement, when not yet sent: a Toolbar from before the repair included.
   */
  private follow(repair: PlatformPlacementRepair | undefined): void {
    this.hasRepair = repair !== undefined;
    const override = repair?.override ?? null;
    const changed = JSON.stringify(override) !== JSON.stringify(this.override);
    this.override = override;
    if (changed && this.placed !== 'toolbar') {
      this.onOverrideChange();
      return;
    }
    // In the Toolbar the chain comes before any pick: the placement stands
    this.reportPlaced();
  }

  /** Sends how the icon was last placed, when it was placed and not yet sent */
  private reportPlaced(): void {
    if (this.placed) {
      this.report(this.placed);
    }
  }

  /**
   * Back from the back/forward cache: the service worker forgot this tab when it left the Platform,
   * and storage may have changed while the page was frozen. The repair is read again, then this
   * tab's placement is sent.
   */
  private readonly handlePageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      this.sendAgain('back/forward cache restore');
    }
  };

  /**
   * A prerendered page the user navigated to: it sent nothing while it was not the tab's page, so its
   * placement is sent now, on the repair read again.
   */
  private readonly handlePrerenderingChange = (): void => {
    this.sendAgain('prerendered page activated');
  };

  private sendAgain(reason: string): void {
    const changesBefore = this.changes;
    readIconPlacementRepairs().then((repairs) => {
      this.sent = null;
      if (this.changes !== changesBefore) {
        // A storage event during the read is newer than the read, and was followed
        this.reportPlaced();
        return;
      }
      this.follow(repairs[this.hostname]);
    }, (err: unknown) => {
      debug('Icon placement repair not read again', { reason, error: String(err) });
    });
  }
}

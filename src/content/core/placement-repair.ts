/**
 * The content script's side of an icon placement repair (src/services/iconPlacementRepairs.ts):
 * keeps the override the user picked for this Platform in memory, follows its changes in
 * storage, finds the element it names, and tells the service worker how the icon was placed.
 *
 * The service worker keeps how each tab last placed the icon, so a Toolbar in one tab does not drop
 * a repair another tab needs. A report is sent when it differs from the last one this tab delivered,
 * so a Platform whose chain resolves and that has no repair costs one storage read per page load and
 * no message. The tab's placement is sent again, whatever it is: at the first placement of a page
 * load while the Platform has a repair; after a report the service worker did not save, unless it
 * refused it for good; when storage drops the Platform's repair, or holds an override with no status
 * (a pick stored after the chain resolved); and when the page comes back from the back/forward cache,
 * since the service worker forgot the tab when it left.
 */

import {
  ICON_PLACEMENT_REPAIRS_KEY,
  type PlacementReport,
  type PlacementReportResponse,
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
  /** The placement the service worker holds for this tab; null when it may hold none, or another */
  private sent: PlacementReport | null = 'toolbar';
  private listening = false;
  private readonly hostname: string;
  private readonly onOverrideChange: () => void;

  /**
   * @param onOverrideChange - Called when the user picks a new element for this Platform, or the
   *   override is dropped elsewhere, so the icon is placed again
   */
  constructor(hostname: string, onOverrideChange: () => void) {
    this.hostname = hostname;
    this.onOverrideChange = onOverrideChange;
  }

  /** The element the user picked for this Platform, if any */
  get positioning(): CustomSitePositioning | null {
    return this.override;
  }

  /** Reads this Platform's repair and follows its changes */
  async load(): Promise<void> {
    const repair = (await readIconPlacementRepairs())[this.hostname];
    this.override = repair?.override ?? null;
    // With a repair, the first placement is reported whatever it is: the service worker counts this tab.
    // Without one, a Toolbar needs no report: the service worker counts no tab's Toolbar for nothing.
    this.sent = repair ? null : 'toolbar';
    if (!this.listening) {
      chrome.storage.onChanged.addListener(this.handleStorageChange);
      window.addEventListener('pageshow', this.handlePageShow);
      this.listening = true;
    }
  }

  /** Stops following storage */
  dispose(): void {
    if (this.listening) {
      chrome.storage.onChanged.removeListener(this.handleStorageChange);
      window.removeEventListener('pageshow', this.handlePageShow);
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
    if (placement === this.sent) {
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
    const repair = parseIconPlacementRepairs(changes[ICON_PLACEMENT_REPAIRS_KEY]?.newValue)[this.hostname];
    // The service worker no longer counts this tab off the Toolbar (the repair was dropped, as by Clear
    // All Data), or an override waits for a status: the next placement says how this tab placed the icon
    if ((!repair && this.sent !== 'toolbar') || (repair && !repair.status)) {
      this.sent = null;
    }
    const override = repair?.override ?? null;
    if (JSON.stringify(override) === JSON.stringify(this.override)) {
      return;
    }
    this.override = override;
    this.onOverrideChange();
  };

  /** Back from the back/forward cache: the service worker forgot this tab when it left the Platform */
  private readonly handlePageShow = (event: PageTransitionEvent): void => {
    if (!event.persisted) {
      return;
    }
    this.sent = null;
    this.onOverrideChange();
  };
}

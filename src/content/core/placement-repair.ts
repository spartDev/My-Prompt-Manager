/**
 * The content script's side of an icon placement repair (src/services/iconPlacementRepairs.ts):
 * keeps the override the user picked for this Platform in memory, follows its changes in
 * storage, finds the element it names, and tells the service worker how the icon was placed.
 *
 * A report is sent only when it differs from what storage holds, so a Platform whose chain
 * resolves costs one storage read per page load and no message.
 */

import {
  ICON_PLACEMENT_REPAIRS_KEY,
  type PlacementReport,
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
  /** How storage says the icon was last placed on this Platform; null when a report was not delivered */
  private stored: PlacementReport | null = 'toolbar';
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
    this.stored = repair?.status ?? 'toolbar';
    if (!this.listening) {
      chrome.storage.onChanged.addListener(this.handleStorageChange);
      this.listening = true;
    }
  }

  /** Stops following storage */
  dispose(): void {
    if (this.listening) {
      chrome.storage.onChanged.removeListener(this.handleStorageChange);
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
   * Tells the service worker how the icon was placed, when storage says otherwise. A placement in
   * the Toolbar drops the override at once here, and is always sent while one is held: storage may
   * hold an override with no status (a pick that came after the chain resolved), which only the
   * service worker's write removes.
   */
  report(placement: PlacementReport): void {
    const dropsOverride = placement === 'toolbar' && this.override !== null;
    if (dropsOverride) {
      info('The anchor chain of this Platform resolves again, the element picked for the icon is dropped', {
        hostname: this.hostname
      });
      this.override = null;
    }
    if (placement === this.stored && !dropsOverride) {
      return;
    }
    this.stored = placement;
    debug('Icon placement reported', { hostname: this.hostname, placement });
    const notSaved = (reason: string) => {
      // The next placement reports again, whatever it is
      if (this.stored === placement) {
        this.stored = null;
      }
      debug('Icon placement report not saved', { placement, reason });
    };
    chrome.runtime.sendMessage({ type: PLACEMENT_REPORT_MESSAGE, data: { placement } })
      .then((response: { success?: boolean; error?: string } | undefined) => {
        if (!response?.success) {
          notSaved(response?.error ?? 'no answer');
        }
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
    this.stored = repair?.status ?? 'toolbar';
    const override = repair?.override ?? null;
    if (JSON.stringify(override) === JSON.stringify(this.override)) {
      return;
    }
    this.override = override;
    this.onOverrideChange();
  };
}

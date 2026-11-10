/**
 * Icon placement controller
 *
 * Owns the lifecycle of the one Library icon the injector places for the editor it found. It
 * remembers which icon belongs to which editor, watches the document for the Platform removing
 * that icon when it re-renders its composer, and asks the injector to place it again. The editor
 * itself usually survives such a re-render, so a detection pass that only compares editors
 * never sees the loss.
 */

import { debug, info } from '../utils/logger';

/**
 * How the icon was placed: in the Platform's toolbar, as an anchored overlay on the editor
 * because the toolbar was not found, or where a custom site's positioning says.
 */
export type PlacementKind = 'toolbar' | 'overlay' | 'custom';

export interface PlacementRecord {
  icon: HTMLElement;
  editor: HTMLElement;
  kind: PlacementKind;
}

/** The attribute the controller writes on the icon, read by tests and by the debug logs */
export const PLACEMENT_ATTRIBUTE = 'data-mpm-placement';

export class IconPlacementController {
  /** Time given to a Platform re-render to settle before the icon is placed again */
  static readonly REPLACE_DELAY_MS = 100;

  private record: PlacementRecord | null = null;
  private observer: MutationObserver | null = null;
  private replaceTimer: number | null = null;
  private readonly onLost: (editor: HTMLElement) => void;

  /**
   * @param onLost - Called once, with the editor, when the Platform removed the icon placed for it
   */
  constructor(onLost: (editor: HTMLElement) => void) {
    this.onLost = onLost;
  }

  /** The icon currently placed, with its editor and how it was placed */
  get current(): PlacementRecord | null {
    return this.record;
  }

  /** Remembers the icon just placed for this editor and watches the document for its removal. */
  track(icon: HTMLElement, editor: HTMLElement, kind: PlacementKind): void {
    this.cancelReplacement();
    this.record = { icon, editor, kind };
    icon.setAttribute(PLACEMENT_ATTRIBUTE, kind);
    this.observe();
    debug('Icon placement tracked', { kind, editorTag: editor.tagName });
  }

  /** True when the icon placed for this editor has left the document: the Platform removed it. */
  isLost(editor: HTMLElement): boolean {
    return this.record !== null && this.record.editor === editor && !this.record.icon.isConnected;
  }

  /** True while a re-placement is scheduled, so a detection pass does not place a second icon. */
  isReplacementPending(): boolean {
    return this.replaceTimer !== null;
  }

  /** Forgets the icon and stops watching; removing the icon itself is the caller's job. */
  reset(): void {
    this.cancelReplacement();
    this.record = null;
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private observe(): void {
    if (this.observer) {
      return;
    }
    this.observer = new MutationObserver(() => {
      this.check();
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Runs on every batch of DOM changes: one property read while the icon is in place. When the
   * icon is gone, one re-placement is scheduled; the record is dropped when it fires, so a
   * placement that fails does not schedule another on the next change.
   */
  private check(): void {
    const record = this.record;
    if (!record || record.icon.isConnected || this.replaceTimer !== null) {
      return;
    }
    this.replaceTimer = window.setTimeout(() => {
      this.replaceTimer = null;
      const lost = this.record;
      if (!lost || lost.icon.isConnected) {
        return;
      }
      this.record = null;
      info('Library icon removed by the Platform, placing it again', {
        kind: lost.kind,
        editorTag: lost.editor.tagName,
        editorConnected: lost.editor.isConnected
      });
      this.onLost(lost.editor);
    }, IconPlacementController.REPLACE_DELAY_MS);
  }

  private cancelReplacement(): void {
    if (this.replaceTimer !== null) {
      window.clearTimeout(this.replaceTimer);
      this.replaceTimer = null;
    }
  }
}

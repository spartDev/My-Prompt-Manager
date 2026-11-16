/**
 * Icon placement controller
 *
 * Owns the lifecycle of the one Library icon the injector places for the editor it found. It
 * remembers which icon belongs to which editor, watches the document for the Platform removing
 * that icon when it re-renders its composer, and asks the injector to place it again. The editor
 * itself usually survives such a re-render, so a detection pass that only compares editors
 * never sees the loss. While the icon is away from where it belongs (on the Anchored overlay, at
 * the element the user picked, or at a later anchor while the picked element is missing), it also
 * waits for that place, which a Platform may render after its editor, and asks for the icon to be
 * placed again if it shows within a grace period (awaitToolbar); an icon on the overlay goes on
 * looking for its toolbar after that, at a slower pace (keepWatching).
 */

import type { IconPlacement } from '../../config/platforms';
import { debug, info } from '../utils/logger';

/**
 * How the icon was placed: in the Platform's toolbar, as an anchored overlay on the editor
 * because the toolbar was not found, at the element the user picked for the Platform while the
 * chain's first anchor is not found (an override), or where a custom site's positioning says.
 */
export type PlacementKind = 'toolbar' | 'overlay' | 'override' | 'custom';

export interface PlacementRecord {
  icon: HTMLElement;
  editor: HTMLElement;
  kind: PlacementKind;
  /** The anchor of the chain the icon was placed at, for a Toolbar placement */
  anchorIndex?: number;
}

/** The attribute the controller writes on the icon, read by tests and by the debug logs */
export const PLACEMENT_ATTRIBUTE = 'data-mpm-placement';

/** Which anchor of the Platform's chain the icon was placed at: 0 unless the composer changed */
export const ANCHOR_ATTRIBUTE = 'data-mpm-anchor';

export class IconPlacementController {
  /** Time given to a Platform re-render to settle before the icon is placed again */
  static readonly REPLACE_DELAY_MS = 100;

  /**
   * Time a Platform is given to render its toolbar after its editor before the icon left on the
   * Anchored overlay is taken as a sign the toolbar changed. Copilot at copilot.cloud.microsoft
   * renders its editor first, its toolbar buttons later (live check, 2026-11-15)
   */
  static readonly TOOLBAR_GRACE_MS = 5000;

  /**
   * After the grace period, how often at most an icon left on the Anchored overlay looks for its
   * toolbar again (keepWatching): a page that changes all the time, a reply being written, costs a
   * look a second. Copilot at copilot.cloud.microsoft, on a loaded machine, showed a composer
   * without its toolbar first, and the one with it 44 s later (live check, 2026-11-16)
   */
  static readonly LATE_TOOLBAR_CHECK_MS = 1000;

  private record: PlacementRecord | null = null;
  private observer: MutationObserver | null = null;
  private replaceTimer: number | null = null;
  /** While the icon waits for where it belongs: whether that place is now found */
  private toolbarFound: ((settled: boolean) => boolean) | null = null;
  private toolbarTimer: number | null = null;
  /** The grace period is over and the icon still looks for its toolbar (keepWatching) */
  private watchingLate = false;
  private graceTimer: number | null = null;
  private readonly onLost: (editor: HTMLElement) => void;

  /**
   * @param onLost - Called once, with the editor, when the Platform removed the icon placed for
   *   it, or when the toolbar the icon waited for (awaitToolbar) is found: either way the icon is
   *   placed again for that editor
   */
  constructor(onLost: (editor: HTMLElement) => void) {
    this.onLost = onLost;
  }

  /** The icon currently placed, with its editor and how it was placed */
  get current(): PlacementRecord | null {
    return this.record;
  }

  /** Remembers the icon just placed for this editor and watches the document for its removal. */
  track(icon: HTMLElement, editor: HTMLElement, kind: PlacementKind, anchorIndex?: number): void {
    this.cancelReplacement();
    this.stopAwaitingToolbar();
    this.record = { icon, editor, kind, anchorIndex };
    icon.setAttribute(PLACEMENT_ATTRIBUTE, kind);
    if (anchorIndex === undefined) {
      icon.removeAttribute(ANCHOR_ATTRIBUTE);
    } else {
      icon.setAttribute(ANCHOR_ATTRIBUTE, String(anchorIndex));
    }
    this.observe();
    debug('Icon placement tracked', { kind, anchorIndex, editorTag: editor.tagName });
  }

  /**
   * Called right after an icon is tracked away from where it belongs (on the Anchored overlay, at
   * the element the user picked, or at a later anchor of the chain while the picked element is
   * missing), for TOOLBAR_GRACE_MS: a Platform may render its toolbar, or the picked element, after
   * its editor. During that time, on each settled batch of DOM changes `found(false)` is read, and
   * once it is true the icon is placed again, at its anchor. At its end `found(true)` is read once
   * more, the page now settled, then the wait stops, as before it the icon was placed once:
   * `onKept`, if given, runs when it is still false: only then is the overlay reported, or the
   * pick whose element never showed dropped. The caller says what counts as found (for an icon at
   * a pick, only the chain's first anchor). The grace period starts again with each placement of the
   * icon. With `keepWatching`, the wait goes on after that, for what it says is found, read on the
   * settled changes at most every LATE_TOOLBAR_CHECK_MS, until the icon is placed again or forgotten
   * (reset). It is to be cheap: it runs for as long as the page does. An editor out of the page
   * for a moment is not watched meanwhile, and is again once it is back.
   */
  awaitToolbar(found: (settled: boolean) => boolean, onKept?: () => void, { keepWatching }: { keepWatching?: () => boolean } = {}): void {
    const record = this.record;
    if (!record) {
      return;
    }
    this.toolbarFound = found;
    const endOfGrace = (): void => {
      this.graceTimer = null;
      // Each change of the record stops the wait, so the record is this one. An editor that left
      // the page says nothing of the toolbar: the detection pass takes over
      if (!record.editor.isConnected) {
        this.stopAwaitingToolbar();
        return;
      }
      // The icon is out of the page for a moment: lost, it is placed again with a grace period of
      // its own; back, this one ends then
      if (!record.icon.isConnected) {
        this.graceTimer = window.setTimeout(endOfGrace, IconPlacementController.REPLACE_DELAY_MS);
        return;
      }
      if (found(true)) {
        this.moveIntoToolbar(record);
        return;
      }
      this.stopAwaitingToolbar();
      onKept?.();
      if (keepWatching && this.record === record) {
        this.toolbarFound = keepWatching;
        this.watchingLate = true;
      }
    };
    this.graceTimer = window.setTimeout(endOfGrace, IconPlacementController.TOOLBAR_GRACE_MS);
    // A toolbar rendered while the icon was being placed (Floating UI loading) made no change
    // this controller saw: it is looked for once now
    this.checkToolbar(record);
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
    this.stopAwaitingToolbar();
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
   * placement that fails does not schedule another on the next change. While the icon waits for
   * its toolbar, the toolbar is looked for once the changes settle.
   */
  private check(): void {
    const record = this.record;
    if (!record || this.replaceTimer !== null) {
      return;
    }
    if (record.icon.isConnected) {
      this.checkToolbar(record);
      return;
    }
    this.replaceTimer = window.setTimeout(() => {
      this.replaceTimer = null;
      const lost = this.record;
      if (!lost || lost.icon.isConnected) {
        // Back in the page: the wait for the toolbar, if any, goes on, from a look at the page as
        // it now is (the changes of the last moment were not looked at)
        if (lost) {
          this.checkToolbar(lost);
        }
        return;
      }
      this.stopAwaitingToolbar();
      this.record = null;
      info('Library icon removed by the Platform, placing it again', {
        kind: lost.kind,
        editorTag: lost.editor.tagName,
        editorConnected: lost.editor.isConnected
      });
      this.onLost(lost.editor);
    }, IconPlacementController.REPLACE_DELAY_MS);
  }

  /** Looks for the toolbar the icon waits for, once the batch of changes that may hold it settles */
  private checkToolbar(record: PlacementRecord): void {
    if (this.toolbarFound === null || this.toolbarTimer !== null) {
      return;
    }
    this.toolbarTimer = window.setTimeout(() => {
      this.toolbarTimer = null;
      // Each change of the record stops the wait, so the record is this one. An icon out of the
      // page is the loss check's to place again; an editor that left the page says nothing of
      // its toolbar
      const found = this.toolbarFound;
      if (found === null || !record.icon.isConnected || !record.editor.isConnected || !found(false)) {
        return;
      }
      this.moveIntoToolbar(record);
    }, this.watchingLate ? IconPlacementController.LATE_TOOLBAR_CHECK_MS : IconPlacementController.REPLACE_DELAY_MS);
  }

  /** The toolbar the icon waited for is found: the icon is placed again, into it */
  private moveIntoToolbar(record: PlacementRecord): void {
    this.stopAwaitingToolbar();
    this.record = null;
    info('What the icon waited for showed, it is placed again', { kind: record.kind });
    this.onLost(record.editor);
  }

  private stopAwaitingToolbar(): void {
    this.toolbarFound = null;
    this.watchingLate = false;
    for (const timer of [this.toolbarTimer, this.graceTimer]) {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    }
    this.toolbarTimer = null;
    this.graceTimer = null;
  }

  private cancelReplacement(): void {
    if (this.replaceTimer !== null) {
      window.clearTimeout(this.replaceTimer);
      this.replaceTimer = null;
    }
  }
}

/** The anchor a placement chain resolved to, and where the icon goes against it */
export interface PlacementResolution {
  /** Position of the anchor in the chain: 0 is the one the chain was written for */
  index: number;
  anchor: HTMLElement;
  relation: IconPlacement['anchors'][number]['relation'];
}

/**
 * Finds where the icon goes for this editor: the first anchor of the chain found inside the
 * editor's composer. Null when there is no chain, no composer around the editor, or no anchor in
 * it: the icon is then anchored on the editor itself.
 */
export function resolveIconPlacement(editor: HTMLElement, placement: IconPlacement | undefined): PlacementResolution | null {
  if (!placement) {
    return null;
  }
  const composer = editor.closest<HTMLElement>(placement.composer);
  if (!composer) {
    return null;
  }
  for (const [index, { find, relation }] of placement.anchors.entries()) {
    const anchor = composer.querySelector<HTMLElement>(find);
    if (anchor) {
      return { index, anchor, relation };
    }
  }
  return null;
}

/** Puts the icon against the anchor its chain resolved to */
export function placeAtAnchor(icon: HTMLElement, { anchor, relation }: PlacementResolution): void {
  switch (relation) {
    case 'before':
      anchor.before(icon);
      break;
    case 'after':
      anchor.after(icon);
      break;
    case 'inside-start':
      anchor.prepend(icon);
      break;
    case 'inside-end':
      anchor.append(icon);
      break;
  }
}

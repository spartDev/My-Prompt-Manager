/**
 * Anchored overlay
 *
 * Places the Library icon as a fixed overlay that follows a reference element: the editor of a
 * built-in Platform whose toolbar was not found, or the element a custom site's positioning names.
 * Two tiers, tried in order:
 *   0. CSS Anchor Positioning (Chrome 125+): the browser keeps the icon on its anchor, no script.
 *   1. Floating UI, lazy-loaded: computePosition, then autoUpdate on scroll, resize and layout.
 * Both append the icon to document.body and mark it with data-positioning-method, which the
 * injector's cleanup reads; release() stops a Floating UI subscription.
 */

import { DOMUtils } from '../utils/dom';
import { debug, error, info, warn } from '../utils/logger';

/**
 * Where the icon goes relative to its reference. The first four are a custom site's choices;
 * inside-bottom-end is the built-in Platforms' fallback: inside the editor, in its bottom-end
 * corner, INSIDE_CORNER_INSET from both edges.
 */
export type OverlayPlacement = 'before' | 'after' | 'inside-start' | 'inside-end' | 'inside-bottom-end';

export interface OverlayOptions {
  placement: OverlayPlacement;
  /** For inside-bottom-end, the inset from the end and bottom edges; otherwise a shift of the icon */
  offset?: { x: number; y: number };
  zIndex?: number;
  /** A custom site's tracking id for the reference element, kept on data-mpm-anchor */
  anchorId?: string;
}

export type OverlayMethod = 'css-anchor' | 'floating-ui';

/** The icon's distance to the editor's end and bottom edges when it is the built-in fallback */
export const INSIDE_CORNER_INSET = 6;

const DEFAULT_Z_INDEX = 999999;
/** Floating UI keeps the icon this far from the viewport's edges */
const VIEWPORT_PADDING = 8;

/** position-area cell of each placement; inside-bottom-end is the anchor's own cell, aligned to its end */
const POSITION_AREA: Record<OverlayPlacement, string> = {
  before: 'left',
  after: 'right',
  'inside-start': 'top',
  'inside-end': 'bottom',
  'inside-bottom-end': 'center'
};

type FloatingPlacement = 'left' | 'right' | 'top-start' | 'bottom-end';

const FLOATING_PLACEMENT: Record<OverlayPlacement, FloatingPlacement> = {
  before: 'left',
  after: 'right',
  'inside-start': 'top-start',
  'inside-end': 'bottom-end',
  'inside-bottom-end': 'bottom-end'
};

const describe = (element: HTMLElement): Record<string, string> => ({
  tag: element.tagName,
  id: element.id,
  class: element.className
});

export class AnchoredOverlay {
  /** Floating UI autoUpdate subscriptions, by icon; a WeakMap, so a removed icon frees its entry */
  private readonly cleanups = new WeakMap<HTMLElement, () => void>();

  /**
   * Places the icon on its reference, CSS Anchor first, Floating UI second.
   * @returns the tier that placed it, or null when neither could
   */
  async place(icon: HTMLElement, reference: HTMLElement, options: OverlayOptions): Promise<OverlayMethod | null> {
    if (this.placeWithCSSAnchor(icon, reference, options)) {
      return 'css-anchor';
    }
    if (await this.placeWithFloatingUI(icon, reference, options)) {
      return 'floating-ui';
    }
    return null;
  }

  /**
   * Tier 0: CSS Anchor Positioning. The reference becomes a named anchor, the icon a fixed box
   * whose position-area is the cell POSITION_AREA names; the browser moves it with the anchor.
   */
  placeWithCSSAnchor(icon: HTMLElement, reference: HTMLElement, options: OverlayOptions): boolean {
    try {
      if (!DOMUtils.supportsCSSAnchorPositioning()) {
        debug('CSS Anchor Positioning not supported, falling back to other methods');
        return false;
      }

      const { placement, zIndex = DEFAULT_Z_INDEX, anchorId } = options;
      const positionArea = POSITION_AREA[placement] as string | undefined;
      if (!positionArea) {
        warn('Invalid placement for CSS Anchor positioning', { placement });
        return false;
      }

      // Keep an existing tracking id on the reference, else the configured one, else a fresh one
      const existingAnchorId = reference.getAttribute('data-mpm-anchor');
      const trackingAnchorId = existingAnchorId ?? anchorId ?? `mpm-${String(Date.now())}-${Math.random().toString(36).substring(2, 9)}`;
      const cssAnchorName = `--mpm-anchor-${String(Date.now())}-${Math.random().toString(36).substring(2, 9)}`;

      reference.style.anchorName = cssAnchorName;
      if (!existingAnchorId) {
        reference.setAttribute('data-mpm-anchor', trackingAnchorId);
      }
      // The injector's cleanup clears the anchor name through this attribute
      reference.setAttribute('data-mpm-anchor-name', cssAnchorName);

      icon.style.position = 'fixed';
      icon.style.positionAnchor = cssAnchorName;
      icon.style.positionArea = positionArea;
      icon.style.zIndex = String(zIndex);

      if (placement === 'inside-bottom-end') {
        // The center cell is the anchor's own box: align the icon to its end and bottom, inset by margins
        const inset = options.offset ?? { x: INSIDE_CORNER_INSET, y: INSIDE_CORNER_INSET };
        icon.style.justifySelf = 'end';
        icon.style.alignSelf = 'end';
        icon.style.marginRight = `${String(inset.x)}px`;
        icon.style.marginBottom = `${String(inset.y)}px`;
      } else {
        const offset = options.offset ?? { x: 0, y: 0 };
        if (offset.x !== 0 || offset.y !== 0) {
          icon.style.marginLeft = `${String(offset.x)}px`;
          icon.style.marginTop = `${String(offset.y)}px`;
        }
      }

      if (!icon.parentNode) {
        document.body.appendChild(icon);
      }
      icon.setAttribute('data-positioning-method', 'css-anchor');

      debug('CSS Anchor positioning applied (Tier 0)', {
        placement,
        positionArea,
        zIndex,
        anchorId: trackingAnchorId,
        cssAnchorName,
        referenceElement: describe(reference)
      });
      info('[Telemetry] Positioning method used', {
        method: 'css-anchor',
        tier: 0,
        success: true,
        placement,
        referenceType: reference.tagName.toLowerCase(),
        url: window.location.hostname
      });
      return true;
    } catch (err) {
      error('Failed to apply CSS Anchor positioning', err instanceof Error ? err : null, {
        errorMessage: err instanceof Error ? err.message : String(err),
        referenceElement: describe(reference),
        icon: { isConnected: icon.isConnected }
      });
      return false;
    }
  }

  /**
   * Tier 1: Floating UI, imported only here so Chrome 125+ never loads it. computePosition with
   * the fixed strategy, shift to stay in the viewport, hide with the reference; autoUpdate
   * follows scroll, resize and layout. For inside-bottom-end the offset pulls the icon back
   * inside the reference by its own height plus the inset.
   */
  async placeWithFloatingUI(icon: HTMLElement, reference: HTMLElement, options: OverlayOptions): Promise<boolean> {
    try {
      debug('Lazy loading Floating UI', { reason: 'CSS Anchor Positioning unavailable or declined' });
      const { computePosition, flip, shift, offset: floatingOffset, hide, autoUpdate } = await import('@floating-ui/dom');

      const { placement, zIndex = DEFAULT_Z_INDEX } = options;
      const floatingPlacement = FLOATING_PLACEMENT[placement] as FloatingPlacement | undefined;
      if (!floatingPlacement) {
        warn('Invalid placement for Floating UI positioning', { placement });
        return false;
      }

      // Floating UI measures the icon, so it is in the document before the first computation
      if (!icon.parentNode) {
        document.body.appendChild(icon);
      }

      if (!document.body.contains(reference)) {
        warn('Reference element not in DOM', describe(reference));
        return false;
      }
      const referenceRect = reference.getBoundingClientRect();
      if (referenceRect.width === 0 && referenceRect.height === 0) {
        warn('Reference element has no dimensions', describe(reference));
        return false;
      }

      const insideCorner = placement === 'inside-bottom-end';
      const inset = options.offset ?? { x: INSIDE_CORNER_INSET, y: INSIDE_CORNER_INSET };
      const offset = options.offset ?? { x: 0, y: 0 };
      // For left/right placements the main axis is horizontal; for top/bottom ones, vertical
      const horizontal = floatingPlacement === 'left' || floatingPlacement === 'right';

      const middleware = insideCorner
        ? [
            // bottom-end puts the icon below the reference, flush with its end edge: pull it up by its own
            // height plus the inset, and in from the end edge by the inset (alignmentAxis moves away from
            // the aligned edge)
            floatingOffset(({ rects }) => ({ mainAxis: -(rects.floating.height + inset.y), alignmentAxis: inset.x })),
            shift({ padding: VIEWPORT_PADDING }),
            hide({ strategy: 'referenceHidden' })
          ]
        : [
            floatingOffset({
              mainAxis: horizontal ? offset.x : offset.y,
              crossAxis: horizontal ? offset.y : offset.x
            }),
            flip({ fallbackPlacements: ['top', 'bottom', 'left', 'right'], padding: VIEWPORT_PADDING }),
            shift({ padding: VIEWPORT_PADDING }),
            hide({ strategy: 'referenceHidden' })
          ];

      const updatePosition = async (): Promise<boolean> => {
        try {
          const { x, y, middlewareData, placement: finalPlacement } = await computePosition(reference, icon, {
            strategy: 'fixed',
            placement: floatingPlacement,
            middleware
          });
          Object.assign(icon.style, {
            position: 'fixed',
            left: `${String(x)}px`,
            top: `${String(y)}px`,
            zIndex: String(zIndex),
            visibility: middlewareData.hide?.referenceHidden ? 'hidden' : 'visible'
          });
          debug('Floating UI position updated', { x, y, finalPlacement, isHidden: middlewareData.hide?.referenceHidden });
          return true;
        } catch (updateErr) {
          warn('Failed to update Floating UI position', {
            errorMessage: updateErr instanceof Error ? updateErr.message : String(updateErr)
          });
          return false;
        }
      };

      // A first computation that fails would fail on every update too: let the caller fall back
      if (!(await updatePosition())) {
        return false;
      }
      const cleanup = autoUpdate(reference, icon, () => void updatePosition(), { animationFrame: true });
      this.cleanups.set(icon, cleanup);
      icon.setAttribute('data-positioning-method', 'floating-ui');

      debug('Floating UI positioning applied (Tier 1)', {
        placement: floatingPlacement,
        zIndex,
        referenceElement: describe(reference)
      });
      info('[Telemetry] Positioning method used', {
        method: 'floating-ui',
        tier: 1,
        success: true,
        placement: floatingPlacement,
        referenceType: reference.tagName.toLowerCase(),
        url: window.location.hostname
      });
      return true;
    } catch (err) {
      error('Failed to apply Floating UI positioning', err instanceof Error ? err : null, {
        errorMessage: err instanceof Error ? err.message : String(err),
        referenceElement: describe(reference),
        icon: { isConnected: icon.isConnected }
      });
      return false;
    }
  }

  /**
   * Stops following the reference for an icon Floating UI placed.
   * @returns true when a subscription was stopped
   */
  release(icon: HTMLElement): boolean {
    const cleanup = this.cleanups.get(icon);
    if (!cleanup) {
      return false;
    }
    cleanup();
    this.cleanups.delete(icon);
    return true;
  }
}

/**
 * Unit tests for AnchoredOverlay: the two tiers that keep the icon on its reference element,
 * and the inside-bottom-end placement the built-in Platforms fall back to.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnchoredOverlay, INSIDE_CORNER_INSET } from '../anchored-overlay';

vi.mock('../../utils/logger', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}));

const supportsCSSAnchor = vi.fn<() => boolean>();
vi.mock('../../utils/dom', () => ({
  DOMUtils: {
    supportsCSSAnchorPositioning: () => supportsCSSAnchor()
  }
}));

type MiddlewareCall = { name: string; options: unknown };
type ComputedPosition = { x: number; y: number; placement: string; middlewareData: { hide?: { referenceHidden?: boolean } } };
const { computePosition, autoUpdateCleanup, autoUpdate, offset, flip, shift, hide } = vi.hoisted(() => {
  const autoUpdateCleanup = vi.fn();
  return {
    computePosition: vi.fn<(reference: Element, floating: HTMLElement, options: unknown) => Promise<ComputedPosition>>(),
    autoUpdateCleanup,
    autoUpdate: vi.fn<(reference: Element, floating: HTMLElement, update: () => void, options: unknown) => () => void>(() => autoUpdateCleanup),
    offset: vi.fn((options: unknown): MiddlewareCall => ({ name: 'offset', options })),
    flip: vi.fn((options: unknown): MiddlewareCall => ({ name: 'flip', options })),
    shift: vi.fn((options: unknown): MiddlewareCall => ({ name: 'shift', options })),
    hide: vi.fn((options: unknown): MiddlewareCall => ({ name: 'hide', options }))
  };
});
vi.mock('@floating-ui/dom', () => ({ computePosition, autoUpdate, offset, flip, shift, hide }));

const sized = (element: HTMLElement, width: number, height: number): void => {
  element.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height, toJSON: () => ({}) }) as DOMRect;
};

describe('AnchoredOverlay', () => {
  let overlay: AnchoredOverlay;
  let icon: HTMLElement;
  let reference: HTMLElement;

  beforeEach(() => {
    overlay = new AnchoredOverlay();
    icon = document.createElement('button');
    reference = document.createElement('div');
    sized(reference, 480, 120);
    document.body.appendChild(reference);
    supportsCSSAnchor.mockReturnValue(true);
    computePosition.mockResolvedValue({ x: 10, y: 20, placement: 'bottom-end', middlewareData: {} });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('CSS Anchor Positioning (tier 0)', () => {
    it('declines when the browser has no CSS Anchor Positioning', () => {
      supportsCSSAnchor.mockReturnValue(false);

      expect(overlay.placeWithCSSAnchor(icon, reference, { placement: 'inside-bottom-end' })).toBe(false);
      expect(icon.isConnected).toBe(false);
    });

    it('anchors the icon inside the reference, bottom-end, inset by INSIDE_CORNER_INSET', () => {
      expect(overlay.placeWithCSSAnchor(icon, reference, { placement: 'inside-bottom-end' })).toBe(true);

      expect(reference.style.anchorName).toMatch(/^--mpm-anchor-/);
      expect(reference.getAttribute('data-mpm-anchor-name')).toBe(reference.style.anchorName);
      expect(reference.getAttribute('data-mpm-anchor')).toMatch(/^mpm-/);
      expect(icon.style.position).toBe('fixed');
      expect(icon.style.positionAnchor).toBe(reference.style.anchorName);
      expect(icon.style.positionArea).toBe('center');
      expect(icon.style.justifySelf).toBe('end');
      expect(icon.style.alignSelf).toBe('end');
      expect(icon.style.marginRight).toBe(`${String(INSIDE_CORNER_INSET)}px`);
      expect(icon.style.marginBottom).toBe(`${String(INSIDE_CORNER_INSET)}px`);
      expect(icon.parentNode).toBe(document.body);
      expect(icon.getAttribute('data-positioning-method')).toBe('css-anchor');
    });

    it("maps a custom site's placement to a position-area cell and its offset to margins", () => {
      reference.setAttribute('data-mpm-anchor', 'kept-id');

      expect(
        overlay.placeWithCSSAnchor(icon, reference, { placement: 'after', offset: { x: 4, y: -2 }, zIndex: 42, anchorId: 'ignored' })
      ).toBe(true);

      expect(icon.style.positionArea).toBe('right');
      expect(icon.style.marginLeft).toBe('4px');
      expect(icon.style.marginTop).toBe('-2px');
      expect(icon.style.zIndex).toBe('42');
      expect(reference.getAttribute('data-mpm-anchor')).toBe('kept-id');
    });

    it('does not append the icon a second time when it is already in the document', () => {
      const holder = document.createElement('div');
      holder.appendChild(icon);
      document.body.appendChild(holder);

      overlay.placeWithCSSAnchor(icon, reference, { placement: 'inside-bottom-end' });

      expect(icon.parentNode).toBe(holder);
    });
  });

  describe('Floating UI (tier 1)', () => {
    beforeEach(() => {
      supportsCSSAnchor.mockReturnValue(false);
    });

    it('computes a fixed position on the reference and follows it with autoUpdate', async () => {
      await expect(overlay.placeWithFloatingUI(icon, reference, { placement: 'inside-bottom-end' })).resolves.toBe(true);

      expect(computePosition).toHaveBeenCalledWith(
        reference,
        icon,
        expect.objectContaining({ strategy: 'fixed', placement: 'bottom-end' })
      );
      expect(icon.style.position).toBe('fixed');
      expect(icon.style.left).toBe('10px');
      expect(icon.style.top).toBe('20px');
      expect(icon.style.visibility).toBe('visible');
      expect(icon.parentNode).toBe(document.body);
      expect(icon.getAttribute('data-positioning-method')).toBe('floating-ui');
      expect(autoUpdate).toHaveBeenCalledWith(reference, icon, expect.any(Function), { animationFrame: true });
    });

    it('pulls the icon back inside the reference by its own height plus the inset, and does not flip', async () => {
      await overlay.placeWithFloatingUI(icon, reference, { placement: 'inside-bottom-end' });

      const offsetFn = offset.mock.calls[0]?.[0] as (state: { rects: { floating: { height: number } } }) => { mainAxis: number; alignmentAxis: number };
      expect(typeof offsetFn).toBe('function');
      expect(offsetFn({ rects: { floating: { height: 32 } } })).toEqual({
        mainAxis: -(32 + INSIDE_CORNER_INSET),
        alignmentAxis: INSIDE_CORNER_INSET
      });
      expect(flip).not.toHaveBeenCalled();
      expect(shift).toHaveBeenCalledWith({ padding: 8 });
      expect(hide).toHaveBeenCalledWith({ strategy: 'referenceHidden' });
    });

    it("maps a custom site's placement and offset to the main and cross axes, with flip", async () => {
      await overlay.placeWithFloatingUI(icon, reference, { placement: 'inside-start', offset: { x: 3, y: 7 } });

      expect(computePosition).toHaveBeenCalledWith(reference, icon, expect.objectContaining({ placement: 'top-start' }));
      // top-start runs on the vertical axis: y is the main axis, x the cross axis
      expect(offset).toHaveBeenCalledWith({ mainAxis: 7, crossAxis: 3 });
      expect(flip).toHaveBeenCalled();
    });

    it('hides the icon while the reference is scrolled out of view', async () => {
      computePosition.mockResolvedValue({ x: 1, y: 2, placement: 'bottom-end', middlewareData: { hide: { referenceHidden: true } } });

      await overlay.placeWithFloatingUI(icon, reference, { placement: 'inside-bottom-end' });

      expect(icon.style.visibility).toBe('hidden');
    });

    it('declines a reference that is not in the document or has no size', async () => {
      const detached = document.createElement('div');
      sized(detached, 100, 100);
      await expect(overlay.placeWithFloatingUI(icon, detached, { placement: 'after' })).resolves.toBe(false);

      const flat = document.createElement('div');
      document.body.appendChild(flat);
      await expect(overlay.placeWithFloatingUI(icon, flat, { placement: 'after' })).resolves.toBe(false);

      expect(computePosition).not.toHaveBeenCalled();
    });

    it('release() stops the autoUpdate subscription once', async () => {
      await overlay.placeWithFloatingUI(icon, reference, { placement: 'inside-bottom-end' });

      expect(overlay.release(icon)).toBe(true);
      expect(autoUpdateCleanup).toHaveBeenCalledTimes(1);
      expect(overlay.release(icon)).toBe(false);
      expect(autoUpdateCleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('place()', () => {
    it('uses CSS Anchor when the browser has it, and never loads Floating UI', async () => {
      await expect(overlay.place(icon, reference, { placement: 'inside-bottom-end' })).resolves.toBe('css-anchor');
      expect(computePosition).not.toHaveBeenCalled();
    });

    it('falls back to Floating UI without CSS Anchor', async () => {
      supportsCSSAnchor.mockReturnValue(false);
      await expect(overlay.place(icon, reference, { placement: 'inside-bottom-end' })).resolves.toBe('floating-ui');
    });

    it('returns null when neither tier could place the icon', async () => {
      supportsCSSAnchor.mockReturnValue(false);
      computePosition.mockRejectedValue(new Error('no layout'));
      await expect(overlay.place(icon, reference, { placement: 'inside-bottom-end' })).resolves.toBeNull();
    });
  });
});

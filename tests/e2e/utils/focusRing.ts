/**
 * A focus ring as it is drawn (My-Prompt-Manager-ojz.17): its box, from the element's computed
 * outline, and its four sides read back from the pixels of a screenshot. A ring under a fade, cut by
 * a scroll box or not drawn at all shows the surface behind it there instead of its own color, so a
 * side is whole only when, at every sample along it, the ring's full width has its color: both pixels
 * of a 2px ring, not one.
 */

import type { Locator, Page } from '@playwright/test';

/** How far, in RGB, a pixel may be from the ring's color and still count as the ring */
export const RING_TOLERANCE = 48;

export interface FocusRing {
  /** The outline's color as Chrome computes it, "rgb(r, g, b)" */
  color: string;
  /** "none" when no ring is drawn (`:focus-visible` false for a ring drawn on it) */
  style: string;
  width: number;
  /** How far the ring reaches past the element's border box: its offset plus its width */
  reach: number;
  /** The radius of the ring's corners: the element's own, plus the reach */
  radius: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The ring of `locator`'s element, in viewport pixels. `expected` gives the width and offset a ring
 * drawn there would have, for an element that draws none (`outline-style: none` computes its width to 0)
 */
export const focusRingOf = (locator: Locator, expected?: { width: number; offset: number }): Promise<FocusRing> =>
  locator.evaluate((element, fallback) => {
    const style = getComputedStyle(element);
    const width = style.outlineStyle === 'none' && fallback ? fallback.width : parseFloat(style.outlineWidth) || 0;
    const offset = style.outlineStyle === 'none' && fallback ? fallback.offset : parseFloat(style.outlineOffset) || 0;
    const box = element.getBoundingClientRect();
    const reach = width + offset;
    // A rounded-full element computes a huge radius: its corners are at most half its box
    const radius = Math.min(parseFloat(style.borderTopLeftRadius) || 0, box.width / 2, box.height / 2) + reach;
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width,
      reach,
      radius,
      left: box.left - reach,
      top: box.top - reach,
      right: box.right + reach,
      bottom: box.bottom + reach
    };
  }, expected);

export interface RingSide {
  side: 'top' | 'right' | 'bottom' | 'left';
  /** How many points along the side's straight part were read */
  samples: number;
  /**
   * The farthest any point is from a ring drawn whole there, across the ring's full width (the
   * farther of its pixels): the side is whole when this is within RING_TOLERANCE
   */
  worst: number;
  /** The nearest any pixel of the side's band is: no ring is drawn on the side when even this is beyond RING_TOLERANCE */
  best: number;
}

const rgbOf = (color: string): [number, number, number] => {
  const parts = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  if (!parts) {
    throw new Error(`Not an rgb() color: ${color}`);
  }
  return [Number(parts[1]), Number(parts[2]), Number(parts[3])];
};

/** A piece of the page as drawn, in CSS pixels: how far the pixel at a viewport point is from a color */
export interface Pixels {
  /** Infinity for a point outside the piece read */
  distance: (x: number, y: number, color: string) => number;
}

/** Reads the pixels of the page within `clip` (viewport CSS pixels) from a screenshot */
export const pixelsOf = async (page: Page, clip: { x: number; y: number; width: number; height: number }): Promise<Pixels> => {
  const box = { x: Math.max(0, Math.floor(clip.x)), y: Math.max(0, Math.floor(clip.y)) };
  const area = { ...box, width: Math.ceil(clip.x + clip.width) - box.x, height: Math.ceil(clip.y + clip.height) - box.y };
  // Not animations: 'disabled', which would cancel the scroll-driven animations that draw a fade
  const png = await page.screenshot({ clip: area, scale: 'css' });
  const image = await page.evaluate(async (base64) => {
    const picture = new Image();
    picture.src = `data:image/png;base64,${base64}`;
    await picture.decode();
    const canvas = new OffscreenCanvas(picture.naturalWidth, picture.naturalHeight);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No 2d context to read the screenshot');
    }
    context.drawImage(picture, 0, 0);
    return { width: picture.naturalWidth, height: picture.naturalHeight, data: [...context.getImageData(0, 0, picture.naturalWidth, picture.naturalHeight).data] };
  }, png.toString('base64'));
  return {
    distance: (x, y, color) => {
      const column = Math.floor(x) - area.x;
      const row = Math.floor(y) - area.y;
      if (column < 0 || row < 0 || column >= image.width || row >= image.height) {
        return Infinity;
      }
      const [red, green, blue] = rgbOf(color);
      const index = (row * image.width + column) * 4;
      return Math.hypot(image.data[index] - red, image.data[index + 1] - green, image.data[index + 2] - blue);
    }
  };
};

/** Points along a straight part, from `from` to `to`, about every 3px; its middle when it has no length */
const along = (from: number, to: number): number[] => {
  if (to - from < 1) {
    return [(from + to) / 2];
  }
  const count = Math.max(2, Math.ceil((to - from) / 3));
  return Array.from({ length: count + 1 }, (_, index) => from + ((to - from) * index) / count);
};

/**
 * Reads the four sides of `ring` from a screenshot of the page, at points along each side's straight
 * part (between its rounded corners). Chrome draws the ring on whole pixels: a band that starts
 * between two pixels covers `width` + 1 of them, and the ring is drawn on `width` adjacent ones among
 * them. At a point, the ring is whole when one such run of `width` pixels all have its color
 */
export const ringSides = async (page: Page, ring: FocusRing): Promise<RingSide[]> => {
  const pixels = await pixelsOf(page, { x: ring.left, y: ring.top, width: ring.right - ring.left, height: ring.bottom - ring.top });
  const distanceAt = (x: number, y: number): number => pixels.distance(x, y, ring.color);
  // The pixels a band of the ring's width covers, from `start`
  const band = (start: number): number[] => {
    const covered: number[] = [];
    for (let pixel = Math.floor(start); pixel < Math.ceil(start + ring.width); pixel++) {
      covered.push(pixel + 0.5);
    }
    return covered;
  };
  const runs = (covered: number[]): number[][] => {
    const width = Math.max(1, Math.round(ring.width));
    return Array.from({ length: Math.max(1, covered.length - width + 1) }, (_, first) => covered.slice(first, first + width));
  };
  const side = (name: RingSide['side'], points: number[], at: (point: number, across: number) => number, start: number): RingSide => {
    const covered = band(start);
    const whole = points.map((point) => Math.min(...runs(covered).map((run) => Math.max(...run.map((across) => at(point, across))))));
    const nearest = points.map((point) => Math.min(...covered.map((across) => at(point, across))));
    return { side: name, samples: points.length, worst: Math.max(...whole), best: Math.min(...nearest) };
  };
  const columns = along(ring.left + ring.radius, ring.right - ring.radius);
  const rows = along(ring.top + ring.radius, ring.bottom - ring.radius);
  return [
    side('top', columns, (x, y) => distanceAt(x, y), ring.top),
    side('right', rows, (y, x) => distanceAt(x, y), ring.right - ring.width),
    side('bottom', columns, (x, y) => distanceAt(x, y), ring.bottom - ring.width),
    side('left', rows, (y, x) => distanceAt(x, y), ring.left)
  ];
};

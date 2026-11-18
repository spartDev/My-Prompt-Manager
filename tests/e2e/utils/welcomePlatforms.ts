/**
 * Step 3's row of Platforms as drawn (My-Prompt-Manager-ojz.19): the caption "Type // in the chat on",
 * then the Platform pills, one wrapping row that reads as a sentence. What a new user must see whole
 * to know what to do in their AI chat, with the primary button still in view under it.
 */

import { expect, type Page } from '@playwright/test';

/** The caption before the pills, which is also the name of their list */
export const PLATFORMS_CAPTION = 'Type // in the chat on';

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlatformsRowLayout {
  viewport: { width: number; height: number };
  /** The row: the caption and the pills */
  row: Box;
  caption: Box & { text: string; color: string; scrollWidth: number; clientWidth: number };
  pills: (Box & { text: string })[];
  /** How many lines the caption and the pills take */
  lines: number;
  /** The Packs' grid, above the row */
  grid: Box;
  primary: Box;
}

/** Reads the row, its caption and its pills, the Packs' grid above and the primary button below */
export const platformsRowLayout = (page: Page): Promise<PlatformsRowLayout | null> =>
  page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const row = document.querySelector('[data-testid="welcome-platforms"]');
    const list = row?.querySelector('ul');
    const caption = document.getElementById(list?.getAttribute('aria-labelledby') ?? '');
    const grid = document.querySelector('[data-testid="welcome-packs"]');
    const primary = document.querySelector('[data-testid="welcome-primary"]');
    if (!row || !list || !caption || !grid || !primary) {
      return null;
    }
    const pills = [...list.querySelectorAll('li')].map((pill) => ({ ...box(pill), text: pill.textContent ?? '' }));
    // A line by the middle of what is on it: the caption, shorter, sits centered on its pills' line
    const lineOf = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return Math.round((rect.top + rect.bottom) / 2);
    };
    const tops = new Set([caption, ...list.querySelectorAll('li')].map(lineOf));
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      row: box(row),
      caption: {
        ...box(caption),
        text: caption.textContent ?? '',
        color: getComputedStyle(caption).color,
        scrollWidth: caption.scrollWidth,
        clientWidth: caption.clientWidth
      },
      pills,
      lines: tops.size,
      grid: box(grid),
      primary: box(primary)
    };
  });

const inside = (inner: Box, outer: Box): boolean =>
  inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;

const overlap = (a: Box, b: Box): boolean => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

/**
 * The caption and every pill whole and in the viewport, none over another, the caption before the
 * first pill (on its line or the one above); the row under the Packs' grid and above the primary
 * button, which is wholly in view. Returns the layout for the test's annotations.
 */
export const expectPlatformsRowWhole = async (page: Page, what: string): Promise<PlatformsRowLayout> => {
  const layout = await platformsRowLayout(page);
  expect(layout, `${what}: the row, its caption and its list`).not.toBeNull();
  if (!layout) {
    throw new Error('unreachable');
  }
  const view: Box = { left: 0, top: 0, right: layout.viewport.width, bottom: layout.viewport.height };
  const { caption, pills, row, grid, primary } = layout;

  expect(caption.text, `${what}: the caption`).toBe(PLATFORMS_CAPTION);
  expect(caption.scrollWidth, `${what}: the caption, not cut`).toBeLessThanOrEqual(caption.clientWidth);
  expect(inside(caption, view), `${what}: the caption in view ${JSON.stringify(caption)}`).toBe(true);
  expect(inside(caption, row), `${what}: the caption inside its row`).toBe(true);
  expect(pills.length, `${what}: the pills`).toBeGreaterThan(0);
  for (const pill of pills) {
    expect(inside(pill, view), `${what}: the pill ${pill.text} in view ${JSON.stringify(pill)}`).toBe(true);
    expect(inside(pill, row), `${what}: the pill ${pill.text} inside the row`).toBe(true);
    expect(overlap(pill, caption), `${what}: the pill ${pill.text} clear of the caption`).toBe(false);
  }
  // Read first: on the first pill's line, before it, or on a line above it
  const first = pills[0];
  const sameLine = caption.top < first.bottom && first.top < caption.bottom;
  expect(sameLine ? caption.right <= first.left + 0.5 : caption.bottom <= first.top + 0.5, `${what}: the caption before the first pill`).toBe(true);
  expect(row.top, `${what}: the row under the Packs' grid`).toBeGreaterThanOrEqual(grid.bottom - 0.5);
  expect(row.bottom, `${what}: the row above the primary button`).toBeLessThanOrEqual(primary.top + 0.5);
  expect(inside(primary, view), `${what}: the primary button wholly in view ${JSON.stringify(primary)}`).toBe(true);
  return layout;
};

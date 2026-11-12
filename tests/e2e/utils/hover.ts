/**
 * A hover a headed run cannot take away (My-Prompt-Manager-51s)
 *
 * Locally every test has its own Chrome window, and 5 workers open one each, over one another. When a
 * window opens over the one under the real pointer, Chrome gives that page a real mouse event at the
 * pointer's position, which takes the place of the position Playwright's mouse set: the page sees the
 * pointer leave, and `:hover` ends, with no event of the test in between. `locator.hover()` acts once
 * and `expect()` only reads, so nothing puts the pointer back, and the test waits out its timeout on
 * a rest state. A pointer outside every window never does it, nor does a headless run (CI).
 *
 * A test that asserts something only true under the pointer reads it through these two, which put the
 * pointer back on the element whenever it was taken.
 */

import type { Locator } from '@playwright/test';

import { expect } from '../fixtures/extension';

/** How often `holdHover` puts the pointer back, well under the 2.8s a confirmation stays after the pointer leaves */
const HOLD_STEP_MS = 250;

/**
 * `expect.poll` of `read`, with the pointer moved onto `target` before each read. For a state the
 * hover brings, such as a hover background: `await readWhileHovering(icon, readBackground).toBe(hovered)`.
 */
export const readWhileHovering = <T>(target: Locator, read: () => Promise<T>, timeout = 10_000) =>
  expect.poll(
    async () => {
      await target.hover();
      return read();
    },
    { timeout },
  );

/**
 * Keeps the pointer on `target` for `ms`, putting it back every 250ms. For a state that must last
 * while the pointer is on the element, such as a timer the hover holds. It never waits for the element,
 * so one that has gone is for the caller's assertion to report.
 */
export const holdHover = async (target: Locator, ms: number): Promise<void> => {
  const page = target.page();
  await target.hover();
  const box = await target.boundingBox();
  if (!box) {
    return;
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(Math.min(HOLD_STEP_MS, Math.max(0, until - Date.now())));
  }
};

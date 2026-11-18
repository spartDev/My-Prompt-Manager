/**
 * E2E: the failure Notification of a refused add of the Packs, on the built extension
 * (My-Prompt-Manager-ojz.20). The add is refused for real: the store filled past the 98% the
 * extension keeps free (tests/e2e/utils/storageFiller.ts).
 *
 * - AC1: its whole text shows, never cut: the message does not overflow its box (scrollWidth <=
 *   clientWidth; where the room is short it wraps onto a second line), in the popup (400 x 500) and in
 *   side panels of 320 x 500 and 360 x 600, light and dark. It covers neither the close button
 *   (visible, the topmost element at its center, a trial click lands on it) nor any control of the
 *   step (the Packs, the dots, Back, the primary button). It is an alert, and the keyboard stays on
 *   the primary button. Six screenshots, error-<surface>-<w>x<h>-<theme>.png, in
 *   WELCOME_FAILURE_SCREENSHOTS (test-results/welcome-add-failure when unset).
 * - AC3: it stays until the user acts: the same element, still there 10s after it shows with no
 *   input. Try again, the store still full, shows it again; with room again, Try again adds the
 *   Packs and the Welcome is done.
 *
 * AC2 (the first add refused, Try again adds the same Packs once each) and Start empty from the step:
 * the last describe of scenarios.spec.ts, "Every way out of the Welcome".
 */
import fs from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';
import { backgroundWorker, emptyFiller, fillStorage } from '../utils/storageFiller';

const SCREENSHOTS_DIR = process.env.WELCOME_FAILURE_SCREENSHOTS ?? 'test-results/welcome-add-failure';

const MESSAGE = "Couldn't add the prompts";
const DEFAULT_COUNT = PACKS.filter((pack) => pack.defaultSelected).reduce((count, pack) => count + pack.prompts.length, 0);

const SURFACES = [
  { surface: 'popup', file: 'popup', width: 400, height: 500, close: 'Close' },
  { surface: 'sidepanel', file: 'sidepanel', width: 320, height: 500, close: 'Close side panel' },
  { surface: 'sidepanel', file: 'sidepanel', width: 360, height: 600, close: 'Close side panel' }
] as const;

type Theme = 'light' | 'dark';

const welcome = (page: Page) => page.getByTestId('welcome');
const primary = (page: Page) => page.getByTestId('welcome-primary');
const notification = (page: Page) => page.getByTestId('toast');

/** Resolves once every finite animation of the page has ended */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Where the Notification, its message, the close button and the step's controls are */
const geometryOf = (page: Page, closeName: string) =>
  page.evaluate((name) => {
    const box = (element: Element) => {
      const { left, top, right, bottom } = element.getBoundingClientRect();
      return { left, top, right, bottom };
    };
    const pill = document.querySelector('[data-testid="toast"]');
    const message = document.querySelector('[data-testid="toast-message"]');
    const close = document.querySelector(`[data-testid="welcome"] header button[aria-label="${name}"]`);
    if (!(pill instanceof HTMLElement) || !(message instanceof HTMLElement) || !(close instanceof HTMLElement)) {
      throw new Error('No Notification, message or close button on the page');
    }
    const range = document.createRange();
    range.selectNodeContents(message);
    const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
    const closeBox = box(close);
    const hit = document.elementFromPoint((closeBox.left + closeBox.right) / 2, (closeBox.top + closeBox.bottom) / 2);
    const style = getComputedStyle(message);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      pill: box(pill),
      role: pill.getAttribute('role'),
      message: {
        text: message.textContent,
        scrollWidth: message.scrollWidth,
        clientWidth: message.clientWidth,
        scrollHeight: message.scrollHeight,
        clientHeight: message.clientHeight,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
        lines
      },
      close: { ...closeBox, topmost: hit !== null && close.contains(hit), visibility: getComputedStyle(close).visibility },
      // Every control of the step: the Packs, the dots, Back and the primary button
      controls: [...document.querySelectorAll('[data-testid="welcome"] button')]
        .filter((button) => !button.closest('header'))
        .map((button) => ({ name: button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '', ...box(button) })),
      focused: document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName ?? null
    };
  }, closeName);

/** Opens the surface at the Welcome's last step, then fills the store so the add is refused */
const atLastStepWithStoreFull = async (page: Page, extensionId: string, file: string, width: number, height: number) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
  await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
  await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);
};

test.describe('The failure Notification of a refused add', () => {
  for (const { surface, file, width, height, close } of SURFACES) {
    for (const theme of ['light', 'dark'] as const satisfies readonly Theme[]) {
      test(`AC1: its whole text shows, clear of the close button and of the step's controls, ${theme}, ${surface} ${String(width)} x ${String(height)}`, async ({ context, page, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await atLastStepWithStoreFull(page, extensionId, file, width, height);
        if (theme === 'dark') {
          await expect(page.locator('html')).toHaveClass(/\bdark\b/);
        } else {
          await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
        }
        await fillStorage(await backgroundWorker(context));

        await primary(page).click();

        await expect(notification(page)).toHaveAttribute('data-type', 'error');
        await expect(page.getByRole('alert')).toContainText(MESSAGE);
        await expect(page.getByRole('alert').getByRole('button', { name: 'Try again' })).toBeVisible();
        await animationsDone(page);
        const geometry = await geometryOf(page, close);
        const combination = `${theme}, ${surface} ${String(width)}x${String(height)}`;
        console.log(`[welcome add failure] ${combination}: ${JSON.stringify({ pill: geometry.pill, message: geometry.message, close: geometry.close })}`);
        test.info().annotations.push({
          type: 'geometry',
          description: `${combination}: pill ${geometry.pill.left.toFixed(1)}-${geometry.pill.right.toFixed(1)} x ${geometry.pill.top.toFixed(1)}-${geometry.pill.bottom.toFixed(1)}, message ${String(geometry.message.scrollWidth)}/${String(geometry.message.clientWidth)}px on ${String(geometry.message.lines)} line(s); close ${geometry.close.left.toFixed(1)}-${geometry.close.right.toFixed(1)}`
        });

        // Whole: the text as written, nothing of it past its box, no ellipsis
        expect(geometry.role).toBe('alert');
        expect(geometry.message.text).toBe(MESSAGE);
        expect(geometry.message.scrollWidth, 'the message overflows its box').toBeLessThanOrEqual(geometry.message.clientWidth);
        expect(geometry.message.scrollHeight, 'the message overflows its box downward').toBeLessThanOrEqual(geometry.message.clientHeight);
        expect(geometry.message.textOverflow).not.toBe('ellipsis');
        expect(geometry.pill.left).toBeGreaterThanOrEqual(0);
        expect(geometry.pill.right).toBeLessThanOrEqual(geometry.viewport.width);

        // The close button: not covered, the topmost element at its center, and a click lands on it
        expect(overlaps(geometry.pill, geometry.close), 'the Notification covers the close button').toBe(false);
        expect(geometry.close.topmost, 'the close button is the topmost element at its center').toBe(true);
        expect(geometry.close.visibility).toBe('visible');
        const closeButton = page.getByRole('button', { name: close, exact: true });
        await expect(closeButton).toBeVisible();
        await closeButton.click({ trial: true, timeout: 5_000 });

        // No control of the step under it
        expect(geometry.controls.length).toBeGreaterThan(0);
        for (const control of geometry.controls) {
          expect(overlaps(geometry.pill, control), `the Notification covers ${control.name}`).toBe(false);
        }

        // The keyboard stays on the primary button, which tries again
        expect(geometry.focused).toBe('welcome-primary');

        await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
        // The pointer off the controls, so none shows its hover
        await page.mouse.move(2, height - 2);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/error-${surface}-${String(width)}x${String(height)}-${theme}.png`, animations: 'disabled' });
      });
    }
  }

  test('AC3: it stays until the user acts: the same Notification 10s after it shows with no input; Try again with the store still full shows it again, with room adds the Packs', async ({ context, page, storage, extensionId }) => {
    test.setTimeout(90_000);
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
    await atLastStepWithStoreFull(page, extensionId, 'popup', 400, 500);
    const worker = await backgroundWorker(context);
    await fillStorage(worker);

    await primary(page).click();
    await expect(page.getByRole('alert')).toContainText(MESSAGE);
    // Marked, so the element 10s later is known to be the same one, never shown again
    const shownAt = await notification(page).evaluate((pill) => {
      pill.setAttribute('data-e2e-first', 'true');
      return performance.now();
    });

    await page.waitForTimeout(10_000);

    const still = await notification(page).evaluate((pill, from) => ({ same: pill.getAttribute('data-e2e-first') === 'true', after: performance.now() - from }), shownAt);
    console.log(`[welcome add failure] AC3: the failure Notification still on screen ${still.after.toFixed(0)}ms after it showed, the same element: ${String(still.same)}`);
    test.info().annotations.push({ type: 'AC3', description: `still there ${still.after.toFixed(0)}ms after it showed, same element: ${String(still.same)}` });
    expect(still.after).toBeGreaterThanOrEqual(10_000);
    expect(still.same).toBe(true);
    await expect(page.getByRole('alert')).toContainText(MESSAGE);
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');

    // Try again with the store still full: refused again, a failure Notification again
    await page.getByRole('alert').getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('[data-testid="toast"][data-e2e-first]')).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText(MESSAGE);
    await expect(page.getByRole('alert').getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(await storage.getPrompts()).toEqual([]);
    expect((await storage.get<Record<string, unknown>>(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'pending', step: 2 });

    // Room again: Try again adds the Packs; the failure is gone and the Welcome done
    await emptyFiller(worker);
    await page.getByRole('alert').getByRole('button', { name: 'Try again' }).click();
    await expect(welcome(page)).toHaveCount(0);
    await expect(page.getByTestId('prompt-card')).toHaveCount(DEFAULT_COUNT);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(notification(page)).toContainText(`${String(DEFAULT_COUNT)} prompts added`);
    await expect.poll(async () => (await storage.get<Record<string, unknown>>(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'done' });
  });
});

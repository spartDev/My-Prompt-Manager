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
 *
 * My-Prompt-Manager-5lf, no stale Try again:
 * - AC1: a Pack toggled after a refused add hides the failure Notification, the keyboard stays on that
 *   Pack, and the primary button adds exactly the Packs on screen.
 * - AC2: in AC1's geometry above, the pill stands 8px or more from the step's title and covers no part
 *   of the brand (the logo and the name), at 320 x 500 and 400 x 500 too, light and dark.
 * - AC3: Enter on Try again, the add refused again: the keyboard is on the Try again of the failure
 *   Notification now on screen, its ring drawn whole, never on the body. A seventh screenshot,
 *   error-try-again-refused-again-focus-popup-400x500-light.png, in WELCOME_FAILURE_SCREENSHOTS.
 */
import fs from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import type { PromptPack } from '../../../src/welcome/types';
import { expect, test } from '../fixtures/extension';
import { type FocusRing, RING_TOLERANCE, ringSides } from '../utils/focusRing';
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
const tryAgain = (page: Page) => page.getByRole('alert').getByRole('button', { name: 'Try again' });
/** A Pack's toggle, named "Product 5 prompts" */
const packToggle = (page: Page, pack: PromptPack) => page.getByTestId('welcome-packs').getByRole('button', { name: new RegExp(`^${pack.name} `) });

const packNamed = (name: string): PromptPack => {
  const pack = PACKS.find((candidate) => candidate.name === name);
  if (!pack) {
    throw new Error(`No Pack named ${name}`);
  }
  return pack;
};

/** The pixels a pill and the step's title must keep between them (the guidelines' mb-2, "between related elements") */
const TITLE_GAP_PX = 8;

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
    // The brand: the logo in its violet square and the name, the header's first part
    const brand = document.querySelector('[data-testid="welcome"] header > span');
    const title = document.querySelector('[data-testid="welcome"] [data-welcome-title]');
    if (!(pill instanceof HTMLElement) || !(message instanceof HTMLElement) || !(close instanceof HTMLElement)) {
      throw new Error('No Notification, message or close button on the page');
    }
    if (!(brand instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      throw new Error('No brand or step title on the page');
    }
    // Every point of the brand drawn, about every 4px: each must be the brand's own, nothing over it
    const brandBox = box(brand);
    const brandCovered: string[] = [];
    for (let x = brandBox.left + 1; x < brandBox.right; x += 4) {
      for (let y = brandBox.top + 1; y < brandBox.bottom; y += 4) {
        const at = document.elementFromPoint(x, y);
        if (at === null || !brand.contains(at)) {
          brandCovered.push(`${x.toFixed(0)},${y.toFixed(0)}`);
        }
      }
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
      brand: { ...brandBox, text: brand.textContent, covered: brandCovered },
      title: box(title),
      // Every control of the step: the Packs, the dots, Back and the primary button; not the
      // Notification's own Try again, the pill being in the Welcome's flow (My-Prompt-Manager-5lf)
      controls: [...document.querySelectorAll('[data-testid="welcome"] button')]
        .filter((button) => !button.closest('header') && !pill.contains(button))
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
      test(`AC1: its whole text shows, clear of the brand, the close button, the step's title and its controls, ${theme}, ${surface} ${String(width)} x ${String(height)}`, async ({ context, page, storage, extensionId }) => {
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
        // From the pill to the step's title, whichever is above the other; negative where they overlap
        const titleGap = Math.max(geometry.title.top - geometry.pill.bottom, geometry.pill.top - geometry.title.bottom);
        console.log(`[welcome add failure] ${combination}: ${JSON.stringify({ pill: geometry.pill, message: geometry.message, close: geometry.close, brand: geometry.brand, title: geometry.title, titleGap })}`);
        test.info().annotations.push({
          type: 'geometry',
          description: `${combination}: pill ${geometry.pill.left.toFixed(1)}-${geometry.pill.right.toFixed(1)} x ${geometry.pill.top.toFixed(1)}-${geometry.pill.bottom.toFixed(1)}, message ${String(geometry.message.scrollWidth)}/${String(geometry.message.clientWidth)}px on ${String(geometry.message.lines)} line(s); close ${geometry.close.left.toFixed(1)}-${geometry.close.right.toFixed(1)}; brand ${geometry.brand.left.toFixed(1)}-${geometry.brand.right.toFixed(1)} x ${geometry.brand.top.toFixed(1)}-${geometry.brand.bottom.toFixed(1)}, ${String(geometry.brand.covered.length)} point(s) covered; title from ${geometry.title.top.toFixed(1)}, ${titleGap.toFixed(1)}px from the pill`
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

        // My-Prompt-Manager-5lf AC2: the brand whole, every point of it its own; the title 8px away or more
        expect(geometry.brand.text).toBe('My Prompt Manager');
        expect(overlaps(geometry.pill, geometry.brand), 'the Notification covers the brand').toBe(false);
        expect(geometry.brand.covered, 'points of the brand under another element').toEqual([]);
        expect(titleGap, `the Notification stands ${titleGap.toFixed(1)}px from the step's title`).toBeGreaterThanOrEqual(TITLE_GAP_PX);

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

  test('5lf AC1: a Pack toggled after a refused add hides the failure Notification, the keyboard stays on that Pack, and the primary button adds exactly the Packs on screen', async ({ context, page, storage, extensionId }) => {
    const product = packNamed('Product');
    const writing = packNamed('Writing');
    const hiring = packNamed('Hiring');
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
    await atLastStepWithStoreFull(page, extensionId, 'popup', 400, 500);
    const titleTop = () => page.locator('[data-welcome-title]').evaluate((title) => title.getBoundingClientRect().top);
    const before = await titleTop();
    const worker = await backgroundWorker(context);
    await fillStorage(worker);
    await primary(page).click();
    await expect(page.getByRole('alert')).toContainText(MESSAGE);
    await expect(tryAgain(page)).toBeVisible();

    // Product, selected by default, unselected from the keyboard: its Try again was about Product and Writing
    await packToggle(page, product).focus();
    await page.keyboard.press('Space');

    await expect(packToggle(page, product)).toHaveAttribute('aria-pressed', 'false');
    await expect(notification(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
    await expect(packToggle(page, product)).toBeFocused();
    // The Notification's room under the header is given back: the title is where it was before the add
    expect(await titleTop()).toBeCloseTo(before, 1);

    // Writing unselected and Hiring selected: the screen offers Hiring alone
    await packToggle(page, writing).click();
    await packToggle(page, hiring).click();
    await expect(primary(page)).toHaveText(`Add ${String(hiring.prompts.length)} prompts`);
    await expect(notification(page)).toHaveCount(0);
    expect(await storage.getPrompts()).toEqual([]);

    // Room again: the primary button adds Hiring's Prompts, none of the refused selection's
    await emptyFiller(worker);
    await primary(page).click();
    await expect(welcome(page)).toHaveCount(0);
    await expect(page.getByTestId('prompt-card')).toHaveCount(hiring.prompts.length);
    await expect(notification(page)).toContainText(`${String(hiring.prompts.length)} prompts added`);
    const contents = (await storage.getPrompts()).map((prompt) => prompt.content).sort();
    expect(contents).toEqual(hiring.prompts.map((prompt) => prompt.content).sort());
    await expect.poll(async () => (await storage.get<Record<string, unknown>>(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'done' });
  });

  test("5lf AC3: Enter on Try again, the add refused again: the keyboard is on the new failure Notification's Try again, its ring drawn whole", async ({ context, page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
    await atLastStepWithStoreFull(page, extensionId, 'popup', 400, 500);
    await fillStorage(await backgroundWorker(context));
    await primary(page).click();
    await expect(page.getByRole('alert')).toContainText(MESSAGE);
    // Marked, so the Notification after the second refusal is known to be another one
    await notification(page).evaluate((pill) => { pill.setAttribute('data-e2e-first', 'true'); });

    // The keyboard alone to Try again
    for (let presses = 0; presses < 30; presses++) {
      if (await tryAgain(page).evaluate((button) => button === document.activeElement)) {
        break;
      }
      await page.keyboard.press('Tab');
    }
    await expect(tryAgain(page)).toBeFocused();

    await page.keyboard.press('Enter');

    // Refused again, the store still full: another failure Notification, and the keyboard on its Try again
    await expect(page.locator('[data-testid="toast"][data-e2e-first]')).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText(MESSAGE);
    await expect(tryAgain(page)).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body), 'the keyboard fell to the body').toBe(false);
    expect(await storage.getPrompts()).toEqual([]);
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');

    // Its ring, as drawn: 2px of the button's own color all around it (ring-2 ring-current on
    // :focus-visible). A box-shadow, which Chrome antialiases where the button starts between two
    // pixels (the pill is centered by half its width): at the sides only one of its 2px is then pure,
    // so each side is read for 1px of the ring's color within its 2px band
    await animationsDone(page);
    const drawn = await tryAgain(page).evaluate((button) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      const reach = 2;
      return {
        focusVisible: button.matches(':focus-visible'),
        boxShadow: style.boxShadow,
        ring: {
          color: style.color,
          style: 'solid',
          width: 1,
          reach,
          radius: Math.min(parseFloat(style.borderTopLeftRadius) || 0, rect.width / 2, rect.height / 2) + reach,
          left: rect.left - reach,
          top: rect.top - reach,
          right: rect.right + reach,
          bottom: rect.bottom + reach
        } satisfies FocusRing
      };
    });
    const sides = await ringSides(page, drawn.ring);
    console.log(`[welcome add failure] 5lf AC3: Try again focused after the second refusal, :focus-visible ${String(drawn.focusVisible)}, box-shadow ${drawn.boxShadow}, ring sides ${JSON.stringify(sides)}`);
    expect(drawn.focusVisible, 'Try again matches :focus-visible').toBe(true);
    expect(drawn.boxShadow).toMatch(/0px 0px 0px 2px/);
    for (const side of sides) {
      expect(side.worst, `the ring's ${side.side} side`).toBeLessThanOrEqual(RING_TOLERANCE);
    }
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/error-try-again-refused-again-focus-popup-400x500-light.png` });
  });
});

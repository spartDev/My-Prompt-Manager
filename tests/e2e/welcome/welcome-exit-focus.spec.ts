/**
 * E2E: where the keyboard lands as the Welcome hands over, in the real extension
 * (My-Prompt-Manager-ojz.17, scenarios 2, 3 and 12 for keyboard users).
 *
 * - S2, AC1, by keyboard: Enter on "Add 9 prompts", and the keyboard is on the Copy of the first
 *   Prompt card the Library lists, named after that Prompt, with its focus ring drawn whole (the
 *   design system's 2px accent outline, read back from the pixels). The Tab presses from the exit to
 *   that Copy are counted: none. Then Enter, and the clipboard holds that Prompt's content, read
 *   back. Popup 400 x 500 and side panel 320 x 600, light and dark; screenshots in
 *   WELCOME_EXIT_FOCUS_SCREENSHOTS (test-results/welcome-exit-focus when unset).
 * - S2 with the mouse: a click on "Add 9 prompts" puts the keyboard on the same Copy, but Chrome
 *   does not match :focus-visible after a click, so no ring is drawn there (none in the pixels). Enter
 *   still copies.
 * - S2 with Enter held: the Enter that adds the Packs stays down once the Copy has the keyboard, and
 *   its repeats copy nothing: the clipboard keeps what the user had, no use is recorded, and the
 *   Notification still says the Prompts were added. A fresh Enter then copies.
 * - S3, AC2, by keyboard: Enter on "Start empty": the empty Library, then the editor, with the
 *   keyboard in its title field.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { USAGE_STORAGE_KEY } from '../../../src/constants';
import { DEFAULT_SETTINGS } from '../../../src/types';
import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';
import { focusRingOf, RING_TOLERANCE, ringSides } from '../utils/focusRing';

const SCREENSHOTS_DIR = process.env.WELCOME_EXIT_FOCUS_SCREENSHOTS ?? 'test-results/welcome-exit-focus';

const SURFACES = {
  popup: { file: 'popup', width: 400, height: 500 },
  sidepanel: { file: 'sidepanel', width: 320, height: 600 }
} as const;

type Surface = keyof typeof SURFACES;

/** The ring of focus-interactive: a 2px outline, 1px off the button */
const COPY_RING = { width: 2, offset: 1 };

/** The most Tab presses the ticket allows from the exit to the first Copy */
const MAX_TABS_TO_COPY = 1;

/** How long a copy nobody asked for gets to land before its absence is read */
const SETTLE_MS = 750;

const DEFAULT_COUNT = PACKS.filter((pack) => pack.defaultSelected).reduce((count, pack) => count + pack.prompts.length, 0);

const open = async (page: Page, extensionId: string, surface: Surface): Promise<void> => {
  const { file, width, height } = SURFACES[surface];
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
};

const primary = (page: Page) => page.getByTestId('welcome-primary');
const firstCard = (page: Page) => page.getByTestId('prompt-card').first();

/** Resolves once every finite animation of the page has ended: the cards have risen */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });

/** What has the keyboard: its accessible name, and whether it draws the ring of :focus-visible */
const focused = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) {
      return null;
    }
    return { name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '', focusVisible: element.matches(':focus-visible') };
  });

/**
 * The Tab presses from where the keyboard is to a Prompt card's Copy: 0 when a Copy has it already.
 * Gives up past `max`
 */
const tabsToACopy = async (page: Page, max = 8): Promise<number> => {
  for (let presses = 0; presses <= max; presses++) {
    if (/^Copy content of .+ to clipboard$/.test((await focused(page))?.name ?? '')) {
      return presses;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`No Copy reached in ${String(max)} Tab presses`);
};

/** The first card's Prompt: its title as the card shows it, and its content in the Packs */
const firstPrompt = async (page: Page): Promise<{ title: string; content: string }> => {
  const title = (await firstCard(page).getByRole('heading').textContent())?.trim() ?? '';
  const content = PACKS.flatMap((pack) => pack.prompts).find((prompt) => prompt.title === title)?.content;
  expect(content, `${title} is a Prompt of the Packs`).toBeDefined();
  return { title, content: content ?? '' };
};

test.describe('Where the keyboard lands as the Welcome hands over', () => {
  for (const surface of ['popup', 'sidepanel'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      const { width, height } = SURFACES[surface];

      test(`S2, AC1, by keyboard (${surface} ${String(width)} x ${String(height)}, ${theme}): the first Prompt's Copy has the keyboard with its ring whole; no Tab, then Enter copies that Prompt`, async ({ context, page, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await open(page, extensionId, surface);
        await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);
        // The pointer off the controls, so none shows its hover
        await page.mouse.move(width / 2, 4);

        await primary(page).focus();
        await page.keyboard.press('Enter');

        await expect(page.getByTestId('welcome')).toHaveCount(0);
        await expect(page.getByTestId('prompt-card')).toHaveCount(DEFAULT_COUNT);
        const { title, content } = await firstPrompt(page);
        const copy = firstCard(page).getByRole('button', { name: `Copy content of ${title} to clipboard` });
        await expect(copy).toBeFocused();
        await animationsDone(page);

        // The ring of focus-interactive, drawn whole: read from the pixels, side by side
        expect(await copy.evaluate((element) => element.matches(':focus-visible')), 'the ring of a key press').toBe(true);
        const ring = await focusRingOf(copy);
        expect({ style: ring.style, width: ring.width, reach: ring.reach }).toEqual({ style: 'solid', width: COPY_RING.width, reach: COPY_RING.width + COPY_RING.offset });
        const sides = await ringSides(page, ring);
        test.info().annotations.push({ type: 'ring', description: JSON.stringify({ color: ring.color, sides }) });
        for (const side of sides) {
          expect(side.worst, `the Copy ring's ${side.side} side, drawn in ${ring.color}`).toBeLessThanOrEqual(RING_TOLERANCE);
        }
        await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${surface}-exit-first-copy-focused-${theme}.png`) });

        // From the exit to the first copy: the Tab presses, then one Enter
        const tabs = await tabsToACopy(page);
        console.log(`[keyboard] ${surface} ${theme}: ${String(tabs)} Tab from the exit to the first Copy`);
        test.info().annotations.push({ type: 'tabs to the first Copy', description: String(tabs) });
        expect(tabs).toBeLessThanOrEqual(MAX_TABS_TO_COPY);
        expect(tabs).toBe(0);
        await expect(copy).toBeFocused();
        await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(content);
        await expect(page.getByTestId('toast')).toContainText('Prompt copied');
      });
    }
  }

  test('S2 with the mouse: the first Prompt\'s Copy has the keyboard too, but no ring is drawn after a click; Enter still copies', async ({ context, page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, extensionId, 'popup');
    await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);

    await primary(page).click();

    await expect(page.getByTestId('welcome')).toHaveCount(0);
    const { title, content } = await firstPrompt(page);
    const copy = firstCard(page).getByRole('button', { name: `Copy content of ${title} to clipboard` });
    await expect(copy).toBeFocused();
    await animationsDone(page);
    // The pointer off the card, so the pixels show no hover
    await page.mouse.move(200, 4);

    expect(await copy.evaluate((element) => element.matches(':focus-visible')), 'no ring after a click').toBe(false);
    const ring = await focusRingOf(copy, COPY_RING);
    expect(ring.style).toBe('none');
    const sides = await ringSides(page, ring);
    test.info().annotations.push({ type: 'no ring', description: JSON.stringify({ color: ring.color, sides }) });
    for (const side of sides) {
      expect(side.best, `no ring on the Copy's ${side.side} side`).toBeGreaterThan(RING_TOLERANCE);
    }

    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(content);
  });

  test('S2 with Enter held: the repeats that reach the first Prompt\'s Copy copy nothing; a fresh Enter copies', async ({ context, page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, extensionId, 'popup');
    await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);
    // What the user had on the clipboard before the Welcome
    const mine = 'MINE: what the user copied before the Welcome';
    await page.evaluate((text) => navigator.clipboard.writeText(text), mine);

    // Enter down on the primary, and held: the Packs are added and the Copy takes the keyboard
    await primary(page).focus();
    await page.keyboard.down('Enter');
    await expect(page.getByTestId('welcome')).toHaveCount(0);
    const { title, content } = await firstPrompt(page);
    const copy = firstCard(page).getByRole('button', { name: `Copy content of ${title} to clipboard` });
    await expect(copy).toBeFocused();
    // The key's auto-repeat, on the Copy now, then the key let go
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await page.waitForTimeout(SETTLE_MS);

    expect(await page.evaluate(() => navigator.clipboard.readText()), 'the clipboard keeps what the user had').toBe(mine);
    const toast = page.getByTestId('toast');
    await expect(toast).toContainText(`${String(DEFAULT_COUNT)} prompts added`);
    await expect(toast).not.toContainText('Prompt copied');
    const prompts = await storage.getPrompts();
    expect(prompts).toHaveLength(DEFAULT_COUNT);
    expect(prompts.map((prompt) => prompt.usageCount ?? 0), 'no use recorded').toEqual(prompts.map(() => 0));
    expect((await storage.get([USAGE_STORAGE_KEY]))[USAGE_STORAGE_KEY] ?? [], 'no usage event').toEqual([]);
    await expect(copy).toBeFocused();

    // A fresh Enter still copies
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(content);
    await expect(toast).toContainText('Prompt copied');
  });

  test('S3, AC2, by keyboard: Start empty leaves the keyboard in the editor\'s title field', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2, packs: [] } });
    await open(page, extensionId, 'popup');
    await expect(primary(page)).toHaveText('Start empty');

    await primary(page).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByText('Your library is empty')).toBeVisible();
    const editor = page.getByTestId('editor-sheet');
    await expect(editor).toBeVisible();
    const title = editor.getByLabel(/title/i);
    await expect(title).toBeFocused();
    // And it stays there once the sheet has risen
    await animationsDone(page);
    await expect(title).toBeFocused();
    await page.keyboard.type('My first prompt');
    await expect(title).toHaveValue('My first prompt');
  });
});

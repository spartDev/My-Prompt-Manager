/**
 * E2E: the Packs added, then the Library cannot be read again (My-Prompt-Manager-ojz.22, CR24 of PR
 * #607), on the built extension. In the popup, chrome.storage.local.get is patched from the page's
 * first script: the first read of the Library's Prompts after the set that stored the Packs rejects,
 * once. The add resolved, so the Welcome is finished and the success Notification shows; the Library
 * shows Error Loading Data in its place.
 *
 * AC2, light and dark, popup 400 x 500: the error screen offers Try again, reached by Tab, its focus
 * ring drawn whole; no "Couldn't add the prompts", the Packs stored, the Welcome done. Try again reads
 * the Library again and lists the Packs' Prompts. Two screenshots per theme, load-error-<theme>.png
 * (at rest) and load-error-focused-<theme>.png (Try again with the keyboard), in
 * WELCOME_LOAD_ERROR_SCREENSHOTS (test-results/welcome-load-error when unset).
 *
 * CR26 of PR #607, light and dark: the Categories are part of that read. Both reads fail after the
 * Packs are stored, then the first Try again reads the Prompts and fails on the Categories: Error
 * Loading Data stays, with Try again, and no Prompt card shows on the way, so the Library never shows
 * without its Categories; the next Try again lists the Packs' Prompts, with their Categories in the
 * Library filter and on each card. One screenshot per theme, load-error-categories-<theme>.png (the
 * screen after the failed read of the Categories, at rest), in the same folder.
 *
 * AC4 of My-Prompt-Manager-ou48: Start empty at a first opening whose read of the Categories fails
 * (the opening's own read, hidden behind the Welcome). Start empty leaves the Welcome, finished, for
 * Error Loading Data, and the editor it opens 250ms later waits behind that screen. Try again, from
 * the keyboard, leads where Start empty leads: the empty Library with the editor on a new Prompt, the
 * keyboard in its title field. No dead end. One screenshot, start-empty-after-try-again-light.png.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';
import { focusRingOf, RING_TOLERANCE, ringSides } from '../utils/focusRing';

const SCREENSHOTS_DIR = process.env.WELCOME_LOAD_ERROR_SCREENSHOTS ?? 'test-results/welcome-load-error';

const WIDTH = 400;
const HEIGHT = 500;

/** The ring of focus-primary: a 2px outline, 2px off the button */
const PRIMARY_RING = { width: 2, offset: 2 };

const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected);
const DEFAULT_COUNT = DEFAULTS.reduce((count, pack) => count + pack.prompts.length, 0);

const ERROR_TITLE = 'Error Loading Data';
const READ_FAILURE = 'forced: storage could not be read';

/** What the patch of the page records: whether the Packs are stored, and the keys of each read it made fail */
interface ReadFailure {
  packsStored: boolean;
  rejected: string[];
}

/** The reads to fail once the Packs are stored: how many of the Prompts, how many of the Categories */
interface ReadsToFail {
  message: string;
  prompts: number;
  categories: number;
}

/**
 * In the page, before its own scripts: once a set that carries the Prompts has resolved (the Packs
 * stored), the next reads of the Prompts and of the Categories reject, as many times as asked. Every
 * other read and write goes through
 */
const failTheNextLibraryReads = ({ message, ...left }: ReadsToFail): void => {
  const state: ReadFailure = { packsStored: false, rejected: [] };
  (window as Window & { __loadError?: ReadFailure }).__loadError = state;
  const local = chrome.storage.local;
  const get = local.get.bind(local) as (keys?: unknown) => Promise<Record<string, unknown>>;
  const set = local.set.bind(local) as (items: Record<string, unknown>) => Promise<void>;
  const patched = local as unknown as {
    get: (keys?: unknown) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
  };
  patched.set = (items) => {
    const written = set(items);
    if (Object.keys(items).includes('prompts')) {
      written.then(() => { state.packsStored = true; }, () => undefined);
    }
    return written;
  };
  patched.get = (keys) => {
    const names = keys === null || keys === undefined ? [] : Array.isArray(keys) ? keys.map(String) : typeof keys === 'string' ? [keys] : Object.keys(keys);
    const key = (['prompts', 'categories'] as const).find((name) => names.includes(name) && left[name] > 0);
    if (state.packsStored && key) {
      left[key] -= 1;
      state.rejected.push(names.join(','));
      return Promise.reject(new Error(message));
    }
    return get(keys);
  };
};

/** In the page, before its own scripts: the first `count` reads of the Categories reject, from the opening on */
const failTheFirstCategoriesReads = ({ message, count }: { message: string; count: number }): void => {
  const state = { rejected: 0 };
  (window as Window & { __categoriesReads?: { rejected: number } }).__categoriesReads = state;
  const local = chrome.storage.local;
  const get = local.get.bind(local) as (keys?: unknown) => Promise<Record<string, unknown>>;
  (local as unknown as { get: (keys?: unknown) => Promise<Record<string, unknown>> }).get = (keys) => {
    const names = keys === null || keys === undefined ? [] : Array.isArray(keys) ? keys.map(String) : typeof keys === 'string' ? [keys] : Object.keys(keys);
    if (names.includes('categories') && state.rejected < count) {
      state.rejected += 1;
      return Promise.reject(new Error(message));
    }
    return get(keys);
  };
};

const categoriesReadsRejected = (page: Page): Promise<number | undefined> =>
  page.evaluate(() => (window as Window & { __categoriesReads?: { rejected: number } }).__categoriesReads?.rejected);

const readFailure = (page: Page): Promise<ReadFailure | undefined> =>
  page.evaluate(() => (window as Window & { __loadError?: ReadFailure }).__loadError);

/**
 * In the page: from now on, counts the Prompt cards added to the document, even ones gone again
 * before the test looks (the Library shown, for a moment, before its Categories are read)
 */
const watchForCards = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const state = { added: 0 };
    (window as Window & { __cardsAdded?: { added: number } }).__cardsAdded = state;
    new MutationObserver((records) => {
      for (const node of records.flatMap((record) => [...record.addedNodes])) {
        if (node instanceof Element && (node.matches('[data-testid="prompt-card"]') || node.querySelector('[data-testid="prompt-card"]'))) {
          state.added += 1;
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

const cardsAdded = (page: Page): Promise<number | undefined> =>
  page.evaluate(() => (window as Window & { __cardsAdded?: { added: number } }).__cardsAdded?.added);

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

test.describe('Error Loading Data after the Welcome\'s Packs', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`AC2 (${theme}): the Library's read fails once after the Packs are stored; Error Loading Data offers Try again, with its focus ring, and Try again lists the ${String(DEFAULT_COUNT)} Prompts`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 }, settings: { ...DEFAULT_SETTINGS, theme } });
      await page.addInitScript(failTheNextLibraryReads, { message: READ_FAILURE, prompts: 1, categories: 0 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: WIDTH, height: HEIGHT });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      if (theme === 'dark') {
        await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      } else {
        await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
      }
      await expect(page.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '0');

      // Skip, then Add 9 prompts
      await page.getByRole('button', { name: 'Skip' }).click();
      await expect(page.getByTestId('welcome-primary')).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);
      await page.getByTestId('welcome-primary').click();

      // The error screen, its way on, under the Notification of the add
      await expect(page.getByTestId('welcome')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toBeVisible();
      await expect(page.getByText(READ_FAILURE)).toBeVisible();
      const tryAgain = page.getByRole('button', { name: 'Try again' });
      await expect(tryAgain).toBeVisible();
      await expect(page.getByTestId('toast')).toContainText(`${String(DEFAULT_COUNT)} prompts added`);
      await expect(page.getByTestId('toast')).toContainText('Open your AI chat and type //');
      await expect(page.getByText("Couldn't add the prompts")).toHaveCount(0);
      await expect(page.getByTestId('prompt-card')).toHaveCount(0);
      expect(await readFailure(page)).toEqual({ packsStored: true, rejected: ['prompts'] });
      // Nothing lost: the Packs stored, the Welcome done
      expect(await storage.getPrompts()).toHaveLength(DEFAULT_COUNT);
      await expect.poll(async () => (await storage.get<Record<string, unknown>>(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'done' });

      // At rest, the pointer off the button so it shows no hover
      await animationsDone(page);
      await page.mouse.move(2, HEIGHT - 2);
      await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `load-error-${theme}.png`) });

      // Reached by Tab from where the Welcome left the keyboard, with the ring of focus-primary drawn whole
      await page.keyboard.press('Tab');
      await expect(tryAgain).toBeFocused();
      // The Primary Button's transition-all brings the ring in over 200ms: read it once drawn
      await animationsDone(page);
      const ring = await focusRingOf(tryAgain);
      expect({ style: ring.style, width: ring.width, reach: ring.reach }).toEqual({ style: 'solid', width: PRIMARY_RING.width, reach: PRIMARY_RING.width + PRIMARY_RING.offset });
      const sides = await ringSides(page, ring);
      test.info().annotations.push({ type: 'ring', description: JSON.stringify({ theme, color: ring.color, sides }) });
      for (const side of sides) {
        expect(side.worst, `the Try again ring's ${side.side} side, drawn in ${ring.color}`).toBeLessThanOrEqual(RING_TOLERANCE);
      }
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `load-error-focused-${theme}.png`) });

      // Try again: the Library read again, with the Packs' Prompts; the add is not tried again
      await page.keyboard.press('Enter');

      await expect(page.getByTestId('prompt-card')).toHaveCount(DEFAULT_COUNT);
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toHaveCount(0);
      for (const pack of DEFAULTS) {
        await expect(page.getByRole('radio', { name: pack.name })).toBeVisible();
      }
      await expect(page.getByText("Couldn't add the prompts")).toHaveCount(0);
      await expect(page.getByTestId('welcome')).toHaveCount(0);
      expect(await readFailure(page)).toEqual({ packsStored: true, rejected: ['prompts'] });
      expect(await storage.getPrompts()).toHaveLength(DEFAULT_COUNT);
      expect((await storage.get<Record<string, unknown>>(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'done' });
    });
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`CR26 (${theme}): Try again reads the Prompts but not the Categories; Error Loading Data stays with Try again, the Library never shown in between, and the next Try again lists the ${String(DEFAULT_COUNT)} Prompts with the Packs' Categories`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 }, settings: { ...DEFAULT_SETTINGS, theme } });
      // Both reads fail after the add; at the first Try again the Prompts are read and the Categories are not
      await page.addInitScript(failTheNextLibraryReads, { message: READ_FAILURE, prompts: 1, categories: 2 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: WIDTH, height: HEIGHT });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      if (theme === 'dark') {
        await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      } else {
        await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
      }
      await page.getByRole('button', { name: 'Skip' }).click();
      await page.getByTestId('welcome-primary').click();

      const title = page.getByRole('heading', { name: ERROR_TITLE });
      const tryAgain = page.getByRole('button', { name: 'Try again' });
      await expect(title).toBeVisible();
      await expect.poll(async () => (await readFailure(page))?.rejected).toEqual(['prompts', 'categories']);
      await watchForCards(page);

      await tryAgain.click();

      // The Prompts read, the Categories not: the screen, with its way on, which stays while Try again
      // reads the Library (My-Prompt-Manager-ou48)
      await expect.poll(async () => (await readFailure(page))?.rejected).toEqual(['prompts', 'categories', 'categories']);
      await expect(title).toBeVisible();
      await expect(page.getByText(READ_FAILURE)).toBeVisible();
      await expect(tryAgain).toBeVisible();

      // At rest, the pointer off the button so it shows no hover
      await animationsDone(page);
      await page.mouse.move(2, HEIGHT - 2);
      await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `load-error-categories-${theme}.png`) });

      // No Prompt card was shown on the way, read at the last moment before the next Try again: the screen
      // stays during the reads, so its title is no sign that they have ended, and a card shown once they
      // have would come after an earlier look (My-Prompt-Manager-ou48, AC5)
      expect(await cardsAdded(page)).toBe(0);

      await tryAgain.click();

      // The whole Library: the Prompts, the Packs' Categories in the Library filter and on each card
      const cards = page.getByTestId('prompt-card');
      await expect(cards).toHaveCount(DEFAULT_COUNT);
      for (const pack of DEFAULTS) {
        await expect(page.getByRole('radio', { name: pack.name })).toBeVisible();
        await expect(cards.getByTitle(`Category: ${pack.name}`, { exact: true })).toHaveCount(pack.prompts.length);
      }
      await expect(title).toHaveCount(0);
      await expect(page.getByText("Couldn't add the prompts")).toHaveCount(0);
      expect((await readFailure(page))?.rejected).toEqual(['prompts', 'categories', 'categories']);
      expect(await storage.getPrompts()).toHaveLength(DEFAULT_COUNT);
      expect((await storage.get<Record<string, unknown>>(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'done' });
    });
  }

  test('AC4 (My-Prompt-Manager-ou48): Start empty at a first opening whose Categories read fails: Error Loading Data with Try again, the Welcome done, the editor waiting behind; Try again leads where Start empty leads, the empty Library and the editor on a new Prompt, the keyboard in its title field', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2, packs: [] }, settings: { ...DEFAULT_SETTINGS, theme: 'light' } });
    await page.addInitScript(failTheFirstCategoriesReads, { message: READ_FAILURE, count: 1 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: WIDTH, height: HEIGHT });
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await expect(page.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '2');
    const primary = page.getByTestId('welcome-primary');
    await expect(primary).toHaveText('Start empty');
    // The opening's own read of the Categories failed, behind the Welcome
    await expect.poll(() => categoriesReadsRejected(page)).toBe(1);

    await primary.press('Enter');

    const title = page.getByRole('heading', { name: ERROR_TITLE });
    const tryAgain = page.getByRole('button', { name: 'Try again' });
    await expect(title).toBeVisible();
    await expect(page.getByText(READ_FAILURE)).toBeVisible();
    await expect(page.getByTestId('welcome')).toHaveCount(0);
    await expect.poll(async () => (await storage.get<Record<string, unknown>>(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'done' });
    // The editor's 250ms go by behind the screen, which stays
    await page.waitForTimeout(500);
    await expect(title).toBeVisible();
    await expect(page.getByTestId('editor-sheet')).toHaveCount(0);

    await page.keyboard.press('Tab');
    await expect(tryAgain).toBeFocused();
    await page.keyboard.press('Enter');

    // Where Start empty leads: the empty Library, the editor on a new Prompt over it, the keyboard in its title field
    const editor = page.getByTestId('editor-sheet');
    await expect(editor).toBeVisible();
    await expect(title).toHaveCount(0);
    await expect(page.getByText('Your library is empty')).toBeAttached();
    const titleField = editor.getByLabel(/title/i);
    await expect(titleField).toHaveValue('');
    await expect(titleField).toBeFocused();
    await expect(page.getByTestId('prompt-card')).toHaveCount(0);
    expect(await categoriesReadsRejected(page)).toBe(1);
    expect(await storage.getPrompts()).toHaveLength(0);
    await animationsDone(page);
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'start-empty-after-try-again-light.png') });
  });
});

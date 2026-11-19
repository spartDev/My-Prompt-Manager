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

/**
 * In the page, before its own scripts: once a set that carries the Prompts has resolved (the Packs
 * stored), the next read of the Prompts rejects, once. Every other read and write goes through
 */
const failTheNextLibraryRead = (message: string): void => {
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
    if (state.packsStored && state.rejected.length === 0 && names.includes('prompts')) {
      state.rejected.push(names.join(','));
      return Promise.reject(new Error(message));
    }
    return get(keys);
  };
};

const readFailure = (page: Page): Promise<ReadFailure | undefined> =>
  page.evaluate(() => (window as Window & { __loadError?: ReadFailure }).__loadError);

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
      await page.addInitScript(failTheNextLibraryRead, READ_FAILURE);
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
});

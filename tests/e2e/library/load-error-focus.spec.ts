/**
 * E2E: where the keyboard is after Try again on Error Loading Data (My-Prompt-Manager-ou48, AC1), on
 * the built extension. chrome.storage.local is patched from the page's first script: the next reads of
 * the Prompts reject, as many as the test says, from the opening or once a write the test names has
 * landed; then the reads go through. Each of the four places Try again gives the keyboard:
 *
 * - The Library, at an ordinary opening (a Library with Prompts, no Welcome under way):
 *   - read failing twice (the opening and the first Try again): Enter on Try again leaves the keyboard
 *     on Try again, its focus ring (focus-primary) drawn whole, read back from the pixels; the screen
 *     never gives way on the way. The next Try again brings the Library, the keyboard on All;
 *   - read failing once: Enter on Try again brings the Library, the keyboard on its active Library
 *     filter, All, drawn as :focus-visible.
 * - The empty Library (no Prompt stored, read failing once): the keyboard on "Write your first prompt".
 * - Another Section: Work deleted from its Category sheet, the read of the Prompts after the deletion
 *   failing. Try again brings the Categories back, the keyboard on their tab, selected.
 * - The Welcome's exit with Packs (Skip, then Enter on "Add 9 prompts", the read of the Prompts after
 *   the add failing): Try again brings the Library, the keyboard on the first card's Copy.
 * - In each, the document never has the keyboard from the press of Try again on: an in-page probe reads
 *   document.activeElement at every animation frame and at every change of the document. The keyboard
 *   moves in the commit that shows its control (layout effects of LibraryFilterBar, LibraryView and
 *   TabBar); moved by a passive effect, it is on the document in between, and the probe sees it.
 *
 * - Try again busy (My-Prompt-Manager-p4y9): the read it makes held until the test lets it go, the
 *   button shows the Loading State's spinner and "Trying again...", aria-disabled, the keyboard on it
 *   and its focus ring whole; the read let go, the Library on All, the role=status saying it is back.
 * - Try again whose read fails again at once (the owner's decision on PR #610, RETRY_FAILURE_HOLD_MS):
 *   read from the animation frames from the press, "Trying again..." on every frame for 300 ms, wider
 *   than the idle button and never back to its width before, the keyboard on it at every frame; then
 *   Try again at its idle width, no sooner than 300 ms after the press, and the role=status saying the
 *   read failed again.
 *
 * Light and dark, popup 400 x 500. Screenshots in LOAD_ERROR_FOCUS_SCREENSHOTS
 * (test-results/load-error-focus when unset): try-again-failed-again-<theme>.png (the keyboard on Try
 * again after a Try again that failed), library-back-<theme>.png (the keyboard on All) and
 * try-again-busy-<theme>.png (Try again while it reads).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';
import { focusRingOf, RING_TOLERANCE, ringSides } from '../utils/focusRing';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOTS_DIR = process.env.LOAD_ERROR_FOCUS_SCREENSHOTS ?? 'test-results/load-error-focus';

const WIDTH = 400;
const HEIGHT = 500;

/** The ring of focus-primary: a 2px outline, 2px off the button */
const PRIMARY_RING = { width: 2, offset: 2 };

const ERROR_TITLE = 'Error Loading Data';
const READ_FAILURE = 'forced: the Prompts could not be read';

const PROMPTS = [
  createPromptSeed({ id: 'draft-email', title: 'Draft email', category: 'Work' }),
  createPromptSeed({ id: 'summarize', title: 'Summarize', category: 'Writing' }),
  createPromptSeed({ id: 'standup', title: 'Standup notes' })
];
const CATEGORIES = [
  createCategorySeed({ id: 'cat-work', name: 'Work', color: '#3B82F6' }),
  createCategorySeed({ id: 'cat-writing', name: 'Writing', color: '#10B981' })
];

/**
 * What the patch of the page records: whether its reads fail yet, how many reads of the Prompts it made
 * fail, and the read it holds, if any, with the way to let it go
 */
interface ReadFailure {
  failing: boolean;
  rejected: number;
  /** When each read was refused, by the page's performance.now() */
  rejectedAt: number[];
  held: boolean;
  release?: () => void;
}

/**
 * The reads of the Prompts to fail: how many, and from when, the opening or a resolved write carrying
 * `afterWriteOf`; with `holdNext`, the read after them waits until the test lets it go
 */
interface ReadsToFail {
  message: string;
  count: number;
  afterWriteOf?: 'prompts' | 'categories';
  holdNext?: boolean;
}

/**
 * In the page, before its own scripts: the next `count` reads of the Prompts reject, from the opening,
 * or once a set carrying `afterWriteOf` has resolved (the Packs added, a Category deleted). Every other
 * read and write goes through
 */
const failThePromptsReads = ({ message, count, afterWriteOf, holdNext = false }: ReadsToFail): void => {
  const state: ReadFailure = { failing: afterWriteOf === undefined, rejected: 0, rejectedAt: [], held: false };
  (window as Window & { __promptsReads?: ReadFailure }).__promptsReads = state;
  const local = chrome.storage.local;
  const get = local.get.bind(local) as (keys?: unknown) => Promise<Record<string, unknown>>;
  const set = local.set.bind(local) as (items: Record<string, unknown>) => Promise<void>;
  const patched = local as unknown as {
    get: (keys?: unknown) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
  };
  patched.set = (items) => {
    const written = set(items);
    if (afterWriteOf !== undefined && Object.keys(items).includes(afterWriteOf)) {
      written.then(() => { state.failing = true; }, () => undefined);
    }
    return written;
  };
  patched.get = (keys) => {
    const names = keys === null || keys === undefined ? [] : Array.isArray(keys) ? keys.map(String) : typeof keys === 'string' ? [keys] : Object.keys(keys);
    if (state.failing && names.includes('prompts') && state.rejected < count) {
      state.rejected += 1;
      state.rejectedAt.push(performance.now());
      return Promise.reject(new Error(message));
    }
    if (state.failing && names.includes('prompts') && holdNext && !state.held) {
      state.held = true;
      return new Promise((resolve, reject) => {
        state.release = () => { get(keys).then(resolve, reject); };
      });
    }
    return get(keys);
  };
};

/** Lets go the read of the Prompts the patch holds */
const releaseTheHeldRead = (page: Page): Promise<void> =>
  page.evaluate(() => { (window as Window & { __promptsReads?: ReadFailure }).__promptsReads?.release?.(); });

const rejectedReads = (page: Page): Promise<number | undefined> =>
  page.evaluate(() => (window as Window & { __promptsReads?: ReadFailure }).__promptsReads?.rejected);

const refusedAt = (page: Page): Promise<number[] | undefined> =>
  page.evaluate(() => (window as Window & { __promptsReads?: ReadFailure }).__promptsReads?.rejectedAt);

/**
 * How long Try again stays busy after its press when the read fails again: the owner's decision on PR
 * #610, about 300 ms (RETRY_FAILURE_HOLD_MS), written here as the number decided
 */
const FAILURE_HOLD_MS = 300;

/** What one animation frame showed of Try again: when, its label, busy or not, its width, and whether it has the keyboard */
interface TryAgainFrame {
  at: number;
  label: string;
  busy: boolean;
  width: number;
  keyboard: boolean;
}

/** The press of Try again, by the page's performance.now(), its width before, and the frames from the press on */
interface TryAgainFrames {
  idleWidth: number;
  pressedAt?: number;
  frames: TryAgainFrame[];
}

/**
 * In the page, the keyboard on Try again: notes the time of its press (the click Enter makes, caught
 * before the button's own handler), then what each animation frame shows of it for a second, timed
 * when the frame's callback runs, so after any commit the frame paints
 */
const watchTryAgain = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const button = document.activeElement as HTMLButtonElement;
    const watch: TryAgainFrames = { idleWidth: button.getBoundingClientRect().width, frames: [] };
    (window as Window & { __tryAgainFrames?: TryAgainFrames }).__tryAgainFrames = watch;
    window.addEventListener('click', () => { watch.pressedAt = performance.now(); }, { capture: true, once: true });
    const frame = (): void => {
      const now = performance.now();
      if (watch.pressedAt !== undefined) {
        watch.frames.push({
          at: now - watch.pressedAt,
          label: button.textContent ?? '',
          busy: button.getAttribute('aria-disabled') === 'true',
          width: button.getBoundingClientRect().width,
          keyboard: document.activeElement === button
        });
        if (now - watch.pressedAt > 1000) {
          return;
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

const tryAgainFrames = (page: Page): Promise<TryAgainFrames | undefined> =>
  page.evaluate(() => (window as Window & { __tryAgainFrames?: TryAgainFrames }).__tryAgainFrames);

/** What the probe saw: how many times it read the keyboard, and the times the document had it */
interface FocusProbe {
  samples: number;
  onDocument: string[];
}

/**
 * In the page: from now on, reads document.activeElement at every animation frame and after every
 * change of the document, and notes each time the keyboard is on no element (the body)
 */
const watchTheKeyboard = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const probe: FocusProbe = { samples: 0, onDocument: [] };
    (window as Window & { __focusProbe?: FocusProbe }).__focusProbe = probe;
    const read = (when: string): void => {
      probe.samples += 1;
      const active = document.activeElement;
      if (active === null || active === document.body) {
        probe.onDocument.push(`${when} at ${String(Math.round(performance.now()))}ms`);
      }
    };
    new MutationObserver(() => { read('a change of the document'); }).observe(document.body, { childList: true, subtree: true, attributes: true });
    const frame = (): void => {
      read('a frame');
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

const focusProbe = (page: Page): Promise<FocusProbe | undefined> =>
  page.evaluate(() => (window as Window & { __focusProbe?: FocusProbe }).__focusProbe);

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

/** Opens the popup at 400 x 500, its reads patched from the first script, and waits for the theme */
const openPopup = async (page: Page, extensionId: string, theme: 'light' | 'dark', reads: ReadsToFail): Promise<void> => {
  await page.addInitScript(failThePromptsReads, reads);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  } else {
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  }
};

/** A keyboard user's way to Error Loading Data's Try again: Tab, from where the keyboard is, until Try again has it */
const tabToTryAgain = async (page: Page): Promise<Locator> => {
  const tryAgain = page.getByRole('button', { name: 'Try again' });
  await expect(tryAgain).toBeVisible();
  for (let presses = 0; presses < 6 && !(await tryAgain.evaluate((element) => element === document.activeElement)); presses++) {
    await page.keyboard.press('Tab');
  }
  await expect(tryAgain).toBeFocused();
  return tryAgain;
};

/** The probe's reads since the press of Try again: some, and none that found the keyboard on the document */
const expectNeverOnTheDocument = async (page: Page, landing: string): Promise<void> => {
  const probe = await focusProbe(page);
  test.info().annotations.push({ type: 'keyboard', description: JSON.stringify({ landing, ...probe }) });
  expect(probe?.samples).toBeGreaterThan(0);
  expect(probe?.onDocument, `the reads of document.activeElement that found the keyboard on the document, on the way to ${landing}`).toEqual([]);
};

test.describe('Error Loading Data: the keyboard after Try again', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const failures of [2, 1] as const) {
      const title = failures === 2
        ? `the Prompts read fails twice (${theme}): Enter on Try again, refused again, leaves the keyboard on Try again with its ring drawn whole; the next Try again brings the Library, the keyboard on All; never on the document`
        : `the Prompts read fails once (${theme}): Enter on Try again brings the Library, the keyboard on its active Library filter, All; never on the document`;
      test(title, async ({ page, storage, extensionId }) => {
        await seedLibrary(storage, { categories: CATEGORIES, prompts: PROMPTS, settings: { ...DEFAULT_SETTINGS, theme } });
        await openPopup(page, extensionId, theme, { message: READ_FAILURE, count: failures });

        const heading = page.getByRole('heading', { name: ERROR_TITLE });
        const tryAgain = page.getByRole('button', { name: 'Try again' });
        await expect(heading).toBeVisible();
        await expect(page.getByText(READ_FAILURE)).toBeVisible();
        expect(await rejectedReads(page)).toBe(1);

        // A keyboard user: Tab to Try again, then Enter
        await page.keyboard.press('Tab');
        await expect(tryAgain).toBeFocused();
        await watchTheKeyboard(page);
        await page.keyboard.press('Enter');
        await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

        if (failures === 2) {
          await expect.poll(() => rejectedReads(page)).toBe(2);
          // Refused again: the screen, its Try again with the keyboard, the ring of focus-primary drawn whole
          await expect(heading).toBeVisible();
          await expect(tryAgain).toBeFocused();
          expect(await tryAgain.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
          await expect(page.getByTestId('prompt-card')).toHaveCount(0);
          // The Primary Button's transition-all brings the ring in over 200ms: read it once drawn
          await animationsDone(page);
          await page.mouse.move(2, HEIGHT - 2);
          const ring = await focusRingOf(tryAgain);
          expect({ style: ring.style, width: ring.width, reach: ring.reach }).toEqual({ style: 'solid', width: PRIMARY_RING.width, reach: PRIMARY_RING.width + PRIMARY_RING.offset });
          const sides = await ringSides(page, ring);
          test.info().annotations.push({ type: 'ring', description: JSON.stringify({ theme, color: ring.color, sides }) });
          for (const side of sides) {
            expect(side.worst, `the Try again ring's ${side.side} side, drawn in ${ring.color}`).toBeLessThanOrEqual(RING_TOLERANCE);
          }
          await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `try-again-failed-again-${theme}.png`) });

          await page.keyboard.press('Enter');
        }

        // The Library back: its Prompts, and the keyboard on All, the active Library filter
        await expect(page.getByTestId('prompt-card')).toHaveCount(PROMPTS.length);
        await expect(heading).toHaveCount(0);
        const all = page.getByRole('radio', { name: 'All' });
        await expect(all).toBeFocused();
        await expect(all).toBeChecked();
        expect(await all.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
        expect(await rejectedReads(page)).toBe(failures);

        await expectNeverOnTheDocument(page, `All (${theme}, ${String(failures)} failed reads)`);

        if (failures === 1) {
          await animationsDone(page);
          await page.mouse.move(2, HEIGHT - 2);
          await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `library-back-${theme}.png`) });
        }
      });
    }

    test(`the empty Library, its Prompts read failing once (${theme}): Enter on Try again brings it, the keyboard on "Write your first prompt"; never on the document`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, { categories: CATEGORIES, prompts: [], settings: { ...DEFAULT_SETTINGS, theme } });
      await openPopup(page, extensionId, theme, { message: READ_FAILURE, count: 1 });
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toBeVisible();
      await tabToTryAgain(page);
      await watchTheKeyboard(page);

      await page.keyboard.press('Enter');

      const writeFirst = page.getByTestId('library-empty').getByRole('button', { name: /write your first prompt/i });
      await expect(writeFirst).toBeFocused();
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toHaveCount(0);
      expect(await writeFirst.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      expect(await rejectedReads(page)).toBe(1);
      await expectNeverOnTheDocument(page, `Write your first prompt (${theme})`);
    });

    test(`another Section, the Prompts read after a Category's deletion failing (${theme}): Enter on Try again brings the Categories back, the keyboard on their tab; never on the document`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, { categories: CATEGORIES, prompts: PROMPTS, settings: { ...DEFAULT_SETTINGS, theme } });
      await openPopup(page, extensionId, theme, { message: READ_FAILURE, count: 1, afterWriteOf: 'categories' });
      await expect(page.getByTestId('prompt-card')).toHaveCount(PROMPTS.length);
      await page.getByTestId('tab-categories').click();
      await page.getByRole('button', { name: 'Edit category Work', exact: true }).click();
      await page.getByRole('dialog', { name: 'Edit category', exact: true }).getByRole('button', { name: /delete/i }).click();

      // The deletion stored, the read of the Prompts after it refused: Error Loading Data over the Categories
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toBeVisible();
      expect(await rejectedReads(page)).toBe(1);
      expect((await storage.getCategories()).map((category) => category.name)).not.toContain('Work');
      await tabToTryAgain(page);
      await watchTheKeyboard(page);

      await page.keyboard.press('Enter');

      const tab = page.getByRole('tab', { name: 'Categories' });
      await expect(tab).toBeFocused();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toHaveCount(0);
      expect(await tab.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      expect(await rejectedReads(page)).toBe(1);
      await expectNeverOnTheDocument(page, `the Categories tab (${theme})`);
    });

    test(`the Welcome's exit with Packs, the Prompts read after the add failing (${theme}): Enter on Try again brings the Library, the keyboard on the first card's Copy; never on the document`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 }, settings: { ...DEFAULT_SETTINGS, theme } });
      await openPopup(page, extensionId, theme, { message: READ_FAILURE, count: 1, afterWriteOf: 'prompts' });
      await expect(page.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '0');
      await page.getByRole('button', { name: 'Skip' }).click();
      await expect(page.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '2');
      await page.getByTestId('welcome-primary').press('Enter');

      // The Packs stored, the read of the Prompts after them refused: Error Loading Data
      await expect(page.getByTestId('welcome')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toBeVisible();
      expect(await rejectedReads(page)).toBe(1);
      await tabToTryAgain(page);
      await watchTheKeyboard(page);

      await page.keyboard.press('Enter');

      const firstCard = page.getByTestId('prompt-card').first();
      await expect(firstCard).toBeVisible();
      const copy = firstCard.getByRole('button', { name: /^Copy content of .+ to clipboard$/ });
      await expect(copy).toBeFocused();
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toHaveCount(0);
      expect(await copy.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      expect(await rejectedReads(page)).toBe(1);
      await expectNeverOnTheDocument(page, `the first card's Copy (${theme})`);
    });

    // CodeRabbit on PR #610 (src/App.tsx:568): the Copy asked by the Welcome's exit is still pending at
    // the press, and there is no card left to take the keyboard
    test(`the Welcome's exit with Packs, the Prompts read after the add failing, every Prompt deleted meanwhile from another surface (${theme}): Enter on Try again brings the empty Library, the keyboard on "Write your first prompt"; never on the document`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 }, settings: { ...DEFAULT_SETTINGS, theme } });
      await openPopup(page, extensionId, theme, { message: READ_FAILURE, count: 1, afterWriteOf: 'prompts' });
      await page.getByRole('button', { name: 'Skip' }).click();
      await expect(page.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '2');
      await page.getByTestId('welcome-primary').press('Enter');
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toBeVisible();
      expect(await rejectedReads(page)).toBe(1);
      expect(await storage.getPrompts()).not.toHaveLength(0);

      // What another surface's deletions leave in the store: this page is not told
      await storage.seedPrompts([]);
      await tabToTryAgain(page);
      await watchTheKeyboard(page);

      await page.keyboard.press('Enter');

      const writeFirst = page.getByTestId('library-empty').getByRole('button', { name: /write your first prompt/i });
      await expect(writeFirst).toBeFocused();
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toHaveCount(0);
      expect(await writeFirst.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      expect(await rejectedReads(page)).toBe(1);
      await expectNeverOnTheDocument(page, `Write your first prompt, the Copy asked (${theme})`);
    });

    test(`Try again busy, its read held (${theme}): the spinner and "Trying again...", aria-disabled, the keyboard on it with its ring whole; the read let go, the Library on All and the role=status says it is back; never on the document`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, { categories: CATEGORIES, prompts: PROMPTS, settings: { ...DEFAULT_SETTINGS, theme } });
      await openPopup(page, extensionId, theme, { message: READ_FAILURE, count: 1, holdNext: true });
      await tabToTryAgain(page);
      await watchTheKeyboard(page);

      await page.keyboard.press('Enter');

      // Busy while its read is held: the Loading State, the keyboard kept, its focus ring drawn whole
      const busy = page.getByRole('button', { name: 'Trying again...' });
      await expect(busy).toBeFocused();
      await expect(busy).toHaveAttribute('aria-disabled', 'true');
      // aria-disabled, never the disabled attribute: Chrome takes the keyboard from a disabled button
      expect(await busy.evaluate((element) => (element as HTMLButtonElement).disabled)).toBe(false);
      await expect(busy.locator('.animate-spin')).toBeVisible();
      expect(await busy.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toBeVisible();
      await expect(page.getByTestId('load-status')).toHaveText('');
      await animationsDone(page);
      await page.mouse.move(2, HEIGHT - 2);
      const ring = await focusRingOf(busy);
      expect({ style: ring.style, width: ring.width, reach: ring.reach }).toEqual({ style: 'solid', width: PRIMARY_RING.width, reach: PRIMARY_RING.width + PRIMARY_RING.offset });
      const sides = await ringSides(page, ring);
      test.info().annotations.push({ type: 'ring', description: JSON.stringify({ theme, busy: true, color: ring.color, sides }) });
      for (const side of sides) {
        expect(side.worst, `the busy Try again ring's ${side.side} side, drawn in ${ring.color}`).toBeLessThanOrEqual(RING_TOLERANCE);
      }
      await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `try-again-busy-${theme}.png`) });

      await releaseTheHeldRead(page);

      await expect(page.getByTestId('prompt-card')).toHaveCount(PROMPTS.length);
      await expect(page.getByRole('radio', { name: 'All' })).toBeFocused();
      await expect(page.getByTestId('load-status')).toHaveText('Your library is back');
      await expectNeverOnTheDocument(page, `All, after a busy Try again (${theme})`);
    });

    // The owner's decision on PR #610: a read that fails again within a frame or two still shows the
    // busy state long enough to be seen, where unheld it flashed for one frame
    test(`Try again whose read fails again at once (${theme}): "Trying again..." on every frame for ${String(FAILURE_HOLD_MS)} ms from the press, the keyboard on it, never back to its idle width before; then Try again, and the role=status says so`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, { categories: CATEGORIES, prompts: PROMPTS, settings: { ...DEFAULT_SETTINGS, theme } });
      await openPopup(page, extensionId, theme, { message: READ_FAILURE, count: 2 });
      const tryAgain = await tabToTryAgain(page);
      await watchTheKeyboard(page);
      await watchTryAgain(page);

      await page.keyboard.press('Enter');

      await expect(page.getByTestId('load-status')).toHaveText("Still couldn't read your library");
      await expect(tryAgain).toBeFocused();
      await expect(tryAgain).not.toHaveAttribute('aria-disabled');
      await expect(page.getByRole('heading', { name: ERROR_TITLE })).toBeVisible();
      await expect(page.getByTestId('prompt-card')).toHaveCount(0);
      expect(await rejectedReads(page)).toBe(2);
      await expect.poll(async () => (await tryAgainFrames(page))?.frames.at(-1)?.at ?? 0).toBeGreaterThan(1000);

      const watch = await tryAgainFrames(page);
      const pressedAt = watch?.pressedAt ?? Number.NaN;
      const frames = watch?.frames ?? [];
      const idleWidth = watch?.idleWidth ?? Number.NaN;
      const readFailedAt = ((await refusedAt(page))?.[1] ?? Number.NaN) - pressedAt;
      const held = frames.filter((frame) => frame.at < FAILURE_HOLD_MS);
      const firstIdle = frames.find((frame) => !frame.busy);
      const lastBusy = frames.filter((frame) => frame.busy).at(-1);
      const round = (ms: number | undefined): number | undefined => (ms === undefined ? undefined : Math.round(ms * 10) / 10);
      test.info().annotations.push({
        type: 'frames',
        description: JSON.stringify({
          theme,
          idleWidth,
          readFailedAt: round(readFailedAt),
          framesBefore300: held.length,
          busyWidths: [...new Set(held.map((frame) => frame.width))],
          firstBusy: round(frames.find((frame) => frame.busy)?.at),
          lastBusy: round(lastBusy?.at),
          firstIdle: firstIdle === undefined ? undefined : { at: round(firstIdle.at), label: firstIdle.label, width: firstIdle.width }
        })
      });

      // The keyboard on Try again at every frame: Chrome takes it from a disabled button a few frames on
      expect(frames.filter((frame) => !frame.keyboard), 'the frames with the keyboard off Try again').toEqual([]);
      // The read failed well before the hold ends, so what follows is the hold, not a slow read
      expect(readFailedAt).toBeLessThan(FAILURE_HOLD_MS);
      // Busy on every frame before 300 ms, wider than the idle button, never back to it
      expect(held.length).toBeGreaterThan(0);
      expect(held.filter((frame) => !(frame.busy && frame.label === 'Trying again...' && frame.width > idleWidth))).toEqual([]);
      // Then Try again, at its idle width, no sooner than 300 ms after the press
      expect(firstIdle?.at).toBeGreaterThanOrEqual(FAILURE_HOLD_MS);
      expect(firstIdle?.label).toBe('Try again');
      expect(firstIdle?.width).toBeCloseTo(idleWidth, 1);
      await expectNeverOnTheDocument(page, `Try again, its read failing again at once (${theme})`);
    });
  }
});

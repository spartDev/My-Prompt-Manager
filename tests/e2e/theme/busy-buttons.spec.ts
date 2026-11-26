/**
 * E2E: busy buttons that keep the keyboard (My-Prompt-Manager-tg6l), on the built extension: Import in
 * Settings while a Backup is restored, and a starter Category of the empty Categories while it is
 * created. chrome.storage.local is patched from the page's first script: once the test names a key,
 * the next write of it (`prompts` for Import, `categories` for a starter) waits until the test lets it
 * go, so the busy state lasts as long as the test reads it.
 *
 * While it waits, the control follows the Loading State of docs/DESIGN_GUIDELINES.md: the spinner and
 * its busy name, aria-disabled and never disabled, the keyboard on it, the busy cursor and no hover
 * change, drawn at full strength (its opacity and every ancestor's 1), its focus ring whole and at
 * least 3:1 against the surface beside it, both read back from the pixels; a press meanwhile does
 * nothing. Let go, the import or the creation ends as it does unheld. The control is measured as the
 * page's focused element before its busy state is asserted, so a build that dims it reports its ratio.
 *
 * Light and dark, in the popup (400 x 500) and a side panel 320 x 600. Screenshots in
 * BUSY_BUTTONS_SCREENSHOTS (test-results/busy-buttons when unset): import-busy-<surface>-<theme>.png
 * and starter-busy-<surface>-<theme>.png.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures/extension';
import { focusRingOf, RING_TOLERANCE, ringContrast, ringSides } from '../utils/focusRing';
import { readWhileHovering } from '../utils/hover';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOTS_DIR = process.env.BUSY_BUTTONS_SCREENSHOTS ?? 'test-results/busy-buttons';

/** What a focus indicator needs against the colors beside it (WCAG 1.4.11) */
const FOCUS_CONTRAST = 3;

/** focus-secondary (Import) and focus-interactive (a starter): a 2px outline, 1px off the control */
const RING = { width: 2, offset: 1 };

const SURFACES = [
  { name: 'popup', file: 'popup', width: 400, height: 500 },
  { name: 'sidepanel-320', file: 'sidepanel', width: 320, height: 600 }
] as const;

/** Import's fill and a starter's border, which a hover must not change while busy */
const COLORS = {
  light: { card: 'rgb(255, 255, 255)', border: 'rgb(236, 230, 245)' },
  dark: { card: 'rgb(35, 28, 52)', border: 'rgb(53, 44, 76)' }
} as const;

const PROMPTS = [
  createPromptSeed({ id: 'standup', title: 'Standup notes', category: 'Uncategorized' }),
  createPromptSeed({ id: 'summarize', title: 'Summarize', category: 'Uncategorized' })
];
const BACKUP = {
  version: '1.0',
  prompts: [createPromptSeed({ id: 'restored', title: 'Restored prompt', category: 'Uncategorized' })],
  categories: []
};

/** What the patch of the page records: the key whose next write waits, its writes, and the way to let the held one go */
interface HeldWrite {
  key: string | null;
  writes: number;
  held: boolean;
  release?: () => void;
}

/** In the page, before its own scripts: once `key` is named, its next write waits for the test; every other goes through */
const holdTheNextWrite = (): void => {
  const state: HeldWrite = { key: null, writes: 0, held: false };
  (window as Window & { __heldWrite?: HeldWrite }).__heldWrite = state;
  const local = chrome.storage.local;
  const set = local.set.bind(local) as (items: Record<string, unknown>) => Promise<void>;
  (local as unknown as { set: (items: Record<string, unknown>) => Promise<void> }).set = (items) => {
    if (state.key === null || !Object.keys(items).includes(state.key)) {
      return set(items);
    }
    state.writes += 1;
    if (state.held) {
      return set(items);
    }
    state.held = true;
    return new Promise((resolve, reject) => {
      state.release = () => { set(items).then(resolve, reject); };
    });
  };
};

const holdNextWriteOf = (page: Page, key: 'prompts' | 'categories'): Promise<void> =>
  page.evaluate((name) => {
    const state = (window as Window & { __heldWrite?: HeldWrite }).__heldWrite;
    if (state) {
      state.key = name;
    }
  }, key);

const heldWrites = (page: Page): Promise<{ writes: number; held: boolean } | undefined> =>
  page.evaluate(() => {
    const state = (window as Window & { __heldWrite?: HeldWrite }).__heldWrite;
    return state && { writes: state.writes, held: state.held };
  });

const releaseTheHeldWrite = (page: Page): Promise<void> =>
  page.evaluate(() => { (window as Window & { __heldWrite?: HeldWrite }).__heldWrite?.release?.(); });

/** Resolves once every finite animation of the page has ended (the spinner turns for good) */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });

const open = async (page: Page, extensionId: string, surface: (typeof SURFACES)[number], theme: 'light' | 'dark'): Promise<void> => {
  await page.addInitScript(holdTheNextWrite);
  await page.setViewportSize({ width: surface.width, height: surface.height });
  await page.goto(`chrome-extension://${extensionId}/src/${surface.file}.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

/**
 * The control with the keyboard, as drawn: its opacity times its ancestors', its cursor, its ring's
 * box and four sides, and the ring's lowest contrast against the surface beside it. Read with the
 * pointer away, once the page's finite animations have ended
 */
const measureFocused = async (page: Page, label: string) => {
  await page.mouse.move(1, 1);
  await animationsDone(page);
  const focused = page.locator(':focus');
  const { opacity, cursor } = await focused.evaluate((element) => {
    let product = 1;
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      product *= Number(getComputedStyle(node).opacity);
    }
    return { opacity: product, cursor: getComputedStyle(element).cursor };
  });
  const ring = await focusRingOf(focused);
  const sides = await ringSides(page, ring);
  const contrast = await ringContrast(page, ring);
  test.info().annotations.push({ type: 'busy', description: JSON.stringify({ label, opacity, cursor, ring, sides, contrast }) });
  return { opacity, cursor, ring, sides, contrast };
};

/** The Loading State at full strength: opacity 1, the busy cursor, a ring whole and at least 3:1 */
const expectFullStrength = (measured: Awaited<ReturnType<typeof measureFocused>>, label: string): void => {
  const { opacity, cursor, ring, sides, contrast } = measured;
  expect.soft(opacity, `${label}: its opacity times its ancestors'`).toBe(1);
  expect.soft(contrast.lowest, `${label}: its ring ${contrast.ring} against ${contrast.surface}, at its lowest of ${String(contrast.samples)} points`).toBeGreaterThanOrEqual(FOCUS_CONTRAST);
  expect.soft({ style: ring.style, width: ring.width, reach: ring.reach }, `${label}: its ring`).toEqual({ style: 'solid', width: RING.width, reach: RING.width + RING.offset });
  for (const side of sides) {
    expect.soft(side.worst, `${label}: its ring's ${side.side} side, drawn in ${ring.color}`).toBeLessThanOrEqual(RING_TOLERANCE);
  }
  expect.soft(cursor, `${label}: its cursor`).toBe('wait');
};

/**
 * A press of the pointer on the middle of `locator`, as a person makes it. Playwright's click() waits
 * for a button to be enabled, and takes an aria-disabled one for disabled
 */
const pressWithThePointer = async (locator: Locator): Promise<void> => {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('The control to press is not on the screen');
  }
  await locator.page().mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

/** Whether `locator` is under the pointer, and its color `property` there */
const underThePointer = (locator: Locator, property: 'background-color' | 'border-top-color') => () =>
  locator.evaluate((element, name) => ({ hovered: element.matches(':hover'), color: getComputedStyle(element).getPropertyValue(name) }), property);

test.describe('Busy buttons that keep the keyboard', () => {
  test.beforeAll(async () => {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const surface of SURFACES) {
      test(`Import while it restores a Backup (${surface.name}, ${theme}): the spinner, aria-disabled, the keyboard on it at full strength, its ring whole and 3:1 or more; a press does nothing; then the Backup restored`, async ({ page, storage, extensionId }) => {
        await seedLibrary(storage, { prompts: PROMPTS, settings: { theme } });
        await open(page, extensionId, surface, theme);
        await page.getByTestId('tab-settings').click();
        await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
        let fileChoosers = 0;
        page.on('filechooser', () => { fileChoosers += 1; });

        // A keyboard user on Import, Enter, then the Backup chosen
        const importButton = page.getByRole('button', { name: 'Import', exact: true });
        await importButton.evaluate((element) => { element.scrollIntoView({ block: 'center' }); });
        await importButton.focus();
        await holdNextWriteOf(page, 'prompts');
        const chooser = page.waitForEvent('filechooser');
        await page.keyboard.press('Enter');
        await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(BACKUP)) });
        await expect.poll(async () => (await heldWrites(page))?.held).toBe(true);

        // Measured first, as the focused element: a dimmed build reports its ratio here
        const measured = await measureFocused(page, `Import busy (${surface.name}, ${theme})`);
        const busy = page.getByRole('button', { name: 'Importing...' });
        await expect(busy).toBeFocused();
        await expect(busy).toHaveAttribute('aria-disabled', 'true');
        expect(await busy.evaluate((element) => (element as HTMLButtonElement).disabled)).toBe(false);
        await expect(busy.locator('.animate-spin')).toBeVisible();
        expectFullStrength(measured, `Import busy (${surface.name}, ${theme})`);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `import-busy-${surface.name}-${theme}.png`) });

        // No hover change, and a press does nothing: no file chooser, no other write, the keyboard kept
        await readWhileHovering(busy, underThePointer(busy, 'background-color')).toEqual({ hovered: true, color: COLORS[theme].card });
        await pressWithThePointer(busy);
        await page.keyboard.press('Enter');
        await expect(busy).toBeFocused();
        expect(fileChoosers).toBe(1);
        expect(await heldWrites(page)).toEqual({ writes: 1, held: true });
        expect(await storage.getPrompts()).toHaveLength(PROMPTS.length);

        await releaseTheHeldWrite(page);

        await expect(page.getByRole('status').filter({ hasText: 'Backup imported' })).toBeVisible();
        await expect(importButton).toBeFocused();
        await expect(importButton).not.toHaveAttribute('aria-disabled');
        expect(await storage.getPrompts()).toHaveLength(PROMPTS.length + 1);
        expect(fileChoosers).toBe(1);
      });

      test(`a starter Category while it is created (${surface.name}, ${theme}): the spinner, aria-disabled, the keyboard on it at full strength, its ring whole and 3:1 or more; a press on it or another does nothing; then the list`, async ({ page, storage, extensionId }) => {
        await seedLibrary(storage, { settings: { theme } });
        await open(page, extensionId, surface, theme);
        await page.getByTestId('tab-categories').click();
        const empty = page.getByTestId('categories-empty');
        await expect(empty).toBeVisible();

        // A keyboard user on Work, Enter
        const work = empty.getByRole('button', { name: 'Create category Work' });
        await work.focus();
        await holdNextWriteOf(page, 'categories');
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await heldWrites(page))?.held).toBe(true);

        const measured = await measureFocused(page, `Work busy (${surface.name}, ${theme})`);
        const busy = empty.getByRole('button', { name: 'Creating category Work...' });
        await expect(busy).toBeFocused();
        await expect(busy).toHaveAttribute('aria-disabled', 'true');
        expect(await busy.evaluate((element) => (element as HTMLButtonElement).disabled)).toBe(false);
        await expect(busy.locator('.animate-spin')).toBeVisible();
        expectFullStrength(measured, `Work busy (${surface.name}, ${theme})`);
        // The other starters wait too, at full strength
        const writing = empty.getByRole('button', { name: 'Create category Writing' });
        await expect(writing).toHaveAttribute('aria-disabled', 'true');
        await expect(writing).toHaveCSS('opacity', '1');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `starter-busy-${surface.name}-${theme}.png`) });

        // No hover change, and a press does nothing: no second Category written, the keyboard kept
        await readWhileHovering(busy, underThePointer(busy, 'border-top-color')).toEqual({ hovered: true, color: COLORS[theme].border });
        await pressWithThePointer(busy);
        await page.keyboard.press('Enter');
        await pressWithThePointer(writing);
        expect(await heldWrites(page)).toEqual({ writes: 1, held: true });
        // The keyboard reaches the busy starter: Writing, then Shift+Tab
        await page.keyboard.press('Shift+Tab');
        await expect(busy).toBeFocused();

        await releaseTheHeldWrite(page);

        await expect(page.getByTestId('category-row')).toHaveCount(2);
        await expect(page.getByRole('button', { name: 'Add category' })).toBeFocused();
        expect((await storage.getCategories()).map((category) => category.name).sort()).toEqual(['Uncategorized', 'Work']);
        expect((await heldWrites(page))?.writes).toBe(1);
      });
    }
  }
});

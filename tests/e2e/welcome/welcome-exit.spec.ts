/**
 * E2E: leaving the Welcome for a ready Library, in the real extension (My-Prompt-Manager-ojz.9).
 *
 * - S2, AC1: Skip, then "Add 9 prompts": the Library lists the Prompts of the Packs selected on All,
 *   with the Notification "9 prompts added" and the Packs as its sub; neither the Library's loading
 *   state nor its empty state ever shows on the way; the Prompts stored in their Packs' Categories
 *   and the Welcome recorded finished.
 * - S3, AC2: no Pack, "Start empty": the empty Library, then the editor on a new Prompt about 250ms
 *   later, both times read in the page as they are first seen. The exact 250ms is proven with fake
 *   timers in src/hooks/__tests__/useWelcomeExit.test.ts.
 * - S12, AC5: from the store a first install leaves, the popup opened, Skip, "Add 9 prompts", then
 *   one click on a card's copy button: the clipboard holds that Prompt's content, read back from
 *   the clipboard. The clicks are counted and the time from opening the popup to the clipboard
 *   holding the content is measured, the script going as fast as the page lets it (a floor: the
 *   reading model is My-Prompt-Manager-ojz.13's), over several runs, in
 *   test-results/welcome/first-copy-times.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { BrowserContext, Locator, Page } from '@playwright/test';

import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { WHATS_NEW_KEY } from '../../../src/whatsNew/storage';
import { createStorageController, type ExtensionStorage, expect, test, waitForBackgroundTarget, waitForFirstInstallRecords } from '../fixtures/extension';

const OUTPUT_DIR = 'test-results/welcome';

/** How many runs the first-copy probe times */
const COPY_RUNS = 5;

/** The first copy must come within this of the first opening (the spec's target) */
const FIRST_COPY_TARGET_MS = 60_000;

/** What the clipboard holds before each run: no Prompt has it, so the read sees that run's copy */
const CLIPBOARD_BEFORE = '-';

const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected);
const DEFAULT_PROMPTS = DEFAULTS.flatMap((pack) => pack.prompts);
const ADDED = `${String(DEFAULT_PROMPTS.length)} prompts added`;
const DEFAULT_NAMES = DEFAULTS.map((pack) => pack.name).join(', ');

/** What the page notes, from its first script on: when each part of the way out was first in the document */
interface ExitProbe {
  libraryAt?: number;
  editorAt?: number;
  loadingSeen?: boolean;
  emptySeen?: boolean;
  copiedAt?: number;
}

type ProbeWindow = typeof globalThis & { welcomeExitProbe: ExitProbe };

/**
 * Notes, in the page, the first time the Library (its Section), the editor, the Library's loading
 * state and its empty state are in the document, and when a copy to the clipboard has landed
 */
const probeTheExit = async (page: Page): Promise<void> => {
  await page.addInitScript((before: string) => {
    const probe: ExitProbe = {};
    (globalThis as ProbeWindow).welcomeExitProbe = probe;
    const look = (records: readonly MutationRecord[]): void => {
      const now = performance.now();
      if (probe.libraryAt === undefined && document.querySelector('[data-testid="section"]')) {
        probe.libraryAt = now;
      }
      if (probe.editorAt === undefined && document.querySelector('[data-testid="editor-sheet"]')) {
        probe.editorAt = now;
      }
      // Each node added, even one gone again by now
      for (const node of records.flatMap((record) => [...record.addedNodes])) {
        const text = node.textContent ?? '';
        probe.loadingSeen ||= text.includes('Loading your prompts');
        probe.emptySeen ||= text.includes('Your library is empty');
      }
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
    // The clipboard itself is read back by the test; this only notes when the copy landed
    const clipboard = navigator.clipboard;
    const write = clipboard.writeText.bind(clipboard);
    clipboard.writeText = async (data: string): Promise<void> => {
      await write(data);
      if (data !== before) {
        probe.copiedAt = performance.now();
      }
    };
  }, CLIPBOARD_BEFORE);
};

const probeOf = (page: Page): Promise<ExitProbe> => page.evaluate(() => (globalThis as ProbeWindow).welcomeExitProbe);

const openPopup = async (page: Page, extensionId: string): Promise<void> => {
  await page.setViewportSize({ width: 400, height: 500 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
};

const welcome = (page: Page) => page.getByTestId('welcome');
const primary = (page: Page) => page.getByTestId('welcome-primary');
const cards = (page: Page) => page.getByTestId('prompt-card');

const recordOf = async (storage: ExtensionStorage, key: string): Promise<unknown> => (await storage.get<Record<string, unknown>>(key))[key];

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

test.describe('Leaving the Welcome in the real extension', () => {
  test('S2, AC1: Skip, then Add 9 prompts: the Library lists them on All with "9 prompts added" and the Packs named, no loading or empty state on the way, the Welcome recorded finished', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
    await probeTheExit(page);
    await openPopup(page, extensionId);
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '0');

    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_PROMPTS.length)} prompts`);
    await primary(page).click();

    await expect(welcome(page)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(DEFAULT_PROMPTS.length);
    const titles = await cards(page).getByRole('heading').allTextContents();
    expect(titles.sort()).toEqual(DEFAULT_PROMPTS.map((prompt) => prompt.title).sort());
    const notification = page.getByTestId('toast');
    await expect(notification).toHaveAttribute('data-type', 'success');
    await expect(notification.getByText(ADDED, { exact: true })).toBeVisible();
    await expect(notification.getByText(DEFAULT_NAMES, { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^All/ })).toHaveAttribute('aria-checked', 'true');
    expect(await probeOf(page)).toMatchObject({ loadingSeen: false, emptySeen: false });

    const prompts = await storage.getPrompts();
    expect(prompts.map(({ title, content, category }) => ({ title, content, category }))).toEqual(
      DEFAULTS.flatMap((pack) => pack.prompts.map(({ title, content }) => ({ title, content, category: pack.name })))
    );
    const categories = await storage.getCategories();
    for (const pack of DEFAULTS) {
      expect(categories).toContainEqual(expect.objectContaining({ name: pack.name, color: pack.color }));
    }
    await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    await expect(page.getByRole('dialog', { name: /what.s new/i })).toHaveCount(0);
  });

  test('S3, AC2: no Pack, Start empty: the empty Library, then the editor on a new Prompt about 250ms later', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2, packs: [] } });
    await probeTheExit(page);
    await openPopup(page, extensionId);
    await expect(primary(page)).toHaveText('Start empty');

    await primary(page).click();

    const editor = page.getByTestId('editor-sheet');
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel(/title/i)).toHaveValue('');
    const { libraryAt, editorAt, emptySeen } = await probeOf(page);
    expect(emptySeen, 'the empty Library showed before the editor').toBe(true);
    expect(libraryAt).toBeDefined();
    expect(editorAt).toBeDefined();
    const delay = (editorAt ?? 0) - (libraryAt ?? 0);
    test.info().annotations.push({ type: 'Library to editor (ms)', description: delay.toFixed(1) });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUTPUT_DIR, 'start-empty-editor-delay.json'), `${JSON.stringify({ libraryAt, editorAt, delay }, null, 2)}\n`);
    // The timer starts at the click, a little before the Library is in the document; a loaded machine may run it late
    expect(delay).toBeGreaterThanOrEqual(200);
    expect(delay).toBeLessThan(1_000);

    await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    expect(await storage.getPrompts()).toEqual([]);
  });

  test(`S12, AC5: from a first install, Skip, Add 9 prompts, then one click on a card's copy button puts that Prompt's content in the clipboard, under ${String(FIRST_COPY_TARGET_MS / 1000)}s, over ${String(COPY_RUNS)} runs`, async ({ context, extensionId }) => {
    test.slow();
    const storage = createStorageController(await waitForBackgroundTarget(context));
    // The store a first install leaves: the Welcome pending at its first step, over an empty Library
    await waitForFirstInstallRecords(storage);
    const installed = await storage.get<Record<string, unknown>>([WELCOME_KEY, WHATS_NEW_KEY]);
    // CDP takes a chrome-extension:// origin for an opaque one: granted to every origin of this test's own browser
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await clearClipboard(context, extensionId);

    const runs: { clicks: number; clicksAfterWelcome: number; wallMs: number; pageMs: number; title: string }[] = [];
    for (let run = 0; run < COPY_RUNS; run++) {
      if (run > 0) {
        // The same first install again: nothing else in storage
        await storage.reset();
        await storage.seed(installed);
      }
      const page = await context.newPage();
      await probeTheExit(page);
      runs.push(await firstCopy(page, extensionId));
      await page.close();
      await clearClipboard(context, extensionId);
    }

    const wall = runs.map((run) => run.wallMs);
    const inPage = runs.map((run) => run.pageMs);
    const report = {
      runs,
      clicks: runs[0]?.clicks,
      clicksAfterWelcome: runs[0]?.clicksAfterWelcome,
      wallMs: { median: median(wall), max: Math.max(...wall) },
      pageMs: { median: median(inPage), max: Math.max(...inPage) }
    };
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUTPUT_DIR, 'first-copy-times.json'), `${JSON.stringify(report, null, 2)}\n`);
    test.info().annotations.push({ type: 'first copy', description: JSON.stringify({ clicks: report.clicks, wallMs: report.wallMs, pageMs: report.pageMs }) });

    for (const run of runs) {
      // Skip, the primary button, the copy button: two after the Welcome's last step, one after the Welcome
      expect(run.clicks).toBe(3);
      expect(run.clicksAfterWelcome).toBe(1);
      expect(run.wallMs).toBeLessThan(FIRST_COPY_TARGET_MS);
    }
  });
});

/** Puts CLIPBOARD_BEFORE in the clipboard, from a page of the extension that is not timed */
const clearClipboard = async (context: BrowserContext, extensionId: string): Promise<void> => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
  await page.evaluate((text) => navigator.clipboard.writeText(text), CLIPBOARD_BEFORE);
  await page.close();
};

/**
 * One run of the first copy: the popup opened on the Welcome, Skip, the primary button, then the copy
 * button of the Library's first card, each click counted; done once the clipboard holds that card's
 * Prompt. Timed from just before the popup opens (wall clock, up to the clipboard read back) and from
 * the popup's navigation start to the copy landing (in the page)
 */
const firstCopy = async (
  page: Page,
  extensionId: string
): Promise<{ clicks: number; clicksAfterWelcome: number; wallMs: number; pageMs: number; title: string }> => {
  let clicks = 0;
  const click = async (target: Locator): Promise<void> => {
    clicks++;
    await target.click();
  };

  const startedAt = Date.now();
  await openPopup(page, extensionId);
  await click(page.getByRole('button', { name: 'Skip' }));
  await click(primary(page));
  await expect(welcome(page)).toHaveCount(0);
  const clicksInWelcome = clicks;

  const card = cards(page).first();
  const title = (await card.getByRole('heading').textContent()) ?? '';
  await click(card.getByRole('button', { name: /^Copy content of / }));
  const content = PACKS.flatMap((pack) => pack.prompts).find((prompt) => prompt.title === title)?.content;
  expect(content, `the first card, ${title}, is a Prompt of the Packs`).toBeDefined();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()), { intervals: [5] }).toBe(content);
  const wallMs = Date.now() - startedAt;

  const { copiedAt } = await probeOf(page);
  expect(copiedAt).toBeDefined();
  return { clicks, clicksAfterWelcome: clicks - clicksInWelcome, wallMs, pageMs: copiedAt ?? Number.NaN, title };
};

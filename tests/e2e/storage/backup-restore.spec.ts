/**
 * E2E: restoring a valid Backup from Settings > Import (My-Prompt-Manager-aqe)
 *
 * The Backup is the file Settings > Export writes (through the save picker, which the spec stands in
 * for, since Playwright cannot drive Chrome's native dialog). The Library is cleared, the file is imported,
 * and its Prompts and Categories are back: in storage with every field, in the Library with their
 * Category chips, and their text Verbatim in the edit form. Invalid files and imports stopped by
 * storage are covered by theme/settings.spec.ts and storage/library-size-limit.spec.ts.
 * Also captures light/dark screenshots as visual proof (test-results/backup-restore/).
 */

import type { Page } from '@playwright/test';

import { DEFAULT_CATEGORY } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/backup-restore';

const categories = [
  createCategorySeed({ id: 'work', name: 'Work', color: '#059669' }),
  createCategorySeed({ id: 'writing', name: 'Writing', color: '#DB2777' }),
];

// Verbatim: markup, entities, quotes, Variables, indentation, trailing spaces and blank lines stay as stored
const prompts = [
  createPromptSeed({
    id: 'release',
    title: 'Release checklist',
    content: '<b>Ship</b> & "verify" the build:\n  1. tag v2.0\n  2. run `npm test`  \n\nDone <script>alert(1)</script>',
    category: 'Work',
    createdAt: Date.now() - 120_000,
  }),
  createPromptSeed({
    id: 'translate',
    title: 'Translate a text',
    content: 'Translate {{text}} into {{ language }}.',
    category: 'Writing',
    createdAt: Date.now() - 60_000,
  }),
  createPromptSeed({
    id: 'plain',
    title: 'Summarize the thread',
    content: 'Summarize the thread so far in five bullet points.',
    category: DEFAULT_CATEGORY,
    createdAt: Date.now(),
  }),
];

/** Stands in for Chrome's save dialog: what Export writes lands in window.__savedBackup */
const captureSavedFiles = async (page: Page) => {
  await page.addInitScript(() => {
    const target = window as unknown as { __savedBackup?: string; showSaveFilePicker: unknown };
    target.showSaveFilePicker = () =>
      Promise.resolve({
        createWritable: () =>
          Promise.resolve({
            write: (content: string) => {
              target.__savedBackup = content;
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
      });
  });
};

const openSettings = async (page: Page, extensionId: string) => {
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
  await page.getByTestId('tab-settings').click();
};

test.describe('Backup restore', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`an exported Backup imported into an empty Library brings back its Prompts and Categories, text Verbatim (${theme})`, async ({
      page,
      storage,
      extensionId,
    }) => {
      await seedLibrary(storage, { prompts, categories, settings: { theme } });
      await page.setViewportSize({ width: 400, height: 760 });
      await captureSavedFiles(page);
      await openSettings(page, extensionId);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

      // The Backup: the file Export writes
      await page.getByRole('button', { name: 'Export', exact: true }).click();
      await expect.poll(() => page.evaluate(() => (window as unknown as { __savedBackup?: string }).__savedBackup)).toBeDefined();
      const backup = (await page.evaluate(() => (window as unknown as { __savedBackup?: string }).__savedBackup)) ?? '';
      expect((JSON.parse(backup) as { prompts: unknown[] }).prompts).toHaveLength(prompts.length);
      const exported = await storage.get<{ prompts: unknown[]; categories: unknown[] }>(['prompts', 'categories']);

      // An empty Library, the theme kept
      await storage.reset();
      await seedLibrary(storage, { settings: { theme } });
      await openSettings(page, extensionId);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      expect(await storage.getPrompts()).toEqual([]);

      const fileChooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Import', exact: true }).click();
      await (await fileChooser).setFiles({ name: 'my-prompt-manager-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
      await expect(page.getByText(/^Successfully imported/)).toBeVisible();

      // Storage: every Prompt and Category as exported, in full
      const restored = await storage.get<{ prompts: unknown[]; categories: unknown[] }>(['prompts', 'categories']);
      expect(restored.prompts).toEqual(exported.prompts);
      expect(restored.categories).toEqual(expect.arrayContaining(exported.categories));
      expect(restored.categories).toHaveLength(exported.categories.length);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/settings-${theme}.png`, animations: 'disabled' });

      // Library: every Prompt with its Category chip
      await page.getByTestId('tab-library').click();
      await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
      for (const prompt of prompts) {
        const card = page.getByTestId('prompt-card').filter({ has: page.getByRole('heading', { name: prompt.title }) });
        await expect(card.getByText(prompt.category, { exact: true })).toBeVisible();
      }
      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-${theme}.png`, animations: 'disabled' });

      // Verbatim: the edit form shows the text exactly as it was exported
      const card = page.getByTestId('prompt-card').filter({ has: page.getByRole('heading', { name: 'Release checklist' }) });
      await card.getByRole('button', { name: /^Edit / }).click();
      await expect(page.getByLabel('Content', { exact: true })).toHaveValue(prompts[0].content);
    });
  }
});

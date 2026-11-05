/**
 * E2E: what a Settings import tells the user when it does not restore everything
 *
 * - My-Prompt-Manager-1xi: a toast shows 80 characters, so the titles and reasons of the skipped
 *   Prompts stay in the Backup & Restore card, every one in full, until dismissed.
 * - My-Prompt-Manager-5ar: an import stopped by an error other than storage says how many Prompts
 *   were imported before it stopped, and why.
 * - My-Prompt-Manager-lqu: Data & Storage reads "1 prompt" and "1 category".
 *
 * Also captures light/dark screenshots as visual proof (test-results/import-report/).
 */

import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/import-report';

const openSettings = async (page: Page, extensionId: string, theme: 'light' | 'dark') => {
  await page.setViewportSize({ width: 400, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
  await page.getByTestId('tab-settings').click();
};

const importBackup = async (page: Page, backup: unknown) => {
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await (await fileChooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
};

test.describe('Settings import report', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`lists every skipped Prompt with its reason in full (${theme})`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, { settings: { theme } });
      await openSettings(page, extensionId, theme);

      const titles = [
        'Quarterly business review summary for the leadership team',
        'Onboarding checklist for new engineers joining the platform squad',
        'Blog post outline about migrating a legacy monolith to services'
      ];
      // Content over 20,000 characters is refused at Admission: those Prompts are skipped
      const backup = {
        prompts: [
          createPromptSeed({ id: 'kept', title: 'Weekly report', category: 'Uncategorized' }),
          ...titles.map((title, i) => createPromptSeed({ id: `refused-${String(i)}`, title, content: 'x'.repeat(20_001), category: 'Uncategorized' }))
        ],
        categories: []
      };
      await importBackup(page, backup);

      await expect(page.getByText('Imported 1 prompt and 0 categories. Skipped 3: see Backup & Restore.')).toBeVisible();
      const report = page.getByRole('status', { name: 'Import report' });
      await expect(report.getByText('Skipped 3 items')).toBeVisible();
      for (const title of titles) {
        await expect(report.getByRole('listitem').filter({ hasText: `"${title}"` })).toContainText('Content cannot exceed 20,000 characters');
      }
      // One Prompt and the default Category, in the singular
      await expect(page.getByText('1 prompt', { exact: true })).toBeVisible();
      await expect(page.getByText('1 category', { exact: true })).toBeVisible();
      expect((await storage.getPrompts()).map(prompt => prompt.id)).toEqual(['kept']);
      await page.getByRole('progressbar', { name: 'Storage usage' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/counts-${theme}.png`, animations: 'disabled' });

      await report.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/skipped-${theme}.png`, animations: 'disabled' });

      await report.getByRole('button', { name: 'Dismiss import report' }).click();
      await expect(report).toHaveCount(0);
    });

    test(`says how many Prompts were imported when a write failure stops the import (${theme})`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, { settings: { theme } });
      await openSettings(page, extensionId, theme);

      // The third write of the Prompts fails, as chrome.storage does when it is unavailable
      await page.evaluate(() => {
        const local = chrome.storage.local;
        const set = local.set.bind(local);
        let promptWrites = 0;
        local.set = ((items: Record<string, unknown>) => {
          if ('prompts' in items) {
            promptWrites += 1;
            if (promptWrites === 3) {
              return Promise.reject(new Error('The storage API is not available'));
            }
          }
          return set(items);
        }) as typeof local.set;
      });

      const backup = {
        prompts: Array.from({ length: 4 }, (_, i) => createPromptSeed({ id: `p${String(i)}`, title: `Prompt ${String(i + 1)}`, category: 'Uncategorized' })),
        categories: []
      };
      await importBackup(page, backup);

      await expect(page.getByText('Import stopped: 2 of 4 prompts were imported. See Backup & Restore.')).toBeVisible();
      const report = page.getByRole('status', { name: 'Import report' });
      await expect(report).toContainText('The import stopped: 2 of 4 prompts were imported.');
      await expect(report).toContainText('Storage API is unavailable. Please try again later.');
      // The Prompts imported before it stopped stay, and Settings counts them
      expect(await storage.getPrompts()).toHaveLength(2);
      await expect(page.getByText('2 prompts', { exact: true })).toBeVisible();

      await report.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/stopped-${theme}.png`, animations: 'disabled' });
    });
  }
});

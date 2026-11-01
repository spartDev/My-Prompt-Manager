/**
 * E2E: the storage limits count the bytes Chrome really stores (My-Prompt-Manager-58z)
 *
 * StorageManager's 8 MB cap on the Prompts and its quota check measure the JSON Chrome stores, in
 * UTF-8, as chrome.storage.local.getBytesInUse counts it. They used to count 2 bytes per character,
 * which refused a save with Chrome storage 40% full. The Settings storage bar shows what Chrome counts
 * against its quota (My-Prompt-Manager-71n), and a Settings import stopped by storage opens the storage
 * warning with the count imported (My-Prompt-Manager-ag4). Also captures light/dark screenshots as
 * visual proof (test-results/library-size-limit/).
 */

import type { Locator, Page } from '@playwright/test';

import { describeStorageUsage, storedSize } from '../../../src/utils/storageQuota';
import { expect, test } from '../fixtures/extension';
import { createPromptSeed, createUsageHistory, seedLibrary, seedUsageHistory } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/library-size-limit';
const LINE_SEPARATOR = String.fromCodePoint(0x2028);

const chromeBytesInUse = (page: Page) => page.evaluate(() => chrome.storage.local.getBytesInUse(null));

/**
 * Once Chrome storage has stopped changing (the writes that follow a load have landed), the Settings bar
 * shows its figure. Waiting for the bytes to settle, rather than for given writes, keeps this true when
 * those writes go away.
 */
const expectBarToMatchChrome = async (page: Page, label: Locator) => {
  let previous = -1;
  await expect.poll(async () => {
    const now = await chromeBytesInUse(page);
    const settled = now === previous;
    previous = now;
    return settled;
  }, { intervals: [500] }).toBe(true);
  const usage = describeStorageUsage(previous, await page.evaluate(() => chrome.storage.local.QUOTA_BYTES));
  await expect(label).toHaveText(`${usage.used} / ${usage.total} (${String(usage.percentage)}%)`);
};

test.describe('Library size in Chrome storage', () => {
  test('storedSize counts the bytes Chrome stores for ASCII, accented, emoji, Chinese and escaped text', async ({ page, extensionId }) => {
    const content = ['x', 'é', '😀', '中', '<', '\n', '"', LINE_SEPARATOR].map(char => char.repeat(500)).join('');
    // A timestamp of 13 significant digits takes its longest form in Chrome, 1.793212345678e+12
    const at = 1_793_212_345_678;
    const prompts = [createPromptSeed({ id: 'mixed', title: 'Résumé 😀 <draft>', content, category: 'Rédaction', createdAt: at, updatedAt: at, lastUsedAt: at })];
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);

    const chromeBytes = await page.evaluate(async (value) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ prompts: value });
      return chrome.storage.local.getBytesInUse('prompts');
    }, prompts);

    // Chrome counts the key too
    expect('prompts'.length + storedSize(prompts)).toBe(chromeBytes);
  });

  for (const theme of ['light', 'dark'] as const) {
    // My-Prompt-Manager-ag4: the Prompts imported before the refusal stay, so the storage warning says
    // how many, like after a refused save (PR #465); no native alert, and the file is not blamed
    test(`a Settings import stopped by the 8 MB cap on the Prompts opens the storage warning with the count imported (${theme})`, async ({ page, storage, extensionId }) => {
      const library = Array.from({ length: 410 }, (_, i) =>
        createPromptSeed({ id: `long-${String(i)}`, title: `Long prompt ${String(i + 1)}`, content: 'x'.repeat(19_000) })
      );
      await seedLibrary(storage, { prompts: library, settings: { theme } });
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expect(page.getByTestId('prompt-card').first()).toBeVisible();
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      const nativeDialogs: string[] = [];
      page.on('dialog', dialog => {
        nativeDialogs.push(dialog.message());
        void dialog.dismiss();
      });

      // 410 Prompts store 7.9 MB: the 20 imported ones would take the Prompts to 8.2 MB
      const backup = {
        prompts: Array.from({ length: 20 }, (_, i) =>
          createPromptSeed({ id: `imported-${String(i)}`, title: `Imported ${String(i + 1)}`, content: 'y'.repeat(19_000) })
        ),
        categories: []
      };
      await page.getByTestId('tab-settings').click();
      const importButton = page.getByRole('button', { name: 'Import', exact: true });
      const fileChooser = page.waitForEvent('filechooser');
      await importButton.click();
      await (await fileChooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });

      const warning = page.getByRole('dialog', { name: 'Storage Limit Reached' });
      await expect(warning).toBeVisible();
      const imported = (await storage.getPrompts()).length - library.length;
      expect(imported).toBeGreaterThan(0);
      expect(imported).toBeLessThan(20);
      await expect(warning.getByText(
        `The import stopped when storage was full: ${String(imported)} of 20 prompts were imported. Storage quota exceeded. Please delete old prompts to free up space.`
      )).toBeVisible();
      await expect(warning.getByText(/backup file/i)).toHaveCount(0);
      expect(await page.evaluate(() => chrome.storage.local.getBytesInUse('prompts'))).toBeLessThanOrEqual('prompts'.length + 8_000_000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/import-refused-${theme}.png` });

      // Closing the warning gives the keyboard back to Import; Settings counts the Prompts imported
      await page.keyboard.press('Escape');
      await expect(warning).toHaveCount(0);
      await expect(importButton).toBeFocused();
      await expect(page.getByText(`${String(library.length + imported)} prompts`, { exact: true })).toBeVisible();
      expect(nativeDialogs).toEqual([]);
    });

    // My-Prompt-Manager-71n: the bar shows the bytes Chrome counts for every key (the Prompts, the usage
    // history, the settings) against Chrome's quota, not the Prompts' JSON length against 5 MB
    test(`the Settings storage bar shows the bytes Chrome stores against its 10 MB quota (${theme})`, async ({ page, storage, extensionId }) => {
      const library = Array.from({ length: 220 }, (_, i) =>
        createPromptSeed({ id: `long-${String(i)}`, title: `Long prompt ${String(i + 1)}`, content: 'x'.repeat(19_000) })
      );
      await seedLibrary(storage, { prompts: library, settings: { theme } });
      await seedUsageHistory(storage, createUsageHistory(5_000, { promptIds: library.map(prompt => prompt.id) }));
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expect(page.getByTestId('prompt-card').first()).toBeVisible();
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await page.getByTestId('tab-settings').click();

      const usage = await page.evaluate(async () => ({
        used: await chrome.storage.local.getBytesInUse(),
        total: chrome.storage.local.QUOTA_BYTES
      }));
      expect(usage.total).toBe(10_485_760);
      const percentage = Math.round((usage.used / usage.total) * 100);
      // 220 Prompts (4.2 MB) and 5,000 usage events: about half of Chrome storage
      expect(percentage).toBeGreaterThan(40);
      expect(percentage).toBeLessThan(60);

      const bar = page.getByRole('progressbar', { name: 'Storage usage' });
      await expect(bar).toHaveAttribute('aria-valuenow', String(percentage));
      await expect(bar.locator('> div')).toHaveAttribute('style', new RegExp(`width: ${String(percentage)}%`));
      const used = `${String(parseFloat((usage.used / 1024 ** 2).toFixed(2)))} MB`;
      await expect(page.getByText(`${used} / 10 MB (${String(percentage)}%)`, { exact: true })).toBeVisible();
      await page.getByRole('heading', { name: 'Storage Usage' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/settings-storage-bar-${theme}.png` });
    });

    // Review round 1 (Codex): opening Settings and Clear All Data write to Chrome storage after the bar
    // is measured (the default Category, the site settings saved 150 ms after load): the bar follows them
    test(`the Settings storage bar follows the writes made on opening Settings and after Clear All Data (${theme})`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, { prompts: [createPromptSeed({ id: 'meeting', title: 'Résumé de réunion', content: 'Résume la transcription ci-dessous.' })], settings: { theme } });
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await page.getByTestId('tab-settings').click();
      const label = page.getByRole('region', { name: 'Data & Storage' }).getByText(/ \/ 10 MB \(\d+%\)$/);

      await expectBarToMatchChrome(page, label);

      await page.getByRole('button', { name: 'Clear All Data' }).click();
      await page.getByRole('button', { name: 'Yes, Clear All Data' }).click();
      await expect(page.getByText('All data has been cleared.')).toBeVisible();

      await expectBarToMatchChrome(page, label);
      await page.getByRole('heading', { name: 'Storage Usage' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/storage-bar-after-clear-${theme}.png` });
    });


    test(`a Library of 220 Prompts of 19,000 characters, 40% of Chrome storage, takes one more Prompt (${theme})`, async ({ page, storage, extensionId }) => {
      const library = Array.from({ length: 220 }, (_, i) =>
        createPromptSeed({ id: `long-${String(i)}`, title: `Long prompt ${String(i + 1)}`, content: 'x'.repeat(19_000) })
      );
      await seedLibrary(storage, { prompts: library, settings: { theme } });
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expect(page.getByTestId('prompt-card').first()).toBeVisible();
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

      const usage = await page.evaluate(async () => (await chrome.storage.local.getBytesInUse()) / chrome.storage.local.QUOTA_BYTES);
      expect(usage).toBeGreaterThan(0.39);
      expect(usage).toBeLessThan(0.42);

      await page.getByTestId('new-prompt-button').click();
      await page.getByLabel('Title (optional)').fill('Résumé de réunion');
      await page.getByLabel('Content *').fill('Résume la transcription ci-dessous en 5 points clés.');
      await page.getByRole('button', { name: 'Save Prompt' }).click();

      await expect(page.getByText('Prompt created successfully')).toBeVisible();
      await expect(page.getByTestId('prompt-card').filter({ hasText: 'Résumé de réunion' })).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'Storage Limit Reached' })).toHaveCount(0);
      expect(await storage.getPrompts()).toHaveLength(221);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/one-more-prompt-${theme}.png` });
    });
  }
});

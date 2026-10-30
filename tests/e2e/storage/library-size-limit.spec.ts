/**
 * E2E: the storage limits count the bytes Chrome really stores (My-Prompt-Manager-58z)
 *
 * StorageManager's 8 MB cap on the Prompts and its quota check measure the JSON Chrome stores, in
 * UTF-8, as chrome.storage.local.getBytesInUse counts it. They used to count 2 bytes per character,
 * which refused a save with Chrome storage 40% full. Also captures light/dark screenshots as visual
 * proof (test-results/library-size-limit/).
 */

import { storedSize } from '../../../src/utils/storageQuota';
import { expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/library-size-limit';
const LINE_SEPARATOR = String.fromCodePoint(0x2028);

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

  test('a Settings import stops at the 8 MB cap on the Prompts', async ({ page, storage, extensionId }) => {
    const library = Array.from({ length: 410 }, (_, i) =>
      createPromptSeed({ id: `long-${String(i)}`, title: `Long prompt ${String(i + 1)}`, content: 'x'.repeat(19_000) })
    );
    await seedLibrary(storage, { prompts: library });
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await expect(page.getByTestId('prompt-card').first()).toBeVisible();

    // 410 Prompts store 7.9 MB: the 20 imported ones would take the Prompts to 8.2 MB
    const backup = {
      prompts: Array.from({ length: 20 }, (_, i) =>
        createPromptSeed({ id: `imported-${String(i)}`, title: `Imported ${String(i + 1)}`, content: 'y'.repeat(19_000) })
      ),
      categories: []
    };
    const alertMessage = new Promise<string>(resolve => {
      page.once('dialog', dialog => {
        resolve(dialog.message());
        void dialog.accept();
      });
    });
    await page.getByTestId('tab-settings').click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });

    expect(await alertMessage).toContain('Storage quota exceeded. Please delete old prompts to free up space.');
    expect(await page.evaluate(() => chrome.storage.local.getBytesInUse('prompts'))).toBeLessThanOrEqual('prompts'.length + 8_000_000);
    expect((await storage.getPrompts()).length).toBeLessThan(430);
  });

  for (const theme of ['light', 'dark'] as const) {
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

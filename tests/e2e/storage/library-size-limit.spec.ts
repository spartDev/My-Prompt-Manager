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
    const prompts = [createPromptSeed({ id: 'mixed', title: 'Résumé 😀 <draft>', content, category: 'Rédaction' })];
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);

    const chromeBytes = await page.evaluate(async (value) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ prompts: value });
      return chrome.storage.local.getBytesInUse('prompts');
    }, prompts);

    // Chrome counts the key too, and writes each of the 3 timestamps up to 5 bytes longer (exponent notation)
    const measured = 'prompts'.length + storedSize(prompts);
    expect(chromeBytes).toBeGreaterThanOrEqual(measured);
    expect(chromeBytes).toBeLessThanOrEqual(measured + 15);
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

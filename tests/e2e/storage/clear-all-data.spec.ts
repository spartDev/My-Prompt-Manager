/**
 * E2E: Clear All Data in Settings empties the Library (My-Prompt-Manager-99k)
 *
 * Settings used to clear chrome.storage directly. It now clears through StorageManager.clearAllData,
 * under the storage locks shared with the service worker, so this checks the real extension still
 * empties the Library through that path. Also captures light/dark screenshots as visual proof
 * (test-results/clear-all-data/).
 */

import { expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/clear-all-data';

test.describe('Clear All Data', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`Clear All Data in Settings empties the Library (${theme})`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, {
        prompts: [
          createPromptSeed({ id: 'meeting', title: 'Summarize a meeting' }),
          createPromptSeed({ id: 'reply', title: 'Reply to an email', category: 'Work' })
        ],
        categories: [{ id: 'work', name: 'Work' }],
        settings: { theme }
      });
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expect(page.getByTestId('prompt-card')).toHaveCount(2);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

      await page.getByTestId('tab-settings').click();
      await page.getByRole('button', { name: 'Clear All Data' }).click();
      await page.getByRole('button', { name: 'Yes, Clear All Data' }).click();
      await expect(page.getByText('All data cleared', { exact: true })).toBeVisible();

      const stored = await page.evaluate(() => chrome.storage.local.get(['prompts', 'categories']));
      expect(stored.prompts).toBeUndefined();
      // Settings reloads after the clear, and that read writes the default Category back
      expect(stored.categories).not.toContainEqual(expect.objectContaining({ name: 'Work' }));

      await page.getByTestId('tab-library').click();
      await expect(page.getByTestId('tab-library')).toHaveAttribute('aria-selected', 'true');
      // The tabs fade their colors: wait for Settings to lose its fill so the screenshot shows Library chosen
      await expect(page.getByTestId('tab-settings')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.getByRole('heading', { name: "You're ready to go" })).toBeVisible();
      await expect(page.getByTestId('prompt-card')).toHaveCount(0);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-after-clear-${theme}.png` });
    });
  }
});

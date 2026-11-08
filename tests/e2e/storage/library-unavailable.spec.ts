/**
 * E2E: Settings when the Library cannot be read (My-Prompt-Manager-spi)
 *
 * A Library that cannot be read is unknown, not empty: Your data says so instead of "0 prompts",
 * and Export is off, so no empty Backup is saved. Opening Settings again reads it again.
 *
 * Also captures light/dark screenshots as visual proof (test-results/library-unavailable/).
 */

import { expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/library-unavailable';

declare global {
  interface Window {
    /** Set by the test: whether reading the Prompts fails, as chrome.storage does when it is unavailable */
    failPromptReads?: boolean;
  }
}

test.describe('Settings when the Library cannot be read', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`says the Library could not be read and turns Export off (${theme})`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, {
        prompts: [createPromptSeed({ id: 'p1', title: 'Weekly report', category: 'Uncategorized' })],
        settings: { theme }
      });
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

      await page.evaluate(() => {
        const local = chrome.storage.local;
        const get = local.get.bind(local) as (keys?: unknown) => Promise<Record<string, unknown>>;
        window.failPromptReads = true;
        local.get = ((keys?: unknown) => {
          if (window.failPromptReads === true && Array.isArray(keys) && keys.includes('prompts')) {
            return Promise.reject(new Error('The storage API is not available'));
          }
          return get(keys);
        }) as typeof local.get;
      });
      await page.getByTestId('tab-settings').click();

      const dataStorage = page.getByRole('region', { name: 'Your data' });
      await expect(dataStorage.getByText('The Library could not be read', { exact: true })).toBeVisible();
      await expect(dataStorage.getByText(/^\d+ prompts?$/)).toHaveCount(0);
      const exportButton = dataStorage.getByRole('button', { name: 'Export', exact: true });
      await expect(exportButton).toBeDisabled();
      await expect(exportButton).toHaveAccessibleDescription('Export is off: the Library could not be read. Leave Settings and open it again to retry.');

      // Export in the middle shows the storage line above it too
      await exportButton.evaluate((button) => { button.scrollIntoView({ block: 'center' }); });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/data-storage-${theme}.png`, animations: 'disabled' });

      // Leaving Settings and opening it again reads the Library again
      await page.evaluate(() => { window.failPromptReads = false; });
      await page.getByTestId('tab-library').click();
      await page.getByTestId('tab-settings').click();
      await expect(dataStorage.getByText(/^1 prompt · /)).toBeVisible();
      await expect(dataStorage.getByText('The Library could not be read', { exact: true })).toHaveCount(0);
      await expect(exportButton).toBeEnabled();
    });
  }
});

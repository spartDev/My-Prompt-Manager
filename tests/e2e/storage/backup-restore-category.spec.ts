/**
 * E2E: a Backup restore leaves no Prompt naming a Category that does not exist (My-Prompt-Manager-cx9)
 *
 * A Prompt in a Backup can name a Category that neither the Backup nor the Library has (a Backup with no
 * categories section, or one whose list omits it). The restore creates that Category from its name, so the
 * Prompt keeps its grouping: its card shows the Category, and Categories lists it. Before, the Prompt named
 * a Category that did not exist, and its card showed none. Also captures light/dark screenshots as visual
 * proof (test-results/backup-restore-category/).
 */

import { expect, test } from '../fixtures/extension';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/backup-restore-category';

test.describe('Backup restore and the Categories its Prompts name', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`a Backup with no categories section creates the Category its Prompt names (${theme})`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, {
        prompts: [createPromptSeed({ id: 'kept', title: 'Weekly report', category: 'Work' })],
        categories: [createCategorySeed({ id: 'work', name: 'Work', color: '#059669' })],
        settings: { theme }
      });
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expect(page.getByTestId('prompt-card').first()).toBeVisible();
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

      const backup = { prompts: [createPromptSeed({ id: 'restored', title: 'Chess opening drill', category: 'Play' })] };
      await page.getByTestId('tab-settings').click();
      const fileChooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Import', exact: true }).click();
      await (await fileChooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
      await expect(page.getByText(/^Successfully imported/)).toBeVisible();

      // Stored once, without a colour, and every Prompt names an existing Category
      const categories = await storage.getCategories();
      expect(categories.filter(category => category.name === 'Play')).toEqual([{ id: expect.any(String), name: 'Play' }]);
      const names = categories.map(category => category.name);
      expect((await storage.getPrompts()).map(prompt => prompt.category).filter(name => !names.includes(name))).toEqual([]);

      // Library: the restored Prompt's card shows its Category
      await page.getByTestId('tab-library').click();
      const card = page.getByTestId('prompt-card').filter({ hasText: 'Chess opening drill' });
      await expect(card.getByText('Play', { exact: true })).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-${theme}.png`, animations: 'disabled' });

      // Categories: listed with the others
      await page.getByTestId('tab-categories').click();
      const row = page.locator('[data-testid="category-row"][data-category-name="Play"]');
      await expect(row).toBeVisible();
      await row.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/categories-${theme}.png`, animations: 'disabled' });
    });
  }
});

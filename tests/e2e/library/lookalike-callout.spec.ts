/**
 * E2E: "This looks familiar" in the Prompt editor (My-Prompt-Manager-ge6, Atelier 1C)
 *
 * Writing a new Prompt whose text is 60% or more like a Prompt of the Library points that Prompt
 * out, with how alike they are and the first lines of both; Keep both hides it, and Save still
 * saves. Captures light/dark screenshots as visual proof (test-results/lookalike-callout/).
 */

import type { Category } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/lookalike-callout';

const categories: Category[] = [{ id: 'writing', name: 'Writing', color: '#2563EB' }];
const existing = createPromptSeed({
  id: 'summarize',
  title: 'Summarize an article',
  content: 'Summarize this article in three bullets.\nKeep each bullet under 15 words.',
  category: 'Writing'
});
const yours = 'Summarize this essay in three bullets.\nKeep each bullet short.';

test.describe('This looks familiar', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`points out the Prompt the new text looks like, Keep both hides it and Save still saves (${theme})`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, { prompts: [existing], categories, settings: { theme } });
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expect(page.getByTestId('prompt-card').first()).toBeVisible();
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

      await page.getByTestId('new-prompt-button').click();
      await page.getByLabel('Title', { exact: true }).fill('Short summary');
      await page.getByLabel('Content', { exact: true }).fill(yours);

      const callout = page.getByRole('region', { name: 'This looks familiar' });
      await expect(callout).toContainText(/\d+% like “Summarize an article”/);
      await expect(callout).toContainText('Yours');
      await expect(callout).toContainText('Existing');
      await callout.scrollIntoViewIfNeeded();
      await page.evaluate(() => { for (const animation of document.getAnimations()) animation.finish(); });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/editor-lookalike-${theme}.png` });

      await callout.getByRole('button', { name: 'Keep both' }).click();
      await expect(callout).toHaveCount(0);

      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('prompt-card')).toHaveCount(2);
    });
  }
});

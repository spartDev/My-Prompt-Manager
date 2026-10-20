/**
 * E2E: Library card preview renders a bounded prefix (My-Prompt-Manager-7ya)
 *
 * A prompt with very long content must not put its whole content in the card:
 * the preview is cut to about 300 characters with an ellipsis, while search
 * still matches on the full content. Also captures light/dark screenshots as
 * visual proof (test-results/card-preview/).
 */

import type { Page } from '@playwright/test';

import type { Category, Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SIDEPANEL_URL = 'src/sidepanel.html';
const SCREENSHOT_DIR = 'test-results/card-preview';

const categories: Category[] = [{ id: 'dev', name: 'Development', color: '#16A34A' }];

const LONG_CONTENT =
  'You are a staff engineer reviewing a very long specification. 🚀 ' +
  'Read every section carefully and list the risks you find. '.repeat(330) +
  'tail-only-needle';

const prompts: Prompt[] = [
  createPromptSeed({
    id: 'long',
    title: 'Huge Spec Review',
    content: LONG_CONTENT,
    category: 'Development',
    usageCount: 3,
    updatedAt: Date.now(),
  }),
  createPromptSeed({
    id: 'short',
    title: 'Short Prompt',
    content: 'Summarise this text in three bullet points.',
    category: 'Development',
    updatedAt: Date.now() - 1000,
  }),
];

const seed = async (storage: ExtensionStorage, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts, categories, settings: { theme } });
};

const openLibrary = async (page: Page, extensionId: string) => {
  await page.setViewportSize({ width: 400, height: 760 });
  await page.goto(`chrome-extension://${extensionId}/${SIDEPANEL_URL}`);
  await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
};

const previewOf = (page: Page, title: string) =>
  page.getByTestId('prompt-card').filter({ hasText: title }).locator('p');

test.describe('Library card preview prefix', () => {
  test('long content renders a bounded preview, search still matches the full content', async ({ page, storage, extensionId }) => {
    expect(LONG_CONTENT.length).toBeGreaterThan(19000);
    await seed(storage, 'light');
    await openLibrary(page, extensionId);

    const preview = previewOf(page, 'Huge Spec Review');
    const text = await preview.textContent();
    expect(text?.length).toBeLessThanOrEqual(301);
    expect(text?.endsWith('…')).toBe(true);
    expect(text).not.toContain('tail-only-needle');

    await expect(previewOf(page, 'Short Prompt')).toHaveText('Summarise this text in three bullet points.');

    // Filtering uses the full content: a term only in the cut-off tail still finds the prompt
    await page.getByPlaceholder('Search your prompts...').fill('tail-only-needle');
    await expect(page.getByTestId('prompt-card')).toHaveCount(1);
    await expect(page.getByTestId('prompt-card')).toContainText('Huge Spec Review');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`PROOF: long-content card preview screenshot (${theme} mode)`, async ({ page, storage, extensionId }) => {
      await seed(storage, theme);
      await openLibrary(page, extensionId);

      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      const text = await previewOf(page, 'Huge Spec Review').textContent();
      expect(text?.length).toBeLessThanOrEqual(301);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/card-preview-${theme}.png` });
    });
  }
});

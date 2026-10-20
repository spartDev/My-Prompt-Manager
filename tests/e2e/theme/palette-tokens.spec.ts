/**
 * E2E: the color tokens follow the theme in the real extension (My-Prompt-Manager-el4.1)
 *
 * The page background, the focus ring and the default border read the tokens, and switching
 * to dark swaps every one of them through the .dark class on <html>. Also captures light/dark
 * screenshots as visual proof (test-results/palette-tokens/): New button focused, list scrolled.
 */

import type { Page } from '@playwright/test';

import type { Category, Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const POPUP_URL = 'src/popup.html';
const SCREENSHOT_DIR = 'test-results/palette-tokens';

const EXPECTED = {
  light: { app: 'rgb(244, 241, 250)', accent: 'rgb(109, 40, 217)', border: 'rgb(236, 230, 245)' },
  dark: { app: 'rgb(18, 14, 27)', accent: 'rgb(132, 75, 242)', border: 'rgb(53, 44, 76)' }
} as const;

const categories: Category[] = [{ id: 'writing', name: 'Rédaction', color: '#2563EB' }];

const prompts: Prompt[] = Array.from({ length: 8 }, (_, index) =>
  createPromptSeed({
    id: `prompt-${String(index)}`,
    title: `Résumé de réunion ${String(index + 1)}`,
    content: 'Résume la transcription ci-dessous en 5 points clés, puis liste les décisions prises.',
    category: 'Rédaction',
    updatedAt: Date.now() - index * 1000
  })
);

const openLibrary = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts, categories, settings: { theme } });
  await page.setViewportSize({ width: 400, height: 500 });
  await page.goto(`chrome-extension://${extensionId}/${POPUP_URL}`);
  await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

test.describe('Color tokens follow the theme', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`page background, focus ring and default border use the ${theme} tokens`, async ({ page, storage, extensionId }) => {
      await openLibrary(page, storage, extensionId, theme);

      await expect(page.locator('body')).toHaveCSS('background-color', EXPECTED[theme].app);

      const newButton = page.getByTestId('new-prompt-button');
      await newButton.focus();
      await expect(newButton).toHaveCSS('outline-color', EXPECTED[theme].accent);
      await expect(newButton).toHaveCSS('outline-width', '2px');
      await expect(newButton).toHaveCSS('outline-offset', '2px');

      // An element with a bare `border` and no color class gets the default border token
      const borderColor = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.borderStyle = 'solid';
        document.body.appendChild(probe);
        const color = getComputedStyle(probe).borderTopColor;
        probe.remove();
        return color;
      });
      expect(borderColor).toBe(EXPECTED[theme].border);
    });

    test(`PROOF: tokens screenshot (${theme} mode)`, async ({ page, storage, extensionId }) => {
      await openLibrary(page, storage, extensionId, theme);

      await page.getByTestId('prompt-card').last().scrollIntoViewIfNeeded();
      await page.getByTestId('new-prompt-button').focus();

      await page.screenshot({ path: `${SCREENSHOT_DIR}/palette-tokens-${theme}.png` });
    });
  }
});

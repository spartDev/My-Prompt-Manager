/**
 * E2E: Category chips and the preset palette in the real extension (My-Prompt-Manager-el4.2)
 *
 * A Library card shows its Category as a chip: the Category color at 13% as background, and the
 * text the chip rule derives for the active theme. Also captures light/dark screenshots as visual
 * proof (test-results/category-chips/): Library cards with several chips, and the Categories
 * color picker with the 12 presets.
 */

import type { Page } from '@playwright/test';

import type { Category, Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SIDEPANEL_URL = 'src/sidepanel.html';
const SCREENSHOT_DIR = 'test-results/category-chips';

const categories: Category[] = [
  { id: 'writing', name: 'Rédaction', color: '#2563EB' }, // Ocean Blue
  { id: 'code', name: 'Code', color: '#4F46E5' }, // Indigo
  { id: 'marketing', name: 'Marketing', color: '#D97706' }, // Amber
  { id: 'research', name: 'Recherche', color: '#4D7C0F' }, // Lime
  { id: 'ideas', name: 'Idées', color: '#EAB308' }, // Yellow
  { id: 'archive', name: 'Archives', color: '#1E40AF' } // Navy, no longer a preset
];

const prompts: Prompt[] = categories.map((category, index) =>
  createPromptSeed({
    id: `prompt-${category.id}`,
    title: `Prompt ${category.name}`,
    content: 'Résume la transcription ci-dessous en 5 points clés.',
    category: category.name,
    updatedAt: Date.now() - index * 1000
  })
);

const CHIP = {
  background: 'rgba(37, 99, 235, 0.13)',
  text: { light: 'rgb(27, 71, 169)', dark: 'rgb(120, 158, 243)' }
} as const;

const openLibrary = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts, categories, settings: { theme } });
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto(`chrome-extension://${extensionId}/${SIDEPANEL_URL}`);
  await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

test.describe('Category chips follow the chip rule', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`a Library card chip takes the 13% tint and the ${theme} text`, async ({ page, storage, extensionId }) => {
      await openLibrary(page, storage, extensionId, theme);

      const chip = page.getByTitle('Category: Rédaction');
      await expect(chip).toHaveCSS('background-color', CHIP.background);
      await expect(chip).toHaveCSS('color', CHIP.text[theme]);
    });

    test(`PROOF: Library chips and color picker screenshots (${theme} mode)`, async ({ page, storage, extensionId }) => {
      await openLibrary(page, storage, extensionId, theme);
      // Tall enough to show all six cards, the former preset (Navy) included
      await page.setViewportSize({ width: 400, height: 1450 });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-chips-${theme}.png` });

      await page.getByTestId('tab-categories').click();
      await page.getByRole('button', { name: /Ocean Blue/ }).click();
      await expect(page.getByText('Preset Colors')).toBeVisible();
      const swatch = (name: string) => page.locator(`button[title="${name}"]`);
      await expect(swatch('Ocean Blue')).toHaveAttribute('aria-current', 'true');
      for (const name of ['Indigo', 'Amber', 'Lime']) {
        await expect(swatch(name)).toBeVisible();
      }
      await expect(swatch('Navy')).toHaveCount(0);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/color-picker-${theme}.png` });
    });
  }
});

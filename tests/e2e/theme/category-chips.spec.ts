/**
 * E2E: Category chips and the preset palette in the real extension (My-Prompt-Manager-el4.2)
 *
 * A Library card shows its Category as a chip: the Category color at 13% as background, and the
 * text the chip rule derives for the active theme. Also captures light/dark screenshots as visual
 * proof (test-results/category-chips/): Library cards with several chips, and the Categories
 * color picker with the 12 presets.
 */

import type { Locator, Page } from '@playwright/test';

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

// Colors that need the safety net: a former preset still stored by Categories, and an extreme custom color
const netCategories: Category[] = [
  { id: 'archive', name: 'Archives', color: '#1E40AF' }, // Navy
  { id: 'black', name: 'Noir', color: '#000000' }
];

const relativeLuminance = ([r, g, b]: number[]) => {
  const linear = (channel: number) => (channel / 255 <= 0.03928 ? channel / 255 / 12.92 : ((channel / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

const contrast = (a: number[], b: number[]) => {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

/** The chip background as painted: a pixel of its top padding, read back from a screenshot */
const paintedBackground = async (page: Page, chip: Locator): Promise<number[]> => {
  const shot = await chip.screenshot();
  return page.evaluate(async base64 => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.drawImage(image, 0, 0);
    return [...context.getImageData(Math.round(image.width / 2), 2, 1, 1).data].slice(0, 3);
  }, shot.toString('base64'));
};

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

    test(`chip text reads at 4.5:1 on the chip as painted, safety net included (${theme})`, async ({ page, storage, extensionId }) => {
      const netPrompts = netCategories.map(category =>
        createPromptSeed({ id: `prompt-${category.id}`, title: `Prompt ${category.name}`, content: 'Texte', category: category.name })
      );
      await seedLibrary(storage, { prompts: netPrompts, categories: netCategories, settings: { theme } });
      await page.goto(`chrome-extension://${extensionId}/${SIDEPANEL_URL}`);
      await expect(page.getByTestId('prompt-card')).toHaveCount(netPrompts.length);

      for (const category of netCategories) {
        const chip = page.getByTitle(`Category: ${category.name}`);
        const text = (await chip.evaluate(element => getComputedStyle(element).color)).match(/\d+/g)?.slice(0, 3).map(Number) ?? [];
        const ratio = contrast(text, await paintedBackground(page, chip));
        expect(ratio, `${category.name} (${category.color})`).toBeGreaterThanOrEqual(4.5);
      }
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

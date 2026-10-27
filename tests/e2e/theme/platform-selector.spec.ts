/**
 * E2E: the Prompt selector and the Variable form on a Platform, on the color tokens (My-Prompt-Manager-el4.7)
 *
 * The content script declares the popup's tokens as CSS variables on the selector (light) and on its
 * dark-theme variant, so the selector injected on claude.ai matches the popup's palette in both modes,
 * and Category chips follow the chip rule. Also captures light/dark screenshots as visual proof
 * (test-results/platform-selector/).
 */

import type { Locator, Page } from '@playwright/test';

import { getSoftBadgeColors } from '../../../src/constants/colors';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { openPlatform } from '../fixtures/platform-pages';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/platform-selector';
const ON_ACCENT = 'rgb(255, 255, 255)';

const EXPECTED = {
  light: {
    card: 'rgb(255, 255, 255)', border: 'rgb(236, 230, 245)', divider: 'rgb(240, 235, 248)', subtle: 'rgb(244, 241, 250)',
    input: 'rgb(143, 135, 165)', strong: 'rgb(220, 212, 234)', muted: 'rgb(241, 237, 248)',
    primary: 'rgb(29, 21, 48)', secondary: 'rgb(92, 83, 112)', tertiary: 'rgb(111, 103, 135)',
    accent: 'rgb(109, 40, 217)', accentSelected: 'rgb(237, 229, 255)', accentStrong: 'rgb(76, 29, 149)', accentBorder: 'rgb(196, 181, 253)'
  },
  dark: {
    card: 'rgb(35, 28, 52)', border: 'rgb(53, 44, 76)', divider: 'rgb(47, 39, 68)', subtle: 'rgb(43, 35, 64)',
    input: 'rgb(118, 108, 142)', strong: 'rgb(65, 55, 90)', muted: 'rgb(46, 38, 69)',
    primary: 'rgb(241, 237, 249)', secondary: 'rgb(188, 179, 208)', tertiary: 'rgb(163, 154, 187)',
    accent: 'rgb(132, 75, 242)', accentSelected: 'rgb(56, 41, 106)', accentStrong: 'rgb(221, 211, 254)', accentBorder: 'rgb(109, 79, 196)'
  }
} as const;

/** Teal, one of the 12 Category colors */
const CODE_COLOR = '#0F766E';

const translate = createPromptSeed({
  id: 'translate',
  title: 'Translate a text',
  content: 'Translate {{text}} into {{ language }}.',
  category: 'Writing',
  usageCount: 3
});
const review = createPromptSeed({
  id: 'review',
  title: 'Review a diff',
  content: 'Review this diff like a senior developer: bugs, missed edge cases, unclear names.',
  category: 'Code',
  usageCount: 2
});
const summarize = createPromptSeed({
  id: 'summarize',
  title: 'Summarize a meeting',
  content: 'Summarize the transcript below in five key points, then list the decisions.',
  category: 'Writing',
  usageCount: 1
});

const seed = async (storage: ExtensionStorage, theme: 'light' | 'dark') => {
  await seedLibrary(storage, {
    prompts: [translate, review, summarize],
    categories: [createCategorySeed({ name: 'Writing', color: '#2563EB' }), createCategorySeed({ name: 'Code', color: CODE_COLOR })],
    settings: { theme }
  });
};

const openSelector = async (page: Page): Promise<Locator> => {
  const selector = page.locator('.prompt-library-selector');
  await expect(async () => {
    await page.locator('.prompt-library-integrated-icon').click({ timeout: 5_000 });
    await expect(selector).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return selector;
};

const rgb = (hex: string) => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

test.describe('Prompt selector on a Platform, on the tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`the selector is a bg-card panel with a bg-subtle search field, and the keyboard-selected Prompt is accent-selected (${theme})`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPlatform(context, 'claude');
      await page.setViewportSize({ width: 900, height: 760 });
      const selector = await openSelector(page);
      await expect(selector).toHaveClass(new RegExp(`${theme}-theme`));

      await expect(selector).toHaveCSS('background-color', colors.card);
      await expect(selector).toHaveCSS('border-top-color', colors.border);
      await expect(selector).toHaveCSS('backdrop-filter', 'none');

      const header = selector.locator('.prompt-selector-header');
      await expect(header).toHaveCSS('border-bottom-color', colors.divider);
      await expect(header.getByRole('heading', { name: 'Select a Prompt' })).toHaveCSS('color', colors.primary);
      await expect(selector.getByRole('button', { name: 'Close prompt selector' })).toHaveCSS('color', colors.tertiary);

      const search = selector.locator('.search-input');
      await expect(search).toHaveCSS('background-color', colors.subtle);
      await expect(search).toHaveCSS('color', colors.primary);
      expect(await search.evaluate(input => getComputedStyle(input, '::placeholder').color), 'placeholder').toBe(colors.tertiary);
      await search.focus();
      await expect(search).toHaveCSS('border-top-color', colors.accent);
      await expect(selector.locator('.prompt-search')).toHaveCSS('border-bottom-color', colors.divider);

      const first = selector.locator('.prompt-item').first();
      await expect(first.locator('.prompt-title')).toHaveCSS('color', colors.primary);
      await expect(first.locator('.prompt-preview')).toHaveCSS('color', colors.tertiary);
      await expect(first).toHaveCSS('border-bottom-color', colors.divider);

      // The arrows move the keyboard selection: a chosen item among several
      await search.press('ArrowDown');
      const chosen = selector.locator('.prompt-item.keyboard-selected');
      await expect(chosen).toHaveCount(1);
      await expect(chosen).toHaveCSS('background-color', colors.accentSelected);
      await expect(chosen).toHaveCSS('box-shadow', `${colors.accentBorder} 0px 0px 0px 1px inset`);
      await expect(chosen.locator('.prompt-title')).toHaveCSS('color', colors.accentStrong);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/selector-${theme}.png` });

      const hovered = selector.locator('.prompt-item').filter({ hasText: 'Summarize a meeting' });
      await hovered.hover();
      await expect(hovered).toHaveCSS('background-color', colors.muted);
    });

    test(`a Category chip takes the chip rule of its Category color (${theme})`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPlatform(context, 'claude');
      const selector = await openSelector(page);

      const chip = selector.locator('.prompt-item').filter({ hasText: 'Review a diff' }).locator('.prompt-category');
      const expected = getSoftBadgeColors(CODE_COLOR, theme);
      await expect(chip).toHaveText('Code');
      await expect(chip).toHaveCSS('background-color', expected.background.replace(/\s+/g, ' '));
      await expect(chip).toHaveCSS('color', rgb(expected.text));
    });

    test(`the Variable form has bg-subtle fields, a secondary Insert as is and a primary accent Insert (${theme})`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPlatform(context, 'claude');
      await page.setViewportSize({ width: 900, height: 760 });
      const selector = await openSelector(page);
      await selector.locator('.prompt-item').filter({ hasText: 'Translate a text' }).click();

      const form = selector.getByRole('form', { name: 'Fill in variables' });
      await expect(form).toBeVisible();
      const field = form.getByLabel('text', { exact: true });
      await expect(field).toBeFocused();
      await expect(form.getByText('text', { exact: true })).toHaveCSS('color', colors.secondary);
      await expect(field).toHaveCSS('background-color', colors.subtle);
      await expect(field).toHaveCSS('border-top-color', colors.accent);
      await expect(form.getByLabel('language', { exact: true })).toHaveCSS('border-top-color', colors.input);

      const asIs = form.getByRole('button', { name: 'Insert as is' });
      await expect(asIs).toHaveCSS('background-color', colors.card);
      await expect(asIs).toHaveCSS('border-top-color', colors.strong);
      await expect(asIs).toHaveCSS('color', colors.secondary);
      const insert = form.getByRole('button', { name: 'Insert', exact: true });
      await expect(insert).toHaveCSS('background-color', colors.accent);
      await expect(insert).toHaveCSS('color', ON_ACCENT);

      await field.fill('the release notes');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/variable-form-${theme}.png` });
    });
  }
});

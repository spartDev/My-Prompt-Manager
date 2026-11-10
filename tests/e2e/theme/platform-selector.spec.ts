/**
 * E2E: the Prompt selector and its variables step on a Platform, on the color tokens (My-Prompt-Manager-el4.7, q9j)
 *
 * The selector's stylesheet, inside its shadow root, declares the popup's tokens as CSS variables (light on
 * the host, dark on its data-theme="dark"), so the selector shown on claude.ai matches the popup's palette in
 * both modes; the Prompts button in the page does the same. A Category's dot takes the Category's own color.
 * Also captures light/dark screenshots as visual proof (test-results/platform-selector/).
 */

import type { Locator, Page } from '@playwright/test';

import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { openPlatform, promptRow, promptSelector, promptsButton } from '../fixtures/platform-pages';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/platform-selector';
const ON_ACCENT = 'rgb(255, 255, 255)';

const EXPECTED = {
  light: {
    card: 'rgb(255, 255, 255)', border: 'rgb(236, 230, 245)', divider: 'rgb(240, 235, 248)', subtle: 'rgb(244, 241, 250)',
    inverse: 'rgb(29, 21, 48)', primary: 'rgb(29, 21, 48)', secondary: 'rgb(92, 83, 112)', tertiary: 'rgb(111, 103, 135)',
    accent: 'rgb(109, 40, 217)', accentSubtle: 'rgb(241, 235, 253)', accentSelected: 'rgb(237, 229, 255)',
    accentText: 'rgb(91, 33, 182)', accentStrong: 'rgb(76, 29, 149)', accentBorder: 'rgb(196, 181, 253)'
  },
  dark: {
    card: 'rgb(35, 28, 52)', border: 'rgb(53, 44, 76)', divider: 'rgb(47, 39, 68)', subtle: 'rgb(43, 35, 64)',
    inverse: 'rgb(74, 61, 107)', primary: 'rgb(241, 237, 249)', secondary: 'rgb(188, 179, 208)', tertiary: 'rgb(163, 154, 187)',
    accent: 'rgb(132, 75, 242)', accentSubtle: 'rgb(47, 35, 80)', accentSelected: 'rgb(56, 41, 106)',
    accentText: 'rgb(196, 181, 253)', accentStrong: 'rgb(221, 211, 254)', accentBorder: 'rgb(109, 79, 196)'
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
  const selector = promptSelector(page);
  await expect(promptsButton(page)).toHaveCount(1);
  await promptsButton(page).click();
  await expect(selector).toBeVisible();
  return selector;
};

const rgb = (hex: string) => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

test.describe('Prompt selector on a Platform, on the tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`the Prompts button is accent-subtle when closed and accent when the selector is open (${theme})`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPlatform(context, 'claude');
      const button = promptsButton(page);
      await expect(button).toHaveCount(1);
      // The extension's theme is read after the button is made: wait for it before reading colors
      await expect(button).toHaveClass(theme === 'dark' ? /dark-theme/ : /^(?!.*dark-theme)/);

      await page.mouse.move(700, 600);
      await expect(button).toHaveCSS('background-color', colors.accentSubtle);
      await expect(button).toHaveCSS('color', colors.accentText);
      await expect(button).toHaveCSS('height', '32px');
      await expect(button.locator('.prompt-library-pill-badge')).toHaveCSS('background-color', colors.accent);
      await expect(button.locator('.prompt-library-pill-badge')).toHaveCSS('width', '22px');
      await expect(button).toHaveCSS('transition-duration', /^0\.3s, 0\.3s/);

      await openSelector(page);
      await page.mouse.move(700, 600);
      await expect(button).toHaveCSS('background-color', colors.accent);
      await expect(button).toHaveCSS('color', ON_ACCENT);
    });

    test(`the selector is a bg-card panel, its active tab is inverse and its selected Prompt accent-subtle (${theme})`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPlatform(context, 'claude');
      await page.setViewportSize({ width: 900, height: 760 });
      await page.addStyleTag({ content: 'main { margin-top: 440px; }' });
      const selector = await openSelector(page);
      await expect(page.locator('#mpm-prompt-selector')).toHaveAttribute('data-theme', theme);

      await expect(selector).toHaveCSS('background-color', colors.card);
      await expect(selector).toHaveCSS('border-top-color', colors.border);
      await expect(selector).toHaveCSS('backdrop-filter', 'none');
      await expect(selector.getByRole('heading', { name: 'Insert a prompt' })).toHaveCSS('color', colors.primary);
      await expect(selector.getByRole('button', { name: 'Close' })).toHaveCSS('background-color', colors.subtle);
      await expect(selector.getByRole('button', { name: 'Close' })).toHaveCSS('color', colors.secondary);

      // Tabs: the active one is inverse, the others subtle
      const active = selector.getByRole('tab', { selected: true });
      await expect(active).toHaveText('All');
      await expect(active).toHaveCSS('background-color', colors.inverse);
      await expect(active).toHaveCSS('color', ON_ACCENT);
      const other = selector.getByRole('tab', { name: 'Code' });
      await expect(other).toHaveCSS('background-color', colors.subtle);
      await expect(other).toHaveCSS('color', colors.secondary);
      // A Category's dot is the Category's own color, in its tab and on its Prompts
      await expect(other.locator('.mpm-dot')).toHaveCSS('background-color', rgb(CODE_COLOR));
      await expect(promptRow(page, 'review').locator('.mpm-dot')).toHaveCSS('background-color', rgb(CODE_COLOR));

      // Rows: the selected one is accent-subtle with an accent border
      const selected = selector.getByRole('option', { selected: true });
      await expect(selected).toHaveCount(1);
      await expect(selected).toHaveCSS('background-color', colors.accentSubtle);
      await expect(selected).toHaveCSS('border-top-color', colors.accentBorder);
      await expect(selected.locator('.mpm-row-title')).toHaveCSS('color', colors.primary);
      const rest = promptRow(page, 'summarize');
      await expect(rest).toHaveCSS('background-color', colors.card);
      await expect(rest).toHaveCSS('border-top-color', colors.divider);
      await expect(rest.locator('.mpm-row-category')).toHaveCSS('color', colors.tertiary);
      await expect(promptRow(page, 'translate').locator('.mpm-row-variables')).toHaveCSS('color', colors.accentText);

      await expect(selector.locator('.mpm-footer')).toHaveCSS('color', colors.tertiary);
      await expect(selector.locator('.mpm-footer')).toHaveCSS('border-top-color', colors.divider);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/selector-${theme}.png`, animations: 'disabled' });

      // The search field, once the user types
      await page.keyboard.type('re');
      await expect(selector.getByRole('combobox', { name: 'Search prompts' })).toHaveCSS('color', colors.primary);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/selector-search-${theme}.png`, animations: 'disabled' });
    });

    test(`the variables step has accent-subtle fields that turn accent-selected when filled, and a primary accent Insert (${theme})`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPlatform(context, 'claude');
      await page.setViewportSize({ width: 900, height: 760 });
      await page.addStyleTag({ content: 'main { margin-top: 440px; }' });
      const selector = await openSelector(page);
      await promptRow(page, 'translate').click();

      const field = selector.getByRole('textbox', { name: 'text', exact: true });
      const empty = selector.getByRole('textbox', { name: 'language', exact: true });
      await expect(field).toBeFocused();
      await expect(selector.locator('.mpm-fill-text')).toHaveCSS('color', colors.primary);

      // Empty: dashed lilac underline on accent-subtle
      await expect(empty).toHaveCSS('background-color', colors.accentSubtle);
      await expect(empty).toHaveCSS('border-bottom-style', 'dashed');
      await expect(empty).toHaveCSS('border-bottom-color', colors.accentBorder);
      expect(await empty.evaluate(input => getComputedStyle(input, '::placeholder').color), 'placeholder').toBe(colors.tertiary);

      // Filled: solid accent underline on accent-selected, accent-strong text
      await field.fill('the release notes');
      await empty.focus();
      await expect(field).toHaveAttribute('data-filled', 'true');
      await expect(field).toHaveCSS('background-color', colors.accentSelected);
      await expect(field).toHaveCSS('border-bottom-style', 'solid');
      await expect(field).toHaveCSS('border-bottom-color', colors.accent);
      await expect(field).toHaveCSS('color', colors.accentStrong);

      const insert = selector.getByRole('button', { name: /Insert into the chat/ });
      await page.mouse.move(700, 100);
      await expect(insert).toHaveCSS('background-color', colors.accent);
      await expect(insert).toHaveCSS('color', ON_ACCENT);
      await expect(insert).toHaveCSS('height', '44px');

      await page.screenshot({ path: `${SCREENSHOT_DIR}/variable-form-${theme}.png`, animations: 'disabled' });
    });
  }
});

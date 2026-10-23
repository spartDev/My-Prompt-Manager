/**
 * E2E: the general Settings sections on the color tokens (My-Prompt-Manager-el4.5.2)
 *
 * The view sits on bg-app: each section has an accent-subtle icon square and its blocks are cards.
 * Also captures light/dark screenshots as visual proof (test-results/settings/).
 */

import type { Locator, Page } from '@playwright/test';

import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/settings';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const DANGER_FILL = 'rgb(220, 38, 38)';
const SUCCESS_FILL = 'rgb(16, 185, 129)';
const ON_INVERSE = 'rgb(201, 191, 230)';

const EXPECTED = {
  light: {
    app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', subtle: 'rgb(244, 241, 250)', border: 'rgb(236, 230, 245)',
    input: 'rgb(143, 135, 165)', tertiary: 'rgb(111, 103, 135)', secondary: 'rgb(92, 83, 112)', selected: 'rgb(237, 229, 255)', accentBorder: 'rgb(196, 181, 253)',
    accentStrong: 'rgb(76, 29, 149)', accentSubtle: 'rgb(241, 235, 253)', accentText: 'rgb(91, 33, 182)',
    accent: 'rgb(109, 40, 217)', strong: 'rgb(220, 212, 234)', warning: 'rgb(217, 119, 6)',
    dangerSubtle: 'rgb(253, 236, 236)', dangerBorder: 'rgb(246, 207, 207)', dangerText: 'rgb(153, 27, 27)',
    warningSubtle: 'rgb(254, 243, 199)', warningBorder: 'rgb(245, 223, 166)', warningText: 'rgb(146, 64, 14)',
    inverse: 'rgb(29, 21, 48)'
  },
  dark: {
    app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', subtle: 'rgb(43, 35, 64)', border: 'rgb(53, 44, 76)',
    input: 'rgb(118, 108, 142)', tertiary: 'rgb(163, 154, 187)', secondary: 'rgb(188, 179, 208)', selected: 'rgb(56, 41, 106)', accentBorder: 'rgb(109, 79, 196)',
    accentStrong: 'rgb(221, 211, 254)', accentSubtle: 'rgb(47, 35, 80)', accentText: 'rgb(196, 181, 253)',
    accent: 'rgb(132, 75, 242)', strong: 'rgb(65, 55, 90)', warning: 'rgb(251, 191, 36)',
    dangerSubtle: 'rgb(58, 21, 24)', dangerBorder: 'rgb(94, 34, 40)', dangerText: 'rgb(252, 165, 165)',
    warningSubtle: 'rgb(51, 39, 15)', warningBorder: 'rgb(90, 69, 21)', warningText: 'rgb(252, 211, 77)',
    inverse: 'rgb(74, 61, 107)'
  }
} as const;

const SECTIONS = ['Appearance', 'Library', 'Data & Storage', 'Notifications', 'Advanced', 'About & Reset'];

const prompts = Array.from({ length: 3 }, (_, index) =>
  createPromptSeed({ id: `prompt-${String(index)}`, title: `Résumé ${String(index + 1)}`, content: 'Résume la transcription ci-dessous.' })
);

const openSettings = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts, settings: { theme } });
  await page.setViewportSize({ width: 400, height: 500 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
  await page.getByTestId('tab-settings').click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
};

/** The color painted behind an element: its own background, else the first opaque one above it */
const backdropOf = (locator: Locator) =>
  locator.evaluate((element, transparent) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      if (color !== transparent) {return color;}
    }
    return transparent;
  }, TRANSPARENT);

test.describe('General Settings sections on the tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`every section has an accent-subtle icon square and its blocks are cards on bg-app (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);

      for (const name of SECTIONS) {
        const icon = page.getByRole('region', { name }).getByTestId('section-icon');
        await expect(icon, name).toHaveCSS('background-color', colors.accentSubtle);
        await expect(icon, name).toHaveCSS('color', colors.accentText);
      }

      const themeCard = page.getByRole('region', { name: 'Appearance' }).getByRole('heading', { name: 'Theme' }).locator('..');
      await expect(themeCard).toHaveCSS('background-color', colors.card);
      await expect(themeCard).toHaveCSS('border-top-color', colors.border);
      expect(await backdropOf(themeCard.locator('..'))).toBe(colors.app);
      await expect(page.getByRole('separator').first()).toHaveCSS('border-top-color', colors.border);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/appearance-${theme}.png` });
    });

    test(`the theme is a segmented control and the interface mode a card, the chosen one in accent-selected (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);

      const themes = page.getByRole('radiogroup', { name: 'Theme' });
      await expect(themes).toHaveCSS('background-color', colors.subtle);
      const chosen = themes.getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark' });
      await expect(chosen).toHaveAttribute('aria-checked', 'true');
      await expect(chosen).toHaveCSS('background-color', colors.selected);
      await expect(chosen).toHaveCSS('border-top-color', colors.accentBorder);
      await expect(chosen).toHaveCSS('color', colors.accentStrong);
      await expect(chosen).toHaveCSS('font-weight', '600');
      const other = themes.getByRole('radio', { name: 'System' });
      await expect(other).toHaveAttribute('aria-checked', 'false');
      await expect(other).toHaveCSS('background-color', TRANSPARENT);
      await expect(other).toHaveCSS('color', colors.secondary);

      const modes = page.getByRole('radiogroup', { name: 'Interface Mode' });
      const popup = modes.getByRole('radio', { name: 'Select popup window mode' });
      await expect(popup).toHaveAttribute('aria-checked', 'true');
      await expect(popup.locator('> div')).toHaveCSS('background-color', colors.selected);
      await expect(popup.locator('> div')).toHaveCSS('border-top-color', colors.accentBorder);
      await expect(modes.getByRole('radio', { name: 'Select side panel mode' }).locator('> div')).toHaveCSS('background-color', colors.card);

      const info = page.getByText(/Popup mode opens a floating window/);
      await expect(info).toHaveCSS('color', colors.accentStrong);
      await expect(info.locator('../..')).toHaveCSS('background-color', colors.accentSubtle);
      await expect(info.locator('../..')).toHaveCSS('border-top-color', colors.accentBorder);
      await modes.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/interface-mode-${theme}.png` });
    });

    test(`the Library sort order is a field on its card (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);

      const sort = page.getByLabel('Sort prompts by');
      await expect(sort).toHaveCSS('background-color', colors.subtle);
      await expect(sort).toHaveCSS('border-top-color', colors.input);
      await expect(page.getByText('Pinned prompts stay on top.', { exact: false })).toHaveCSS('color', colors.tertiary);
      await page.getByRole('region', { name: 'Library' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-${theme}.png` });
    });

    test(`Data & Storage shows an accent storage bar and asks for a danger-colored confirmation before clearing (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);

      const bar = page.getByRole('progressbar', { name: 'Storage usage' });
      await expect(bar).toHaveCSS('background-color', colors.subtle);
      await expect(bar.locator('> div')).toHaveCSS('background-color', colors.accent);
      await expect(page.getByRole('button', { name: 'Export', exact: true })).toHaveCSS('background-color', colors.accent);
      const restore = page.getByRole('button', { name: 'Import', exact: true });
      await expect(restore).toHaveCSS('border-top-color', colors.strong);
      await expect(restore).toHaveCSS('color', colors.secondary);

      await page.getByRole('button', { name: 'Clear All Data' }).click();
      const warning = page.getByText(/This will permanently delete all your prompts/);
      await expect(warning).toHaveCSS('color', colors.dangerText);
      await expect(warning.locator('..')).toHaveCSS('background-color', colors.dangerSubtle);
      await expect(warning.locator('..')).toHaveCSS('border-top-color', colors.dangerBorder);
      await expect(page.getByRole('button', { name: 'Yes, Clear All Data' })).toHaveCSS('background-color', DANGER_FILL);
      await expect(page.getByRole('region', { name: 'Data & Storage' }).getByRole('button', { name: 'Cancel' })).toHaveCSS('border-top-color', colors.strong);
      await page.getByRole('button', { name: 'Yes, Clear All Data' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/clear-data-${theme}.png` });
    });

    test(`Notifications mark each type in its state color, with accent switches and an accent-selected position (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);
      await page.getByRole('button', { name: /Notifications/ }).first().click();

      const topRight = page.getByRole('button', { name: /Top Right/ });
      await expect(topRight).toHaveCSS('background-color', colors.selected);
      await expect(topRight).toHaveCSS('border-top-color', colors.accentBorder);
      await expect(page.getByRole('button', { name: /Bottom Right/ })).toHaveCSS('background-color', colors.card);
      await expect(page.getByRole('button', { name: 'Test', exact: true })).toHaveCSS('border-top-color', colors.strong);

      const marks = page.getByTestId('notification-type-mark');
      for (const [index, color] of [SUCCESS_FILL, DANGER_FILL, colors.warning, colors.accent].entries()) {
        await expect(marks.nth(index)).toHaveCSS('background-color', color);
      }

      const info = page.getByRole('switch', { name: 'Enable info notifications' });
      await expect(info).toHaveCSS('background-color', colors.accent);
      await info.click();
      await expect(info).toHaveAttribute('aria-checked', 'false');
      await expect(info).toHaveCSS('background-color', colors.input);
      await expect(marks.nth(3)).toHaveCSS('background-color', colors.input);
      await marks.nth(3).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/notifications-${theme}.png` });
    });

    test(`Advanced switches debug mode from an input-colored track to accent, with an accent info box (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);
      await page.getByRole('button', { name: /Advanced/ }).click();

      const tooltip = page.getByText('Enable detailed console logging for debugging');
      await expect(tooltip).toHaveCSS('background-color', colors.inverse);
      await expect(tooltip).toHaveCSS('color', ON_INVERSE);

      const debug = page.getByRole('switch', { name: 'Debug mode' });
      await expect(debug).toHaveAttribute('aria-checked', 'false');
      await expect(debug).toHaveCSS('background-color', colors.input);
      await debug.click();
      await expect(debug).toHaveAttribute('aria-checked', 'true');
      await expect(debug).toHaveCSS('background-color', colors.accent);

      const active = page.getByText(/Debug logging is now active/);
      await expect(active).toHaveCSS('color', colors.accentStrong);
      await expect(active.locator('..')).toHaveCSS('background-color', colors.accentSubtle);
      await expect(active.locator('..')).toHaveCSS('border-top-color', colors.accentBorder);
      await active.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/advanced-${theme}.png` });
    });

    test(`About links in accent and asks for a warning-colored confirmation before resetting (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);
      await page.getByRole('button', { name: /About & Reset/ }).click();

      await expect(page.getByRole('link', { name: 'GitHub Repository' })).toHaveCSS('color', colors.accentText);
      const reset = page.getByRole('button', { name: 'Reset to Defaults' });
      await expect(reset).toHaveCSS('border-top-color', colors.strong);
      await reset.click();

      const warning = page.getByText(/This will reset all settings to defaults/);
      await expect(warning).toHaveCSS('color', colors.warningText);
      await expect(warning.locator('..')).toHaveCSS('background-color', colors.warningSubtle);
      await expect(warning.locator('..')).toHaveCSS('border-top-color', colors.warningBorder);
      await expect(page.getByRole('button', { name: 'Yes, Reset Settings' })).toHaveCSS('background-color', colors.accent);
      await page.getByRole('button', { name: 'Yes, Reset Settings' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/reset-settings-${theme}.png` });
    });
  }
});

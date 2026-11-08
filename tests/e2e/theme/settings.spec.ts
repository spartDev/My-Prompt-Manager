/**
 * E2E: Settings after Atelier 1C (My-Prompt-Manager-7kd), on the color and motion tokens
 *
 * Settings is a column of Settings groups on bg-app: a label over one card of rows. Choices are segmented
 * controls, booleans switches. Also captures light/dark screenshots as visual proof (test-results/settings/).
 */

import type { Locator, Page } from '@playwright/test';

import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/settings';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const DANGER_FILL = 'rgb(220, 38, 38)';
const ON_INVERSE = 'rgb(201, 191, 230)';

const EXPECTED = {
  light: {
    primary: 'rgb(29, 21, 48)', app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', subtle: 'rgb(244, 241, 250)', border: 'rgb(236, 230, 245)',
    input: 'rgb(143, 135, 165)', tertiary: 'rgb(111, 103, 135)', secondary: 'rgb(92, 83, 112)', selected: 'rgb(237, 229, 255)', accentBorder: 'rgb(196, 181, 253)',
    accentStrong: 'rgb(76, 29, 149)', accentSubtle: 'rgb(241, 235, 253)', accentText: 'rgb(91, 33, 182)',
    accent: 'rgb(109, 40, 217)', strong: 'rgb(220, 212, 234)', warning: 'rgb(217, 119, 6)',
    dangerSubtle: 'rgb(253, 236, 236)', dangerBorder: 'rgb(246, 207, 207)', dangerText: 'rgb(153, 27, 27)',
    warningSubtle: 'rgb(254, 243, 199)', warningBorder: 'rgb(245, 223, 166)', warningText: 'rgb(146, 64, 14)',
    inverse: 'rgb(29, 21, 48)'
  },
  dark: {
    primary: 'rgb(241, 237, 249)', app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', subtle: 'rgb(43, 35, 64)', border: 'rgb(53, 44, 76)',
    input: 'rgb(118, 108, 142)', tertiary: 'rgb(163, 154, 187)', secondary: 'rgb(188, 179, 208)', selected: 'rgb(56, 41, 106)', accentBorder: 'rgb(109, 79, 196)',
    accentStrong: 'rgb(221, 211, 254)', accentSubtle: 'rgb(47, 35, 80)', accentText: 'rgb(196, 181, 253)',
    accent: 'rgb(132, 75, 242)', strong: 'rgb(65, 55, 90)', warning: 'rgb(251, 191, 36)',
    dangerSubtle: 'rgb(58, 21, 24)', dangerBorder: 'rgb(94, 34, 40)', dangerText: 'rgb(252, 165, 165)',
    warningSubtle: 'rgb(51, 39, 15)', warningBorder: 'rgb(90, 69, 21)', warningText: 'rgb(252, 211, 77)',
    inverse: 'rgb(74, 61, 107)'
  }
} as const;

const GROUPS = ['Appearance', 'Library', 'AI sites', 'Your data', 'Notifications', 'Help', 'Advanced'];

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

/** The card of a Settings group: the element after its label */
const cardOf = (page: Page, name: string) => page.getByRole('region', { name }).locator('> div').first();

test.describe('Settings after Atelier 1C', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`Settings is a column of groups, each a label over one card on bg-app, under the version (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);

      const version = page.getByText(/^My Prompt Manager \d+\.\d+\.\d+$/);
      await expect(version).toHaveCSS('color', colors.tertiary);
      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toHaveCSS('font-size', '27px');
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(GROUPS);

      for (const name of GROUPS) {
        await expect(page.getByRole('heading', { level: 2, name }), name).toHaveCSS('color', colors.secondary);
        const card = cardOf(page, name);
        await expect(card, name).toHaveCSS('background-color', colors.card);
        await expect(card, name).toHaveCSS('border-top-color', colors.border);
        await expect(card, name).toHaveCSS('border-top-left-radius', '20px');
      }
      await expect(page.locator('[data-scroll-container]')).toHaveCSS('background-color', TRANSPARENT);
      await expect(page.locator('[data-scroll-container]').locator('..')).toHaveCSS('background-color', colors.app);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/appearance-${theme}.png` });
    });

    test(`the theme and the opening mode are segmented controls: a card puck with an input outline under the chosen option (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);

      const themes = page.getByRole('radiogroup', { name: 'Theme' });
      await expect(themes).toHaveCSS('background-color', colors.subtle);
      await expect(themes).toHaveCSS('width', '186px');
      const puck = themes.getByTestId('segmented-puck');
      await expect(puck).toHaveCSS('background-color', colors.card);
      await expect(puck).toHaveCSS('border-top-color', colors.input);
      const chosen = themes.getByRole('radio', { name: theme === 'light' ? 'Light' : 'Dark' });
      await expect(chosen).toHaveAttribute('aria-checked', 'true');
      await expect(chosen).toHaveCSS('color', colors.primary);
      const other = themes.getByRole('radio', { name: 'System' });
      await expect(other).toHaveAttribute('aria-checked', 'false');
      await expect(other).toHaveCSS('color', colors.tertiary);

      const modes = page.getByRole('radiogroup', { name: 'Open in' });
      await expect(modes.getByRole('radio', { name: 'Popup' })).toHaveAttribute('aria-checked', 'true');
      await modes.getByRole('radio', { name: 'Side panel' }).click();
      await expect(modes.getByRole('radio', { name: 'Side panel' })).toHaveAttribute('aria-checked', 'true');
      // The mode saves, then stays locked for a few seconds, with a spinner beside it
      await expect(page.getByTestId('interface-mode-spinner')).toBeVisible();
      await expect(modes).toHaveAttribute('aria-disabled', 'true');
      await expect.poll(async () => (await storage.get<{ interfaceMode?: string }>('interfaceMode')).interfaceMode).toBe('sidepanel');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/interface-mode-${theme}.png` });
    });

    test(`the Library sort order is a compact field in its row (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);

      const sort = page.getByLabel('Sort prompts by');
      await expect(sort).toHaveCSS('background-color', colors.subtle);
      await expect(sort).toHaveCSS('border-top-color', colors.input);
      await expect(sort).toHaveCSS('height', '34px');
      await page.getByRole('region', { name: 'Library' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-${theme}.png` });
    });

    test(`Your data shows what this device stores, Export and Import as pills, and a danger-colored confirmation before clearing (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);
      const group = page.getByRole('region', { name: 'Your data' });

      await expect(group.getByText(/ of 10 MB$/)).toHaveCSS('color', colors.tertiary);
      await expect(group.getByText('3 prompts · 1 category')).toBeVisible();
      const bar = page.getByRole('progressbar', { name: 'Storage usage' });
      await expect(bar).toHaveCSS('background-color', colors.subtle);
      await expect(bar).toHaveCSS('height', '8px');
      await expect(bar.locator('> div')).toHaveCSS('background-color', colors.accent);
      for (const name of ['Export', 'Import']) {
        const button = group.getByRole('button', { name, exact: true });
        await expect(button, name).toHaveCSS('background-color', colors.card);
        await expect(button, name).toHaveCSS('border-top-color', colors.strong);
        await expect(button, name).toHaveCSS('height', '40px');
      }
      await group.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/your-data-${theme}.png` });

      await page.getByRole('button', { name: 'Clear All Data' }).click();
      const warning = page.getByText(/This will permanently delete all your prompts/);
      await expect(warning).toHaveCSS('color', colors.dangerText);
      await expect(warning.locator('..')).toHaveCSS('background-color', colors.dangerSubtle);
      await expect(warning.locator('..')).toHaveCSS('border-top-color', colors.dangerBorder);
      await expect(page.getByRole('button', { name: 'Yes, Clear All Data' })).toHaveCSS('background-color', DANGER_FILL);
      await expect(group.getByRole('button', { name: 'Cancel' })).toHaveCSS('border-top-color', colors.strong);
      await page.getByRole('button', { name: 'Yes, Clear All Data' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/clear-data-${theme}.png` });
    });

    // My-Prompt-Manager-ag4: the app's error toast, not a native alert, says the file is invalid
    test(`an invalid Backup file is reported in an error toast on bg-inverse, not a native alert (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);
      const nativeDialogs: string[] = [];
      page.on('dialog', dialog => {
        nativeDialogs.push(dialog.message());
        void dialog.dismiss();
      });

      const fileChooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Import', exact: true }).click();
      await (await fileChooser).setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('not a backup') });

      const toast = page.getByRole('alert').filter({ hasText: 'Import failed' });
      await expect(toast).toBeVisible();
      await expect(toast).toHaveCSS('background-color', colors.inverse);
      await expect(toast.getByText('Invalid JSON format. Please select a valid backup file.')).toHaveCSS('color', ON_INVERSE);
      expect(await storage.getPrompts()).toHaveLength(prompts.length);
      expect(nativeDialogs).toEqual([]);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/import-invalid-${theme}.png` });
    });

    test(`Notifications is one row with one switch, input-colored when off (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);
      const section = page.getByRole('region', { name: 'Notifications' });

      await expect(section.getByRole('switch')).toHaveCount(1);
      await expect(section.getByRole('button')).toHaveCount(0);
      const toggle = section.getByRole('switch', { name: 'Show notifications' });
      await expect(toggle).toHaveCSS('background-color', colors.accent);
      await expect(toggle).toHaveCSS('width', '42px');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
      await expect(toggle).toHaveCSS('background-color', colors.input);
      await section.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/notifications-${theme}.png` });
    });

    test(`Help links out, and Advanced switches debug mode and asks before resetting, with nothing to expand (${theme})`, async ({ page, storage, extensionId }) => {
      await openSettings(page, storage, extensionId, theme);

      await expect(page.getByRole('button', { expanded: false })).toHaveCount(0);
      const github = page.getByRole('link', { name: 'GitHub Repository' });
      await expect(github).toHaveCSS('color', colors.primary);
      await expect(page.getByText('MIT · Thomas Roux')).toHaveCSS('color', colors.tertiary);

      const debug = page.getByRole('switch', { name: 'Debug mode' });
      await expect(debug).toHaveAttribute('aria-checked', 'false');
      await expect(debug).toHaveCSS('background-color', colors.input);
      await debug.click();
      await expect(debug).toHaveAttribute('aria-checked', 'true');
      await expect(debug).toHaveCSS('background-color', colors.accent);
      const active = page.getByText(/Debug logging is now active/);
      await expect(active).toHaveCSS('color', colors.accentStrong);
      await expect(active).toHaveCSS('background-color', colors.accentSubtle);
      await active.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/advanced-${theme}.png` });

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

  test('the theme and opening mode radio groups take one tab stop and follow the arrows, Home and End', async ({ page, storage, extensionId }) => {
    await openSettings(page, storage, extensionId, 'light');
    const tabStops = (group: Locator) => group.getByRole('radio').evaluateAll(radios => radios.map(radio => (radio as HTMLElement).tabIndex));

    const themes = page.getByRole('radiogroup', { name: 'Theme' });
    const theme = (name: string) => themes.getByRole('radio', { name });
    expect(await tabStops(themes)).toEqual([0, -1, -1]);
    await theme('Light').focus();
    for (const [key, name] of [['ArrowRight', 'Dark'], ['End', 'System'], ['ArrowDown', 'Light'], ['ArrowLeft', 'System'], ['Home', 'Light'], ['ArrowUp', 'System']] as const) {
      await page.keyboard.press(key);
      await expect(theme(name), key).toBeFocused();
      await expect(theme(name), key).toHaveAttribute('aria-checked', 'true');
    }
    expect(await tabStops(themes)).toEqual([-1, -1, 0]);
    await page.keyboard.press('Tab');
    await expect(themes.locator(':focus')).toHaveCount(0);

    const modes = page.getByRole('radiogroup', { name: 'Open in' });
    const sidePanel = modes.getByRole('radio', { name: 'Side panel' });
    expect(await tabStops(modes)).toEqual([0, -1]);
    await modes.getByRole('radio', { name: 'Popup' }).focus();
    await page.keyboard.press('ArrowRight');
    // The mode saves for a few seconds: the chosen radio keeps the focus meanwhile
    await expect(sidePanel).toHaveAttribute('aria-checked', 'true');
    await expect(sidePanel).toBeFocused();
    expect(await tabStops(modes)).toEqual([-1, 0]);
  });

  test('the switch knob and the segmented puck move on the spring, and at once under reduced motion', async ({ page, storage, extensionId }) => {
    await openSettings(page, storage, extensionId, 'light');
    const knob = page.getByRole('switch', { name: 'Show notifications' }).locator('span');
    const puck = page.getByRole('radiogroup', { name: 'Theme' }).getByTestId('segmented-puck');

    await expect(knob).toHaveCSS('transition-duration', '0.45s');
    await expect(knob).toHaveCSS('transition-timing-function', 'cubic-bezier(0.34, 1.56, 0.64, 1)');
    await expect(puck).toHaveCSS('transition-duration', '0.45s');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(knob).toHaveCSS('transition-duration', '0.001s');
    await expect(puck).toHaveCSS('transition-duration', '0.001s');
    await expect(page.getByRole('progressbar', { name: 'Storage usage' }).locator('> div')).toHaveCSS('animation-duration', '0.001s');
  });
});

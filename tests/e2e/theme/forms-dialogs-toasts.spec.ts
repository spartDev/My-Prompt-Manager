/**
 * E2E: forms, dialogs and toasts on the color tokens (My-Prompt-Manager-el4.4)
 *
 * The prompt forms are a card on bg-app with bg-subtle fields and danger-colored validation; the
 * delete confirmation is a card on the backdrop; every toast type sits on bg-inverse with its bright
 * icon; a save refused for lack of storage opens the storage warning on the backdrop and keeps the
 * Add form (My-Prompt-Manager-jnu). Also captures light/dark screenshots as visual proof
 * (test-results/forms-dialogs-toasts/).
 */

import type { Page } from '@playwright/test';

import type { Category, Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/forms-dialogs-toasts';
const DANGER_FILL = 'rgb(220, 38, 38)';

const EXPECTED = {
  light: {
    app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', subtle: 'rgb(244, 241, 250)', strong: 'rgb(220, 212, 234)',
    input: 'rgb(143, 135, 165)', accent: 'rgb(109, 40, 217)', dangerText: 'rgb(153, 27, 27)',
    backdrop: 'rgba(42, 33, 64, 0.45)', inverse: 'rgb(29, 21, 48)'
  },
  dark: {
    app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', subtle: 'rgb(43, 35, 64)', strong: 'rgb(65, 55, 90)',
    input: 'rgb(118, 108, 142)', accent: 'rgb(132, 75, 242)', dangerText: 'rgb(252, 165, 165)',
    backdrop: 'rgba(7, 5, 12, 0.7)', inverse: 'rgb(74, 61, 107)'
  }
} as const;

const ON_INVERSE = 'rgb(201, 191, 230)';
const TOAST_ICONS = [
  { type: 'success', role: 'status', color: 'rgb(110, 231, 183)' },
  { type: 'error', role: 'alert', color: 'rgb(252, 165, 165)' },
  { type: 'warning', role: 'alert', color: 'rgb(252, 211, 77)' },
  { type: 'info', role: 'status', color: 'rgb(196, 181, 253)' }
] as const;

const categories: Category[] = [{ id: 'writing', name: 'Rédaction', color: '#2563EB' }];
const prompt = createPromptSeed({
  id: 'meeting',
  title: 'Résumé de réunion',
  content: 'Résume la transcription ci-dessous en 5 points clés, puis liste les décisions prises.',
  category: 'Rédaction'
});

const openPopup = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  theme: 'light' | 'dark',
  library: Prompt[] = [prompt]
) => {
  await seedLibrary(storage, { prompts: library, categories, settings: { theme } });
  await page.setViewportSize({ width: 400, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await expect(page.getByTestId('prompt-card').first()).toBeVisible();
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

test.describe('Forms, dialogs and toasts on the tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`the Add form is a card with subtle fields and a danger-colored validation error (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      await page.getByTestId('new-prompt-button').click();

      const form = page.locator('#add-prompt-form');
      await expect(form).toHaveCSS('background-color', colors.card);
      const title = page.getByLabel('Title (optional)');
      await expect(title).toHaveCSS('background-color', colors.subtle);
      await expect(title).toHaveCSS('border-top-color', colors.input);
      // The form overflows the popup: the footer line shows while fields remain below
      await expect(page.getByRole('button', { name: 'Save Prompt' }).locator('xpath=../..')).toHaveCSS('border-top-color', colors.strong);
      await expect(page.getByRole('button', { name: 'Save Prompt' })).toHaveCSS('background-color', colors.accent);

      await title.fill('T'.repeat(101));
      await page.getByLabel('Content *').fill('Résume la transcription ci-dessous.');
      await page.getByRole('button', { name: 'Save Prompt' }).click();

      await expect(title).toHaveCSS('border-top-color', DANGER_FILL);
      await expect(page.getByText('Title cannot exceed 100 characters')).toHaveCSS('color', colors.dangerText);
      await title.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/add-form-error-${theme}.png` });
    });

    test(`the Edit form shows its validation error and its delete confirmation on the backdrop (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      await page.getByRole('button', { name: `Edit ${prompt.title}` }).click();

      const title = page.getByLabel('Title', { exact: true });
      await title.fill('T'.repeat(101));
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await expect(title).toHaveCSS('border-top-color', DANGER_FILL);
      await expect(page.getByText(/Title cannot exceed 100 characters/)).toHaveCSS('color', colors.dangerText);
      await title.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/edit-form-error-${theme}.png` });

      await page.getByRole('button', { name: 'Delete prompt' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('> div').first()).toHaveCSS('background-color', colors.backdrop);
      await expect(dialog.locator('> div').nth(1)).toHaveCSS('background-color', colors.card);
      await expect(dialog.getByRole('button', { name: 'Delete' })).toHaveCSS('background-color', DANGER_FILL);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/delete-confirmation-${theme}.png` });
    });

    test(`a save refused for lack of storage opens the storage warning on the backdrop and keeps the Add form (${theme})`, async ({ page, storage, extensionId }) => {
      // About 4.2 MB of Prompts plus a 6 MB key: over 95% of the 10 MB quota, so a new Prompt does not fit
      const fullLibrary = Array.from({ length: 220 }, (_, i) =>
        createPromptSeed({ id: `long-${String(i)}`, title: `Long prompt ${String(i + 1)}`, content: 'x'.repeat(19_000), category: 'Rédaction' })
      );
      await openPopup(page, storage, extensionId, theme, fullLibrary);
      await storage.seed({ quotaFiller: 'x'.repeat(6_000_000) });

      await page.getByTestId('new-prompt-button').click();
      const content = page.getByLabel('Content *');
      await content.fill('Résume la transcription ci-dessous.');
      await page.getByRole('button', { name: 'Save Prompt' }).click();

      const warning = page.getByRole('dialog', { name: 'Storage Limit Reached' });
      await expect(warning).toBeVisible();
      await expect(warning.locator('..')).toHaveCSS('background-color', colors.backdrop);
      await expect(warning).toHaveCSS('background-color', colors.card);
      await expect(warning.getByRole('button', { name: 'Clear All Data' })).toHaveCSS('background-color', DANGER_FILL);
      await expect(page.getByText('Error Loading Data')).toHaveCount(0);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/storage-warning-${theme}.png` });

      await warning.getByRole('button', { name: 'Continue' }).click();
      await expect(warning).toHaveCount(0);
      await expect(content).toHaveValue('Résume la transcription ci-dessous.');
      await expect(page.getByRole('alert')).toContainText(/storage/i);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/save-refused-${theme}.png` });
    });

    test(`every toast type sits on bg-inverse with its bright icon (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      await page.getByTestId('tab-settings').click();
      await page.getByRole('button', { name: /Notifications/ }).first().click();

      for (const { type, role, color } of TOAST_ICONS) {
        await page.getByRole('button', { name: 'Test', exact: true }).click();
        const toast = page.getByRole(role).filter({ hasText: new RegExp(type, 'i') }).last();
        await expect(toast).toHaveCSS('background-color', colors.inverse);
        await expect(toast).toHaveCSS('color', ON_INVERSE);
        await expect(toast.locator('svg').first().locator('..')).toHaveCSS('color', color);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/toast-${type}-${theme}.png` });
        await toast.getByRole('button', { name: 'Dismiss notification' }).click();
        await expect(toast).toHaveCount(0);
      }
    });
  }
});

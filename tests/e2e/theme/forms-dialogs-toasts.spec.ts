/**
 * E2E: forms, dialogs and toasts on the color tokens (My-Prompt-Manager-el4.4)
 *
 * The Prompt editor is a card with a bg-subtle text field and danger-colored validation; the
 * delete confirmation is a card on the backdrop; a Notification is the Atelier 1C pill at the top
 * center on bg-inverse, with a violet round for a confirmation and a red one for a failure, and the
 * Notifications switch silences both (My-Prompt-Manager-dds); a save refused for lack of storage opens the storage warning on the backdrop and keeps the
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
const WHITE = 'rgb(255, 255, 255)';
const MARK = 'rgb(167, 139, 250)';
const ALERT = 'rgb(252, 165, 165)';
const VIEWPORT_WIDTH = 400;

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

    test(`the new Prompt editor is a card with a subtle text field and a danger-colored validation error (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      await page.getByTestId('new-prompt-button').click();

      const editor = page.getByRole('heading', { name: 'New prompt', exact: true }).locator('xpath=../..');
      await expect(editor).toHaveCSS('background-color', colors.card);
      const title = page.getByLabel('Title', { exact: true });
      const contentField = page.getByTestId('variable-mirror').locator('..');
      await expect(contentField).toHaveCSS('background-color', colors.subtle);
      await expect(contentField).toHaveCSS('border-top-color', colors.input);
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCSS('background-color', colors.accent);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/new-prompt-${theme}.png` });

      await title.fill('T'.repeat(101));
      await page.getByLabel('Content', { exact: true }).fill('Résume la transcription ci-dessous pour {{audience}}.');
      await expect(page.getByTestId('variable-mirror').locator('mark')).toHaveText('{{audience}}');
      await page.getByRole('button', { name: 'Save', exact: true }).click();

      await expect(title).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByText('Title cannot exceed 100 characters')).toHaveCSS('color', colors.dangerText);
      await title.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/add-form-error-${theme}.png` });
    });

    test(`the Edit form shows its validation error and its delete confirmation on the backdrop (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      await page.getByRole('button', { name: `Edit ${prompt.title}` }).click();

      const title = page.getByLabel('Title', { exact: true });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/edit-prompt-${theme}.png` });
      await title.fill('T'.repeat(101));
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(title).toHaveAttribute('aria-invalid', 'true');
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
      // 420 Prompts of 19,000 characters store 8.1 MB, past StorageManager's 8 MB cap on the Prompts
      // (77% of Chrome's 10 MB): the warning must say the limit is reached
      const fullLibrary = Array.from({ length: 420 }, (_, i) =>
        createPromptSeed({ id: `long-${String(i)}`, title: `Long prompt ${String(i + 1)}`, content: 'x'.repeat(19_000), category: 'Rédaction' })
      );
      await openPopup(page, storage, extensionId, theme, fullLibrary);

      await page.getByTestId('new-prompt-button').click();
      const content = page.getByLabel('Content', { exact: true });
      await content.fill('Résume la transcription ci-dessous.');
      await page.getByRole('button', { name: 'Save', exact: true }).click();

      const warning = page.getByRole('dialog', { name: 'Storage Limit Reached' });
      await expect(warning).toBeVisible();
      await expect(warning.getByText('Storage quota exceeded. Please delete old prompts to free up space.')).toBeVisible();
      // Chrome's use as a whole percentage, as the Settings bar shows it (My-Prompt-Manager-54h)
      const percentage = await page.evaluate(async () =>
        Math.round(((await chrome.storage.local.getBytesInUse()) / chrome.storage.local.QUOTA_BYTES) * 100)
      );
      await expect(warning.getByText(`${String(percentage)}%`, { exact: true })).toBeVisible();
      await expect(warning.getByText(/\d\.\d*%/)).toHaveCount(0);
      await expect(warning.locator('..')).toHaveCSS('background-color', colors.backdrop);
      await expect(warning).toHaveCSS('background-color', colors.card);
      await expect(warning.getByRole('button', { name: 'Clear All Data' })).toHaveCSS('background-color', DANGER_FILL);
      await expect(page.getByText('Error Loading Data')).toHaveCount(0);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/storage-warning-${theme}.png` });

      // A modal: the keyboard starts on Continue and stays in the warning
      await expect(warning.getByRole('button', { name: 'Continue' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(warning.getByRole('button', { name: 'Clear All Data' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(warning.getByRole('button', { name: 'Continue' })).toBeFocused();

      // Enter on Clear All Data opens its confirmation above the warning, inert beneath it: one aria-modal
      // at a time (My-Prompt-Manager-xaz). Escape closes the confirmation and puts the keyboard back on
      // Clear All Data
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      const confirmation = page.getByRole('dialog', { name: 'Clear All Data' });
      await expect(confirmation).toBeVisible();
      await expect(warning.locator('xpath=ancestor-or-self::*[@inert]')).toHaveCount(1);
      await expect(confirmation.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(confirmation.getByRole('button', { name: 'Clear All Data' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(confirmation.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/storage-warning-confirmation-${theme}.png` });
      await page.keyboard.press('Escape');
      await expect(confirmation).toHaveCount(0);
      await expect(warning.locator('xpath=ancestor-or-self::*[@inert]')).toHaveCount(0);
      await expect(warning.getByRole('button', { name: 'Clear All Data' })).toBeFocused();

      // Escape closes the warning and gives the keyboard back to Save
      await page.keyboard.press('Escape');
      await expect(warning).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
      await expect(content).toHaveValue('Résume la transcription ci-dessous.');
      await expect(page.getByRole('alert')).toContainText(/storage/i);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/save-refused-${theme}.png` });
    });

    test(`a Notification is the top-center pill, violet for a confirmation, red for a failure, and the switch silences both (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      await page.getByTestId('tab-settings').click();
      const notificationsSwitch = page.getByRole('switch', { name: 'Show notifications' });
      await expect(notificationsSwitch).toHaveAttribute('aria-checked', 'true');

      // Waits for the entrance (the drop, then the round's pop) to end before measuring or capturing
      const settle = async (toast: ReturnType<Page['getByTestId']>) => {
        await toast.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
      };

      // Turning the switch back on shows a confirmation at once
      await notificationsSwitch.click();
      await notificationsSwitch.click();
      const confirmation = page.getByRole('status').filter({ hasText: 'Notifications on' });
      await expect(confirmation).toBeVisible();
      await settle(confirmation);
      await expect(confirmation).toHaveCSS('background-color', colors.inverse);
      await expect(confirmation).toHaveCSS('height', '40px');
      await expect(confirmation.getByText('Notifications on')).toHaveCSS('color', WHITE);
      await expect(confirmation.getByTestId('toast-mark')).toHaveCSS('background-color', MARK);
      await expect(confirmation.getByRole('button')).toHaveCount(0);
      const box = await confirmation.boundingBox();
      expect(box?.y).toBeCloseTo(12, 0);
      expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeCloseTo(VIEWPORT_WIDTH / 2, 0);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/toast-success-${theme}.png` });
      await page.keyboard.press('Escape');
      await expect(confirmation).toHaveCount(0);

      // A failure: a red round, announced at once, its reason cut to fit the pill
      const importBackup = async () => {
        const fileChooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Import', exact: true }).click();
        await (await fileChooser).setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('not a backup') });
      };
      await importBackup();
      const failure = page.getByRole('alert').filter({ hasText: 'Import failed' });
      await expect(failure).toBeVisible();
      await settle(failure);
      await expect(failure).toHaveCSS('background-color', colors.inverse);
      await expect(failure.getByTestId('toast-mark')).toHaveCSS('background-color', ALERT);
      const message = failure.getByText('Import failed', { exact: true });
      expect(await message.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      const reason = failure.getByText(/Invalid JSON format/);
      await expect(reason).toHaveCSS('color', ON_INVERSE);
      await expect(reason).toHaveCSS('text-overflow', 'ellipsis');
      expect(await reason.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
      expect((await failure.boundingBox())?.width).toBeLessThanOrEqual(VIEWPORT_WIDTH - 32);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/toast-error-${theme}.png` });

      // A message longer than the pill is cut inside it: the round, the gaps and the spacer keep their room
      const pill = page.getByTestId('toast');
      const longMessage = pill.getByTestId('toast-text').locator('> span').first();
      await longMessage.evaluate(element => { element.textContent = 'Import failed '.repeat(12); });
      const pillBox = await pill.boundingBox();
      const messageBox = await longMessage.boundingBox();
      expect(pillBox?.width).toBeLessThanOrEqual(VIEWPORT_WIDTH - 32);
      expect((messageBox?.x ?? 0) + (messageBox?.width ?? 0)).toBeLessThanOrEqual((pillBox?.x ?? 0) + (pillBox?.width ?? 0) - 14);
      expect((await pill.getByTestId('toast-mark').boundingBox())?.width).toBe(20);
      expect(await longMessage.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);

      await page.keyboard.press('Escape');
      await expect(pill).toHaveCount(0);

      // Off: no Notification at all, a failure included
      await notificationsSwitch.click();
      await expect(notificationsSwitch).toHaveAttribute('aria-checked', 'false');
      await importBackup();
      await expect(page.getByText('Import failed')).toHaveCount(0);
      await expect(page.getByTestId('toast')).toHaveCount(0);
    });
  }
});

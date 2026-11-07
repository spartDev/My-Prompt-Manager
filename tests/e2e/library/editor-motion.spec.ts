/**
 * E2E: the motion of the Prompt editor (My-Prompt-Manager-8kh, Atelier 1C)
 *
 * The editor rises as a sheet over the Library (sheet-in), which waits inert beneath it; Cancel
 * sends it down (sheet-out) and unmounts it after; Save shows "Saved", then the sheet leaves and
 * the Notification appears; a new Variable and the check of a chosen chip pop in. Under
 * prefers-reduced-motion everything is near instant. Also captures light/dark screenshots as
 * visual proof (test-results/editor-motion/).
 */

import type { Page } from '@playwright/test';

import { EASE, MOTION } from '../../../src/theme/motion';
import type { Category } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/editor-motion';

const categories: Category[] = [{ id: 'writing', name: 'Rédaction', color: '#2563EB' }];
const prompt = createPromptSeed({
  id: 'meeting',
  title: 'Résumé de réunion',
  content: 'Résume la transcription ci-dessous en 5 points clés.',
  category: 'Rédaction'
});

const seconds = (ms: number): string => `${ms / 1000}s`;

const openPopup = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts: [prompt], categories, settings: { theme } });
  await page.setViewportSize({ width: 400, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await expect(page.getByTestId('prompt-card').first()).toBeVisible();
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

test.describe('Prompt editor motion', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`the editor rises as a sheet, leaves on Cancel and gives New the keyboard back (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      const newButton = page.getByTestId('new-prompt-button');
      await newButton.click();

      const sheet = page.getByTestId('editor-sheet');
      await expect(sheet).toHaveCSS('animation-name', 'sheet-in');
      await expect(sheet).toHaveCSS('animation-duration', seconds(MOTION.sheetIn));
      await expect(sheet).toHaveCSS('animation-timing-function', EASE.sheet);
      await expect(page.getByLabel('Title', { exact: true })).toBeFocused();
      // The Library waits beneath, out of reach
      await expect(page.getByTestId('prompt-card').first().locator('xpath=ancestor::*[@inert]')).toHaveCount(1);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/editor-sheet-${theme}.png` });

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(sheet).toHaveCSS('animation-name', 'sheet-out');
      await expect(sheet).toHaveCSS('animation-duration', seconds(MOTION.sheetOut));
      await expect(sheet).toHaveCount(0);
      await expect(newButton).toBeFocused();
    });

    test(`Save shows "Saved", then the sheet leaves with the Notification; chips and Variables pop (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      await page.getByTestId('new-prompt-button').click();
      const sheet = page.getByTestId('editor-sheet');

      const chip = sheet.getByRole('radio', { name: 'Rédaction', exact: true });
      await expect(chip).toHaveCSS('transition-duration', '0.25s, 0.25s, 0.25s, 0.25s');
      await chip.click();
      await expect(chip.locator('svg')).toHaveCSS('animation-name', 'pop');
      await expect(chip.locator('svg')).toHaveCSS('animation-duration', seconds(MOTION.popCheck));

      await page.getByLabel('Content', { exact: true }).fill('Résume pour {{audience}}.');
      const variable = page.getByRole('region', { name: 'Variables' }).getByRole('listitem');
      await expect(variable).toHaveText('audience');
      await expect(variable).toHaveCSS('animation-name', 'pop');
      await expect(variable).toHaveCSS('animation-duration', seconds(MOTION.pop));
      await expect(variable).toHaveCSS('animation-timing-function', EASE.spring);

      const save = page.getByRole('button', { name: 'Save', exact: true });
      await expect(save).toHaveCSS('transition-duration', '0.3s, 0.3s, 0.25s');
      await save.click();

      const saved = page.getByRole('button', { name: 'Saved', exact: true });
      await expect(saved).toBeDisabled();
      await expect(saved.locator('svg')).toHaveCSS('animation-name', 'pop');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/saved-${theme}.png` });

      // The sheet leaves and the Notification comes with it
      const toast = page.getByRole('status');
      await expect(toast).toContainText('Prompt created');
      await expect(sheet).toHaveCSS('animation-name', 'sheet-out');
      await expect(toast).toHaveCSS('animation-name', 'toast-in');
      await expect(toast).toHaveCSS('animation-timing-function', EASE.spring);
      await expect(toast.getByTestId('toast-mark')).toHaveCSS('animation-delay', seconds(MOTION.toastMarkDelay));
      await page.screenshot({ path: `${SCREENSHOT_DIR}/toast-${theme}.png` });
      await expect(sheet).toHaveCount(0);
    });
  }

  test('under prefers-reduced-motion the sheet and the Save sequence are near instant', async ({ page, storage, extensionId }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPopup(page, storage, extensionId, 'light');
    await page.getByTestId('new-prompt-button').click();

    const sheet = page.getByTestId('editor-sheet');
    await expect(sheet).toHaveCSS('animation-duration', '0.001s');

    await page.getByLabel('Content', { exact: true }).fill('Résume.');
    const before = Date.now();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(sheet).toHaveCount(0);

    expect(Date.now() - before).toBeLessThan(MOTION.savedPause + MOTION.sheetOut);
    await expect(page.getByRole('status')).toContainText('Prompt created');
  });
});

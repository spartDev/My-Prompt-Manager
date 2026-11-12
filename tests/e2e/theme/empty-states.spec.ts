/**
 * E2E: the empty states of the Library, Categories and Analytics (My-Prompt-Manager-qrr, Atelier 1C
 * 5a to 5f)
 *
 * A Library with no Prompt, Categories with only the Default Category, and Analytics with no Insertion
 * each show their empty state on the color tokens, in light and dark, and give way to the real
 * screen as soon as there is something to show, without a reload. Also captures light/dark
 * screenshots as visual proof (test-results/empty-states/).
 */

import type { Page } from '@playwright/test';

import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, createUsageEventSeed, seedLibrary, seedUsageHistory } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/empty-states';

const EXPECTED = {
  light: {
    app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', primary: 'rgb(29, 21, 48)', secondary: 'rgb(92, 83, 112)',
    tertiary: 'rgb(111, 103, 135)', accent: 'rgb(109, 40, 217)', strong: 'rgb(220, 212, 234)', border: 'rgb(236, 230, 245)',
    ghost: 'rgb(207, 197, 227)', inverse: 'rgb(29, 21, 48)', dim: 'rgb(143, 130, 179)', inverseGhost: 'rgba(255, 255, 255, 0.26)',
    tileBlue: 'rgb(37, 99, 235)'
  },
  dark: {
    app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', primary: 'rgb(241, 237, 249)', secondary: 'rgb(188, 179, 208)',
    tertiary: 'rgb(163, 154, 187)', accent: 'rgb(132, 75, 242)', strong: 'rgb(65, 55, 90)', border: 'rgb(53, 44, 76)',
    ghost: 'rgb(74, 64, 102)', inverse: 'rgb(74, 61, 107)', dim: 'rgb(181, 169, 214)', inverseGhost: 'rgba(255, 255, 255, 0.34)',
    tileBlue: 'rgb(59, 130, 246)'
  }
} as const;

const ON_ACCENT = 'rgb(255, 255, 255)';

/** The popup is 400 x 500 */
const POPUP = { width: 400, height: 500 } as const;

type Theme = 'light' | 'dark';

const openPopup = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  theme: Theme,
  library: Parameters<typeof seedLibrary>[1] = {}
) => {
  await seedLibrary(storage, { ...library, settings: { theme } });
  // The entrances are near instant, and the card of the Library illustration does not float
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(POPUP);
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

test.describe('Empty states', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`a Library with no Prompt offers to write the first one or to import a Backup (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);

      const empty = page.getByTestId('library-empty');
      const title = empty.getByRole('heading', { level: 2, name: 'Your library is empty' });
      await expect(title).toHaveCSS('color', colors.primary);
      await expect(title).toHaveCSS('font-size', '21px');
      await expect(empty.getByText('Save the prompts you keep retyping.')).toHaveCSS('color', colors.secondary);

      // The header stays, without the search or the Library filter; the tab bar stays
      await expect(page.getByTestId('new-prompt-button')).toBeVisible();
      await expect(page.getByText('0 prompts', { exact: true })).toBeVisible();
      await expect(page.getByRole('search')).toHaveCount(0);
      await expect(page.getByTestId('tab-library')).toBeVisible();

      const write = empty.getByRole('button', { name: 'Write your first prompt' });
      await expect(write).toHaveCSS('background-color', colors.accent);
      await expect(write).toHaveCSS('color', ON_ACCENT);
      await expect(write).toHaveCSS('height', '46px');
      const importBackup = empty.getByRole('button', { name: 'Import a backup' });
      await expect(importBackup).toHaveCSS('background-color', colors.card);
      await expect(importBackup).toHaveCSS('border-top-color', colors.strong);
      // What the app does not have is not offered
      await expect(empty.getByRole('button')).toHaveCount(2);

      // The whole state fits the popup: nothing to scroll to
      await expect(importBackup).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-${theme}.png` });

      // Keyboard, in the order read: New, then the two actions
      await page.getByTestId('new-prompt-button').focus();
      await page.keyboard.press('Tab');
      await expect(write).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(importBackup).toBeFocused();
    });

    test(`writing the first Prompt brings the Library back, and deleting it brings the empty state back (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);

      await page.getByRole('button', { name: 'Write your first prompt' }).click();
      await page.getByLabel('Title').fill('First prompt');
      await page.getByRole('textbox', { name: 'Content' }).fill('Hello {{name}}');
      await page.getByRole('button', { name: 'Save', exact: true }).click();

      await expect(page.getByTestId('prompt-card')).toHaveCount(1);
      await expect(page.getByTestId('library-empty')).toHaveCount(0);
      await expect(page.getByRole('search')).toBeVisible();

      // The last Prompt is deleted from the editor: the empty state is back, with no reload, and the
      // keyboard goes to its main action, the Library filter being gone
      await page.getByRole('button', { name: 'Edit First prompt' }).click();
      await page.getByRole('button', { name: 'Delete prompt' }).click();
      await page.getByRole('dialog', { name: 'Delete Prompt' }).getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByTestId('library-empty')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Write your first prompt' })).toBeFocused();
    });

    test(`"Import a backup" opens Settings with the keyboard on Import (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);

      await page.getByRole('button', { name: 'Import a backup' }).click();

      await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
      const importButton = page.getByRole('button', { name: 'Import', exact: true });
      await expect(importButton).toBeFocused();
      await expect(importButton).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/import-in-settings-${theme}.png` });
    });

    test(`Categories with only the Default Category offer to create one, in the sheet or in one tap (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      await page.getByTestId('tab-categories').click();

      const empty = page.getByTestId('categories-empty');
      await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
      await expect(page.getByText('Organize', { exact: true })).toHaveCSS('color', colors.tertiary);
      await expect(empty.getByRole('heading', { level: 2, name: 'No categories yet' })).toHaveCSS('color', colors.primary);
      await expect(page.getByTestId('category-row')).toHaveCount(0);

      const create = empty.getByRole('button', { name: 'Create a category' });
      await expect(create).toHaveCSS('background-color', colors.accent);
      await expect(empty.getByText('Or start with one tap')).toHaveCSS('color', colors.tertiary);
      const starters = empty.getByRole('button', { name: /^Create category / });
      await expect(starters).toHaveCount(4);
      await expect(starters.first()).toHaveCSS('background-color', colors.card);
      await expect(starters.first()).toHaveCSS('border-top-color', colors.border);
      await expect(starters.first()).toHaveCSS('height', '32px');
      // The whole state fits the popup: nothing to scroll to
      await expect(starters.last()).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/categories-${theme}.png` });

      // The main action opens the Category sheet, which Escape closes back on the button
      await create.click();
      await expect(page.getByRole('dialog', { name: 'New category', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(create).toBeFocused();

      // One tap creates the Category, says so, and the list takes over
      await empty.getByRole('button', { name: 'Create category Writing' }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Category created' })).toContainText('Writing');
      await expect(page.getByTestId('category-row')).toHaveCount(2);
      await expect(empty).toHaveCount(0);
      await expect(page.getByText('2 categories', { exact: true })).toBeVisible();
      // The starter is gone with the empty state: the keyboard goes to Add category
      await expect(page.getByRole('button', { name: 'Add category', exact: true })).toBeFocused();
      await expect.poll(async () => (await storage.getCategories()).find(category => category.name === 'Writing')?.color).toBe('#9333EA');
    });

    test(`deleting the last Category of the user brings the empty state back (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme, { categories: [{ id: 'work', name: 'Work', color: '#2563EB' }] });
      await page.getByTestId('tab-categories').click();
      await expect(page.getByTestId('category-row')).toHaveCount(2);

      await page.getByRole('button', { name: 'Edit category Work', exact: true }).click();
      await page.getByRole('dialog', { name: 'Edit category', exact: true }).getByRole('button', { name: /delete/i }).click();

      const empty = page.getByTestId('categories-empty');
      await expect(empty).toBeVisible();
      await expect(page.getByText('Organize', { exact: true })).toBeVisible();
      // The keyboard goes to what took the place of the list
      await expect(empty.getByRole('button', { name: 'Create a category' })).toBeFocused();
    });

    test(`Analytics with Prompts never inserted keeps its shape as ghosts and sends to the Library (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme, { prompts: [createPromptSeed({ id: 'idle', title: 'Never inserted' })] });
      await page.getByTestId('tab-analytics').click();

      const empty = page.getByTestId('stats-empty');
      await expect(page.getByTestId('stats-hero')).toHaveCSS('background-color', colors.inverse);
      await expect(page.getByTestId('stats-total')).toHaveText('0');
      await expect(page.getByTestId('stats-total')).toHaveCSS('color', colors.dim);
      await expect(page.getByTestId('stats-hero-subtitle')).toHaveText('Your week will draw itself here.');
      const bars = page.getByTestId('stats-ghost-bar');
      await expect(bars).toHaveCount(7);
      await expect(bars.first()).toHaveCSS('border-top-style', 'dashed');
      await expect(bars.first()).toHaveCSS('border-top-color', colors.inverseGhost);
      await expect(bars.first()).toHaveCSS('height', '26px');

      await expect(empty.getByRole('heading', { level: 2, name: 'Nothing to measure yet' })).toHaveCSS('color', colors.primary);
      const tile = empty.getByRole('heading', { name: 'Top platform' }).locator('..');
      await expect(tile).toHaveCSS('border-top-style', 'dashed');
      await expect(tile).toHaveCSS('border-top-color', colors.ghost);
      await expect(empty.getByRole('heading', { name: 'Top category' })).toBeVisible();
      await expect(empty.getByText('No data yet')).toHaveCount(2);
      await expect(empty.getByText('No data yet').first()).toHaveCSS('color', colors.tertiary);

      // Most used has nothing to rank; Tidy up counts Prompts, so it stays
      await expect(page.getByRole('region', { name: 'Most used' })).toHaveCount(0);
      await expect(page.getByTestId('tidy-up')).toContainText('1 prompt never used');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/analytics-${theme}.png` });

      const goToLibrary = empty.getByRole('button', { name: 'Go to the library' });
      await expect(goToLibrary).toHaveCSS('background-color', colors.accent);
      await goToLibrary.click();
      await expect(page.getByTestId('tab-library')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('prompt-card')).toHaveCount(1);
    });

    test(`Analytics of an empty Library offers to write the first Prompt (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      await page.getByTestId('tab-analytics').click();

      const empty = page.getByTestId('stats-empty');
      await expect(empty.getByRole('button', { name: 'Go to the library' })).toHaveCount(0);
      await expect(page.getByTestId('tidy-up')).toHaveCount(0);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/analytics-empty-library-${theme}.png` });

      await empty.getByRole('button', { name: 'Write your first prompt' }).click();
      await expect(page.getByLabel('Title')).toBeVisible();
    });

    test(`Analytics leaves its empty state as soon as an Insertion is counted (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme, { prompts: [createPromptSeed({ id: 'used', title: 'Inserted once' })] });
      await page.getByTestId('tab-analytics').click();
      await expect(page.getByTestId('stats-empty')).toBeVisible();

      // Stored while Analytics stays open, as from a Platform beside the side panel: it shows at once
      await seedUsageHistory(storage, [createUsageEventSeed({ promptId: 'used', timestamp: Date.now() - 60_000, platform: 'claude' })]);

      await expect(page.getByTestId('stats-empty')).toHaveCount(0);
      await expect(page.getByTestId('stats-total')).toHaveText('1');
      await expect(page.getByTestId('stats-bar')).toHaveCount(7);
    });
  }

  test('the tiles of the Categories illustration take lighter hues in dark', async ({ page, storage, extensionId }) => {
    for (const theme of ['light', 'dark'] as const) {
      await openPopup(page, storage, extensionId, theme);
      await page.getByTestId('tab-categories').click();
      const tile = page.getByTestId('categories-empty').locator('.text-tile-blue');
      await expect(tile).toHaveCSS('color', EXPECTED[theme].tileBlue);
    }
  });
});

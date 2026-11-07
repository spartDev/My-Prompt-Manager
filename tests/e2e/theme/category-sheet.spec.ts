/**
 * E2E: the Category sheet (Atelier 1C 2b, 2c) in the real extension
 *
 * The Categories section creates and edits a Category in one bottom sheet: it rises from the bottom
 * in 0.5 s on the sheet ease (EASE.sheet of src/theme/motion.ts), and leaves in 0.28 s on the same ease,
 * while the screen behind it steps back. Captures light/dark screenshots as visual proof, at the
 * popup size and in the side panel (test-results/category-sheet/): the Categories screen at rest,
 * the create sheet with a name typed and a color chosen, and the edit sheet with the edited row's
 * border seen behind it.
 */

import type { Page } from '@playwright/test';

import { EASE } from '../../../src/theme/motion';
import type { Category } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { CategoryManagerPage } from '../pages/CategoryManagerPage';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/category-sheet';
const EASE_SHEET = EASE.sheet;

/** The popup is 400 x 500; the side panel is as wide as the user makes it, 360 here */
const SURFACES = {
  popup: { width: 400, height: 500 },
  sidepanel: { width: 360, height: 720 }
} as const;

const categories: Category[] = [
  { id: 'writing', name: 'Rédaction', color: '#2563EB' }, // Ocean Blue
  { id: 'code', name: 'Code', color: '#0F766E' }, // Teal
  { id: 'research', name: 'Recherche', color: '#D97706' } // Amber
];

const prompts = [
  createPromptSeed({ id: 'brief', title: 'Brief', category: 'Rédaction' }),
  createPromptSeed({ id: 'summary', title: 'Résumé', category: 'Rédaction' })
];

interface SheetAnimation {
  name: string;
  duration: string;
  timing: string;
}

const animationOf = (page: Page): Promise<SheetAnimation> =>
  new CategoryManagerPage(page).getSheet().evaluate(element => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: style.animationDuration, timing: style.animationTimingFunction };
  });

type ExitWatch = Window & { categorySheetExit?: Promise<SheetAnimation & { inert: boolean }> };

/**
 * Starts watching the open sheet: the moment it turns to its exit, records its animation (the sheet
 * leaves the page 280 ms later, so it is read in the page, not after a round trip)
 */
const watchExit = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>('[role="dialog"][aria-label="New category"], [role="dialog"][aria-label="Edit category"]');
    (window as ExitWatch).categorySheetExit = new Promise(resolve => {
      if (!sheet) {return;}
      const observer = new MutationObserver(() => {
        if (!sheet.classList.contains('sheet-out')) {return;}
        observer.disconnect();
        const style = getComputedStyle(sheet);
        resolve({
          name: style.animationName,
          duration: style.animationDuration,
          timing: style.animationTimingFunction,
          inert: sheet.parentElement?.hasAttribute('inert') ?? false
        });
      });
      observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
    });
  });

const exitAnimation = (page: Page) => page.evaluate(() => (window as ExitWatch).categorySheetExit);

const openCategories = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  theme: 'light' | 'dark',
  surface: keyof typeof SURFACES
): Promise<CategoryManagerPage> => {
  await seedLibrary(storage, { categories, prompts, settings: { theme } });
  // The motion is what is checked: whatever the machine's own setting
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize(SURFACES[surface]);
  await page.goto(`chrome-extension://${extensionId}/src/${surface}.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
  const view = new CategoryManagerPage(page);
  await view.openFromLibrary();
  await expect(view.getCategoryRows()).toHaveCount(categories.length + 1);
  return view;
};

test.describe('Category sheet', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const surface of ['popup', 'sidepanel'] as const) {
      test(`PROOF: the Categories screen, the create sheet and the edit sheet (${surface}, ${theme})`, async ({ page, storage, extensionId }) => {
        const view = await openCategories(page, storage, extensionId, theme, surface);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/categories-${surface}-${theme}.png`, animations: 'disabled' });

        // Create: it rises in 0.5 s on the sheet ease, and the screen steps back
        await view.openCreateSheet();
        expect(await animationOf(page)).toEqual({ name: 'sheet-in', duration: '0.5s', timing: EASE_SHEET });
        await expect(view.getSheetBackdrop()).toHaveCSS('animation-name', 'backdrop-in');
        await expect(view.getView()).toHaveAttribute('data-stepped-back', '');
        await view.fillSheetName('Traduction');
        await view.chooseColor('Purple');
        await expect(view.getSheetPreview()).toHaveText('T');
        await page.screenshot({ path: `${SCREENSHOT_DIR}/create-sheet-${surface}-${theme}.png`, animations: 'disabled' });

        // Closed: it leaves in 0.28 s on the same ease, taking no input meanwhile
        await watchExit(page);
        await view.getSheetCloseButton().click();
        expect(await exitAnimation(page)).toEqual({ name: 'sheet-out', duration: '0.28s', timing: EASE_SHEET, inert: true });
        await view.expectSheetClosed();
        await view.expectCategoryNotExists('Traduction');

        // Edit: the row being edited keeps a border of its color, seen behind the backdrop
        await view.openEditSheet('Rédaction');
        expect(await animationOf(page)).toEqual({ name: 'sheet-in', duration: '0.5s', timing: EASE_SHEET });
        await expect(view.getSheet()).toContainText('Used by 2 prompts');
        await expect(view.getEditButton('Rédaction')).toHaveCSS('box-shadow', 'rgb(37, 99, 235) 0px 0px 0px 2px inset');
        // The pointer off the row, so the screenshot shows the border, not the hover
        await page.mouse.move(SURFACES[surface].width - 4, 4);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/edit-sheet-${surface}-${theme}.png`, animations: 'disabled' });

        // Saved: it leaves the same way
        await watchExit(page);
        await view.fillSheetName('Rédaction web');
        await view.submitSheet('enter');
        expect(await exitAnimation(page)).toEqual({ name: 'sheet-out', duration: '0.28s', timing: EASE_SHEET, inert: true });
        await view.expectSheetClosed();
        await view.expectCategoryExists('Rédaction web');
      });
    }
  }

  test('with reduced motion, the sheet comes and goes at once', async ({ page, storage, extensionId }) => {
    const view = await openCategories(page, storage, extensionId, 'light', 'popup');
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await view.openCreateSheet();
    expect(await animationOf(page)).toEqual({ name: 'sheet-in', duration: '0.001s', timing: EASE_SHEET });
    await view.dismissSheet('escape');
  });
});

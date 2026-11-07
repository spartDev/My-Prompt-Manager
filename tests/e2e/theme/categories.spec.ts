/**
 * E2E: the Categories view on the color tokens (My-Prompt-Manager-el4.5.1)
 *
 * The list of Categories is a card on bg-app, whose rows are split by border-divider and hover to
 * bg-muted, with "Add category" below it, in text-accent with a dashed border-accent. Both open the Category sheet: a bg-card
 * panel over the backdrop, with a bg-subtle name field, the 12 Category colors (the chosen one ringed
 * in its own color) and an accent Create or Save. Category colors themselves are user data and keep
 * their own values. Also captures light/dark screenshots as visual proof (test-results/categories/).
 */

import type { Locator, Page } from '@playwright/test';

import type { Category } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { CategoryManagerPage } from '../pages/CategoryManagerPage';
import { seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/categories';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const EXPECTED = {
  light: {
    app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', subtle: 'rgb(244, 241, 250)', muted: 'rgb(241, 237, 248)',
    border: 'rgb(236, 230, 245)', divider: 'rgb(240, 235, 248)', strong: 'rgb(220, 212, 234)', input: 'rgb(143, 135, 165)',
    tertiary: 'rgb(111, 103, 135)', accent: 'rgb(109, 40, 217)', accentBorder: 'rgb(196, 181, 253)', accentText: 'rgb(91, 33, 182)', backdrop: 'rgba(42, 33, 64, 0.45)',
    danger: 'rgb(153, 27, 27)'
  },
  dark: {
    app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', subtle: 'rgb(43, 35, 64)', muted: 'rgb(46, 38, 69)',
    border: 'rgb(53, 44, 76)', divider: 'rgb(47, 39, 68)', strong: 'rgb(65, 55, 90)', input: 'rgb(118, 108, 142)',
    tertiary: 'rgb(163, 154, 187)', accent: 'rgb(132, 75, 242)', accentBorder: 'rgb(109, 79, 196)', accentText: 'rgb(196, 181, 253)', backdrop: 'rgba(7, 5, 12, 0.7)',
    danger: 'rgb(252, 165, 165)'
  }
} as const;

const categories: Category[] = [
  { id: 'writing', name: 'Rédaction', color: '#2563EB' },
  { id: 'code', name: 'Code', color: '#0F766E' },
  { id: 'research', name: 'Recherche', color: '#D97706' }
];

/** The popup is 400 x 500; the side panel is at least 320 px wide (docs/DESIGN_GUIDELINES.md) */
const SURFACES = {
  popup: { width: 400, height: 500 },
  sidepanel: { width: 320, height: 700 }
} as const;

const openCategories = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  theme: 'light' | 'dark',
  surface: keyof typeof SURFACES = 'popup'
): Promise<CategoryManagerPage> => {
  await seedLibrary(storage, { categories, settings: { theme } });
  await page.setViewportSize(SURFACES[surface]);
  await page.goto(`chrome-extension://${extensionId}/src/${surface}.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
  await page.getByTestId('tab-categories').click();
  await expect(page.getByTestId('category-row')).toHaveCount(categories.length + 1);
  return new CategoryManagerPage(page);
};

/** Fails when part of the element sticks out of the box, where its edge or the viewport clips it */
const expectInside = async (element: Locator, box: Locator) => {
  const [inner, outer] = await Promise.all([element.boundingBox(), box.boundingBox()]);
  expect(inner, 'element box').not.toBeNull();
  expect(outer, 'outer box').not.toBeNull();
  if (!inner || !outer) {return;}
  expect(inner.x, 'left edge').toBeGreaterThanOrEqual(outer.x);
  expect(inner.x + inner.width, 'right edge').toBeLessThanOrEqual(outer.x + outer.width);
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

test.describe('Categories view on the tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`the list is a card on bg-app with divided rows that hover to bg-muted, and a dashed accent Add category (${theme})`, async ({ page, storage, extensionId }) => {
      const view = await openCategories(page, storage, extensionId, theme);

      const listCard = page.getByRole('region', { name: 'Your Categories' });
      await expect(listCard).toHaveCSS('background-color', colors.card);
      await expect(listCard).toHaveCSS('border-top-color', colors.border);
      expect(await backdropOf(listCard.locator('..'))).toBe(colors.app);

      const add = view.getAddCategoryButton();
      await expect(add).toHaveCSS('border-top-style', 'dashed');
      await expect(add).toHaveCSS('border-top-color', colors.accentBorder);
      await expect(add).toHaveCSS('color', colors.accentText);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/view-${theme}.png`, animations: 'disabled' });

      const rows = page.getByTestId('category-row');
      await expect(rows.nth(1)).toHaveCSS('border-bottom-width', '1px');
      await expect(rows.nth(1)).toHaveCSS('border-bottom-color', colors.divider);
      await expect(rows.nth(1)).toHaveCSS('background-color', TRANSPARENT);
      // :hover follows the pointer's last event: a stray one (the real macOS cursor over a headed window, or
      // another worker's window opening under it) moves the hit off the row, so hover again until it holds
      await expect(async () => {
        await rows.nth(1).hover();
        await expect(rows.nth(1)).toHaveCSS('background-color', colors.muted, { timeout: 1_000 });
      }).toPass();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/row-hover-${theme}.png` });
    });

    test(`the create sheet is a card over the backdrop, with a subtle name field, the 12 colors and an accent Create (${theme})`, async ({ page, storage, extensionId }) => {
      const view = await openCategories(page, storage, extensionId, theme);

      await view.openCreateSheet();
      const sheet = view.getSheet();
      await expect(sheet).toHaveCSS('background-color', colors.card);
      await expect(view.getSheetBackdrop()).toHaveCSS('background-color', colors.backdrop);
      await expect(sheet.getByText('Add prompts to it from the editor.')).toHaveCSS('color', colors.tertiary);

      // The name has the focus, its border in accent (border-focus); at rest, border-input
      const name = view.getSheetNameInput();
      await expect(name).toHaveCSS('background-color', colors.subtle);
      await expect(name).toHaveCSS('border-top-color', colors.accent);
      await view.getSheetCancelButton().focus();
      await expect(name).toHaveCSS('border-top-color', colors.input);

      // The first color no Category uses (Ocean Blue, Teal and Amber are): Sky Blue, ringed in card then its color
      const chosen = sheet.getByRole('button', { pressed: true });
      await expect(chosen).toHaveAccessibleName('Sky Blue');
      await expect.poll(() => chosen.evaluate(swatch => getComputedStyle(swatch).boxShadow))
        .toBe(`${colors.card} 0px 0px 0px 2px, rgb(3, 105, 161) 0px 0px 0px 4px`);

      const create = view.getSubmitButton();
      await expect(create).toHaveCSS('background-color', colors.accent);
      await expect(create).toHaveCSS('opacity', '0.45');
      await view.fillSheetName('Traduction');
      await expect(create).toHaveCSS('opacity', '1');
      await expect(view.getSheetCancelButton()).toHaveCSS('border-top-color', colors.strong);
      await view.chooseColor('Purple');
      await expect(view.getSheetPreview()).toHaveCSS('background-color', 'rgb(147, 51, 234)');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/create-sheet-${theme}.png`, animations: 'disabled' });
    });

    test(`the edit sheet has a danger Delete, and the edited row keeps a border of its color behind it (${theme})`, async ({ page, storage, extensionId }) => {
      const view = await openCategories(page, storage, extensionId, theme);

      await view.openEditSheet('Rédaction');
      await expect(view.getSheetDeleteButton()).toHaveCSS('color', colors.danger);
      await expect(view.getSubmitButton()).toHaveCSS('background-color', colors.accent);
      await expect(view.getSubmitButton()).toHaveCSS('opacity', '1');
      await expect(view.getEditButton('Rédaction')).toHaveCSS('box-shadow', 'rgb(37, 99, 235) 0px 0px 0px 2px inset');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/edit-sheet-${theme}.png`, animations: 'disabled' });
    });

    test(`with the Notifications off, deleting asks for confirmation in a card on the backdrop (${theme})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ toast_settings: { enabled: false } });
      const view = await openCategories(page, storage, extensionId, theme);

      await view.openEditSheet('Code');
      await view.getSheetDeleteButton().click();

      const dialog = view.getDeleteConfirmation();
      await expect(dialog.getByRole('heading', { name: 'Delete Category' })).toBeVisible();
      await expect(dialog.locator('> div').first()).toHaveCSS('background-color', colors.backdrop);
      await expect(dialog.locator('> div').nth(1)).toHaveCSS('background-color', colors.card);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/delete-confirmation-${theme}.png`, animations: 'disabled' });
    });
  }

  test('at the side panel minimum width, the sheet\'s colors and buttons fit in it', async ({ page, storage, extensionId }) => {
    const view = await openCategories(page, storage, extensionId, 'light', 'sidepanel');

    await view.openEditSheet('Rédaction');
    const sheet = view.getSheet();
    for (const control of [view.getSheetDeleteButton(), view.getSheetCancelButton(), view.getSubmitButton(), view.getSheetCloseButton(), view.getSheetNameInput()]) {
      await expectInside(control, sheet);
    }
    for (const color of ['Ocean Blue', 'Rose', 'Amber', 'Slate']) {
      await expectInside(view.getColorSwatch(color), sheet);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal scroll').toBe(0);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/sidepanel-320-edit-sheet.png`, animations: 'disabled' });
  });
});

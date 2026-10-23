/**
 * E2E: the Categories view on the color tokens (My-Prompt-Manager-el4.5.1)
 *
 * Two cards on bg-app: the Add New Category form, with a bg-subtle name field, and the list of
 * Categories, whose rows are split by border-divider and hover to bg-muted. The color picker opens
 * from a field into a card and rings the chosen swatch in accent; a row edits in place. Category
 * colors themselves are user data and keep their own values. Also captures light/dark screenshots
 * as visual proof (test-results/categories/).
 */

import type { Locator, Page } from '@playwright/test';

import type { Category } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/categories';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

const EXPECTED = {
  light: {
    app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', subtle: 'rgb(244, 241, 250)', muted: 'rgb(241, 237, 248)',
    border: 'rgb(236, 230, 245)', divider: 'rgb(240, 235, 248)', strong: 'rgb(220, 212, 234)', input: 'rgb(143, 135, 165)',
    tertiary: 'rgb(111, 103, 135)', accent: 'rgb(109, 40, 217)', backdrop: 'rgba(42, 33, 64, 0.45)'
  },
  dark: {
    app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', subtle: 'rgb(43, 35, 64)', muted: 'rgb(46, 38, 69)',
    border: 'rgb(53, 44, 76)', divider: 'rgb(47, 39, 68)', strong: 'rgb(65, 55, 90)', input: 'rgb(118, 108, 142)',
    tertiary: 'rgb(163, 154, 187)', accent: 'rgb(132, 75, 242)', backdrop: 'rgba(7, 5, 12, 0.7)'
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
) => {
  await seedLibrary(storage, { categories, settings: { theme } });
  await page.setViewportSize(SURFACES[surface]);
  await page.goto(`chrome-extension://${extensionId}/src/${surface}.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
  await page.getByTestId('tab-categories').click();
  await expect(page.getByTestId('category-row')).toHaveCount(categories.length + 1);
};

/** Fails when part of the element sticks out of the card, where the card's edge or the viewport clips it */
const expectInside = async (element: Locator, card: Locator) => {
  const [inner, outer] = await Promise.all([element.boundingBox(), card.boundingBox()]);
  expect(inner, 'element box').not.toBeNull();
  expect(outer, 'card box').not.toBeNull();
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

    test(`the form and the list are cards on bg-app, with divided rows that hover to bg-muted (${theme})`, async ({ page, storage, extensionId }) => {
      await openCategories(page, storage, extensionId, theme);

      const addCard = page.getByRole('region', { name: 'Add New Category' });
      const listCard = page.getByRole('region', { name: 'Your Categories' });
      for (const card of [addCard, listCard]) {
        await expect(card).toHaveCSS('background-color', colors.card);
        await expect(card).toHaveCSS('border-top-color', colors.border);
        expect(await backdropOf(card.locator('..'))).toBe(colors.app);
      }

      const name = page.getByPlaceholder('Enter category name...');
      await expect(name).toHaveCSS('background-color', colors.subtle);
      await expect(name).toHaveCSS('border-top-color', colors.input);
      await name.fill('Traduction');
      const add = page.getByRole('button', { name: 'Add', exact: true });
      await expect(add).toHaveCSS('background-color', colors.accent);
      await expect(add).toHaveCSS('opacity', '1');

      await page.screenshot({ path: `${SCREENSHOT_DIR}/view-${theme}.png` });

      const rows = page.getByTestId('category-row');
      await expect(rows.nth(1)).toHaveCSS('border-bottom-width', '1px');
      await expect(rows.nth(1)).toHaveCSS('border-bottom-color', colors.divider);
      await expect(rows.nth(1)).toHaveCSS('background-color', TRANSPARENT);
      await rows.nth(1).hover();
      await expect(rows.nth(1)).toHaveCSS('background-color', colors.muted);
      await expect(rows.nth(1).getByRole('button', { name: 'Edit category' })).toHaveCSS('opacity', '1');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/row-hover-${theme}.png` });
    });

    test(`the color picker opens from a field into a card, with the chosen swatch ringed in accent (${theme})`, async ({ page, storage, extensionId }) => {
      await openCategories(page, storage, extensionId, theme);

      const trigger = page.getByRole('region', { name: 'Add New Category' }).getByRole('button', { name: 'Ocean Blue', exact: true });
      await expect(trigger).toHaveCSS('background-color', colors.subtle);
      await expect(trigger).toHaveCSS('border-top-color', colors.input);
      await trigger.click();

      const panel = page.getByRole('dialog');
      await expect(panel).toHaveCSS('background-color', colors.card);
      await expect(panel.getByText('Preset Colors')).toHaveCSS('color', colors.tertiary);
      const chosen = panel.locator('[aria-current="true"]');
      await expect(chosen).toHaveAttribute('title', 'Ocean Blue');
      await expect.poll(() => chosen.evaluate(swatch => getComputedStyle(swatch).boxShadow)).toContain(colors.accent);
      await expect(panel.getByRole('button', { name: 'Pick custom color' })).toHaveCSS('border-top-color', colors.strong);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/color-picker-${theme}.png` });

      await panel.getByRole('button', { name: 'Enter Hex Code' }).click();
      const hex = panel.getByPlaceholder('#000000');
      await expect(hex).toHaveCSS('background-color', colors.subtle);
      await expect(hex).toHaveCSS('border-top-color', colors.input);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/color-picker-hex-${theme}.png` });
    });

    test(`a row edits in place with subtle fields and an accent Save (${theme})`, async ({ page, storage, extensionId }) => {
      await openCategories(page, storage, extensionId, theme);

      const row = page.locator('[data-testid="category-row"][data-category-name="Rédaction"]');
      await row.hover();
      await row.getByRole('button', { name: 'Edit category' }).click();
      // Save takes the Edit button's place: move the pointer off it to see its resting color
      await page.mouse.move(8, 8);

      const name = row.getByPlaceholder('Category name', { exact: true });
      await expect(name).toHaveCSS('background-color', colors.subtle);
      await expect(name).toHaveCSS('border-top-color', colors.input);
      const color = row.getByRole('button', { name: 'Ocean Blue', exact: true });
      await expect(color).toHaveCSS('background-color', colors.subtle);
      await expect(color).toHaveCSS('border-top-color', colors.input);
      await expect(row.getByRole('button', { name: 'Save changes (Enter)' })).toHaveCSS('background-color', colors.accent);
      // The row being edited stays on the card: only rows that can be acted on hover
      await expect(row).toHaveCSS('background-color', TRANSPARENT);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/inline-edit-${theme}.png` });
    });

    test(`deleting a Category asks for confirmation in a card on the backdrop (${theme})`, async ({ page, storage, extensionId }) => {
      await openCategories(page, storage, extensionId, theme);

      const row = page.locator('[data-testid="category-row"][data-category-name="Code"]');
      await row.hover();
      await row.getByRole('button', { name: 'Delete category' }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Delete Category' })).toBeVisible();
      await expect(dialog.locator('> div').first()).toHaveCSS('background-color', colors.backdrop);
      await expect(dialog.locator('> div').nth(1)).toHaveCSS('background-color', colors.card);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/delete-confirmation-${theme}.png` });
    });
  }

  test('at the side panel minimum width, the Add form and the inline editor fit in their cards', async ({ page, storage, extensionId }) => {
    await openCategories(page, storage, extensionId, 'light', 'sidepanel');

    await page.getByPlaceholder('Enter category name...').fill('Traduction');
    await expectInside(page.getByRole('button', { name: 'Add', exact: true }), page.getByRole('region', { name: 'Add New Category' }));

    const row = page.locator('[data-testid="category-row"][data-category-name="Rédaction"]');
    await row.hover();
    await row.getByRole('button', { name: 'Edit category' }).click();
    const listCard = page.getByRole('region', { name: 'Your Categories' });
    await expectInside(row.getByRole('button', { name: 'Save changes (Enter)' }), listCard);
    await expectInside(row.getByRole('button', { name: 'Cancel (Esc)' }), listCard);

    const overflow = await listCard.locator('xpath=ancestor::*[@data-scroll-container][1]').evaluate(view => view.scrollWidth - view.clientWidth);
    expect(overflow, 'horizontal scroll').toBe(0);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/sidepanel-320-inline-edit.png` });
  });
});

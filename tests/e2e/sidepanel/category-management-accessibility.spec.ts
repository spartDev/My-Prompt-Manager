import type { Page } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { CategoryManagerPage } from '../pages/CategoryManagerPage';
import { createCategorySeed, seedLibrary } from '../utils/storage';

type SeedOptions = Parameters<typeof seedLibrary>[1];

/** Seeds the Library, opens the side panel on the Categories section */
const openCategories = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  seed: SeedOptions = {}
): Promise<CategoryManagerPage> => {
  await seedLibrary(storage, {
    ...seed,
    settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
    interfaceMode: 'sidepanel'
  });
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
  const categories = new CategoryManagerPage(page);
  await categories.openFromLibrary();
  return categories;
};

test.describe('Category Manager - Keyboard Navigation and Accessibility', () => {

  test.describe('Keyboard Navigation and Accessibility', () => {
    test('creates a Category from the keyboard alone: Enter opens the sheet, Enter creates', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId);

      await categories.getAddCategoryButton().focus();
      await page.keyboard.press('Enter');

      // The sheet opens with the focus in the name
      await expect(categories.getCreateSheet()).toBeVisible();
      await expect(categories.getSheetNameInput()).toBeFocused();

      await page.keyboard.type('Keyboard Test');
      await page.keyboard.press('Enter');

      await categories.expectSheetClosed();
      await categories.expectCategoryExists('Keyboard Test');
      await categories.expectCategoryCount(2);
      // The keyboard is back where it was
      await expect(categories.getAddCategoryButton()).toBeFocused();
    });

    test('keeps Tab and Shift+Tab inside the sheet', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Tab Test', color: '#2563EB' })]
      });

      await categories.openEditSheet('Tab Test');
      const sheet = categories.getSheet();
      const focusInSheet = () => sheet.evaluate(element => element.contains(document.activeElement));

      // Close, the name, the 12 colors, Delete, Cancel, Save: once round and back to the start
      for (let step = 0; step < 18; step++) {
        await page.keyboard.press('Tab');
        expect(await focusInSheet(), `focus in the sheet after ${String(step + 1)} Tab`).toBe(true);
      }
      for (let step = 0; step < 18; step++) {
        await page.keyboard.press('Shift+Tab');
        expect(await focusInSheet(), `focus in the sheet after ${String(step + 1)} Shift+Tab`).toBe(true);
      }

      // The colors are reached and chosen from the keyboard
      await categories.getColorSwatch('Teal').focus();
      await page.keyboard.press('Space');
      await expect(categories.getColorSwatch('Teal')).toHaveAttribute('aria-pressed', 'true');
    });

    test('Escape closes the sheet without saving, the keyboard back on the row', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Edit Test', color: '#3B82F6' })]
      });

      await categories.getEditButton('Edit Test').focus();
      await page.keyboard.press('Enter');
      await expect(categories.getEditSheet()).toBeVisible();
      await expect(categories.getSheetNameInput()).toBeFocused();

      await categories.fillSheetName('Changed Name');
      await page.keyboard.press('Escape');

      await categories.expectSheetClosed();
      await categories.expectCategoryExists('Edit Test');
      await categories.expectCategoryNotExists('Changed Name');
      await expect(categories.getEditButton('Edit Test')).toBeFocused();
    });

    test('Enter in the name saves the edit', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Save Test', color: '#3B82F6' })]
      });

      await categories.openEditSheet('Save Test');
      await categories.fillSheetName('Updated Name');
      await page.keyboard.press('Enter');

      await categories.expectSheetClosed();
      await categories.expectCategoryExists('Updated Name');
      await categories.expectCategoryNotExists('Save Test');
      await expect(categories.getEditButton('Updated Name')).toBeFocused();
    });

    test('names every control, and the sheet is a modal dialog', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Accessibility Test', color: '#3B82F6' })]
      });

      // Headings and the list region
      await expect(page.getByRole('heading', { level: 1, name: 'Categories', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Your Categories' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Categories', selected: true })).toBeVisible();

      // Each editable row is a button that says what it opens
      const row = categories.getEditButton('Accessibility Test');
      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(categories.getAddCategoryButton()).toHaveAttribute('aria-haspopup', 'dialog');

      // The sheet: a modal dialog named after what it does, its field labelled
      await row.click();
      const sheet = categories.getEditSheet();
      await expect(sheet).toHaveAttribute('aria-modal', 'true');
      await expect(categories.getSheetNameInput()).toHaveAttribute('placeholder', 'Category name');
      for (const name of ['Close', 'Delete', 'Cancel', 'Save', 'Ocean Blue', 'Slate']) {
        await expect(sheet.getByRole('button', { name, exact: true })).toBeVisible();
      }
      await expect(categories.getColorSwatch('Ocean Blue')).toHaveAttribute('aria-pressed', 'false');
      // The preview and the handle are decoration
      await expect(categories.getSheetPreview()).toHaveAttribute('aria-hidden', 'true');
      await expect(categories.getSheetBackdrop()).toHaveAttribute('aria-hidden', 'true');
      await categories.dismissSheet('close');

      // A refusal is announced and tied to the field
      await categories.testDuplicateValidation('accessibility test');
      const describedBy = await categories.getSheetNameInput().getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      await expect(categories.getSheetRefusal()).toHaveAttribute('id', describedBy ?? '');
    });
  });

  test.describe('Loading States and Interactions', () => {
    test('Create stays aria-disabled while the name is empty or blank', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId);

      await categories.openCreateSheet();
      const create = categories.getSubmitButton();
      // Disabled for assistive technology, but still focusable and in the Tab order
      await expect(create).toHaveAttribute('aria-disabled', 'true');
      await expect(create).not.toHaveAttribute('disabled');

      await categories.fillSheetName('Test Category');
      await expect(create).not.toHaveAttribute('aria-disabled');
      await expect(create).toHaveCSS('opacity', '1');

      await categories.fillSheetName('');
      await expect(create).toHaveAttribute('aria-disabled', 'true');
      await expect(create).toHaveCSS('opacity', '0.45');
    });

    test('should preserve category manager state during operations', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [
          createCategorySeed({ name: 'Category 1', color: '#3B82F6' }),
          createCategorySeed({ name: 'Category 2', color: '#10B981' }),
        ]
      });

      // Verify initial state
      await categories.expectCategoryCount(3); // 2 custom + default

      // Perform an operation (add category)
      await categories.createCategory('Category 3');

      // Verify state updated correctly
      await categories.expectCategoryCount(4);
      await expect(categories.getCategoryRows()).toHaveText([/Uncategorized/, /Category 1/, /Category 2/, /Category 3/]);

      // The next sheet starts afresh, in the next color no Category uses
      await categories.openCreateSheet();
      await expect(categories.getSheetPreview()).toHaveText('?');
      await expect(categories.getSheet().getByRole('button', { pressed: true })).toHaveCount(1);
    });
  });
});

import type { Page } from '@playwright/test';

import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { CategoryManagerPage, SHEET_DISMISSALS } from '../pages/CategoryManagerPage';
import { LibraryPage } from '../pages/LibraryPage';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';

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
    settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel', ...seed.settings },
    interfaceMode: 'sidepanel'
  });
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
  const categories = new CategoryManagerPage(page);
  await categories.openFromLibrary();
  return categories;
};

const categoryNames = async (storage: ExtensionStorage): Promise<string[]> =>
  (await storage.getCategories()).map(category => category.name);

test.describe('Category Management - Core CRUD Operations', () => {

  test.describe('Category Creation', () => {
    test('creates a Category with the Create button, in the color chosen', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId);

      await categories.openCreateSheet();
      await expect(categories.getSheet()).toContainText('Add prompts to it from the editor.');
      await expect(categories.getSheetPreview()).toHaveText('?');
      // No Delete when creating
      await expect(categories.getSheetDeleteButton()).toHaveCount(0);

      await categories.fillSheetName('Coding');
      await expect(categories.getSheetPreview()).toHaveText('C');
      await categories.chooseColor('Teal');
      await expect(categories.getSheetPreview()).toHaveCSS('background-color', 'rgb(15, 118, 110)');
      await categories.getSubmitButton().click();

      await categories.expectSheetClosed();
      await categories.expectNotification('Category created', 'Coding');
      await categories.expectCategoryExists('Coding');
      await categories.expectCategoryCount(2);
      // The keyboard goes back to what opened the sheet
      await expect(categories.getAddCategoryButton()).toBeFocused();

      expect(await storage.getCategories()).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Coding', color: '#0F766E' })])
      );
    });

    test('creates a Category with Enter in the name, in the first color no Category uses', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Email', color: '#2563EB' })] // Ocean Blue, the first preset
      });

      await categories.openCreateSheet();
      await expect(categories.getColorSwatch('Sky Blue')).toHaveAttribute('aria-pressed', 'true');
      await expect(categories.getSheet().getByRole('button', { pressed: true })).toHaveCount(1);

      await categories.fillSheetName('  Writing  ');
      await categories.submitSheet('enter');

      await categories.expectSheetClosed();
      // Admitted on the way in: surrounding spaces are removed from the name
      await categories.expectNotification('Category created', 'Writing');
      await categories.expectCategoryExists('Writing');
      expect(await storage.getCategories()).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Writing', color: '#0369A1' })])
      );
    });

    test('refuses a name already taken, ignoring case, in the sheet, until the name changes', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Coding', color: '#2563EB' })]
      });

      await categories.openCreateSheet();
      await categories.fillSheetName('coding');
      await categories.submitSheet();

      // The sheet stays open with the reason under the name, and no failure Notification
      await categories.expectRefusal('Category with name "coding" already exists');
      await expect(categories.getCreateSheet()).toBeVisible();
      await expect(categories.getSheetNameInput()).toHaveValue('coding');
      await expect(categories.getNotification()).toHaveCount(0);
      await categories.expectCategoryCount(2);
      expect((await categoryNames(storage)).filter(name => name.toLowerCase() === 'coding')).toEqual(['Coding']);

      // Correcting the name clears the reason, and the Category is created
      await categories.fillSheetName('Coding tips');
      await expect(categories.getSheetRefusal()).toHaveCount(0);
      await expect(categories.getSheetNameInput()).not.toHaveAttribute('aria-invalid', 'true');
      await categories.submitSheet();
      await categories.expectSheetClosed();
      await categories.expectCategoryExists('Coding tips');
    });

    test('refuses a name over 50 characters in the sheet, never shortening it', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId);
      const tooLong = 'A'.repeat(51);

      await categories.openCreateSheet();
      await categories.fillSheetName(tooLong);
      await categories.submitSheet();

      await categories.expectRefusal('Category name cannot exceed 50 characters');
      await expect(categories.getSheetNameInput()).toHaveValue(tooLong);
      await expect(categories.getNotification()).toHaveCount(0);
      expect(await categoryNames(storage)).toEqual([DEFAULT_CATEGORY]);

      // 50 is admitted
      await categories.fillSheetName('A'.repeat(50));
      await categories.submitSheet();
      await categories.expectSheetClosed();
      await categories.expectCategoryExists('A'.repeat(50));
    });

    test('does nothing with an empty or blank name', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId);

      await categories.openCreateSheet();
      const create = categories.getSubmitButton();
      await expect(create).toHaveText('Create');
      await expect(create).toHaveAttribute('aria-disabled', 'true');
      await expect(create).toBeDisabled();

      // Clicked or submitted with Enter, an empty name creates nothing and keeps the sheet open
      await create.click({ force: true });
      await categories.getSheetNameInput().press('Enter');
      await expect(categories.getCreateSheet()).toBeVisible();

      await categories.fillSheetName('Test');
      await expect(create).toBeEnabled();

      await categories.fillSheetName('   ');
      await expect(create).toBeDisabled();
      await expect(categories.getSheetPreview()).toHaveText('?');
      await create.click({ force: true });
      await categories.getSheetNameInput().press('Enter');

      await expect(categories.getCreateSheet()).toBeVisible();
      await expect(categories.getSheetRefusal()).toHaveCount(0);
      await expect(categories.getNotification()).toHaveCount(0);
      await categories.expectCategoryCount(1);
      expect(await categoryNames(storage)).toEqual([DEFAULT_CATEGORY]);
    });
  });

  test.describe('Category Editing', () => {
    test('edits the name and color in the sheet, and the Prompts follow the new name', async ({ page, storage, extensionId }) => {
      const research = createCategorySeed({ name: 'Research', color: '#2563EB' }); // Ocean Blue
      const categories = await openCategories(page, storage, extensionId, {
        categories: [research],
        prompts: [
          createPromptSeed({ title: 'Literature review', category: 'Research' }),
          createPromptSeed({ title: 'Data analysis', category: 'Research' })
        ]
      });

      await categories.openEditSheet('Research');
      await expect(categories.getSheet()).toContainText('Used by 2 prompts');
      await expect(categories.getColorSwatch('Ocean Blue')).toHaveAttribute('aria-pressed', 'true');
      await expect(categories.getSheetPreview()).toHaveText('R');
      // The edited row keeps a border of its color, seen behind the backdrop
      await expect(categories.getEditButton('Research')).toHaveCSS('box-shadow', 'rgb(37, 99, 235) 0px 0px 0px 2px inset');

      await categories.fillSheetName('Analysis');
      await categories.chooseColor('Rose');
      await expect(categories.getColorSwatch('Ocean Blue')).toHaveAttribute('aria-pressed', 'false');
      await expect(categories.getSubmitButton()).toHaveText('Save');
      await categories.submitSheet();

      await categories.expectSheetClosed();
      await categories.expectNotification('Category saved', 'Analysis');
      await categories.expectCategoryExists('Analysis');
      await categories.expectCategoryNotExists('Research');
      await expect(categories.getRowSwatch('Analysis')).toHaveCSS('background-color', 'rgb(225, 29, 72)');
      // The keyboard goes back to the row, which no longer carries the border
      await expect(categories.getEditButton('Analysis')).toBeFocused();
      await expect(categories.getEditButton('Analysis')).toHaveCSS('box-shadow', 'none');

      expect(await storage.getCategories()).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: research.id, name: 'Analysis', color: '#E11D48' })])
      );
      expect((await storage.getPrompts()).map(prompt => prompt.category)).toEqual(['Analysis', 'Analysis']);
    });

    test('saves with Enter in the name, and says when no Prompt uses the Category', async ({ page, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Old Name' });
      const categories = await openCategories(page, storage, extensionId, { categories: [testCategory] });

      await categories.openEditSheet('Old Name');
      await expect(categories.getSheet()).toContainText('Not used yet');
      await categories.fillSheetName('New Name');
      await categories.submitSheet('enter');

      await categories.expectSheetClosed();
      await categories.expectNotification('Category saved', 'New Name');
      await categories.expectCategoryExists('New Name');
      await categories.expectCategoryNotExists('Old Name');
      expect(await storage.getCategories()).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: testCategory.id, name: 'New Name' })])
      );
    });

    test('refuses to rename a Category into another one\'s name', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Work' }), createCategorySeed({ name: 'Personal' })]
      });

      await categories.openEditSheet('Personal');
      await categories.fillSheetName('WORK');
      await categories.submitSheet();

      await categories.expectRefusal('Category with name "WORK" already exists');
      await expect(categories.getEditSheet()).toBeVisible();
      await expect(categories.getNotification()).toHaveCount(0);
      expect(await categoryNames(storage)).toEqual([DEFAULT_CATEGORY, 'Work', 'Personal']);
    });

    for (const how of SHEET_DISMISSALS) {
      test(`closing with ${how} saves nothing, creating or editing`, async ({ page, storage, extensionId }) => {
        const testCategory = createCategorySeed({ name: 'Original Name', color: '#2563EB' });
        const categories = await openCategories(page, storage, extensionId, { categories: [testCategory] });

        // Creating
        await categories.openCreateSheet();
        await categories.fillSheetName('Never created');
        await categories.chooseColor('Lime');
        await categories.dismissSheet(how);
        await expect(categories.getAddCategoryButton()).toBeFocused();
        await categories.expectCategoryNotExists('Never created');

        // Editing
        await categories.openEditSheet('Original Name');
        await categories.fillSheetName('Changed Name');
        await categories.chooseColor('Amber');
        await categories.dismissSheet(how);
        await expect(categories.getEditButton('Original Name')).toBeFocused();
        await categories.expectCategoryNotExists('Changed Name');
        await expect(categories.getRowSwatch('Original Name')).toHaveCSS('background-color', 'rgb(37, 99, 235)');

        await expect(categories.getNotification()).toHaveCount(0);
        expect(await storage.getCategories()).toEqual([
          expect.objectContaining({ name: DEFAULT_CATEGORY }),
          { id: testCategory.id, name: 'Original Name', color: '#2563EB' }
        ]);

        // Opened again, the sheet starts afresh from the stored Category
        await categories.openEditSheet('Original Name');
        await expect(categories.getColorSwatch('Ocean Blue')).toHaveAttribute('aria-pressed', 'true');
      });
    }

    test('reopening right after closing gives exactly one sheet, a fresh one', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId);

      // Keyboard: Escape gives the keyboard back to Add category, and Enter opens it again during the exit
      await categories.openCreateSheet();
      await categories.fillSheetName('Draft');
      await page.keyboard.press('Escape');
      await expect(categories.getAddCategoryButton()).toBeFocused();
      await page.keyboard.press('Enter');

      await expect(categories.getSheetsOnPage()).toHaveCount(1);
      await expect(categories.getCreateSheet()).toHaveClass(/animate-category-sheet-in/);
      await expect(categories.getSheetNameInput()).toHaveValue('');
      await expect(categories.getSheetNameInput()).toBeFocused();

      // Pointer: Close, then Add category two frames later, while the first sheet plays its 280 ms exit
      const reopenedDuringExit = await page.evaluate(async () => {
        const sheet = () => document.querySelector('[role="dialog"][aria-label="New category"]');
        const nextFrame = () => new Promise<void>(resolve => { requestAnimationFrame(() => { resolve(); }); });
        sheet()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.click();
        await nextFrame();
        await nextFrame();
        const closing = sheet()?.classList.contains('animate-category-sheet-out') ?? false;
        [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Add category')?.click();
        return closing;
      });
      expect(reopenedDuringExit, 'the first sheet was still playing its exit').toBe(true);

      await expect(categories.getSheetsOnPage()).toHaveCount(1);
      await expect(categories.getCreateSheet()).toHaveClass(/animate-category-sheet-in/);
      // Still one, still open, once the first one's exit would have ended
      await page.waitForTimeout(600);
      await expect(categories.getSheetsOnPage()).toHaveCount(1);
      await expect(categories.getSheetBackdrop()).toHaveCount(1);
      await expect(categories.getCreateSheet()).toBeVisible();
      await expect(categories.getSheetNameInput()).toHaveValue('');

      // And it works: it creates one Category
      await categories.fillSheetName('Only once');
      await categories.submitSheet();
      await categories.expectSheetClosed();
      await categories.expectCategoryExists('Only once');
      expect(await categoryNames(storage)).toEqual([DEFAULT_CATEGORY, 'Only once']);
    });
  });

  test.describe('Category Deletion', () => {
    test('deletes from the sheet at once, and Undo brings the Category and its Prompts back', async ({ page, storage, extensionId }) => {
      const work = createCategorySeed({ id: 'work', name: 'Work', color: '#0F766E' });
      const personal = createCategorySeed({ id: 'personal', name: 'Personal', color: '#DB2777' });
      const prompts = [
        createPromptSeed({ id: 'w1', title: 'Work Prompt 1', category: 'Work' }),
        createPromptSeed({ id: 'w2', title: 'Work Prompt 2', category: 'Work' }),
        createPromptSeed({ id: 'p1', title: 'Personal Prompt', category: 'Personal' })
      ];
      const categories = await openCategories(page, storage, extensionId, { categories: [work, personal], prompts });

      await categories.deleteCategory('Work');

      // No confirmation with the Notifications on: Undo stands in for it
      await categories.expectCategoryCount(2);
      // The keyboard goes to the row that took its place
      await expect(categories.getEditButton('Personal')).toBeFocused();
      await expect.poll(() => categoryNames(storage)).toEqual([DEFAULT_CATEGORY, 'Personal']);
      expect((await storage.getPrompts()).map(prompt => prompt.category)).toEqual([DEFAULT_CATEGORY, DEFAULT_CATEGORY, 'Personal']);

      await categories.undoDelete();

      // Back at its place, with its color, and its Prompts back in it
      await expect(categories.getCategoryRows()).toHaveText([/Uncategorized/, /Work/, /Personal/]);
      await expect(categories.getRowSwatch('Work')).toHaveCSS('background-color', 'rgb(15, 118, 110)');
      await categories.expectCategoryCount(3);
      await expect.poll(() => storage.getCategories()).toEqual([
        expect.objectContaining({ name: DEFAULT_CATEGORY }),
        { id: 'work', name: 'Work', color: '#0F766E' },
        { id: 'personal', name: 'Personal', color: '#DB2777' }
      ]);
      expect((await storage.getPrompts()).map(prompt => prompt.category)).toEqual(['Work', 'Work', 'Personal']);

      // The Library lists them in Work again
      await categories.closeToLibrary();
      const library = new LibraryPage(page);
      await library.filterByCategory('Work');
      await expect(library.getPromptCards()).toHaveCount(2);
      await library.expectPromptVisible('Work Prompt 1');
      await library.expectPromptVisible('Work Prompt 2');
    });

    test('moves the Prompts of a deleted Category to "Uncategorized"', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Work' })],
        prompts: [
          createPromptSeed({ title: 'Work Prompt 1', content: 'First work prompt', category: 'Work' }),
          createPromptSeed({ title: 'Work Prompt 2', content: 'Second work prompt', category: 'Work' })
        ]
      });

      await categories.deleteCategory('Work');
      await categories.closeToLibrary();

      await expect(page.getByRole('heading', { name: 'Work Prompt 1' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Work Prompt 2' })).toBeVisible();
      const library = new LibraryPage(page);
      await expect(library.getLibraryFilterPill('Work')).toHaveCount(0);

      const workPrompts = (await storage.getPrompts()).filter(prompt => prompt.title.startsWith('Work Prompt'));
      expect(workPrompts).toHaveLength(2);
      for (const prompt of workPrompts) {
        expect(prompt.category).toBe(DEFAULT_CATEGORY);
      }
    });

    test('the default Category "Uncategorized" opens no sheet: it is neither edited nor deleted', async ({ page, storage, extensionId }) => {
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Work' })]
      });

      const uncategorized = categories.getCategoryRow(DEFAULT_CATEGORY);
      await expect(uncategorized).toBeVisible();
      await expect(uncategorized).toContainText('Default');
      await expect(categories.getEditButton(DEFAULT_CATEGORY)).toHaveCount(0);
      await expect(uncategorized.getByRole('button')).toHaveCount(0);

      await uncategorized.click();
      await expect(categories.getSheetsOnPage()).toHaveCount(0);
      // The other rows do open it
      await expect(categories.getEditButton('Work')).toHaveAttribute('aria-haspopup', 'dialog');
    });

    test('with the Notifications off, Delete asks first, as there is no Undo', async ({ page, storage, extensionId }) => {
      await storage.seed({ toast_settings: { enabled: false } });
      const categories = await openCategories(page, storage, extensionId, {
        categories: [createCategorySeed({ name: 'Keep This Category' })]
      });

      // Cancelled: nothing is deleted and the sheet stays open on the Category
      await categories.deleteCategoryWithConfirmation('Keep This Category', false);
      await expect(categories.getDeleteConfirmation()).toHaveCount(0);
      await expect(categories.getSheet()).toBeVisible();
      await expect(categories.getSheetNameInput()).toHaveValue('Keep This Category');
      await categories.dismissSheet();
      await categories.expectCategoryExists('Keep This Category');
      expect(await categoryNames(storage)).toEqual([DEFAULT_CATEGORY, 'Keep This Category']);

      // Confirmed: the Category goes, with no Notification
      await categories.openEditSheet('Keep This Category');
      await categories.getSheetDeleteButton().click();
      const confirmation = categories.getDeleteConfirmation();
      await expect(confirmation).toContainText('All prompts in this category will be moved to "Uncategorized"');
      await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();

      await categories.expectSheetClosed();
      await categories.expectCategoryNotExists('Keep This Category');
      await categories.expectCategoryCount(1);
      await expect(categories.getNotification()).toHaveCount(0);
      await expect.poll(() => categoryNames(storage)).toEqual([DEFAULT_CATEGORY]);
    });
  });
});

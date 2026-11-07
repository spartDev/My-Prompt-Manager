import { PRESET_COLORS } from '../../../src/constants/colors';
import { DEFAULT_SETTINGS } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { CategoryManagerPage } from '../pages/CategoryManagerPage';
import { createCategorySeed, seedLibrary } from '../utils/storage';

test.describe('Category Manager - UI/UX Tests', () => {

  test.beforeEach(async ({ storage }) => {
    // Start with clean state and sidepanel mode for consistent UI
    await seedLibrary(storage, {
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'sidepanel',
      },
      interfaceMode: 'sidepanel',
    });
  });

  test.describe('Navigation & Display', () => {
    test('should open category manager from main library view', async ({ context, storage, extensionId }) => {
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Verify we're in the main library view
      await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();

      // Find the Categories tab in the bottom tab bar
      const categoriesTab = sidepanelPage.getByTestId('tab-categories');
      await expect(categoriesTab).toBeVisible();
      await expect(categoriesTab).toHaveAttribute('aria-selected', 'false');

      // Click to open the Categories section
      await categoriesTab.click();

      // Verify the Categories section opened correctly
      await expect(categoriesTab).toHaveAttribute('aria-selected', 'true');
      await expect(sidepanelPage.getByRole('heading', { level: 1, name: 'Categories', exact: true })).toBeVisible();

      // The list, and "Add category" below it: no form on the screen, the sheet creates and edits
      await expect(sidepanelPage.getByText('Your Categories')).toBeVisible();
      const addCategory = sidepanelPage.getByRole('button', { name: 'Add category', exact: true });
      await expect(addCategory).toBeVisible();
      await expect(addCategory).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(sidepanelPage.getByRole('textbox')).toHaveCount(0);
      await expect(sidepanelPage.getByRole('dialog')).toHaveCount(0);
      const listBox = await sidepanelPage.getByRole('region', { name: 'Your Categories' }).boundingBox();
      const addBox = await addCategory.boundingBox();
      expect(addBox?.y ?? 0, 'Add category is below the list').toBeGreaterThan((listBox?.y ?? 0) + (listBox?.height ?? 0));
    });

    test('should close category manager and return to main library view', async ({ context, storage, extensionId }) => {
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager
      await sidepanelPage.getByTestId('tab-categories').click();
      await expect(sidepanelPage.getByRole('heading', { level: 1, name: 'Categories', exact: true })).toBeVisible();

      // Categories has no back button: return via the Library tab
      await expect(sidepanelPage.getByTestId('back-button')).toHaveCount(0);
      await sidepanelPage.getByTestId('tab-library').click();

      // Verify return to main library view
      await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
      await expect(sidepanelPage.getByRole('heading', { level: 1, name: 'Categories', exact: true })).toBeHidden();

      // Verify the tab bar reflects the active Library section
      await expect(sidepanelPage.getByTestId('tab-library')).toHaveAttribute('aria-selected', 'true');
      await expect(sidepanelPage.getByTestId('tab-categories')).toHaveAttribute('aria-selected', 'false');
    });

    test('should display category count correctly', async ({ context, storage, extensionId }) => {
      // Seed multiple categories
      const categories = [
        createCategorySeed({ name: 'Work', color: '#3B82F6' }),
        createCategorySeed({ name: 'Personal', color: '#10B981' }),
        createCategorySeed({ name: 'Research', color: '#F59E0B' }),
      ];

      await seedLibrary(storage, {
        categories,
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager
      await sidepanelPage.getByTestId('tab-categories').click();

      // Verify count shows seeded categories + default "Uncategorized"
      await expect(sidepanelPage.getByText('4 categories', { exact: true }).first()).toBeVisible();

      // Verify all categories are displayed, in their order
      await expect(sidepanelPage.getByTestId('category-row')).toHaveText([/Uncategorized/, /Work/, /Personal/, /Research/]);
    });

    test('should display singular category count correctly', async ({ context, storage, extensionId }) => {
      // Start with only the default category
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager
      await sidepanelPage.getByTestId('tab-categories').click();

      // Verify singular form is used
      await expect(sidepanelPage.getByText('1 category', { exact: true }).first()).toBeVisible();
      // Check that the counter doesn't show plural form
      await expect(sidepanelPage.locator('span').filter({ hasText: /^\d+ categories$/ })).toBeHidden();
    });

    test('should show only the default Category, with Add category ready, when no custom categories exist', async ({ context, storage, extensionId }) => {
      // Start with clean state (only default category exists)
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager
      await sidepanelPage.getByTestId('tab-categories').click();

      // Verify count shows 1 for the default category
      await expect(sidepanelPage.getByText('1 category', { exact: true }).first()).toBeVisible();

      // Verify only "Uncategorized" is shown
      await expect(sidepanelPage.getByTestId('category-row')).toHaveCount(1);
      await expect(sidepanelPage.getByText('Uncategorized')).toBeVisible();
      await expect(sidepanelPage.getByText('Default')).toBeVisible();

      // "Add category" is there to create the first custom one
      await expect(sidepanelPage.getByRole('button', { name: 'Add category', exact: true })).toBeEnabled();
    });

    test('should update category count dynamically when categories are added/removed', async ({ context, extensionId }) => {
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      const categories = new CategoryManagerPage(sidepanelPage);
      await categories.openFromLibrary();

      // Initial state: only default category
      await categories.expectCategoryCount(1);

      // Add a new category
      await categories.createCategory('Testing');
      await categories.expectCategoryCount(2);
      await expect(sidepanelPage.getByText('1 category', { exact: true })).toHaveCount(0);

      // Add another category
      await categories.createCategory('Development', { submitWith: 'enter' });
      await categories.expectCategoryCount(3);

      // Delete a category (Testing): at once, the Notification offering Undo
      await categories.deleteCategory('Testing');
      await categories.expectCategoryCount(2);
      await expect(sidepanelPage.getByText('3 categories', { exact: true })).toHaveCount(0);

      // Undo counts it again
      await categories.undoDelete();
      await categories.expectCategoryExists('Testing');
      await categories.expectCategoryCount(3);
    });

    test('should step the Categories view back while the sheet is open', async ({ context, extensionId }) => {
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      const categories = new CategoryManagerPage(sidepanelPage);
      await categories.openFromLibrary();

      const view = categories.getView();
      await expect(view).not.toHaveAttribute('data-stepped-back');
      await expect(view).toHaveCSS('transform', 'none');

      await categories.openCreateSheet();
      await expect(view).toHaveAttribute('data-stepped-back', '');
      // scale(.93) translateY(10px), once its transition has ended
      await expect.poll(() => view.evaluate(element => {
        const matrix = new DOMMatrix(getComputedStyle(element).transform);
        return [matrix.a, matrix.d, matrix.f].map(value => Math.round(value * 100) / 100);
      })).toEqual([0.93, 0.93, 9.3]);
      await expect(view).toHaveCSS('border-radius', '22px');

      await categories.dismissSheet('escape');
      await expect(view).not.toHaveAttribute('data-stepped-back');
      await expect(view).toHaveCSS('transform', 'none');
    });
  });

  test.describe('Category colors in the sheet', () => {
    test('offers the 12 Category colors, one chosen, and a new Category takes the one chosen', async ({ context, storage, extensionId }) => {
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      const categories = new CategoryManagerPage(sidepanelPage);
      await categories.openFromLibrary();

      await categories.openCreateSheet();
      const swatches = categories.getSheet().getByRole('button', { name: new RegExp(`^(${PRESET_COLORS.map(color => color.name).join('|')})$`) });
      await expect(swatches).toHaveCount(PRESET_COLORS.length);
      for (const [index, color] of PRESET_COLORS.entries()) {
        await expect(swatches.nth(index)).toHaveAccessibleName(color.name);
      }
      // A new Category starts with the first color no Category uses: Ocean Blue, in an empty Library
      await expect(categories.getSheet().getByRole('button', { pressed: true })).toHaveAccessibleName('Ocean Blue');

      await categories.fillSheetName('Design');
      await categories.chooseColor('Purple');
      await expect(categories.getSheet().getByRole('button', { pressed: true })).toHaveCount(1);
      await expect(categories.getSheetPreview()).toHaveCSS('background-color', 'rgb(147, 51, 234)');
      await categories.submitSheet();

      await categories.expectSheetClosed();
      await expect(categories.getRowSwatch('Design')).toHaveCSS('background-color', 'rgb(147, 51, 234)');
      await expect(categories.getRowSwatch('Design')).toHaveAttribute('title', 'Purple');
      expect(await storage.getCategories()).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Design', color: '#9333EA' })])
      );
    });

    test('should display category color swatches correctly', async ({ context, storage, extensionId }) => {
      // Seed categories with different colors
      const categories = [
        createCategorySeed({ name: 'Red Category', color: '#EF4444' }),
        createCategorySeed({ name: 'Blue Category', color: '#3B82F6' }),
        createCategorySeed({ name: 'Green Category', color: '#10B981' }),
      ];

      await seedLibrary(storage, {
        categories,
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      const categoryManager = new CategoryManagerPage(sidepanelPage);
      await categoryManager.openFromLibrary();

      // Each row shows its Category's color
      await expect(categoryManager.getRowSwatch('Red Category')).toHaveCSS('background-color', 'rgb(239, 68, 68)');
      await expect(categoryManager.getRowSwatch('Blue Category')).toHaveCSS('background-color', 'rgb(59, 130, 246)');
      await expect(categoryManager.getRowSwatch('Green Category')).toHaveCSS('background-color', 'rgb(16, 185, 129)');
    });

    test('recolors a Category through its sheet', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Color Test', color: '#2563EB' }); // Ocean Blue

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      const categories = new CategoryManagerPage(sidepanelPage);
      await categories.openFromLibrary();

      await categories.openEditSheet('Color Test');
      await expect(categories.getColorSwatch('Ocean Blue')).toHaveAttribute('aria-pressed', 'true');
      await expect(categories.getSheetPreview()).toHaveCSS('background-color', 'rgb(37, 99, 235)');
      await categories.chooseColor('Amber');
      // Amber takes black text, the other presets white
      await expect(categories.getSheetPreview()).toHaveCSS('color', 'rgb(0, 0, 0)');
      await categories.submitSheet();

      await categories.expectSheetClosed();
      await categories.expectNotification('Category saved', 'Color Test');
      await expect(categories.getRowSwatch('Color Test')).toHaveCSS('background-color', 'rgb(217, 119, 6)');
      expect(await storage.getCategories()).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: testCategory.id, name: 'Color Test', color: '#D97706' })])
      );
    });

    test('keeps a color that is not one of the 12, with no swatch chosen, when only the name changes', async ({ context, storage, extensionId }) => {
      const navy = createCategorySeed({ name: 'Archives', color: '#1E40AF' }); // Navy, no longer a preset

      await seedLibrary(storage, {
        categories: [navy],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      const categories = new CategoryManagerPage(sidepanelPage);
      await categories.openFromLibrary();

      await categories.openEditSheet('Archives');
      await expect(categories.getSheet().getByRole('button', { pressed: true })).toHaveCount(0);
      await expect(categories.getSheetPreview()).toHaveCSS('background-color', 'rgb(30, 64, 175)');
      await categories.fillSheetName('Old archives');
      await categories.submitSheet();

      await categories.expectSheetClosed();
      expect(await storage.getCategories()).toEqual(
        expect.arrayContaining([{ id: navy.id, name: 'Old archives', color: '#1E40AF' }])
      );
    });
  });

  test.describe('The sheet in the popup', () => {
    test('creates, edits and deletes a Category through the sheet in the popup', async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, { categories: [createCategorySeed({ name: 'Work', color: '#2563EB' })] });
      await page.setViewportSize({ width: 400, height: 500 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      const categories = new CategoryManagerPage(page);
      await categories.openFromLibrary();

      // The panel rises from the bottom of the popup, across its width
      await categories.openCreateSheet();
      const panel = await categories.getSheet().boundingBox();
      expect(panel?.x).toBe(0);
      expect(panel?.width).toBe(400);
      expect((panel?.y ?? 0) + (panel?.height ?? 0)).toBeCloseTo(500, 0);
      await categories.dismissSheet('backdrop');

      await categories.createCategory('Personal', { color: 'Pink' });
      await categories.editCategory('Personal', 'Home', { color: 'Lime', submitWith: 'enter' });
      await categories.deleteCategory('Work');

      await expect.poll(async () => (await storage.getCategories()).map(({ name, color }) => ({ name, color }))).toEqual([
        { name: 'Uncategorized', color: undefined },
        { name: 'Home', color: '#4D7C0F' }
      ]);
    });
  });
});

import { DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary, createCategorySeed } from '../utils/storage';

test.describe('Category Manager - Keyboard Navigation and Accessibility', () => {

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

  test.describe('Keyboard Navigation and Accessibility', () => {
    test('should support keyboard navigation for category creation', async ({ context, storage, extensionId }) => {
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Focus on the category name input
      const categoryNameInput = sidepanelPage.getByPlaceholder('Enter category name...');
      await categoryNameInput.focus();

      // Type a category name
      await categoryNameInput.fill('Keyboard Test');

      // Use Tab to navigate to Add button and press Enter
      await sidepanelPage.keyboard.press('Tab');
      const addButton = sidepanelPage.getByRole('button', { name: 'Add' });
      await expect(addButton).toBeFocused();
      await addButton.press('Enter');

      // Verify category was created
      await expect(sidepanelPage.getByText('Keyboard Test')).toBeVisible();
      await expect(sidepanelPage.getByText('2 categories')).toBeVisible();
    });

    test('should support Escape key to cancel category editing', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Edit Test', color: '#3B82F6' });

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager and start editing
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Edit Test' }).first();
      await categoryRow.hover();
      await categoryRow.getByRole('button', { name: 'Edit category' }).click();

      // Make changes
      const editInput = sidepanelPage.locator('input[placeholder="Category name"]');
      await editInput.clear();
      await editInput.fill('Changed Name');

      // Press Escape to cancel
      await editInput.press('Escape');

      // Verify original name is preserved
      await expect(sidepanelPage.getByText('Edit Test')).toBeVisible();
      await expect(sidepanelPage.getByText('Changed Name')).toBeHidden();
      await expect(editInput).toBeHidden();
    });

    test('should support Enter key to save category editing', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Save Test', color: '#3B82F6' });

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager and start editing
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Save Test' }).first();
      await categoryRow.hover();
      await categoryRow.getByRole('button', { name: 'Edit category' }).click();

      // Make changes and press Enter
      const editInput = sidepanelPage.locator('input[placeholder="Category name"]');
      await editInput.clear();
      await editInput.fill('Updated Name');
      await editInput.press('Enter');

      // Verify changes were saved
      await expect(sidepanelPage.getByText('Updated Name')).toBeVisible();
      await expect(sidepanelPage.getByText('Save Test')).toBeHidden();
      await expect(editInput).toBeHidden();
    });

    test('should provide proper ARIA labels and accessibility features', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Accessibility Test', color: '#3B82F6' });

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Verify main heading has proper hierarchy
      const mainHeading = sidepanelPage.getByRole('heading', { name: 'Manage Categories' });
      await expect(mainHeading).toBeVisible();

      // Verify section headings are present
      await expect(sidepanelPage.getByText('Add New Category')).toBeVisible();
      await expect(sidepanelPage.getByText('Your Categories')).toBeVisible();

      // Verify form labels are properly associated
      const categoryNameInput = sidepanelPage.getByPlaceholder('Enter category name...');
      await expect(categoryNameInput).toBeVisible();

      // Verify buttons have descriptive names/titles
      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Accessibility Test' }).first();
      await categoryRow.hover();

      const editButton = categoryRow.getByRole('button', { name: 'Edit category' });
      await expect(editButton).toBeVisible();

      const deleteButton = categoryRow.getByRole('button', { name: 'Delete category' });
      await expect(deleteButton).toBeVisible();

      // Verify back button has proper labeling
      const backButton = sidepanelPage.getByTestId('back-button').first();
      await expect(backButton).toBeVisible();
    });
  });

  test.describe('Loading States and Interactions', () => {
    test('should show proper button states during interactions', async ({ context, storage, extensionId }) => {
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Verify Add button is disabled when input is empty
      const addButton = sidepanelPage.getByRole('button', { name: 'Add' });
      await expect(addButton).toBeDisabled();

      // Type in input to enable button
      const categoryNameInput = sidepanelPage.getByPlaceholder('Enter category name...');
      await categoryNameInput.fill('Test Category');
      await expect(addButton).toBeEnabled();

      // Clear input to disable button again
      await categoryNameInput.clear();
      await expect(addButton).toBeDisabled();
    });

    test('should handle hover states for category actions', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Hover Test', color: '#3B82F6' });

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Open category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Hover Test' }).first();

      // Initially, action buttons should not be visible (opacity-0)
      const editButton = categoryRow.getByRole('button', { name: 'Edit category' });
      const deleteButton = categoryRow.getByRole('button', { name: 'Delete category' });

      // Hover over the category row to reveal actions
      await categoryRow.hover();

      // Action buttons should become visible
      await expect(editButton).toBeVisible();
      await expect(deleteButton).toBeVisible();
    });

    test('should preserve category manager state during operations', async ({ context, storage, extensionId }) => {
      const categories = [
        createCategorySeed({ name: 'Category 1', color: '#3B82F6' }),
        createCategorySeed({ name: 'Category 2', color: '#10B981' }),
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
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Verify initial state
      await expect(sidepanelPage.getByText('3 categories')).toBeVisible(); // 2 custom + default

      // Perform an operation (add category)
      await sidepanelPage.getByPlaceholder('Enter category name...').fill('Category 3');
      await sidepanelPage.getByRole('button', { name: 'Add' }).click();

      // Verify state updated correctly
      await expect(sidepanelPage.getByText('4 categories')).toBeVisible();
      await expect(sidepanelPage.getByText('Category 3')).toBeVisible();

      // Verify other categories are still visible
      await expect(sidepanelPage.getByText('Category 1')).toBeVisible();
      await expect(sidepanelPage.getByText('Category 2')).toBeVisible();
      await expect(sidepanelPage.getByText('Uncategorized')).toBeVisible();

      // Verify form is reset after successful creation
      const categoryNameInput = sidepanelPage.getByPlaceholder('Enter category name...');
      await expect(categoryNameInput).toHaveValue('');
      await expect(sidepanelPage.getByRole('button', { name: 'Add' })).toBeDisabled();
    });
  });
});

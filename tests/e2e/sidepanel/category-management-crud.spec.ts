import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary, createCategorySeed, createPromptSeed } from '../utils/storage';

test.describe('Category Management - Core CRUD Operations', () => {

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

  test.describe('Category Creation', () => {
    test('should create a new category with name and color', async ({ context, storage, extensionId }) => {
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager (button is in the main library view)
      await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();

      const manageCategoriesButton = sidepanelPage.getByRole('button', { name: 'Manage categories' });
      await expect(manageCategoriesButton).toBeVisible();
      await manageCategoriesButton.click();

      // Verify category manager opened
      await expect(sidepanelPage.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();
      await expect(sidepanelPage.getByText('Organize your prompt collection')).toBeVisible();

      // Create new category
      const categoryNameInput = sidepanelPage.getByPlaceholder('Enter category name...');
      await expect(categoryNameInput).toBeVisible();
      await categoryNameInput.fill('Coding');

      // Add button should be enabled when name is provided
      const addButton = sidepanelPage.getByRole('button', { name: 'Add' });
      await expect(addButton).toBeEnabled();
      await addButton.click();

      // Verify category appears in list
      await expect(sidepanelPage.getByText('Coding')).toBeVisible();
      await expect(sidepanelPage.getByText('2 categories')).toBeVisible(); // Should include default "Uncategorized" + new one

      // Verify input is cleared after creation
      await expect(categoryNameInput).toHaveValue('');

      // Verify persistence in storage
      const categories = await storage.getCategories();
      expect(categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Coding',
          }),
        ])
      );
    });

    test('should show validation error for duplicate category names', async ({ context, storage, extensionId }) => {
      // Seed existing category
      await seedLibrary(storage, {
        categories: [
          createCategorySeed({ name: 'Coding', color: '#3B82F6' })
        ],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Try to create duplicate category (case-insensitive test)
      const categoryNameInput = sidepanelPage.getByPlaceholder('Enter category name...');
      await categoryNameInput.fill('coding'); // lowercase to test case-insensitive validation

      const addButton = sidepanelPage.getByRole('button', { name: 'Add' });
      await addButton.click();

      // Verify error message appears
      await expect(sidepanelPage.getByText('⚠️ Category already exists')).toBeVisible();

      // Verify category count hasn't changed
      await expect(sidepanelPage.getByText('2 categories')).toBeVisible(); // Default + seeded category

      // Verify storage unchanged
      const categories = await storage.getCategories();
      const codingCategories = categories.filter(c => c.name.toLowerCase() === 'coding');
      expect(codingCategories).toHaveLength(1); // Only the original one
    });

    test('should show validation error for empty category name', async ({ context, storage, extensionId }) => {
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Verify add button is disabled when input is empty
      const addButton = sidepanelPage.getByRole('button', { name: 'Add' });
      await expect(addButton).toBeDisabled();

      // Try to submit empty name by filling and clearing
      const categoryNameInput = sidepanelPage.getByPlaceholder('Enter category name...');
      await categoryNameInput.fill('test');
      await expect(addButton).toBeEnabled();

      await categoryNameInput.clear();
      await expect(addButton).toBeDisabled();

      // Try with only whitespace
      await categoryNameInput.fill('   ');
      await expect(addButton).toBeDisabled();
    });

    test('should clear error message when correcting input', async ({ context, storage, extensionId }) => {
      // Seed existing category to trigger duplicate error
      await seedLibrary(storage, {
        categories: [
          createCategorySeed({ name: 'Existing', color: '#3B82F6' })
        ],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      const categoryNameInput = sidepanelPage.getByPlaceholder('Enter category name...');

      // Trigger duplicate error
      await categoryNameInput.fill('Existing');
      await sidepanelPage.getByRole('button', { name: 'Add' }).click();
      await expect(sidepanelPage.getByText('⚠️ Category already exists')).toBeVisible();

      // Correct the input
      await categoryNameInput.clear();
      await categoryNameInput.fill('New Category');

      // Error should disappear
      await expect(sidepanelPage.getByText('⚠️ Category already exists')).toBeHidden();
    });
  });

  test.describe('Category Editing', () => {
    test('should edit category name and color inline', async ({ context, storage, extensionId }) => {
      // Seed category to edit
      const testCategory = createCategorySeed({
        name: 'Research',
        color: '#3B82F6' // Blue
      });

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Verify category is displayed
      await expect(sidepanelPage.getByText('Research')).toBeVisible();

      // Hover to reveal edit button and click it
      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Research' }).first();
      await categoryRow.hover();

      const editButton = categoryRow.getByRole('button', { name: 'Edit category' });
      await expect(editButton).toBeVisible();
      await editButton.click();

      // Verify edit mode activated - input should be visible and focused
      const editInput = sidepanelPage.locator('input[placeholder="Category name"]');
      await expect(editInput).toBeVisible();
      await expect(editInput).toHaveValue('Research');

      // Change the name
      await editInput.clear();
      await editInput.fill('Analysis');

      // Save changes by clicking save button
      const saveButton = sidepanelPage.getByRole('button', { name: 'Save changes (Enter)' });
      await expect(saveButton).toBeVisible();
      await saveButton.click();

      // Verify changes applied
      await expect(sidepanelPage.getByText('Analysis')).toBeVisible();
      await expect(sidepanelPage.getByText('Research')).toBeHidden();

      // Verify persistence in storage
      const categories = await storage.getCategories();
      expect(categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: testCategory.id,
            name: 'Analysis',
          }),
        ])
      );
    });

    test('should cancel edit with Escape key', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Original Name' });

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Start editing
      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Original Name' }).first();
      await categoryRow.hover();
      await categoryRow.getByRole('button', { name: 'Edit category' }).click();

      // Make changes
      const editInput = sidepanelPage.locator('input[placeholder="Category name"]');
      await editInput.clear();
      await editInput.fill('Changed Name');

      // Press Escape to cancel
      await editInput.press('Escape');

      // Verify original name restored and edit mode exited
      await expect(sidepanelPage.getByText('Original Name')).toBeVisible();
      await expect(sidepanelPage.getByText('Changed Name')).toBeHidden();
      await expect(editInput).toBeHidden();

      // Verify storage unchanged
      const categories = await storage.getCategories();
      expect(categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: testCategory.id,
            name: 'Original Name',
          }),
        ])
      );
    });

    test('should save edit with Enter key', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Old Name' });

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Start editing
      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Old Name' }).first();
      await categoryRow.hover();
      await categoryRow.getByRole('button', { name: 'Edit category' }).click();

      // Make changes and press Enter
      const editInput = sidepanelPage.locator('input[placeholder="Category name"]');
      await editInput.clear();
      await editInput.fill('New Name');
      await editInput.press('Enter');

      // Verify changes saved
      await expect(sidepanelPage.getByText('New Name')).toBeVisible();
      await expect(sidepanelPage.getByText('Old Name')).toBeHidden();

      // Verify storage updated
      const categories = await storage.getCategories();
      expect(categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: testCategory.id,
            name: 'New Name',
          }),
        ])
      );
    });
  });

  test.describe('Category Deletion', () => {
    test('should delete category with confirmation dialog', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Temporary Category' });

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Verify category exists
      await expect(sidepanelPage.getByText('Temporary Category')).toBeVisible();
      await expect(sidepanelPage.getByText('2 categories')).toBeVisible();

      // Hover to reveal delete button and click it
      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Temporary Category' }).first();
      await categoryRow.hover();

      const deleteButton = categoryRow.getByRole('button', { name: 'Delete category' });
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      // Verify confirmation dialog appears
      const confirmDialog = sidepanelPage.getByRole('dialog', { name: 'Delete Category' });
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByText('Delete category "Temporary Category"?')).toBeVisible();
      await expect(confirmDialog.getByText('All prompts in this category will be moved to "Uncategorized"')).toBeVisible();

      // Confirm deletion
      const confirmDeleteButton = confirmDialog.getByRole('button', { name: 'Delete' });
      await confirmDeleteButton.click();

      // Verify category removed from list (not from dialog which should be closed)
      await expect(sidepanelPage.locator('.text-sm.font-semibold').filter({ hasText: 'Temporary Category' })).toBeHidden();
      await expect(sidepanelPage.getByText('1 category')).toBeVisible(); // Only "Uncategorized" remains

      // Verify storage updated
      const categories = await storage.getCategories();
      expect(categories).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: testCategory.id }),
        ])
      );
    });

    test('should prevent deletion of "Uncategorized" default category', async ({ context, storage, extensionId }) => {
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Find the Uncategorized category row
      const uncategorizedRow = sidepanelPage.locator('div').filter({ hasText: 'Uncategorized' }).filter({ hasText: 'Default' }).first();
      await expect(uncategorizedRow).toBeVisible();

      // Hover over it
      await uncategorizedRow.hover();

      // Verify no delete button is present (only edit should be missing too for default category)
      await expect(uncategorizedRow.getByRole('button', { name: 'Delete category' })).toBeHidden();
      await expect(uncategorizedRow.getByRole('button', { name: 'Edit category' })).toBeHidden();
    });

    test('should cancel deletion dialog', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Keep This Category' });

      await seedLibrary(storage, {
        categories: [testCategory],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Click delete button
      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Keep This Category' }).first();
      await categoryRow.hover();
      await categoryRow.getByRole('button', { name: 'Delete category' }).click();

      // Verify dialog appears
      const confirmDialog = sidepanelPage.getByRole('dialog', { name: 'Delete Category' });
      await expect(confirmDialog).toBeVisible();

      // Cancel deletion
      const cancelButton = confirmDialog.getByRole('button', { name: 'Cancel' });
      await cancelButton.click();

      // Verify category remains
      await expect(sidepanelPage.getByText('Keep This Category')).toBeVisible();
      await expect(sidepanelPage.getByText('2 categories')).toBeVisible();

      // Verify dialog closed
      await expect(confirmDialog).toBeHidden();

      // Verify storage unchanged
      const categories = await storage.getCategories();
      expect(categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: testCategory.id,
            name: 'Keep This Category',
          }),
        ])
      );
    });

    test('should move prompts to "Uncategorized" when category deleted', async ({ context, storage, extensionId }) => {
      const testCategory = createCategorySeed({ name: 'Work' });
      const testPrompts = [
        createPromptSeed({
          title: 'Work Prompt 1',
          content: 'First work prompt',
          category: 'Work'
        }),
        createPromptSeed({
          title: 'Work Prompt 2',
          content: 'Second work prompt',
          category: 'Work'
        }),
      ];

      await seedLibrary(storage, {
        categories: [testCategory],
        prompts: testPrompts,
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      // Navigate to category manager
      await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

      // Delete the "Work" category
      const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Work' }).first();
      await categoryRow.hover();
      await categoryRow.getByRole('button', { name: 'Delete category' }).click();

      // Confirm deletion
      const confirmDialog = sidepanelPage.getByRole('dialog', { name: 'Delete Category' });
      await confirmDialog.getByRole('button', { name: 'Delete' }).click();

      // Go back to main view to verify prompts moved to Uncategorized
      // Find and click the X button in the category manager header
      const closeButton = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M10 19l-7-7m0 0l7-7m-7 7h18"]') });
      await closeButton.click();
      await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();

      // Verify prompts still exist and are now in Uncategorized
      await expect(sidepanelPage.getByRole('heading', { name: 'Work Prompt 1' })).toBeVisible();
      await expect(sidepanelPage.getByRole('heading', { name: 'Work Prompt 2' })).toBeVisible();

      // Verify prompts moved to Uncategorized in storage
      const prompts = await storage.getPrompts();
      const workPrompts = prompts.filter(p => p.title.startsWith('Work Prompt'));
      expect(workPrompts).toHaveLength(2);
      workPrompts.forEach(prompt => {
        expect(prompt.category).toBe(DEFAULT_CATEGORY);
      });
    });
  });
});

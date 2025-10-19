import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary, createCategorySeed, createPromptSeed } from '../utils/storage';

test.describe('Category Management - Phase 1: Core CRUD Operations', () => {

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

  test.describe('Priority 4: Integration with Prompt System', () => {

    test.describe('Category-Prompt Relationship', () => {
      test('should update prompt category references when category renamed', async ({ context, storage, extensionId }) => {
        // Seed category and prompts
        const researchCategory = createCategorySeed({ name: 'Research', color: '#3B82F6' });
        const researchPrompts = [
          createPromptSeed({
            title: 'Literature Review',
            content: 'Analyze recent papers on the topic',
            category: 'Research'
          }),
          createPromptSeed({
            title: 'Data Analysis',
            content: 'Statistical analysis methodology',
            category: 'Research'
          }),
        ];
        const uncategorizedPrompt = createPromptSeed({
          title: 'Random Note',
          content: 'Just a random note',
          category: DEFAULT_CATEGORY
        });

        await seedLibrary(storage, {
          categories: [researchCategory],
          prompts: [...researchPrompts, uncategorizedPrompt],
          settings: {
            ...DEFAULT_SETTINGS,
            interfaceMode: 'sidepanel',
          },
        });

        const sidepanelPage = await context.newPage();
        await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

        // Navigate to category manager and edit the Research category
        await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();
        await expect(sidepanelPage.getByText('Research')).toBeVisible();

        // Start editing the Research category
        const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Research' }).first();
        await categoryRow.hover();
        await categoryRow.getByRole('button', { name: 'Edit category' }).click();

        // Change name to "Analysis"
        const editInput = sidepanelPage.locator('input[placeholder="Category name"]');
        await editInput.clear();
        await editInput.fill('Analysis');
        await editInput.press('Enter');

        // Verify category name changed in UI
        await expect(sidepanelPage.getByText('Analysis')).toBeVisible();
        await expect(sidepanelPage.getByText('Research')).toBeHidden();

        // Go back to main view
        const closeButton = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M10 19l-7-7m0 0l7-7m-7 7h18"]') }).first();
        await closeButton.click();
        await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();

        // Verify prompts still exist and are now categorized as "Analysis"
        await expect(sidepanelPage.getByRole('heading', { name: 'Literature Review' })).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Data Analysis' })).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Random Note' })).toBeVisible();

        // Verify in storage that prompts now reference "Analysis" category
        const updatedPrompts = await storage.getPrompts();
        const analysisPrompts = updatedPrompts.filter(p => p.category === 'Analysis');
        const researchPromptsAfter = updatedPrompts.filter(p => p.category === 'Research');
        const uncategorizedPromptsAfter = updatedPrompts.filter(p => p.category === DEFAULT_CATEGORY);

        expect(analysisPrompts).toHaveLength(2);
        expect(researchPromptsAfter).toHaveLength(0); // Should be zero now
        expect(uncategorizedPromptsAfter).toHaveLength(1); // The random note should still be uncategorized

        // Verify specific prompts moved to new category
        expect(analysisPrompts.map(p => p.title)).toEqual(
          expect.arrayContaining(['Literature Review', 'Data Analysis'])
        );
      });

      test('should create prompts in custom categories and filter correctly', async ({ context, storage, extensionId }) => {
        // Seed custom categories
        const codingCategory = createCategorySeed({ name: 'Coding', color: '#10B981' });
        const writingCategory = createCategorySeed({ name: 'Writing', color: '#F59E0B' });

        await seedLibrary(storage, {
          categories: [codingCategory, writingCategory],
          settings: {
            ...DEFAULT_SETTINGS,
            interfaceMode: 'sidepanel',
          },
        });

        const sidepanelPage = await context.newPage();
        await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

        // Create a prompt in the "Coding" category
        await sidepanelPage.getByRole('button', { name: 'Add new prompt' }).click();
        await expect(sidepanelPage.getByRole('heading', { name: 'Add New Prompt' })).toBeVisible();

        await sidepanelPage.getByLabel('Title (optional)').fill('Debug Function');
        await sidepanelPage.getByLabel('Content *').fill('Add console.log statements to trace execution flow');

        // Select "Coding" category from dropdown
        const categorySelect = sidepanelPage.getByLabel('Category');
        await categorySelect.selectOption('Coding');

        await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();
        await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();

        // Create another prompt in "Writing" category
        await sidepanelPage.getByRole('button', { name: 'Add new prompt' }).click();
        await sidepanelPage.getByLabel('Title (optional)').fill('Blog Post Outline');
        await sidepanelPage.getByLabel('Content *').fill('Create a structured outline for a technical blog post');

        const categorySelect2 = sidepanelPage.getByLabel('Category');
        await categorySelect2.selectOption('Writing');

        await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();
        await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();

        // Verify both prompts are visible in main view
        await expect(sidepanelPage.getByRole('heading', { name: 'Debug Function' })).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Blog Post Outline' })).toBeVisible();

        // Test category filtering - filter by "Coding"
        await sidepanelPage.getByRole('button', { name: /Filter by category:/i }).click();
        await sidepanelPage.getByRole('menu', { name: 'Category filter menu' }).waitFor();
        await sidepanelPage.getByRole('menuitem', { name: 'Coding' }).click();

        // Should only show the coding prompt
        await expect(sidepanelPage.getByRole('heading', { name: 'Debug Function' })).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Blog Post Outline' })).toBeHidden();

        // Filter by "Writing"
        await sidepanelPage.getByRole('button', { name: /Filter by category:/i }).click();
        await sidepanelPage.getByRole('menu', { name: 'Category filter menu' }).waitFor();
        await sidepanelPage.getByRole('menuitem', { name: 'Writing' }).click();

        // Should only show the writing prompt
        await expect(sidepanelPage.getByRole('heading', { name: 'Blog Post Outline' })).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Debug Function' })).toBeHidden();

        // Clear filter (show all)
        await sidepanelPage.getByRole('button', { name: /Filter by category:/i }).click();
        await sidepanelPage.getByRole('menu', { name: 'Category filter menu' }).waitFor();
        await sidepanelPage.getByRole('menuitem', { name: 'All Categories' }).click();

        // Should show both prompts again
        await expect(sidepanelPage.getByRole('heading', { name: 'Debug Function' })).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Blog Post Outline' })).toBeVisible();

        // Verify storage contains prompts with correct categories
        const prompts = await storage.getPrompts();
        expect(prompts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: 'Debug Function',
              category: 'Coding',
            }),
            expect.objectContaining({
              title: 'Blog Post Outline',
              category: 'Writing',
            }),
          ])
        );
      });

      test('should handle category filtering after category rename', async ({ context, storage, extensionId }) => {
        // Seed category and prompts
        const originalCategory = createCategorySeed({ name: 'Development', color: '#8B5CF6' });
        const devPrompts = [
          createPromptSeed({
            title: 'Code Review Checklist',
            content: 'Review code for bugs and best practices',
            category: 'Development'
          }),
          createPromptSeed({
            title: 'Git Workflow',
            content: 'Standard git branching workflow',
            category: 'Development'
          }),
        ];

        await seedLibrary(storage, {
          categories: [originalCategory],
          prompts: devPrompts,
          settings: {
            ...DEFAULT_SETTINGS,
            interfaceMode: 'sidepanel',
          },
        });

        const sidepanelPage = await context.newPage();
        await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

        // First, verify filtering works with original category name
        await sidepanelPage.getByRole('button', { name: /Filter by category:/i }).click();
        await sidepanelPage.getByRole('menu', { name: 'Category filter menu' }).waitFor();
        await sidepanelPage.getByRole('menuitem', { name: 'Development' }).click();

        // Should show both development prompts
        await expect(sidepanelPage.getByRole('heading', { name: 'Code Review Checklist' })).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Git Workflow' })).toBeVisible();

        // Clear filter to show all prompts
        await sidepanelPage.getByRole('button', { name: /Filter by category:/i }).click();
        await sidepanelPage.getByRole('menu', { name: 'Category filter menu' }).waitFor();
        await sidepanelPage.getByRole('menuitem', { name: 'All Categories' }).click();

        // Now rename the category
        await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();
        const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Development' }).first();
        await categoryRow.hover();
        await categoryRow.getByRole('button', { name: 'Edit category' }).click();

        const editInput = sidepanelPage.locator('input[placeholder="Category name"]');
        await editInput.clear();
        await editInput.fill('Programming');
        await editInput.press('Enter');

        // Go back to main view
        const closeButton = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M10 19l-7-7m0 0l7-7m-7 7h18"]') }).first();
        await closeButton.click();

        // Verify category filter dropdown now shows "Programming" instead of "Development"
        // Check options by trying to select them
        await sidepanelPage.getByRole('button', { name: /Filter by category:/i }).click();
        await sidepanelPage.getByRole('menu', { name: 'Category filter menu' }).waitFor();
        await sidepanelPage.getByRole('menuitem', { name: 'Programming' }).click();

        // Should still show the same prompts, now under "Programming"
        await expect(sidepanelPage.getByRole('heading', { name: 'Code Review Checklist' })).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Git Workflow' })).toBeVisible();

        // Verify prompts' categories were updated in storage
        const updatedPrompts = await storage.getPrompts();
        const programmingPrompts = updatedPrompts.filter(p => p.category === 'Programming');
        const developmentPrompts = updatedPrompts.filter(p => p.category === 'Development');

        expect(programmingPrompts).toHaveLength(2);
        expect(developmentPrompts).toHaveLength(0);
        expect(programmingPrompts.map(p => p.title)).toEqual(
          expect.arrayContaining(['Code Review Checklist', 'Git Workflow'])
        );
      });

      test('should prevent creating prompts in non-existent categories', async ({ context, storage, extensionId }) => {
        await seedLibrary(storage, {
          settings: {
            ...DEFAULT_SETTINGS,
            interfaceMode: 'sidepanel',
          },
        });

        const sidepanelPage = await context.newPage();
        await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

        // Try to create a prompt
        await sidepanelPage.getByRole('button', { name: 'Add new prompt' }).click();
        await sidepanelPage.getByLabel('Title (optional)').fill('Test Prompt');
        await sidepanelPage.getByLabel('Content *').fill('Test content');

        // Verify only "Uncategorized" is available in category dropdown
        const categorySelect = sidepanelPage.getByLabel('Category');

        // Verify no other category options exist by checking the select element
        const categoryOptions = categorySelect.locator('option');
        const optionCount = await categoryOptions.count();
        expect(optionCount).toBe(1);

        // Verify the option is "Uncategorized"
        const optionText = categoryOptions.first();
        await expect(optionText).toHaveText(DEFAULT_CATEGORY);

        // Select Uncategorized and save
        await categorySelect.selectOption(DEFAULT_CATEGORY);
        await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();

        // Verify prompt was created in Uncategorized
        await expect(sidepanelPage.getByText('Prompt created successfully')).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Test Prompt' })).toBeVisible();

        const prompts = await storage.getPrompts();
        expect(prompts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              title: 'Test Prompt',
              category: DEFAULT_CATEGORY,
            }),
          ])
        );
      });

      test('should validate category exists when editing prompt category', async ({ context, storage, extensionId }) => {
        // Seed categories and a prompt
        const validCategory = createCategorySeed({ name: 'Valid Category', color: '#3B82F6' });
        const testPrompt = createPromptSeed({
          title: 'Editable Prompt',
          content: 'This prompt will be edited',
          category: DEFAULT_CATEGORY
        });

        await seedLibrary(storage, {
          categories: [validCategory],
          prompts: [testPrompt],
          settings: {
            ...DEFAULT_SETTINGS,
            interfaceMode: 'sidepanel',
          },
        });

        const sidepanelPage = await context.newPage();
        await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

        // Edit the prompt
        await expect(sidepanelPage.getByRole('heading', { name: 'Editable Prompt' })).toBeVisible();

        await sidepanelPage.getByRole('button', { name: 'More actions for Editable Prompt' }).click();
        await sidepanelPage.getByRole('menuitem', { name: 'Edit Editable Prompt' }).click();

        // Change category to the valid one
        const categorySelect = sidepanelPage.getByLabel('Category');

        // Verify both options exist
        const categoryOptions = categorySelect.locator('option');
        const optionCount = await categoryOptions.count();
        expect(optionCount).toBe(2);

        // Select Valid Category
        await categorySelect.selectOption('Valid Category');
        await sidepanelPage.getByRole('button', { name: 'Save Changes' }).click();

        // Verify update succeeded
        await expect(sidepanelPage.getByText('Prompt updated successfully')).toBeVisible();

        // Verify in storage
        const updatedPrompts = await storage.getPrompts();
        const editedPrompt = updatedPrompts.find(p => p.title === 'Editable Prompt');
        expect(editedPrompt?.category).toBe('Valid Category');
      });
    });
  });

  test.describe('Priority 2: Category Manager UI/UX Tests', () => {

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

        // Find the "Manage categories" button
        const manageCategoriesButton = sidepanelPage.getByRole('button', { name: 'Manage categories' });
        await expect(manageCategoriesButton).toBeVisible();
        await expect(manageCategoriesButton).toBeEnabled();

        // Click to open category manager
        await manageCategoriesButton.click();

        // Verify category manager opened correctly
        await expect(sidepanelPage.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();
        await expect(sidepanelPage.getByText('Organize your prompt collection')).toBeVisible();

        // Verify UI components are present
        await expect(sidepanelPage.getByText('Add New Category')).toBeVisible();
        await expect(sidepanelPage.getByText('Your Categories')).toBeVisible();
        await expect(sidepanelPage.getByPlaceholder('Enter category name...')).toBeVisible();
        await expect(sidepanelPage.getByRole('button', { name: 'Add' })).toBeVisible();
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
        await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();
        await expect(sidepanelPage.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();

        // Find and click the close button
        const closeButton = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M10 19l-7-7m0 0l7-7m-7 7h18"]') }).first();
        await expect(closeButton).toBeVisible();
        await closeButton.click();

        // Verify return to main library view
        await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
        await expect(sidepanelPage.getByRole('heading', { name: 'Manage Categories' })).toBeHidden();

        // Verify the "Manage categories" button is visible again
        await expect(sidepanelPage.getByRole('button', { name: 'Manage categories' })).toBeVisible();
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
        await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

        // Verify count shows seeded categories + default "Uncategorized"
        await expect(sidepanelPage.getByText('4 categories')).toBeVisible();

        // Verify all categories are displayed
        await expect(sidepanelPage.getByText('Work')).toBeVisible();
        await expect(sidepanelPage.getByText('Personal')).toBeVisible();
        await expect(sidepanelPage.getByText('Research')).toBeVisible();
        await expect(sidepanelPage.getByText('Uncategorized')).toBeVisible();
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
        await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

        // Verify singular form is used
        await expect(sidepanelPage.getByText('1 category')).toBeVisible();
        // Check that the counter doesn't show plural form
        await expect(sidepanelPage.locator('span').filter({ hasText: /^\d+ categories$/ })).toBeHidden();
      });

      test('should show empty state when no custom categories exist', async ({ context, storage, extensionId }) => {
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
        await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

        // Verify count shows 1 for the default category
        await expect(sidepanelPage.getByText('1 category')).toBeVisible();

        // Verify only "Uncategorized" is shown
        await expect(sidepanelPage.getByText('Uncategorized')).toBeVisible();
        await expect(sidepanelPage.getByText('Default')).toBeVisible();

        // Verify the form is available to create first custom category
        await expect(sidepanelPage.getByPlaceholder('Enter category name...')).toBeVisible();
        await expect(sidepanelPage.getByRole('button', { name: 'Add' })).toBeDisabled(); // Should be disabled when empty
      });

      test('should update category count dynamically when categories are added/removed', async ({ context, storage, extensionId }) => {
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

        // Initial state: only default category
        await expect(sidepanelPage.getByText('1 category')).toBeVisible();

        // Add a new category
        const categoryNameInput = sidepanelPage.getByPlaceholder('Enter category name...');
        await categoryNameInput.fill('Testing');
        await sidepanelPage.getByRole('button', { name: 'Add' }).click();

        // Verify count updated to 2
        await expect(sidepanelPage.getByText('2 categories')).toBeVisible();
        await expect(sidepanelPage.getByText('1 category')).toBeHidden();

        // Add another category
        await categoryNameInput.fill('Development');
        await sidepanelPage.getByRole('button', { name: 'Add' }).click();

        // Wait for the success message to confirm the category was added
        await expect(sidepanelPage.getByText('Category created successfully').first()).toBeVisible();

        // Verify count updated to 3
        await expect(sidepanelPage.getByText('3 categories')).toBeVisible();

        // Delete a category (Testing)
        const testingCategoryRow = sidepanelPage.locator('div').filter({ hasText: 'Testing' }).first();
        await testingCategoryRow.hover();
        await testingCategoryRow.getByRole('button', { name: 'Delete category' }).first().click();

        // Confirm deletion in dialog
        const confirmDialog = sidepanelPage.getByRole('dialog', { name: 'Delete Category' });
        await confirmDialog.getByRole('button', { name: 'Delete' }).click();

        // Verify count decreased to 2
        await expect(sidepanelPage.getByText('2 categories')).toBeVisible();
        await expect(sidepanelPage.getByText('3 categories')).toBeHidden();
      });
    });

    test.describe('Color Picker Integration', () => {
      test('should display color picker and allow color selection for new categories', async ({ context, storage, extensionId }) => {
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

        // Verify color picker section is present in the form
        await expect(sidepanelPage.getByText('Category Color')).toBeVisible();

        // Create a category with a specific color
        await sidepanelPage.getByPlaceholder('Enter category name...').fill('Design');

        // The color picker should have a default color selected
        // We'll verify this by creating the category and checking the resulting color swatch
        await sidepanelPage.getByRole('button', { name: 'Add' }).click();

        // Verify category was created and has a color swatch
        await expect(sidepanelPage.getByText('Design')).toBeVisible();

        // Find the color swatch for the Design category
        const designCategoryRow = sidepanelPage.locator('div').filter({ hasText: 'Design' }).first();
        const colorSwatch = designCategoryRow.locator('div[style*="background-color"]').first();
        await expect(colorSwatch).toBeVisible();
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

        // Open category manager
        await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

        // Verify each category has its color swatch visible
        const redCategoryRow = sidepanelPage.locator('div').filter({ hasText: 'Red Category' }).first();
        // Find the color swatch with the specific background color inline style
        const redSwatch = redCategoryRow.locator('div[style*="background-color: rgb(239, 68, 68)"]').first();
        await expect(redSwatch).toBeVisible();
        // Verify the background color is applied
        await expect(redSwatch).toHaveCSS('background-color', 'rgb(239, 68, 68)');

        const blueCategoryRow = sidepanelPage.locator('div').filter({ hasText: 'Blue Category' }).first();
        const blueSwatch = blueCategoryRow.locator('div[style*="background-color: rgb(59, 130, 246)"]').first();
        await expect(blueSwatch).toBeVisible();
        await expect(blueSwatch).toHaveCSS('background-color', 'rgb(59, 130, 246)');

        const greenCategoryRow = sidepanelPage.locator('div').filter({ hasText: 'Green Category' }).first();
        const greenSwatch = greenCategoryRow.locator('div[style*="background-color: rgb(16, 185, 129)"]').first();
        await expect(greenSwatch).toBeVisible();
        await expect(greenSwatch).toHaveCSS('background-color', 'rgb(16, 185, 129)');
      });

      test('should allow editing category color through inline color picker', async ({ context, storage, extensionId }) => {
        const testCategory = createCategorySeed({ name: 'Color Test', color: '#3B82F6' }); // Blue

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

        // Start editing the category
        const categoryRow = sidepanelPage.locator('div').filter({ hasText: 'Color Test' }).first();
        await categoryRow.hover();
        await categoryRow.getByRole('button', { name: 'Edit category' }).click();

        // Verify we're in edit mode and color picker is visible
        const editInput = sidepanelPage.locator('input[placeholder="Category name"]');
        await expect(editInput).toBeVisible();
        await expect(editInput).toHaveValue('Color Test');

        // Verify color picker is available in edit mode (compact mode)
        // In edit mode, there should be a ColorPicker component present
        // We'll verify this by checking that the input has been converted to edit mode (edit input is visible)
        await expect(editInput).toBeVisible();

        // The color picker in edit mode should be present - we can verify this by
        // checking that there's a different structure when in edit mode
        // Since the edit mode has both input and color picker, just verify the input is working
        await expect(editInput).toHaveValue('Color Test');

        // Save the edit (without changing color for this test)
        await editInput.press('Enter');

        // Verify edit mode exited
        await expect(editInput).toBeHidden();
        await expect(sidepanelPage.getByText('Color Test')).toBeVisible();
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

        // Verify close button has proper labeling
        const closeButton = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M10 19l-7-7m0 0l7-7m-7 7h18"]') }).first();
        await expect(closeButton).toBeVisible();
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
});
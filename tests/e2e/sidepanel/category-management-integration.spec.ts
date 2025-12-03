import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary, createCategorySeed, createPromptSeed } from '../utils/storage';

test.describe('Category Management - Integration with Prompt System', () => {

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
      await sidepanelPage.getByLabel('Category').click();
      await sidepanelPage.getByRole('menu', { name: 'Select category' }).waitFor();
      await sidepanelPage.getByRole('menuitem', { name: 'Coding' }).click();

      await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();
      await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();

      // Create another prompt in "Writing" category
      await sidepanelPage.getByRole('button', { name: 'Add new prompt' }).click();
      await sidepanelPage.getByLabel('Title (optional)').fill('Blog Post Outline');
      await sidepanelPage.getByLabel('Content *').fill('Create a structured outline for a technical blog post');

      await sidepanelPage.getByLabel('Category').click();
      await sidepanelPage.getByRole('menu', { name: 'Select category' }).waitFor();
      await sidepanelPage.getByRole('menuitem', { name: 'Writing' }).click();

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
      const categoryButton = sidepanelPage.getByLabel('Category');

      // Verify the dropdown shows "Uncategorized" as the only available option
      await expect(categoryButton).toHaveText(DEFAULT_CATEGORY);

      // Open the dropdown to verify no other options
      await categoryButton.click();
      await sidepanelPage.getByRole('menu', { name: 'Select category' }).waitFor();

      // Count the menuitem elements
      const menuItems = sidepanelPage.getByRole('menuitem');
      const itemCount = await menuItems.count();
      expect(itemCount).toBe(1);

      // Verify the only menuitem is "Uncategorized"
      await expect(menuItems.first()).toHaveText(DEFAULT_CATEGORY);

      // Select Uncategorized (which should already be selected, but click to close dropdown)
      await menuItems.first().click();
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
      await sidepanelPage.getByRole('menuitem', { name: 'Edit' }).click();

      // Change category to the valid one using native select (EditPromptForm uses native select)
      const categorySelect = sidepanelPage.getByLabel('Category');

      // Verify both options exist
      const options = categorySelect.locator('option');
      const optionCount = await options.count();
      expect(optionCount).toBe(2);

      // Select Valid Category using native selectOption
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

import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { CategoryManagerPage } from '../pages/CategoryManagerPage';
import { LibraryPage } from '../pages/LibraryPage';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';

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

      // Navigate to category manager and rename the Research category in its sheet
      const categoryManager = new CategoryManagerPage(sidepanelPage);
      await categoryManager.openFromLibrary();
      await categoryManager.openEditSheet('Research');
      await expect(categoryManager.getSheet()).toContainText('Used by 2 prompts');

      // Change name to "Analysis", saved with Enter
      await categoryManager.fillSheetName('Analysis');
      await categoryManager.submitSheet('enter');

      // Verify category name changed in UI
      await categoryManager.expectSheetClosed();
      await categoryManager.expectCategoryExists('Analysis');
      await categoryManager.expectCategoryNotExists('Research');

      // Return to the Library via the tab bar
      const backButton = sidepanelPage.getByTestId('tab-library');
      await backButton.click();
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
      const libraryPage = new LibraryPage(sidepanelPage);

      // A Library with no Prompt has no Library filter at all
      await expect(sidepanelPage.getByRole('heading', { name: 'Your library is empty' })).toBeVisible();
      await expect(sidepanelPage.getByRole('radiogroup', { name: 'Library filter' })).toHaveCount(0);

      // Create a prompt in the "Coding" category
      await sidepanelPage.getByRole('button', { name: 'Add new prompt' }).click();
      await expect(sidepanelPage.getByRole('heading', { name: 'New prompt', exact: true })).toBeVisible();

      await sidepanelPage.getByLabel('Title', { exact: true }).fill('Debug Function');
      await sidepanelPage.getByLabel('Content', { exact: true }).fill('Add console.log statements to trace execution flow');

      // Select "Coding" category from dropdown
      await sidepanelPage.getByRole('radio', { name: 'Coding', exact: true }).click();

      await sidepanelPage.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(sidepanelPage.getByText('Prompt created', { exact: true }).first()).toBeVisible();

      // Create another prompt in "Writing" category
      await sidepanelPage.getByRole('button', { name: 'Add new prompt' }).click();
      await sidepanelPage.getByLabel('Title', { exact: true }).fill('Blog Post Outline');
      await sidepanelPage.getByLabel('Content', { exact: true }).fill('Create a structured outline for a technical blog post');

      await sidepanelPage.getByRole('radio', { name: 'Writing', exact: true }).click();

      await sidepanelPage.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(sidepanelPage.getByText('Prompt created', { exact: true }).first()).toBeVisible();

      // Verify both prompts are visible in main view
      await expect(sidepanelPage.getByRole('heading', { name: 'Debug Function' })).toBeVisible();
      await expect(sidepanelPage.getByRole('heading', { name: 'Blog Post Outline' })).toBeVisible();

      // Each category now holds a prompt, so each has a pill
      await libraryPage.expectCategoryFilterOptions(['Coding', 'Writing']);

      // Test category filtering - filter by "Coding"
      await libraryPage.filterByCategory('Coding');

      // Should only show the coding prompt
      await expect(sidepanelPage.getByRole('heading', { name: 'Debug Function' })).toBeVisible();
      await expect(sidepanelPage.getByRole('heading', { name: 'Blog Post Outline' })).toBeHidden();

      // Filter by "Writing"
      await libraryPage.filterByCategory('Writing');

      // Should only show the writing prompt
      await expect(sidepanelPage.getByRole('heading', { name: 'Blog Post Outline' })).toBeVisible();
      await expect(sidepanelPage.getByRole('heading', { name: 'Debug Function' })).toBeHidden();

      // Clear filter (show all)
      await libraryPage.selectLibraryFilter('All');

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
      const libraryPage = new LibraryPage(sidepanelPage);

      // First, verify filtering works with original category name
      await libraryPage.filterByCategory('Development');

      // Should show both development prompts
      await expect(sidepanelPage.getByRole('heading', { name: 'Code Review Checklist' })).toBeVisible();
      await expect(sidepanelPage.getByRole('heading', { name: 'Git Workflow' })).toBeVisible();

      // Clear filter to show all prompts
      await libraryPage.selectLibraryFilter('All');

      // Now rename the category in its sheet
      const categoryManager = new CategoryManagerPage(sidepanelPage);
      await categoryManager.openFromLibrary();
      await categoryManager.editCategory('Development', 'Programming', { submitWith: 'enter' });

      // Return to the Library via the tab bar
      const backButton2 = sidepanelPage.getByTestId('tab-library');
      await backButton2.click();

      // Verify the Library filter now offers "Programming" instead of "Development"
      await expect(libraryPage.getLibraryFilterPill('Development')).toHaveCount(0);
      await libraryPage.filterByCategory('Programming');

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
      await sidepanelPage.getByLabel('Title', { exact: true }).fill('Test Prompt');
      await sidepanelPage.getByLabel('Content', { exact: true }).fill('Test content');

      // Verify "Uncategorized" is the only Category offered, and it is chosen
      const categoryChips = sidepanelPage.getByRole('radiogroup', { name: 'Category' }).getByRole('radio');
      await expect(categoryChips).toHaveCount(1);
      await expect(categoryChips.first()).toHaveText(DEFAULT_CATEGORY);
      await expect(categoryChips.first()).toBeChecked();
      await sidepanelPage.getByRole('button', { name: 'Save', exact: true }).click();

      // Verify prompt was created in Uncategorized
      await expect(sidepanelPage.getByText('Prompt created', { exact: true })).toBeVisible();
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

      await sidepanelPage.getByRole('button', { name: 'Edit Editable Prompt' }).click();

      // Both Categories are offered; choose the valid one
      await expect(sidepanelPage.getByRole('radiogroup', { name: 'Category' }).getByRole('radio')).toHaveCount(2);
      await sidepanelPage.getByRole('radio', { name: 'Valid Category', exact: true }).click();
      await sidepanelPage.getByRole('button', { name: 'Save', exact: true }).click();

      // Verify update succeeded
      await expect(sidepanelPage.getByText('Prompt saved', { exact: true })).toBeVisible();

      // Verify in storage
      const updatedPrompts = await storage.getPrompts();
      const editedPrompt = updatedPrompts.find(p => p.title === 'Editable Prompt');
      expect(editedPrompt?.category).toBe('Valid Category');
    });
  });
});

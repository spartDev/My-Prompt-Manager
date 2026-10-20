import { DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { LibraryPage } from '../pages/LibraryPage';
import { seedLibrary, createPromptSeed, createCategorySeed } from '../utils/storage';

/**
 * Creates seed data for power user testing scenarios.
 * Each test calls this to get fresh, isolated state.
 */
function createPowerUserSeedData() {
  const categories = [
    createCategorySeed({ name: 'Work', color: '#3B82F6' }),
    createCategorySeed({ name: 'Personal', color: '#10B981' }),
    createCategorySeed({ name: 'Development', color: '#8B5CF6' }),
    createCategorySeed({ name: 'Marketing', color: '#F59E0B' }),
    createCategorySeed({ name: 'Research', color: '#EF4444' })
  ];

  const prompts = [
    // Work category (5 prompts)
    createPromptSeed({
      id: 'work-1',
      title: 'Meeting Summary Template',
      content: 'Please provide a structured summary of this meeting including key decisions, action items, and next steps.',
      category: 'Work'
    }),
    createPromptSeed({
      id: 'work-2',
      title: 'Project Status Update',
      content: 'Create a project status update including progress, blockers, and timeline adjustments.',
      category: 'Work'
    }),
    createPromptSeed({
      id: 'work-3',
      title: 'Email Response Template',
      content: 'Draft a professional email response addressing the key points raised in the previous message.',
      category: 'Work'
    }),
    createPromptSeed({
      id: 'work-4',
      title: 'Performance Review Notes',
      content: 'Structure my performance review feedback focusing on achievements, areas for growth, and goals.',
      category: 'Work'
    }),
    createPromptSeed({
      id: 'work-5',
      title: 'Client Proposal Outline',
      content: 'Create a compelling proposal outline that addresses client needs and demonstrates our value proposition.',
      category: 'Work'
    }),

    // Personal category (3 prompts)
    createPromptSeed({
      id: 'personal-1',
      title: 'Travel Planner',
      content: 'Help me plan a detailed itinerary for my trip including accommodations, activities, and budget considerations.',
      category: 'Personal'
    }),
    createPromptSeed({
      id: 'personal-2',
      title: 'Meal Prep Ideas',
      content: 'Suggest healthy meal prep ideas for the week based on my dietary preferences and time constraints.',
      category: 'Personal'
    }),
    createPromptSeed({
      id: 'personal-3',
      title: 'Learning Goal Tracker',
      content: 'Help me structure my learning goals and create a realistic study schedule with milestones.',
      category: 'Personal'
    }),

    // Development category (4 prompts)
    createPromptSeed({
      id: 'dev-1',
      title: 'Code Review Checklist',
      content: 'Review this code for best practices, performance, security, and maintainability issues.',
      category: 'Development'
    }),
    createPromptSeed({
      id: 'dev-2',
      title: 'Bug Report Template',
      content: 'Structure this bug report with clear reproduction steps, expected vs actual behavior, and environment details.',
      category: 'Development'
    }),
    createPromptSeed({
      id: 'dev-3',
      title: 'API Documentation Helper',
      content: 'Generate comprehensive API documentation including endpoints, parameters, responses, and examples.',
      category: 'Development'
    }),
    createPromptSeed({
      id: 'dev-4',
      title: 'Database Query Optimizer',
      content: 'Analyze this database query for performance optimizations and suggest improvements.',
      category: 'Development'
    }),

    // Marketing category (2 prompts)
    createPromptSeed({
      id: 'marketing-1',
      title: 'Social Media Content',
      content: 'Create engaging social media content that aligns with our brand voice and campaign objectives.',
      category: 'Marketing'
    }),
    createPromptSeed({
      id: 'marketing-2',
      title: 'Campaign Analysis',
      content: 'Analyze marketing campaign performance and provide insights for optimization.',
      category: 'Marketing'
    }),

    // Research category (3 prompts)
    createPromptSeed({
      id: 'research-1',
      title: 'Literature Review Helper',
      content: 'Help me synthesize key findings from multiple research papers and identify knowledge gaps.',
      category: 'Research'
    }),
    createPromptSeed({
      id: 'research-2',
      title: 'Survey Design Assistant',
      content: 'Design survey questions that gather actionable insights while avoiding bias and leading questions.',
      category: 'Research'
    }),
    createPromptSeed({
      id: 'research-3',
      title: 'Data Analysis Summary',
      content: 'Analyze this dataset and provide clear insights with visualizations and actionable recommendations.',
      category: 'Research'
    })
  ];

  return { categories, prompts };
}

test.describe('Power User Prompt Management', () => {

  test('should rename category and verify prompts updated', async ({ context, storage, extensionId }) => {
    const { categories, prompts } = createPowerUserSeedData();
    await seedLibrary(storage, {
      prompts,
      categories,
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' }
    });

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
    await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
    const libraryPage = new LibraryPage(sidepanelPage);

    // Verify initial state: 17 total prompts (15 seeded + 2 defaults)
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(17);

    // Open category manager
    await sidepanelPage.getByTestId('tab-categories').click();
    await expect(sidepanelPage.getByRole('heading', { level: 1, name: 'Categories', exact: true })).toBeVisible();

    // Rename "Work" category to "Professional"
    const workCategoryRow = sidepanelPage.getByTestId('category-row').filter({ has: sidepanelPage.getByText('Work', { exact: true }) }).first();
    await workCategoryRow.hover();
    await workCategoryRow.getByRole('button', { name: 'Edit category' }).click();

    const nameInput = sidepanelPage.getByPlaceholder('Category name', { exact: true });
    await nameInput.clear();
    await nameInput.fill('Professional');

    await sidepanelPage.getByRole('button', { name: 'Save changes (Enter)' }).click();
    await expect(sidepanelPage.getByText('Category updated successfully')).toBeVisible();

    // Verify category name changed
    await expect(sidepanelPage.getByText('Professional')).toBeVisible();
    await expect(sidepanelPage.getByText('Work')).toBeHidden();

    // Switch to the Library tab and verify prompts updated
    await sidepanelPage.getByTestId('tab-library').click();

    // Filter to Professional and verify former "Work" prompts are there
    await expect(libraryPage.getLibraryFilterPill('Work')).toHaveCount(0);
    await libraryPage.filterByCategory('Professional');
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(5);

    // Verify specific prompts show in the renamed category
    await expect(sidepanelPage.getByText('Meeting Summary Template')).toBeVisible();
    await expect(sidepanelPage.getByText('Client Proposal Outline')).toBeVisible();
  });

  test('should consolidate categories by moving prompts and deleting empty category', async ({ context, storage, extensionId }) => {
    const { categories, prompts } = createPowerUserSeedData();
    await seedLibrary(storage, {
      prompts,
      categories,
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' }
    });

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
    await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
    const libraryPage = new LibraryPage(sidepanelPage);

    // Filter to Marketing category
    await libraryPage.filterByCategory('Marketing');
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(2);

    // Move first marketing prompt to Work category
    const socialMediaCard = sidepanelPage.getByTestId('prompt-card').filter({ hasText: 'Social Media Content' }).first();
    await socialMediaCard.getByRole('button', { name: /^Edit / }).click();

    await expect(sidepanelPage.getByRole('heading', { name: 'Edit Prompt' })).toBeVisible();
    await sidepanelPage.getByLabel('Category').click();
    await sidepanelPage.getByRole('menu', { name: 'Select category' }).waitFor();
    await sidepanelPage.getByRole('menuitem', { name: 'Work' }).click();
    await sidepanelPage.getByRole('button', { name: 'Save Changes' }).click();
    await expect(sidepanelPage.getByText('Prompt updated successfully').first()).toBeVisible();

    // Move second marketing prompt to Work category
    const campaignAnalysisCard = sidepanelPage.getByTestId('prompt-card').filter({ hasText: 'Campaign Analysis' }).first();
    await campaignAnalysisCard.getByRole('button', { name: /^Edit / }).click();

    await expect(sidepanelPage.getByRole('heading', { name: 'Edit Prompt' })).toBeVisible();
    await sidepanelPage.getByLabel('Category').click();
    await sidepanelPage.getByRole('menu', { name: 'Select category' }).waitFor();
    await sidepanelPage.getByRole('menuitem', { name: 'Work' }).click();
    await sidepanelPage.getByRole('button', { name: 'Save Changes' }).click();
    await expect(sidepanelPage.getByText('Prompt updated successfully').first()).toBeVisible();

    // Verify Marketing category is now empty: its pill is gone and the Library is back to All
    await expect(libraryPage.getLibraryFilterPill('Marketing')).toHaveCount(0);
    await expect(libraryPage.getLibraryFilterPill('All')).toHaveAttribute('aria-checked', 'true');
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(17);

    // Verify prompts moved to Work category
    await libraryPage.filterByCategory('Work');
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(7); // 5 original + 2 moved

    // Delete the empty Marketing category
    await sidepanelPage.getByTestId('tab-categories').click();
    const marketingCategoryRow = sidepanelPage.getByTestId('category-row').filter({ has: sidepanelPage.getByText('Marketing', { exact: true }) }).first();
    await marketingCategoryRow.hover();
    await marketingCategoryRow.getByRole('button', { name: 'Delete category' }).click();

    await expect(sidepanelPage.getByRole('heading', { name: 'Delete Category' })).toBeVisible();
    await sidepanelPage.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(sidepanelPage.getByText('Category deleted successfully')).toBeVisible();

    // Verify Marketing category removed
    await expect(sidepanelPage.getByText('Marketing')).toBeHidden();
  });

  test('should filter and search across categories', async ({ context, storage, extensionId }) => {
    const { categories, prompts } = createPowerUserSeedData();
    await seedLibrary(storage, {
      prompts,
      categories,
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' }
    });

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
    await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
    const libraryPage = new LibraryPage(sidepanelPage);

    const searchInput = sidepanelPage.getByPlaceholder('Search your prompts...');

    // Test search with keyword "review"
    await searchInput.fill('review');

    // Should find: Performance Review Notes, Code Review Checklist, Literature Review Helper
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(3);
    await expect(sidepanelPage.getByText('Performance Review Notes')).toBeVisible();
    await expect(sidepanelPage.getByText('Code Review Checklist')).toBeVisible();
    await expect(sidepanelPage.getByText('Literature Review Helper')).toBeVisible();

    // Test category filter + search term combination
    await searchInput.clear();
    await searchInput.fill('template');
    await libraryPage.filterByCategory('Work');

    // Should find prompts with "template" in Work category
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(2);
    await expect(sidepanelPage.getByText('Meeting Summary Template')).toBeVisible();
    await expect(sidepanelPage.getByText('Email Response Template')).toBeVisible();

    // Clear filters and verify all prompts visible
    await searchInput.clear();
    await libraryPage.selectLibraryFilter('All');
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(17);
  });

  test('should move prompts between categories', async ({ context, storage, extensionId }) => {
    const { categories, prompts } = createPowerUserSeedData();
    await seedLibrary(storage, {
      prompts,
      categories,
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' }
    });

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
    await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
    const libraryPage = new LibraryPage(sidepanelPage);

    // Filter to Development category
    await libraryPage.filterByCategory('Development');
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(4);

    // Move 3 Development prompts to Work category
    const devPrompts = ['Code Review Checklist', 'Bug Report Template', 'API Documentation Helper'];

    for (const promptTitle of devPrompts) {
      const promptCard = sidepanelPage.getByTestId('prompt-card').filter({ hasText: promptTitle }).first();
      await promptCard.getByRole('button', { name: /^Edit / }).click();

      await expect(sidepanelPage.getByRole('heading', { name: 'Edit Prompt' })).toBeVisible();
      await sidepanelPage.getByLabel('Category').click();
      await sidepanelPage.getByRole('menu', { name: 'Select category' }).waitFor();
      await sidepanelPage.getByRole('menuitem', { name: 'Work' }).click();
      await sidepanelPage.getByRole('button', { name: 'Save Changes' }).click();
      await expect(sidepanelPage.getByText('Prompt updated successfully').first()).toBeVisible();
    }

    // Verify Development category now has only 1 prompt
    await libraryPage.filterByCategory('Development');
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(1);
    await expect(sidepanelPage.getByText('Database Query Optimizer')).toBeVisible();

    // Verify Work category now has the moved prompts (5 original + 3 moved = 8)
    await libraryPage.filterByCategory('Work');
    await expect(sidepanelPage.getByTestId('prompt-card')).toHaveCount(8);
  });

  test('should export library data for backup', async ({ context, storage, extensionId }) => {
    const { categories, prompts } = createPowerUserSeedData();
    await seedLibrary(storage, {
      prompts,
      categories,
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' }
    });

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
    await expect(sidepanelPage.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();

    // Navigate to settings for export functionality
    await sidepanelPage.getByTestId('tab-settings').click();
    await expect(sidepanelPage.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Remove File System Access API to force legacy download fallback
    // (showSaveFilePicker opens native OS dialog that Playwright can't interact with)
    await sidepanelPage.evaluate(() => {
      delete (window as Record<string, unknown>).showSaveFilePicker;
    });

    // Test export functionality
    const downloadPromise = sidepanelPage.waitForEvent('download');
    await sidepanelPage.getByRole('button', { name: 'Export' }).click();

    const download = await downloadPromise;

    // Verify download occurred with correct filename
    expect(download.suggestedFilename()).toContain('prompt-library-backup');
    expect(download.suggestedFilename()).toContain('.json');

    // Verify download path exists
    const exportPath = await download.path();
    expect(exportPath).toBeTruthy();
  });

});

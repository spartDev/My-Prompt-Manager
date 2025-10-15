import { DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { CLAUDE_MOCK_HTML, CHATGPT_MOCK_HTML } from '../fixtures/mock-pages';
import { CategoryManagerPage } from '../pages/CategoryManagerPage';
import { LibraryPage } from '../pages/LibraryPage';
import { PromptFormPage } from '../pages/PromptFormPage';
import { seedLibrary } from '../utils/storage';
import { workflows } from '../utils/workflows';

test.describe('User Journey: New User Setup & First Prompt Creation', () => {
  test('should complete the complete new user onboarding workflow', async ({
    context,
    storage,
    extensionId
  }) => {
    // Start with completely fresh state (no data)
    await seedLibrary(storage, {
      prompts: [],
      categories: [],
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'sidepanel',
      },
    });

    // Step 1: User opens extension for the first time
    const sidepanelPage = await workflows.navigation.openSidepanel(context, extensionId);

    // Initialize POMs
    const libraryPage = new LibraryPage(sidepanelPage);
    const categoryManagerPage = new CategoryManagerPage(sidepanelPage);
    const promptFormPage = new PromptFormPage(sidepanelPage);

    // Verify fresh state - should see empty state
    await expect(sidepanelPage.getByText('You\'re ready to go')).toBeVisible();
    await expect(sidepanelPage.getByText('Create your first prompt to start building')).toBeVisible();

    // Step 2: User creates their first custom category
    await categoryManagerPage.openFromLibrary();

    // Should see default category only
    await categoryManagerPage.expectCategoryCount(1);
    await categoryManagerPage.expectCategoryExists('Uncategorized');

    // Create first custom category: "Work"
    await categoryManagerPage.createCategory('Work');
    await categoryManagerPage.expectCategoryCount(2);
    await categoryManagerPage.expectCategoryExists('Work');

    // Create second category: "Personal"
    await categoryManagerPage.createCategory('Personal');
    await categoryManagerPage.expectCategoryCount(3);
    await categoryManagerPage.expectCategoryExists('Personal');

    // Return to main library view
    await categoryManagerPage.closeToLibrary();

    // Step 3: User creates their first prompt in a custom category
    await libraryPage.clickAddNewPrompt();
    await promptFormPage.createPrompt({
      title: 'Email Summary Template',
      content: 'Please summarize the key points from this email and suggest appropriate actions:\n\n[EMAIL_CONTENT]',
      category: 'Work'
    });
    await expect(libraryPage.promptCard('Email Summary Template').locator).toBeVisible();

    // Step 4: Create another prompt in different category
    await libraryPage.clickAddNewPrompt();
    await promptFormPage.createPrompt({
      title: 'Creative Writing Starter',
      content: 'Help me start a creative writing piece about [TOPIC]. Provide an engaging opening paragraph and suggest the tone and style.',
      category: 'Personal'
    });
    await expect(libraryPage.promptCard('Creative Writing Starter').locator).toBeVisible();

    // Step 5: Test category filtering
    // Filter by Work category
    await libraryPage.filterByCategory('Work');
    await expect(libraryPage.promptCard('Email Summary Template').locator).toBeVisible();
    await expect(sidepanelPage.getByText('Creative Writing Starter')).toBeHidden();

    // Filter by Personal category
    await libraryPage.filterByCategory('Personal');
    await expect(libraryPage.promptCard('Creative Writing Starter').locator).toBeVisible();
    await expect(sidepanelPage.getByText('Email Summary Template')).toBeHidden();

    // Reset to show all
    await libraryPage.clearFilters();
    await expect(libraryPage.promptCard('Email Summary Template').locator).toBeVisible();
    await expect(libraryPage.promptCard('Creative Writing Starter').locator).toBeVisible();

    // Step 6: Test prompt usage on Claude.ai (mocked)
    // Set up Claude.ai mocking
    await context.route('https://claude.ai/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: CLAUDE_MOCK_HTML,
        });
      } else {
        await route.continue();
      }
    });

    // Open Claude.ai in new tab
    const claudePage = await context.newPage();

    await claudePage.goto('https://claude.ai/', { waitUntil: 'domcontentloaded' });

    // Wait for the page to load completely
    await expect(claudePage.getByRole('heading', { name: 'Claude' })).toBeVisible();
    await expect(claudePage.locator('.ProseMirror')).toBeVisible();

    // Extension should inject the prompt library icon
    await expect(claudePage.locator('.prompt-library-integrated-icon')).toBeVisible();

    // Click the prompt library icon
    await claudePage.locator('.prompt-library-integrated-icon').click();

    // Should see prompt selector with our created prompts
    await expect(claudePage.getByText('Email Summary Template')).toBeVisible();
    await expect(claudePage.getByText('Creative Writing Starter')).toBeVisible();

    // Test search functionality in content script (no category filter)
    const searchInput = claudePage.locator('.search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Email');
    await expect(claudePage.getByText('Email Summary Template')).toBeVisible();
    await expect(claudePage.getByText('Creative Writing Starter')).toBeHidden();

    // Clear search to see all prompts again
    await searchInput.clear();
    await expect(claudePage.getByText('Creative Writing Starter')).toBeVisible();

    // Select the email template prompt
    await claudePage.locator('.prompt-item').filter({ hasText: 'Email Summary Template' }).click();

    // Verify prompt is inserted into the editor
    const editor = claudePage.locator('.ProseMirror');
    await expect(editor).toContainText('Please summarize the key points from this email');

    // Verify prompt selector closes after insertion
    await expect(claudePage.getByText('Email Summary Template')).toBeHidden();

    // Step 7: Test on ChatGPT (mocked) with different prompt
    await context.route('https://chatgpt.com/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: CHATGPT_MOCK_HTML,
        });
      } else {
        await route.continue();
      }
    });

    const chatgptPage = await context.newPage();
    await chatgptPage.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });

    await expect(chatgptPage.getByRole('heading', { name: 'ChatGPT' })).toBeVisible();
    await expect(chatgptPage.locator('#prompt-textarea')).toBeVisible();

    // Extension should inject prompt library icon
    await expect(chatgptPage.locator('.prompt-library-integrated-icon')).toBeVisible();

    // Open prompt selector
    await chatgptPage.locator('.prompt-library-integrated-icon').click();

    // Test search functionality to find creative writing prompt
    const chatgptSearchInput = chatgptPage.locator('.search-input');
    await chatgptSearchInput.fill('Creative');
    await expect(chatgptPage.getByText('Creative Writing Starter')).toBeVisible();
    await expect(chatgptPage.getByText('Email Summary Template')).toBeHidden();

    // Clear search to make selection
    await chatgptSearchInput.clear();
    await expect(chatgptPage.getByText('Email Summary Template')).toBeVisible();

    await chatgptPage.locator('.prompt-item').filter({ hasText: 'Creative Writing Starter' }).click();

    // Verify prompt inserted into ChatGPT textarea
    const textarea = chatgptPage.locator('#prompt-textarea');
    await expect(textarea).toHaveValue(/Help me start a creative writing piece about/);

    // Step 8: Return to extension and verify data persistence
    await sidepanelPage.bringToFront();

    // Verify all data is still there
    await expect(libraryPage.promptCard('Email Summary Template').locator).toBeVisible();
    await expect(libraryPage.promptCard('Creative Writing Starter').locator).toBeVisible();

    // Check categories are still available
    await categoryManagerPage.openFromLibrary();
    await categoryManagerPage.expectCategoryCount(3);
    await categoryManagerPage.expectCategoryExists('Work');
    await categoryManagerPage.expectCategoryExists('Personal');
    await categoryManagerPage.expectCategoryExists('Uncategorized');
    await categoryManagerPage.closeToLibrary();

    // Step 9: Add one more prompt to verify iterative building
    await libraryPage.clickAddNewPrompt();
    await promptFormPage.createPrompt({
      title: 'Code Review Helper',
      content: 'Please review this code for:\n1. Best practices\n2. Potential bugs\n3. Performance improvements\n4. Security issues\n\nCode:\n[CODE_TO_REVIEW]',
      category: 'Work'
    });
    await expect(libraryPage.promptCard('Code Review Helper').locator).toBeVisible();

    // Final verification: User now has a functional prompt library
    // - 3 categories (including default)
    // - 3 prompts across 2 custom categories
    // - Tested cross-platform integration
    // - Verified data persistence and filtering

    await expect(libraryPage.promptCards).toHaveCount(3);

    // Verify category distribution
    await libraryPage.filterByCategory('Work');
    await expect(libraryPage.promptCards).toHaveCount(2); // Email + Code Review

    await libraryPage.filterByCategory('Personal');
    await expect(libraryPage.promptCards).toHaveCount(1); // Creative Writing
  });

  test('should handle new user workflow with search functionality', async ({
    context,
    storage,
    extensionId
  }) => {
    // Start fresh
    await seedLibrary(storage, {
      prompts: [],
      categories: [],
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
    });

    const sidepanelPage = await workflows.navigation.openSidepanel(context, extensionId);

    // Initialize POMs
    const libraryPage = new LibraryPage(sidepanelPage);
    const categoryManagerPage = new CategoryManagerPage(sidepanelPage);
    const promptFormPage = new PromptFormPage(sidepanelPage);

    // Create a category
    await categoryManagerPage.openFromLibrary();
    await categoryManagerPage.createCategory('Development');
    await categoryManagerPage.closeToLibrary();

    // Add multiple prompts with different keywords
    const prompts = [
      { title: 'JavaScript Debug Helper', content: 'Help me debug this JavaScript code' },
      { title: 'Python Code Review', content: 'Review this Python function for improvements' },
      { title: 'API Documentation', content: 'Create documentation for this API endpoint' }
    ];

    for (const prompt of prompts) {
      await libraryPage.clickAddNewPrompt();
      await promptFormPage.createPrompt({
        title: prompt.title,
        content: prompt.content,
        category: 'Development'
      });
    }

    // Test search functionality
    await libraryPage.searchPrompts('JavaScript');
    await expect(libraryPage.promptCard('JavaScript Debug Helper').locator).toBeVisible();
    await expect(sidepanelPage.getByText('Python Code Review')).toBeHidden();
    await expect(sidepanelPage.getByText('API Documentation')).toBeHidden();

    // Search by title
    await libraryPage.searchPrompts('Python');
    await expect(libraryPage.promptCard('Python Code Review').locator).toBeVisible();
    await expect(sidepanelPage.getByText('JavaScript Debug Helper')).toBeHidden();

    // Search by content
    await libraryPage.searchPrompts('documentation');
    await expect(libraryPage.promptCard('API Documentation').locator).toBeVisible();
    await expect(sidepanelPage.getByText('JavaScript Debug Helper')).toBeHidden();

    // Clear search to show all
    await libraryPage.clearFilters();
    await expect(libraryPage.promptCards).toHaveCount(3);
  });
});

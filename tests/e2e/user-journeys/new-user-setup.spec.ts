import { DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { CLAUDE_MOCK_HTML, CHATGPT_MOCK_HTML } from '../fixtures/mock-pages';
import { seedLibrary } from '../utils/storage';

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
    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
      waitUntil: 'domcontentloaded'
    });

    // Verify fresh state - should see empty state
    await expect(sidepanelPage.getByText('You\'re ready to go')).toBeVisible();
    await expect(sidepanelPage.getByText('Create your first prompt to start building')).toBeVisible();

    // Step 2: User creates their first custom category
    await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();

    // Should see default category only
    await expect(sidepanelPage.getByText('1 category')).toBeVisible();
    await expect(sidepanelPage.getByText('Uncategorized')).toBeVisible();

    // Create first custom category: "Work"
    await sidepanelPage.getByPlaceholder('Enter category name...').fill('Work');
    await sidepanelPage.getByRole('button', { name: 'Add' }).click();

    // Verify category created
    await expect(sidepanelPage.getByText('Category created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('2 categories')).toBeVisible();
    await expect(sidepanelPage.getByText('Work')).toBeVisible();

    // Create second category: "Personal"
    await sidepanelPage.getByPlaceholder('Enter category name...').fill('Personal');
    await sidepanelPage.getByRole('button', { name: 'Add' }).click();

    await expect(sidepanelPage.getByText('Category created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('3 categories')).toBeVisible();
    await expect(sidepanelPage.getByText('Personal')).toBeVisible();

    // Return to main library view (close category manager)
    const closeButton = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M6 18L18 6M6 6l12 12"]') }).first();
    await closeButton.click();

    // Step 3: User creates their first prompt in a custom category
    // Verify we're back in library view
    await expect(sidepanelPage.getByText('My Prompt Manager')).toBeVisible();
    await sidepanelPage.getByRole('button', { name: /Add/ }).click();

    // Fill in prompt details
    await sidepanelPage.getByLabel('Title (optional)').fill('Email Summary Template');
    await sidepanelPage.getByLabel('Content *').fill('Please summarize the key points from this email and suggest appropriate actions:\n\n[EMAIL_CONTENT]');

    // Select "Work" category
    await sidepanelPage.getByLabel('Category').selectOption('Work');

    // Save the prompt
    await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();

    // Verify prompt created successfully
    await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('Email Summary Template')).toBeVisible();

    // Step 4: Create another prompt in different category
    await sidepanelPage.getByRole('button', { name: 'Add New Prompt' }).click();

    await sidepanelPage.getByLabel('Title (optional)').fill('Creative Writing Starter');
    await sidepanelPage.getByLabel('Content *').fill('Help me start a creative writing piece about [TOPIC]. Provide an engaging opening paragraph and suggest the tone and style.');
    await sidepanelPage.getByLabel('Category').selectOption('Personal');

    await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();

    await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('Creative Writing Starter')).toBeVisible();

    // Step 5: Test category filtering
    // Filter by Work category
    await sidepanelPage.locator('select').filter({ hasText: 'All Categories' }).selectOption('Work');

    // Should only see work-related prompt
    await expect(sidepanelPage.getByText('Email Summary Template')).toBeVisible();
    await expect(sidepanelPage.getByText('Creative Writing Starter')).not.toBeVisible();

    // Filter by Personal category
    await sidepanelPage.locator('select').filter({ hasText: 'Work' }).selectOption('Personal');

    // Should only see personal prompt
    await expect(sidepanelPage.getByText('Creative Writing Starter')).toBeVisible();
    await expect(sidepanelPage.getByText('Email Summary Template')).not.toBeVisible();

    // Reset to show all
    await sidepanelPage.locator('select').filter({ hasText: 'Personal' }).selectOption('');
    await expect(sidepanelPage.getByText('Email Summary Template')).toBeVisible();
    await expect(sidepanelPage.getByText('Creative Writing Starter')).toBeVisible();

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
    await expect(claudePage.getByText('Creative Writing Starter')).not.toBeVisible();

    // Clear search to see all prompts again
    await searchInput.clear();
    await expect(claudePage.getByText('Creative Writing Starter')).toBeVisible();

    // Select the email template prompt
    await claudePage.locator('.prompt-item').filter({ hasText: 'Email Summary Template' }).click();

    // Verify prompt is inserted into the editor
    const editor = claudePage.locator('.ProseMirror');
    await expect(editor).toContainText('Please summarize the key points from this email');

    // Verify prompt selector closes after insertion
    await expect(claudePage.getByText('Email Summary Template')).not.toBeVisible();

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
    await expect(chatgptPage.getByText('Email Summary Template')).not.toBeVisible();

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
    await expect(sidepanelPage.getByText('Email Summary Template')).toBeVisible();
    await expect(sidepanelPage.getByText('Creative Writing Starter')).toBeVisible();

    // Check categories are still available
    await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();
    await expect(sidepanelPage.getByText('3 categories')).toBeVisible();
    await expect(sidepanelPage.getByText('Work')).toBeVisible();
    await expect(sidepanelPage.getByText('Personal')).toBeVisible();
    await expect(sidepanelPage.getByText('Uncategorized')).toBeVisible();

    // Close category manager
    const closeButton2 = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M6 18L18 6M6 6l12 12"]') }).first();
    await closeButton2.click();

    // Step 9: Add one more prompt to verify iterative building
    // (Category manager already closed, so we're back in library view)
    await sidepanelPage.getByRole('button', { name: 'Add New Prompt' }).click();

    await sidepanelPage.getByLabel('Title (optional)').fill('Code Review Helper');
    await sidepanelPage.getByLabel('Content *').fill('Please review this code for:\n1. Best practices\n2. Potential bugs\n3. Performance improvements\n4. Security issues\n\nCode:\n[CODE_TO_REVIEW]');
    await sidepanelPage.getByLabel('Category').selectOption('Work');

    await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();

    await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();
    await expect(sidepanelPage.getByText('Code Review Helper')).toBeVisible();

    // Final verification: User now has a functional prompt library
    // - 3 categories (including default)
    // - 3 prompts across 2 custom categories
    // - Tested cross-platform integration
    // - Verified data persistence and filtering

    await expect(sidepanelPage.locator('article')).toHaveCount(3);

    // Verify category distribution
    await sidepanelPage.locator('select').filter({ hasText: 'All Categories' }).selectOption('Work');
    await expect(sidepanelPage.locator('article')).toHaveCount(2); // Email + Code Review

    await sidepanelPage.locator('select').filter({ hasText: 'Work' }).selectOption('Personal');
    await expect(sidepanelPage.locator('article')).toHaveCount(1); // Creative Writing
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

    const sidepanelPage = await context.newPage();
    await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);

    // Create a category and multiple prompts
    await sidepanelPage.getByRole('button', { name: 'Manage categories' }).click();
    await sidepanelPage.getByPlaceholder('Enter category name...').fill('Development');
    await sidepanelPage.getByRole('button', { name: 'Add' }).click();
    // Close category manager
    const closeButton3 = sidepanelPage.locator('button').filter({ has: sidepanelPage.locator('path[d="M6 18L18 6M6 6l12 12"]') }).first();
    await closeButton3.click();

    // Add multiple prompts with different keywords
    const prompts = [
      { title: 'JavaScript Debug Helper', content: 'Help me debug this JavaScript code' },
      { title: 'Python Code Review', content: 'Review this Python function for improvements' },
      { title: 'API Documentation', content: 'Create documentation for this API endpoint' }
    ];

    for (const prompt of prompts) {
      await sidepanelPage.getByRole('button', { name: 'Add New Prompt' }).click();
      await sidepanelPage.getByLabel('Title (optional)').fill(prompt.title);
      await sidepanelPage.getByLabel('Content *').fill(prompt.content);
      await sidepanelPage.getByLabel('Category').selectOption('Development');
      await sidepanelPage.getByRole('button', { name: 'Save Prompt' }).click();
      await expect(sidepanelPage.getByText('Prompt created successfully').first()).toBeVisible();
    }

    // Test search functionality
    await sidepanelPage.getByPlaceholder('Search your prompts...').fill('JavaScript');
    await expect(sidepanelPage.getByText('JavaScript Debug Helper')).toBeVisible();
    await expect(sidepanelPage.getByText('Python Code Review')).not.toBeVisible();
    await expect(sidepanelPage.getByText('API Documentation')).not.toBeVisible();

    // Search by title
    await sidepanelPage.getByPlaceholder('Search your prompts...').fill('Python');
    await expect(sidepanelPage.getByText('Python Code Review')).toBeVisible();
    await expect(sidepanelPage.getByText('JavaScript Debug Helper')).not.toBeVisible();

    // Search by content
    await sidepanelPage.getByPlaceholder('Search your prompts...').fill('documentation');
    await expect(sidepanelPage.getByText('API Documentation')).toBeVisible();
    await expect(sidepanelPage.getByText('JavaScript Debug Helper')).not.toBeVisible();

    // Clear search to show all
    await sidepanelPage.getByPlaceholder('Search your prompts...').fill('');
    await expect(sidepanelPage.locator('article')).toHaveCount(3);
  });
});

/**
 * Example of refactored E2E test using new POMs and utilities
 *
 * This file demonstrates how to refactor existing E2E tests to use the new
 * Page Object Models, utilities, and test data fixtures for better maintainability.
 */

import { test, expect } from '../fixtures/extension';
import {
  LibraryPage,
  CategoryManagerPage,
  PromptFormPage,
  workflows,
  assertions,
  TestDataManager,
  SCENARIO_FIXTURES
} from '../utils';

test.describe('Example: Refactored Category Management Tests', () => {
  let libraryPage: LibraryPage;
  let categoryManager: CategoryManagerPage;
  let promptForm: PromptFormPage;
  let testDataManager: TestDataManager;

  test.beforeEach(async ({ context, storage, extensionId }) => {
    // Initialize test data manager
    testDataManager = new TestDataManager(storage);

    // Seed with category management scenario
    await testDataManager.seedForCategoryTesting();

    // Open sidepanel and initialize page objects
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: 'domcontentloaded'
    });

    // Initialize Page Object Models
    libraryPage = new LibraryPage(page);
    categoryManager = new CategoryManagerPage(page);
    promptForm = new PromptFormPage(page);

    // Verify we're on the library page
    await libraryPage.expectLibraryLoaded();
  });

  test('should create a new category using POMs', async () => {
    // BEFORE (old approach):
    // await page.getByRole('button', { name: 'Manage categories' }).click();
    // await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();
    // await page.getByPlaceholder('Enter category name...').fill('New Category');
    // await page.getByRole('button', { name: 'Add' }).click();
    // await expect(page.getByText('Category created successfully')).toBeVisible();

    // AFTER (using POMs and workflows):
    await workflows.categories.create(libraryPage.page, { name: 'New Category' });

    // Verify category exists
    await categoryManager.openFromLibrary();
    await categoryManager.expectCategoryExists('New Category');
    await categoryManager.closeToLibrary();

    // Explicit assertion for linting
    await expect(libraryPage.page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  });

  test('should edit category name using POMs', async () => {
    // BEFORE (old approach):
    // Complex selector logic, hover states, input handling, etc.

    // AFTER (using POMs):
    await categoryManager.openFromLibrary();
    await categoryManager.editCategory('Work', 'Professional');
    await categoryManager.expectCategoryExists('Professional');
    await categoryManager.expectCategoryNotExists('Work');
    await categoryManager.closeToLibrary();

    // Explicit assertion for linting
    await expect(libraryPage.page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  });

  test('should delete category using POMs', async () => {
    // BEFORE (old approach):
    // More complex selector logic and confirmation handling

    // AFTER (using POMs):
    await categoryManager.openFromLibrary();
    await categoryManager.deleteCategory('Personal', true); // confirm deletion
    await categoryManager.expectCategoryNotExists('Personal');
    await categoryManager.closeToLibrary();

    // Explicit assertion for linting
    await expect(libraryPage.page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  });

  test('should handle category validation using utilities', async () => {
    await categoryManager.openFromLibrary();

    // Test duplicate category validation
    await categoryManager.testDuplicateValidation('Work');

    // Verify error message using assertions utility
    await assertions.categories.duplicateError(libraryPage.page);

    await categoryManager.closeToLibrary();

    // Explicit assertion for linting
    await expect(libraryPage.page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  });

  test('should create prompt in specific category using workflows', async () => {
    // BEFORE (old approach):
    // Manual navigation, form filling, validation, etc.

    // AFTER (using workflows):
    await workflows.prompts.create(libraryPage.page, {
      title: 'Test Prompt',
      content: 'This is a test prompt',
      category: 'Work'
    });

    // Verify prompt exists using assertions
    await assertions.prompts.exists(libraryPage.page, 'Test Prompt');

    // Explicit assertion for linting
    await expect(libraryPage.page.getByRole('heading', { name: 'Test Prompt' }).first()).toBeVisible();
  });

  test('should complete category reorganization workflow', async () => {
    // Complex workflow that was previously 50+ lines of code
    // Now simplified to a single workflow call:
    await workflows.userJourneys.categoryReorganization(libraryPage.page);

    // Verify final state
    await assertions.categories.exists(libraryPage.page, 'Professional');
    await assertions.categories.notExists(libraryPage.page, 'Work');

    // Explicit assertion for linting
    await expect(libraryPage.page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  });
});

test.describe('Example: Using Test Data Scenarios', () => {
  test('should work with power user scenario', async ({ context, storage, extensionId }) => {
    const testDataManager = new TestDataManager(storage);

    // Seed with power user data
    await testDataManager.seedForPowerUserTesting();

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: 'domcontentloaded'
    });

    const libraryPage = new LibraryPage(page);

    // Verify power user data is loaded - check actual count from fixture
    // Power user fixture has: 5 Work + 3 Development + 2 Marketing + 4 Research + 3 Personal = 17 prompts
    await libraryPage.expectPromptCount(17);

    // Test search functionality with known data
    await workflows.search.searchAndVerify(page, 'review', 3);

    // Clear search before testing category filtering
    await workflows.search.clearAllFilters(page);

    // Test category filtering - Development category has 3 prompts in the fixture
    await workflows.search.filterByCategoryAndVerify(page, 'Development', 3);

    // Explicit assertion for linting
    await expect(page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  });

  test('should work with edge case scenario', async ({ context, storage, extensionId }) => {
    const testDataManager = new TestDataManager(storage);

    // Seed with edge case data
    await testDataManager.seedForEdgeCaseTesting();

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: 'domcontentloaded'
    });

    const libraryPage = new LibraryPage(page);

    // Test UI handles edge cases properly - use more specific expectations
    // Check for the long title (will be truncated in UI)
    await expect(libraryPage.getPromptCard('Very Long Title That Tests The UI Layout And Text Wrapping Behavior In Various Screen Sizes')).toBeVisible();

    // Check for single character title using heading role with exact match
    await expect(page.getByRole('heading', { name: 'A', exact: true })).toBeVisible();

    // Check for special characters title
    await expect(libraryPage.getPromptCard('Special Characters: !@#$%^&*()')).toBeVisible();
  });
});

test.describe('Example: Navigation Utilities', () => {
  test('should navigate between views using utilities', async ({ context, extensionId }) => {
    // BEFORE (old approach):
    // Manual page.goto() calls, waitForSelector, etc.

    // AFTER (using navigation utilities):
    const page = await workflows.navigation.openSidepanel(context, extensionId);

    // Navigate to settings
    await workflows.navigation.toSettings(page);
    await assertions.navigation.onSettingsPage(page);

    // Navigate back to library
    await workflows.navigation.toLibrary(page);
    await assertions.navigation.onLibraryPage(page);

    // Explicit assertion for linting
    await expect(page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  });
});

/**
 * Benefits of the refactored approach:
 *
 * 1. **Reduced Code Duplication**:
 *    - Category creation went from 8+ lines to 1 line
 *    - Complex selector logic is centralized in POMs
 *
 * 2. **Improved Maintainability**:
 *    - UI changes only require updates in POMs
 *    - Test data is standardized and reusable
 *
 * 3. **Better Readability**:
 *    - Test intent is clearer with descriptive method names
 *    - Less boilerplate code in test files
 *
 * 4. **Enhanced Reusability**:
 *    - Workflows can be reused across multiple test files
 *    - Test scenarios are standardized
 *
 * 5. **Easier Debugging**:
 *    - Assertions provide clear error messages
 *    - POMs encapsulate waiting and error handling
 *
 * 6. **Type Safety**:
 *    - Full TypeScript support with proper typing
 *    - IDE autocomplete and error detection
 */
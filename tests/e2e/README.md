# E2E Testing Framework Documentation

This directory contains a comprehensive End-to-End (E2E) testing framework for the Claude UI Chrome extension, built with Playwright and organized using Page Object Models (POMs) and utility functions.

## 📁 Directory Structure

```
tests/e2e/
├── pages/              # Page Object Models
├── utils/              # Utility functions and helpers
├── fixtures/           # Test data and browser fixtures
├── examples/           # Example refactored tests
├── smoke/              # Basic smoke tests
├── sidepanel/          # Component-specific tests
├── content/            # Content script tests
└── user-journeys/      # End-to-end user workflow tests
```

## 🏗️ Architecture Overview

### Page Object Models (POMs)

Page Object Models encapsulate UI interactions and provide clean, reusable methods for testing:

- **`BasePage`** - Common functionality shared across all pages
- **`LibraryPage`** - Main prompt library interface
- **`CategoryManagerPage`** - Category CRUD operations
- **`PromptFormPage`** - Prompt creation and editing
- **`SettingsPage`** - Settings and configuration
- **`ConfirmationDialog`** - Modal confirmations and dialogs

### Utility Functions

Centralized utilities reduce code duplication and improve maintainability:

- **`selectors.ts`** - Common CSS selectors and locator patterns
- **`assertions.ts`** - Reusable assertion functions
- **`workflows.ts`** - Complete user workflow functions
- **`navigation.ts`** - Navigation between pages and contexts
- **`enhanced-storage.ts`** - Advanced test data management

### Test Data Fixtures

Standardized test data for consistent testing:

- **`test-data.ts`** - Predefined prompt and category fixtures; `CATEGORY_COLORS` are the values of `PRESET_COLORS` (`src/constants/colors.ts`), the Category colors of the extension
- **`SCENARIO_FIXTURES`** - Complete test scenarios
- **`TestDataManager`** - Advanced data seeding utilities

## 🚀 Quick Start Guide

### Basic Test Setup

```typescript
import { test } from '../fixtures/extension';
import { LibraryPage, TestDataManager, workflows } from '../utils';

test('example test', async ({ context, storage, extensionId }) => {
  // Seed test data
  const testDataManager = new TestDataManager(storage);
  await testDataManager.seedForBasicTesting();

  // Open extension and initialize POM
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
  const libraryPage = new LibraryPage(page);

  // Use workflow functions
  await workflows.prompts.create(page, {
    title: 'Test Prompt',
    content: 'Test content',
    category: 'Work'
  });
});
```

### Using Page Object Models

```typescript
// BEFORE: Direct page interactions
await page.getByTestId('tab-categories').click();
await expect(page.getByRole('heading', { level: 1, name: 'Categories', exact: true })).toBeVisible();

// AFTER: Using POMs
const categoryManager = new CategoryManagerPage(page);
await categoryManager.openFromLibrary();
```

### Using Workflow Functions

```typescript
// BEFORE: Manual step-by-step interactions
await page.getByRole('button', { name: 'Add new prompt' }).click();
await page.getByLabel('Title').fill('My Prompt');
await page.getByLabel('Content').fill('Prompt content');
await page.getByRole('button', { name: 'Save' }).click();

// AFTER: Using workflows
await workflows.prompts.create(page, {
  title: 'My Prompt',
  content: 'Prompt content'
});
```

## 📊 Test Data Management

### Predefined Scenarios

```typescript
import { TestDataManager, SCENARIO_FIXTURES } from '../utils';

// Available scenarios
await testDataManager.seedScenario('NEW_USER');        // Empty state
await testDataManager.seedScenario('BASIC_USER');      // Basic prompts
await testDataManager.seedScenario('POWER_USER');      // Comprehensive data
await testDataManager.seedScenario('SEARCH_FOCUSED');  // Search testing
await testDataManager.seedScenario('EDGE_CASES');      // UI limits testing
```

### Custom Data Generation

```typescript
// Create specific counts
await testDataManager.seedWithCount(25, 5); // 25 prompts, 5 categories

// Use predefined fixtures
await testDataManager.seedWithPresets({
  promptSet: 'POWER_USER',
  categorySet: 'COMPREHENSIVE'
});

// Specialized scenarios
await testDataManager.seedForCategoryTesting();
await testDataManager.seedForSearchTesting();
```

## 🔧 Available Utilities

### Assertions

```typescript
import { assertions } from '../utils';

// Prompt assertions
await assertions.prompts.exists(page, 'My Prompt');
await assertions.prompts.count(page, 5);
await assertions.prompts.createdSuccessfully(page);

// Category assertions
await assertions.categories.exists(page, 'Work');
await assertions.categories.duplicateError(page);

// Navigation assertions
await assertions.navigation.onLibraryPage(page);
await assertions.navigation.categoryManagerOpen(page);
```

### Workflows

```typescript
import { workflows } from '../utils';

// Prompt workflows
await workflows.prompts.create(page, promptData);
await workflows.prompts.edit(page, 'Old Title', updates);
await workflows.prompts.delete(page, 'Title to Delete');

// Category workflows
await workflows.categories.create(page, { name: 'New Category' });
await workflows.categories.edit(page, 'Old Name', 'New Name');

// Search workflows
await workflows.search.searchAndVerify(page, 'query', expectedCount);
await workflows.search.filterByCategoryAndVerify(page, 'Work', 5);

// Complex user journeys
await workflows.userJourneys.newUserSetup(page);
await workflows.userJourneys.powerUserBulkOperations(page, promptTitles);
```

### Navigation

```typescript
import { navigation } from '../utils';

// Extension navigation
const page = await navigation.extension.openSidepanel(context, extensionId);
await navigation.extension.openPopup(context, extensionId);

// Settings navigation
await navigation.settings.openSettings(page);
await navigation.settings.backToLibrary(page);

// Modal navigation
await navigation.modals.openCategoryManager(page);
await navigation.modals.closeModal(page);
```

## 📝 Writing Tests

### Best Practices

1. **Use Page Object Models** for UI interactions
2. **Use Workflows** for complete user actions
3. **Use Assertions** for verifications
4. **Seed appropriate test data** for your scenario
5. **Keep tests focused** on single responsibilities

### Test Structure Template

```typescript
import { test } from '../fixtures/extension';
import { LibraryPage, TestDataManager, workflows, assertions } from '../utils';

test.describe('Feature Name', () => {
  let libraryPage: LibraryPage;
  let testDataManager: TestDataManager;

  test.beforeEach(async ({ context, storage, extensionId }) => {
    // Initialize test data
    testDataManager = new TestDataManager(storage);
    await testDataManager.seedForBasicTesting();

    // Setup page objects
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
    libraryPage = new LibraryPage(page);
  });

  test('should perform specific action', async () => {
    // Arrange - any additional setup

    // Act - perform the action
    await workflows.prompts.create(libraryPage.page, testData);

    // Assert - verify the result
    await assertions.prompts.exists(libraryPage.page, 'Test Prompt');
  });
});
```

## 🐧 Running a spec like Linux CI

Linux CI renders DejaVu Sans, which is wider than the Mac fonts: a title that fits on the Mac can wrap or be cut on CI, so a layout assertion passes locally and fails there. When a spec that checks layout (a size, a position, a line count, a cut title) fails on CI only, reproduce it with:

```bash
npm run test:e2e:linux -- tests/e2e/library/card-preview.spec.ts
```

It needs Docker (Docker Desktop, or colima). It runs the committed HEAD, not your working tree, so commit first; in the Playwright noble image whose tag is the `@playwright/test` version of `package.json`, with DejaVu fonts installed, `CI=true` and no retries. Options after the spec go to `playwright test` (`--grep`, `--repeat-each`). Failure screenshots and traces land in `test-results-linux/`. The first run downloads the image, the npm packages and Chromium, a few minutes; later runs reuse them.

## 📸 Proof screenshots

A spec that takes proof screenshots for a pull request passes `animations: 'disabled'` to `page.screenshot()`, or the picture can catch a transition halfway (a tab still highlighted, an icon mid-fade). It writes them under `test-results/<topic>/` (`const SCREENSHOT_DIR = 'test-results/<topic>'`), as `<name>-light.png` and `<name>-dark.png`; `scripts/pr-assets.sh <topic> test-results/<topic>/*.png` pushes them and prints the markdown for the pull request.

## 🎯 Migration Guide

### Refactoring Existing Tests

1. **Replace direct page interactions** with POM methods
2. **Extract repeated workflows** into utility functions
3. **Use standardized test data** instead of inline creation
4. **Replace manual assertions** with utility functions

### Example Refactoring

**Before:**
```typescript
test('create category', async ({ page }) => {
  await page.getByTestId('tab-categories').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Categories', exact: true })).toBeVisible();
  await page.getByPlaceholder('Enter category name...').fill('Test Category');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Category created successfully')).toBeVisible();
  const libraryTab = page.getByTestId('tab-library');
  await libraryTab.click();
});
```

**After:**
```typescript
test('create category', async ({ page }) => {
  await workflows.categories.create(page, { name: 'Test Category' });
});
```

## 🚦 Testing Scenarios

### Smoke Tests
Quick validation of core functionality:
- Extension loads properly
- Basic UI elements are present
- Core workflows work

### Component Tests
Focused testing of specific components:
- Category management
- Prompt forms
- Settings pages

### User Journey Tests
End-to-end workflows:
- New user onboarding
- Power user bulk operations
- Category reorganization

### Content Script Tests
Platform integration testing:
- Claude.ai integration
- ChatGPT integration
- Generic site compatibility

## 📚 API Reference

### Page Object Models

#### LibraryPage
- `navigateToSettings()` - Navigate to settings
- `searchPrompts(query)` - Search for prompts
- `expectPromptCount(count)` - Verify prompt count
- `clickAddNewPrompt()` - Open prompt creation form

#### CategoryManagerPage
- `createCategory(name, color?)` - Create new category
- `editCategory(current, new)` - Edit category name
- `deleteCategory(name, confirm?)` - Delete category
- `expectCategoryExists(name)` - Verify category exists

#### PromptFormPage
- `createPrompt(data)` - Create complete prompt
- `editPrompt(updates)` - Edit existing prompt
- `expectCreateMode()` - Verify form is in create mode
- `expectEditMode()` - Verify form is in edit mode

### Workflow Functions

#### Prompt Workflows
- `workflows.prompts.create(page, data)` - Complete prompt creation
- `workflows.prompts.edit(page, title, updates)` - Edit prompt workflow
- `workflows.prompts.delete(page, title, confirm?)` - Delete prompt workflow

#### Category Workflows
- `workflows.categories.create(page, data)` - Complete category creation
- `workflows.categories.edit(page, current, new)` - Edit category workflow
- `workflows.categories.delete(page, name, confirm?)` - Delete category workflow

### Test Data Management

#### TestDataManager
- `seedScenario(name)` - Seed predefined scenario
- `seedWithCount(prompts, categories)` - Generate specific counts
- `seedForCategoryTesting()` - Seed for category tests
- `seedForSearchTesting()` - Seed for search tests
- `addPrompts(prompts)` - Add to existing data
- `verifyStorageContents(expected)` - Validate storage state

## 🔍 Debugging Tips

1. **Use browser dev tools** in headed mode for debugging
2. **Add `await page.pause()`** to inspect state during test execution
3. **Check test data** with `testDataManager.getStorageStats()`
4. **Use specific assertions** for clearer error messages
5. **Run single tests** with `.only` for focused debugging

## 📈 Benefits

This framework provides:

- **🔧 Maintainability**: Centralized selectors and workflows
- **🔄 Reusability**: Shared POMs and utilities across tests
- **📖 Readability**: Clear, descriptive test code
- **🛡️ Reliability**: Consistent patterns and error handling
- **⚡ Productivity**: Faster test development with utilities
- **🎯 Coverage**: Comprehensive test scenarios and data fixtures

## 🤝 Contributing

When adding new tests or utilities:

1. Follow existing patterns and naming conventions
2. Add TypeScript types for new interfaces
3. Update this documentation for new features
4. Create examples for complex new functionality
5. Test utilities thoroughly before integration
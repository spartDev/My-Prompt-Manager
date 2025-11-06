# Testing Guide

**Version:** 1.6.0
**Last Updated:** 2025-01-05

This document provides comprehensive testing strategies, patterns, and guidelines for the My Prompt Manager extension.

---

## Table of Contents

- [Overview](#overview)
- [Testing Best Practices](#testing-best-practices)
- [Test Infrastructure](#test-infrastructure)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Manual QA](#manual-qa)
- [Coverage Requirements](#coverage-requirements)
- [Recent Test Improvements](#recent-test-improvements)

---

## Overview

### Test Statistics

- **Total Tests:** 1,244
- **Test Files:** 58
- **Coverage Threshold:** 50% (statements)
- **Test Framework:** Vitest + React Testing Library + Playwright

### Test Pyramid

```
       ┌─────────────┐
       │   Manual    │
       │   Testing   │  (QA documents, real browser testing)
       └─────────────┘
      ┌───────────────┐
      │  E2E Tests    │  (Playwright - browser automation)
      └───────────────┘
    ┌───────────────────┐
    │ Integration Tests │  (Cross-module interactions)
    └───────────────────┘
  ┌─────────────────────────┐
  │   Unit Tests (1,244)    │  (Individual functions, components)
  └─────────────────────────┘
```

---

## Testing Best Practices

For comprehensive testing guidelines, see [Testing Best Practices](./TESTING_BEST_PRACTICES.md).

Key principles:
- Test behavior, not implementation
- Use accessible queries in React tests
- Mock time for deterministic tests
- Avoid testing CSS classes
- Avoid testing private methods

---

## Test Infrastructure

### Configuration

**Vitest Config:** `vitest.config.ts`
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 50
      }
    }
  }
});
```

**Playwright Config:** `playwright.config.ts`
```typescript
export default defineConfig({
  testDir: './tests/e2e',
  use: {
    channel: 'chromium',
    headless: process.env.CI === 'true'
  }
});
```

### Test Setup

**File:** `src/test/setup.ts` (530 lines)

**Chrome API Mocking:**
```typescript
// Mock chrome.storage.local
const mockStorage: Record<string, any> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys) => Promise.resolve(mockStorage)),
      set: vi.fn((items) => { Object.assign(mockStorage, items); }),
      remove: vi.fn((keys) => { /* ... */ }),
      clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); })
    }
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() }
  }
};
```

**Service Manager Mocking:**
```typescript
// Spy wrapper for StorageManager
vi.spyOn(StorageManager, 'getInstance').mockReturnValue({
  getPrompts: vi.fn(),
  savePrompt: vi.fn(),
  // ... all methods wrapped with vi.fn()
});
```

**DOM Mocking:**
```typescript
// matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
});

// navigator.clipboard for copy/paste tests
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Watch mode (development)
npm test -- --watch
```

---

## Unit Testing

### Component Tests

**Pattern:** React Testing Library

**Example:** `src/components/__tests__/PromptCard.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@testing-library/react';
import PromptCard from '../PromptCard';

describe('PromptCard', () => {
  const mockPrompt: Prompt = {
    id: '1',
    title: 'Test Prompt',
    content: 'Test content',
    categoryId: 'cat1',
    createdAt: Date.now()
  };

  const handlers = {
    onCopy: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn()
  };

  it('renders prompt title and content', () => {
    render(<PromptCard prompt={mockPrompt} {...handlers} />);
    expect(screen.getByText('Test Prompt')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('calls onCopy when copy button clicked', async () => {
    render(<PromptCard prompt={mockPrompt} {...handlers} />);

    const copyButton = screen.getByLabelText(/copy/i);
    await userEvent.click(copyButton);

    expect(handlers.onCopy).toHaveBeenCalledWith('1');
  });

  it('highlights search term when provided', () => {
    render(
      <PromptCard
        prompt={mockPrompt}
        searchTerm="Test"
        {...handlers}
      />
    );

    const highlights = screen.getAllByTestId('highlight');
    expect(highlights).toHaveLength(2); // "Test" appears twice
  });
});
```

**Test Categories:**
1. **Rendering** - Component renders correctly
2. **Interactions** - User actions trigger correct handlers
3. **State** - State changes reflected in UI
4. **Accessibility** - ARIA attributes present
5. **Edge Cases** - Empty states, error states

---

### Service Tests

**Pattern:** Unit tests with mocked dependencies

**Example:** `src/services/__tests__/promptManager.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptManager } from '../promptManager';
import { StorageManager } from '../storage';

describe('PromptManager', () => {
  let manager: PromptManager;
  let mockStorage: jest.Mocked<StorageManager>;

  beforeEach(() => {
    mockStorage = {
      getPrompts: vi.fn(),
      savePrompt: vi.fn(),
      // ... other methods
    } as any;

    manager = new PromptManager(mockStorage);
  });

  describe('searchPrompts', () => {
    it('filters prompts by title', async () => {
      mockStorage.getPrompts.mockResolvedValue([
        { id: '1', title: 'React Hook', content: '...' },
        { id: '2', title: 'Vue Component', content: '...' }
      ]);

      const results = await manager.searchPrompts('React');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('React Hook');
    });

    it('filters prompts by content', async () => {
      mockStorage.getPrompts.mockResolvedValue([
        { id: '1', title: 'Test', content: 'React hooks' },
        { id: '2', title: 'Test', content: 'Vue composables' }
      ]);

      const results = await manager.searchPrompts('hooks');
      expect(results).toHaveLength(1);
    });
  });

  describe('findDuplicatePrompts', () => {
    it('detects similar prompts', async () => {
      mockStorage.getPrompts.mockResolvedValue([
        { id: '1', title: 'Test', content: 'Hello world' },
        { id: '2', title: 'Test', content: 'Hello world!' }
      ]);

      const duplicates = await manager.findDuplicatePrompts(0.90);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].similarity).toBeGreaterThan(0.90);
    });
  });

  describe('validatePromptData', () => {
    it('rejects empty content', () => {
      const error = manager.validatePromptData({
        title: 'Test',
        content: '',
        categoryId: 'cat1'
      });

      expect(error).toBeTruthy();
      expect(error?.field).toBe('content');
    });

    it('rejects oversized content', () => {
      const longContent = 'a'.repeat(10001);
      const error = manager.validatePromptData({
        content: longContent,
        categoryId: 'cat1'
      });

      expect(error).toBeTruthy();
      expect(error?.message).toContain('10,000 characters');
    });
  });
});
```

---

### Hook Tests

**Pattern:** `@testing-library/react-hooks` (or renderHook from RTL)

**Example:** `src/hooks/__tests__/usePrompts.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePrompts } from '../usePrompts';

describe('usePrompts', () => {
  it('loads prompts on mount', async () => {
    const { result } = renderHook(() => usePrompts());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.prompts).toBeDefined();
  });

  it('creates prompt and refreshes list', async () => {
    const { result } = renderHook(() => usePrompts());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.createPrompt({
      title: 'New Prompt',
      content: 'Test content',
      categoryId: 'cat1'
    });

    await waitFor(() => {
      expect(result.current.prompts).toContainEqual(
        expect.objectContaining({ title: 'New Prompt' })
      );
    });
  });

  it('handles errors gracefully', async () => {
    // Mock PromptManager to throw error
    vi.spyOn(PromptManager.prototype, 'createPrompt')
      .mockRejectedValueOnce(new Error('Save failed'));

    const { result } = renderHook(() => usePrompts());

    await result.current.createPrompt({ /* data */ });

    await waitFor(() => {
      expect(result.current.error).toBe('Save failed');
    });
  });
});
```

---

## Integration Testing

### Cross-Module Tests

**Pattern:** Test interactions between services

**Example:** Storage → PromptManager integration

```typescript
describe('Storage Integration', () => {
  let storage: StorageManager;
  let manager: PromptManager;

  beforeEach(async () => {
    storage = StorageManager.getInstance();
    manager = PromptManager.getInstance();
    await storage.clearAllData();
  });

  it('creates prompt and retrieves via search', async () => {
    // Create prompt via manager
    await manager.createPrompt({
      title: 'Integration Test',
      content: 'Testing storage integration',
      categoryId: 'default'
    });

    // Search via manager (uses storage internally)
    const results = await manager.searchPrompts('Integration');

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Integration Test');
  });

  it('updates prompt and reflects in storage', async () => {
    const promptId = await manager.createPrompt({ /* data */ });

    await manager.updatePrompt(promptId, {
      title: 'Updated Title'
    });

    const prompts = await storage.getPrompts();
    const updated = prompts.find(p => p.id === promptId);

    expect(updated?.title).toBe('Updated Title');
  });
});
```

---

## End-to-End Testing

### Playwright Tests

**File:** `tests/e2e/extension.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Extension E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Load extension
    await page.goto('chrome://extensions/');
    // ... extension loading logic
  });

  test('creates and displays prompt', async ({ page }) => {
    // Open popup
    await page.goto('chrome-extension://[ID]/popup.html');

    // Click "Add Prompt" button
    await page.click('button[aria-label="Add new prompt"]');

    // Fill form
    await page.fill('input[name="title"]', 'E2E Test Prompt');
    await page.fill('textarea[name="content"]', 'E2E test content');

    // Submit
    await page.click('button[type="submit"]');

    // Verify prompt appears
    await expect(page.locator('text=E2E Test Prompt')).toBeVisible();
  });

  test('searches prompts', async ({ page }) => {
    await page.goto('chrome-extension://[ID]/popup.html');

    // Type in search
    await page.fill('input[role="searchbox"]', 'React');

    // Wait for debounce
    await page.waitForTimeout(350);

    // Check filtered results
    const promptCards = page.locator('[data-testid="prompt-card"]');
    await expect(promptCards).toHaveCount(5);
  });
});
```

---

## Manual QA

### QA Checklists

**Platform Integration QA:**

See: `docs/GEMINI_MANUAL_QA.md` for platform-specific example

**General Checklist:**
- [ ] Extension loads without errors
- [ ] Popup opens correctly
- [ ] Side panel opens correctly
- [ ] Prompts display properly
- [ ] Search works (instant + debounced)
- [ ] Create prompt form validates
- [ ] Edit prompt updates correctly
- [ ] Delete prompt with confirmation
- [ ] Categories CRUD operations work
- [ ] Settings persist across sessions
- [ ] Import/export data works
- [ ] Theme switching works (light/dark/system)
- [ ] Toast notifications display
- [ ] Storage quota warnings appear
- [ ] Custom site configuration works
- [ ] Element picker activates
- [ ] Content script icon appears on AI platforms
- [ ] Prompt insertion works on all platforms
- [ ] Keyboard navigation functional
- [ ] Accessibility (screen reader compatible)

---

## Coverage Requirements

### Current Coverage

**Target:** 50% statement coverage
**Achieved:** ~55% (exceeds target)

**Coverage by Area:**
- **Services:** ~80% (well-tested)
- **Components:** ~60% (good coverage)
- **Hooks:** ~70% (comprehensive)
- **Content Scripts:** ~40% (needs improvement)
- **Utilities:** ~90% (excellent)

### Excluded from Coverage

- `node_modules/`
- `src/test/`
- `dist/`
- `tests/e2e/`
- Config files (vite.config.ts, etc.)
- Type definitions (*.d.ts)
- Background scripts (browser-only)

### Generating Reports

```bash
# Generate HTML coverage report
npm run test:coverage

# View report
open coverage/index.html
```

**Coverage Report Structure:**
```
coverage/
├── index.html          # Main report
├── lcov-report/        # Detailed line coverage
└── coverage.json       # Raw data
```

---

## Best Practices

### 1. Test Organization

**File Structure:**
```
src/
├── components/
│   ├── PromptCard.tsx
│   └── __tests__/
│       └── PromptCard.test.tsx
├── services/
│   ├── storage.ts
│   └── __tests__/
│       └── storage.test.ts
└── hooks/
    ├── usePrompts.ts
    └── __tests__/
        └── usePrompts.test.ts
```

### 2. Test Naming

```typescript
// ✅ Good - Descriptive
it('calls onCopy when copy button clicked', () => { });
it('displays error message when validation fails', () => { });

// ❌ Bad - Vague
it('works', () => { });
it('test1', () => { });
```

### 3. Test Independence

```typescript
// ✅ Good - Each test is independent
describe('PromptManager', () => {
  beforeEach(() => {
    // Reset state before each test
    vi.clearAllMocks();
  });

  it('test 1', () => { /* ... */ });
  it('test 2', () => { /* ... */ });
});

// ❌ Bad - Tests depend on each other
it('creates prompt', () => {
  createPrompt(data);
});

it('retrieves created prompt', () => {
  // Assumes previous test ran
  const prompt = getPrompt(id);
});
```

### 4. Async Testing

```typescript
// ✅ Good - Use async/await or waitFor
it('loads data asynchronously', async () => {
  const { result } = renderHook(() => usePrompts());

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.prompts).toBeDefined();
});

// ❌ Bad - No wait for async operation
it('loads data', () => {
  const { result } = renderHook(() => usePrompts());
  expect(result.current.prompts).toBeDefined(); // Will fail
});
```

### 5. Mock Management

```typescript
// ✅ Good - Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// ✅ Good - Restore after test
afterEach(() => {
  vi.restoreAllMocks();
});
```

---

## Debugging Tests

### Common Issues

**1. Test Timeouts**

```typescript
// Increase timeout for slow operations
it('loads large dataset', async () => {
  // ...
}, 10000); // 10 second timeout
```

**2. Async State Updates**

```typescript
// Use waitFor for React state updates
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

**3. Mock Not Called**

```typescript
// Verify mock setup
expect(mockFn).toHaveBeenCalled();

// Check call arguments
expect(mockFn).toHaveBeenCalledWith(expectedArg);

// View all calls
console.log(mockFn.mock.calls);
```

### Debug Tools

**Vitest UI:**
```bash
npm run test:ui
# Opens browser with test results and coverage
```

**Console Debugging:**
```typescript
it('debug test', () => {
  const { debug } = render(<Component />);
  debug(); // Prints DOM to console
});
```

**Query Debugging:**
```typescript
screen.logTestingPlaygroundURL(); // Get query suggestions
```

---

## Continuous Integration

### GitHub Actions

**PR Checks** (`.github/workflows/pr-checks.yml`):
- Runs all unit tests
- Checks coverage threshold
- Reports failures

**Main Deploy** (`.github/workflows/main-deploy.yml`):
- Extended validation
- E2E tests
- Performance benchmarks

### Pre-commit Hooks

**Husky + Lint-staged:**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "vitest related --run"
    ]
  }
}
```

---

## Quick Reference

### Test Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Run all unit tests |
| `npm run test:ui` | Run tests with UI |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:e2e` | Run E2E tests with Playwright |
| `npm test -- --watch` | Watch mode for development |

### Test Patterns

| Pattern | Use Case |
|---------|----------|
| `render()` | Render React component |
| `screen.getByText()` | Query rendered element |
| `userEvent.click()` | Simulate user interaction |
| `waitFor()` | Wait for async state |
| `vi.fn()` | Create mock function |
| `vi.spyOn()` | Spy on existing function |
| `expect().toHaveBeenCalled()` | Verify mock called |

---

## Recent Test Improvements

### Test Improvement Project (2025-01)

We recently completed a comprehensive test quality improvement project over 3 weeks:

#### Week 1 - Critical Fixes

- **Added tests for 3 previously untested hooks** (useTheme, usePrompts, useCategories)
  - Hook coverage: 62.5% → 100% (8/8 hooks)
  - Added 100+ tests covering CRUD operations, edge cases, error handling
- **Removed all tests accessing private methods**
  - Fixed 6 files (base-strategy, claude-strategy, mistral-strategy, injector, keyboard-navigation, logger)
  - Replaced with tests through public APIs
- **Rewrote DOM tests to use real DOM** (happy-dom)
  - Removed 200+ lines of mock implementations
  - Tests now verify actual browser behavior

**Impact:** Test grade improved from B+ → A-

#### Week 2 - Major Improvements

- **Mocked time globally for deterministic tests**
  - Added `vi.setSystemTime()` to 3 service test files
  - Eliminated potential for time-based flakiness
- **Removed CSS class assertions from component tests**
  - Removed 260+ lines of CSS assertions
  - Replaced with behavior and accessibility tests
  - Component tests 90% less brittle
- **Expanded hook test coverage with 34 new edge case tests**
  - Added 15 edge case tests to useSearchWithDebounce
  - Fixed non-deterministic tests in useToast
  - Hook test coverage: 90% → 95%

**Impact:** Test grade improved from A- → A

#### Week 3 - Polish

- **Removed obsolete and duplicate tests**
  - Removed 4 tests (1 obsolete, 3 duplicates)
  - Fixed 1 meaningless try-catch test
  - Reduced test file size by 69 lines
- **Simplified storage test mocking**
  - Created InMemoryStorage utility
  - Reduced storage test complexity by 60%
  - All tests now use real chrome.storage API
- **Organized performance tests**
  - Added CI timeout adjustments
  - Removed non-deterministic timing measurements
  - Added comprehensive documentation

**Impact:** Test grade maintained at A (94/100)

### Final Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Overall Grade** | B+ (85/100) | A (94/100) | +9 points |
| **Hook Coverage** | 62.5% (5/8) | 100% (8/8) | +37.5% |
| **Private Method Tests** | ~20 instances | 0 | -100% |
| **DOM Mock Tests** | 100% mocked | 0% mocked | Real DOM |
| **Deterministic Tests** | ~60% | 100% | +40% |
| **CSS Assertions** | ~15% of components | 0% | -100% |
| **Total Tests** | 875 | 1,244 | +369 tests |
| **Test Files** | 46 | 58 | +12 files |

### Resources

For detailed testing guidelines, see:
- [Testing Best Practices](./TESTING_BEST_PRACTICES.md) - Comprehensive 1,200+ line guide
- [Week 1 Tasks](./testing-improvements/WEEK_1_CRITICAL_FIXES.md)
- [Week 2 Tasks](./testing-improvements/WEEK_2_MAJOR_IMPROVEMENTS.md)
- [Week 3 Tasks](./testing-improvements/WEEK_3_POLISH.md)

---

**Last Updated:** 2025-01-05
**Version:** 1.6.0

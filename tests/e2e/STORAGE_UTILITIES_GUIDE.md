# E2E Storage Utilities Guide

This document clarifies the organization and responsibilities of storage-related utilities in the E2E test framework.

## Overview

The storage functionality is split across two files with distinct responsibilities:

1. **`fixtures/extension.ts`** - Low-level Chrome API wrapper (ExtensionStorage)
2. **`utils/storage.ts`** - High-level test data helpers

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Files (.spec.ts)                    │
│                                                               │
│  Uses: seedLibrary(), createPromptSeed(), createCategorySeed()│
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              utils/storage.ts (High-Level)                   │
│                                                               │
│  • seedLibrary() - Main seeding function                     │
│  • createPromptSeed() - Prompt factory                       │
│  • createCategorySeed() - Category factory                   │
│  • ensureDefaultCategory() - Business logic                  │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           fixtures/extension.ts (Low-Level)                  │
│                                                               │
│  ExtensionStorage interface:                                 │
│  • seed() - Raw storage write                                │
│  • reset() - Clear all data                                  │
│  • get() - Raw storage read                                  │
│  • seedPrompts() - Direct prompt write                       │
│  • seedCategories() - Direct category write                  │
│  • seedSettings() - Direct settings write                    │
│  • getPrompts() - Read prompts                               │
│  • getCategories() - Read categories                         │
│  • getSettings() - Read settings                             │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Chrome Extension Storage API                    │
│                                                               │
│  chrome.storage.local.get() / set() / clear()                │
└─────────────────────────────────────────────────────────────┘
```

---

## File 1: `fixtures/extension.ts` (Low-Level)

**Purpose**: Direct Chrome storage API wrapper with Playwright evaluation context

### Responsibilities

1. **Chrome API Communication**
   - Executes storage operations in the extension's background context
   - Handles async Chrome API callbacks
   - Normalizes error handling
   - Ensures storage readiness before operations

2. **Background Target Management**
   - Locates and connects to the extension's service worker or background page
   - Handles CI-specific timing and retry logic
   - Provides extended timeouts for CI environments

3. **Raw Storage Operations**
   - `reset()`: Clears all storage (chrome.storage.local.clear)
   - `seed(data)`: Writes arbitrary key-value data to storage
   - `get(keys)`: Reads arbitrary keys from storage

4. **Typed Convenience Methods**
   - `seedPrompts()`: Direct write to 'prompts' key
   - `seedCategories()`: Direct write to 'categories' key
   - `seedSettings()`: Direct write to 'settings' key
   - `getPrompts()`: Read 'prompts' key with type safety
   - `getCategories()`: Read 'categories' key with type safety
   - `getSettings()`: Read 'settings' key with type safety

### Key Implementation Details

```typescript
// ExtensionStorage interface exported from this file
export type ExtensionStorage = {
  reset: () => Promise<void>;
  seed: (data: Record<string, unknown>) => Promise<void>;
  seedPrompts: (prompts: Prompt[]) => Promise<void>;
  seedCategories: (categories: Category[]) => Promise<void>;
  seedSettings: (settings: Settings) => Promise<void>;
  get: <T = Record<string, unknown>>(keys?: string | string[]) => Promise<T>;
  getPrompts: () => Promise<Prompt[]>;
  getCategories: () => Promise<Category[]>;
  getSettings: () => Promise<Settings | undefined>;
};
```

### When to Use Directly

**✅ Use `ExtensionStorage` methods directly when:**
- Reading storage during test assertions
- Testing storage edge cases or corruption
- Verifying data persistence after operations
- Implementing custom seeding patterns

**❌ Do NOT use for normal test seeding:**
- Use `seedLibrary()` from `utils/storage.ts` instead
- Direct methods skip important business logic (like default category)

---

## File 2: `utils/storage.ts` (High-Level)

**Purpose**: Business-logic-aware test data helpers and seeding utilities

### Responsibilities

1. **Test Data Factories**
   - `createPromptSeed()`: Creates valid Prompt objects with defaults
   - `createCategorySeed()`: Creates valid Category objects with defaults

2. **Business Logic**
   - `ensureDefaultCategory()`: Guarantees "Uncategorized" category exists
   - Applies correct data structure expectations
   - Handles data relationships (e.g., prompts need valid categories)

3. **High-Level Seeding**
   - `seedLibrary()`: Main entry point for test data setup
   - Combines prompts, categories, and settings
   - Applies business rules before storage

### Key Implementation Details

```typescript
// Factory functions - create valid test data
export const createPromptSeed = (overrides: Partial<Prompt>): Prompt => {
  const now = Date.now();
  return {
    id: overrides.id ?? `prompt-${Math.random().toString(36).slice(2, 10)}`,
    title: overrides.title ?? 'Sample Prompt',
    content: overrides.content ?? 'Sample prompt content',
    category: overrides.category ?? DEFAULT_CATEGORY,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
};

export const createCategorySeed = (overrides: Partial<Category>): Category => ({
  id: overrides.id ?? `category-${Math.random().toString(36).slice(2, 10)}`,
  name: overrides.name ?? DEFAULT_CATEGORY,
  color: overrides.color,
});

// Business logic - ensures default category always exists
const ensureDefaultCategory = (categories: Category[]): Category[] => {
  const hasDefault = categories.some((category) => category.name === DEFAULT_CATEGORY);
  return hasDefault
    ? categories
    : [{ id: 'default-category', name: DEFAULT_CATEGORY }, ...categories];
};

// High-level seeding - the main entry point for tests
export const seedLibrary = async (
  storage: ExtensionStorage,
  options: SeedOptions = {}
): Promise<void> => {
  const categories = ensureDefaultCategory(options.categories ?? []);
  const prompts = options.prompts ?? [];
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    interfaceMode: 'popup',
    ...options.settings,
  };

  await storage.seed({
    prompts,
    categories,
    settings,
    interfaceMode: options.interfaceMode ?? settings.interfaceMode,
  });
};
```

### When to Use

**✅ Always use `seedLibrary()` for test setup:**
```typescript
await seedLibrary(storage, {
  prompts: [
    createPromptSeed({ title: 'Test', content: 'Content', category: 'Work' })
  ],
  categories: [
    createCategorySeed({ name: 'Work', color: '#3B82F6' })
  ],
  settings: {
    ...DEFAULT_SETTINGS,
    interfaceMode: 'sidepanel'
  }
});
```

**✅ Use factory functions for creating test data:**
```typescript
const testPrompts = [
  createPromptSeed({ title: 'Prompt 1', content: 'Content 1', category: 'Work' }),
  createPromptSeed({ title: 'Prompt 2', content: 'Content 2', category: 'Personal' })
];

const testCategories = [
  createCategorySeed({ name: 'Work', color: '#3B82F6' }),
  createCategorySeed({ name: 'Personal', color: '#10B981' })
];

await seedLibrary(storage, {
  prompts: testPrompts,
  categories: testCategories
});
```

---

## Why This Split?

### Separation of Concerns

1. **`fixtures/extension.ts`** deals with:
   - Playwright's execution context
   - Chrome API peculiarities
   - CI/CD environment differences
   - Low-level storage operations

2. **`utils/storage.ts`** deals with:
   - Test data creation
   - Business rule enforcement
   - Domain-specific logic
   - Developer-friendly APIs

### Benefits

✅ **Maintainability**: Changes to Chrome API handling don't affect business logic
✅ **Testability**: Business logic can be tested independently
✅ **Reusability**: Factory functions can be used in various test scenarios
✅ **Safety**: `ensureDefaultCategory()` prevents common bugs
✅ **Clarity**: Clear boundary between infrastructure and domain logic

---

## Common Patterns

### Pattern 1: New User (Empty State)
```typescript
await seedLibrary(storage, {
  prompts: [],
  categories: [],
  settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' }
});
// Result: Only default "Uncategorized" category exists
```

### Pattern 2: Basic User
```typescript
await seedLibrary(storage, {
  prompts: [
    createPromptSeed({ title: 'Email Template', content: '...', category: 'Work' })
  ],
  categories: [
    createCategorySeed({ name: 'Work', color: '#3B82F6' })
  ]
});
// Result: "Uncategorized" + "Work" categories, 1 prompt
```

### Pattern 3: Using Fixtures
```typescript
import { SCENARIO_FIXTURES } from '../fixtures/test-data';

await seedLibrary(storage, SCENARIO_FIXTURES.POWER_USER);
// Result: 17 prompts across 5 categories with complete settings
```

### Pattern 4: Reading Data During Tests
```typescript
// After test operations, verify data
const prompts = await storage.getPrompts();
const categories = await storage.getCategories();
const settings = await storage.getSettings();

expect(prompts).toHaveLength(3);
expect(categories).toContainEqual(expect.objectContaining({ name: 'Work' }));
expect(settings?.theme).toBe('dark');
```

---

## Anti-Patterns (What NOT to Do)

### ❌ DON'T: Use low-level methods for seeding

```typescript
// BAD - Skips default category logic
await storage.seedCategories([
  createCategorySeed({ name: 'Work' })
]);
// Bug: No "Uncategorized" category exists!

// GOOD - Uses seedLibrary which adds default category
await seedLibrary(storage, {
  categories: [createCategorySeed({ name: 'Work' })]
});
```

### ❌ DON'T: Create prompts without factories

```typescript
// BAD - Missing required fields, no defaults
await seedLibrary(storage, {
  prompts: [{ title: 'Test', content: 'Content' }] // TypeScript error!
});

// GOOD - Use factory for defaults
await seedLibrary(storage, {
  prompts: [createPromptSeed({ title: 'Test', content: 'Content' })]
});
```

### ❌ DON'T: Seed partial data structures

```typescript
// BAD - Only seeds prompts, no categories/settings
await storage.seedPrompts([...]);

// GOOD - Seed complete state
await seedLibrary(storage, {
  prompts: [...],
  categories: [...],
  settings: { ... }
});
```

---

## Migration Guide

If you find tests using direct `storage.seedPrompts()` or `storage.seedCategories()`:

**Before:**
```typescript
await storage.seedCategories([
  createCategorySeed({ name: 'Work' })
]);
await storage.seedPrompts([
  createPromptSeed({ title: 'Test', content: 'Content', category: 'Work' })
]);
```

**After:**
```typescript
await seedLibrary(storage, {
  categories: [
    createCategorySeed({ name: 'Work' })
  ],
  prompts: [
    createPromptSeed({ title: 'Test', content: 'Content', category: 'Work' })
  ]
});
```

---

## Summary

| Aspect | `fixtures/extension.ts` | `utils/storage.ts` |
|--------|------------------------|-------------------|
| **Purpose** | Chrome API wrapper | Test data helpers |
| **Level** | Low-level infrastructure | High-level domain logic |
| **Use in tests** | Read operations, assertions | Seeding, data creation |
| **Main API** | `ExtensionStorage` interface | `seedLibrary()` function |
| **Dependencies** | Playwright, Chrome APIs | Application types |
| **Business logic** | None | Category defaults, validation |

**Golden Rule**: Always use `seedLibrary()` for test setup, use `storage.get*()` for test assertions.
---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, type-safety, typescript, testing, pr-156]
dependencies: []
---

# Remove Excessive `as any` Type Assertions from Hook Tests

## Problem Statement

The three new hook test files contain **217+ instances of `as any`** type assertions, with many being unnecessary or replaceable with proper TypeScript types. This bypasses TypeScript's type checking system, reduces code safety, and could hide type-related bugs.

**Current State:**
- `useTheme.test.ts`: 20+ `as any` instances
- `useCategories.test.ts`: 15+ `as any` instances
- `usePrompts.test.ts`: 15+ `as any` instances
- Total: 50+ in hook tests alone (217+ total across all new tests)

**TypeScript's Purpose:** Catch type errors at compile time
**Current Reality:** Type checking bypassed with `as any`

## Findings

**Discovered during code review by:**
- kieran-typescript-reviewer agent
- Manual code analysis
- TypeScript type safety audit

**Locations:**
- `src/hooks/__tests__/useTheme.test.ts` (lines 45, 86, 174, 199, 226, 252, 265, 296, 311, 501, 534, 563, 607, 631, 656, 682, 729, 764)
- `src/hooks/__tests__/useCategories.test.ts` (lines 156, 342, 606)
- `src/hooks/__tests__/usePrompts.test.ts` (similar patterns)

## Examples of Problematic Usage

### Pattern 1: Unnecessary `any` in Mock Parameters

**Current (Bad):**
```typescript
(chrome.tabs.query as any).mockImplementation((_queryInfo: any, callback?: ...) => {
  // _queryInfo: any - completely bypasses type checking
  // If chrome.tabs.QueryInfo changes, we won't know
});
```

**Problem:**
- Parameter type checking disabled
- No autocomplete for _queryInfo properties
- Refactoring Chrome API breaks silently

**Fixed (Good):**
```typescript
import type { Tabs } from 'chrome-types';

(chrome.tabs.query as Mock).mockImplementation(
  (queryInfo: Tabs.QueryInfo, callback?: (tabs: chrome.tabs.Tab[]) => void) => {
    // Properly typed - compiler will catch misuse
    const activeTabs = [{ id: 1, active: true }] as chrome.tabs.Tab[];
    callback?.(activeTabs);
  }
);
```

---

### Pattern 2: Type Assertion on Validation Errors

**Current (Bad):**
```typescript
const validationError = {
  type: ErrorType.VALIDATION_ERROR,
  message: 'Category name cannot be empty'
};

vi.mocked(mockPromptManager.validateCategoryData)
  .mockReturnValue(validationError as any);  // ❌ Hiding incomplete type
```

**Problem:**
- `validationError` is missing fields from `AppError` interface
- `as any` hides this mismatch
- Runtime errors possible if code expects missing fields

**Fixed (Good):**
```typescript
const validationError: AppError = {
  type: ErrorType.VALIDATION_ERROR,
  message: 'Category name cannot be empty',
  field: 'name',  // Previously missing
  code: 'INVALID_NAME',  // Previously missing
  timestamp: Date.now()  // Previously missing
};

vi.mocked(mockPromptManager.validateCategoryData)
  .mockReturnValue(validationError);  // ✅ Type-safe
```

---

### Pattern 3: Global Object Mutations

**Current (Bad):**
```typescript
(globalThis as any).matchMedia = vi.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  // ...
}));
```

**Problem:**
- Mutating global without type safety
- No guarantee matchMedia signature is correct
- Could break if MediaQueryList interface changes

**Fixed (Good):**
```typescript
type GlobalWithMatchMedia = typeof globalThis & {
  matchMedia: Mock<(query: string) => MediaQueryList>;
};

(globalThis as unknown as GlobalWithMatchMedia).matchMedia =
  vi.fn().mockImplementation((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn()
  }));
```

---

### Pattern 4: Mock Type Misuse

**Current (Bad):**
```typescript
let mockMatchMedia: {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};
```

**Problem:**
- Doesn't match actual `MediaQueryList` interface
- Missing required properties
- Tests may pass but not reflect real behavior

**Fixed (Good):**
```typescript
let mockMatchMedia: Partial<MediaQueryList>;

beforeEach(() => {
  mockMatchMedia = {
    matches: false,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn()
  };
});
```

## Impact Analysis

**Type Safety Reduction:**
- 217+ points where TypeScript cannot help
- Compiler cannot catch type mismatches
- Refactoring becomes dangerous

**Developer Experience:**
- No autocomplete for typed properties
- No inline documentation (JSDoc hints)
- More time debugging runtime type errors

**Code Quality:**
- Lower confidence in test correctness
- Technical debt accumulates
- Future maintainers confused

**Potential Bugs:**
- Chrome API changes not caught
- Interface changes not detected
- Runtime type errors in tests

## Breakdown by File

### useTheme.test.ts (20+ instances)

**Line 45, 252, 296:** Chrome tabs.query mocking
```typescript
// Current: (chrome.tabs.query as any).mockImplementation((_queryInfo: any, ...
// Fix: Use Tabs.QueryInfo type
```

**Lines 86, 174, 199, 226, 265, 311:** StorageManager method mocking
```typescript
// Current: (storageManager.updateSettings as any).mockResolvedValue(...)
// Fix: Use proper Mock<typeof storageManager.updateSettings> type
```

**Lines 501, 534, 563, 764:** globalThis mutations
```typescript
// Current: (globalThis as any).matchMedia = ...
// Fix: Use proper global type extension
```

### useCategories.test.ts (15+ instances)

**Lines 156, 342, 606:** Validation error assertions
```typescript
// Current: mockReturnValue(validationError as any)
// Fix: Complete AppError type definition
```

### usePrompts.test.ts (15+ instances)

Similar patterns to useCategories

## Proposed Solutions

### Option 1: Systematic Type Replacement (Recommended)

**Approach:** Replace each `as any` with proper types systematically

**Steps:**
1. Group `as any` instances by pattern (Chrome API, validation errors, etc.)
2. For each pattern, identify correct type
3. Replace all instances of that pattern
4. Verify tests still pass
5. Move to next pattern

**Implementation Plan:**

**Phase 1: Chrome API Types (10 instances)**
```typescript
// Install Chrome types if not already present
npm install --save-dev @types/chrome

// Replace Chrome API any casts
import type { Tabs, Storage } from 'chrome-types';
```

**Phase 2: Validation Error Types (20 instances)**
```typescript
// Ensure AppError interface is complete
interface AppError {
  type: ErrorType;
  message: string;
  field?: string;
  code?: string;
  timestamp?: number;
}

// Use in tests
const validationError: AppError = { /* complete object */ };
```

**Phase 3: Mock Types (30 instances)**
```typescript
// Use vi.Mock<T> properly
import type { Mock } from 'vitest';

type StorageUpdateMock = Mock<typeof storageManager.updateSettings>;
const mockUpdate = storageManager.updateSettings as unknown as StorageUpdateMock;
```

**Phase 4: Global Types (10 instances)**
```typescript
// Create proper global augmentation
declare global {
  interface Window {
    matchMedia: Mock<(query: string) => MediaQueryList>;
  }
}
```

**Pros:**
- Most accurate approach
- Catches real type errors
- Improves code quality significantly

**Cons:**
- Time-consuming (3-4 hours)
- Requires understanding types

**Effort:** Medium (3-4 hours)
**Risk:** Low

---

### Option 2: Use Type Guards and Assertions

**Approach:** Keep `as any` but add runtime type guards

```typescript
function isValidationError(error: any): error is AppError {
  return (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    'message' in error
  );
}

// Usage
const validationError = { /* ... */ };
if (!isValidationError(validationError)) {
  throw new Error('Invalid validation error structure');
}
mockReturnValue(validationError);
```

**Pros:**
- Adds runtime safety
- Less type annotation needed
- Catches issues at runtime

**Cons:**
- Still uses `as any` (doesn't fix root cause)
- Runtime overhead
- Doesn't improve developer experience

**Effort:** Medium (2-3 hours)
**Risk:** Low

## Recommended Action

**Option 1** - Systematic type replacement

While more effort upfront, this provides lasting benefits:
- Better type safety
- Improved developer experience
- Catches bugs at compile time
- Self-documenting code

## Technical Details

**Files to Modify:**
- `src/hooks/__tests__/useTheme.test.ts` (20+ replacements)
- `src/hooks/__tests__/useCategories.test.ts` (15+ replacements)
- `src/hooks/__tests__/usePrompts.test.ts` (15+ replacements)
- Potentially add `src/types/test-helpers.ts` for shared types

**Dependencies to Install:**
```bash
# If not already present
npm install --save-dev @types/chrome
```

**Type Definitions Needed:**

```typescript
// src/types/test-helpers.ts

import type { Mock } from 'vitest';

// Chrome API types
export type ChromeTabsQueryMock = Mock<
  (queryInfo: chrome.tabs.QueryInfo, callback?: (tabs: chrome.tabs.Tab[]) => void) => void
>;

export type ChromeStorageGetMock = Mock<
  (keys: string | string[] | null, callback: (result: any) => void) => void
>;

// Global augmentations
declare global {
  interface Window {
    matchMedia: Mock<(query: string) => MediaQueryList>;
  }
}

// Service mock types
export type StorageManagerMock = {
  [K in keyof StorageManager]: Mock<StorageManager[K]>;
};

export type PromptManagerMock = {
  [K in keyof PromptManager]: Mock<PromptManager[K]>;
};
```

## Acceptance Criteria

- [ ] Reduce `as any` usage by at least 75% (from 217 to <55)
- [ ] All Chrome API mocks use proper types
- [ ] All validation error objects have complete types
- [ ] All mock functions properly typed
- [ ] Global object mutations use proper augmentation
- [ ] No TypeScript compilation errors
- [ ] All 1,244 tests still pass
- [ ] IDE autocomplete works for mocked functions
- [ ] No false positives (valid code failing type check)

## Work Log

### 2025-11-06 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during TypeScript review by kieran-typescript-reviewer
- Found 217+ instances across hook tests
- Categorized into 4 main patterns
- Created type-safe examples for each pattern

**Learnings:**
- Many `as any` usages are unnecessary
- Proper Chrome types available via @types/chrome
- Mock types can be properly defined
- Global mutations need proper augmentation
- Type guards can provide runtime safety

**Type Safety Score:**
- Before: C+ (217 `as any` instances)
- Target: B+ (<55 instances)
- Improvement: 75% reduction

## Notes

**Priority Justification:**
- P2 (Important) because reduces type safety but doesn't break functionality
- Should be fixed before next major refactoring
- Improves developer experience significantly
- Prevents future type-related bugs

**Related Issues:**
- Finding #2: Weak validation (needs complete AppError type)
- Testing best practices recommend proper typing
- TypeScript strict mode should catch these

**Migration Strategy:**
Replace by pattern, not file-by-file:
1. All Chrome API mocks first (clear pattern)
2. All validation errors second (shared type)
3. All service mocks third (can create shared types)
4. All global mutations last (most complex)

**Success Metrics:**
- TypeScript compilation with no errors
- 100% test pass rate maintained
- Developer satisfaction with autocomplete
- Code review comments reduced

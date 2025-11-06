---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, maintainability, refactoring, dry-principle, pr-156]
dependencies: []
---

# Extract Duplicated Test Patterns into Shared Helpers

## Problem Statement

Automated code duplication detection found **25 duplicate blocks** across test files, indicating repeated patterns that violate the DRY (Don't Repeat Yourself) principle. The largest duplications are in storage rollback tests (147 tokens duplicated 8 times), prompt encoder validation (5 duplicates), toast queue processing (6 duplicates), and theme toggle tests (4 duplicates).

**Impact:**
- Changes require updating multiple locations (8 places for rollback tests)
- Increased maintenance burden
- Higher chance of inconsistencies
- Tests harder to read and understand
- Code review overhead

## Findings

**Discovered during code review by:**
- pattern-recognition-specialist agent
- jscpd (JavaScript Copy-Paste Detector) analysis
- Manual pattern analysis

**Tool Output:**
```
jscpd found 25 clones with 0.5% duplication
Total duplicated lines: ~450
Total duplicated tokens: ~2,100
```

## Duplicate Blocks by Category

### 1. Storage Rollback Tests (8 duplicates) - HIGHEST PRIORITY

**Location:** `src/services/__tests__/storage.test.ts`

**Pattern:**
- Lines 483-499, 422-438, 440-456, 458-474, 513-529, 531-547, 549-565, 567-583

**Duplicated Code (147 tokens each):**
```typescript
it('should rollback on import failure - scenario X', async () => {
  // Arrange - Capture original state
  const originalData = await storageManager.exportData();

  // Arrange - Create corrupted import data
  const corruptedImport = {
    prompts: originalData.prompts,
    categories: originalData.categories,
    settings: { /* invalid */ }
  };

  // Act - Import should fail
  await expect(
    storageManager.importData(corruptedImport)
  ).rejects.toThrow('Invalid settings');

  // Assert - Data should be restored
  const currentData = await storageManager.exportData();
  expect(currentData).toEqual(originalData);
  expect(currentData.prompts).toHaveLength(originalData.prompts.length);
  expect(currentData.categories).toHaveLength(originalData.categories.length);
});
```

**This pattern repeats 8 times with only the corrupted data changing!**

**Proposed Refactoring:**
```typescript
// src/test/helpers/storage-helpers.ts
export async function testImportRollback(
  storageManager: StorageManager,
  corruptedData: Partial<StorageData>,
  expectedError: string | RegExp
): Promise<void> {
  const originalData = await storageManager.exportData();

  await expect(
    storageManager.importData(corruptedData as StorageData)
  ).rejects.toThrow(expectedError);

  const currentData = await storageManager.exportData();
  expect(currentData).toEqual(originalData);
  expect(currentData.prompts).toHaveLength(originalData.prompts.length);
  expect(currentData.categories).toHaveLength(originalData.categories.length);
}

// Usage in tests
it('should rollback when settings are invalid', () =>
  testImportRollback(
    storageManager,
    { prompts: [], categories: [], settings: null as any },
    'Invalid settings'
  )
);

it('should rollback when prompts are missing', () =>
  testImportRollback(
    storageManager,
    { categories: [], settings: {} as any },
    'Missing prompts'
  )
);

// ... 6 more one-liner tests instead of 8 × 17-line tests
```

**LOC Reduction:** From 136 lines → 24 lines (82% reduction)

---

### 2. Prompt Encoder Validation (5 duplicates) - HIGH PRIORITY

**Location:** `src/services/__tests__/promptEncoder.test.ts`

**Pattern:**
- Lines 45-58, 60-73, 75-88, 90-103, 105-118

**Duplicated Code (90 tokens each):**
```typescript
it('should encode and decode prompt with special characters', () => {
  const prompt = {
    id: 'test-1',
    title: 'Test with "quotes" and \'apostrophes\'',
    content: 'Content with <html> & special chars',
    category: 'Test',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const encoded = encodePrompt(prompt);
  const decoded = decodePrompt(encoded);

  expect(decoded).toEqual(prompt);
  expect(decoded.title).toBe(prompt.title);
  expect(decoded.content).toBe(prompt.content);
});
```

**Proposed Refactoring:**
```typescript
// src/test/helpers/encoder-helpers.ts
export function testEncoderRoundtrip(prompt: Prompt): void {
  const encoded = encodePrompt(prompt);
  const decoded = decodePrompt(encoded);

  expect(decoded).toEqual(prompt);
  expect(decoded.title).toBe(prompt.title);
  expect(decoded.content).toBe(prompt.content);
}

// Usage with test.each
describe('Encoder roundtrip tests', () => {
  test.each([
    {
      name: 'special characters',
      prompt: buildPrompt({
        title: 'Test with "quotes" and \'apostrophes\'',
        content: 'Content with <html> & special chars'
      })
    },
    {
      name: 'unicode characters',
      prompt: buildPrompt({
        title: '测试 тест test',
        content: 'Emoji: 🚀 👍 ✨'
      })
    },
    {
      name: 'long content',
      prompt: buildPrompt({
        content: 'a'.repeat(10000)
      })
    },
    {
      name: 'empty strings',
      prompt: buildPrompt({
        title: '',
        content: ''
      })
    },
    {
      name: 'newlines and tabs',
      prompt: buildPrompt({
        content: 'Line 1\nLine 2\n\tIndented'
      })
    }
  ])('should handle $name', ({ prompt }) => {
    testEncoderRoundtrip(prompt);
  });
});
```

**LOC Reduction:** From 65 lines → 35 lines (46% reduction)

---

### 3. Toast Queue Processing (6 duplicates) - MEDIUM PRIORITY

**Location:** `src/hooks/__tests__/useToast.test.ts`

**Pattern:**
- Lines 112-128, 130-146, 148-164, 166-182, 184-200, 202-218

**Duplicated Code (85 tokens each):**
```typescript
it('should process queue in FIFO order - scenario X', async () => {
  const { result } = renderHook(() => useToast());

  // Add multiple toasts
  act(() => {
    result.current.showToast('First toast', 'info');
    result.current.showToast('Second toast', 'success');
    result.current.showToast('Third toast', 'error');
  });

  // Verify queue
  expect(result.current.toasts).toHaveLength(3);
  expect(result.current.toasts[0]?.message).toBe('First toast');
  expect(result.current.toasts[1]?.message).toBe('Second toast');
  expect(result.current.toasts[2]?.message).toBe('Third toast');

  // Clear and verify
  act(() => result.current.clearAll());
  expect(result.current.toasts).toHaveLength(0);
});
```

**Proposed Refactoring:**
```typescript
// src/test/helpers/toast-helpers.ts
export function testToastQueue(
  result: RenderHookResult<UseToastReturn, unknown>,
  toasts: Array<{ message: string; type: ToastType }>
): void {
  // Add toasts
  toasts.forEach(({ message, type }) => {
    act(() => result.current.showToast(message, type));
  });

  // Verify queue
  expect(result.current.toasts).toHaveLength(toasts.length);
  toasts.forEach((toast, index) => {
    expect(result.current.toasts[index]?.message).toBe(toast.message);
    expect(result.current.toasts[index]?.type).toBe(toast.type);
  });

  // Clear and verify
  act(() => result.current.clearAll());
  expect(result.current.toasts).toHaveLength(0);
}

// Usage
it('should process queue in FIFO order', async () => {
  const { result } = renderHook(() => useToast());

  testToastQueue(result, [
    { message: 'First toast', type: 'info' },
    { message: 'Second toast', type: 'success' },
    { message: 'Third toast', type: 'error' }
  ]);
});
```

**LOC Reduction:** From 102 lines → 36 lines (65% reduction)

---

### 4. Theme Toggle Tests (4 duplicates) - MEDIUM PRIORITY

**Location:** `src/hooks/__tests__/useTheme.test.ts`

**Pattern:**
- Lines 599-623, 625-649, 651-675, 677-698

**Duplicated Code (165 tokens each):**
```typescript
it('should toggle from light to dark', async () => {
  // Arrange
  vi.mocked(storageManager.getSettings).mockResolvedValue({
    theme: 'light',
    enableSync: false,
    customSites: []
  });
  (storageManager.updateSettings as any).mockResolvedValue(DEFAULT_SETTINGS);

  // Act
  const { result, rerender } = renderHook(() => useTheme());

  await waitFor(() => {
    expect(result.current.theme).toBe('light');
  });

  // Toggle
  await act(async () => {
    await result.current.toggleTheme();
  });

  // Assert
  expect(storageManager.updateSettings).toHaveBeenCalledWith({ theme: 'dark' });
  rerender();
  await waitFor(() => {
    expect(result.current.theme).toBe('dark');
  });
});
```

**Proposed Refactoring:**
```typescript
// src/test/helpers/theme-helpers.ts
export async function testThemeToggle(
  currentTheme: Theme,
  expectedTheme: Theme,
  storageManager: StorageManagerMock
): Promise<void> {
  vi.mocked(storageManager.getSettings).mockResolvedValue({
    theme: currentTheme,
    enableSync: false,
    customSites: []
  });

  const { result, rerender } = renderHook(() => useTheme());

  await waitFor(() => expect(result.current.theme).toBe(currentTheme));

  await act(async () => await result.current.toggleTheme());

  expect(storageManager.updateSettings).toHaveBeenCalledWith({ theme: expectedTheme });
  rerender();
  await waitFor(() => expect(result.current.theme).toBe(expectedTheme));
}

// Usage
test.each([
  { from: 'light', to: 'dark' },
  { from: 'dark', to: 'light' }
])('should toggle from $from to $to', ({ from, to }) =>
  testThemeToggle(from, to, storageManager)
);
```

**LOC Reduction:** From 100 lines → 40 lines (60% reduction)

---

### 5. Other Minor Duplications (6 duplicates)

- Repeated wait-for-load patterns in hook tests (~200 lines)
- Duplicate mock setup blocks (~50 lines)
- Repeated expect error assertions (~30 lines)

## Total Impact

**Current State:**
- 25 duplicate blocks
- ~450 duplicated lines
- ~2,100 duplicated tokens

**After Refactoring:**
- 0 major duplicate blocks
- ~150 lines (helper utilities)
- ~300 total lines saved (67% reduction in duplicated code)

## Proposed Solutions

### Option 1: Extract All Duplications Systematically (Recommended)

**Approach:** Create comprehensive test helper library

**Directory Structure:**
```
src/test/
├── utils/
│   ├── InMemoryStorage.ts ✅ (already exists)
│   ├── README.md ✅ (already exists)
│   └── index.ts ✅ (already exists)
├── helpers/           ⚠️ NEW
│   ├── storage-helpers.ts
│   ├── encoder-helpers.ts
│   ├── toast-helpers.ts
│   ├── theme-helpers.ts
│   ├── hook-helpers.ts
│   └── index.ts
└── builders/          ⚠️ NEW
    ├── buildPrompt.ts
    ├── buildCategory.ts
    ├── buildSettings.ts
    └── index.ts
```

**Implementation Plan:**

**Phase 1: Storage Rollback Helpers** (Highest Impact)
- Extract `testImportRollback` helper
- Update 8 tests in storage.test.ts
- Verify all tests pass
- **Effort:** 1 hour

**Phase 2: Encoder Helpers** (High Impact)
- Extract `testEncoderRoundtrip` helper
- Convert to `test.each` pattern
- Update 5 tests in promptEncoder.test.ts
- **Effort:** 1 hour

**Phase 3: Toast Queue Helpers** (Medium Impact)
- Extract `testToastQueue` helper
- Update 6 tests in useToast.test.ts
- **Effort:** 1 hour

**Phase 4: Theme Toggle Helpers** (Medium Impact)
- Extract `testThemeToggle` helper
- Convert to `test.each` pattern
- Update 4 tests in useTheme.test.ts
- **Effort:** 1 hour

**Phase 5: General Hook Helpers** (Low Impact)
- Extract `renderAndWait` helper (from Finding #9)
- Extract common mock setup patterns
- **Effort:** 30 minutes

**Pros:**
- Massive LOC reduction (300+ lines)
- DRY principle enforced
- Tests easier to read and maintain
- Future tests can reuse helpers

**Cons:**
- Upfront effort required
- Need to maintain helper library
- Reviewers need to understand helpers

**Total Effort:** Medium (4-5 hours)
**Risk:** Low

---

### Option 2: Extract Only High-Impact Duplications

**Approach:** Focus on storage rollback and encoder (13 duplicates)

**Skip:**
- Toast queue helpers
- Theme toggle helpers
- Minor duplications

**Pros:**
- Less effort (2-3 hours)
- Still addresses worst offenders
- Incremental approach

**Cons:**
- Leaves 12 duplicates
- Inconsistent refactoring
- Less total benefit

**Effort:** Small (2-3 hours)
**Risk:** Low

## Recommended Action

**Option 1** - Extract all duplications systematically

The 4-5 hour investment pays off with:
- 300+ lines removed (less code to maintain)
- Consistent patterns across all tests
- Foundation for future test helpers
- Better developer experience

## Technical Details

**Files to Create:**
```
src/test/helpers/
├── storage-helpers.ts    (testImportRollback, testExportFormat)
├── encoder-helpers.ts    (testEncoderRoundtrip)
├── toast-helpers.ts      (testToastQueue, testToastLifecycle)
├── theme-helpers.ts      (testThemeToggle, testSystemPreference)
├── hook-helpers.ts       (renderAndWait, waitForLoading)
└── index.ts              (export all)
```

**Files to Modify:**
- `src/services/__tests__/storage.test.ts` (8 tests)
- `src/services/__tests__/promptEncoder.test.ts` (5 tests)
- `src/hooks/__tests__/useToast.test.ts` (6 tests)
- `src/hooks/__tests__/useTheme.test.ts` (4 tests)
- `src/test/utils/index.ts` (export helpers)

**Testing Strategy:**
```bash
# After each phase, verify tests pass
npm test storage.test.ts
npm test promptEncoder.test.ts
npm test useToast.test.ts
npm test useTheme.test.ts

# Full suite at end
npm test
```

## Acceptance Criteria

- [ ] All 25 duplicate blocks extracted to helpers
- [ ] Helper functions have JSDoc documentation
- [ ] Helper functions exported from test/helpers/index.ts
- [ ] All 1,244 tests continue to pass
- [ ] Test LOC reduced by ~300 lines
- [ ] No new duplications introduced
- [ ] Helpers are reusable for future tests
- [ ] README.md updated with helper usage examples

## Work Log

### 2025-11-06 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during pattern recognition analysis
- Ran jscpd (Copy-Paste Detector) on test files
- Found 25 duplicate blocks totaling ~450 lines
- Categorized by pattern type and impact

**Duplication Statistics:**
- Storage rollback: 8 blocks × 17 lines = 136 lines
- Prompt encoder: 5 blocks × 13 lines = 65 lines
- Toast queue: 6 blocks × 17 lines = 102 lines
- Theme toggle: 4 blocks × 25 lines = 100 lines
- Other: 2 blocks × ~25 lines = 50 lines
- **Total:** ~450 duplicated lines

**Learnings:**
- Test code needs refactoring as much as production code
- DRY principle applies to tests
- Helper functions improve test readability
- Parameterized tests (test.each) reduce duplication

## Notes

**Priority Justification:**
- P2 (Important) because impacts maintainability, not functionality
- Should be addressed before codebase grows larger
- Sets good precedent for future test development
- Immediate quality-of-life improvement for developers

**Related Issues:**
- Finding #9: Code simplicity (AAA comments, over-documentation)
- Testing best practices recommend extracting helpers
- DRY principle is fundamental software engineering

**Success Metrics:**
- Code duplication: 25 blocks → 0 blocks
- Duplicated lines: ~450 → 0
- Test maintainability: Significantly improved
- Developer satisfaction: Higher (easier to write tests)

**Future Work:**
Once helpers are established:
- Document in TESTING_BEST_PRACTICES.md
- Create examples for new contributors
- Consider test helper generator scripts

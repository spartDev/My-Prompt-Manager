# Missing Parallel Import Tests Implementation Plan

## Executive Summary

The parallel import functionality in `SettingsView.tsx` has been fully implemented (lines 501-570), but the comprehensive test coverage planned in `PARALLEL_IMPORT_IMPLEMENTATION.md` is **incomplete**. This document provides a detailed action plan to implement the missing tests.

### What's Implemented
- **SettingsView.tsx**: Parallel import code using `Promise.allSettled()` is fully implemented
- **Partial Test Coverage**: Only 2 out of 6 planned integration tests exist in `SettingsView.test.tsx`:
  - ✅ `handles partial category import failures correctly`
  - ✅ `handles partial prompt import failures correctly`
- **Storage Tests**: 0 out of 5 planned concurrent import tests exist in `storage.test.ts`

### What's Missing
1. **SettingsView Integration Tests** (4 missing tests):
   - ❌ `imports multiple categories in parallel`
   - ❌ `imports multiple prompts in parallel`
   - ❌ 2 existing tests need verification/adjustment for parallel execution patterns

2. **Storage Unit Tests** (5 missing tests):
   - ❌ `should handle concurrent category imports without data corruption`
   - ❌ `should handle concurrent prompt imports without data corruption`
   - ❌ `should handle mixed concurrent imports and updates`
   - ❌ `should maintain data integrity with 100 concurrent category imports`
   - ❌ `should maintain data integrity with 100 concurrent prompt imports`

### Why Tests Were Skipped
These tests were deferred during parallel import implementation because they would fail due to the mutex race condition bug in `StorageManager.withLock()`. Now that the mutex bug has been fixed (PR #197), these tests can be safely implemented and will pass.

---

## Current State Analysis

### SettingsView.tsx Implementation Status: ✅ COMPLETE

**File**: `/Users/e0538224/Developer/My-Prompt-Manager/src/components/SettingsView.tsx`
**Lines**: 501-570

The `handleImportData` function is fully implemented with:
- ✅ Parallel category imports using `Promise.allSettled()`
- ✅ Error collection with category context (name, id)
- ✅ Parallel prompt imports using `Promise.allSettled()`
- ✅ Error collection with prompt context (title, id)
- ✅ Partial success reporting ("X succeeded" messaging)
- ✅ Sequential guarantee (categories before prompts)

**No implementation work needed in SettingsView.tsx.**

### SettingsView.test.tsx Test Coverage Status: ⚠️ PARTIAL

**File**: `/Users/e0538224/Developer/My-Prompt-Manager/src/components/__tests__/SettingsView.test.tsx`

**Existing Tests** (lines 231-313):
```typescript
describe('Parallel Import Performance', () => {
  it('handles partial category import failures correctly', async () => { ... })
  it('handles partial prompt import failures correctly', async () => { ... })
});
```

**Analysis**:
- ✅ These 2 tests verify error handling for partial failures
- ❌ Missing tests for actual parallel execution verification
- ❌ No tests to verify parallelism (multiple operations starting before any complete)
- ❌ No tests for successful parallel import scenarios

### storage.test.ts Test Coverage Status: ❌ MISSING

**File**: `/Users/e0538224/Developer/My-Prompt-Manager/src/services/__tests__/storage.test.ts`

**Current State**:
- File ends at line 851 with closing braces of existing describe blocks
- No "Concurrent Import Operations" describe block exists
- All 5 planned concurrent import tests are missing

**Impact**:
- StorageManager's import methods (`importCategory`, `importPrompt`) lack concurrency testing
- No verification that the mutex fix actually prevents race conditions during imports
- Missing stress tests for high-concurrency scenarios (100+ operations)

---

## Detailed Implementation Plan

### Phase 1: Add Missing Integration Tests to SettingsView.test.tsx

**File**: `/Users/e0538224/Developer/My-Prompt-Manager/src/components/__tests__/SettingsView.test.tsx`
**Location**: Inside the existing `describe('Parallel Import Performance', ...)` block (after line 231, before line 313)
**Tests to Add**: 2 new tests

#### Test 1: `imports multiple categories in parallel`

**Purpose**: Verify that categories are imported concurrently, not sequentially.

**Key Assertions**:
- Track call order with mock implementation
- Verify multiple operations start before first completes
- Check that `startsBeforeFirstEnd > 1` (proof of parallelism)
- Verify all categories imported successfully

**Implementation Location**: Insert after line 231, before existing tests

```typescript
it('imports multiple categories in parallel', async () => {
  const storageMock = getMockStorageManager();
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

  // Track call order to ensure parallelism
  const callOrder: string[] = [];
  storageMock.importCategory.mockImplementation(async (category: Category) => {
    callOrder.push(`category-${category.id}-start`);
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
    callOrder.push(`category-${category.id}-end`);
    return category;
  });

  await renderSettings();
  await waitFor(() => {
    expect(storageMock.getPrompts).toHaveBeenCalled();
  });

  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(fileInput).not.toBeNull();

  const categories: Category[] = [
    { id: 'c1', name: 'Category 1' },
    { id: 'c2', name: 'Category 2' },
    { id: 'c3', name: 'Category 3' }
  ];
  const prompts: Prompt[] = [];
  const backupContents = JSON.stringify({ prompts, categories, version: '1.0' });
  const file = createJsonFile(backupContents);

  const uploadPromise = userEvent.upload(fileInput as HTMLInputElement, file);

  // Advance timers to trigger all async work
  await vi.advanceTimersByTimeAsync(100);

  // Wait for upload to complete
  await uploadPromise;

  await waitFor(() => {
    expect(storageMock.importCategory).toHaveBeenCalledTimes(3);
  });

  // Verify parallel execution: all starts should happen before any ends
  const startCount = callOrder.filter(c => c.endsWith('-start')).length;
  const firstEndIndex = callOrder.findIndex(c => c.endsWith('-end'));
  const startsBeforeFirstEnd = callOrder.slice(0, firstEndIndex).filter(c => c.endsWith('-start')).length;

  // If truly parallel, multiple starts should occur before first end
  expect(startsBeforeFirstEnd).toBeGreaterThan(1);
  expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/successfully imported/i));
  alertSpy.mockRestore();
});
```

**Success Criteria**:
- ✅ Test passes with current implementation
- ✅ `startsBeforeFirstEnd` assertion verifies parallelism
- ✅ All 3 categories imported successfully
- ✅ Success alert shown

---

#### Test 2: `imports multiple prompts in parallel`

**Purpose**: Verify that prompts are imported concurrently, not sequentially.

**Key Assertions**:
- Track call order with mock implementation
- Verify multiple operations start before first completes
- Check that `startsBeforeFirstEnd > 1` (proof of parallelism)
- Verify all prompts imported successfully

**Implementation Location**: Insert after Test 1, before existing failure tests

```typescript
it('imports multiple prompts in parallel', async () => {
  const storageMock = getMockStorageManager();
  const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

  // Track call order
  const callOrder: string[] = [];
  storageMock.importPrompt.mockImplementation(async (prompt: Prompt) => {
    callOrder.push(`prompt-${prompt.id}-start`);
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate async work
    callOrder.push(`prompt-${prompt.id}-end`);
    return prompt;
  });

  await renderSettings();
  await waitFor(() => {
    expect(storageMock.getPrompts).toHaveBeenCalled();
  });

  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(fileInput).not.toBeNull();

  const categories: Category[] = [{ id: 'c1', name: 'Uncategorized' }];
  const prompts: Prompt[] = [
    { id: 'p1', title: 'Prompt 1', content: 'Content 1', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
    { id: 'p2', title: 'Prompt 2', content: 'Content 2', category: 'Uncategorized', createdAt: 1, updatedAt: 1 },
    { id: 'p3', title: 'Prompt 3', content: 'Content 3', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }
  ];
  const backupContents = JSON.stringify({ prompts, categories, version: '1.0' });
  const file = createJsonFile(backupContents);

  const uploadPromise = userEvent.upload(fileInput as HTMLInputElement, file);

  // Advance timers to trigger all async work
  await vi.advanceTimersByTimeAsync(100);

  // Wait for upload to complete
  await uploadPromise;

  await waitFor(() => {
    expect(storageMock.importPrompt).toHaveBeenCalledTimes(3);
  });

  // Verify parallel execution
  const startCount = callOrder.filter(c => c.endsWith('-start')).length;
  const firstEndIndex = callOrder.findIndex(c => c.endsWith('-end'));
  const startsBeforeFirstEnd = callOrder.slice(0, firstEndIndex).filter(c => c.endsWith('-start')).length;

  expect(startsBeforeFirstEnd).toBeGreaterThan(1);
  expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/successfully imported/i));
  alertSpy.mockRestore();
});
```

**Success Criteria**:
- ✅ Test passes with current implementation
- ✅ `startsBeforeFirstEnd` assertion verifies parallelism
- ✅ All 3 prompts imported successfully
- ✅ Success alert shown

---

### Phase 2: Add Missing Unit Tests to storage.test.ts

**File**: `/Users/e0538224/Developer/My-Prompt-Manager/src/services/__tests__/storage.test.ts`
**Location**: After line 851 (after "Import Rollback Scenarios" describe block, before final closing brace)
**Tests to Add**: 5 new tests in new describe block

#### Describe Block Structure

Add a new top-level describe block after line 851:

```typescript
describe('Concurrent Import Operations', () => {
  // 5 tests go here
});
```

---

#### Test 1: `should handle concurrent category imports without data corruption`

**Purpose**: Verify that importing 5 categories simultaneously doesn't cause data loss or corruption.

**Key Assertions**:
- All 5 imports succeed with correct data
- All 5 categories stored in storage
- No data overwrites or losses

**Implementation**:

```typescript
it('should handle concurrent category imports without data corruption', async () => {
  const timestamp = FIXED_TIME.getTime();
  const categories: Category[] = [
    { id: 'cat1', name: 'Work' },
    { id: 'cat2', name: 'Personal' },
    { id: 'cat3', name: 'Learning' },
    { id: 'cat4', name: 'Projects' },
    { id: 'cat5', name: 'Templates' }
  ];

  // Import all categories in parallel
  const results = await Promise.all(
    categories.map(cat => storageManager.importCategory(cat))
  );

  // Verify all imports succeeded
  expect(results).toHaveLength(5);
  results.forEach((result, idx) => {
    expect(result.id).toBe(categories[idx].id);
    expect(result.name).toBe(categories[idx].name);
  });

  // Verify all categories are stored
  const storedCategories = await storageManager.getCategories();
  categories.forEach(cat => {
    expect(storedCategories.some(s => s.id === cat.id && s.name === cat.name)).toBe(true);
  });
});
```

**Success Criteria**:
- ✅ All 5 categories imported without errors
- ✅ Each result matches input data
- ✅ All categories exist in storage (no data loss)

---

#### Test 2: `should handle concurrent prompt imports without data corruption`

**Purpose**: Verify that importing 10 prompts simultaneously doesn't cause data loss or corruption.

**Key Assertions**:
- All 10 imports succeed with correct data
- All 10 prompts stored in storage
- No data overwrites or losses

**Implementation**:

```typescript
it('should handle concurrent prompt imports without data corruption', async () => {
  const timestamp = FIXED_TIME.getTime();
  const prompts: Prompt[] = Array.from({ length: 10 }, (_, i) => ({
    id: `prompt${i}`,
    title: `Test Prompt ${i}`,
    content: `Content ${i}`,
    category: DEFAULT_CATEGORY,
    createdAt: timestamp,
    updatedAt: timestamp,
    usageCount: 0,
    lastUsedAt: timestamp
  }));

  // Import all prompts in parallel
  const results = await Promise.all(
    prompts.map(prompt => storageManager.importPrompt(prompt))
  );

  // Verify all imports succeeded
  expect(results).toHaveLength(10);
  results.forEach((result, idx) => {
    expect(result.id).toBe(prompts[idx].id);
    expect(result.title).toBe(prompts[idx].title);
  });

  // Verify all prompts are stored
  const storedPrompts = await storageManager.getPrompts();
  expect(storedPrompts).toHaveLength(10);
  prompts.forEach(prompt => {
    expect(storedPrompts.some(s => s.id === prompt.id && s.title === prompt.title)).toBe(true);
  });
});
```

**Success Criteria**:
- ✅ All 10 prompts imported without errors
- ✅ Each result matches input data
- ✅ All prompts exist in storage (no data loss)

---

#### Test 3: `should handle mixed concurrent imports and updates`

**Purpose**: Verify that concurrent import (update existing) and import (create new) operations don't interfere.

**Key Assertions**:
- Update operation succeeds
- Create operation succeeds
- Storage contains both updated and new prompts

**Implementation**:

```typescript
it('should handle mixed concurrent imports and updates', async () => {
  const timestamp = FIXED_TIME.getTime();

  // Setup: Create initial prompt
  const initialPrompt: Prompt = {
    id: 'test-prompt',
    title: 'Original',
    content: 'Original Content',
    category: DEFAULT_CATEGORY,
    createdAt: timestamp,
    updatedAt: timestamp,
    usageCount: 0,
    lastUsedAt: timestamp
  };
  await chrome.storage.local.set({ prompts: [initialPrompt] });

  // Concurrent operations: import (update) and create new
  const updatedPrompt: Prompt = {
    ...initialPrompt,
    title: 'Updated',
    content: 'Updated Content'
  };
  const newPrompt: Prompt = {
    id: 'new-prompt',
    title: 'New',
    content: 'New Content',
    category: DEFAULT_CATEGORY,
    createdAt: timestamp,
    updatedAt: timestamp,
    usageCount: 0,
    lastUsedAt: timestamp
  };

  // Execute concurrent import operations
  const [result1, result2] = await Promise.all([
    storageManager.importPrompt(updatedPrompt),
    storageManager.importPrompt(newPrompt)
  ]);

  // Verify both operations succeeded
  expect(result1.title).toBe('Updated');
  expect(result2.title).toBe('New');

  // Verify storage state
  const storedPrompts = await storageManager.getPrompts();
  expect(storedPrompts).toHaveLength(2);
  expect(storedPrompts.some(p => p.id === 'test-prompt' && p.title === 'Updated')).toBe(true);
  expect(storedPrompts.some(p => p.id === 'new-prompt' && p.title === 'New')).toBe(true);
});
```

**Success Criteria**:
- ✅ Both operations complete successfully
- ✅ Update operation modifies existing prompt
- ✅ Create operation adds new prompt
- ✅ Storage contains both prompts

---

#### Test 4: `should maintain data integrity with 100 concurrent category imports`

**Purpose**: Stress test to verify mutex scales to high concurrency without data corruption.

**Key Assertions**:
- All 100 categories imported successfully
- All 100 categories stored (no data loss)
- Each category has correct data

**Implementation**:

```typescript
it('should maintain data integrity with 100 concurrent category imports', async () => {
  const categories: Category[] = Array.from({ length: 100 }, (_, i) => ({
    id: `cat${i}`,
    name: `Category ${i}`
  }));

  // Import all 100 categories in parallel
  const startTime = Date.now();
  await Promise.all(categories.map(cat => storageManager.importCategory(cat)));
  const duration = Date.now() - startTime;

  // Verify all categories stored
  const storedCategories = await storageManager.getCategories();
  // +1 for default category
  expect(storedCategories.length).toBeGreaterThanOrEqual(100);

  categories.forEach(cat => {
    expect(storedCategories.some(s => s.id === cat.id && s.name === cat.name)).toBe(true);
  });

  // Log performance (for manual verification during development)
  console.log(`100 concurrent category imports completed in ${duration}ms`);
});
```

**Success Criteria**:
- ✅ All 100 operations complete successfully
- ✅ All 100 categories exist in storage
- ✅ No data corruption or duplication

---

#### Test 5: `should maintain data integrity with 100 concurrent prompt imports`

**Purpose**: Stress test to verify mutex scales to high concurrency for prompts without data corruption.

**Key Assertions**:
- All 100 prompts imported successfully
- All 100 prompts stored (no data loss)
- Each prompt has correct data

**Implementation**:

```typescript
it('should maintain data integrity with 100 concurrent prompt imports', async () => {
  const timestamp = FIXED_TIME.getTime();
  const prompts: Prompt[] = Array.from({ length: 100 }, (_, i) => ({
    id: `p${i}`,
    title: `Prompt ${i}`,
    content: `Content ${i}`,
    category: DEFAULT_CATEGORY,
    createdAt: timestamp,
    updatedAt: timestamp,
    usageCount: 0,
    lastUsedAt: timestamp
  }));

  // Import all 100 prompts in parallel
  const startTime = Date.now();
  await Promise.all(prompts.map(prompt => storageManager.importPrompt(prompt)));
  const duration = Date.now() - startTime;

  // Verify all prompts stored
  const storedPrompts = await storageManager.getPrompts();
  expect(storedPrompts).toHaveLength(100);

  prompts.forEach(prompt => {
    expect(storedPrompts.some(s => s.id === prompt.id && s.title === prompt.title)).toBe(true);
  });

  // Log performance
  console.log(`100 concurrent prompt imports completed in ${duration}ms`);
});
```

**Success Criteria**:
- ✅ All 100 operations complete successfully
- ✅ All 100 prompts exist in storage
- ✅ No data corruption or duplication

---

## Implementation Steps

### Step 1: Pre-Implementation Verification

Before making any changes, verify the environment:

```bash
# 1. Verify current branch
git branch --show-current
```
**Expected**: `feat/ui` or other feature branch

```bash
# 2. Verify git status
git status
```
**Expected**: Clean working directory (or only plan documents as untracked)

```bash
# 3. Run existing tests
npm test
```
**Expected**: All existing tests pass (920+ tests)

```bash
# 4. Run linter
npm run lint
```
**Expected**: No linting errors

**If any verification fails, STOP and resolve issues before proceeding.**

---

### Step 2: Add SettingsView Integration Tests

**File**: `/Users/e0538224/Developer/My-Prompt-Manager/src/components/__tests__/SettingsView.test.tsx`

**Actions**:
1. Open `SettingsView.test.tsx` in editor
2. Locate the `describe('Parallel Import Performance', ...)` block (line 231)
3. Insert Test 1 (`imports multiple categories in parallel`) after line 231
4. Insert Test 2 (`imports multiple prompts in parallel`) after Test 1
5. Ensure correct indentation (2 spaces per level)
6. Save file

**Verification**:
```bash
# Run SettingsView tests only
npm test -- SettingsView.test.tsx
```

**Expected Output**:
- All existing tests pass (5 tests)
- 2 new tests pass:
  - ✅ `imports multiple categories in parallel`
  - ✅ `imports multiple prompts in parallel`
- Total: 7 tests in `describe('Parallel Import Performance', ...)`

---

### Step 3: Add Storage Unit Tests

**File**: `/Users/e0538224/Developer/My-Prompt-Manager/src/services/__tests__/storage.test.ts`

**Actions**:
1. Open `storage.test.ts` in editor
2. Locate line 851 (after "Import Rollback Scenarios" describe block)
3. Add new `describe('Concurrent Import Operations', () => { ... })` block
4. Add all 5 tests inside this block:
   - Test 1: `should handle concurrent category imports without data corruption`
   - Test 2: `should handle concurrent prompt imports without data corruption`
   - Test 3: `should handle mixed concurrent imports and updates`
   - Test 4: `should maintain data integrity with 100 concurrent category imports`
   - Test 5: `should maintain data integrity with 100 concurrent prompt imports`
5. Ensure correct indentation (2 spaces per level)
6. Save file

**Verification**:
```bash
# Run storage tests only
npm test -- storage.test.ts
```

**Expected Output**:
- All existing tests pass (existing test count)
- 5 new tests pass:
  - ✅ `should handle concurrent category imports without data corruption`
  - ✅ `should handle concurrent prompt imports without data corruption`
  - ✅ `should handle mixed concurrent imports and updates`
  - ✅ `should maintain data integrity with 100 concurrent category imports`
  - ✅ `should maintain data integrity with 100 concurrent prompt imports`

---

### Step 4: Full Test Suite Verification

**Actions**:
```bash
# 1. Run all tests
npm test
```

**Expected Output**:
- All existing tests pass
- 7 new tests pass (2 from SettingsView, 5 from storage)
- Total test count increases by 7
- No test failures

```bash
# 2. Run tests with coverage
npm run test:coverage
```

**Expected Output**:
- Coverage maintained or improved
- `storage.ts` coverage remains high (>95%)
- `SettingsView.tsx` coverage remains high (>90%)

```bash
# 3. Run linter
npm run lint
```

**Expected Output**:
- No new linting errors
- All tests follow code style guidelines

**If any verification fails, fix issues before proceeding to Step 5.**

---

### Step 5: Commit Changes

**Actions**:
```bash
# 1. Stage test files
git add src/components/__tests__/SettingsView.test.tsx
git add src/services/__tests__/storage.test.ts

# 2. Verify staged changes
git diff --staged
```

**Expected Output**:
- `SettingsView.test.tsx`: ~80 lines added (2 new tests)
- `storage.test.ts`: ~150 lines added (5 new tests)
- Total: ~230 lines added

```bash
# 3. Create commit
git commit -m "$(cat <<'EOF'
test: add comprehensive parallel import test coverage

Add missing test coverage for parallel import functionality that was
deferred during initial implementation due to mutex race condition bug.

Tests Added:

SettingsView Integration Tests (2 new tests):
- imports multiple categories in parallel
- imports multiple prompts in parallel

Storage Unit Tests (5 new tests):
- should handle concurrent category imports without data corruption
- should handle concurrent prompt imports without data corruption
- should handle mixed concurrent imports and updates
- should maintain data integrity with 100 concurrent category imports
- should maintain data integrity with 100 concurrent prompt imports

These tests verify that the parallel import implementation correctly
handles concurrent operations without data loss, leveraging the
fixed mutex implementation from PR #197.

All tests pass with the current implementation.

Related:
- PARALLEL_IMPORT_IMPLEMENTATION.md (implementation plan)
- MUTEX_FIX_IMPLEMENTATION.md (prerequisite fix)
- PR #197 (mutex race condition fix)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Expected Output**: Commit created successfully

```bash
# 4. Verify commit
git log -1 --pretty=format:"%s%n%n%b"
```

**Expected Output**: Shows commit message with full description

---

## Success Criteria

The implementation is complete and successful when ALL of the following are true:

### Code Changes
- [ ] 2 new tests added to `SettingsView.test.tsx` (lines after 231)
- [ ] 5 new tests added to `storage.test.ts` (new describe block after line 851)
- [ ] Total of 7 new tests added

### Test Execution
- [ ] All existing tests still pass (920+ tests)
- [ ] All 7 new tests pass
- [ ] No test failures or errors
- [ ] Test execution time reasonable (<5 minutes for full suite)

### Test Quality
- [ ] SettingsView tests verify actual parallelism (not just error handling)
- [ ] Storage tests verify data integrity under concurrent operations
- [ ] Stress tests (100 concurrent operations) pass without timeout
- [ ] All tests follow existing code style and patterns

### Code Quality
- [ ] No linting errors (`npm run lint` passes)
- [ ] Test coverage maintained or improved
- [ ] All tests use existing test utilities and mocks
- [ ] Tests follow naming conventions and structure

### Git Workflow
- [ ] Changes staged correctly (only test files)
- [ ] Commit message follows conventional commit format
- [ ] Commit description is comprehensive and clear
- [ ] Commit references related plans and PRs

---

## Validation Checklist

After implementation, verify the following:

### Functional Validation

#### SettingsView Integration Tests
- [ ] **Test: imports multiple categories in parallel**
  - [ ] Mock tracks call order correctly
  - [ ] `startsBeforeFirstEnd > 1` assertion passes
  - [ ] All 3 categories imported successfully
  - [ ] Success alert shown

- [ ] **Test: imports multiple prompts in parallel**
  - [ ] Mock tracks call order correctly
  - [ ] `startsBeforeFirstEnd > 1` assertion passes
  - [ ] All 3 prompts imported successfully
  - [ ] Success alert shown

#### Storage Unit Tests
- [ ] **Test: concurrent category imports (5 items)**
  - [ ] All 5 categories imported
  - [ ] No data loss or corruption
  - [ ] Each category has correct data

- [ ] **Test: concurrent prompt imports (10 items)**
  - [ ] All 10 prompts imported
  - [ ] No data loss or corruption
  - [ ] Each prompt has correct data

- [ ] **Test: mixed concurrent imports**
  - [ ] Update operation succeeds
  - [ ] Create operation succeeds
  - [ ] Storage contains both prompts

- [ ] **Test: 100 concurrent category imports**
  - [ ] All 100 categories imported
  - [ ] No timeout or memory issues
  - [ ] Data integrity maintained

- [ ] **Test: 100 concurrent prompt imports**
  - [ ] All 100 prompts imported
  - [ ] No timeout or memory issues
  - [ ] Data integrity maintained

### Coverage Validation
- [ ] Run `npm run test:coverage`
- [ ] Verify coverage for import methods:
  - [ ] `storageManager.importCategory()` has branch coverage
  - [ ] `storageManager.importPrompt()` has branch coverage
  - [ ] `handleImportData()` in SettingsView has line coverage

---

## Troubleshooting Guide

### Issue: Tests Timeout

**Symptoms**: Tests hang or timeout after 5+ seconds

**Possible Causes**:
1. Fake timers not advancing in SettingsView tests
2. Promise deadlock in storage tests
3. Infinite loop in mock implementations

**Solutions**:
1. Ensure `vi.advanceTimersByTimeAsync()` called in SettingsView tests
2. Verify all promises resolve (no `.then()` without `.catch()`)
3. Check mock implementations don't have infinite recursion

---

### Issue: Parallel Execution Tests Fail

**Symptoms**: `startsBeforeFirstEnd > 1` assertion fails

**Possible Causes**:
1. Operations executing sequentially (not parallel)
2. Mock implementation doesn't simulate async delay
3. Timer advancement happens too late

**Solutions**:
1. Verify `Promise.allSettled()` used in implementation
2. Ensure mock has `setTimeout(resolve, 10)` to simulate async
3. Call `vi.advanceTimersByTimeAsync(100)` before waiting for operations

---

### Issue: Data Loss in Storage Tests

**Symptoms**: Expected 10 prompts, found 5 (or similar)

**Possible Causes**:
1. Mutex race condition not fixed (should be fixed in PR #197)
2. Mock storage not handling concurrent writes
3. Test setup has timing issues

**Solutions**:
1. Verify mutex fix is merged and on current branch
2. Use real `chrome.storage.local` mock from test setup
3. Add `await` before all storage operations

---

### Issue: Linting Errors

**Symptoms**: ESLint reports errors after adding tests

**Possible Causes**:
1. Unused imports
2. Missing semicolons or trailing commas
3. Type assertions needed

**Solutions**:
1. Run `npm run lint:fix` to auto-fix
2. Add type assertions where needed: `as Category[]`
3. Verify all imports are used

---

## Performance Considerations

### Expected Test Execution Times

| Test | Expected Duration | Notes |
|------|------------------|-------|
| SettingsView: categories parallel | <500ms | Uses fake timers |
| SettingsView: prompts parallel | <500ms | Uses fake timers |
| Storage: 5 concurrent categories | <100ms | Direct storage API |
| Storage: 10 concurrent prompts | <200ms | Direct storage API |
| Storage: mixed concurrent | <200ms | Direct storage API |
| Storage: 100 concurrent categories | <1000ms | Stress test |
| Storage: 100 concurrent prompts | <1000ms | Stress test |

**Total Added Time**: ~2-3 seconds for all 7 new tests

---

## Related Documentation

### Implementation Plans
- **MUTEX_FIX_IMPLEMENTATION.md**: Details the mutex race condition fix (prerequisite)
- **PARALLEL_IMPORT_IMPLEMENTATION.md**: Original parallel import implementation plan

### Pull Requests
- **PR #197**: Mutex race condition fix (merged to main)

### Test Files
- **SettingsView.test.tsx**: Integration tests for UI-level import behavior
- **storage.test.ts**: Unit tests for storage-level concurrent operations

### Source Files
- **SettingsView.tsx**: Contains `handleImportData()` implementation (lines 501-570)
- **storage.ts**: Contains `importCategory()` and `importPrompt()` methods

---

## Risk Assessment

### Low Risk
- ✅ Implementation already complete and working
- ✅ Mutex fix already merged and tested
- ✅ Only adding tests, no implementation changes
- ✅ Tests are isolated and don't affect production code

### Medium Risk
- ⚠️ Stress tests (100 concurrent operations) may expose edge cases
- ⚠️ Fake timer advancement in SettingsView tests may be tricky

### Mitigation Strategies
1. **Stress Test Edge Cases**:
   - Start with smaller stress tests (10, 20, 50) before jumping to 100
   - Add timeout buffer in test configuration if needed
   - Monitor memory usage during stress tests

2. **Fake Timer Issues**:
   - Follow existing SettingsView test patterns for timer advancement
   - Use `vi.advanceTimersByTimeAsync()` consistently
   - Test locally before committing

---

## Timeline Estimate

**Total Implementation Time**: 2-3 hours

- **Step 1: Pre-verification**: 15 minutes
- **Step 2: SettingsView tests**: 45 minutes
  - Writing tests: 30 minutes
  - Debugging/fixing: 15 minutes
- **Step 3: Storage tests**: 60 minutes
  - Writing tests: 40 minutes
  - Debugging/fixing: 20 minutes
- **Step 4: Full verification**: 20 minutes
- **Step 5: Commit**: 10 minutes
- **Buffer**: 10-30 minutes

---

## Conclusion

This implementation plan provides a comprehensive, step-by-step guide to adding the missing parallel import test coverage. By following this plan, a developer can implement the tests with confidence, knowing that:

1. ✅ All tests target the existing implementation (no code changes needed)
2. ✅ Tests verify both success scenarios and concurrent behavior
3. ✅ Stress tests ensure scalability to high concurrency
4. ✅ Prerequisites (mutex fix) are already complete
5. ✅ Success criteria are clearly defined and measurable

The parallel import functionality is already working correctly in production. These tests will ensure it continues to work correctly and prevent regressions in future changes.

---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, data-integrity, testing, integration, pr-156]
dependencies: ["001"]
---

# Test Hooks Through Real Storage Layer

## Problem Statement

Hook tests (`usePrompts`, `useCategories`, `useTheme`) use service-level mocks instead of testing through the real storage layer. This creates a critical disconnect from actual data flow and prevents tests from catching storage-related bugs, race conditions, quota issues, and data integrity problems.

**Current State:**
- Hook tests mock StorageManager and PromptManager
- Tests validate mock behavior, not real storage behavior
- Storage layer completely bypassed in hook tests
- No integration testing between hooks and storage

**Impact:**
- Tests pass but don't guarantee hooks work with real storage
- Race conditions, mutex locking, and quota checks untested
- Data normalization and validation logic not exercised
- False confidence in hook behavior

## Findings

**Discovered during code review by:**
- data-integrity-guardian agent
- Integration testing analysis
- Test architecture review

**Locations:**
- `src/hooks/__tests__/usePrompts.test.ts` (lines 10-36)
- `src/hooks/__tests__/useCategories.test.ts` (lines 10-37)
- `src/hooks/__tests__/useTheme.test.ts` (lines 10-40)

## Current Implementation Problems

### Example: usePrompts.test.ts

**Current (Mocked Services):**
```typescript
// Lines 10-36
vi.mock('../../services/storage', () => {
  const mockStorageManager = {
    getPrompts: vi.fn(),
    savePrompt: vi.fn(),
    deletePrompt: vi.fn(),
    updatePrompt: vi.fn()
  };
  return {
    StorageManager: {
      getInstance: () => mockStorageManager
    }
  };
});

vi.mock('../../services/promptManager', () => {
  const mockPromptManager = {
    searchPrompts: vi.fn(),
    validatePromptData: vi.fn()
  };
  return {
    PromptManager: {
      getInstance: () => mockPromptManager
    }
  };
});

describe('usePrompts', () => {
  it('should delete a prompt', async () => {
    vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
    vi.mocked(mockStorageManager.deletePrompt).mockResolvedValue();

    const { result } = renderHook(() => usePrompts());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deletePrompt('prompt-1');
    });

    expect(mockStorageManager.deletePrompt).toHaveBeenCalledWith('prompt-1');
  });
});
```

**Problems with This Approach:**

1. **Bypasses Actual Storage Implementation**
   - StorageManager has mutex locking - not tested
   - Chrome storage quota logic - not tested
   - Error handling and retries - not tested
   - Change listeners and events - not tested

2. **Unrealistic Test Data**
   ```typescript
   const mockPrompts: Prompt[] = [
     {
       id: '1',
       title: 'React Hooks Guide',
       content: 'Learn about useState',
       category: 'Development',
       createdAt: 1000,  // ⚠️ Jan 1, 1970 - unrealistic!
       updatedAt: 1000,
       usageCount: 5,
       lastUsedAt: 1000
     }
   ];
   ```

3. **Missing Integration Scenarios**
   - Multiple hooks accessing storage concurrently
   - Storage errors and recovery
   - Browser storage API failures
   - Data corruption handling

4. **False Positives**
   ```typescript
   // This test passes but doesn't prove the hook works
   expect(mockStorageManager.deletePrompt).toHaveBeenCalledWith('prompt-1');
   // Did the prompt actually get deleted from storage? Unknown!
   ```

## Recommended Implementation

### Option 1: Integration Tests with InMemoryStorage (Recommended)

**Approach:** Replace service mocks with real storage

```typescript
import { InMemoryStorage } from '../../test/utils/InMemoryStorage';
import { buildPrompt } from '../../test/builders';

describe('usePrompts - Integration Tests', () => {
  let storage: InMemoryStorage;

  beforeEach(async () => {
    // Use REAL storage implementation
    storage = new InMemoryStorage();
    global.chrome = {
      storage: { local: storage }
    } as any;

    // Seed with realistic data
    await storage.set({
      prompts: [
        buildPrompt({
          id: 'prompt-1',
          title: 'Test Prompt',
          content: 'Test content',
          category: 'Development',
          createdAt: Date.now() - 86400000,  // 1 day ago (realistic!)
          updatedAt: Date.now() - 3600000,   // 1 hour ago
          usageCount: 5,
          lastUsedAt: Date.now() - 3600000
        })
      ],
      categories: [
        { id: 'cat-1', name: 'Development' }
      ],
      settings: {
        defaultCategory: 'Development',
        sortOrder: 'updatedAt',
        sortDirection: 'desc',
        theme: 'light'
      }
    });
  });

  afterEach(() => {
    // Cleanup
    delete (global as any).chrome;
  });

  describe('Loading', () => {
    it('should load prompts from storage on mount', async () => {
      const { result } = renderHook(() => usePrompts());

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.prompts).toEqual([]);

      // Wait for load
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Verify prompts loaded
      expect(result.current.prompts).toHaveLength(1);
      expect(result.current.prompts[0]?.title).toBe('Test Prompt');
    });

    it('should handle storage errors gracefully', async () => {
      // Simulate storage failure
      vi.spyOn(storage, 'get').mockRejectedValue(new Error('Storage unavailable'));

      const { result } = renderHook(() => usePrompts());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.prompts).toEqual([]);
    });
  });

  describe('Deleting Prompts', () => {
    it('should delete prompt from storage', async () => {
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => expect(result.current.prompts).toHaveLength(1));

      // Delete prompt
      await act(async () => {
        await result.current.deletePrompt('prompt-1');
      });

      // Verify through storage (integration test!)
      const data = await storage.get(['prompts']);
      expect(data.prompts).toHaveLength(0);
      expect(result.current.prompts).toHaveLength(0);
    });

    it('should handle concurrent deletes correctly', async () => {
      // Add multiple prompts
      await storage.set({
        prompts: [
          buildPrompt({ id: 'prompt-1', title: 'Prompt 1' }),
          buildPrompt({ id: 'prompt-2', title: 'Prompt 2' }),
          buildPrompt({ id: 'prompt-3', title: 'Prompt 3' })
        ]
      });

      const { result } = renderHook(() => usePrompts());
      await waitFor(() => expect(result.current.prompts).toHaveLength(3));

      // Concurrent deletes (tests mutex locking)
      await act(async () => {
        await Promise.all([
          result.current.deletePrompt('prompt-1'),
          result.current.deletePrompt('prompt-2')
        ]);
      });

      // Verify correct state
      const data = await storage.get(['prompts']);
      expect(data.prompts).toHaveLength(1);
      expect(data.prompts[0].id).toBe('prompt-3');
    });
  });

  describe('Creating Prompts', () => {
    it('should validate and save new prompt to storage', async () => {
      const { result } = renderHook(() => usePrompts());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const newPromptData = {
        title: 'New Prompt',
        content: 'New content',
        categoryId: 'cat-1'
      };

      await act(async () => {
        await result.current.createPrompt(newPromptData);
      });

      // Verify through storage
      const data = await storage.get(['prompts']);
      expect(data.prompts).toHaveLength(2);
      expect(data.prompts.some(p => p.title === 'New Prompt')).toBe(true);
    });

    it('should reject invalid prompt data', async () => {
      const { result } = renderHook(() => usePrompts());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const invalidData = {
        title: '',  // Empty title (invalid)
        content: 'Content',
        categoryId: 'cat-1'
      };

      await act(async () => {
        await expect(
          result.current.createPrompt(invalidData)
        ).rejects.toThrow();
      });

      // Verify storage unchanged
      const data = await storage.get(['prompts']);
      expect(data.prompts).toHaveLength(1);  // Original prompt only
    });
  });

  describe('Updating Prompts', () => {
    it('should update prompt in storage with correct timestamps', async () => {
      const { result } = renderHook(() => usePrompts());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const originalPrompt = result.current.prompts[0];
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      await act(async () => {
        await result.current.updatePrompt('prompt-1', updateData);
      });

      // Verify through storage
      const data = await storage.get(['prompts']);
      const updated = data.prompts[0];

      expect(updated.title).toBe('Updated Title');
      expect(updated.updatedAt).toBeGreaterThan(originalPrompt.createdAt);
      expect(updated.createdAt).toBe(originalPrompt.createdAt);  // Unchanged
    });
  });

  describe('Search Functionality', () => {
    it('should search prompts through PromptManager', async () => {
      // Add multiple prompts with searchable content
      await storage.set({
        prompts: [
          buildPrompt({ id: '1', title: 'React Hooks', content: 'useState' }),
          buildPrompt({ id: '2', title: 'Vue Guide', content: 'composition API' }),
          buildPrompt({ id: '3', title: 'React Context', content: 'useContext' })
        ]
      });

      const { result } = renderHook(() => usePrompts());
      await waitFor(() => expect(result.current.prompts).toHaveLength(3));

      // Search for React
      const reactResults = result.current.searchPrompts('React');
      expect(reactResults).toHaveLength(2);
      expect(reactResults.every(p => p.title.includes('React'))).toBe(true);
    });
  });
});
```

**Benefits:**
- ✅ Tests actual integration with storage
- ✅ Catches real bugs (race conditions, data corruption)
- ✅ Tests mutex locking and concurrent operations
- ✅ Realistic timestamps and data
- ✅ Validates storage state directly
- ✅ Tests error handling and recovery

**LOC Impact:** ~Same number of lines, better quality

---

### Option 2: Keep Unit Tests + Add Integration Tests

**Approach:** Keep existing mocked tests, add new integration suite

```typescript
// Keep existing: src/hooks/__tests__/usePrompts.test.ts
// Add new: src/hooks/__tests__/usePrompts.integration.test.ts

describe('usePrompts - Integration Tests', () => {
  // Integration tests with real storage
});
```

**Pros:**
- Preserves existing tests
- Adds integration coverage
- Both unit and integration tests

**Cons:**
- More tests to maintain (2x)
- Duplication between unit and integration tests
- Slower test suite

**Effort:** Medium (4-5 hours)

## Recommended Action

**Option 1** - Replace mocked tests with integration tests

**Rationale:**
- Hook tests SHOULD be integration tests (hooks + storage)
- Eliminates duplicate test maintenance
- Aligns with Finding #1 (activate InMemoryStorage)
- Better reflects real usage patterns

## Technical Details

**Files to Modify:**
- `src/hooks/__tests__/usePrompts.test.ts` (779 lines)
- `src/hooks/__tests__/useCategories.test.ts` (662 lines)
- `src/hooks/__tests__/useTheme.test.ts` (777 lines)

**Changes Required:**

1. **Remove service mocks**
   ```typescript
   // DELETE these blocks
   vi.mock('../../services/storage', () => { ... });
   vi.mock('../../services/promptManager', () => { ... });
   ```

2. **Add InMemoryStorage setup**
   ```typescript
   import { InMemoryStorage } from '../../test/utils/InMemoryStorage';
   import { buildPrompt, buildCategory } from '../../test/builders';

   let storage: InMemoryStorage;

   beforeEach(async () => {
     storage = new InMemoryStorage();
     global.chrome = { storage: { local: storage } } as any;
     // Seed with data...
   });
   ```

3. **Update assertions**
   ```typescript
   // OLD: expect(mockStorageManager.deletePrompt).toHaveBeenCalled();
   // NEW:
   const data = await storage.get(['prompts']);
   expect(data.prompts).toHaveLength(expectedLength);
   ```

4. **Add integration scenarios**
   - Concurrent operations
   - Storage errors
   - Quota checks
   - Data validation
   - Race conditions

**New Test Scenarios to Add:**

```typescript
describe('Concurrent Operations', () => {
  it('should handle multiple hooks accessing storage', async () => {
    // Render multiple hook instances
    const { result: result1 } = renderHook(() => usePrompts());
    const { result: result2 } = renderHook(() => usePrompts());

    // Both should load same data
    await waitFor(() => {
      expect(result1.current.prompts).toEqual(result2.current.prompts);
    });

    // Update from one hook
    await act(async () => {
      await result1.current.updatePrompt('prompt-1', { title: 'Updated' });
    });

    // Other hook should eventually see update
    // (tests storage change listeners)
  });
});

describe('Storage Errors', () => {
  it('should recover from transient storage failures', async () => {
    let failCount = 0;
    vi.spyOn(storage, 'get').mockImplementation(async (...args) => {
      if (failCount++ < 2) {
        throw new Error('Storage temporarily unavailable');
      }
      return storage.get.apply(storage, args);
    });

    // Hook should retry and eventually succeed
    const { result } = renderHook(() => usePrompts());
    await waitFor(() => expect(result.current.prompts).toHaveLength(1));
  });
});
```

## Dependencies

**Depends on:**
- Finding #001: Activate InMemoryStorage (must be done first)

**Blocked by:** None

**Blocks:**
- Complete integration test coverage
- Confidence in production hook behavior

## Acceptance Criteria

- [ ] All hook tests use InMemoryStorage (no service mocks)
- [ ] Service mocks removed from usePrompts, useCategories, useTheme tests
- [ ] Tests verify storage state directly
- [ ] Realistic test data (proper timestamps)
- [ ] Concurrent operation tests added
- [ ] Storage error handling tests added
- [ ] All 1,244 tests continue to pass
- [ ] Test runtime doesn't significantly increase (<10% slower)
- [ ] Integration test patterns documented

## Work Log

### 2025-11-06 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during data integrity review
- Analyzed by data-integrity-guardian agent
- Identified service-level mocking as integration gap
- Proposed InMemoryStorage-based approach

**Current Test Coverage Gaps:**
- ❌ Mutex locking not tested
- ❌ Concurrent operations not tested
- ❌ Storage quota logic not tested
- ❌ Change listeners not tested
- ❌ Data normalization not tested
- ❌ Race conditions not tested

**After This Fix:**
- ✅ Full integration coverage
- ✅ Real storage behavior tested
- ✅ Concurrent operations validated
- ✅ Error handling verified

**Learnings:**
- Hook tests should be integration tests
- Service mocks hide integration issues
- InMemoryStorage provides real behavior without Chrome dependency
- Realistic test data matters for catching bugs

## Notes

**Priority Justification:**
- P2 (Important) because tests pass but provide false confidence
- Should be addressed before production issues arise
- Aligns with InMemoryStorage activation (Finding #001)
- Improves overall test quality significantly

**Related Issues:**
- Finding #001: Activate InMemoryStorage (prerequisite)
- Finding #002: Weak import validation (not tested in hooks)
- Testing architecture needs integration layer

**Testing Philosophy:**
Hook tests sit at the integration layer:
- Unit tests: Test individual functions/utilities
- **Integration tests: Test hooks + storage + services** ← We are here
- E2E tests: Test entire Chrome extension in browser

Hooks are inherently integration points, so mocking services defeats the purpose.

**Migration Path:**
1. Activate InMemoryStorage (Finding #001) ← Do this first
2. Update usePrompts.test.ts (proof of concept)
3. Verify all tests pass and improve coverage
4. Update useCategories.test.ts (apply learnings)
5. Update useTheme.test.ts (complete migration)
6. Document integration test patterns

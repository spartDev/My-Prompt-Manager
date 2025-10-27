# WXT Testing Migration Guide

## Overview

This document guides the migration from our custom Chrome API mocks to WXT's official `@webext-core/fake-browser` implementation.

## ⚠️ Migration Status: On Hold - Waiting for WXT API Coverage

**Decision Date:** 2025-10-27
**Decision:** Wait for WXT improvements (Option 1)

**Reason:** WXT's `@webext-core/fake-browser` doesn't implement several Chrome APIs we depend on, most critically `chrome.action.onClicked.addListener`. Enabling `WxtVitest()` causes 1,203 test failures.

**Next Steps:** Monitor WXT releases for improved API coverage, then revisit migration.

## Current State (Before Migration)

- **Custom setup:** 530-line `src/test/setup.ts` with manual Chrome API mocks
- **Stateful storage:** Custom in-memory storage with change listeners
- **Singleton mocks:** Method-level spies on StorageManager and PromptManager
- **Test count:** 1,211 tests across 57 files ✅ All passing

## Target State (After Migration)

- **WXT integration:** `WxtVitest()` plugin handles Chrome API mocking automatically
- **Fake browser:** `@webext-core/fake-browser` provides realistic in-memory APIs
- **Simplified setup:** Minimal test configuration
- **Same test count:** All 1,211 tests working with WXT infrastructure

---

## Migration Strategy: Gradual Transition

We're using a **coexistence approach** where both old and new systems work together during migration.

### Phase 1: Enable WXT Plugin ✅ COMPLETED

**File:** `vitest.config.ts`

```typescript
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [
    WxtVitest(), // Adds Chrome API mocks automatically
  ],
});
```

**What this provides:**
- `browser` global (WebExtension polyfill)
- `chrome` global (Chrome API)
- `fakeBrowser` from `wxt/testing` for manual event triggering
- Import alias resolution (`@/*`)
- Auto-imports configuration

### Phase 2: Update Test Setup (Current)

**File:** `src/test/setup.ts`

Add WXT's fakeBrowser alongside existing mocks:

```typescript
import { fakeBrowser } from 'wxt/testing';

// Export for tests to use
export { fakeBrowser };

beforeEach(() => {
  // Reset WXT's fake browser
  fakeBrowser.reset();

  // Keep existing mock resets for now
  vi.clearAllMocks();
  resetChromeMocks();
});
```

### Phase 3: Migrate Tests Gradually (Next Steps)

Migrate one test file at a time, starting with the simplest:

#### Example: Storage Test Migration

**Before (Custom Mocks):**
```typescript
import { StorageManager } from '../storage';

beforeEach(() => {
  const mockStorage = {
    prompts: [],
    categories: [...],
  };

  vi.mocked(chrome.storage.local.get).mockImplementation((keys) => {
    // Complex manual implementation
  });
});

it('saves prompt', async () => {
  const manager = StorageManager.getInstance();
  await manager.savePrompt({ title: 'Test', content: 'Content' });

  expect(chrome.storage.local.set).toHaveBeenCalled();
});
```

**After (WXT Fake Browser):**
```typescript
import { fakeBrowser } from 'wxt/testing';
import { StorageManager } from '../storage';

beforeEach(() => {
  fakeBrowser.reset(); // Automatic in-memory storage!
});

it('saves prompt', async () => {
  const manager = StorageManager.getInstance();
  await manager.savePrompt({ title: 'Test', content: 'Content' });

  // Verify using actual storage API
  const { prompts } = await browser.storage.local.get('prompts');
  expect(prompts).toHaveLength(1);
  expect(prompts[0].title).toBe('Test');
});
```

**Benefits:**
- No manual mock implementation
- Storage actually works like real Chrome storage
- Change listeners fire automatically
- Cleaner, more readable tests

---

## Migration Checklist

### Tests to Migrate (Prioritized)

#### High Priority (Foundation)
- [ ] `src/services/__tests__/storage.test.ts` - Core storage operations
- [ ] `src/services/__tests__/promptManager.working.test.ts` - Prompt management
- [ ] `src/hooks/__tests__/usePrompts.test.ts` - Storage-backed hook

#### Medium Priority (Components)
- [ ] `src/components/__tests__/AddPromptForm.test.tsx` - Simple component
- [ ] `src/components/__tests__/PromptCard.test.tsx` - Card rendering
- [ ] `src/hooks/__tests__/useToast.test.ts` - Stateful hook

#### Low Priority (Complex)
- [ ] `src/content/core/__tests__/injector.test.ts` - Heavy DOM manipulation
- [ ] `src/background/__tests__/background.injector.test.ts` - Background script

#### New Tests (WXT-Specific)
- [ ] `src/entrypoints/__tests__/background.test.ts` - **NEW**: Test defineBackground wrapper
- [ ] `src/entrypoints/__tests__/content.test.ts` - **NEW**: Test defineContentScript wrapper

---

## WXT Testing Patterns

### Pattern 1: Storage Operations

```typescript
import { fakeBrowser } from 'wxt/testing';

describe('Storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('persists data', async () => {
    await browser.storage.local.set({ key: 'value' });
    const result = await browser.storage.local.get('key');
    expect(result.key).toBe('value');
  });

  it('triggers change listeners', async () => {
    const listener = vi.fn();
    browser.storage.onChanged.addListener(listener);

    await browser.storage.local.set({ key: 'new' });

    expect(listener).toHaveBeenCalledWith(
      { key: { newValue: 'new' } },
      'local'
    );
  });
});
```

### Pattern 2: Event Triggering

```typescript
import { fakeBrowser } from 'wxt/testing';

describe('Background Script', () => {
  it('handles tab updates', async () => {
    const handler = vi.fn();
    browser.tabs.onUpdated.addListener(handler);

    // Manually trigger event
    await fakeBrowser.tabs.onUpdated.trigger(
      123, // tabId
      { status: 'complete' }, // changeInfo
      { id: 123, url: 'https://example.com' } // tab
    );

    expect(handler).toHaveBeenCalledWith(
      123,
      { status: 'complete' },
      expect.objectContaining({ url: 'https://example.com' })
    );
  });
});
```

### Pattern 3: Message Passing

```typescript
import { fakeBrowser } from 'wxt/testing';

describe('Messaging', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('sends and receives messages', async () => {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_DATA') {
        sendResponse({ data: 'test' });
      }
      return true; // Keep channel open for async
    });

    const response = await browser.runtime.sendMessage({
      type: 'GET_DATA'
    });

    expect(response.data).toBe('test');
  });
});
```

---

## API Coverage

### Fully Implemented (Use Directly)
- ✅ `browser.storage.*` - In-memory storage with listeners
- ✅ `browser.tabs.*` - Tab management
- ✅ `browser.windows.*` - Window management

### Partially Implemented (Manual Triggering)
- ⚠️ `browser.runtime.*` - Events must be triggered with `fakeBrowser.runtime.onMessage.trigger()`
- ⚠️ `browser.alarms.*` - Alarms must be triggered manually
- ⚠️ `browser.notifications.*` - Events must be triggered manually

### Not Implemented (Manual Mocking)
For APIs not implemented by fakeBrowser, keep using `vi.mock()`:

```typescript
vi.mock('wxt/browser', () => ({
  browser: {
    downloads: {
      download: vi.fn().mockResolvedValue({ id: 123 }),
    },
  },
}));
```

---

## Testing Entrypoints

### NEW: Background Script Testing

```typescript
// src/entrypoints/__tests__/background.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

describe('Background Entrypoint', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('initializes ContentScriptInjector', async () => {
    // Import the entrypoint
    await import('../background');

    // Verify tab listener registered
    expect(browser.tabs.onUpdated.hasListener(/* ... */)).toBe(true);
  });

  it('handles side panel API', async () => {
    await import('../background');

    // Trigger installation
    await fakeBrowser.runtime.onInstalled.trigger({
      reason: 'install'
    });

    // Verify side panel configured
    expect(browser.sidePanel.setOptions).toHaveBeenCalled();
  });
});
```

### NEW: Content Script Testing

```typescript
// src/entrypoints/__tests__/content.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

describe('Content Script Entrypoint', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '<textarea id="chat"></textarea>';
  });

  it('initializes on document_idle', async () => {
    await import('../content');

    // Verify UI injected
    const icon = document.querySelector('[data-prompt-library-icon]');
    expect(icon).toBeTruthy();
  });

  it('respects site enablement settings', async () => {
    await browser.storage.local.set({
      settings: { enabledSites: [] }
    });

    await import('../content');

    // Should not inject on disabled site
    const icon = document.querySelector('[data-prompt-library-icon]');
    expect(icon).toBeNull();
  });
});
```

---

## Common Migration Issues

### Issue 1: Async Storage Not Awaited

**Before:**
```typescript
chrome.storage.local.set({ key: 'value' });
expect(chrome.storage.local.set).toHaveBeenCalled();
```

**After:**
```typescript
await browser.storage.local.set({ key: 'value' });
const result = await browser.storage.local.get('key');
expect(result.key).toBe('value');
```

### Issue 2: Mock Expectations vs. Real Behavior

**Before:**
```typescript
expect(chrome.storage.local.set).toHaveBeenCalledWith({
  prompts: expect.arrayContaining([...])
});
```

**After:**
```typescript
const { prompts } = await browser.storage.local.get('prompts');
expect(prompts).toEqual(expect.arrayContaining([...]));
```

### Issue 3: Event Listeners Need Manual Triggering

**Before:**
```typescript
storageChangeListeners.forEach(listener => {
  listener(changes, 'local');
});
```

**After:**
```typescript
await fakeBrowser.storage.onChanged.trigger(
  { key: { newValue: 'value' } },
  'local'
);
```

---

## Rollback Plan

If migration causes issues:

1. **Revert vitest.config.ts:**
   ```typescript
   plugins: [react()], // Remove WxtVitest()
   ```

2. **Remove fakeBrowser exports from setup.ts**

3. **Keep existing custom mocks**

4. **File issue with WXT project:** https://github.com/wxt-dev/wxt/issues

---

## Benefits After Migration

1. **Less Code to Maintain:** Remove 530 lines of custom mock setup
2. **More Realistic Tests:** Real Chrome storage behavior
3. **Automatic Updates:** WXT team maintains fakeBrowser
4. **Better Coverage:** Can now test entrypoints and WXT wrappers
5. **Official Support:** Community examples and documentation
6. **Faster Test Development:** No manual mock implementation

---

## Timeline

- **Phase 1 (Week 1):** ✅ Enable WXT plugin, coexistence setup
- **Phase 2 (Week 2):** Migrate 10 storage/service tests
- **Phase 3 (Week 3):** Migrate 15 component tests
- **Phase 4 (Week 4):** Migrate 10 hook tests
- **Phase 5 (Week 5):** Add new entrypoint tests
- **Phase 6 (Week 6):** Remove custom mocks, cleanup

**Total Migration Time:** ~6 weeks with gradual, safe approach

---

## Resources

- **WXT Testing Docs:** https://wxt.dev/guide/essentials/unit-testing.html
- **Fake Browser API:** https://webext-core.aklinker1.io/fake-browser/
- **Example Project:** https://github.com/wxt-dev/examples/tree/main/examples/vitest-unit-testing
- **Migration Support:** Create issues at https://github.com/wxt-dev/wxt/issues

---

## Monitoring WXT Improvements

### How to Check for API Coverage Updates

**1. Check WXT Releases:**
```bash
npm outdated wxt
```

**2. Review Changelog:**
Visit https://github.com/wxt-dev/wxt/releases and look for:
- `@webext-core/fake-browser` updates
- "chrome.action" API implementations
- Test infrastructure improvements

**3. Test WXT Integration:**
```bash
# Uncomment WxtVitest() in vitest.config.ts
# Run tests to see if chrome.action is now supported
npm test
```

**4. Check Fake Browser Source:**
```bash
# View current API implementation
cat node_modules/@webext-core/fake-browser/lib/index.js | grep -A 10 "action:"
```

### When to Revisit Migration

✅ **Ready to migrate when:**
- WXT release notes mention `chrome.action` support
- Tests pass with `WxtVitest()` enabled
- `@webext-core/fake-browser` implements missing APIs

### Quick Test Command

```bash
# Enable WxtVitest() in vitest.config.ts, then:
npm test 2>&1 | grep -c "chrome.action.onClicked.addListener not implemented"

# If output is 0, migration can proceed!
# If output > 0, wait for more WXT updates
```

---

## Notes

- All 1,211 existing tests continue passing with custom mocks
- Tests can be migrated one file at a time when ready
- Both mock systems can coexist during transition
- No breaking changes to test behavior expected
- **Current blocker:** `chrome.action.onClicked.addListener` not implemented in fakeBrowser

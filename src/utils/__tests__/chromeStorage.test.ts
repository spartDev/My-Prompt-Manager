import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ErrorType } from '../../types';
import { ensureStorageAvailable } from '../chromeStorage';

describe('ensureStorageAvailable', () => {
  let originalChrome: typeof chrome | undefined;

  beforeEach(() => {
    // Save original chrome object
    originalChrome = globalThis.chrome;
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original chrome object
    if (originalChrome) {
      globalThis.chrome = originalChrome;
    }
    vi.useRealTimers();
  });

  it('resolves immediately when chrome.storage.local is available', async () => {
    // chrome is already mocked globally in the test environment
    const promise = ensureStorageAvailable();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });

  it('throws error when chrome is undefined after max attempts', async () => {
    // @ts-expect-error - setting chrome to undefined for testing
    globalThis.chrome = undefined;

    const promise = ensureStorageAvailable({ maxAttempts: 3, delayMs: 10 });

    // Add catch handler before running timers to prevent unhandled rejection
    let thrownError: Error | null = null;
    promise.catch((e: unknown) => { thrownError = e as Error; });

    // Run through all retries
    await vi.runAllTimersAsync();

    // Wait for promise to settle
    try { await promise; } catch { /* expected */ }

    expect(thrownError).toMatchObject({
      message: expect.stringContaining('Chrome storage API is not available'),
      type: ErrorType.STORAGE_UNAVAILABLE,
      details: { maxAttempts: 3, delayMs: 10 }
    });
  });

  it('throws error when chrome.storage is undefined after max attempts', async () => {
    // @ts-expect-error - partial chrome mock for testing
    globalThis.chrome = {};

    const promise = ensureStorageAvailable({ maxAttempts: 3, delayMs: 10 });

    // Add catch handler before running timers to prevent unhandled rejection
    let thrownError: Error | null = null;
    promise.catch((e: unknown) => { thrownError = e as Error; });

    await vi.runAllTimersAsync();

    // Wait for promise to settle
    try { await promise; } catch { /* expected */ }

    expect(thrownError).toMatchObject({
      type: ErrorType.STORAGE_UNAVAILABLE
    });
  });

  it('throws error when chrome.storage.local is undefined after max attempts', async () => {
    // @ts-expect-error - partial chrome mock for testing
    globalThis.chrome = { storage: {} };

    const promise = ensureStorageAvailable({ maxAttempts: 3, delayMs: 10 });

    // Add catch handler before running timers to prevent unhandled rejection
    let thrownError: Error | null = null;
    promise.catch((e: unknown) => { thrownError = e as Error; });

    await vi.runAllTimersAsync();

    // Wait for promise to settle
    try { await promise; } catch { /* expected */ }

    expect(thrownError).toMatchObject({
      type: ErrorType.STORAGE_UNAVAILABLE
    });
  });

  it('resolves when chrome becomes available during retry', async () => {
    // Start with chrome undefined
    // @ts-expect-error - setting chrome to undefined for testing
    globalThis.chrome = undefined;

    const promise = ensureStorageAvailable({ maxAttempts: 5, delayMs: 100 });

    // Advance time for 2 attempts
    await vi.advanceTimersByTimeAsync(150);

    // Make chrome available
    if (originalChrome) {
      globalThis.chrome = originalChrome;
    }

    // Continue remaining retries
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
  });

  it('uses default options when not specified', async () => {
    // @ts-expect-error - setting chrome to undefined for testing
    globalThis.chrome = undefined;

    const promise = ensureStorageAvailable();

    // Add catch handler before running timers to prevent unhandled rejection
    let thrownError: Error | null = null;
    promise.catch((e: unknown) => { thrownError = e as Error; });

    // Should use 50 attempts with 100ms delay (5000ms total)
    // We'll verify by checking that it doesn't resolve immediately
    await vi.advanceTimersByTimeAsync(100);

    // Promise should still be pending
    let resolved = false;
    promise.then(() => { resolved = true; }).catch(() => { resolved = true; });

    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(false);

    // Now run all timers to let it complete (and reject)
    await vi.runAllTimersAsync();

    // Wait for promise to settle
    try { await promise; } catch { /* expected */ }

    expect(thrownError).toMatchObject({
      type: ErrorType.STORAGE_UNAVAILABLE,
      details: { maxAttempts: 50, delayMs: 100 }
    });
  });
});

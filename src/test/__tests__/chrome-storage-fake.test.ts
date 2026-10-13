/**
 * The shared chrome.storage.local fake (src/test/setup.ts) answers both ways Chrome does: a
 * promise when no callback is passed, and the callback, with nothing returned, when one is.
 * The content script reads storage with callbacks, so its tests can use the fake as it is.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('chrome.storage.local fake', () => {
  beforeEach(async () => {
    await chrome.storage.local.set({ greeting: 'hello', count: 1 });
  });

  it('returns a promise when no callback is passed', async () => {
    expect(await chrome.storage.local.get(['greeting', 'missing'])).toEqual({ greeting: 'hello' });
    await expect(chrome.storage.local.set({ count: 2 })).resolves.toBeUndefined();
    await expect(chrome.storage.local.remove('greeting')).resolves.toBeUndefined();
    expect(await chrome.storage.local.get(null)).toEqual({ count: 2 });
    await expect(chrome.storage.local.clear()).resolves.toBeUndefined();
    expect(await chrome.storage.local.get(null)).toEqual({});
  });

  it('passes what get read to the callback, and returns nothing', async () => {
    const callback = vi.fn();

    expect(chrome.storage.local.get(['greeting', 'missing'], callback)).toBeUndefined();

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ greeting: 'hello' });
    });
  });

  it('reads everything when get is given only a callback', async () => {
    const callback = vi.fn();

    expect(chrome.storage.local.get(callback)).toBeUndefined();

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith({ greeting: 'hello', count: 1 });
    });
  });

  it.each([
    ['set', (done: () => void) => chrome.storage.local.set({ count: 2 }, done), { greeting: 'hello', count: 2 }],
    ['remove', (done: () => void) => chrome.storage.local.remove('greeting', done), { count: 1 }],
    ['clear', (done: () => void) => chrome.storage.local.clear(done), {}]
  ])('calls back with no arguments once %s is done, and returns nothing', async (_method, write, expected) => {
    // Reads storage at the moment it is called back
    const done = vi.fn(() => chrome.storage.local.get(null));

    expect(write(done)).toBeUndefined();

    await vi.waitFor(() => {
      expect(done).toHaveBeenCalledTimes(1);
    });
    expect(done).toHaveBeenCalledWith();
    await expect(done.mock.results[0]?.value).resolves.toEqual(expected);
  });

  it('leaves chrome.runtime.lastError as the test set it', async () => {
    const lastError = { message: 'Storage error' };
    Reflect.set(chrome.runtime, 'lastError', lastError);
    const callback = vi.fn(() => chrome.runtime.lastError);

    chrome.storage.local.get('greeting', callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });
    expect(callback.mock.results[0]?.value).toBe(lastError);
    expect(chrome.runtime.lastError).toBe(lastError);
  });
});

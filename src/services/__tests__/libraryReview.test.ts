import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isReviewFilter,
  onLibraryReviewRequested,
  pendingReviewKey,
  requestLibraryReview,
  takePendingLibraryReview
} from '../libraryReview';

type ChangeListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void;

/** A session storage area over a plain object, and the side panel, on the chrome mock */
const installSession = (initial: Record<string, unknown> = {}) => {
  const data: Record<string, unknown> = { ...initial };
  const session = {
    get: vi.fn((key: string) => Promise.resolve(key in data ? { [key]: data[key] } : {})),
    set: vi.fn((items: Record<string, unknown>) => { Object.assign(data, items); return Promise.resolve(); }),
    remove: vi.fn((key: string) => { Reflect.deleteProperty(data, key); return Promise.resolve(); })
  };
  const open = vi.fn().mockResolvedValue(undefined);
  Object.assign(chrome.storage, { session });
  Object.assign(chrome, { sidePanel: { open } });
  Object.assign(chrome.windows, { getCurrent: vi.fn().mockResolvedValue({ id: 7 }) });
  return { data, session, open };
};

describe('isReviewFilter', () => {
  it('accepts the two Library filters Tidy up reviews', () => {
    expect(isReviewFilter({ kind: 'neverUsed' })).toBe(true);
    expect(isReviewFilter({ kind: 'duplicates', groups: [['a', 'b']] })).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isReviewFilter(null)).toBe(false);
    expect(isReviewFilter('neverUsed')).toBe(false);
    expect(isReviewFilter({ kind: 'all' })).toBe(false);
    expect(isReviewFilter({ kind: 'duplicates' })).toBe(false);
    expect(isReviewFilter({ kind: 'duplicates', groups: [['a', 1]] })).toBe(false);
  });
});

describe('requestLibraryReview', () => {
  it('opens the side panel of the window before anything is awaited, and leaves the filter in session storage', async () => {
    const { data, open, session } = installSession();

    const request = requestLibraryReview({ kind: 'neverUsed' }, 7);

    // Within the click: Chrome refuses the side panel once the user gesture is gone
    expect(open).toHaveBeenCalledWith({ windowId: 7 });
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(session.set.mock.invocationCallOrder[0]);
    await request;
    expect(data[pendingReviewKey(7)]).toEqual({ kind: 'neverUsed' });
  });

  it('fails when the side panel cannot be opened, and leaves no review waiting for a later opening', async () => {
    const { data, open } = installSession();
    open.mockRejectedValue(new Error('no user gesture'));

    await expect(requestLibraryReview({ kind: 'neverUsed' }, 7)).rejects.toThrow('no user gesture');
    expect(data).toEqual({});
    expect(await takePendingLibraryReview()).toBeNull();
  });
});

describe('requestLibraryReview, when the review cannot be left for the panel', () => {
  it('fails, though the side panel opened', async () => {
    const { open, session } = installSession();
    session.set.mockRejectedValue(new Error('session storage failed'));

    await expect(requestLibraryReview({ kind: 'neverUsed' }, 7)).rejects.toThrow('session storage failed');
    expect(open).toHaveBeenCalledWith({ windowId: 7 });
  });
});

describe('takePendingLibraryReview', () => {
  beforeEach(() => {
    Reflect.deleteProperty(chrome.storage, 'session');
  });

  it('gives the waiting review once', async () => {
    installSession({ [pendingReviewKey(7)]: { kind: 'duplicates', groups: [['a', 'b']] } });

    expect(await takePendingLibraryReview()).toEqual({ kind: 'duplicates', groups: [['a', 'b']] });
    expect(await takePendingLibraryReview()).toBeNull();
  });

  it('gives none when nothing waits', async () => {
    installSession();

    expect(await takePendingLibraryReview()).toBeNull();
  });

  it('drops what is not a review filter', async () => {
    const { data } = installSession({ [pendingReviewKey(7)]: { kind: 'category', categoryId: 'x' } });

    expect(await takePendingLibraryReview()).toBeNull();
    expect(data).toEqual({});
  });

  it('leaves a review asked in another window for the side panel of that window', async () => {
    const { data } = installSession({ [pendingReviewKey(8)]: { kind: 'neverUsed' } });

    expect(await takePendingLibraryReview()).toBeNull();
    expect(data[pendingReviewKey(8)]).toEqual({ kind: 'neverUsed' });
  });

  it('keeps the reviews of two windows apart: one asked in another window does not replace this one', async () => {
    const { data } = installSession();
    await requestLibraryReview({ kind: 'neverUsed' }, 7);
    await requestLibraryReview({ kind: 'duplicates', groups: [['a', 'b']] }, 8);

    expect(await takePendingLibraryReview()).toEqual({ kind: 'neverUsed' });
    expect(data).toEqual({ [pendingReviewKey(8)]: { kind: 'duplicates', groups: [['a', 'b']] } });
  });

  it('gives none where session storage does not exist', async () => {
    expect(await takePendingLibraryReview()).toBeNull();
  });
});

describe('onLibraryReviewRequested', () => {
  it('calls back when a review is left in session storage, and no more once unsubscribed', () => {
    const listeners: ChangeListener[] = [];
    vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(listener => { listeners.push(listener as ChangeListener); });
    const removeListener = vi.mocked(chrome.storage.onChanged.removeListener);
    const listener = vi.fn();

    const unsubscribe = onLibraryReviewRequested(listener);
    const emit = listeners[listeners.length - 1];
    emit({ [pendingReviewKey(7)]: { newValue: { kind: 'neverUsed' } } }, 'session');
    emit({ [pendingReviewKey(7)]: { oldValue: { kind: 'neverUsed' } } }, 'session');
    emit({ [pendingReviewKey(7)]: { newValue: { kind: 'neverUsed' } } }, 'local');
    emit({ other: { newValue: 1 } }, 'session');

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(removeListener).toHaveBeenCalledWith(emit);
  });
});

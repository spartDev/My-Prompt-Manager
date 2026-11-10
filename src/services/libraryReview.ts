/**
 * A review asked from the full-page Analytics view. That page is a browser tab of its own, so it
 * cannot set the Library filter of the popup or side panel: it leaves the filter in session storage
 * and opens the side panel, which takes it and shows the Library on it.
 */

import type { LibraryFilter } from '../types';

/** The Library filters Tidy up offers to review (see CONTEXT.md) */
export type ReviewFilter = Extract<LibraryFilter, { kind: 'neverUsed' | 'duplicates' }>;

/** A review waits under a key of its own window, so two windows asking at once do not replace each other */
export const PENDING_REVIEW_PREFIX = 'pendingLibraryReview:';
export const pendingReviewKey = (windowId: number): string => `${PENDING_REVIEW_PREFIX}${String(windowId)}`;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/** Session storage is untyped: what is read from it is checked before it becomes a Library filter */
export function isReviewFilter(value: unknown): value is ReviewFilter {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const filter = value as { kind?: unknown; groups?: unknown };
  if (filter.kind === 'neverUsed') {
    return true;
  }
  return filter.kind === 'duplicates' && Array.isArray(filter.groups) && filter.groups.every(isStringArray);
}

/**
 * Opens the side panel of a window on the Prompts to review. Call it from a click: Chrome opens the
 * side panel only in answer to a user gesture, so the panel is asked for before anything is awaited.
 * The review is left for that window alone: a side panel open in another window does not take it.
 * When the panel cannot be opened, no review is left waiting and the call fails. It fails too when
 * the review cannot be left for the panel, which then opens where it was.
 */
export async function requestLibraryReview(filter: ReviewFilter, windowId: number): Promise<void> {
  const key = pendingReviewKey(windowId);
  const opened = chrome.sidePanel.open({ windowId });
  const [panel, written] = await Promise.allSettled([opened, chrome.storage.session.set({ [key]: filter })]);
  if (panel.status === 'rejected') {
    // No panel took the review: left waiting, it would redirect the Library the next time the panel opens
    await chrome.storage.session.remove(key);
    throw panel.reason;
  }
  if (written.status === 'rejected') {
    // The panel opened with no review to take: the caller says so
    throw written.reason;
  }
}

/** The review waiting for the side panel of this window, if any; it is taken once */
export async function takePendingLibraryReview(): Promise<ReviewFilter | null> {
  const session = (chrome.storage as Partial<typeof chrome.storage>).session;
  if (!session) {
    return null;
  }
  const { id } = await chrome.windows.getCurrent();
  if (id === undefined) {
    return null;
  }
  const key = pendingReviewKey(id);
  const stored = await session.get(key);
  const pending: unknown = stored[key];
  if (pending === undefined) {
    return null;
  }
  await session.remove(key);
  return isReviewFilter(pending) ? pending : null;
}

/**
 * Calls back when a review is asked, in any window, while the side panel is open: the panel then
 * takes the one of its own window, if there is one. Returns the unsubscribe.
 */
export function onLibraryReviewRequested(listener: () => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
    if (areaName === 'session' && Object.entries(changes).some(([key, change]) => key.startsWith(PENDING_REVIEW_PREFIX) && change.newValue !== undefined)) {
      listener();
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => { chrome.storage.onChanged.removeListener(handler); };
}

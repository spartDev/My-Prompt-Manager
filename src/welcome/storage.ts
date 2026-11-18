/**
 * The Welcome record: the Welcome still to finish, with the step and the Packs it resumes at, or
 * the Welcome finished. One `chrome.storage.local` key, apart from the Site settings, so Reset
 * settings leaves it; Clear All Data and the Reset Data of the error screen keep it too
 * (`src/services/clearStorage.ts`), so the Welcome never comes back after a clear.
 *
 * This module is its only reader and its low-level writer; the launch decision reads the key in its
 * one get with the What's new record and the Site settings (src/hooks/useLaunchScreen.ts) and parses
 * it with `parseWelcomeRecord`. The service worker records the facts of the install with
 * `recordWelcomePending` ('install') and `markExistingUserDone` ('update'); the launch writer of the
 * popup and side panel (`writeLaunchState`, src/launch/write.ts) writes the steps and the end with
 * `writeWelcomeRecord`. Nothing else writes it (src/test/guardrails/launch-state-guardrails.test.ts).
 * A done record is final: no write of this module replaces it.
 * Terms: CONTEXT.md, "Welcome".
 */

import { AsyncMutex } from '../utils/asyncMutex';

/** The `chrome.storage.local` key the Welcome record is stored under */
export const WELCOME_KEY = 'welcome';

/** A screen of the Welcome: 0, 1 and 2 for its first, second and third step */
export type WelcomeStep = 0 | 1 | 2;

export type WelcomeRecord =
  | {
      readonly status: 'pending';
      /** The step the Welcome resumes at */
      readonly step: WelcomeStep;
      /** The ids of the Packs the user selected on the last step; absent until the user changes the selection */
      readonly packs?: readonly string[];
    }
  | { readonly status: 'done' };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStep = (value: unknown): value is WelcomeStep => value === 0 || value === 1 || value === 2;

const isPackList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string');

/** The record exactly as typed, without any other field a caller's object may carry */
const ownFields = (record: WelcomeRecord): WelcomeRecord =>
  record.status === 'done'
    ? { status: 'done' }
    : { status: 'pending', step: record.step, ...(record.packs === undefined ? {} : { packs: [...record.packs] }) };

/**
 * The record a stored value stands for, or undefined for no record. Never throws.
 *
 * - A value that is not an object, or whose status is neither 'pending' nor 'done', is no record.
 * - 'done' is done, whatever else the value holds.
 * - 'pending' resumes at its step when that is 0, 1 or 2, else at step 0, so the Welcome starts
 *   over rather than being lost; it keeps its Packs only when they are a list of strings, else it
 *   has none, which gives the Welcome's default selection back rather than an empty one.
 */
export const parseWelcomeRecord = (stored: unknown): WelcomeRecord | undefined => {
  if (!isObject(stored)) {
    return undefined;
  }
  if (stored.status === 'done') {
    return { status: 'done' };
  }
  if (stored.status !== 'pending') {
    return undefined;
  }
  return {
    status: 'pending',
    step: isStep(stored.step) ? stored.step : 0,
    ...(isPackList(stored.packs) ? { packs: [...stored.packs] } : {})
  };
};

/** The record as storage has it, or undefined for none. Rejects only when storage cannot be read. */
export const readWelcomeRecord = async (): Promise<WelcomeRecord | undefined> => {
  const result = await chrome.storage.local.get([WELCOME_KEY]);
  return parseWelcomeRecord(result[WELCOME_KEY]);
};

// Shared by the popup, the side panel and the service worker through the Web Locks API. Clear All
// Data takes it last, innermost, after the What's new lock (StorageManager.clearAllData), so a write
// waiting in another context lands before the clear or after it, never in the middle.
const welcomeLock = new AsyncMutex({ scope: 'Welcome' });

/** Runs an operation while no context can change the Welcome record */
export function withWelcomeLock<T>(operation: () => Promise<T>): Promise<T> {
  return welcomeLock.withLock(WELCOME_KEY, operation);
}

/**
 * Writes the record `next` makes of what storage holds, or nothing when it makes none; under the
 * lock, so nothing writes in between
 */
const writeOver = (next: (stored: WelcomeRecord | undefined) => WelcomeRecord | undefined): Promise<boolean> =>
  withWelcomeLock(async () => {
    const record = next(await readWelcomeRecord());
    if (record === undefined) {
      return false;
    }
    await chrome.storage.local.set({ [WELCOME_KEY]: ownFields(record) });
    return true;
  });

/**
 * Writes the Welcome record: the step reached, its Packs, or the end. The low-level writer of the
 * launch writer (src/launch/write.ts), nothing else.
 *
 * - A step is written only over a pending record, so the popup and the side panel never make a
 *   record the service worker did not: no record, or one storage cannot read, stays as it is. A step
 *   without Packs keeps the Packs stored; with Packs, an empty selection included, it replaces them.
 * - The end is written over anything but the end: a Welcome the user finished is final, whatever
 *   storage held.
 * - A done record is never replaced, so a step written late, by a second popup or side panel still
 *   on the Welcome, cannot bring a finished Welcome back.
 *
 * Rejects, with storage untouched, when storage cannot be read or written.
 *
 * @returns Whether it wrote
 */
export const writeWelcomeRecord = (record: WelcomeRecord): Promise<boolean> =>
  writeOver((stored) => {
    if (stored?.status === 'done') {
      return undefined;
    }
    if (record.status === 'done') {
      return record;
    }
    if (stored?.status !== 'pending') {
      return undefined;
    }
    return record.packs === undefined && stored.packs !== undefined ? { ...record, packs: stored.packs } : record;
  });

/**
 * Records the Welcome as pending, from its first step. The service worker calls it on
 * `onInstalled` 'install'. It writes only where storage holds no record: a first install starts on
 * an empty store, and a record already there is kept, so a finished Welcome stays finished and an
 * unfinished one resumes at its step. (Chromium fires 'install' again, store kept, at every launch
 * of an extension loaded with --load-extension, as the e2e tests load it.)
 *
 * @returns Whether it wrote
 */
export const recordWelcomePending = (): Promise<boolean> =>
  writeOver((stored) => (stored === undefined ? { status: 'pending', step: 0 } : undefined));

/**
 * Marks the Welcome as done for an existing user. The service worker calls it on `onInstalled`
 * 'update'. An install from before the Welcome (1.9.0 and earlier) has no record, and its user must
 * never see the Welcome; a value storage holds but cannot be read as a record counts as none. A
 * record is kept: a pending one (installed, the Welcome left unfinished, then updated) resumes,
 * as the user decided (decision Q2 of My-Prompt-Manager-ojz), and a done one stays done.
 *
 * @returns Whether it wrote
 */
export const markExistingUserDone = (): Promise<boolean> =>
  writeOver((stored) => (stored === undefined ? { status: 'done' } : undefined));

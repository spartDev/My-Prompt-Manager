/**
 * The one writer of the launch state from the popup and the side panel: the Welcome record (the
 * step reached, the Packs selected, the end) and the Last seen Release. In Debug mode it writes
 * nothing, and reads nothing, so a Debug session leaves storage as it was and a normal user sees
 * what they saw before it. The service worker's writes at install and update are facts of the
 * install, outside it (src/background/background.ts). No other module of src/ calls the low-level
 * writers it calls (src/test/guardrails/launch-state-guardrails.test.ts).
 * Terms: CONTEXT.md, "Welcome", "Last seen Release", "Debug mode".
 */

import { toError } from '../utils/error';
import { type WelcomeStep, writeWelcomeRecord } from '../welcome/storage';
import { markReleaseSeen } from '../whatsNew/storage';

export type LaunchStateChange =
  /**
   * The step the Welcome is at, so it resumes there at the next opening, and the Packs selected;
   * without Packs, those already stored are kept. Written only over a pending record: never makes
   * a record the service worker did not, never reopens a finished Welcome.
   */
  | { readonly kind: 'welcome-step'; readonly step: WelcomeStep; readonly packs?: readonly string[] }
  /**
   * The Welcome finished, for good, and the installed Release `version` as the Last seen Release,
   * so a user who got an update with Release notes while the Welcome was pending never meets What's
   * new at the openings after it
   */
  | { readonly kind: 'welcome-done'; readonly version: string }
  /**
   * The Welcome finished, as an opening found it (`isWelcomeFoundDone` of src/launch/decide.ts: a
   * pending record over a Library with Prompts), so it cannot come back if that Library is emptied
   * later. The Welcome record alone: the Last seen Release stays What's new's to mark, since What's
   * new may show at that same opening, and must come back if the extension closes without an action
   */
  | { readonly kind: 'welcome-found-done' }
  /** The Release `version` as the Last seen Release: What's new closed */
  | { readonly kind: 'release-seen'; readonly version: string };

/** Settles both writes, then rejects with the first failure, so one failed write never keeps the other from landing */
const both = async (writes: readonly [Promise<unknown>, Promise<unknown>]): Promise<void> => {
  const failure = (await Promise.allSettled(writes)).find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failure !== undefined) {
    throw toError(failure.reason);
  }
};

/**
 * Writes one change of the launch state, or nothing in Debug mode: the one Debug check of every
 * write of the launch state, since the low-level writers it calls have no other caller. The writes
 * start before this returns, so a caller that does not wait still has them under way when the popup
 * closes. Rejects when storage cannot be read or written.
 */
export const writeLaunchState = async (change: LaunchStateChange, { debugMode }: { readonly debugMode: boolean }): Promise<void> => {
  if (debugMode) {
    return;
  }
  switch (change.kind) {
    case 'welcome-step':
      await writeWelcomeRecord({
        status: 'pending',
        step: change.step,
        ...(change.packs === undefined ? {} : { packs: change.packs })
      });
      return;
    case 'welcome-done':
      await both([writeWelcomeRecord({ status: 'done' }), markReleaseSeen(change.version)]);
      return;
    case 'welcome-found-done':
      await writeWelcomeRecord({ status: 'done' });
      return;
    case 'release-seen':
      await markReleaseSeen(change.version);
      return;
  }
};

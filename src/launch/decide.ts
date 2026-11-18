/**
 * What an opening of the popup or side panel shows first: the Welcome, What's new, or nothing over
 * the Library. One pure function decides it for both screens, so they can never show together.
 * Terms: CONTEXT.md, "Welcome", "What's new", "Debug mode".
 */

import type { WelcomeRecord, WelcomeStep } from '../welcome/storage';
import { decideWhatsNew, type WhatsNewInputs } from '../whatsNew/decide';
import type { ReleaseNotes } from '../whatsNew/types';

export type LaunchScreen =
  | { readonly kind: 'welcome'; readonly step: WelcomeStep }
  | { readonly kind: 'whats-new'; readonly notes: ReleaseNotes }
  | { readonly kind: 'none' };

/** What the launch decision depends on: the inputs of What's new, and those of the Welcome */
export interface LaunchInputs extends WhatsNewInputs {
  /**
   * The Welcome record: as stored, 'absent' when storage holds none, 'unreadable' when it holds a
   * value that is not a record
   */
  readonly welcome: WelcomeRecord | 'absent' | 'unreadable';
  /** Whether the Library holds at least one Prompt; undefined when it was not read */
  readonly libraryHasPrompts: boolean | undefined;
  /** The Welcome was finished in this opening, so what follows it is decided again */
  readonly welcomeFinishedThisOpening: boolean;
}

const NOTHING: LaunchScreen = { kind: 'none' };

const whatsNew = (inputs: WhatsNewInputs): LaunchScreen => {
  const notes = decideWhatsNew(inputs);
  return notes === null ? NOTHING : { kind: 'whats-new', notes };
};

/**
 * The screen an opening shows. Pure.
 *
 * Debug mode: the Welcome from its first step at every opening, whatever else holds; once it is
 * finished in this opening, What's new as Debug mode forces it (the Welcome first, What's new after).
 *
 * Normal:
 * - The Welcome finished in this opening: nothing, so a new user never meets What's new right after it.
 * - The Welcome only for a pending record over a Library known to be empty, at the stored step. A
 *   pending record over a Library with Prompts is a Welcome finished (its done write was lost, or a
 *   relaunch of the command-line extension wrote pending over an existing Library): What's new by its rule.
 * - A pending record over a Library not read is a doubt: nothing, neither the Welcome nor What's new
 *   for a user the record says is new.
 * - No record, an unreadable one, or done: never the Welcome; What's new by its own rule
 *   (`decideWhatsNew`, unchanged). A popup opened before the service worker's install write
 *   lands sees no record, so the Library; the Welcome is not lost, it shows at the next opening,
 *   pending over a Library still empty.
 */
export const decideLaunch = (inputs: LaunchInputs): LaunchScreen => {
  const { welcome, libraryHasPrompts, welcomeFinishedThisOpening, debugMode } = inputs;

  if (debugMode) {
    return welcomeFinishedThisOpening ? whatsNew(inputs) : { kind: 'welcome', step: 0 };
  }
  if (welcomeFinishedThisOpening) {
    return NOTHING;
  }
  if (typeof welcome === 'object' && welcome.status === 'pending') {
    if (libraryHasPrompts === false) {
      return { kind: 'welcome', step: welcome.step };
    }
    if (libraryHasPrompts === undefined) {
      return NOTHING;
    }
  }
  return whatsNew(inputs);
};

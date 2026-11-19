import { useCallback, useEffect, useRef } from 'react';

import type { AddPacksResult } from '../services/storage';
import { MOTION } from '../theme/motion';
import type { ShowToast } from '../types/hooks';
import { Logger, toError } from '../utils';
import { PACKS } from '../welcome/packs';
import type { PromptPack } from '../welcome/types';

export interface WelcomeExitOptions {
  /** Adds the Packs to the Library and reads it again (useAddPacks): resolves once the Library lists them, rejects with nothing written */
  readonly addPacks: (packs: readonly PromptPack[]) => Promise<AddPacksResult>;
  /** Ends the Welcome: shows what follows it and records it finished (useLaunchScreen's finishWelcome) */
  readonly finishWelcome: () => void;
  /** Brings the Library on its All filter with no search, so nothing it holds is out of sight */
  readonly showLibrary: () => void;
  /**
   * Asks the Library to give the keyboard to its first Prompt once its cards are listed (the Copy of
   * the first card), unless the user has put it somewhere already: after the Packs, one Enter copies
   */
  readonly focusFirstPrompt: () => void;
  /** Opens the editor on a new Prompt */
  readonly openNewPrompt: () => void;
  readonly showToast: ShowToast;
  /**
   * Hides the Notification on screen, if any. Called as an exit starts: the only one the Welcome can
   * show is the failure of an earlier add, whose Try again would do nothing once the user has left
   */
  readonly hideNotification: () => void;
  /** The Packs the last step offers; tests pass their own */
  readonly packs?: readonly PromptPack[];
}

/** What the Notification says once the Packs are in */
export interface PacksAddedNotice {
  readonly message: string;
  readonly sub: string;
}

/**
 * The Notification's second line after the Packs: the next step, in the AI chat, where `//` opens the
 * Prompt selector (SELECTOR_TRIGGER of src/content/selector/inputText.ts). The Library on screen
 * already shows the Packs; what the Welcome has not said yet is how a Prompt gets into the chat
 * (decision D1, My-Prompt-Manager-ojz.19)
 */
const IN_THE_CHAT = 'Open your AI chat and type //';

/**
 * The Notification of an add: how many Prompts were really added ("9 prompts added"), and where to
 * use them as its sub. When every Prompt was already in the Library (the owner finishing the Welcome
 * again in Debug mode), nothing was added: it says the Library is ready instead, with the same sub.
 */
export const packsAddedNotice = ({ added }: AddPacksResult): PacksAddedNotice => ({
  message: added === 0 ? 'Your library is ready' : `${String(added)} ${added === 1 ? 'prompt' : 'prompts'} added`,
  sub: IN_THE_CHAT
});

/** The Notification of a refused add, which stays until the user acts; its action tries the same add again */
const ADD_FAILED = "Couldn't add the prompts";
const TRY_AGAIN = 'Try again';

/**
 * The way out of the Welcome: what the primary button of its last step does with the ids of the Packs
 * selected (architecture A8 of My-Prompt-Manager-ojz). With Packs that hold Prompts, the Packs are
 * added and the Library read again first; only then is the Welcome finished (so it is recorded done
 * only once the Packs are in), the Library shown on All and the Notification of the add shown. With
 * none, the Welcome is finished and the Library shown at once, and the editor opens on a new Prompt
 * `MOTION.welcomeEditorDelay` later, a timer cleared on unmount. Where the Welcome leads, the keyboard
 * goes too: with Packs, to the first Prompt the Library lists, so the first copy is one Enter away;
 * with none, the editor's title field takes it as the editor opens.
 *
 * A refused add finishes nothing: the Welcome stays at its last step, nothing is recorded, and a
 * failure Notification says so until the user acts, with no time of its own. Its action, Try again,
 * calls this same exit with the same Packs, as the primary button does; the primary button tries
 * again too, and with every Pack unselected it reads Start empty. Each exit hides the Notification on
 * screen as it starts, so a failure Notification never stays over an add tried again, nor outlives
 * the Welcome with a Try again that would do nothing any more (My-Prompt-Manager-ojz.20). A press
 * while an exit is under way (a double click, Enter then a click) does nothing, so the Packs are
 * added once and the Welcome finished once. An add that lands after the unmount (the popup closed)
 * does nothing more: the next opening finds the Welcome pending over a Library with Prompts, which
 * counts as finished.
 */
export const useWelcomeExit = (options: WelcomeExitOptions): ((packIds: readonly string[]) => void) => {
  // The latest callbacks, for an add that lands and a timer that fires after App rendered again
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  // An exit under way, or done: a second press of the primary button does nothing
  const leaving = useRef(false);
  const mounted = useRef(false);
  const editorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (editorTimer.current !== null) {
        clearTimeout(editorTimer.current);
        editorTimer.current = null;
      }
    };
  }, []);

  const startEmpty = useCallback((): void => {
    const { finishWelcome, showLibrary } = latest.current;
    finishWelcome();
    showLibrary();
    editorTimer.current = setTimeout(() => {
      editorTimer.current = null;
      latest.current.openNewPrompt();
    }, MOTION.welcomeEditorDelay);
  }, []);

  /**
   * Starts an exit, unless one is under way: false then. The Notification on screen goes: a failure
   * Notification of an earlier add would otherwise stay over the Library, or over the add tried
   * again, with a Try again that does nothing
   */
  const begin = useCallback((): boolean => {
    if (leaving.current) {
      return false;
    }
    leaving.current = true;
    latest.current.hideNotification();
    return true;
  }, []);

  // The exit the primary button calls, for the Try again of a failure Notification to call it the same way
  const exitRef = useRef<(packIds: readonly string[]) => void>(() => undefined);

  const addThenLeave = useCallback(async (packIds: readonly string[], packs: readonly PromptPack[]): Promise<void> => {
    let result: AddPacksResult;
    try {
      result = await latest.current.addPacks(packs);
    } catch (error) {
      Logger.error('Could not add the Packs at the end of the Welcome', toError(error), {
        component: 'useWelcomeExit',
        packs: packs.map((pack) => pack.id)
      });
      if (!mounted.current) {
        return;
      }
      leaving.current = false;
      // No time of its own (duration 0): it stays until the user acts, so it is read whole and the
      // retry stays within reach. Try again is the primary button's exit, with the same Packs
      latest.current.showToast(ADD_FAILED, 'error', {
        duration: 0,
        action: {
          label: TRY_AGAIN,
          onClick: () => {
            exitRef.current(packIds);
          }
        }
      });
      return;
    }
    if (!mounted.current) {
      return;
    }
    const { finishWelcome, showLibrary, focusFirstPrompt, showToast } = latest.current;
    finishWelcome();
    showLibrary();
    focusFirstPrompt();
    const { message, sub } = packsAddedNotice(result);
    // Read whole on the Library, the "//" of its second line included, even in a 320px side panel. It
    // stays 6 s, not a confirmation's 2.7 s: its 9 words take about 2.3 s to read and "//", the next
    // step, comes last (My-Prompt-Manager-syj). Its time runs from here; hovered or focused, it stops
    showToast(message, 'success', { sub, whole: true, duration: 6000 });
  }, []);

  const exit = useCallback((packIds: readonly string[]): void => {
    if (!begin()) {
      return;
    }
    // In the order the last step offers them; an id that is no Pack, or a Pack with no Prompt, adds nothing
    const packs = (latest.current.packs ?? PACKS).filter((pack) => packIds.includes(pack.id) && pack.prompts.length > 0);
    if (packs.length === 0) {
      startEmpty();
      return;
    }
    void addThenLeave(packIds, packs);
  }, [begin, startEmpty, addThenLeave]);

  useEffect(() => {
    exitRef.current = exit;
  }, [exit]);

  return exit;
};

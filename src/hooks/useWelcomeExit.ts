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
  /** Opens the editor on a new Prompt */
  readonly openNewPrompt: () => void;
  readonly showToast: ShowToast;
  /** The Packs the last step offers; tests pass their own */
  readonly packs?: readonly PromptPack[];
}

/** What the Notification says once the Packs are in */
export interface PacksAddedNotice {
  readonly message: string;
  readonly sub: string;
}

/**
 * The Notification of an add: how many Prompts were really added, the Packs that added some as its
 * sub ("9 prompts added", "Product, Writing"). When every Prompt was already in the Library (the
 * owner finishing the Welcome again in Debug mode), nothing was added and no Pack is named: it says
 * the Library is ready instead.
 */
export const packsAddedNotice = ({ added, packNames }: AddPacksResult): PacksAddedNotice =>
  added === 0
    ? { message: 'Your library is ready', sub: 'Every prompt was already in it' }
    : { message: `${String(added)} ${added === 1 ? 'prompt' : 'prompts'} added`, sub: packNames.join(', ') };

/** The Notification of a refused add; its action leaves the Welcome with no Pack */
const ADD_FAILED = "Couldn't add the prompts";
const START_EMPTY = 'Start empty';

/**
 * The way out of the Welcome: what the primary button of its last step does with the ids of the Packs
 * selected (architecture A8 of My-Prompt-Manager-ojz). With Packs that hold Prompts, the Packs are
 * added and the Library read again first; only then is the Welcome finished (so it is recorded done
 * only once the Packs are in), the Library shown on All and the Notification of the add shown. With
 * none, the Welcome is finished and the Library shown at once, and the editor opens on a new Prompt
 * `MOTION.welcomeEditorDelay` later, a timer cleared on unmount.
 *
 * A refused add finishes nothing: the Welcome stays at its last step, nothing is recorded, and a
 * failure Notification offers to start empty; the primary button tries again. A press while an exit
 * is under way (a double click, Enter then a click) does nothing, so the Packs are added once and the
 * Welcome finished once. An add that lands after the unmount (the popup closed) does nothing more:
 * the next opening finds the Welcome pending over a Library with Prompts, which counts as finished.
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

  const startEmptyAfterFailure = useCallback((): void => {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    startEmpty();
  }, [startEmpty]);

  const addThenLeave = useCallback(async (packs: readonly PromptPack[]): Promise<void> => {
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
      latest.current.showToast(ADD_FAILED, 'error', { action: { label: START_EMPTY, onClick: startEmptyAfterFailure } });
      return;
    }
    if (!mounted.current) {
      return;
    }
    const { finishWelcome, showLibrary, showToast } = latest.current;
    finishWelcome();
    showLibrary();
    const { message, sub } = packsAddedNotice(result);
    showToast(message, 'success', { sub });
  }, [startEmptyAfterFailure]);

  return useCallback((packIds: readonly string[]): void => {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    // In the order the last step offers them; an id that is no Pack, or a Pack with no Prompt, adds nothing
    const packs = (latest.current.packs ?? PACKS).filter((pack) => packIds.includes(pack.id) && pack.prompts.length > 0);
    if (packs.length === 0) {
      startEmpty();
      return;
    }
    void addThenLeave(packs);
  }, [startEmpty, addThenLeave]);
};

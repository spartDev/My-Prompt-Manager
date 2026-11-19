import { useCallback, useEffect, useRef, useState } from 'react';

import { decideLaunch, isWelcomeFoundDone, type LaunchInputs, type LaunchScreen } from '../launch/decide';
import { type LaunchStateChange, writeLaunchState } from '../launch/write';
import { readPrompts } from '../services/promptAdmission';
import { parseSiteSettings, SITE_SETTINGS_KEY } from '../services/siteSettings';
import { STORAGE_KEYS } from '../services/storage';
import { Logger, toError } from '../utils';
import { parseWelcomeRecord, WELCOME_KEY, type WelcomeStep } from '../welcome/storage';
import { isFirstInstall } from '../whatsNew/decide';
import { RELEASE_NOTES } from '../whatsNew/releaseNotes';
import { parseWhatsNewRecord, WHATS_NEW_KEY } from '../whatsNew/storage';
import type { ReleaseNotes } from '../whatsNew/types';

export interface LaunchScreenState {
  /** What the opening shows: the Welcome, What's new over the Library, or the Library alone */
  readonly screen: LaunchScreen;
  /** True until the decision is known: nothing of the Library or the Welcome shows meanwhile */
  readonly loading: boolean;
  /**
   * Records the step the Welcome is at, and the Packs selected (left out, those already recorded
   * are kept), so a Welcome closed by accident resumes there. Not waited for: the click only
   * requests the Welcome lock, and the step is written once the lock is granted and the record read,
   * a few milliseconds later. A popup closed before that write is issued loses the step and resumes
   * one step earlier, the window the epic accepted (D24, docs/TESTING.md, S6). Leaves `screen` as it
   * is: the Welcome holds its own step. Only while the Welcome shows
   */
  readonly saveStep: (step: WelcomeStep, packs?: readonly string[]) => void;
  /**
   * Ends the Welcome: shows at once what follows it (the Library; in Debug mode What's new, as Debug
   * mode forces it), and records the Welcome finished and the installed Release seen without waiting
   * for storage. Only while the Welcome shows, once
   */
  readonly finishWelcome: () => void;
  /** Hides What's new and marks its Release as seen at once, without waiting for storage; only while What's new shows, once */
  readonly closeWhatsNew: () => void;
}

export interface LaunchScreenOptions {
  /** False in the element picker's Settings window: nothing is read and nothing shows */
  readonly enabled?: boolean;
  /** The Release notes registry; tests pass their own */
  readonly releaseNotes?: readonly ReleaseNotes[];
}

const NOTHING: LaunchScreen = { kind: 'none' };

/** The keys the decision reads, in one get */
const LAUNCH_KEYS = [WELCOME_KEY, WHATS_NEW_KEY, SITE_SETTINGS_KEY];

/** The key the Library's Prompts are stored under */
const LIBRARY_KEY = STORAGE_KEYS.PROMPTS;

/** The Welcome record as the decision takes it: none stored, a value that is no record, or the record */
const welcomeOf = (stored: unknown): LaunchInputs['welcome'] =>
  stored === undefined ? 'absent' : (parseWelcomeRecord(stored) ?? 'unreadable');

/**
 * Whether a stored Library holds a Prompt: none stored yet is an empty Library; a value that is not
 * a list, or a list none of whose entries reads as a Prompt, is a Library storage holds but cannot
 * read, so undefined, the doubt in which the Welcome does not show
 */
const libraryHasPromptsOf = (stored: unknown): boolean | undefined => {
  if (stored === undefined) {
    return false;
  }
  if (!Array.isArray(stored)) {
    return undefined;
  }
  if (stored.length === 0) {
    return false;
  }
  return readPrompts(stored).length > 0 ? true : undefined;
};

/** Whether the Library holds a Prompt; undefined, logged, when it cannot be read */
const readLibraryHasPrompts = async (): Promise<boolean | undefined> => {
  try {
    const hasPrompts = libraryHasPromptsOf((await chrome.storage.local.get([LIBRARY_KEY]))[LIBRARY_KEY]);
    if (hasPrompts === undefined) {
      Logger.warn('The stored Library is not a list of Prompts: the Welcome does not show', { component: 'useLaunchScreen' });
    }
    return hasPrompts;
  } catch (error) {
    Logger.error('Could not read the Library to decide whether the Welcome shows', toError(error), {
      component: 'useLaunchScreen'
    });
    return undefined;
  }
};

/**
 * What this opening of the popup or side panel shows first, decided once on mount by `decideLaunch`.
 * Reads the Welcome record, the What's new record and the Site settings (Debug mode) in one
 * `chrome.storage.local.get`, and the Library only when the Welcome is pending. A failed read shows
 * nothing and is logged, never the Welcome. A pending record over a Library with Prompts, which the
 * decision reads as a Welcome finished, is recorded done at the opening, so the Welcome cannot come
 * back if that Library is emptied later. Every write goes through `writeLaunchState`, bound to the
 * Debug mode of this opening, which writes nothing in Debug mode. Debug mode stays in here: nothing
 * returned names it.
 */
export const useLaunchScreen = ({ enabled = true, releaseNotes = RELEASE_NOTES }: LaunchScreenOptions = {}): LaunchScreenState => {
  const [screen, setScreen] = useState<LaunchScreen>(NOTHING);
  const [loading, setLoading] = useState(enabled);
  // What this opening's decision took: to decide again once the Welcome is finished, and to write
  const opening = useRef<LaunchInputs | null>(null);
  // The Welcome shows, until it is finished
  const welcomeShown = useRef(false);
  // The Release whose What's new shows, until it is closed
  const whatsNewShown = useRef<string | null>(null);

  /** Starts a write of the launch state for this opening and logs its failure; never throws */
  const write = useCallback((change: LaunchStateChange, failure: string, context: Readonly<Record<string, unknown>>): void => {
    const current = opening.current;
    if (current === null) {
      return;
    }
    writeLaunchState(change, { debugMode: current.debugMode }).catch((error: unknown) => {
      Logger.error(failure, toError(error), { component: 'useLaunchScreen', ...context });
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let cancelled = false;

    void (async () => {
      try {
        const currentVersion = chrome.runtime.getManifest().version;
        const stored = await chrome.storage.local.get(LAUNCH_KEYS);
        if (cancelled) {
          return;
        }
        const welcome = welcomeOf(stored[WELCOME_KEY]);
        const whatsNew = parseWhatsNewRecord(stored[WHATS_NEW_KEY]);
        const { debugMode } = parseSiteSettings(stored[SITE_SETTINGS_KEY]);
        const libraryHasPrompts = typeof welcome === 'object' && welcome.status === 'pending' ? await readLibraryHasPrompts() : undefined;
        if (cancelled) {
          return;
        }
        const inputs: LaunchInputs = {
          welcome,
          libraryHasPrompts,
          currentVersion,
          lastSeenVersion: whatsNew.lastSeenVersion,
          isFirstInstall: isFirstInstall(whatsNew.installedVersion, currentVersion),
          releaseNotes,
          debugMode,
          welcomeFinishedThisOpening: false
        };
        const decided = decideLaunch(inputs);
        opening.current = inputs;
        welcomeShown.current = decided.kind === 'welcome';
        whatsNewShown.current = decided.kind === 'whats-new' ? decided.notes.version : null;
        setScreen(decided);
        if (isWelcomeFoundDone(inputs)) {
          write({ kind: 'welcome-found-done' }, 'Could not record the Welcome as finished over a Library with Prompts', {});
        }
      } catch (error) {
        Logger.error('Could not decide what the opening shows', toError(error), { component: 'useLaunchScreen' });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, releaseNotes, write]);

  const saveStep = useCallback(
    (step: WelcomeStep, packs?: readonly string[]) => {
      if (!welcomeShown.current) {
        return;
      }
      write(
        { kind: 'welcome-step', step, ...(packs === undefined ? {} : { packs: [...packs] }) },
        'Could not record the step the Welcome is at',
        { step }
      );
    },
    [write]
  );

  const finishWelcome = useCallback(() => {
    const current = opening.current;
    if (current === null || !welcomeShown.current) {
      return;
    }
    welcomeShown.current = false;
    const next = decideLaunch({ ...current, welcomeFinishedThisOpening: true });
    whatsNewShown.current = next.kind === 'whats-new' ? next.notes.version : null;
    setScreen(next);
    write({ kind: 'welcome-done', version: current.currentVersion }, 'Could not record the Welcome as finished', {
      version: current.currentVersion
    });
  }, [write]);

  const closeWhatsNew = useCallback(() => {
    const current = opening.current;
    if (current === null || whatsNewShown.current === null) {
      return;
    }
    whatsNewShown.current = null;
    setScreen(NOTHING);
    write({ kind: 'release-seen', version: current.currentVersion }, 'Could not mark the Release as seen', {
      version: current.currentVersion
    });
  }, [write]);

  return { screen, loading, saveStep, finishWelcome, closeWhatsNew };
};

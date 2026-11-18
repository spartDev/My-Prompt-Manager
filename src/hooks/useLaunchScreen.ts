import { useCallback, useEffect, useRef, useState } from 'react';

import { decideLaunch, type LaunchInputs, type LaunchScreen } from '../launch/decide';
import { parseSiteSettings, SITE_SETTINGS_KEY } from '../services/siteSettings';
import { StorageManager } from '../services/storage';
import { Logger, toError } from '../utils';
import { parseWelcomeRecord, WELCOME_KEY } from '../welcome/storage';
import { isFirstInstall } from '../whatsNew/decide';
import { RELEASE_NOTES } from '../whatsNew/releaseNotes';
import { markReleaseSeen, parseWhatsNewRecord, WHATS_NEW_KEY } from '../whatsNew/storage';
import type { ReleaseNotes } from '../whatsNew/types';

export interface LaunchScreenState {
  /** What the opening shows: the Welcome, What's new over the Library, or the Library alone */
  readonly screen: LaunchScreen;
  /** True until the decision is known: nothing of the Library or the Welcome shows meanwhile */
  readonly loading: boolean;
  /** Hides What's new and marks its Release as seen at once, without waiting for storage; only while What's new shows, once */
  readonly closeWhatsNew: () => void;
}

export interface LaunchScreenOptions {
  /** False in the element picker's Settings window: nothing is read and nothing shows */
  readonly enabled?: boolean;
  /** The Release notes registry; tests pass their own */
  readonly releaseNotes?: readonly ReleaseNotes[];
}

/** What the close of What's new needs from the opening, kept out of what the hook returns */
interface Opening {
  readonly currentVersion: string;
  readonly debugMode: boolean;
}

const NOTHING: LaunchScreen = { kind: 'none' };

/** The keys the decision reads, in one get */
const LAUNCH_KEYS = [WELCOME_KEY, WHATS_NEW_KEY, SITE_SETTINGS_KEY];

/** The Welcome record as the decision takes it: none stored, a value that is no record, or the record */
const welcomeOf = (stored: unknown): LaunchInputs['welcome'] =>
  stored === undefined ? 'absent' : (parseWelcomeRecord(stored) ?? 'unreadable');

/** Whether the Library holds a Prompt; undefined, logged, when it cannot be read */
const readLibraryHasPrompts = async (): Promise<boolean | undefined> => {
  try {
    return (await StorageManager.getInstance().getPrompts()).length > 0;
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
 * `chrome.storage.local.get`, and the Library only when the Welcome is pending. Debug mode stays in
 * here: nothing returned names it. A failed read shows nothing and is logged, never the Welcome.
 */
export const useLaunchScreen = ({ enabled = true, releaseNotes = RELEASE_NOTES }: LaunchScreenOptions = {}): LaunchScreenState => {
  const [screen, setScreen] = useState<LaunchScreen>(NOTHING);
  const [loading, setLoading] = useState(enabled);
  const opening = useRef<Opening | null>(null);
  // The Release whose What's new shows, until it is closed
  const whatsNewShown = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let cancelled = false;

    void (async () => {
      try {
        const currentVersion = chrome.runtime.getManifest().version;
        const stored = await chrome.storage.local.get(LAUNCH_KEYS);
        const welcome = welcomeOf(stored[WELCOME_KEY]);
        const whatsNew = parseWhatsNewRecord(stored[WHATS_NEW_KEY]);
        const { debugMode } = parseSiteSettings(stored[SITE_SETTINGS_KEY]);
        const libraryHasPrompts = typeof welcome === 'object' && welcome.status === 'pending' ? await readLibraryHasPrompts() : undefined;
        if (cancelled) {
          return;
        }
        const decided = decideLaunch({
          welcome,
          libraryHasPrompts,
          currentVersion,
          lastSeenVersion: whatsNew.lastSeenVersion,
          isFirstInstall: isFirstInstall(whatsNew.installedVersion, currentVersion),
          releaseNotes,
          debugMode,
          welcomeFinishedThisOpening: false
        });
        opening.current = { currentVersion, debugMode };
        whatsNewShown.current = decided.kind === 'whats-new' ? decided.notes.version : null;
        setScreen(decided);
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
  }, [enabled, releaseNotes]);

  const closeWhatsNew = useCallback(() => {
    const current = opening.current;
    if (current === null || whatsNewShown.current === null) {
      return;
    }
    whatsNewShown.current = null;
    setScreen(NOTHING);
    markReleaseSeen(current.currentVersion, { debugMode: current.debugMode }).catch((error: unknown) => {
      Logger.error('Could not mark the Release as seen', toError(error), {
        component: 'useLaunchScreen',
        version: current.currentVersion
      });
    });
  }, []);

  return { screen, loading, closeWhatsNew };
};

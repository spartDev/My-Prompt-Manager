import { useCallback, useEffect, useRef, useState } from 'react';

import { readSiteSettings } from '../services/siteSettings';
import { Logger, toError } from '../utils';
import { decideWhatsNew } from '../whatsNew/decide';
import { RELEASE_NOTES } from '../whatsNew/releaseNotes';
import { markReleaseSeen, readWhatsNewRecord } from '../whatsNew/storage';
import type { ReleaseNotes } from '../whatsNew/types';

export interface WhatsNewState {
  /** The Release notes to show now, or null when What's new shows nothing */
  readonly notes: ReleaseNotes | null;
  /** True until the decision is known */
  readonly loading: boolean;
  /** Hides the notes and marks the Release as seen at once, without waiting for storage */
  readonly close: () => void;
}

interface Opening {
  readonly currentVersion: string;
  readonly debugMode: boolean;
}

/**
 * Whether What's new shows at this opening, and with which Release notes. Reads the installed
 * Release (manifest), the What's new record and Debug mode once, on mount. Debug mode stays in
 * here: nothing returned names it. A failed read shows nothing and is logged.
 *
 * @param registry - The Release notes registry; tests pass their own
 */
export const useWhatsNew = (registry: readonly ReleaseNotes[] = RELEASE_NOTES): WhatsNewState => {
  const [notes, setNotes] = useState<ReleaseNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const opening = useRef<Opening | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const currentVersion = chrome.runtime.getManifest().version;
        const [record, siteSettings] = await Promise.all([readWhatsNewRecord(), readSiteSettings()]);
        if (cancelled) {
          return;
        }
        opening.current = { currentVersion, debugMode: siteSettings.debugMode };
        setNotes(
          decideWhatsNew({
            currentVersion,
            lastSeenVersion: record.lastSeenVersion,
            releaseNotes: registry,
            isFirstInstall: record.installedVersion === currentVersion,
            debugMode: siteSettings.debugMode
          })
        );
      } catch (error) {
        Logger.error("Could not decide whether What's new shows", toError(error), {
          component: 'useWhatsNew'
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [registry]);

  const close = useCallback(() => {
    setNotes(null);
    const current = opening.current;
    if (current === null) {
      return;
    }
    markReleaseSeen(current.currentVersion, { debugMode: current.debugMode }).catch((error: unknown) => {
      Logger.error('Could not mark the Release as seen', toError(error), {
        component: 'useWhatsNew',
        version: current.currentVersion
      });
    });
  }, []);

  return { notes, loading, close };
};

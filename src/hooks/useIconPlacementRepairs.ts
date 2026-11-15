import { useCallback, useEffect, useState } from 'react';

import {
  ICON_PLACEMENT_REPAIRS_KEY,
  type IconPlacementRepairs,
  parseIconPlacementRepairs,
  readIconPlacementRepairs
} from '../services/iconPlacementRepairs';
import { Logger, toError } from '../utils';

export interface UseIconPlacementRepairsReturn {
  /** How the icon was last placed on each built-in Platform where it is not in the Toolbar */
  repairs: IconPlacementRepairs;
  /** The hostname whose pick could not start, with why, until the next attempt */
  placeError: { hostname: string; message: string } | null;
  /**
   * Opens the Element picker on a tab of this Platform, to place the icon there. In the popup, the
   * popup closes as the tab comes to the front: the service worker keeps the pick.
   */
  placeIcon: (hostname: string) => Promise<void>;
}

/** The tab to pick in: the active one when it is on this Platform, else the first tab that is */
async function findPlatformTab(hostname: string): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url: `https://${hostname}/*` });
  return tabs.find((tab) => tab.active) ?? tabs[0];
}

/** The icon placement repairs of the built-in Platforms (src/services/iconPlacementRepairs.ts), kept up to date */
export function useIconPlacementRepairs(): UseIconPlacementRepairsReturn {
  const [repairs, setRepairs] = useState<IconPlacementRepairs>({});
  const [placeError, setPlaceError] = useState<{ hostname: string; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    void readIconPlacementRepairs().then((stored) => {
      if (active) {
        setRepairs(stored);
      }
    });
    const handleChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && ICON_PLACEMENT_REPAIRS_KEY in changes) {
        setRepairs(parseIconPlacementRepairs(changes[ICON_PLACEMENT_REPAIRS_KEY]?.newValue));
      }
    };
    chrome.storage.onChanged.addListener(handleChange);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  const placeIcon = useCallback(async (hostname: string) => {
    setPlaceError(null);
    try {
      const tab = await findPlatformTab(hostname);
      if (tab?.id === undefined) {
        setPlaceError({ hostname, message: `Open ${hostname} in a tab, then place the icon.` });
        return;
      }
      const response = (await chrome.runtime.sendMessage({
        type: 'START_ELEMENT_PICKER',
        data: { tabId: tab.id, repairHostname: hostname }
      })) as { success?: boolean; error?: string } | undefined;
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to start element picker');
      }
    } catch (error) {
      Logger.error('Failed to start placing the icon', toError(error), { component: 'useIconPlacementRepairs', hostname });
      setPlaceError({ hostname, message: 'Could not open the element picker. Reload the page, then try again.' });
    }
  }, []);

  return { repairs, placeError, placeIcon };
}

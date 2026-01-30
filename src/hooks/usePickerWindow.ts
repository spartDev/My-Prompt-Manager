import { useState, useEffect, useCallback, useMemo } from 'react';

import { ElementFingerprint, CustomSite } from '../types';
import { Logger, toError } from '../utils';

import { useSitePermissions } from './useSitePermissions';

export interface PickerWindowState {
  isPickerWindow: boolean;
  originalTabId: number | null;
  originalUrl: string | null;
  originalHostname: string | null;
}

export interface PickerState {
  pickingElement: boolean;
  pickerError: string | null;
  customSelector: string;
  elementFingerprint: ElementFingerprint | null;
}

export interface UsePickerWindowOptions {
  interfaceMode: 'popup' | 'sidepanel';
  siteConfigs: Record<string, unknown>;
  customSites: CustomSite[];
}

export interface UsePickerWindowReturn {
  pickerWindowState: PickerWindowState;
  pickerState: PickerState;
  currentTabState: {
    currentTabUrl: string | null;
    currentTabTitle: string | null;
    isCurrentSiteIntegrated: boolean;
    currentSiteHostname: string;
  };
  startElementPicker: () => Promise<void>;
  setCustomSelector: (selector: string) => void;
  setElementFingerprint: (fingerprint: ElementFingerprint | null) => void;
  resetPickerState: () => void;
}

export function usePickerWindow({
  interfaceMode,
  siteConfigs,
  customSites,
}: UsePickerWindowOptions): UsePickerWindowReturn {
  const [pickingElement, setPickingElement] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [customSelector, setCustomSelector] = useState('');
  const [elementFingerprint, setElementFingerprint] = useState<ElementFingerprint | null>(null);
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const [currentTabTitle, setCurrentTabTitle] = useState<string | null>(null);
  const [isCurrentSiteIntegrated, setIsCurrentSiteIntegrated] = useState(false);

  const { checkPermissionForOrigin, requestPermissionForOrigin } = useSitePermissions();

  // Check if we're in picker window mode - memoize since URL params don't change during component lifecycle
  const { isPickerWindow, originalTabId, originalUrl, originalHostname } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const originalTabIdStr = params.get('originalTabId');
    return {
      isPickerWindow: params.get('picker') === 'true',
      originalTabId: originalTabIdStr ? parseInt(originalTabIdStr, 10) : null,
      originalUrl: params.get('originalUrl'),
      originalHostname: params.get('originalHostname'),
    };
  }, []);

  const pickerWindowState: PickerWindowState = {
    isPickerWindow,
    originalTabId,
    originalUrl,
    originalHostname,
  };

  // Element picker message handler
  // Empty deps intentional: we want a single message listener for the component
  // lifecycle. State setters (setCustomSelector, etc.) are stable references.
  useEffect(() => {
    const handleMessage = (message: { type?: string; data?: unknown }) => {
      if (message.type === 'ELEMENT_PICKER_RESULT') {
        const data = message.data as {
          fingerprint?: ElementFingerprint;
          selector?: string;
          elementType?: string;
          elementInfo?: Record<string, unknown>;
          hostname?: string;
        } | undefined;

        if (data?.selector) {
          setCustomSelector(data.selector);
          setElementFingerprint(data.fingerprint || null);
          setPickingElement(false);

          Logger.debug('Element picker result received', {
            component: 'usePickerWindow',
            hasFingerprint: !!data.fingerprint,
            selector: data.selector,
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Get current tab information (only when not in picker window mode)
  useEffect(() => {
    if (!isPickerWindow) {
      void (async () => {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs.length > 0 && tabs[0]?.url) {
            const activeTab = tabs[0];
            const tabUrl = activeTab.url;
            const tabTitle = activeTab.title;

            if (tabUrl) {
              const url = new URL(tabUrl);
              const hostname = url.hostname;

              setCurrentTabUrl(tabUrl);
              setCurrentTabTitle(tabTitle || null);

              const isBuiltIn = Object.keys(siteConfigs).includes(hostname);
              const isCustom = customSites.some((site) => site.hostname === hostname);
              setIsCurrentSiteIntegrated(isBuiltIn || isCustom);
            }
          }
        } catch (error) {
          Logger.error('Failed to get current tab', toError(error));
        }
      })();
    }
  }, [isPickerWindow, siteConfigs, customSites]);

  const currentSiteHostname = (() => {
    if (!currentTabUrl) {
      return 'this website';
    }

    try {
      return new URL(currentTabUrl).hostname;
    } catch {
      return 'this website';
    }
  })();

  const resetPickerState = useCallback(() => {
    setCustomSelector('');
    setElementFingerprint(null);
    setPickingElement(false);
    setPickerError(null);
  }, []);

  /**
   * Initiates the element picker to select a DOM element for custom positioning.
   * Determines the target tab (original tab in picker window mode, or active tab otherwise),
   * requests site permission if needed, and sends the appropriate message to start the picker.
   * In popup mode, opens a dedicated picker window and closes the popup.
   */
  const startElementPicker = useCallback(async () => {
    setPickingElement(true);
    setPickerError(null);

    try {
      let targetTabId: number | null = null;
      let targetTab: chrome.tabs.Tab | undefined;

      if (isPickerWindow) {
        if (originalTabId) {
          targetTabId = originalTabId;
          try {
            targetTab = await chrome.tabs.get(originalTabId);
          } catch {
            throw new Error('Original tab is no longer available');
          }
        } else {
          throw new Error('No original tab ID found');
        }
      } else {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        targetTab = tabs[0] as chrome.tabs.Tab | undefined;
        targetTabId = targetTab?.id || null;

        if (!targetTabId || !targetTab?.url) {
          throw new Error('No active tab found');
        }
      }

      // Check if we need permission for this tab's URL
      if (targetTab.url) {
        const url = new URL(targetTab.url);
        const origin = `${url.protocol}//${url.hostname}/*`;

        // Skip permission check for already allowed origins
        const isAllowedOrigin =
          targetTab.url.startsWith('https://claude.ai/') ||
          targetTab.url.startsWith('https://chatgpt.com/') ||
          targetTab.url.startsWith('https://www.perplexity.ai/') ||
          targetTab.url.startsWith('https://chat.mistral.ai/');

        if (!isAllowedOrigin) {
          const hasPermission = await checkPermissionForOrigin(origin);

          if (!hasPermission) {
            const granted = await requestPermissionForOrigin(origin);

            if (!granted) {
              throw new Error('Permission denied. Please grant access to use the element picker on this site.');
            }
          }
        }
      }

      // Now that permission is handled, start the element picker
      if (isPickerWindow) {
        const response = (await chrome.runtime.sendMessage({
          type: 'START_ELEMENT_PICKER',
          data: { tabId: targetTabId },
        })) as unknown as { success?: boolean; error?: string } | undefined;

        if (!response?.success) {
          throw new Error(response?.error || 'Failed to start element picker');
        }
      } else if (interfaceMode === 'sidepanel') {
        const response = (await chrome.runtime.sendMessage({
          type: 'START_ELEMENT_PICKER',
          data: { tabId: targetTabId },
        })) as unknown as { success?: boolean; error?: string } | undefined;

        if (!response?.success) {
          throw new Error(response?.error || 'Failed to start element picker');
        }
      } else {
        const response = (await chrome.runtime.sendMessage({
          type: 'OPEN_PICKER_WINDOW',
          data: { tabId: targetTabId },
        })) as unknown as { success?: boolean; error?: string } | undefined;

        if (response?.success) {
          window.close();
        } else {
          throw new Error(response?.error || 'Failed to open picker window');
        }
      }
    } catch (error) {
      Logger.error('Failed to start element picker', toError(error));
      const errorMessage = error instanceof Error ? error.message : 'Failed to start element picker';
      setPickerError(errorMessage);
      setPickingElement(false);
    }
  }, [isPickerWindow, originalTabId, interfaceMode, checkPermissionForOrigin, requestPermissionForOrigin]);

  return {
    pickerWindowState,
    pickerState: {
      pickingElement,
      pickerError,
      customSelector,
      elementFingerprint,
    },
    currentTabState: {
      currentTabUrl,
      currentTabTitle,
      isCurrentSiteIntegrated,
      currentSiteHostname,
    },
    startElementPicker,
    setCustomSelector,
    setElementFingerprint,
    resetPickerState,
  };
}

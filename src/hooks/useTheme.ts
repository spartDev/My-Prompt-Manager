import { useState, useEffect, useCallback } from 'react';

import { StorageManager } from '../services/storage';
import type { CustomSite } from '../types';
import { Logger, toError } from '../utils';

interface PromptLibrarySettings {
  customSites?: CustomSite[];
}

export type Theme = 'light' | 'dark' | 'system';

const isTheme = (value: string): value is Theme =>
  ['light', 'dark', 'system'].includes(value);

interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'prompt-library-theme';

/**
 * Notifies content scripts about theme changes.
 * Fire-and-forget: errors are silently ignored for tabs without content scripts.
 */
async function notifyContentScriptsOfThemeChange(newTheme: Theme): Promise<void> {
  if (typeof chrome === 'undefined') { return; }

  // Built-in platform URLs from manifest.json content_scripts.matches
  const builtInUrls = [
    'https://claude.ai/*',
    'https://chatgpt.com/*',
    'https://gemini.google.com/*',
    'https://www.perplexity.ai/*',
    'https://chat.mistral.ai/*',
    'https://copilot.microsoft.com/*',
    'https://m365.cloud.microsoft/*'
  ];

  const result: { promptLibrarySettings?: PromptLibrarySettings } =
    await chrome.storage.local.get(['promptLibrarySettings']);
  const customSites: CustomSite[] = result.promptLibrarySettings?.customSites ?? [];
  const customUrls = customSites
    .filter((site: CustomSite) => site.enabled)
    .map((site: CustomSite) => `https://${site.hostname}/*`);

  const allUrls = [...builtInUrls, ...customUrls];
  const tabs = await chrome.tabs.query({ url: allUrls });

  for (const tab of tabs) {
    if (tab.id) {
      void chrome.tabs.sendMessage(tab.id, {
        type: 'themeChanged',
        theme: newTheme
      }).catch(() => {
        // Ignore errors for tabs without content script
      });
    }
  }
}

export const useTheme = (): UseThemeReturn => {
  const [theme, setThemeState] = useState<Theme>('system');

  // Initialize theme from Chrome storage or migrate from localStorage
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        const storageManager = StorageManager.getInstance();
        const settings = await storageManager.getSettings();
        
        // Check if we need to migrate from localStorage
        if (settings.theme === 'system') {
          const localStorageTheme = localStorage.getItem(THEME_STORAGE_KEY);
          if (localStorageTheme && isTheme(localStorageTheme)) {
            await storageManager.updateSettings({ theme: localStorageTheme });
            localStorage.removeItem(THEME_STORAGE_KEY); // Clean up old storage
            setThemeState(localStorageTheme);
            return;
          }
        }


        setThemeState(settings.theme);
      } catch (error) {
        Logger.error('Failed to initialize theme', toError(error));
        setThemeState('system');
      }
    };

    void initializeTheme();
  }, []);

  // Listen for storage changes to update theme when changed from settings
  useEffect(() => {
    // Safety check: chrome.storage.onChanged may not be available in all contexts
    // (e.g., when analytics.html opens in a new tab before extension context is ready)
    // Use runtime check to avoid crash when chrome API is partially available
    const storageApi = typeof chrome !== 'undefined' ? chrome.storage : undefined;
    const onChangedApi = storageApi ? storageApi.onChanged : undefined;
    if (!onChangedApi) {
      return;
    }

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && 'settings' in changes) {
        const newSettings = changes.settings.newValue as { theme?: Theme } | undefined;
        if (newSettings?.theme && newSettings.theme !== theme) {
          setThemeState(newSettings.theme);
        }
      }
    };

    onChangedApi.addListener(handleStorageChange);
    return () => {
      onChangedApi.removeListener(handleStorageChange);
    };
  }, [theme]);

  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') {return 'light';}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  const setTheme = useCallback(async (newTheme: Theme) => {
    try {
      const storageManager = StorageManager.getInstance();
      await storageManager.updateSettings({ theme: newTheme });
      setThemeState(newTheme);

      // Notify content scripts about theme change (fire-and-forget)
      void notifyContentScriptsOfThemeChange(newTheme);
    } catch (error) {
      Logger.error('Failed to update theme', toError(error));
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    if (theme === 'system') {
      await setTheme(getSystemTheme() === 'light' ? 'dark' : 'light');
    } else {
      await setTheme(theme === 'light' ? 'dark' : 'light');
    }
  }, [theme, getSystemTheme, setTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        // Force re-render when system preference changes
        setThemeState('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => { mediaQuery.removeEventListener('change', handleChange); };
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme
  };
};
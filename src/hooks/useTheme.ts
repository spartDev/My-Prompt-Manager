import { useState, useEffect, useCallback } from 'react';

import { StorageManager } from '../services/storage';
import { Logger } from '../utils';

export type Theme = 'light' | 'dark' | 'system';

interface UseThemeReturn {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'prompt-library-theme';

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
          if (localStorageTheme && ['light', 'dark', 'system'].includes(localStorageTheme)) {
            const migratedTheme = localStorageTheme as Theme;
            await storageManager.updateSettings({ theme: migratedTheme });
            localStorage.removeItem(THEME_STORAGE_KEY); // Clean up old storage
            setThemeState(migratedTheme);
            return;
          }
        }


        setThemeState(settings.theme);
      } catch (error) {
        Logger.error('Failed to initialize theme', error as Error);
        setThemeState('system');
      }
    };

    void initializeTheme();
  }, []);

  // Listen for storage changes to update theme when changed from settings
  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && 'settings' in changes) {
        const newSettings = changes.settings.newValue as { theme?: Theme } | undefined;
        if (newSettings?.theme && newSettings.theme !== theme) {
          setThemeState(newSettings.theme);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
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
      
      // Notify content scripts about theme change
      if (typeof chrome !== 'undefined') {
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (tab.id) {
              void chrome.tabs.sendMessage(tab.id, {
                type: 'themeChanged',
                theme: newTheme
              }).catch(() => {
                // Ignore errors for tabs without content script
              });
            }
          });
        });
      }
    } catch (error) {
      Logger.error('Failed to update theme', error as Error);
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
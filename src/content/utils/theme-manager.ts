/**
 * Theme Manager for Content Script
 * Handles theme synchronization between extension settings and content script UI
 */

import { debug, info, error as logError } from './logger';

export type Theme = 'light' | 'dark' | 'system';

class ThemeManager {
  private static instance: ThemeManager | undefined;
  private currentTheme: 'light' | 'dark' = 'light';
  private observers = new Set<(theme: 'light' | 'dark') => void>();

  private constructor() {
    void this.initializeTheme();
    this.setupMessageListener();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Get the current resolved theme
   */
  getCurrentTheme(): 'light' | 'dark' {
    return this.currentTheme;
  }

  /**
   * Initialize theme from extension settings
   */
  private async initializeTheme(): Promise<void> {
    try {
      // Get theme from Chrome storage
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings as { theme?: Theme } | undefined;
      
      if (settings?.theme) {
        this.applyTheme(settings.theme);
      } else {
        // Fallback to system preference
        this.applyTheme('system');
      }
      
      debug('Theme initialized', { currentTheme: this.currentTheme });
    } catch (error) {
      logError('Failed to initialize theme from storage', error as Error);
      this.applyTheme('system');
    }
  }

  /**
   * Apply theme to content script UI
   */
  private applyTheme(theme: Theme): void {
    const resolvedTheme = this.resolveTheme(theme);
    
    if (resolvedTheme === this.currentTheme) {
      return; // No change needed
    }

    this.currentTheme = resolvedTheme;
    this.updateUITheme(resolvedTheme);
    this.notifyObservers(resolvedTheme);
    
    info(`Theme applied: ${resolvedTheme}`);
  }

  /**
   * Resolve theme based on system preference
   */
  private resolveTheme(theme: Theme): 'light' | 'dark' {
    if (theme === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      // Fallback for test environment
      return 'light';
    }
    return theme;
  }

  /**
   * Update UI elements with new theme
   */
  private updateUITheme(theme: 'light' | 'dark'): void {
    try {
      // Find all prompt library selector elements
      const selectors = document.querySelectorAll('.prompt-library-selector');
      
      selectors.forEach((selector) => {
        if (theme === 'dark') {
          selector.classList.add('dark-theme');
          selector.classList.remove('light-theme');
        } else {
          selector.classList.add('light-theme');
          selector.classList.remove('dark-theme');
        }
      });
      
      debug(`Updated ${selectors.length.toString()} UI elements with ${theme} theme`);
    } catch (error) {
      logError('Failed to update UI theme', error as Error);
    }
  }

  /**
   * Setup message listener for theme changes from popup
   */
  private setupMessageListener(): void {
    if (typeof chrome !== 'undefined') {
      chrome.runtime.onMessage.addListener((message: { type?: string; theme?: Theme }, _sender, _sendResponse) => {
        if (message.type === 'themeChanged' && message.theme) {
          debug('Received theme change message', { theme: message.theme });
          this.applyTheme(message.theme);
        }
      });
    }
  }

  /**
   * Add observer for theme changes
   */
  addObserver(callback: (theme: 'light' | 'dark') => void): void {
    this.observers.add(callback);
  }

  /**
   * Remove observer
   */
  removeObserver(callback: (theme: 'light' | 'dark') => void): void {
    this.observers.delete(callback);
  }

  /**
   * Notify all observers of theme change
   */
  private notifyObservers(theme: 'light' | 'dark'): void {
    this.observers.forEach((callback) => {
      try {
        callback(theme);
      } catch (error) {
        logError('Theme observer callback failed', error as Error);
      }
    });
  }

  /**
   * Cleanup theme manager resources
   */
  cleanup(): void {
    this.observers.clear();
  }
}

export { ThemeManager };
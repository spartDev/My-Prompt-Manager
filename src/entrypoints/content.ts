/**
 * Main entry point for the modular content script
 *
 * This file serves as the primary entry point for the My Prompt Manager content script.
 * It initializes all necessary modules, sets up proper error handling, and manages
 * the global instance lifecycle.
 *
 * Key responsibilities:
 * - Initialize CSS injection
 * - Create and manage the main injector instance
 * - Handle cleanup on page unload
 * - Provide global error handling
 * - Maintain backward compatibility
 */

import { defineContentScript } from 'wxt/utils/define-content-script';

import { PromptLibraryInjector } from '../content/core/injector';
import { getElementPicker } from '../content/modules/element-picker';
import { error, warn, info, debug } from '../content/utils/logger';
import { ThemeManager } from '../content/utils/theme-manager';

interface PromptLibraryDebugApi {
  getInstance: () => PromptLibraryInjector | null;
  isInitialized: () => boolean;
  reinitialize: () => void;
  cleanup: () => void;
  getLogger: () => {
    error: typeof error;
    warn: typeof warn;
    info: typeof info;
    debug: typeof debug;
  };
}

declare global {
  interface Window {
    __promptLibraryInjected?: boolean;
    __promptLibraryDebug?: PromptLibraryDebugApi;
  }
}

export default defineContentScript({
  // Content script configuration
  matches: [
    'https://claude.ai/*',
    'https://chatgpt.com/*',
    'https://gemini.google.com/*',
    'https://www.perplexity.ai/*',
    'https://chat.mistral.ai/*'
  ],
  runAt: 'document_idle',
  allFrames: false,

  // Main entry point
  main() {
    // ALL runtime code must be inside this main() function

    // Global instance management with proper typing
    let promptLibraryInstance: PromptLibraryInjector | null = null;
    let isInitialized = false;

    // Mark that content script is injected (for programmatic injection detection)
    window.__promptLibraryInjected = true;

    /**
     * Initialize the extension with proper error handling
     */
    async function initializeExtension(): Promise<void> {
      try {
        // Prevent multiple initializations
        if (isInitialized) {
          debug('Extension already initialized, skipping');
          return;
        }

        debug('Starting My Prompt Manager content script initialization', {
          url: window.location.href,
          hostname: window.location.hostname,
          userAgent: navigator.userAgent
        });

        // Initialize theme manager first (needed for all sites)
        ThemeManager.getInstance();

        // Initialize element picker (available on all sites for custom positioning)
        getElementPicker();

        // Clean up any existing instance
        if (promptLibraryInstance) {
          promptLibraryInstance.cleanup();
          promptLibraryInstance = null;
        }

        // Create new injector instance
        promptLibraryInstance = new PromptLibraryInjector();

        // Initialize with async site enablement checking
        // CSS injection now happens ONLY for enabled sites inside the injector
        await promptLibraryInstance.initialize();

        // Mark as initialized
        isInitialized = true;

        debug('Extension initialized');

      } catch (err) {
        error('Failed to initialize My Prompt Manager content script', err instanceof Error ? err : new Error(String(err)), {
          url: window.location.href,
          hostname: window.location.hostname
        });

        // Reset initialization flag on error
        isInitialized = false;

        // Clean up partial initialization
        if (promptLibraryInstance) {
          try {
            promptLibraryInstance.cleanup();
          } catch (cleanupError) {
            error('Error during cleanup after initialization failure', cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError)));
          }
          promptLibraryInstance = null;
        }
      }
    }

    /**
     * Clean up all resources and instances
     */
    function cleanupExtension(): void {
      try {
        debug('Starting My Prompt Manager content script cleanup');

        if (promptLibraryInstance) {
          promptLibraryInstance.cleanup();
          promptLibraryInstance = null;
        }

        // Cleanup theme manager
        try {
          ThemeManager.getInstance().cleanup();
        } catch (themeError) {
          warn('Error cleaning up theme manager', { error: themeError instanceof Error ? themeError.message : String(themeError) });
        }

        // Reset initialization flag
        isInitialized = false;

        info('Extension cleanup completed');

      } catch (err) {
        error('Error during content script cleanup', err instanceof Error ? err : new Error(String(err)));
      }
    }

    /**
     * Handle page visibility changes for performance optimization
     */
    function handleVisibilityChange(): void {
      if (document.hidden) {
        debug('Page hidden, content script entering background mode');
      } else {
        debug('Page visible, content script resuming active mode');

        // Re-initialize if needed (e.g., after long periods of inactivity)
        if (!isInitialized && !promptLibraryInstance) {
          setTimeout(() => {
            void initializeExtension();
          }, 100);
        }
      }
    }

    /**
     * Handle errors that bubble up to the global scope
     */
    function handleGlobalError(event: ErrorEvent): void {
      // Only handle errors related to our extension
      if (event.error && (
        (event.filename && event.filename.includes('content')) ||
        (event.error && typeof event.error === 'object' && 'stack' in event.error &&
         typeof (event.error as Record<string, unknown>).stack === 'string' &&
         (((event.error as Record<string, unknown>).stack as string).includes('PromptLibrary') || ((event.error as Record<string, unknown>).stack as string).includes('prompt-library')))
      )) {
        error('Global error caught in content script', event.error as Error, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          url: window.location.href
        });
      }
    }

    /**
     * Handle unhandled promise rejections
     */
    function handleUnhandledRejection(event: PromiseRejectionEvent): void {
      // Only handle rejections related to our extension
      if (event.reason && (
        (event.reason as Error).stack?.includes('PromptLibrary') ||
        (event.reason as Error).stack?.includes('prompt-library') ||
        (event.reason as Error).message.includes('prompt')
      )) {
        error('Unhandled promise rejection in content script', event.reason as Error, {
          url: window.location.href
        });
      }
    }

    // Set up global error handling
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Set up cleanup handlers
    window.addEventListener('beforeunload', cleanupExtension);
    window.addEventListener('pagehide', cleanupExtension);

    // Set up visibility change handler for performance optimization
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        void initializeExtension();
      });
    } else {
      // DOM is already ready
      void initializeExtension();
    }

    // Export for potential external access (debugging, testing)
    if (typeof window !== 'undefined') {
      window.__promptLibraryDebug = {
        getInstance: () => promptLibraryInstance,
        isInitialized: () => isInitialized,
        reinitialize: () => {
          cleanupExtension();
          void initializeExtension();
        },
        cleanup: cleanupExtension,
        getLogger: () => ({ error, warn, info, debug })
      };
    }

    // For development/debugging - log when script loads
    debug('My Prompt Manager content script loaded', {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      readyState: document.readyState
    });
  }
});

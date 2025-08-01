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

import { StylesManager } from './utils/styles';
import { PromptLibraryInjector } from './core/injector';
import { Logger } from './utils/logger';

// Global instance management with proper typing
let promptLibraryInstance: PromptLibraryInjector | null = null;
let isInitialized = false;

/**
 * Initialize the extension with proper error handling
 */
async function initializeExtension(): Promise<void> {
  try {
    // Prevent multiple initializations
    if (isInitialized) {
      Logger.debug('Extension already initialized, skipping');
      return;
    }

    Logger.info('Starting My Prompt Manager content script initialization', {
      url: window.location.href,
      hostname: window.location.hostname,
      userAgent: navigator.userAgent
    });

    // Initialize CSS styles first
    StylesManager.injectCSS();

    // Clean up any existing instance
    if (promptLibraryInstance) {
      promptLibraryInstance.cleanup();
      promptLibraryInstance = null;
    }

    // Create new injector instance
    promptLibraryInstance = new PromptLibraryInjector();
    
    // Mark as initialized
    isInitialized = true;

    Logger.info('My Prompt Manager content script initialized successfully');

  } catch (error) {
    Logger.error('Failed to initialize My Prompt Manager content script', error as Error, {
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
        Logger.error('Error during cleanup after initialization failure', cleanupError as Error);
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
    Logger.info('Starting My Prompt Manager content script cleanup');

    if (promptLibraryInstance) {
      promptLibraryInstance.cleanup();
      promptLibraryInstance = null;
    }

    // Reset initialization flag
    isInitialized = false;

    Logger.info('My Prompt Manager content script cleanup completed');

  } catch (error) {
    Logger.error('Error during content script cleanup', error as Error);
  }
}

/**
 * Handle page visibility changes for performance optimization
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    // Page is hidden, we could pause some operations if needed
    Logger.debug('Page hidden, content script entering background mode');
  } else {
    // Page is visible again
    Logger.debug('Page visible, content script resuming active mode');
    
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
    event.filename?.includes('content') ||
    event.error.stack?.includes('PromptLibrary') ||
    event.error.stack?.includes('prompt-library')
  )) {
    Logger.error('Global error caught in content script', event.error, {
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
    event.reason.stack?.includes('PromptLibrary') ||
    event.reason.stack?.includes('prompt-library') ||
    event.reason.message?.includes('prompt')
  )) {
    Logger.error('Unhandled promise rejection in content script', event.reason, {
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
  (window as any).__promptLibraryDebug = {
    getInstance: () => promptLibraryInstance,
    isInitialized: () => isInitialized,
    reinitialize: () => {
      cleanupExtension();
      return initializeExtension();
    },
    cleanup: cleanupExtension,
    getLogger: () => Logger
  };
}

// For development/debugging - log when script loads
Logger.info('My Prompt Manager content script loaded', {
  timestamp: new Date().toISOString(),
  url: window.location.href,
  readyState: document.readyState
});
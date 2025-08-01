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

import { PromptLibraryInjector } from './core/injector';
import { error, warn, info, debug } from './utils/logger';
import { injectCSS } from './utils/styles';

// Global instance management with proper typing
let promptLibraryInstance: PromptLibraryInjector | null = null;
let isInitialized = false;

/**
 * Initialize the extension with proper error handling
 */
function initializeExtension(): void {
  try {
    // Prevent multiple initializations
    if (isInitialized) {
      debug('Extension already initialized, skipping');
      return;
    }

    info('Starting My Prompt Manager content script initialization', {
      url: window.location.href,
      hostname: window.location.hostname,
      userAgent: navigator.userAgent
    });

    // Initialize CSS styles first
    injectCSS();

    // Clean up any existing instance
    if (promptLibraryInstance) {
      promptLibraryInstance.cleanup();
      promptLibraryInstance = null;
    }

    // Create new injector instance
    promptLibraryInstance = new PromptLibraryInjector();
    
    // Mark as initialized
    isInitialized = true;

    info('My Prompt Manager content script initialized successfully');

  } catch (error) {
    error('Failed to initialize My Prompt Manager content script', error as Error, {
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
        error('Error during cleanup after initialization failure', cleanupError as Error);
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
    info('Starting My Prompt Manager content script cleanup');

    if (promptLibraryInstance) {
      promptLibraryInstance.cleanup();
      promptLibraryInstance = null;
    }

    // Reset initialization flag
    isInitialized = false;

    info('My Prompt Manager content script cleanup completed');

  } catch (error) {
    error('Error during content script cleanup', error as Error);
  }
}

/**
 * Handle page visibility changes for performance optimization
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    // Page is hidden, we could pause some operations if needed
    debug('Page hidden, content script entering background mode');
  } else {
    // Page is visible again
    debug('Page visible, content script resuming active mode');
    
    // Re-initialize if needed (e.g., after long periods of inactivity)
    if (!isInitialized && !promptLibraryInstance) {
      setTimeout(() => {
        initializeExtension();
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
    initializeExtension();
  });
} else {
  // DOM is already ready
  initializeExtension();
}

// Export for potential external access (debugging, testing)
if (typeof window !== 'undefined') {
  (window as Record<string, unknown>).__promptLibraryDebug = {
    getInstance: () => promptLibraryInstance,
    isInitialized: () => isInitialized,
    reinitialize: () => {
      cleanupExtension();
      initializeExtension();
    },
    cleanup: cleanupExtension,
    getLogger: () => ({ error, warn, info, debug })
  };
}

// For development/debugging - log when script loads
info('My Prompt Manager content script loaded', {
  timestamp: new Date().toISOString(),
  url: window.location.href,
  readyState: document.readyState
});
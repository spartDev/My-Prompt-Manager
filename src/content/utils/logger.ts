/**
 * Logger utility module for the content script
 * Provides structured logging with debug mode support and user notifications
 */

import type { DebugInfo, NotificationType } from '../types/index';

let _lastNotification: string | null = null;

/**
 * Cache for the debug mode setting to avoid repeated Chrome storage calls
 */
let _debugModeCache: boolean | null = null;
let _debugModeCacheTime = 0;
const DEBUG_CACHE_DURATION = 5000; // 5 seconds

/**
 * Check if debug mode is enabled
 * Debug mode is enabled in development, via Chrome extension settings, or localStorage fallback
 */
export function isDebugMode(): boolean {
  // Always enabled on localhost for development
  if (window.location.hostname === 'localhost') {
    return true;
  }

  // Use cached value if it's still fresh
  const now = Date.now();
  if (_debugModeCache !== null && (now - _debugModeCacheTime) < DEBUG_CACHE_DURATION) {
    return _debugModeCache;
  }

  // Try localStorage as immediate fallback (synchronous)
  try {
    const localStorageDebug = localStorage.getItem('prompt-library-debug') === 'true';
    if (localStorageDebug) {
      _debugModeCache = true;
      _debugModeCacheTime = now;
      return true;
    }
  } catch {
    // localStorage not available, continue to Chrome storage check
  }

  // Return cached value or false while we update the cache asynchronously
  const cachedValue = _debugModeCache ?? false;
  
  // Update cache asynchronously from Chrome storage
  updateDebugModeCache().catch(() => {
    // Ignore errors, keep using cached/fallback value
  });

  return cachedValue;
}

/**
 * Asynchronously update the debug mode cache from Chrome extension settings
 */
async function updateDebugModeCache(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(['promptLibrarySettings']);
      const settings = result.promptLibrarySettings as { debugMode?: boolean } | undefined;
      _debugModeCache = settings?.debugMode ?? false;
      _debugModeCacheTime = Date.now();
    }
  } catch {
    // Chrome storage not available, keep current cache
  }
}

/**
 * Initialize debug mode cache on module load
 */
updateDebugModeCache().catch(() => {
  // Ignore errors during initialization
});

/**
 * Force refresh of debug mode cache (called when settings are updated)
 */
export function refreshDebugMode(): void {
  _debugModeCache = null;
  _debugModeCacheTime = 0;
  updateDebugModeCache().catch(() => {
    // Ignore errors during refresh
  });
}

/**
 * Reset debug cache for testing (internal use only)
 * @internal
 */
export function _resetDebugCacheForTesting(): void {
  _debugModeCache = null;
  _debugModeCacheTime = 0;
}

/**
 * Log error messages with optional error object and context
 */
export function error(message: string, errorObj: Error | null = null, context: Record<string, unknown> = {}): void {
    const logData: DebugInfo = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent.substring(0, 100) // Truncate for privacy
    };

    if (errorObj) {
      logData.error = {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack?.substring(0, 500) // Truncate stack trace
      };
    }

    console.error('[PromptLibrary]', message, logData);

    // In debug mode, also show user-friendly notifications
    if (isDebugMode()) {
      showDebugNotification('Error: ' + message, 'error');
    }
}

/**
 * Log warning messages with optional context
 */
export function warn(message: string, context: Record<string, unknown> = {}): void {
    const logData: DebugInfo = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      context,
      url: window.location.href
    };

    console.warn('[PromptLibrary]', message, logData);

    if (isDebugMode()) {
      showDebugNotification('Warning: ' + message, 'warn');
    }
}

/**
 * Log info messages - only for critical extension lifecycle events
 * Most operational messages should use debug() instead
 */
export function info(message: string, context: Record<string, unknown> = {}): void {
    // Only log truly critical messages, even outside debug mode
    const criticalMessages = [
      'Extension initialized',
      'Extension cleanup completed'
    ];
    
    const isCritical = criticalMessages.some(critical => message.includes(critical));
    
    if (isCritical || isDebugMode()) {
      const logData: DebugInfo = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message,
        context,
        url: window.location.href
      };

      console.info('[PromptLibrary]', message, logData);
    }
}

/**
 * Log debug messages (only in debug mode)
 */
export function debug(message: string, context: Record<string, unknown> = {}): void {
    if (isDebugMode()) {
      const logData: DebugInfo = {
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        context,
        url: window.location.href
      };

      console.debug('[PromptLibrary]', message, logData);
    }
}

/**
 * Show debug notification to user (only in debug mode)
 * Includes spam prevention to avoid duplicate notifications
 */
export function showDebugNotification(message: string, type: NotificationType = 'info'): void {
    // Only show in debug mode and avoid spam
    if (!isDebugMode() || _lastNotification === message) {return;}
    _lastNotification = message;

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000000;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ${type === 'error' ? 'background: #fee; border-left: 4px solid #f56565; color: #742a2a;' :
        type === 'warn' ? 'background: #fef5e7; border-left: 4px solid #ed8936; color: #744210;' :
        'background: #e6fffa; border-left: 4px solid #38b2ac; color: #234e52;'}
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);

    // Clear the spam prevention after 10 seconds
    setTimeout(() => {
      if (_lastNotification === message) {
        _lastNotification = null;
      }
    }, 10000);
}
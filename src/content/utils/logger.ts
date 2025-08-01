/**
 * Logger utility module for the content script
 * Provides structured logging with debug mode support and user notifications
 */

import type { DebugInfo, NotificationType } from '../types/index';

let _lastNotification: string | null = null;

/**
 * Check if debug mode is enabled
 * Debug mode is enabled in development or via localStorage flag
 */
export function isDebugMode(): boolean {
  try {
    return localStorage.getItem('prompt-library-debug') === 'true' || 
           window.location.hostname === 'localhost';
  } catch {
    // Fallback if localStorage is not available
    return window.location.hostname === 'localhost';
  }
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
 * Log info messages (only in debug mode)
 */
export function info(message: string, context: Record<string, unknown> = {}): void {
    if (isDebugMode()) {
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
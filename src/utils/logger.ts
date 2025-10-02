/**
 * Logger utility for popup/sidepanel context
 * Provides structured logging with development/production mode support
 *
 * All logs are prefixed with [MyPromptManager] for easy identification.
 * Production mode: Only errors are logged
 * Development mode: All log levels are active
 */

/**
 * Context object for structured logging
 * Provides additional metadata about the log entry
 *
 * The `component` field is required to identify the source of the log.
 * Additional properties can be added for context-specific information.
 *
 * @example
 * { component: 'Background', tabId: 123, url: 'https://example.com' }
 *
 * @example
 * { component: 'Storage', operation: 'save', size: 1024 }
 */
export interface LogContext extends Record<string, unknown> {
  /** Required: Identifies the component or module generating the log */
  component: string;
}

interface LogData {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message: string;
  context?: LogContext;
}

/**
 * Check if running in development mode
 */
function isDevelopment(): boolean {
  // Check Vite environment variable
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
}

/**
 * Truncate stack trace to preserve error message and first few stack frames
 *
 * @param stack - Full stack trace string
 * @param maxFrames - Maximum number of stack frames to keep (default: 3)
 * @returns Truncated stack trace with indicator if truncated
 *
 * @example
 * Input: "Error: Test\n    at foo.js:10\n    at bar.js:20\n    at baz.js:30\n    at qux.js:40"
 * Output: "Error: Test\n    at foo.js:10\n    at bar.js:20\n    at baz.js:30\n... (stack truncated)"
 */
function truncateStack(stack: string | undefined, maxFrames: number = 3): string | undefined {
  if (!stack) {
    return stack;
  }

  // In development mode, return full stack
  if (isDevelopment()) {
    return stack;
  }

  const lines = stack.split('\n');

  // If stack is short enough, return as-is
  // +1 for error message line
  if (lines.length <= maxFrames + 1) {
    return stack;
  }

  // Keep error message line + first N stack frames
  const truncatedLines = lines.slice(0, maxFrames + 1);
  truncatedLines.push('... (stack truncated)');

  return truncatedLines.join('\n');
}

/**
 * Format log message with structured data
 */
function formatLog(level: LogData['level'], message: string, context?: LogContext): LogData {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {})
  };
}

/**
 * Log error messages (always logged, even in production)
 *
 * Use this for critical errors that should always be visible, regardless of environment.
 * Stack traces are truncated in production to preserve error message and first 3 stack frames,
 * with a clear truncation indicator to avoid console spam.
 *
 * @param message - Human-readable error message
 * @param errorObj - Optional Error object with stack trace
 * @param context - Optional structured context data for debugging
 *
 * @example
 * // Simple error without Error object
 * Logger.error('Failed to save settings', undefined, { component: 'SettingsView' });
 *
 * @example
 * // Error with Error object and context
 * try {
 *   await saveData();
 * } catch (err) {
 *   Logger.error('Failed to save data', toError(err), { component: 'Storage', operation: 'save' });
 * }
 */
export function error(message: string, errorObj?: Error, context?: LogContext): void {
  const logData = formatLog('ERROR', message, context);

  if (errorObj) {

    console.error('[MyPromptManager]', message, {
      ...logData,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: truncateStack(errorObj.stack)
      }
    });
  } else {

    console.error('[MyPromptManager]', message, logData);
  }
}

/**
 * Log warning messages (only in development)
 *
 * Use this for non-critical issues that should be investigated during development.
 * These logs are completely suppressed in production builds.
 *
 * @param message - Human-readable warning message
 * @param context - Optional structured context data for debugging
 *
 * @example
 * Logger.warn('Tab access denied', { component: 'ContentScriptInjector', tabId: 123 });
 *
 * @example
 * Logger.warn('Storage quota exceeded', { component: 'Storage', usagePercent: 95 });
 */
export function warn(message: string, context?: LogContext): void {
  if (isDevelopment()) {
    const logData = formatLog('WARN', message, context);
    // eslint-disable-next-line no-console -- Development logging only
    console.warn('[MyPromptManager]', message, logData);
  }
}

/**
 * Log informational messages (only in development)
 *
 * Use this for general information about application state or significant events.
 * These logs are completely suppressed in production builds.
 *
 * @param message - Human-readable informational message
 * @param context - Optional structured context data for debugging
 *
 * @example
 * Logger.info('Settings updated', { component: 'SettingsView', theme: 'dark' });
 *
 * @example
 * Logger.info('Extension initialized', { component: 'Background', mode: 'sidepanel' });
 */
export function info(message: string, context?: LogContext): void {
  if (isDevelopment()) {
    const logData = formatLog('INFO', message, context);
    // eslint-disable-next-line no-console -- Development logging only
    console.info('[MyPromptManager]', message, logData);
  }
}

/**
 * Log debug messages (only in development)
 *
 * Use this for detailed debugging information that's only useful during development.
 * These logs are completely suppressed in production builds.
 *
 * @param message - Human-readable debug message
 * @param context - Optional structured context data for debugging
 *
 * @example
 * Logger.debug('Function called', { component: 'PromptManager', args: { id: '123' } });
 *
 * @example
 * Logger.debug('Cache hit', { component: 'Storage', key: 'prompts', size: 42 });
 */
export function debug(message: string, context?: LogContext): void {
  if (isDevelopment()) {
    const logData = formatLog('DEBUG', message, context);
    // eslint-disable-next-line no-console -- Development logging only
    console.debug('[MyPromptManager]', message, logData);
  }
}

/**
 * General-purpose log messages (only in development)
 *
 * Use this for general development logging that doesn't fit into error/warn/info/debug.
 * These logs are completely suppressed in production builds.
 *
 * @param message - Human-readable log message
 * @param context - Optional structured context data for debugging
 *
 * @example
 * Logger.log('Processing started', { component: 'Worker', items: 100 });
 *
 * @example
 * Logger.log('User action', { component: 'UI', action: 'click', element: 'button' });
 */
export function log(message: string, context?: LogContext): void {
  if (isDevelopment()) {
    const logData = formatLog('DEBUG', message, context);
    // eslint-disable-next-line no-console -- Development logging only
    console.log('[MyPromptManager]', message, logData);
  }
}

/**
 * Start a collapsible group of console logs (only in development)
 *
 * Use this to organize related log messages into collapsible groups in the console.
 * Must be paired with a call to groupEnd(). These logs are suppressed in production.
 *
 * @param label - Label for the log group
 *
 * @example
 * Logger.group('Processing batch');
 * Logger.info('Item 1 processed');
 * Logger.info('Item 2 processed');
 * Logger.groupEnd();
 */
export function group(label: string): void {
  if (isDevelopment()) {
    // eslint-disable-next-line no-console -- Development logging only
    console.group(`[MyPromptManager] ${label}`);
  }
}

/**
 * End the current console log group (only in development)
 *
 * Closes a group started by group(). These logs are suppressed in production.
 *
 * @example
 * Logger.group('Processing batch');
 * Logger.info('Item 1 processed');
 * Logger.info('Item 2 processed');
 * Logger.groupEnd();
 */
export function groupEnd(): void {
  if (isDevelopment()) {
    // eslint-disable-next-line no-console -- Development logging only
    console.groupEnd();
  }
}

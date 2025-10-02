/**
 * Logger utility for popup/sidepanel context
 * Provides structured logging with development/production mode support
 */

export interface LogContext {
  [key: string]: unknown;
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
 * Errors are critical and should always be captured
 */
export function error(message: string, errorObj?: Error, context?: LogContext): void {
  const logData = formatLog('ERROR', message, context);

  if (errorObj) {
     
    console.error('[MyPromptManager]', message, {
      ...logData,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: isDevelopment() ? errorObj.stack : errorObj.stack?.substring(0, 200) // Truncate in production
      }
    });
  } else {
     
    console.error('[MyPromptManager]', message, logData);
  }
}

/**
 * Log warning messages (only in development)
 */
export function warn(message: string, context?: LogContext): void {
  if (isDevelopment()) {
    const logData = formatLog('WARN', message, context);
    // eslint-disable-next-line no-console -- Development logging only
    console.warn('[MyPromptManager]', message, logData);
  }
}

/**
 * Log info messages (only in development)
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
 */
export function debug(message: string, context?: LogContext): void {
  if (isDevelopment()) {
    const logData = formatLog('DEBUG', message, context);
    // eslint-disable-next-line no-console -- Development logging only
    console.debug('[MyPromptManager]', message, logData);
  }
}

/**
 * Log messages (only in development)
 * General-purpose logging for development
 */
export function log(message: string, context?: LogContext): void {
  if (isDevelopment()) {
    const logData = formatLog('DEBUG', message, context);
    // eslint-disable-next-line no-console -- Development logging only
    console.log('[MyPromptManager]', message, logData);
  }
}

/**
 * Group console logs (only in development)
 */
export function group(label: string): void {
  if (isDevelopment()) {
    // eslint-disable-next-line no-console -- Development logging only
    console.group(`[MyPromptManager] ${label}`);
  }
}

/**
 * End console group (only in development)
 */
export function groupEnd(): void {
  if (isDevelopment()) {
    // eslint-disable-next-line no-console -- Development logging only
    console.groupEnd();
  }
}

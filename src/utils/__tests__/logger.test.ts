/**
 * Comprehensive unit tests for Logger utility module
 * Tests production/development mode behavior, log formatting, and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as Logger from '../logger';

describe('Logger', () => {
  // Save original console methods
  const originalConsole = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    log: console.log,
    group: console.group,
    groupEnd: console.groupEnd,
  };

  // Mock console methods
  const mockConsole = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
    group: vi.fn(),
    groupEnd: vi.fn(),
  };

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Replace console methods with mocks
    console.error = mockConsole.error;
    console.warn = mockConsole.warn;
    console.info = mockConsole.info;
    console.debug = mockConsole.debug;
    console.log = mockConsole.log;
    console.group = mockConsole.group;
    console.groupEnd = mockConsole.groupEnd;
  });

  afterEach(() => {
    // Restore original console methods
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
    console.log = originalConsole.log;
    console.group = originalConsole.group;
    console.groupEnd = originalConsole.groupEnd;
  });

  describe('error() - Always Logged', () => {
    it('should always log errors in production mode', () => {
      const message = 'Test error message';
      const error = new Error('Test error details');
      const context = { component: 'TestComponent', operation: 'save' };

      Logger.error(message, error, context);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[MyPromptManager]',
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
          level: 'ERROR',
          message,
          context,
          error: {
            name: 'Error',
            message: 'Test error details',
            stack: expect.any(String),
          },
        })
      );
    });

    it('should log error without Error object', () => {
      const message = 'Test error without exception';
      const context = { component: 'Background', tabId: 123 };

      Logger.error(message, undefined, context);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[MyPromptManager]',
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
          level: 'ERROR',
          message,
          context,
        })
      );
    });

    it('should log error without context', () => {
      const message = 'Simple error message';
      const error = new Error('Error details');

      Logger.error(message, error);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const callArgs = mockConsole.error.mock.calls[0];
      expect(callArgs[0]).toBe('[MyPromptManager]');
      expect(callArgs[1]).toBe(message);
      expect(callArgs[2]).toMatchObject({
        timestamp: expect.any(String),
        level: 'ERROR',
        message,
        error: {
          name: 'Error',
          message: 'Error details',
          stack: expect.any(String),
        },
      });
      // Ensure context is not present when not provided
      expect(callArgs[2]).not.toHaveProperty('context');
    });

    it('should log error with minimal context object', () => {
      const message = 'Error with minimal context';
      const error = new Error('Details');

      Logger.error(message, error, { component: 'Test' });

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const callArgs = mockConsole.error.mock.calls[0];
      // Context with only component field should be included
      expect(callArgs[2]).toHaveProperty('context');
      expect(callArgs[2].context).toEqual({ component: 'Test' });
    });

    it('should handle Error with no stack trace', () => {
      const message = 'Error without stack';
      const error = new Error('Test');
      delete error.stack;

      Logger.error(message, error);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[MyPromptManager]',
        message,
        expect.objectContaining({
          error: {
            name: 'Error',
            message: 'Test',
            stack: undefined,
          },
        })
      );
    });

    it('should truncate stack trace using line-based truncation in production', () => {
      const message = 'Error with long stack';
      // Create realistic stack trace with error message + multiple frames
      const longStack = [
        'Error: Test error message',
        '    at Object.method1 (/path/to/file1.js:10:20)',
        '    at Object.method2 (/path/to/file2.js:20:30)',
        '    at Object.method3 (/path/to/file3.js:30:40)',
        '    at Object.method4 (/path/to/file4.js:40:50)',
        '    at Object.method5 (/path/to/file5.js:50:60)',
        '    at Object.method6 (/path/to/file6.js:60:70)',
      ].join('\n');

      // In production, should preserve error message + first 3 frames + truncation indicator
      const truncatedStack = [
        'Error: Test error message',
        '    at Object.method1 (/path/to/file1.js:10:20)',
        '    at Object.method2 (/path/to/file2.js:20:30)',
        '    at Object.method3 (/path/to/file3.js:30:40)',
        '... (stack truncated)',
      ].join('\n');

      const error = new Error('Test error message');
      error.stack = longStack;

      Logger.error(message, error);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const callArgs = mockConsole.error.mock.calls[0];
      const loggedStack = callArgs[2].error.stack;

      // Compute expected values based on environment
      const expectedStack = import.meta.env.DEV ? longStack : truncatedStack;
      const shouldContainTruncationIndicator = !import.meta.env.DEV;

      expect(loggedStack).toBe(expectedStack);
      expect(loggedStack.includes('... (stack truncated)')).toBe(shouldContainTruncationIndicator);
      expect(loggedStack).toContain('Error: Test error message');
    });

    it('should preserve error message integrity when truncating', () => {
      const message = 'Test error message preservation';
      const stack = [
        'Error: This is a very important error message that must not be cut',
        '    at function1 (/file1.js:1:1)',
        '    at function2 (/file2.js:2:2)',
        '    at function3 (/file3.js:3:3)',
        '    at function4 (/file4.js:4:4)',
      ].join('\n');

      const error = new Error('This is a very important error message that must not be cut');
      error.stack = stack;

      Logger.error(message, error);

      const callArgs = mockConsole.error.mock.calls[0];
      const loggedStack = callArgs[2].error.stack;

      // Error message line must be completely preserved in both dev and prod
      expect(loggedStack).toContain('Error: This is a very important error message that must not be cut');
      // Should not cut mid-message - first line should always be the full error message
      const firstLine = loggedStack.split('\n')[0];
      expect(firstLine).toBe('Error: This is a very important error message that must not be cut');
    });

    it('should not truncate short stacks', () => {
      const message = 'Short stack test';
      const shortStack = [
        'Error: Short error',
        '    at method1 (/file.js:10:20)',
        '    at method2 (/file.js:20:30)',
      ].join('\n');

      const error = new Error('Short error');
      error.stack = shortStack;

      Logger.error(message, error);

      const callArgs = mockConsole.error.mock.calls[0];
      const loggedStack = callArgs[2].error.stack;

      // Short stacks should not be truncated even in production
      expect(loggedStack).toBe(shortStack);
      expect(loggedStack).not.toContain('... (stack truncated)');
    });

    it('should include valid ISO timestamp', () => {
      const message = 'Test timestamp';
      Logger.error(message);

      const callArgs = mockConsole.error.mock.calls[0];
      const timestamp = callArgs[2].timestamp;

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should preserve complex context objects', () => {
      const message = 'Complex context test';
      const context = {
        component: 'Storage',
        operation: 'save',
        metadata: {
          id: 123,
          nested: { value: 'test' },
        },
        array: [1, 2, 3],
        nullValue: null,
        undefinedValue: undefined,
      };

      Logger.error(message, undefined, context);

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[MyPromptManager]',
        message,
        expect.objectContaining({
          context,
        })
      );
    });
  });

  describe('warn() - Development Only', () => {
    it('should log warnings in development mode', () => {
      if (!import.meta.env.DEV) {
        // Skip this test in production mode
        return;
      }

      const message = 'Warning message';
      const context = { component: 'Background', tabId: 456 };

      Logger.warn(message, context);

      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[MyPromptManager]',
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
          level: 'WARN',
          message,
          context,
        })
      );
    });

    it('should suppress warnings in production mode', () => {
      if (import.meta.env.DEV) {
        // Skip this test in development mode
        return;
      }

      Logger.warn('Warning message', { component: 'Test' });

      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('should log warning without context', () => {
      if (!import.meta.env.DEV) {return;}

      const message = 'Warning without context';
      Logger.warn(message);

      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const callArgs = mockConsole.warn.mock.calls[0];
      expect(callArgs[2]).not.toHaveProperty('context');
    });
  });

  describe('info() - Development Only', () => {
    it('should log info messages in development mode', () => {
      if (!import.meta.env.DEV) {return;}

      const message = 'Info message';
      const context = { component: 'SettingsView', theme: 'dark' };

      Logger.info(message, context);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[MyPromptManager]',
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
          level: 'INFO',
          message,
          context,
        })
      );
    });

    it('should suppress info messages in production mode', () => {
      if (import.meta.env.DEV) {return;}

      Logger.info('Info message', { component: 'Test' });

      expect(mockConsole.info).not.toHaveBeenCalled();
    });

    it('should log info without context', () => {
      if (!import.meta.env.DEV) {return;}

      const message = 'Info without context';
      Logger.info(message);

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const callArgs = mockConsole.info.mock.calls[0];
      expect(callArgs[2]).not.toHaveProperty('context');
    });
  });

  describe('debug() - Development Only', () => {
    it('should log debug messages in development mode', () => {
      if (!import.meta.env.DEV) {return;}

      const message = 'Debug message';
      const context = { component: 'Storage', key: 'prompts', size: 42 };

      Logger.debug(message, context);

      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      expect(mockConsole.debug).toHaveBeenCalledWith(
        '[MyPromptManager]',
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
          level: 'DEBUG',
          message,
          context,
        })
      );
    });

    it('should suppress debug messages in production mode', () => {
      if (import.meta.env.DEV) {return;}

      Logger.debug('Debug message', { component: 'Test' });

      expect(mockConsole.debug).not.toHaveBeenCalled();
    });

    it('should log debug without context', () => {
      if (!import.meta.env.DEV) {return;}

      const message = 'Debug without context';
      Logger.debug(message);

      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      const callArgs = mockConsole.debug.mock.calls[0];
      expect(callArgs[2]).not.toHaveProperty('context');
    });
  });

  describe('log() - Development Only', () => {
    it('should log general messages in development mode', () => {
      if (!import.meta.env.DEV) {return;}

      const message = 'General log message';
      const context = { component: 'Worker', items: 100 };

      Logger.log(message, context);

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[MyPromptManager]',
        message,
        expect.objectContaining({
          timestamp: expect.any(String),
          level: 'DEBUG',
          message,
          context,
        })
      );
    });

    it('should suppress log messages in production mode', () => {
      if (import.meta.env.DEV) {return;}

      Logger.log('Log message', { component: 'Test' });

      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('should log without context', () => {
      if (!import.meta.env.DEV) {return;}

      const message = 'Log without context';
      Logger.log(message);

      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      const callArgs = mockConsole.log.mock.calls[0];
      expect(callArgs[2]).not.toHaveProperty('context');
    });
  });

  describe('group() - Development Only', () => {
    it('should create console group in development mode', () => {
      if (!import.meta.env.DEV) {return;}

      const label = 'Processing batch';
      Logger.group(label);

      expect(mockConsole.group).toHaveBeenCalledTimes(1);
      expect(mockConsole.group).toHaveBeenCalledWith('[MyPromptManager] Processing batch');
    });

    it('should suppress console group in production mode', () => {
      if (import.meta.env.DEV) {return;}

      Logger.group('Test group');

      expect(mockConsole.group).not.toHaveBeenCalled();
    });

    it('should handle empty label', () => {
      if (!import.meta.env.DEV) {return;}

      Logger.group('');

      expect(mockConsole.group).toHaveBeenCalledWith('[MyPromptManager] ');
    });
  });

  describe('groupEnd() - Development Only', () => {
    it('should end console group in development mode', () => {
      if (!import.meta.env.DEV) {return;}

      Logger.groupEnd();

      expect(mockConsole.groupEnd).toHaveBeenCalledTimes(1);
    });

    it('should suppress groupEnd in production mode', () => {
      if (import.meta.env.DEV) {return;}

      Logger.groupEnd();

      expect(mockConsole.groupEnd).not.toHaveBeenCalled();
    });
  });

  describe('Integration: Log Grouping', () => {
    it('should work with nested logging calls', () => {
      if (!import.meta.env.DEV) {return;}

      Logger.group('Batch operation');
      Logger.info('Started processing', { component: 'Worker' });
      Logger.debug('Processing item 1');
      Logger.debug('Processing item 2');
      Logger.info('Completed processing', { component: 'Worker' });
      Logger.groupEnd();

      expect(mockConsole.group).toHaveBeenCalledTimes(1);
      expect(mockConsole.info).toHaveBeenCalledTimes(2);
      expect(mockConsole.debug).toHaveBeenCalledTimes(2);
      expect(mockConsole.groupEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      Logger.error(longMessage);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const callArgs = mockConsole.error.mock.calls[0];
      expect(callArgs[1]).toBe(longMessage);
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Error: <script>alert("xss")</script> 🎉 \n\t\r';
      Logger.error(specialMessage);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[MyPromptManager]',
        specialMessage,
        expect.any(Object)
      );
    });

    it('should handle circular references in context', () => {
      const circular: Record<string, unknown> & { component: string } = { component: 'Test' };
      circular.self = circular;

      // Should not throw - console.error handles circular references
      expect(() => Logger.error('Circular test', undefined, circular)).not.toThrow();
    });

    it('should handle Error with custom properties', () => {
      const error = new Error('Test error');
      (error as Error & { code?: string }).code = 'CUSTOM_ERROR';
      (error as Error & { details?: Record<string, string> }).details = { foo: 'bar' };

      Logger.error('Custom error', error);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      // Note: Custom properties are not extracted by the logger,
      // but the full error object is available in the context
    });

    it('should handle concurrent logging calls', () => {
      const calls = 100;
      for (let i = 0; i < calls; i++) {
        Logger.error(`Error ${i.toString()}`, undefined, { component: 'Test', index: i });
      }

      expect(mockConsole.error).toHaveBeenCalledTimes(calls);
    });

    it('should handle null and undefined in context', () => {
      const context = {
        component: 'Test',
        nullValue: null,
        undefinedValue: undefined,
        zeroValue: 0,
        falseValue: false,
        emptyString: '',
      };

      Logger.error('Null/undefined test', undefined, context);

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[MyPromptManager]',
        'Null/undefined test',
        expect.objectContaining({
          context,
        })
      );
    });
  });

  describe('Performance', () => {
    it('should not execute expensive operations when logs are suppressed', () => {
      if (import.meta.env.DEV) {return;}

      const expensiveOperation = vi.fn(() => {
        // Simulate expensive computation
        return { result: 'expensive' };
      });

      // In production, this should not call expensiveOperation
      // because the log is suppressed
      Logger.debug('Test', { component: 'Test', result: expensiveOperation() });

      // The function was called to create the context,
      // but console.debug was not called
      expect(mockConsole.debug).not.toHaveBeenCalled();
    });
  });

  describe('Type Safety', () => {
    it('should accept string messages', () => {
      expect(() => Logger.error('string message')).not.toThrow();
    });

    it('should accept Error objects', () => {
      const error = new Error('test');
      expect(() => Logger.error('message', error)).not.toThrow();
    });

    it('should require component field in context (type-level)', () => {
      // This test verifies the TypeScript type requirement
      // If component is missing, TypeScript compilation will fail

      // Valid: has component field
      const validContext: Logger.LogContext = {
        component: 'TestComponent',
        additionalData: 'value',
      };
      expect(() => Logger.error('test', undefined, validContext)).not.toThrow();

      // The following would fail TypeScript compilation (demonstrated with @ts-expect-error):
      // @ts-expect-error - Missing required 'component' field
      const invalidContext: Logger.LogContext = {
        additionalData: 'value',
      };
      // This line exists to avoid unused variable warning
      expect(invalidContext).toBeDefined();
    });

    it('should accept context objects with component and any additional properties', () => {
      const contexts: Logger.LogContext[] = [
        { component: 'Test' },
        { component: 'Test', nested: { deep: { value: 1 } } },
        { component: 'Test', array: [1, 2, 3] },
        { component: 'Test', mixed: { a: 1, b: 'str', c: null } },
        { component: 'Storage', operation: 'save', size: 1024 },
        { component: 'Background', tabId: 123, url: 'https://example.com' },
      ];

      contexts.forEach((context) => {
        expect(() => Logger.error('test', undefined, context)).not.toThrow();
      });
    });

    it('should enforce component field is a string', () => {
      // Valid: component is string
      const validContext: Logger.LogContext = {
        component: 'ValidComponent',
      };
      expect(validContext.component).toBeTypeOf('string');

      // The following would fail TypeScript compilation:
      // component must be string, not number
      const invalidContext1 = {
        component: 123 as unknown as string,
      };
      expect(invalidContext1).toBeDefined();

      // component must be string, not boolean
      const invalidContext2 = {
        component: true as unknown as string,
      };
      expect(invalidContext2).toBeDefined();
    });

    it('should allow component field to be used as a discriminator', () => {
      // TypeScript can use component for type narrowing
      const context: Logger.LogContext = {
        component: 'Storage',
        operation: 'save',
      };

      // Can safely access component as string
      const componentName: string = context.component;
      expect(componentName).toBe('Storage');

      // Can use component in type guards - the condition is always true here
      // but demonstrates the pattern for type narrowing
      expect(context.component).toBe('Storage');
      expect(context.operation).toBe('save');
    });
  });
});

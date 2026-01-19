/**
 * Unit tests for error utility functions
 * Tests toError() and getErrorMessage() helpers
 */

import { describe, it, expect } from 'vitest';

import { toError, getErrorMessage } from '../error';

describe('toError', () => {
  describe('Error objects', () => {
    it('should return Error objects unchanged', () => {
      const error = new Error('Test error');
      const result = toError(error);

      expect(result).toBe(error);
      expect(result.message).toBe('Test error');
    });

    it('should preserve Error subclasses', () => {
      const typeError = new TypeError('Type error');
      const result = toError(typeError);

      expect(result).toBe(typeError);
      expect(result).toBeInstanceOf(TypeError);
      expect(result.message).toBe('Type error');
    });

    it('should preserve custom Error properties', () => {
      const error = new Error('Custom error');
      (error as Error & { code?: string }).code = 'ERR_CUSTOM';
      const result = toError(error);

      expect(result).toBe(error);
      expect((result as Error & { code?: string }).code).toBe('ERR_CUSTOM');
    });

    it('should preserve stack traces', () => {
      const error = new Error('Stack test');
      const result = toError(error);

      expect(result).toBe(error);
      expect(result.stack).toBeDefined();
      expect(result.stack).toContain('Stack test');
    });
  });

  describe('String errors', () => {
    it('should convert strings to Error objects', () => {
      const result = toError('String error');

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('String error');
    });

    it('should handle empty strings', () => {
      const result = toError('');

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('');
    });

    it('should handle strings with special characters', () => {
      const specialString = 'Error: <script>alert("xss")</script> 🚨 \n\t';
      const result = toError(specialString);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe(specialString);
    });
  });

  describe('Object errors', () => {
    it('should extract message from objects with message property', () => {
      const errorLike = { message: 'Object error', code: 500 };
      const result = toError(errorLike);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('Object error');
    });

    it('should handle objects with non-string message', () => {
      const errorLike = { message: 123 };
      const result = toError(errorLike);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('123');
    });

    it('should handle objects with null message', () => {
      const errorLike = { message: null };
      const result = toError(errorLike);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('null');
    });

    it('should handle objects with undefined message', () => {
      const errorLike = { message: undefined };
      const result = toError(errorLike);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('undefined');
    });

    it('should convert objects without message to string', () => {
      const errorLike = { code: 500, status: 'error' };
      const result = toError(errorLike);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('[object Object]');
    });
  });

  describe('Primitive values', () => {
    it('should convert undefined to Error', () => {
      const result = toError(undefined);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('undefined');
    });

    it('should convert null to Error', () => {
      const result = toError(null);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('null');
    });

    it('should convert numbers to Error', () => {
      const result = toError(404);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('404');
    });

    it('should convert booleans to Error', () => {
      const result = toError(false);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('false');
    });

    it('should convert symbols to Error', () => {
      const symbol = Symbol('test');
      const result = toError(symbol);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain('Symbol(test)');
    });
  });

  describe('Edge cases', () => {
    it('should handle arrays', () => {
      const result = toError([1, 2, 3]);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('1,2,3');
    });

    it('should handle functions', () => {
      const func = () => 'test';
      const result = toError(func);

      expect(result).toBeInstanceOf(Error);
      // Function toString() in modern JS returns arrow function syntax
      expect(result.message).toContain('=>');
    });

    it('should handle Date objects', () => {
      const date = new Date('2025-01-01');
      const result = toError(date);

      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain('2025');
    });

    it('should handle circular references', () => {
      const circular: Record<string, unknown> = { name: 'circular' };
      circular.self = circular;

      expect(() => toError(circular)).not.toThrow();
      const result = toError(circular);
      expect(result).toBeInstanceOf(Error);
    });
  });
});

describe('getErrorMessage', () => {
  describe('Error objects', () => {
    it('should extract message from Error objects', () => {
      const error = new Error('Test error message');
      const result = getErrorMessage(error);

      expect(result).toBe('Test error message');
    });

    it('should extract message from Error subclasses', () => {
      const typeError = new TypeError('Type error message');
      const result = getErrorMessage(typeError);

      expect(result).toBe('Type error message');
    });

    it('should handle Error objects with empty message', () => {
      const error = new Error('');
      const result = getErrorMessage(error);

      expect(result).toBe('');
    });

    it('should extract message even if Error has additional properties', () => {
      const error = new Error('Custom error');
      (error as Error & { code?: string; statusCode?: number }).code = 'ERR_CUSTOM';
      (error as Error & { code?: string; statusCode?: number }).statusCode = 500;

      const result = getErrorMessage(error);
      expect(result).toBe('Custom error');
    });
  });

  describe('String errors', () => {
    it('should return string errors as-is', () => {
      const result = getErrorMessage('String error message');

      expect(result).toBe('String error message');
    });

    it('should handle empty strings', () => {
      const result = getErrorMessage('');

      expect(result).toBe('');
    });

    it('should handle strings with special characters', () => {
      const message = 'Error: <script>alert("xss")</script> 🚨';
      const result = getErrorMessage(message);

      expect(result).toBe(message);
    });

    it('should handle multiline strings', () => {
      const message = 'Line 1\nLine 2\nLine 3';
      const result = getErrorMessage(message);

      expect(result).toBe(message);
    });
  });

  describe('Object errors', () => {
    it('should extract message from error-like objects', () => {
      const errorLike = { message: 'Object error message' };
      const result = getErrorMessage(errorLike);

      expect(result).toBe('Object error message');
    });

    it('should handle objects with non-string message', () => {
      const errorLike = { message: 404 };
      const result = getErrorMessage(errorLike);

      expect(result).toBe('404');
    });

    it('should handle objects without message property', () => {
      const obj = { code: 500, status: 'error' };
      const result = getErrorMessage(obj);

      expect(result).toBe('[object Object]');
    });
  });

  describe('Primitive values', () => {
    it('should convert undefined to message string', () => {
      const result = getErrorMessage(undefined);

      expect(result).toBe('undefined');
    });

    it('should convert null to message string', () => {
      const result = getErrorMessage(null);

      expect(result).toBe('null');
    });

    it('should convert numbers to message string', () => {
      const result = getErrorMessage(404);

      expect(result).toBe('404');
    });

    it('should convert booleans to message string', () => {
      const result = getErrorMessage(true);

      expect(result).toBe('true');
    });

    it('should convert zero to message string', () => {
      const result = getErrorMessage(0);

      expect(result).toBe('0');
    });
  });

  describe('Comparison with manual instanceof checks', () => {
    it('should be equivalent to manual instanceof pattern', () => {
      const testCases: unknown[] = [
        new Error('Error object'),
        'String error',
        { message: 'Object error' },
        undefined,
        null,
        404,
      ];

      testCases.forEach((testCase) => {
        // Our helper
        const helperResult = getErrorMessage(testCase);

        // Expected result depends on whether it's an Error object
        // For Error objects: both manual and toError return the same message
        // For non-Error: our helper uses toError which wraps it properly
        const expectedResult = testCase instanceof Error
          ? testCase.message
          : toError(testCase).message;

        expect(helperResult).toBe(expectedResult);
      });
    });

    it('should simplify error message extraction code', () => {
      // This test demonstrates the simplification

      // Old pattern (verbose, requires type checking)
      const error: unknown = new Error('Test');
      const oldPattern = error instanceof Error ? error.message : 'Unknown error';

      // New pattern (clean, no type checking needed)
      const newPattern = getErrorMessage(error);

      expect(newPattern).toBe(oldPattern);
    });

    it('should handle catch blocks cleanly', () => {
      const thrownError = new Error('Test error');

      // Old pattern
      const oldMessage = thrownError instanceof Error ? thrownError.message : 'Unknown error';

      // New pattern
      const newMessage = getErrorMessage(thrownError);

      expect(newMessage).toBe(oldMessage);
      expect(newMessage).toBe('Test error');
    });
  });

  describe('Real-world usage patterns', () => {
    it('should work in sendResponse error handling', () => {
      const errors: unknown[] = [
        new Error('Network error'),
        'Timeout',
        { message: 'Custom error', code: 500 },
        undefined,
      ];

      errors.forEach((error) => {
        const response = {
          success: false,
          error: getErrorMessage(error),
        };

        expect(response.success).toBe(false);
        expect(typeof response.error).toBe('string');
        expect(response.error.length).toBeGreaterThan(0);
      });
    });

    it('should provide consistent error messages for logging', () => {
      const error: unknown = new TypeError('Type mismatch');

      // Both should work identically
      const message1 = getErrorMessage(error);
      const error2 = toError(error);
      const message2 = error2.message;

      expect(message1).toBe(message2);
      expect(message1).toBe('Type mismatch');
    });

    it('should handle async error chains', () => {
      const originalError = new Error('Original error');
      const wrappedError = {
        message: 'Wrapped error',
        cause: originalError,
      };

      const message = getErrorMessage(wrappedError);
      expect(message).toBe('Wrapped error');
    });
  });

  describe('Type safety', () => {
    it('should accept any unknown value', () => {
      // These should all compile and not throw
      expect(() => getErrorMessage(new Error('test'))).not.toThrow();
      expect(() => getErrorMessage('string')).not.toThrow();
      expect(() => getErrorMessage({})).not.toThrow();
      expect(() => getErrorMessage(123)).not.toThrow();
      expect(() => getErrorMessage(null)).not.toThrow();
      expect(() => getErrorMessage(undefined)).not.toThrow();
    });

    it('should always return a string', () => {
      const values: unknown[] = [
        new Error('test'),
        'string',
        {},
        123,
        null,
        undefined,
        true,
        [],
      ];

      values.forEach((value) => {
        const result = getErrorMessage(value);
        expect(typeof result).toBe('string');
      });
    });
  });
});

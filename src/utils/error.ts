/**
 * Safely coerces an unknown error to an Error object
 * @param error - The error to coerce
 * @returns A proper Error object
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message));
  }

  return new Error(String(error));
}

/**
 * Safely extracts an error message from an unknown error value
 *
 * This is a convenience function that combines toError() with message extraction,
 * eliminating the need for manual instanceof checks and type guards.
 *
 * @param error - The error value to extract a message from
 * @returns The error message as a string
 *
 * @example
 * // Instead of manual checks:
 * const message = error instanceof Error ? error.message : 'Unknown error';
 *
 * // Use this helper:
 * const message = getErrorMessage(error);
 *
 * @example
 * // Works with any error type:
 * getErrorMessage(new Error('Test'));              // "Test"
 * getErrorMessage('String error');                 // "String error"
 * getErrorMessage({ message: 'Object error' });   // "Object error"
 * getErrorMessage(undefined);                      // "undefined"
 */
export function getErrorMessage(error: unknown): string {
  return toError(error).message;
}

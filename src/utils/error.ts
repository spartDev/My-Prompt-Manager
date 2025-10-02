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

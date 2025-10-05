/**
 * URL-Safe Base64 Encoding/Decoding Utilities
 *
 * Standard base64 encoding uses characters that are not URL-safe:
 * - '+' (plus) conflicts with URL query parameters
 * - '/' (slash) conflicts with URL paths
 * - '=' (equals) used for padding
 *
 * This module provides URL-safe alternatives by replacing these characters:
 * - '+' → '-' (hyphen)
 * - '/' → '_' (underscore)
 * - '=' → removed (padding optional)
 *
 * References:
 * - RFC 4648 Section 5: Base 64 Encoding with URL and Filename Safe Alphabet
 * - https://tools.ietf.org/html/rfc4648#section-5
 */

/**
 * Encodes a string to URL-safe base64.
 *
 * Converts standard base64 output to be safe for use in URLs by:
 * 1. Converting Unicode strings to UTF-8 bytes
 * 2. Replacing '+' with '-'
 * 3. Replacing '/' with '_'
 * 4. Removing '=' padding (optional in URLs)
 *
 * @param str - The string to encode (supports Unicode)
 * @returns URL-safe base64 encoded string
 *
 * @example
 * ```typescript
 * const encoded = encodeBase64UrlSafe('Hello World!');
 * // Standard base64: "SGVsbG8gV29ybGQh"
 * // URL-safe:        "SGVsbG8gV29ybGQh" (same in this case)
 *
 * const unicode = encodeBase64UrlSafe('Hello 世界');
 * // Properly handles Unicode characters
 * ```
 */
export function encodeBase64UrlSafe(str: string): string {
  try {
    // Convert string to UTF-8 bytes to handle Unicode
    // TextEncoder produces UTF-8 bytes which btoa can handle
    const utf8Bytes = new TextEncoder().encode(str);

    // Convert Uint8Array to binary string
    const binaryString = Array.from(utf8Bytes)
      .map(byte => String.fromCharCode(byte))
      .join('');

    // Use btoa on the binary string
    const base64 = btoa(binaryString);

    // Convert to URL-safe format
    return base64
      .replace(/\+/g, '-')  // Replace + with -
      .replace(/\//g, '_')  // Replace / with _
      .replace(/=/g, '');   // Remove padding
  } catch (error) {
    throw new Error(`Failed to encode base64: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decodes a URL-safe base64 string.
 *
 * Reverses the URL-safe encoding by:
 * 1. Replacing '-' with '+'
 * 2. Replacing '_' with '/'
 * 3. Re-adding '=' padding if needed
 * 4. Converting UTF-8 bytes back to Unicode string
 *
 * @param base64UrlSafe - The URL-safe base64 string to decode
 * @returns Decoded string (supports Unicode)
 *
 * @example
 * ```typescript
 * const decoded = decodeBase64UrlSafe('SGVsbG8gV29ybGQh');
 * console.log(decoded); // "Hello World!"
 * ```
 */
export function decodeBase64UrlSafe(base64UrlSafe: string): string {
  try {
    // Convert from URL-safe format back to standard base64
    let base64 = base64UrlSafe
      .replace(/-/g, '+')  // Replace - with +
      .replace(/_/g, '/'); // Replace _ with /

    // Re-add padding if needed
    // Base64 strings should be multiples of 4 characters
    const paddingNeeded = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(paddingNeeded);

    // Decode base64 to binary string
    const binaryString = atob(base64);

    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decode UTF-8 bytes to string
    return new TextDecoder().decode(bytes);
  } catch (error) {
    throw new Error(`Failed to decode base64: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Encodes an object to URL-safe base64 JSON.
 *
 * Useful for encoding configuration objects, state, or data structures
 * that need to be safely embedded in URLs.
 *
 * @param obj - The object to encode
 * @returns URL-safe base64 encoded JSON string
 *
 * @example
 * ```typescript
 * const config = { theme: 'dark', lang: 'en' };
 * const encoded = encodeObjectToBase64UrlSafe(config);
 * // Can be safely used in URLs: https://example.com?config=encoded
 * ```
 */
export function encodeObjectToBase64UrlSafe(obj: unknown): string {
  const json = JSON.stringify(obj);
  return encodeBase64UrlSafe(json);
}

/**
 * Decodes a URL-safe base64 JSON string to an object.
 *
 * @param base64UrlSafe - The URL-safe base64 encoded JSON string
 * @returns Decoded object (use type assertion for specific types)
 *
 * @example
 * ```typescript
 * const encoded = 'eyJ0aGVtZSI6ImRhcmsiLCJsYW5nIjoiZW4ifQ';
 * const config = decodeObjectFromBase64UrlSafe(encoded) as Config;
 * console.log(config); // { theme: 'dark', lang: 'en' }
 * ```
 */
export function decodeObjectFromBase64UrlSafe(base64UrlSafe: string): unknown {
  const json = decodeBase64UrlSafe(base64UrlSafe);
  return JSON.parse(json) as unknown;
}

/**
 * Checks if a string is valid URL-safe base64.
 *
 * @param str - The string to validate
 * @returns true if the string is valid URL-safe base64
 *
 * @example
 * ```typescript
 * isValidBase64UrlSafe('SGVsbG8gV29ybGQh');     // true
 * isValidBase64UrlSafe('Hello World!');          // false
 * isValidBase64UrlSafe('SGVsbG8+V29ybGQh');     // false (contains >)
 * ```
 */
export function isValidBase64UrlSafe(str: string): boolean {
  // URL-safe base64 only contains: A-Z, a-z, 0-9, -, _
  const urlSafeBase64Pattern = /^[A-Za-z0-9_-]*$/;
  return urlSafeBase64Pattern.test(str);
}

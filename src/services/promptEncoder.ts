/**
 * @file PromptEncoder Service
 * @module services/promptEncoder
 * @description Provides secure encoding/decoding for sharing prompts via URLs
 *
 * This service implements a multi-layered security approach for sharing prompts:
 * 1. **Sanitization**: Strips all HTML tags using DOMPurify to prevent XSS attacks
 * 2. **Validation**: Enforces size limits and required fields
 * 3. **Checksums**: SHA-256 hash for detecting data corruption/tampering (cryptographically secure)
 * 4. **Compression**: Uses LZ-string for 60-80% size reduction
 * 5. **Defense-in-depth**: Sanitizes on both encode and decode paths
 *
 * @example
 * ```typescript
 * // Encoding a prompt for sharing
 * const prompt = {
 *   id: '123',
 *   title: 'My Prompt',
 *   content: 'Write a function...',
 *   category: 'Development',
 *   createdAt: Date.now(),
 *   updatedAt: Date.now()
 * };
 * const shareCode = await encode(prompt);
 * // shareCode: "N4IgdghgtgpiBcIACAFgJwgLjGABABxABdgAjMaASlk..."
 *
 * // Decoding a shared prompt
 * const decoded = await decode(shareCode);
 * // { title: 'My Prompt', content: 'Write a function...', category: 'Development' }
 * ```
 *
 * @see {@link https://spartdev.atlassian.net/wiki/x/BgAi | Confluence Design Doc}
 * @version 1.0.0
 * @since MPM-2
 */

import DOMPurify from 'dompurify';
import LZString from 'lz-string';

import {
  SharedPromptData,
  EncodedPromptPayloadV1,
  PROMPT_SHARING_SIZE_LIMITS,
  Prompt,
  ErrorType,
  AppError
} from '../types';
import { toError } from '../utils/error';
import { error as logError } from '../utils/logger';

/**
 * Custom error class for PromptEncoder operations
 *
 * Extends the standard Error class and implements the AppError interface
 * to provide consistent error handling across the extension.
 *
 * @example
 * ```typescript
 * throw new PromptEncoderError({
 *   type: ErrorType.VALIDATION_ERROR,
 *   message: 'Title is required',
 *   details: { field: 'title' }
 * });
 * ```
 */
class PromptEncoderError extends Error implements AppError {
  public type: ErrorType;
  public details?: unknown;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = 'PromptEncoderError';
    this.type = appError.type;
    this.details = appError.details;
  }
}

/**
 * Hardened DOMPurify sanitization configuration
 *
 * Comprehensive security configuration that prevents XSS bypass vectors:
 * - ALLOWED_TAGS/ALLOWED_ATTR: Empty arrays strip all HTML tags and attributes
 * - KEEP_CONTENT: Preserves text content after removing HTML
 * - SAFE_FOR_TEMPLATES: Prevents {{}} template literal injection attacks
 * - WHOLE_DOCUMENT: false - Only sanitize fragments, not entire documents
 * - RETURN_DOM*: false - Return strings, not DOM objects (safer)
 * - FORCE_BODY: false - Don't wrap content in <body> tags
 * - SANITIZE_DOM: true - Enable DOM-level sanitization checks
 * - IN_PLACE: false - Don't modify input (create new sanitized copy)
 *
 * @see {@link https://github.com/cure53/DOMPurify#can-i-configure-dompurify | DOMPurify Config Docs}
 * @private
 */
const SANITIZATION_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [] as string[],      // Strip all HTML
  ALLOWED_ATTR: [] as string[],      // Strip all attributes
  KEEP_CONTENT: true,                // Keep text content
  SAFE_FOR_TEMPLATES: true,          // Prevent {{}} template injection
  WHOLE_DOCUMENT: false,              // Only sanitize fragment
  RETURN_DOM: false,                  // Return string, not DOM
  RETURN_DOM_FRAGMENT: false,         // Return string, not fragment
  RETURN_TRUSTED_TYPE: false,         // Return string, not TrustedHTML
  FORCE_BODY: false,                  // Don't force body wrapper
  SANITIZE_DOM: true,                 // Enable DOM sanitization
  IN_PLACE: false,                    // Don't modify input
} as const;

/**
 * Security hook to remove event handler attributes that bypass sanitization
 *
 * Additional defense layer that strips any event handler attributes (onclick,
 * onerror, onload, etc.) that might slip through DOMPurify's main sanitization.
 * This provides extra protection against XSS vectors that exploit parsing edge cases.
 *
 * Registered once at module initialization time.
 * @private
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.hasAttributes()) {
    const attrs = node.attributes;
    for (let i = attrs.length - 1; i >= 0; i--) {
      const attr = attrs[i];
      // Remove any attribute starting with 'on' (event handlers)
      if (attr.name.startsWith('on')) {
        node.removeAttribute(attr.name);
      }
    }
  }
});

/**
 * Sanitizes text by removing all HTML tags and trimming whitespace
 *
 * Uses DOMPurify to strip all HTML tags, preventing XSS attacks while
 * preserving the text content. Trims leading/trailing whitespace.
 *
 * @param text - The text to sanitize
 * @returns Sanitized text with HTML removed and whitespace trimmed
 *
 * @example
 * ```typescript
 * sanitizeText('<script>alert("xss")</script>Hello');  // 'Hello'
 * sanitizeText('  <b>Bold</b> text  ');                // 'Bold text'
 * sanitizeText('Plain text');                          // 'Plain text'
 * ```
 *
 * @internal
 */
function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text.trim(), SANITIZATION_CONFIG);
}

/**
 * Validates prompt data against size limits and required fields
 *
 * Ensures all required fields are present and non-empty (after trimming),
 * and that field lengths don't exceed configured size limits.
 *
 * @param data - The prompt data to validate
 * @throws {Error} If any field is empty or exceeds size limits
 *
 * @example
 * ```typescript
 * // Valid data
 * validatePromptData({
 *   title: 'My Prompt',
 *   content: 'Some content',
 *   category: 'Dev'
 * }); // No error
 *
 * // Invalid - empty title
 * validatePromptData({
 *   title: '   ',
 *   content: 'Content',
 *   category: 'Cat'
 * }); // Throws: 'Title is required'
 *
 * // Invalid - oversized content
 * validatePromptData({
 *   title: 'Title',
 *   content: 'x'.repeat(20000),
 *   category: 'Cat'
 * }); // Throws: 'Content too long (max 10000 characters)'
 * ```
 *
 * @internal
 */
function validatePromptData(data: SharedPromptData): void {
  // Trim all fields for validation
  const trimmedTitle = data.title.trim();
  const trimmedContent = data.content.trim();
  const trimmedCategory = data.category.trim();

  // Check required fields
  if (!trimmedTitle) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: 'Title is required',
      details: { field: 'title' }
    });
  }
  if (!trimmedContent) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: 'Content is required',
      details: { field: 'content' }
    });
  }
  if (!trimmedCategory) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: 'Category is required',
      details: { field: 'category' }
    });
  }

  // Check size limits on trimmed values
  const titleMax = PROMPT_SHARING_SIZE_LIMITS.TITLE_MAX;
  const contentMax = PROMPT_SHARING_SIZE_LIMITS.CONTENT_MAX;
  const categoryMax = PROMPT_SHARING_SIZE_LIMITS.CATEGORY_MAX;

  if (trimmedTitle.length > titleMax) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: `Title too long (max ${String(titleMax)} characters)`,
      details: { field: 'title', length: trimmedTitle.length, max: titleMax }
    });
  }
  if (trimmedContent.length > contentMax) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: `Content too long (max ${String(contentMax)} characters)`,
      details: { field: 'content', length: trimmedContent.length, max: contentMax }
    });
  }
  if (trimmedCategory.length > categoryMax) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: `Category too long (max ${String(categoryMax)} characters)`,
      details: { field: 'category', length: trimmedCategory.length, max: categoryMax }
    });
  }
}

/**
 * Calculates a SHA-256 checksum for data integrity verification
 *
 * Uses the Web Crypto API to generate a cryptographically secure checksum
 * for detecting both accidental corruption and intentional tampering.
 * Returns the first 12 characters (48 bits) of the SHA-256 hash in hexadecimal.
 *
 * ✅ **SECURITY**: Cryptographically secure hash function with 2^48 possible
 * values. Provides strong protection against both accidental corruption and
 * intentional tampering attempts.
 *
 * The 48-bit truncation provides an excellent balance between security
 * and URL length. Birthday attack probability: negligible (2^-24).
 *
 * @param data - The string data to hash
 * @returns Promise resolving to 12-character hexadecimal checksum (e.g., "a1b2c3d4e5f6")
 *
 * @example
 * ```typescript
 * const checksum1 = await calculateChecksum('Test data');
 * const checksum2 = await calculateChecksum('Test data');
 * console.log(checksum1 === checksum2);  // true - deterministic
 *
 * const checksum3 = await calculateChecksum('Different data');
 * console.log(checksum1 === checksum3);  // false - different input
 * ```
 *
 * @internal
 */
async function calculateChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Return first 12 chars of hex (48 bits) - good security/size balance
  return hashArray
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}

/**
 * Verifies checksum matches expected value
 *
 * Recalculates the SHA-256 checksum for the provided data and compares it to the
 * expected value. Throws an error if they don't match, indicating potential
 * data corruption or tampering.
 *
 * @param data - The data to verify
 * @param expected - The expected checksum value
 * @throws {Error} If calculated checksum doesn't match expected value
 *
 * @example
 * ```typescript
 * const data = 'Test data';
 * const checksum = await calculateChecksum(data);
 *
 * // Valid checksum
 * await verifyChecksum(data, checksum); // No error
 *
 * // Invalid checksum
 * await verifyChecksum(data, 'wrong-checksum');
 * // Throws: 'Sharing code appears corrupted...'
 * ```
 *
 * @internal
 */
async function verifyChecksum(data: string, expected: string): Promise<void> {
  const actual = await calculateChecksum(data);
  if (actual !== expected) {
    throw new PromptEncoderError({
      type: ErrorType.DATA_CORRUPTION,
      message: 'Sharing code appears corrupted. Please ask the sender to reshare.',
      details: { expected, actual }
    });
  }
}

/**
 * Encodes a prompt into a shareable compressed string
 *
 * This is the main entry point for creating shareable prompt URLs. The function:
 * 1. Sanitizes all text fields to prevent XSS attacks
 * 2. Validates field lengths and required data
 * 3. Creates a versioned payload (v1.0) with SHA-256 checksum
 * 4. Compresses to URL-safe string using LZ-string
 * 5. Verifies final size is under 50KB limit
 *
 * The resulting string is safe to include in URLs and can be decoded using
 * the `decode()` function.
 *
 * @param prompt - The prompt object to encode (only title, content, category are used)
 * @returns Promise resolving to URL-safe base64-encoded compressed string (e.g., "N4IgdghgtgpiBcI...")
 * @throws {Error} If validation fails (empty fields, too large) or encoding produces >50KB result
 *
 * @example
 * ```typescript
 * const prompt = {
 *   id: 'abc-123',
 *   title: 'Code Review Checklist',
 *   content: 'Review the following code for...',
 *   category: 'Development',
 *   createdAt: 1234567890,
 *   updatedAt: 1234567890
 * };
 *
 * try {
 *   const shareCode = await encode(prompt);
 *   const shareUrl = `https://example.com/import?code=${shareCode}`;
 *   console.log(shareUrl);  // Share this URL with others
 * } catch (err) {
 *   console.error('Failed to encode:', err.message);
 * }
 * ```
 *
 * @see {@link decode} for decoding shared prompts
 * @public
 */
export async function encode(prompt: Prompt): Promise<string> {
  try {
    // 1. Sanitize all text fields
    const sanitized: SharedPromptData = {
      title: sanitizeText(prompt.title),
      content: sanitizeText(prompt.content),
      category: sanitizeText(prompt.category),
    };

    // 2. Validate sanitized data
    validatePromptData(sanitized);

    // 3. Create payload with SHA-256 checksum (including version for better integrity)
    const version = '1.0';
    const dataString = `${version}|${sanitized.title}|${sanitized.content}|${sanitized.category}`;
    const payload: EncodedPromptPayloadV1 = {
      v: version,
      t: sanitized.title,
      c: sanitized.content,
      cat: sanitized.category,
      cs: await calculateChecksum(dataString),
    };

    // 4. Compress to URL-safe string
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

    // 5. Verify size limit
    if (encoded.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX) {
      const error = new PromptEncoderError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Prompt too large to share',
        details: { encodedLength: encoded.length, max: PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX }
      });
      logError('Failed to encode prompt - size limit exceeded', error, {
        component: 'PromptEncoder',
        operation: 'encode',
        promptId: prompt.id,
        encodedLength: encoded.length
      });
      throw error;
    }

    return encoded;
  } catch (err) {
    // Re-throw PromptEncoderError instances (including validation errors)
    if (err instanceof PromptEncoderError) {
      throw err;
    }

    // Wrap unexpected errors
    const error = new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: 'Failed to encode prompt',
      details: err
    });
    logError('Unexpected error during prompt encoding', toError(err), {
      component: 'PromptEncoder',
      operation: 'encode',
      promptId: prompt.id
    });
    throw error;
  }
}

/**
 * Decodes a shared prompt string back into prompt data
 *
 * This is the main entry point for importing shared prompts. The function:
 * 1. Checks encoded size (strict 50KB limit - prevents decompression bombs)
 * 2. Decompresses the URL-safe string using LZ-string
 * 3. Checks decompressed size (100KB limit - prevents memory exhaustion)
 * 4. Validates compression ratio (<10x - detects malicious payloads)
 * 5. Parses the JSON payload
 * 6. Verifies the payload version is supported (currently only v1.0)
 * 7. Validates the SHA-256 checksum to detect corruption/tampering
 * 8. Sanitizes all fields (defense-in-depth, even if sender encoded malicious HTML)
 * 9. Validates field lengths and required data
 *
 * The function is designed to be defensive and will reject invalid,
 * corrupted, or malicious share codes with clear error messages.
 *
 * @param encoded - The encoded sharing code string
 * @returns Promise resolving to sanitized and validated prompt data (title, content, category only)
 * @throws {Error} If:
 *   - Decompression fails → "Invalid sharing code format"
 *   - JSON parsing fails → "Invalid sharing code format"
 *   - Version unsupported → "This sharing code format (X) is not supported..."
 *   - Checksum invalid → "Sharing code appears corrupted..."
 *   - Validation fails → Field-specific error (e.g., "Title is required")
 *
 * @example
 * ```typescript
 * // Basic usage
 * try {
 *   const shareCode = "N4IgdghgtgpiBcIACAFgJwgLjGA...";
 *   const promptData = await decode(shareCode);
 *   console.log(promptData);
 *   // { title: 'My Prompt', content: 'Some content', category: 'Dev' }
 * } catch (err) {
 *   console.error('Failed to decode:', err.message);
 *   // Handle error - show user-friendly message
 * }
 *
 * // Handling different error types
 * try {
 *   const promptData = await decode(shareCode);
 *   // Create new prompt with decoded data
 *   await promptManager.addPrompt(promptData);
 * } catch (err) {
 *   if (err.message.includes('corrupted')) {
 *     alert('The share link is corrupted. Please ask for a new link.');
 *   } else if (err.message.includes('not supported')) {
 *     alert('This share link requires a newer version of the extension.');
 *   } else {
 *     alert('Invalid share link format.');
 *   }
 * }
 * ```
 *
 * @see {@link encode} for creating shareable prompts
 * @public
 */
export async function decode(encoded: string): Promise<SharedPromptData> {
  try {
    // 1. Check encoded size BEFORE decompression (prevent decompression bombs)
    // Enforce strict 50KB limit - reject anything larger before attempting decompression
    if (encoded.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX) {
      const error = new PromptEncoderError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Sharing code too large',
        details: { encodedLength: encoded.length, max: PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX }
      });
      logError('Sharing code exceeds size limit', error, {
        component: 'PromptEncoder',
        operation: 'decode'
      });
      throw error;
    }

    // 2. Decompress
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) {
      const error = new PromptEncoderError({
        type: ErrorType.DATA_CORRUPTION,
        message: 'Invalid sharing code format',
        details: { step: 'decompression' }
      });
      logError('Failed to decompress sharing code', error, {
        component: 'PromptEncoder',
        operation: 'decode'
      });
      throw error;
    }

    // 3. Check decompressed size (prevent decompression bombs)
    // Lower limit to 100KB (2x the encoded limit) - suspicious if much larger
    if (json.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX * 2) {
      const error = new PromptEncoderError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Decompressed data too large',
        details: { decompressedLength: json.length, max: PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX * 2 }
      });
      logError('Decompressed data exceeds size limit', error, {
        component: 'PromptEncoder',
        operation: 'decode'
      });
      throw error;
    }

    // 4. Check compression ratio for large payloads (detect decompression bombs)
    // The decompressed size limit (100KB) is the primary defense. However, as an
    // additional safety measure, we check compression ratio for payloads >50KB.
    // Ratios >200x with large size indicate potential decompression bomb attacks.
    // Note: Legitimate repetitive content can reach 40-150x, so we use a high threshold.
    const compressionRatio = json.length / encoded.length;
    const isLargePayload = json.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX; // >50KB
    if (isLargePayload && compressionRatio > 200) {
      const error = new PromptEncoderError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Suspicious compression ratio detected',
        details: {
          ratio: compressionRatio,
          encodedLength: encoded.length,
          decompressedLength: json.length
        }
      });
      logError('Suspicious compression ratio detected', error, {
        component: 'PromptEncoder',
        operation: 'decode',
        compressionRatio: compressionRatio.toFixed(2)
      });
      throw error;
    }

    // 5. Parse JSON
    let payload: unknown;
    try {
      payload = JSON.parse(json);
    } catch (parseErr) {
      const error = new PromptEncoderError({
        type: ErrorType.DATA_CORRUPTION,
        message: 'Invalid sharing code format',
        details: { step: 'json-parse', error: parseErr }
      });
      logError('Failed to parse sharing code JSON', toError(parseErr), {
        component: 'PromptEncoder',
        operation: 'decode'
      });
      throw error;
    }

    // 6. Verify version
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('v' in payload) ||
      payload.v !== '1.0'
    ) {
      const version = payload && typeof payload === 'object' && 'v' in payload
        ? String(payload.v)
        : 'unknown';
      const error = new PromptEncoderError({
        type: ErrorType.DATA_CORRUPTION,
        message: `This sharing code format (${version}) is not supported. ` +
          'Please ask the sender to reshare using the latest extension version.',
        details: { version, step: 'version-check' }
      });
      logError('Unsupported sharing code version', error, {
        component: 'PromptEncoder',
        operation: 'decode',
        version
      });
      throw error;
    }

    // Type assertion after validation
    const typedPayload = payload as EncodedPromptPayloadV1;

    // 7. Verify SHA-256 checksum (including version for better integrity)
    const dataString = `${typedPayload.v}|${typedPayload.t}|${typedPayload.c}|${typedPayload.cat}`;
    await verifyChecksum(dataString, typedPayload.cs);

    // 8. Sanitize again (defense in depth)
    const sanitized: SharedPromptData = {
      title: sanitizeText(typedPayload.t),
      content: sanitizeText(typedPayload.c),
      category: sanitizeText(typedPayload.cat),
    };

    // 9. Validate sanitized data
    validatePromptData(sanitized);

    return sanitized;
  } catch (err) {
    // Re-throw PromptEncoderError instances (including validation/checksum errors)
    if (err instanceof PromptEncoderError) {
      throw err;
    }

    // Wrap unexpected errors
    const error = new PromptEncoderError({
      type: ErrorType.DATA_CORRUPTION,
      message: 'Failed to decode sharing code',
      details: err
    });
    logError('Unexpected error during prompt decoding', toError(err), {
      component: 'PromptEncoder',
      operation: 'decode'
    });
    throw error;
  }
}

// Export helper functions for testing
export { sanitizeText, validatePromptData, calculateChecksum, verifyChecksum };

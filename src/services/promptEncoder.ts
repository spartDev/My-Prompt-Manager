import DOMPurify from 'dompurify';
import LZString from 'lz-string';

import {
  SharedPromptData,
  EncodedPromptPayloadV1,
  PROMPT_SHARING_SIZE_LIMITS,
  Prompt
} from '../types';

// Sanitization configuration - strip all HTML tags
const SANITIZATION_CONFIG = {
  ALLOWED_TAGS: [] as string[],      // Strip all HTML
  ALLOWED_ATTR: [] as string[],      // Strip all attributes
  KEEP_CONTENT: true,                // Keep text content
};

/**
 * Sanitizes text by removing all HTML tags and trimming whitespace
 */
function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text.trim(), SANITIZATION_CONFIG);
}

/**
 * Validates prompt data against size limits and required fields
 * @throws {Error} If validation fails
 */
function validatePromptData(data: SharedPromptData): void {
  // Check required fields
  if (!data.title.trim()) {
    throw new Error('Title is required');
  }
  if (!data.content.trim()) {
    throw new Error('Content is required');
  }
  if (!data.category.trim()) {
    throw new Error('Category is required');
  }

  // Check size limits
  const titleMax = PROMPT_SHARING_SIZE_LIMITS.TITLE_MAX;
  const contentMax = PROMPT_SHARING_SIZE_LIMITS.CONTENT_MAX;
  const categoryMax = PROMPT_SHARING_SIZE_LIMITS.CATEGORY_MAX;

  if (data.title.length > titleMax) {
    throw new Error(`Title too long (max ${String(titleMax)} characters)`);
  }
  if (data.content.length > contentMax) {
    throw new Error(`Content too long (max ${String(contentMax)} characters)`);
  }
  if (data.category.length > categoryMax) {
    throw new Error(`Category too long (max ${String(categoryMax)} characters)`);
  }
}

/**
 * Calculates a simple checksum for data integrity verification
 * Note: This is NOT cryptographic - only detects accidental corruption
 */
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Verifies checksum matches expected value
 * @throws {Error} If checksum doesn't match
 */
function verifyChecksum(data: string, expected: string): void {
  const actual = calculateChecksum(data);
  if (actual !== expected) {
    throw new Error('Sharing code appears corrupted. Please ask the sender to reshare.');
  }
}

/**
 * Encodes a prompt into a shareable compressed string
 * @param prompt - The prompt to encode
 * @returns URL-safe encoded string
 * @throws {Error} If validation fails or encoding produces oversized result
 */
export function encode(prompt: Prompt): string {
  // 1. Sanitize all text fields
  const sanitized: SharedPromptData = {
    title: sanitizeText(prompt.title),
    content: sanitizeText(prompt.content),
    category: sanitizeText(prompt.category),
  };

  // 2. Validate sanitized data
  validatePromptData(sanitized);

  // 3. Create payload with checksum
  const dataString = `${sanitized.title}|${sanitized.content}|${sanitized.category}`;
  const payload: EncodedPromptPayloadV1 = {
    v: '1.0',
    t: sanitized.title,
    c: sanitized.content,
    cat: sanitized.category,
    cs: calculateChecksum(dataString),
  };

  // 4. Compress to URL-safe string
  const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

  // 5. Verify size limit
  if (encoded.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX) {
    throw new Error('Prompt too large to share');
  }

  return encoded;
}

/**
 * Decodes a shared prompt string back into prompt data
 * @param encoded - The encoded string to decode
 * @returns Sanitized and validated prompt data
 * @throws {Error} If decoding fails, version is unsupported, checksum is invalid, or validation fails
 */
export function decode(encoded: string): SharedPromptData {
  // 1. Decompress
  const json = LZString.decompressFromEncodedURIComponent(encoded);
  if (!json) {
    throw new Error('Invalid sharing code format');
  }

  // 2. Parse JSON
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new Error('Invalid sharing code format');
  }

  // 3. Verify version
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('v' in payload) ||
    payload.v !== '1.0'
  ) {
    const version = payload && typeof payload === 'object' && 'v' in payload
      ? String(payload.v)
      : 'unknown';
    throw new Error(
      `This sharing code format (${version}) is not supported. ` +
      'Please ask the sender to reshare using the latest extension version.'
    );
  }

  // Type assertion after validation
  const typedPayload = payload as EncodedPromptPayloadV1;

  // 4. Verify checksum
  const dataString = `${typedPayload.t}|${typedPayload.c}|${typedPayload.cat}`;
  verifyChecksum(dataString, typedPayload.cs);

  // 5. Sanitize again (defense in depth)
  const sanitized: SharedPromptData = {
    title: sanitizeText(typedPayload.t),
    content: sanitizeText(typedPayload.c),
    category: sanitizeText(typedPayload.cat),
  };

  // 6. Validate sanitized data
  validatePromptData(sanitized);

  return sanitized;
}

// Export helper functions for testing
export { sanitizeText, validatePromptData, calculateChecksum, verifyChecksum };

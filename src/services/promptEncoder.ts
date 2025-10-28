/**
 * @file PromptEncoder Service
 * @module services/promptEncoder
 * @description Secure encoding/decoding for sharing prompts via URLs
 *
 * Security features:
 * - Sanitization: Strips HTML tags using DOMPurify (XSS prevention)
 * - Validation: Enforces size limits and required fields
 * - Compression: LZ-string for 60-80% size reduction
 * - Defense-in-depth: Sanitizes on both encode and decode paths
 */

import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';
import LZString from 'lz-string';

import {
  SharedPromptData,
  PROMPT_SHARING_SIZE_LIMITS,
  Prompt,
  ErrorType,
  AppError
} from '../types';
import { Logger, toError } from '../utils';

/**
 * Custom error class for PromptEncoder operations
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
 * DOMPurify configuration - strips all HTML tags
 */
const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
};

/**
 * Sanitizes text by removing HTML tags and trimming whitespace
 * @internal
 */
function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text.trim(), SANITIZE_CONFIG);
}

/**
 * Validates prompt data against size limits and required fields
 * @internal
 */
function validatePromptData(data: SharedPromptData): void {
  const { title, content, category } = data;

  // Check required fields
  if (!title.trim()) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: 'Title is required',
      details: { field: 'title' }
    });
  }
  if (!content.trim()) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: 'Content is required',
      details: { field: 'content' }
    });
  }
  if (!category.trim()) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: 'Category is required',
      details: { field: 'category' }
    });
  }

  // Check size limits
  if (title.length > PROMPT_SHARING_SIZE_LIMITS.TITLE_MAX) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: `Title too long (max ${String(PROMPT_SHARING_SIZE_LIMITS.TITLE_MAX)} characters)`,
      details: { field: 'title', length: title.length, max: PROMPT_SHARING_SIZE_LIMITS.TITLE_MAX }
    });
  }
  if (content.length > PROMPT_SHARING_SIZE_LIMITS.CONTENT_MAX) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: `Content too long (max ${String(PROMPT_SHARING_SIZE_LIMITS.CONTENT_MAX)} characters)`,
      details: { field: 'content', length: content.length, max: PROMPT_SHARING_SIZE_LIMITS.CONTENT_MAX }
    });
  }
  if (category.length > PROMPT_SHARING_SIZE_LIMITS.CATEGORY_MAX) {
    throw new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: `Category too long (max ${String(PROMPT_SHARING_SIZE_LIMITS.CATEGORY_MAX)} characters)`,
      details: { field: 'category', length: category.length, max: PROMPT_SHARING_SIZE_LIMITS.CATEGORY_MAX }
    });
  }
}

/**
 * Encodes a prompt into a shareable URL-safe string
 *
 * Process:
 * 1. Sanitize fields (remove HTML)
 * 2. Validate size limits
 * 3. Compress to URL-safe string
 *
 * @param prompt - The prompt to encode
 * @returns URL-safe compressed string
 * @throws {PromptEncoderError} If validation fails or result exceeds 20KB
 */
export function encode(prompt: Prompt): string {
  try {
    // 1. Sanitize all text fields
    const sanitized: SharedPromptData = {
      title: sanitizeText(prompt.title),
      content: sanitizeText(prompt.content),
      category: sanitizeText(prompt.category),
    };

    // 2. Validate sanitized data
    validatePromptData(sanitized);

    // 3. Compress to URL-safe string
    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(sanitized));

    // 4. Verify size limit
    if (encoded.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX) {
      const error = new PromptEncoderError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Prompt too large to share',
        details: process.env.NODE_ENV === 'development'
          ? { encodedLength: encoded.length, max: PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX }
          : { type: 'size_limit_exceeded' }
      });
      Logger.error('Failed to encode prompt - size limit exceeded', error, {
        component: 'PromptEncoder',
        operation: 'encode',
        promptId: prompt.id,
        ...(process.env.NODE_ENV === 'development' && { encodedLength: encoded.length })
      });
      throw error;
    }

    return encoded;
  } catch (err) {
    if (err instanceof PromptEncoderError) {
      throw err;
    }

    const error = new PromptEncoderError({
      type: ErrorType.VALIDATION_ERROR,
      message: 'Failed to encode prompt',
      details: err
    });
    Logger.error('Unexpected error during prompt encoding', toError(err), {
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
 * Process:
 * 1. Check encoded size (prevent decompression bombs)
 * 2. Decompress the string
 * 3. Parse JSON
 * 4. Sanitize fields (defense-in-depth)
 * 5. Validate result
 *
 * @param encoded - The encoded sharing code
 * @returns Sanitized and validated prompt data
 * @throws {PromptEncoderError} If decoding fails or data is invalid
 */
export function decode(encoded: string): SharedPromptData {
  try {
    // 1. Check encoded size BEFORE decompression
    if (encoded.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX) {
      const error = new PromptEncoderError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Sharing code too large',
        details: process.env.NODE_ENV === 'development'
          ? { encodedLength: encoded.length, max: PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX }
          : { type: 'size_limit_exceeded' }
      });
      Logger.error('Sharing code exceeds size limit', error, {
        component: 'PromptEncoder',
        operation: 'decode'
      });
      throw error;
    }

    // 2. Decompress (LZ-string returns null if corrupted)
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) {
      const error = new PromptEncoderError({
        type: ErrorType.DATA_CORRUPTION,
        message: 'Invalid sharing code format',
        details: { step: 'decompression' }
      });
      Logger.error('Failed to decompress sharing code', error, {
        component: 'PromptEncoder',
        operation: 'decode'
      });
      throw error;
    }

    // 3. Check decompressed size (prevent decompression bombs)
    if (json.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX * 2) {
      const error = new PromptEncoderError({
        type: ErrorType.VALIDATION_ERROR,
        message: 'Decompressed data too large',
        details: process.env.NODE_ENV === 'development'
          ? { decompressedLength: json.length, max: PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX * 2 }
          : { type: 'decompression_bomb_detected' }
      });
      Logger.error('Decompressed data exceeds size limit', error, {
        component: 'PromptEncoder',
        operation: 'decode'
      });
      throw error;
    }

    // 4. Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch (parseErr) {
      const error = new PromptEncoderError({
        type: ErrorType.DATA_CORRUPTION,
        message: 'Invalid sharing code format',
        details: { step: 'json-parse', error: parseErr }
      });
      Logger.error('Failed to parse sharing code JSON', toError(parseErr), {
        component: 'PromptEncoder',
        operation: 'decode'
      });
      throw error;
    }

    // 5. Validate structure
    if (!data || typeof data !== 'object' || !('title' in data) || !('content' in data) || !('category' in data)) {
      throw new PromptEncoderError({
        type: ErrorType.DATA_CORRUPTION,
        message: 'Invalid sharing code format',
        details: { step: 'structure-validation' }
      });
    }

    // 6. Sanitize (defense-in-depth)
    const sanitized: SharedPromptData = {
      title: sanitizeText(String(data.title)),
      content: sanitizeText(String(data.content)),
      category: sanitizeText(String(data.category)),
    };

    // 7. Validate sanitized data
    validatePromptData(sanitized);

    return sanitized;
  } catch (err) {
    if (err instanceof PromptEncoderError) {
      throw err;
    }

    const error = new PromptEncoderError({
      type: ErrorType.DATA_CORRUPTION,
      message: 'Failed to decode sharing code',
      details: err
    });
    Logger.error('Unexpected error during prompt decoding', toError(err), {
      component: 'PromptEncoder',
      operation: 'decode'
    });
    throw error;
  }
}

// Export helper functions for testing
export { sanitizeText, validatePromptData };

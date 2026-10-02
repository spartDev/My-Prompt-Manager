/**
 * @file PromptEncoder Service
 * @module services/promptEncoder
 * @description Encoding/decoding of Share codes (a single Prompt as compact text)
 *
 * Prompts are Verbatim (see CONTEXT.md and ADR-001): a Share code carries title, content
 * and category exactly as given, and decoding only parses. Nothing here sanitizes, trims
 * or judges the text; Hidden characters, trimming and the size and emptiness rules are
 * applied once, at Admission, when the decoded Prompt is saved (and the form may ask
 * `admit()` beforehand for early feedback).
 *
 * Protections kept against hostile codes:
 * - Maximum encoded length, checked before anything is decompressed
 * - Maximum decompressed length (decompression bombs)
 * - JSON parsing and shape validation (three strings)
 * - Compression: LZ-string for 60-80% size reduction
 */

import LZString from 'lz-string';

import {
  type SharedPromptData,
  PROMPT_SHARING_SIZE_LIMITS,
  type Prompt,
  type ErrorType,
  type AppError
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
 * Checks the shape of a parsed sharing code: three strings, nothing about their content
 * @internal
 */
function isSharedPromptData(value: unknown): value is SharedPromptData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { title, content, category } = value as Record<string, unknown>;
  return typeof title === 'string' && typeof content === 'string' && typeof category === 'string';
}

/**
 * Encodes a prompt into a shareable URL-safe string
 *
 * Title, content and category are encoded exactly as given (Verbatim): nothing is
 * stripped, trimmed or validated. Then the result is compressed and checked against the
 * maximum encoded length.
 *
 * @param prompt - The prompt to encode
 * @returns URL-safe compressed string
 * @throws {PromptEncoderError} If the encoded result is too large to share
 */
export function encode(prompt: Prompt): string {
  try {
    const shared: SharedPromptData = {
      title: prompt.title,
      content: prompt.content,
      category: prompt.category,
    };

    const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(shared));

    if (encoded.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX) {
      const error = new PromptEncoderError({
        type: 'VALIDATION_ERROR',
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
      type: 'VALIDATION_ERROR',
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
 * 3. Check decompressed size
 * 4. Parse JSON
 * 5. Check the shape (title, content and category are strings)
 *
 * The fields are returned exactly as encoded. Whether they are empty or too long, and
 * which Hidden characters they contain, is decided by Admission when the Prompt is saved.
 *
 * @param encoded - The encoded sharing code
 * @returns The prompt data, as encoded
 * @throws {PromptEncoderError} If the code is too large, cannot be decoded or has the wrong shape
 */
export function decode(encoded: string): SharedPromptData {
  try {
    // 1. Check encoded size BEFORE decompression
    if (encoded.length > PROMPT_SHARING_SIZE_LIMITS.ENCODED_MAX) {
      const error = new PromptEncoderError({
        type: 'VALIDATION_ERROR',
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
        type: 'DATA_CORRUPTION',
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
        type: 'VALIDATION_ERROR',
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
        type: 'DATA_CORRUPTION',
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
    if (!isSharedPromptData(data)) {
      throw new PromptEncoderError({
        type: 'DATA_CORRUPTION',
        message: 'Invalid sharing code format',
        details: { step: 'structure-validation' }
      });
    }

    return { title: data.title, content: data.content, category: data.category };
  } catch (err) {
    if (err instanceof PromptEncoderError) {
      throw err;
    }

    const error = new PromptEncoderError({
      type: 'DATA_CORRUPTION',
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

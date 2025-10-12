import DOMPurify from 'dompurify';

import { SharedPromptData, PROMPT_SHARING_SIZE_LIMITS } from '../types';

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

// Export helper functions for testing
export { sanitizeText, validatePromptData, calculateChecksum, verifyChecksum };

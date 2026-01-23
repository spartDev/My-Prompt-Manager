/**
 * Runtime constants - centralized configuration values
 *
 * This file exports runtime constants that were previously mixed with type definitions.
 * Import from '@/constants' or '../constants' for these values.
 */

import type { Settings } from '../types';

// Re-export from organized constant files
export * from './colors';
export * from './validation';
export * from './ui';
export * from './brandColors';

// ============================================================================
// Usage Analytics Constants
// ============================================================================

/** Number of days to retain usage history data */
export const USAGE_RETENTION_DAYS = 30;

/** Storage key for usage history in chrome.storage */
export const USAGE_STORAGE_KEY = 'usageHistory';

// ============================================================================
// Validation Limits
// ============================================================================

/** Validation limits for prompts, categories, and other entities */
export const VALIDATION_LIMITS = {
  PROMPT_TITLE_MAX: 100,
  PROMPT_CONTENT_MAX: 20000,
  CATEGORY_NAME_MAX: 50,
  TITLE_GENERATION_LENGTH: 50
} as const;

// ============================================================================
// Default Values
// ============================================================================

/** Default category name for uncategorized prompts */
export const DEFAULT_CATEGORY = 'Uncategorized';

/** Default application settings */
export const DEFAULT_SETTINGS: Settings = {
  defaultCategory: DEFAULT_CATEGORY,
  sortOrder: 'updatedAt',
  sortDirection: 'desc',
  theme: 'system',
  interfaceMode: 'sidepanel'
};

// ============================================================================
// Prompt Sharing Constants
// ============================================================================

/** Size limits for prompt sharing/encoding */
export const PROMPT_SHARING_SIZE_LIMITS = {
  TITLE_MAX: 100,
  CONTENT_MAX: 20_000,
  CATEGORY_MAX: 50,
  ENCODED_MAX: 40_000,
} as const;

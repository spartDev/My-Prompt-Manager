/**
 * Runtime constants - centralized configuration values
 *
 * This file exports runtime constants that were previously mixed with type definitions.
 * Import from '@/constants' or '../constants' for these values.
 */

import type { Settings, SortDirection, SortOrder } from '../types';

export * from './brandColors';
// Re-export from organized constant files
export * from './colors';
export * from './ui';
export * from './validation';

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

/** Length of a title generated from content; the Prompt text limits are PROMPT_LIMITS (src/services/promptAdmission.ts) */
export const VALIDATION_LIMITS = {
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

/**
 * The only direction the Library sorts each order in. Settings offers no direction,
 * so a reversed direction saved by earlier versions is ignored.
 */
export const NATURAL_SORT_DIRECTION: Record<SortOrder, SortDirection> = {
  updatedAt: 'desc',
  lastUsedAt: 'desc',
  createdAt: 'desc',
  usageCount: 'desc',
  title: 'asc'
};

// ============================================================================
// Prompt Sharing Constants
// ============================================================================

/** Size limit for an encoded Share code */
export const PROMPT_SHARING_SIZE_LIMITS = {
  ENCODED_MAX: 40_000,
} as const;

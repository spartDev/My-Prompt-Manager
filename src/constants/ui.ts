/**
 * UI Constants
 * Centralized configuration for UI components
 */

/**
 * Dropdown configuration
 */
export const DROPDOWN_CONFIG = {
  /** Maximum height for filter dropdown (in pixels) */
  FILTER_MAX_HEIGHT: 250,

  /** Maximum height for sort dropdown (in pixels) */
  SORT_MAX_HEIGHT: 400,

  /** Z-index for portal-rendered dropdowns */
  PORTAL_Z_INDEX: 1001,

  /** Offset from trigger element (in pixels) */
  OFFSET: 4,
} as const;

/**
 * Default UI colors
 */
export const DEFAULT_COLORS = {
  /** Default category badge color (purple-500) */
  CATEGORY_BADGE: '#a855f7',
} as const;

/**
 * UI Constants
 * Centralized configuration for UI components
 */

/**
 * Z-Index scale for proper stacking contexts
 * Based on industry best practices and inspired by Tailwind CSS scale
 */
export const Z_INDEX = {
  /** Base level content */
  BASE: 0,
  /** Dropdown menus, select options */
  DROPDOWN: 1000,
  /** Sticky elements (headers, toolbars) */
  STICKY: 1020,
  /** Fixed position elements */
  FIXED: 1030,
  /** Modal backdrop/overlay */
  MODAL_BACKDROP: 1040,
  /** Modal content */
  MODAL: 1050,
  /** Popover content (higher than modals) */
  POPOVER: 1060,
  /** Tooltips (highest priority) */
  TOOLTIP: 1070,
  /** Notifications/toasts */
  NOTIFICATION: 1080,
} as const;

/**
 * Dropdown configuration
 */
export const DROPDOWN_CONFIG = {
  /** Maximum height for filter dropdown (in pixels) */
  FILTER_MAX_HEIGHT: 250,

  /** Maximum height for sort dropdown (in pixels) */
  SORT_MAX_HEIGHT: 400,

  /** Z-index for portal-rendered dropdowns */
  PORTAL_Z_INDEX: Z_INDEX.DROPDOWN,

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

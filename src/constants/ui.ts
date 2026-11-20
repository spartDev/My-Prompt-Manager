/**
 * UI Constants
 * Centralized configuration for UI components
 */

/**
 * How long Try again on Error Loading Data waits for the Library's reads before it can be pressed
 * again (My-Prompt-Manager-p4y9). A chrome.storage read of a 4 MB Library (2,000 Prompts) took about
 * 33 ms when measured, so no read that settles is cut short; a read still pending after 10 s is taken
 * as stuck, and 10 s is about as long as a person keeps their attention on a wait (Nielsen's limit).
 * Only the reads count: drawing a large Library after them does not. The reads go on past it, and
 * their outcome applies if they settle
 */
export const RETRY_READ_BOUND_MS = 10_000;

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

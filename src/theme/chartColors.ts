/**
 * Centralized chart color definitions
 * Neutrals and the primary color read the color tokens of src/theme/tokens.css as CSS variables:
 * Chrome resolves var() in SVG presentation attributes, so the charts follow the .dark class by themselves.
 * The categorical palettes below stay data, the same in both modes.
 */

/**
 * Neutral chart colors: grid, axes, legend, tooltip and hover band
 */
export const CHART_THEME = {
  /** Grid lines and axis line */
  gridColor: 'var(--border-color-default)',
  /** Axis tick labels */
  textColor: 'var(--text-color-tertiary)',
  /** Legend labels */
  legendColor: 'var(--text-color-secondary)',
  /** Tooltip background */
  tooltipBg: 'var(--background-color-card)',
  /** Tooltip border */
  tooltipBorder: 'var(--border-color-default)',
  /** Tooltip label text */
  tooltipLabelColor: 'var(--text-color-primary)',
  /** Tooltip value of a series drawn in the accent */
  tooltipAccentColor: 'var(--text-color-accent)',
  /** Band behind the hovered bar */
  cursorColor: 'var(--background-color-muted)',
} as const;

/**
 * Primary brand colors for charts
 */
export const CHART_PRIMARY = {
  /** Accent of the current mode */
  PRIMARY: 'var(--background-color-accent)',
} as const;

/**
 * Colors for category bar chart - diverse palette for visual distinction
 * Order matters: most contrasting colors first for better differentiation
 */
export const CATEGORY_COLORS = [
  '#9333ea', // purple-600
  '#6366f1', // indigo-500
  '#3b82f6', // blue-500
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
  '#8b5cf6', // violet-500
] as const;

/**
 * Platform-specific brand colors
 * Maps platform identifiers to their brand colors
 */
export const PLATFORM_COLORS: Record<string, string> = {
  claude: '#9333ea',     // purple-600
  chatgpt: '#10b981',    // emerald-500
  gemini: '#3b82f6',     // blue-500
  perplexity: '#6366f1', // indigo-500
  copilot: '#f59e0b',    // amber-500
  mistral: '#f97316',    // orange-500
  custom: '#6b7280',     // gray-500
} as const;

/**
 * Fallback colors for unknown platforms
 * Used when platform is not in PLATFORM_COLORS
 */
export const PLATFORM_FALLBACK_COLORS = [
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#22c55e', // green-500
] as const;

/**
 * Time bucket colors - transitioning from night to day to night
 * Represents the progression of a day
 */
export const TIME_BUCKET_COLORS: Record<string, string> = {
  Night: '#6366f1',    // indigo-500 (dark)
  Morning: '#f59e0b',  // amber-500 (sunrise)
  Afternoon: '#eab308', // yellow-500 (peak sun)
  Evening: '#f97316',   // orange-500 (sunset)
} as const;

/**
 * Day of week chart colors
 */
export const DAY_OF_WEEK_COLORS = {
  /** Default bar color - the softer accent/border */
  BAR: 'var(--border-color-accent)',
  /** Peak day highlight - the accent */
  PEAK: 'var(--background-color-accent)',
} as const;

/**
 * Get color for a platform, with fallback support
 * @param platform - Platform identifier
 * @param index - Index for fallback color selection
 * @returns Color hex string
 */
export const getPlatformColor = (platform: string, index: number): string => {
  const lowerPlatform = platform.toLowerCase();
  if (PLATFORM_COLORS[lowerPlatform]) {
    return PLATFORM_COLORS[lowerPlatform];
  }
  return PLATFORM_FALLBACK_COLORS[index % PLATFORM_FALLBACK_COLORS.length];
};

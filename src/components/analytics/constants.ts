/**
 * Analytics component constants
 * Centralizes magic numbers for chart dimensions, intervals, and display limits
 */

/** Refresh interval for time-based updates (60 seconds) */
export const REFRESH_INTERVAL_MS = 60_000;

/** Chart height presets in pixels */
export const CHART_HEIGHT = {
  /** Small charts: pie, bar, time-of-day (200px) */
  SMALL: 200,
  /** Medium charts: line chart (250px) */
  MEDIUM: 250,
} as const;

/** Maximum categories to display in the category bar chart */
export const MAX_CATEGORIES_DISPLAY = 6;

/** Pie chart dimension configuration */
export const PIE_CHART = {
  /** Inner radius for donut effect */
  INNER_RADIUS: 50,
  /** Outer radius of the pie */
  OUTER_RADIUS: 70,
  /** Padding angle between slices in degrees */
  PADDING_ANGLE: 2,
} as const;

/** Legend configuration for pie charts */
export const PIE_LEGEND = {
  /** Height of the legend area */
  HEIGHT: 36,
  /** Size of legend icons */
  ICON_SIZE: 8,
} as const;

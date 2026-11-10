/**
 * The colors of the Analytics charts drawn by recharts. Each reads a color token of src/theme/tokens.css
 * as a CSS variable: Chrome resolves var() in SVG presentation attributes, so the charts follow the
 * .dark class by themselves. The tooltip is HTML and takes token classes (charts/ChartTooltip.tsx).
 */

export const CHART_THEME = {
  /** Axis tick labels */
  textColor: 'var(--text-color-tertiary)',
  /** Band behind the hovered bar */
  cursorColor: 'var(--background-color-muted)',
} as const;

export const CHART_PRIMARY = {
  /** The bars: the accent of the current mode */
  PRIMARY: 'var(--background-color-accent)',
} as const;

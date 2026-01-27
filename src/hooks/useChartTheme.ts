import { useMemo } from 'react';

import { useThemeContext } from '../contexts/ThemeContext';

export interface ChartThemeColors {
  /** Grid line color */
  gridColor: string;
  /** Axis and label text color */
  textColor: string;
  /** Tooltip background color */
  tooltipBg: string;
  /** Tooltip border color */
  tooltipBorder: string;
  /** Tooltip label text color */
  tooltipLabelColor: string;
  /** Cursor hover color */
  cursorColor: string;
  /** Whether dark mode is active */
  isDarkMode: boolean;
}

/**
 * Hook that provides theme-aware colors for chart components.
 * Uses ThemeContext to automatically adapt to light/dark mode.
 */
export const useChartTheme = (): ChartThemeColors => {
  const { resolvedTheme } = useThemeContext();
  const isDarkMode = resolvedTheme === 'dark';

  return useMemo(() => ({
    gridColor: isDarkMode ? '#374151' : '#e5e7eb', // gray-700 : gray-200
    textColor: isDarkMode ? '#9ca3af' : '#6b7280', // gray-400 : gray-500
    tooltipBg: isDarkMode ? '#1f2937' : '#ffffff', // gray-800 : white
    tooltipBorder: isDarkMode ? '#374151' : '#e5e7eb', // gray-700 : gray-200
    tooltipLabelColor: isDarkMode ? '#f3f4f6' : '#111827', // gray-100 : gray-900
    cursorColor: isDarkMode ? 'rgba(156, 163, 175, 0.1)' : 'rgba(107, 114, 128, 0.1)',
    isDarkMode
  }), [isDarkMode]);
};

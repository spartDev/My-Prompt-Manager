import { FC, memo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

import { useChartTheme } from '../../../hooks/useChartTheme';
import { PlatformBreakdown } from '../../../types/hooks';
import { formatPlatformName } from '../../../utils';
import { PIE_CHART, PIE_LEGEND } from '../constants';

export interface PlatformPieChartProps {
  /** Platform breakdown data */
  data: PlatformBreakdown[];
  /** Height of the chart in pixels */
  height?: number;
  /** Whether to show legend */
  showLegend?: boolean;
}

// Colors for each platform - using design guideline colors
const PLATFORM_COLORS: Record<string, string> = {
  claude: '#9333ea',     // purple-600
  chatgpt: '#10b981',    // emerald-500
  gemini: '#3b82f6',     // blue-500
  perplexity: '#6366f1', // indigo-500
  copilot: '#f59e0b',    // amber-500
  mistral: '#f97316',    // orange-500
  custom: '#6b7280'      // gray-500
};

// Fallback colors for unknown platforms
const FALLBACK_COLORS = [
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#8b5cf6', // violet-500
  '#ef4444', // red-500
  '#22c55e', // green-500
];

/**
 * Get color for a platform based on predefined colors or fallback palette
 */
const getColor = (platform: string, index: number): string => {
  const lowerPlatform = platform.toLowerCase();
  if (PLATFORM_COLORS[lowerPlatform]) {
    return PLATFORM_COLORS[lowerPlatform];
  }
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

/**
 * Donut chart showing platform usage breakdown
 */
const PlatformPieChart: FC<PlatformPieChartProps> = memo(({
  data,
  height = 200,
  showLegend = true
}) => {
  const { tooltipBg, tooltipBorder, tooltipLabelColor, isDarkMode } = useChartTheme();

  // Prepare data with formatted names
  const chartData = data.map((item, index) => ({
    ...item,
    name: formatPlatformName(item.platform),
    color: getColor(item.platform, index)
  }));

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl"
        style={{ height }}
        role="img"
        aria-label="No platform data available"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">No platform data</p>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      role="img"
      aria-label={`Platform breakdown chart showing ${String(data.length)} platforms`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={PIE_CHART.INNER_RADIUS}
            outerRadius={PIE_CHART.OUTER_RADIUS}
            paddingAngle={PIE_CHART.PADDING_ANGLE}
            dataKey="count"
            nameKey="name"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${String(index)}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | undefined, name: string | undefined) => [`${String(value ?? 0)} uses`, name ?? '']}
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '8px',
              fontSize: '12px'
            }}
            labelStyle={{
              color: tooltipLabelColor,
              fontWeight: 600
            }}
            itemStyle={{
              color: tooltipLabelColor
            }}
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={PIE_LEGEND.HEIGHT}
              iconType="circle"
              iconSize={PIE_LEGEND.ICON_SIZE}
              formatter={(value: string) => (
                <span style={{ color: isDarkMode ? '#d1d5db' : '#4b5563', fontSize: '11px' }}>
                  {value}
                </span>
              )}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});

PlatformPieChart.displayName = 'PlatformPieChart';

export default PlatformPieChart;

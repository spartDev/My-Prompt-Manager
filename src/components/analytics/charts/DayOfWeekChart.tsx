import { FC, memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

import { DayOfWeekDistribution } from '../../../types/hooks';

export interface DayOfWeekChartProps {
  /** Day of week distribution data */
  data: DayOfWeekDistribution[];
  /** Height of the chart in pixels */
  height?: number;
  /** Whether to show grid lines */
  showGrid?: boolean;
  /** Whether the chart is in dark mode */
  isDarkMode?: boolean;
  /** Whether to highlight the peak day */
  highlightPeak?: boolean;
}

/**
 * Vertical bar chart showing usage distribution across days of the week
 */
const DayOfWeekChart: FC<DayOfWeekChartProps> = memo(({
  data,
  height = 200,
  showGrid = true,
  isDarkMode = false,
  highlightPeak = true
}) => {
  // Colors based on design guidelines
  const barColor = '#6366f1'; // indigo-500
  const peakColor = '#9333ea'; // purple-600
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const textColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const tooltipBg = isDarkMode ? '#1f2937' : '#ffffff';
  const tooltipBorder = isDarkMode ? '#374151' : '#e5e7eb';

  // Find peak day
  const maxCount = Math.max(...data.map(d => d.count));

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl"
        style={{ height }}
        role="img"
        aria-label="No day of week data available"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">No day of week data</p>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      role="img"
      aria-label="Day of week usage chart"
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
          )}
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: textColor }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: textColor }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={30}
          />
          <Tooltip
            formatter={(value: number | undefined) => [value ?? 0, 'Uses']}
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '8px',
              fontSize: '12px'
            }}
            labelStyle={{
              color: isDarkMode ? '#f3f4f6' : '#111827',
              fontWeight: 600
            }}
            itemStyle={{
              color: isDarkMode ? '#f3f4f6' : '#111827'
            }}
            cursor={{ fill: isDarkMode ? 'rgba(156, 163, 175, 0.1)' : 'rgba(107, 114, 128, 0.1)' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${String(index)}`}
                fill={highlightPeak && entry.count === maxCount && maxCount > 0 ? peakColor : barColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

DayOfWeekChart.displayName = 'DayOfWeekChart';

export default DayOfWeekChart;

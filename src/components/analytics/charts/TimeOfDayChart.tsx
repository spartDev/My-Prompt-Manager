import { FC } from 'react';
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

import { TimeOfDayDistribution } from '../../../types/hooks';

export interface TimeOfDayChartProps {
  /** Time of day distribution data */
  data: TimeOfDayDistribution[];
  /** Height of the chart in pixels */
  height?: number;
  /** Whether to show grid lines */
  showGrid?: boolean;
  /** Whether the chart is in dark mode */
  isDarkMode?: boolean;
  /** Whether to highlight the peak time */
  highlightPeak?: boolean;
}

// Colors for time buckets - transitioning from night to day to night
const TIME_BUCKET_COLORS: Record<string, string> = {
  Night: '#6366f1',    // indigo-500 (dark)
  Morning: '#f59e0b',  // amber-500 (sunrise)
  Afternoon: '#eab308', // yellow-500 (peak sun)
  Evening: '#f97316'   // orange-500 (sunset)
};

// Icons for time buckets (as simple text representations)
const TIME_BUCKET_ICONS: Record<string, string> = {
  Night: '22-6',
  Morning: '6-12',
  Afternoon: '12-18',
  Evening: '18-22'
};

/**
 * Bar chart showing usage distribution across time of day buckets
 */
const TimeOfDayChart: FC<TimeOfDayChartProps> = ({
  data,
  height = 200,
  showGrid = true,
  isDarkMode = false,
  highlightPeak = true
}) => {
  const gridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const textColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const tooltipBg = isDarkMode ? '#1f2937' : '#ffffff';
  const tooltipBorder = isDarkMode ? '#374151' : '#e5e7eb';

  // Find peak time
  const maxCount = Math.max(...data.map(d => d.count));

  // Prepare data with time ranges
  const chartData = data.map(item => ({
    ...item,
    timeRange: TIME_BUCKET_ICONS[item.bucket] ?? ''
  }));

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl"
        style={{ height }}
        role="img"
        aria-label="No time of day data available"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">No time of day data</p>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      role="img"
      aria-label="Time of day usage chart"
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
          )}
          <XAxis
            dataKey="bucket"
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
            cursor={{ fill: isDarkMode ? 'rgba(156, 163, 175, 0.1)' : 'rgba(107, 114, 128, 0.1)' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => {
              const baseColor = TIME_BUCKET_COLORS[entry.bucket] ?? '#6b7280';
              const color = highlightPeak && entry.count === maxCount && maxCount > 0
                ? '#9333ea' // purple-600 for peak
                : baseColor;
              return <Cell key={`cell-${String(index)}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TimeOfDayChart;

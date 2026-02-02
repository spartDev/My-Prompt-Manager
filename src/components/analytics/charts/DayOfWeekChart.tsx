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

import { useChartTheme } from '../../../hooks/useChartTheme';
import { DAY_OF_WEEK_COLORS } from '../../../theme/chartColors';
import { DayOfWeekDistribution } from '../../../types/hooks';

export interface DayOfWeekChartProps {
  /** Day of week distribution data */
  data: DayOfWeekDistribution[];
  /** Height of the chart in pixels */
  height?: number;
  /** Whether to show grid lines */
  showGrid?: boolean;
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
  highlightPeak = true
}) => {
  const { gridColor, textColor, tooltipBg, tooltipBorder, tooltipLabelColor, cursorColor } = useChartTheme();

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

  // Find peak day (safe to call after empty check)
  const maxCount = Math.max(...data.map(d => d.count));

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
              color: tooltipLabelColor,
              fontWeight: 600
            }}
            itemStyle={{
              color: tooltipLabelColor
            }}
            cursor={{ fill: cursorColor }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${String(index)}`}
                fill={highlightPeak && entry.count === maxCount && maxCount > 0 ? DAY_OF_WEEK_COLORS.PEAK : DAY_OF_WEEK_COLORS.BAR}
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

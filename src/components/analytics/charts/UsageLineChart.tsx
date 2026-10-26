import { type FC, memo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer, 
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { CHART_PRIMARY, CHART_THEME } from '../../../theme/chartColors';
import type { DailyUsage } from '../../../types/hooks';

export interface UsageLineChartProps {
  /** Daily usage data for the chart */
  data: DailyUsage[];
  /** Height of the chart in pixels */
  height?: number;
  /** Whether to show grid lines */
  showGrid?: boolean;
}

/**
 * Line chart showing 30-day usage trend
 */
const UsageLineChart: FC<UsageLineChartProps> = memo(({
  data,
  height = 200,
  showGrid = true
}) => {
  const { gridColor, textColor, tooltipBg, tooltipBorder, tooltipLabelColor, tooltipAccentColor } = CHART_THEME;

  // Format date for X axis (e.g., "Jan 13")
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const lineColor = CHART_PRIMARY.PRIMARY;

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-raised rounded-xl"
        style={{ height }}
        role="img"
        aria-label="No usage data available"
      >
        <p className="text-sm text-tertiary">No usage data</p>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      role="img"
      aria-label={`Usage trend chart showing ${String(data.length)} days of data`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              vertical={false}
            />
          )}
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: textColor }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            interval="preserveStartEnd"
            minTickGap={50}
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
            labelFormatter={(label) => formatDate(String(label))}
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
              color: tooltipAccentColor
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

UsageLineChart.displayName = 'UsageLineChart';

export default UsageLineChart;

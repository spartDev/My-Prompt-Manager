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
import { CategoryDistribution } from '../../../types/hooks';

export interface CategoryBarChartProps {
  /** Category distribution data */
  data: CategoryDistribution[];
  /** Height of the chart in pixels */
  height?: number;
  /** Maximum number of categories to display */
  maxCategories?: number;
  /** Whether to show grid lines */
  showGrid?: boolean;
}

// Colors for categories - using design guideline colors
const CATEGORY_COLORS = [
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
];

/**
 * Horizontal bar chart showing category usage distribution
 */
const CategoryBarChart: FC<CategoryBarChartProps> = memo(({
  data,
  height = 200,
  maxCategories = 5,
  showGrid = true
}) => {
  const { gridColor, textColor, tooltipBg, tooltipBorder, tooltipLabelColor, cursorColor } = useChartTheme();

  // Limit to top N categories
  const chartData = data.slice(0, maxCategories);

  // Truncate long category names
  const truncateName = (name: string, maxLength: number = 12): string => {
    if (name.length <= maxLength) {
      return name;
    }
    return name.substring(0, maxLength - 2) + '...';
  };

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl"
        style={{ height }}
        role="img"
        aria-label="No category data available"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">No category data</p>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      role="img"
      aria-label={`Category usage chart showing ${String(chartData.length)} categories`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={gridColor}
              horizontal={false}
            />
          )}
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: textColor }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: textColor }}
            tickLine={false}
            axisLine={false}
            width={80}
            tickFormatter={truncateName}
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
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${String(index)}`}
                fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

CategoryBarChart.displayName = 'CategoryBarChart';

export default CategoryBarChart;

import { type FC, memo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { busiest } from '../../../services/usageInsights';
import { CHART_PRIMARY, CHART_THEME } from '../../../theme/chartColors';
import { MOTION, prefersReducedMotion } from '../../../theme/motion';
import type { DailyUsage } from '../../../types/hooks';
import { CHART_HEIGHT, NO_THROTTLED_EVENTS } from '../constants';

import ChartTooltip from './ChartTooltip';

export interface DailyUseChartProps {
  /** Insertions per local day of the period, oldest first */
  data: DailyUsage[];
  /** Height of the chart in pixels */
  height?: number;
}

/** "Nov 3" from a YYYY-MM-DD day. The time makes it a local day: a bare date parses as UTC midnight */
export const formatDay = (day: string): string =>
  new Date(`${day}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** The chart's text alternative: the period, its total, the busiest day */
export const dailyUseSummary = (data: DailyUsage[]): string => {
  const total = data.reduce((sum, day) => sum + day.count, 0);
  const top = busiest(data);
  const period = `Prompts used per day over the last ${String(data.length)} days`;
  return top
    ? `${period}: ${String(total)} in all. The busiest day is ${formatDay(top.date)}, with ${String(top.count)}.`
    : `${period}: none yet.`;
};

/**
 * Daily use in the full-page Analytics view: a pill bar per day of the period, in the accent.
 */
const DailyUseChart: FC<DailyUseChartProps> = memo(({ data, height = CHART_HEIGHT }) => (
  <div className="w-full" role="img" aria-label={dailyUseSummary(data)} data-testid="daily-use-chart">
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} throttledEvents={NO_THROTTLED_EVENTS}>
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          tick={{ fontSize: 11, fontWeight: 600, fill: CHART_THEME.textColor }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <Tooltip
          content={<ChartTooltip formatLabel={formatDay} />}
          cursor={{ fill: CHART_THEME.cursorColor, radius: 8 }}
          isAnimationActive={false}
        />
        <Bar
          dataKey="count"
          fill={CHART_PRIMARY.PRIMARY}
          radius={99}
          maxBarSize={14}
          minPointSize={4}
          isAnimationActive={!prefersReducedMotion()}
          animationDuration={MOTION.barGrow}
        />
      </BarChart>
    </ResponsiveContainer>
  </div>
));

DailyUseChart.displayName = 'DailyUseChart';

export default DailyUseChart;

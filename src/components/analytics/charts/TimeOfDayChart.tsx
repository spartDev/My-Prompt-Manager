import { type FC, memo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { busiest } from '../../../services/usageInsights';
import { CHART_PRIMARY, CHART_THEME } from '../../../theme/chartColors';
import { MOTION, prefersReducedMotion } from '../../../theme/motion';
import type { TimeOfDayDistribution } from '../../../types/hooks';
import { CHART_HEIGHT, NO_THROTTLED_EVENTS } from '../constants';

import ChartTooltip from './ChartTooltip';

export interface TimeOfDayChartProps {
  /** Insertions per time of day: Morning, Afternoon, Evening, Night */
  data: TimeOfDayDistribution[];
  /** Height of the chart in pixels */
  height?: number;
}

/** The hours of each time of day, on a 24-hour clock */
const HOURS: Record<string, string> = {
  Morning: '6-12',
  Afternoon: '12-18',
  Evening: '18-22',
  Night: '22-6'
};

const withHours = (bucket: string): string => (HOURS[bucket] ? `${bucket}, ${HOURS[bucket]}` : bucket);

/** The chart's text alternative: every count, then the busiest time */
export const timeOfDaySummary = (data: TimeOfDayDistribution[]): string => {
  const top = busiest(data);
  const counts = data.map(entry => `${entry.bucket} ${String(entry.count)}`).join(', ');
  return top
    ? `Prompts used per time of day: ${counts}. ${top.bucket} is the busiest.`
    : 'Prompts used per time of day: none yet.';
};

/**
 * Time of day in the full-page Analytics view: a pill bar per time of day, in the accent.
 */
const TimeOfDayChart: FC<TimeOfDayChartProps> = memo(({ data, height = CHART_HEIGHT }) => (
  <div className="w-full" role="img" aria-label={timeOfDaySummary(data)} data-testid="time-of-day-chart">
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} throttledEvents={NO_THROTTLED_EVENTS}>
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 11, fontWeight: 600, fill: CHART_THEME.textColor }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={<ChartTooltip formatLabel={withHours} />}
          cursor={{ fill: CHART_THEME.cursorColor, radius: 8 }}
          isAnimationActive={false}
        />
        <Bar
          dataKey="count"
          fill={CHART_PRIMARY.PRIMARY}
          radius={99}
          maxBarSize={26}
          minPointSize={6}
          isAnimationActive={!prefersReducedMotion()}
          animationDuration={MOTION.barGrow}
        />
      </BarChart>
    </ResponsiveContainer>
  </div>
));

TimeOfDayChart.displayName = 'TimeOfDayChart';

export default TimeOfDayChart;

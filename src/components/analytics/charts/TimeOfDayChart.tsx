import { type FC, memo } from 'react';

import { busiest } from '../../../services/usageInsights';
import type { TimeOfDayDistribution } from '../../../types/hooks';

import PillBarChart from './PillBarChart';

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
const TimeOfDayChart: FC<TimeOfDayChartProps> = memo(({ data, height }) => (
  <PillBarChart
    bars={data.map(entry => ({ key: entry.bucket, count: entry.count }))}
    summary={timeOfDaySummary(data)}
    formatTooltipLabel={withHours}
    maxBarWidth={26}
    minBarHeight={6}
    height={height}
    data-testid="time-of-day-chart"
  />
));

TimeOfDayChart.displayName = 'TimeOfDayChart';

export default TimeOfDayChart;

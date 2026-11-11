import { type FC, memo } from 'react';

import { busiest } from '../../../services/usageInsights';
import type { DailyUsage } from '../../../types/hooks';

import PillBarChart from './PillBarChart';

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
const DailyUseChart: FC<DailyUseChartProps> = memo(({ data, height }) => (
  <PillBarChart
    bars={data.map(day => ({ key: day.date, count: day.count }))}
    summary={dailyUseSummary(data)}
    formatLabel={formatDay}
    maxBarWidth={14}
    minBarHeight={4}
    labelEvery={7}
    height={height}
    data-testid="daily-use-chart"
  />
));

DailyUseChart.displayName = 'DailyUseChart';

export default DailyUseChart;

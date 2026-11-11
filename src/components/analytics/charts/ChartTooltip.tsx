import type { FC } from 'react';

export interface ChartTooltipProps {
  /** What the hovered bar stands for, in words: a date, a time of day */
  label: string;
  /** The hovered bar's Insertions */
  count: number;
}

/**
 * The tooltip of the Analytics charts: a dark pill like the hero, the hovered bar's label and its
 * Insertions.
 */
const ChartTooltip: FC<ChartTooltipProps> = ({ label, count }) => (
  <div
    data-testid="chart-tooltip"
    className="px-3 py-1.5 rounded-full bg-inverse shadow-md text-[11.5px] font-bold text-on-inverse-strong whitespace-nowrap"
  >
    <span className="font-semibold text-on-inverse">{label}</span>
    {' '}
    {String(count)} {count === 1 ? 'use' : 'uses'}
  </div>
);

export default ChartTooltip;

import type { FC } from 'react';

export interface ChartTooltipProps {
  /** Set by recharts: whether a bar is hovered, the hovered entry and its axis label */
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: unknown;
  /** What the hovered bar stands for, from its axis label: a date, a time of day */
  formatLabel?: (label: string) => string;
}

/**
 * The tooltip of the Analytics charts: a dark pill like the hero, the hovered bar's label and its
 * Insertions.
 */
const ChartTooltip: FC<ChartTooltipProps> = ({ active, payload, label, formatLabel }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const count = Number(payload[0].value ?? 0);
  const name = typeof label === 'string' || typeof label === 'number' ? String(label) : '';

  return (
    <div
      data-testid="chart-tooltip"
      className="px-3 py-1.5 rounded-full bg-inverse shadow-md text-[11.5px] font-bold text-on-inverse-strong whitespace-nowrap"
    >
      <span className="font-semibold text-on-inverse">{formatLabel ? formatLabel(name) : name}</span>
      {' '}
      {String(count)} {count === 1 ? 'use' : 'uses'}
    </div>
  );
};

export default ChartTooltip;

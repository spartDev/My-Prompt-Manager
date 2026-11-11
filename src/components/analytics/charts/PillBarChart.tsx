import { type FC, useState } from 'react';

import { MOTION } from '../../../theme/motion';
import { CHART_HEIGHT } from '../constants';

import ChartTooltip from './ChartTooltip';

export interface PillBar {
  /** What the bar stands for, as the data names it: a YYYY-MM-DD day, a time of day */
  key: string;
  /** Insertions */
  count: number;
}

export interface PillBarChartProps {
  bars: PillBar[];
  /** The chart's text alternative */
  summary: string;
  /** What a bar stands for, in words, on the axis */
  formatLabel?: (key: string) => string;
  /** What a bar stands for, in words, in the tooltip: the axis label unless set */
  formatTooltipLabel?: (key: string) => string;
  /** The widest a pill grows, in pixels */
  maxBarWidth: number;
  /** The height of a pill with no Insertions, so an empty entry still shows, in pixels */
  minBarHeight: number;
  /** Name one entry in this many on the axis, counting back from the last one */
  labelEvery?: number;
  /** Height of the chart in pixels, axis labels included */
  height?: number;
  'data-testid'?: string;
}

/** Pills grow one after another over the time the hero's seven weekday bars take, however many there are */
const growDelay = (index: number, count: number): number =>
  MOTION.barDelay + Math.round(index * MOTION.barStagger * Math.min(1, 7 / count));

/** The tooltip opens toward the middle of the chart, so at either end it stays inside the card */
const tooltipAlign = (index: number, count: number): string => {
  if (index < count / 3) {
    return 'left-0';
  }
  return index >= (count * 2) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';
};

/**
 * The bar charts of the full-page Analytics view: a pill bar per entry, in the accent, sized against the
 * busiest, growing from the bottom like the hero's. Hovering a bar's column shows a muted band behind it and the
 * tooltip above it, with its label and Insertions. A list hidden on screen gives every entry to assistive technology.
 */
const PillBarChart: FC<PillBarChartProps> = ({
  bars,
  summary,
  formatLabel = String,
  formatTooltipLabel = formatLabel,
  maxBarWidth,
  minBarHeight,
  labelEvery = 1,
  height = CHART_HEIGHT,
  'data-testid': testId
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map(bar => bar.count));

  return (
    <>
      <div
        className="grid w-full gap-1"
        role="img"
        aria-label={summary}
        data-testid={testId}
        style={{ height, gridTemplateColumns: `repeat(${String(bars.length)}, minmax(0, 1fr))` }}
      >
        {bars.map((bar, index) => {
          const isHovered = hovered === index;
          const isLabelled = (bars.length - 1 - index) % labelEvery === 0;
          return (
            <div
              key={bar.key}
              aria-hidden="true"
              data-testid="chart-bar"
              onMouseEnter={() => { setHovered(index); }}
              onMouseLeave={() => { setHovered(current => (current === index ? null : current)); }}
              className={`flex min-h-0 flex-col gap-1.5 ${isHovered ? 'relative z-10' : ''}`}
            >
              <div
                data-testid="chart-band"
                className={`flex flex-1 min-h-0 items-end justify-center rounded-[8px] pt-2 transition-colors duration-(--duration-color) ${isHovered ? 'bg-muted' : ''}`}
              >
                <div
                  data-testid="chart-pill"
                  className="relative w-full"
                  style={{
                    maxWidth: maxBarWidth,
                    height: `${String(Math.round((bar.count / max) * 100))}%`,
                    minHeight: minBarHeight
                  }}
                >
                  <div
                    data-testid="chart-pill-fill"
                    className="h-full rounded-full bg-accent origin-bottom animate-bar-grow"
                    style={{ animationDelay: `${String(growDelay(index, bars.length))}ms` }}
                  />
                  {/* Outside the growing fill: Chromium can leave a child of a scaled layer unpainted */}
                  {isHovered && (
                    <span className={`absolute bottom-[calc(100%+6px)] ${tooltipAlign(index, bars.length)}`}>
                      <ChartTooltip label={formatTooltipLabel(bar.key)} count={bar.count} />
                    </span>
                  )}
                </div>
              </div>
              <span className="flex h-3.5 justify-center whitespace-nowrap text-[11px] leading-3.5 font-semibold text-tertiary">
                {isLabelled && <span data-testid="chart-axis-label">{formatLabel(bar.key)}</span>}
              </span>
            </div>
          );
        })}
      </div>
      {/* The bars are hidden from assistive technology: every entry and its Insertions, in words */}
      <ul className="sr-only">
        {bars.map(bar => (
          <li key={bar.key}>{`${formatTooltipLabel(bar.key)}: ${String(bar.count)} ${bar.count === 1 ? 'use' : 'uses'}`}</li>
        ))}
      </ul>
    </>
  );
};

export default PillBarChart;

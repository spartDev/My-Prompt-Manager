import type { FC } from 'react';

import { MOTION } from '../../theme/motion';

/** The columns of a ranked row: the rank round, the label over its bar, the count */
export const RANK_ROW_GRID = 'grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 py-2 pr-1';

export interface RankRowContentProps {
  /** Place in the ranking, from 0 */
  index: number;
  label: string;
  count: number;
  /** The count of the first row: the bar is sized against it */
  top: number;
  /** A Category's own color, shown as a dot before the label */
  dotColor?: string;
  /** A second piece of text at the right of the label, from the sm width up */
  meta?: string;
}

/**
 * What a ranked row of Analytics shows (Atelier 1C): the rank in a round, the label over a bar that
 * fills from the left with a spring, the count at the right. The round, the bar and the count are
 * hidden from assistive technology: the row that holds them names itself.
 */
export const RankRowContent: FC<RankRowContentProps> = ({ index, label, count, top, dotColor, meta }) => {
  const title = (
    <span className="min-w-0 flex items-center gap-1.5">
      {dotColor && <span aria-hidden="true" className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />}
      <span className="text-[13px] font-semibold text-primary truncate">{label}</span>
    </span>
  );

  return (
    <>
      <span
        aria-hidden="true"
        className={`w-7 h-7 grid place-items-center rounded-full text-xs font-extrabold text-accent ${index === 0 ? 'bg-accent-selected' : 'bg-subtle'}`}
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex flex-col gap-1.5">
        {meta ? (
          <span className="flex items-baseline justify-between gap-3">
            {title}
            <span className="hidden sm:block shrink-0 text-xs text-tertiary">{meta}</span>
          </span>
        ) : title}
        <span aria-hidden="true" className="block h-1.5 rounded-full bg-accent-subtle overflow-hidden">
          <span
            className="block h-full rounded-full bg-accent origin-left animate-rank-fill"
            style={{
              width: `${String(Math.round((count / Math.max(1, top)) * 100))}%`,
              animationDelay: `${String(MOTION.rankDelay + index * MOTION.rankStagger)}ms`
            }}
          />
        </span>
      </span>
      <span aria-hidden="true" className="min-w-[2ch] text-right text-[12.5px] font-bold tabular-nums text-secondary">{count}</span>
    </>
  );
};

export interface RankedRow {
  key: string;
  label: string;
  count: number;
  dotColor?: string;
}

export interface RankedRowsProps {
  /** The card's title: "Platforms" */
  title: string;
  /** The rows, most used first */
  rows: RankedRow[];
  /** Its place among the cards rising together */
  delayIndex?: number;
}

const slug = (title: string): string => title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * A card of ranked rows in the full-page Analytics view: the Platforms, the Categories. The rows
 * are read, not pressed.
 */
const RankedRows: FC<RankedRowsProps> = ({ title, rows, delayIndex = 0 }) => {
  const id = `ranked-${slug(title)}-title`;
  const top = rows[0]?.count ?? 1;

  return (
    <section
      aria-labelledby={id}
      data-testid={`ranked-${slug(title)}`}
      className="mt-2.5 pt-3.5 pr-3 pb-2 pl-3.5 rounded-group bg-card border border-default animate-card-rise min-w-0"
      style={{ animationDelay: `${String(MOTION.cardDelay + delayIndex * MOTION.cardStagger)}ms` }}
    >
      <h2 id={id} className="text-sm font-extrabold text-primary">{title}</h2>
      <ol className="mt-1.5 flex flex-col">
        {rows.map((row, index) => (
          <li key={row.key} data-testid="ranked-row" className={RANK_ROW_GRID}>
            <RankRowContent index={index} label={row.label} count={row.count} top={top} dotColor={row.dotColor} />
            <span className="sr-only">{String(row.count)} {row.count === 1 ? 'use' : 'uses'}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default RankedRows;

import type { FC } from 'react';

import type { RankedPrompt } from '../../services/usageInsights';
import type { Prompt } from '../../types';

import { RANK_ROW_GRID, RankRowContent } from './RankedRows';

export interface MostUsedCardProps {
  /** The Prompts to show, ranked, most used first */
  ranked: RankedPrompt[];
  /** How many Prompts were used in the period: "View all" shows when more than the rows shown */
  usedCount: number;
  onOpenPrompt?: (prompt: Prompt) => void;
  /** The rows are read, not pressed: the full-page view, which has no editor to open a Prompt in */
  readOnly?: boolean;
  onViewAll?: () => void;
  /** A second piece of text on each row, from the sm width up: its Category, when it was last used */
  meta?: (ranked: RankedPrompt) => string;
}

/**
 * The Most used card of Analytics (Atelier 1C): a ranked row per Prompt, its rank in a round, its
 * title over a bar sized against the first, its uses at the right. A row opens its Prompt where the
 * surface can (the popup and side panel); in the full-page view it is read.
 */
const MostUsedCard: FC<MostUsedCardProps> = ({ ranked, usedCount, onOpenPrompt, onViewAll, meta, readOnly = false }) => {
  const top = ranked[0]?.count ?? 1;

  return (
    <section aria-labelledby="most-used-title" className="mt-2.5 pt-3.5 pr-3 pb-2 pl-3.5 rounded-group bg-card border border-default min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h2 id="most-used-title" className="text-sm font-extrabold text-primary">Most used</h2>
        {onViewAll && usedCount > ranked.length && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-accent hover:text-accent-strong rounded-md px-1 transition-colors focus-interactive"
          >
            View all
          </button>
        )}
      </div>
      <ol className="mt-1.5 flex flex-col">
        {ranked.map((entry, index) => {
          const { prompt, count } = entry;
          const uses = `${String(count)} ${count === 1 ? 'use' : 'uses'}`;
          const content = <RankRowContent index={index} label={prompt.title} count={count} top={top} meta={meta?.(entry)} />;
          return (
            <li key={prompt.id}>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => { onOpenPrompt?.(prompt); }}
                  aria-label={`${prompt.title}, ${uses}. Open`}
                  data-testid="most-used-row"
                  className={`w-full ${RANK_ROW_GRID} rounded-xl text-left hover:bg-muted transition-colors focus-interactive`}
                >
                  {content}
                </button>
              ) : (
                <div data-testid="most-used-row" className={RANK_ROW_GRID}>
                  {content}
                  <span className="sr-only">{uses}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default MostUsedCard;

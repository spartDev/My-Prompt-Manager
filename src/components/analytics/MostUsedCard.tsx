import type { FC } from 'react';

import type { RankedPrompt } from '../../services/usageInsights';
import { MOTION } from '../../theme/motion';
import type { Prompt } from '../../types';

export interface MostUsedCardProps {
  /** The Prompts to show, ranked, most used first */
  ranked: RankedPrompt[];
  /** How many Prompts were used in the period: "View all" shows when more than the rows shown */
  usedCount: number;
  onOpenPrompt?: (prompt: Prompt) => void;
  onViewAll?: () => void;
}

/**
 * The Most used card of Analytics (Atelier 1C): a ranked row per Prompt, its rank in a round, its
 * title over a bar sized against the first, its uses at the right. A row opens its Prompt.
 */
const MostUsedCard: FC<MostUsedCardProps> = ({ ranked, usedCount, onOpenPrompt, onViewAll }) => {
  const top = ranked[0]?.count ?? 1;

  return (
    <section aria-labelledby="most-used-title" className="mt-2.5 pt-3.5 pr-3 pb-2 pl-3.5 rounded-group bg-card border border-default">
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
        {ranked.map(({ prompt, count }, index) => (
          <li key={prompt.id}>
            <button
              type="button"
              onClick={() => { onOpenPrompt?.(prompt); }}
              aria-label={`${prompt.title}, ${String(count)} ${count === 1 ? 'use' : 'uses'}. Open`}
              data-testid="most-used-row"
              className="w-full grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 py-2 pr-1 rounded-xl text-left hover:bg-raised transition-colors focus-interactive"
            >
              <span
                aria-hidden="true"
                className={`w-7 h-7 grid place-items-center rounded-full text-xs font-extrabold text-accent ${index === 0 ? 'bg-accent-selected' : 'bg-subtle'}`}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-primary truncate">{prompt.title}</span>
                <span aria-hidden="true" className="block h-1.5 rounded-full bg-accent-subtle overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-accent origin-left animate-rank-fill"
                    style={{
                      width: `${String(Math.round((count / top) * 100))}%`,
                      animationDelay: `${String(MOTION.rankDelay + index * MOTION.rankStagger)}ms`
                    }}
                  />
                </span>
              </span>
              <span aria-hidden="true" className="text-[12.5px] font-bold text-secondary">{count}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default MostUsedCard;

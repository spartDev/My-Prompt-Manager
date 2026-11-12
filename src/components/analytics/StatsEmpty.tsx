import type { FC } from 'react';

import { MOTION } from '../../theme/motion';

export interface StatsEmptyProps {
  /** The short weekday labels under the ghost bars, Monday to Sunday */
  days: readonly string[];
  /** The Library holds no Prompt either: the action writes the first one instead of going to the Library */
  libraryEmpty: boolean;
  /** Goes to the Library; no button without it */
  onGoToLibrary?: () => void;
  /** Opens the editor on a new Prompt; no button without it */
  onWriteFirstPrompt?: () => void;
}

const GHOST_TILE = 'p-3.5 rounded-group border-[1.5px] border-dashed border-ghost animate-card-rise min-w-0';

const GhostTile: FC<{ label: string; bar: string; delayIndex: number }> = ({ label, bar, delayIndex }) => (
  <div className={GHOST_TILE} style={{ animationDelay: `${String(MOTION.cardDelay + (delayIndex + 1) * MOTION.cardStagger)}ms` }}>
    <h2 className="text-xs font-semibold text-tertiary">{label}</h2>
    {/* The value to come: the color of a strong border, as a fill */}
    <div aria-hidden="true" className={`h-2.5 mt-2.5 mb-[9px] rounded-full bg-(--border-color-strong) ${bar}`} />
    <p className="text-xs text-tertiary">No data yet</p>
  </div>
);

/**
 * Analytics with no Insertion in the period (Atelier 1C 5c): the page keeps its shape as ghosts of
 * what will come. The hero counts 0 over seven dashed bars, a card says how the page fills in, and
 * Top platform and Top category wait as dashed tiles.
 */
const StatsEmpty: FC<StatsEmptyProps> = ({ days, libraryEmpty, onGoToLibrary, onWriteFirstPrompt }) => {
  const action = libraryEmpty
    ? onWriteFirstPrompt && { label: 'Write your first prompt', onClick: onWriteFirstPrompt }
    : onGoToLibrary && { label: 'Go to the library', onClick: onGoToLibrary };

  return (
    <div data-testid="stats-empty">
      <section
        aria-labelledby="stats-hero-label"
        data-testid="stats-hero"
        className="mt-3.5 px-[18px] pt-[18px] pb-3.5 rounded-hero bg-inverse text-on-inverse-strong shadow-hero"
      >
        <h2 id="stats-hero-label" className="text-[13px] font-semibold text-on-inverse">Prompts used</h2>
        <p className="mt-1.5 text-[46px] leading-none font-extrabold tracking-[-0.045em] text-on-inverse-dim" data-testid="stats-total">0</p>
        <p className="mt-1 text-[13px] text-on-inverse" data-testid="stats-hero-subtitle">Your week will draw itself here.</p>
        <div aria-hidden="true" className="mt-4 grid grid-cols-7 gap-2 h-16">
          {days.map((day, index) => (
            <div key={day} className="flex flex-col items-center justify-end gap-1.5">
              <div
                data-testid="stats-ghost-bar"
                className="w-full max-w-[26px] h-[26px] rounded-full border-[1.5px] border-dashed border-inverse-ghost origin-bottom animate-ghost-grow"
                style={{ animationDelay: `${String(MOTION.ghostDelay + index * MOTION.barStagger)}ms` }}
              />
              <span className="text-[11px] font-semibold text-on-inverse-muted">{day}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="stats-empty-title"
        className="mt-2.5 flex flex-col items-start gap-2.5 p-4 rounded-group bg-card border border-default animate-card-rise"
        style={{ animationDelay: `${String(MOTION.cardDelay)}ms` }}
      >
        <div className="flex flex-col gap-1">
          <h2 id="stats-empty-title" className="text-base font-extrabold tracking-[-0.02em] text-primary">Nothing to measure yet</h2>
          <p className="text-[13px] leading-normal text-secondary text-pretty">
            Insert a prompt into an AI chat and this page fills in: uses per day, your top platform and your most used prompts.
          </p>
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="h-[38px] px-4 rounded-full bg-accent text-on-accent text-[13.5px] font-bold hover:bg-accent-hover active:scale-96 transition-chip focus-primary"
          >
            {action.label}
          </button>
        )}
      </section>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <GhostTile label="Top platform" bar="w-[64%]" delayIndex={0} />
        <GhostTile label="Top category" bar="w-[48%]" delayIndex={1} />
      </div>
    </div>
  );
};

export default StatsEmpty;

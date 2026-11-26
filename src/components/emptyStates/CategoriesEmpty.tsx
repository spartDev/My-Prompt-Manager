import { type FC, type Ref, useState } from 'react';

import { type BusyResult, useBusyButton } from '../../hooks/useBusyButton';
import { MOTION } from '../../theme/motion';

import EmptyState, { EMPTY_PRIMARY_BUTTON } from './EmptyState';

/** The Categories offered in one tap, each in a color of the Category palette */
export const STARTER_CATEGORIES = [
  { name: 'Work', color: '#2563EB' },
  { name: 'Writing', color: '#9333EA' },
  { name: 'Email', color: '#DB2777' },
  { name: 'Research', color: '#0F766E' }
] as const;

export interface CategoriesEmptyProps {
  /** Opens the Category sheet to create one */
  onCreate: () => void;
  /**
   * Creates a starter Category at once; the Notification that confirms it is the caller's. `starter`
   * is the button that was tapped. Rejects when the creation failed, the caller having said why
   */
  onQuickCreate: (category: { name: string; color: string }, starter: HTMLElement) => Promise<void>;
  /** The main action: it takes the keyboard when the last Category of the user is deleted */
  createButtonRef?: Ref<HTMLButtonElement>;
}

/** A tinted tile draws with its own color: a faint fill, a full square, a lighter bar */
const TILE = 'flex flex-col gap-3 p-[11px] rounded-2xl bg-[color-mix(in_srgb,currentColor_13%,transparent)] animate-card-rise';
const TILES = [
  { color: 'text-tile-blue', bar: 'w-[70%]' },
  { color: 'text-tile-pink', bar: 'w-[52%]' },
  { color: 'text-tile-violet', bar: 'w-[60%]' }
] as const;

const tileDelay = (index: number): string => `${String(index * MOTION.barStagger)}ms`;

/** The illustration of the empty Categories: three tinted tiles and a dashed one that waits */
const CategoriesIllustration: FC = () => (
  <div className="grid grid-cols-2 gap-2 w-[208px]">
    {TILES.map((tile, index) => (
      <div key={tile.color} className={`${TILE} ${tile.color}`} style={{ animationDelay: tileDelay(index) }}>
        <span className="size-[22px] rounded-lg bg-current" />
        <span className={`h-[7px] rounded-full bg-current opacity-35 ${tile.bar}`} />
      </div>
    ))}
    <div
      className="grid place-items-center rounded-2xl border-[1.5px] border-dashed border-ghost text-accent animate-card-rise"
      style={{ animationDelay: tileDelay(TILES.length) }}
    >
      <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </div>
  </div>
);

/**
 * Categories with none of the user's own (Atelier 1C 5b): create one in the Category sheet, or tap a
 * starter to have it at once. It leaves as soon as a Category of the user exists.
 */
const CategoriesEmpty: FC<CategoriesEmptyProps> = ({ onCreate, onQuickCreate, createButtonRef }) => {
  // One creation at a time: a second tap would create a second Category before the list takes over.
  // The starters keep the keyboard meanwhile, at full strength (the Loading State of
  // docs/DESIGN_GUIDELINES.md): opacity-50 would take a focused one's ring to 2.42:1 in light and
  // 1.81:1 in dark, under the 3:1 of a focus indicator
  const { busy, run } = useBusyButton();
  // The starter being created: it shows the spinner
  const [pending, setPending] = useState<string | null>(null);

  const quickCreate = (category: { name: string; color: string }, starter: HTMLElement): void => {
    void run(async (): Promise<BusyResult> => {
      setPending(category.name);
      try {
        await onQuickCreate(category, starter);
        return undefined;
      } catch {
        // A failure holds the busy state RETRY_FAILURE_HOLD_MS from the tap, as Import's does. Its
        // outcome is not yet shown together with the idle starter: App shows it (the failure
        // Notification, or the storage warning) as soon as the creation fails, until My-Prompt-Manager-86lj
        return () => undefined;
      }
    });
  };

  return (
    <EmptyState
      data-testid="categories-empty"
      illustration={<CategoriesIllustration />}
      title="No categories yet"
      description="Group your prompts by job, client or project. Each prompt lives in one category."
    >
      <button ref={createButtonRef} type="button" aria-haspopup="dialog" onClick={onCreate} className={EMPTY_PRIMARY_BUTTON}>
        Create a category
      </button>
      <div className="flex flex-col items-center gap-2">
        <p id="starter-categories-label" className="text-xs font-semibold text-tertiary">Or start with one tap</p>
        <ul aria-labelledby="starter-categories-label" className="flex flex-wrap justify-center gap-1.5">
          {STARTER_CATEGORIES.map(category => {
            const creating = busy && pending === category.name;
            return (
              <li key={category.name}>
                <button
                  type="button"
                  aria-label={creating ? `Creating category ${category.name}...` : `Create category ${category.name}`}
                  aria-disabled={busy ? true : undefined}
                  onClick={event => { quickCreate(category, event.currentTarget); }}
                  className="flex h-8 items-center gap-1.5 pl-2.5 pr-[13px] rounded-full bg-card border-[1.5px] border-default text-primary text-[12.5px] font-bold hover:border-accent active:scale-92 transition-chip focus-interactive aria-disabled:cursor-wait aria-disabled:hover:border-default aria-disabled:active:scale-100"
                >
                  {creating ? (
                    // The Loading State's spinner in the dot's place, drawn 12px over its 8px: the chip keeps its width
                    <span aria-hidden="true" className="size-3 -m-0.5 shrink-0 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  ) : (
                    // A Category color is user data, not a token
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                  )}
                  {category.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </EmptyState>
  );
};

export default CategoriesEmpty;

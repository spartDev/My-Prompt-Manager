import { type FC, type Ref, useState } from 'react';

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
  /** Creates a starter Category at once; the Notification that confirms it is the caller's */
  onQuickCreate: (category: { name: string; color: string }) => Promise<void>;
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
  // One creation at a time: a second tap would create a second Category before the list takes over
  const [creating, setCreating] = useState(false);

  const quickCreate = async (category: { name: string; color: string }): Promise<void> => {
    if (creating) {return;}
    setCreating(true);
    try {
      await onQuickCreate(category);
    } finally {
      setCreating(false);
    }
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
          {STARTER_CATEGORIES.map(category => (
            <li key={category.name}>
              <button
                type="button"
                aria-label={`Create category ${category.name}`}
                aria-disabled={creating}
                onClick={() => { void quickCreate(category); }}
                className="flex h-8 items-center gap-1.5 pl-2.5 pr-[13px] rounded-full bg-card border-[1.5px] border-default text-primary text-[12.5px] font-bold hover:border-accent active:scale-92 transition-chip focus-interactive aria-disabled:opacity-50"
              >
                {/* A Category color is user data, not a token */}
                <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </EmptyState>
  );
};

export default CategoriesEmpty;

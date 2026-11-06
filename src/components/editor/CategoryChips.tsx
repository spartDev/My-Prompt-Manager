import type { CSSProperties, FC, KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { DEFAULT_CATEGORY_COLOR, getSoftBadgeColors, PRESET_COLORS } from '../../constants/colors';
import { useRadioGroup } from '../../hooks/useRadioGroup';
import type { Category } from '../../types';
import { cn } from '../../utils/cn';

export interface CategoryChipsProps {
  /** Visible label of the group, also its accessible name */
  label: string;
  categories: Category[];
  /** Name of the chosen Category */
  value: string;
  onChange: (name: string) => void;
  /** Creates a Category (through Admission) and resolves to it as stored; omit to hide "New category" */
  onCreateCategory?: (category: { name: string; color: string }) => Promise<Category>;
  disabled?: boolean;
}

const sameColor = (a: string | undefined, b: string): boolean => a?.toLowerCase() === b.toLowerCase();

/** Index in PRESET_COLORS of the first color no Category uses yet (the first one when all are used) */
const firstUnusedColorIndex = (categories: Category[]): number => {
  const index = PRESET_COLORS.findIndex(preset => !categories.some(category => sameColor(category.color, preset.value)));
  return index === -1 ? 0 : index;
};

/** Pale tint and colored text of a chosen chip, in both themes (the Category chip rule) */
const chosenStyle = (color: string): CSSProperties => {
  const light = getSoftBadgeColors(color, 'light');
  const dark = getSoftBadgeColors(color, 'dark');
  return {
    '--chip-bg': light.background,
    '--chip-fg': light.text,
    '--chip-bg-dark': dark.background,
    '--chip-fg-dark': dark.text,
    borderColor: color
  } as CSSProperties;
};

const CheckIcon: FC = () => (
  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

const PlusIcon: FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={cn(className, 'shrink-0')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The Category of a Prompt, chosen among chips: a WAI-ARIA radio group (exactly one Category per
 * Prompt), followed by "New category", which creates one in place and chooses it.
 */
const CategoryChips: FC<CategoryChipsProps> = ({
  label,
  categories,
  value,
  onChange,
  onCreateCategory,
  disabled = false
}) => {
  const labelId = useId();
  const nameId = useId();
  const errorId = useId();

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [colorIndex, setColorIndex] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selectedIndex = categories.findIndex(category => category.name === value);
  const { getRadioProps } = useRadioGroup({
    options: categories,
    selectedIndex,
    onSelect: (category) => { onChange(category.name); },
    locked: disabled
  });

  const newColor = PRESET_COLORS[colorIndex];

  // The row opens on request, so its name field takes the keyboard
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) { nameRef.current?.focus(); }
  }, [adding]);

  const openAdd = () => {
    setColorIndex(firstUnusedColorIndex(categories));
    setNewName('');
    setCreateError(null);
    setAdding(true);
  };

  const closeAdd = () => {
    setAdding(false);
    setCreateError(null);
  };

  const submitNew = async () => {
    if (!onCreateCategory || creating) { return; }
    if (!newName.trim()) {
      setCreateError('Category name is required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await onCreateCategory({ name: newName, color: newColor.value });
      onChange(created.name);
      setAdding(false);
      setNewName('');
    } catch (err) {
      setCreateError((err as Error).message || 'Failed to create category');
    } finally {
      setCreating(false);
    }
  };

  // The new Category row keeps Enter and Escape to itself: Enter adds the Category instead of
  // saving the Prompt, Escape closes the row instead of leaving the editor
  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submitNew();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAdd();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-xs font-bold text-secondary">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        <div role="radiogroup" aria-labelledby={labelId} className="contents">
          {categories.map((category, index) => {
            const checked = index === selectedIndex;
            const color = category.color || DEFAULT_CATEGORY_COLOR;
            return (
              <button
                key={category.id}
                {...getRadioProps(index)}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={disabled}
                title={category.name}
                style={checked ? chosenStyle(color) : undefined}
                className={cn(
                  'h-8 max-w-full px-3 inline-flex items-center gap-1.5 rounded-full border-[1.5px] text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
                  checked
                    ? 'bg-[var(--chip-bg)] text-[var(--chip-fg)] dark:bg-[var(--chip-bg-dark)] dark:text-[var(--chip-fg-dark)]'
                    : 'bg-card border-default text-secondary hover:bg-muted'
                )}
              >
                {checked ? (
                  <CheckIcon />
                ) : (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                )}
                <span className="truncate max-w-[10rem]">{category.name}</span>
              </button>
            );
          })}
        </div>

        {onCreateCategory && !adding && (
          <button
            type="button"
            onClick={openAdd}
            disabled={disabled}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-accent text-sm font-semibold text-accent hover:bg-accent-subtle transition-colors focus-interactive disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <PlusIcon />
            New category
          </button>
        )}
      </div>

      {onCreateCategory && adding && (
        // Escape here closes the row, not the editor
        <div className="flex flex-col gap-1" data-keeps-escape>
          <div className="flex items-center gap-2 p-1.5 rounded-2xl border-[1.5px] border-accent bg-card">
            <button
              type="button"
              onClick={() => { setColorIndex(index => (index + 1) % PRESET_COLORS.length); }}
              disabled={creating}
              title="Change color"
              aria-label={`Change color, now ${newColor.name}`}
              className="w-8 h-8 shrink-0 grid place-items-center rounded-full hover:bg-muted focus-interactive"
            >
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: newColor.value }} aria-hidden="true" />
            </button>
            <label htmlFor={nameId} className="sr-only">New category name</label>
            <input
              id={nameId}
              type="text"
              value={newName}
              onChange={(event) => { setNewName(event.target.value); setCreateError(null); }}
              onKeyDown={handleNameKeyDown}
              placeholder="Category name"
              disabled={creating}
              aria-invalid={createError !== null}
              aria-describedby={createError !== null ? errorId : undefined}
              ref={nameRef}
              className="flex-1 min-w-0 h-8 bg-transparent border-0 outline-none text-sm font-semibold text-primary placeholder:text-tertiary"
            />
            <button
              type="button"
              onClick={() => { void submitNew(); }}
              disabled={creating}
              className="h-8 px-3 shrink-0 rounded-full bg-accent text-on-accent text-sm font-bold hover:bg-accent-hover transition-colors focus-primary disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={closeAdd}
              disabled={creating}
              aria-label="Cancel new category"
              title="Cancel"
              className="w-8 h-8 shrink-0 grid place-items-center rounded-full text-tertiary hover:bg-muted focus-interactive"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          {createError !== null && (
            <p id={errorId} role="alert" className="text-xs font-medium text-danger">{createError}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryChips;

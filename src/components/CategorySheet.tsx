import type { FC, MouseEvent } from 'react';
import { useActionState, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { findPresetColor, PRESET_COLORS, swatchTextColor } from '../constants/colors';
import type { CategorySheetMode } from '../hooks/useCategorySheet';
import { useModalFocus } from '../hooks/useModalFocus';
import { cn, formatCount, toError } from '../utils';

export interface CategorySheetProps {
  mode: CategorySheetMode;
  /** False while the sheet plays its exit: it no longer takes input */
  open: boolean;
  /** Another dialog is on top (the delete confirmation): the sheet is inert and lets go of the keyboard until it closes */
  paused?: boolean;
  /** Edit mode: a deletion of the Category runs. The sheet is frozen until it ends, as during its own create or save */
  deleting?: boolean;
  name: string;
  color: string;
  /** Edit mode: how many Prompts are in the Category */
  promptCount?: number;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  /** Creates or saves the Category; rejects with the reason to show when it is refused */
  onSubmit: () => Promise<void>;
  /** Edit mode: deletes the Category */
  onDelete?: () => void;
  /** Closes without saving (Escape, the backdrop, the close button, Cancel); not called while a create or save runs */
  onClose: () => void;
}

/** A refusal, shown under the name until the name changes */
interface Refusal {
  name: string;
  message: string;
}

const CloseIcon = (
  <svg viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** The first character of the name as one sees it (a whole emoji, flag or accented letter), or ? while the name is empty */
const initialOf = (name: string): string => {
  const [first] = graphemes.segment(name.trim());
  return first ? first.segment.toUpperCase() : '?';
};

/**
 * The bottom sheet that creates a Category (2b of the Atelier 1C design) or edits one (2c): a name,
 * one of the 12 Category colors and a live preview of both. It rises from the bottom over a
 * backdrop, keeps the keyboard while it is open, and gives it back to what opened it on close.
 */
const CategorySheet: FC<CategorySheetProps> = ({
  mode,
  open,
  paused = false,
  deleting = false,
  name,
  color,
  promptCount = 0,
  onNameChange,
  onColorChange,
  onSubmit,
  onDelete,
  onClose
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const isEdit = mode === 'edit';
  const title = isEdit ? 'Edit category' : 'New category';
  const subtitle = isEdit
    ? (promptCount > 0 ? `Used by ${formatCount(promptCount, 'prompt', 'prompts')}` : 'Not used yet')
    : 'Add prompts to it from the editor.';
  const blank = name.trim() === '';
  // A custom color (from before the sheet, or a Backup) is kept, with no swatch chosen
  const selectedPreset = findPresetColor(color)?.value;

  // The action reads these when it runs, which can be after a later render (actions queue up)
  const latestRef = useRef({ name, blank, open, deleting, onSubmit });
  useEffect(() => {
    latestRef.current = { name, blank, open, deleting, onSubmit };
  }, [name, blank, open, deleting, onSubmit]);

  const [refusal, submitAction, isPending] = useActionState(
    async (previous: Refusal | null): Promise<Refusal | null> => {
      const latest = latestRef.current;
      // An empty name does nothing, nor does a submit once the sheet is closing or its Category going
      if (latest.blank || !latest.open || latest.deleting) {return previous;}
      try {
        await latest.onSubmit();
        return null;
      } catch (err) {
        return { name: latest.name, message: toError(err).message || 'Failed to save category' };
      }
    },
    null
  );
  const shownRefusal = refusal?.name === name ? refusal.message : null;
  // A create, save or deletion runs: it holds the draft, so the sheet is frozen until it ends
  const busy = isPending || deleting;

  // While one runs, closing would look like cancelling it: the sheet waits for it to end
  const dismiss = () => {
    if (!busy) {
      onClose();
    }
  };

  // Nor does a deletion start alongside a save: whichever ended first would close the sheet
  const handleDelete = () => {
    if (!busy) {
      onDelete?.();
    }
  };

  // Focus in the name on open, Tab kept inside, Escape closes, focus back to the opener on close
  useModalFocus({ isOpen: open && !paused, onClose: dismiss, containerRef: panelRef, initialFocusRef: inputRef });

  const handlePrimaryClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (blank || busy) {
      event.preventDefault();
    }
  };

  return createPortal(
    // Inert while it leaves, and while the delete confirmation is on top: one modal dialog at a time
    <div className={cn('fixed inset-0 z-40', !open && 'pointer-events-none')} inert={!open || paused}>
      <div
        aria-hidden="true"
        data-testid="category-sheet-backdrop"
        className={cn('absolute inset-0 bg-backdrop', open ? 'animate-backdrop-in' : 'animate-backdrop-out')}
        onClick={dismiss}
      />
      <div
        // useModalFocus pauses a dialog still in the document (beneath a confirmation). Leaving, the sheet
        // stays in it for its exit, yet is closed: without the ref, the focus goes back to the opener at once
        ref={open ? panelRef : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'absolute inset-x-0 bottom-0 flex flex-col gap-4 px-[18px] pt-[9px] pb-[18px] rounded-t-3xl bg-card shadow-2xl focus:outline-none',
          open ? 'animate-category-sheet-in' : 'animate-category-sheet-out'
        )}
      >
        {/* Handle: decoration only */}
        <span aria-hidden="true" className="mx-auto h-[5px] w-10 flex-none rounded-full bg-current text-faint" />

        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            data-testid="category-sheet-preview"
            className="grid size-[52px] flex-none place-items-center rounded-2xl text-lg font-extrabold shadow-md transition-colors duration-300"
            style={{ backgroundColor: color, color: swatchTextColor(color) }}
          >
            {initialOf(name)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="text-lg font-extrabold leading-tight tracking-tight text-primary">{title}</h2>
            <p className="text-xs text-tertiary">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            title="Close (Esc)"
            className="grid size-[34px] flex-none place-items-center rounded-full border border-default bg-card text-secondary hover:bg-muted transition-colors focus-interactive active:scale-90"
          >
            {CloseIcon}
          </button>
        </div>

        <form action={submitAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <input
              ref={inputRef}
              name="name"
              value={name}
              onChange={(event) => { onNameChange(event.target.value); }}
              // The create, save or deletion that runs holds the draft: an edit now would show, then be lost
              readOnly={busy}
              aria-label="Category name"
              placeholder="Category name"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={shownRefusal ? true : undefined}
              aria-describedby={shownRefusal ? errorId : undefined}
              className={cn(
                'h-12 w-full rounded-xl border bg-subtle px-4 text-[15px] font-semibold text-primary placeholder:text-tertiary placeholder:font-normal focus-input',
                shownRefusal ? 'border-error' : 'border-input'
              )}
            />
            {shownRefusal && (
              <p id={errorId} role="alert" className="text-xs font-medium text-danger">
                {shownRefusal}
              </p>
            )}
          </div>

          <div className="grid grid-cols-6 justify-items-center gap-x-2 gap-y-3">
            {PRESET_COLORS.map(preset => {
              const selected = selectedPreset === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  aria-label={preset.name}
                  aria-pressed={selected}
                  aria-disabled={busy ? true : undefined}
                  title={preset.name}
                  onClick={() => {
                    if (!busy) {
                      onColorChange(preset.value);
                    }
                  }}
                  className="swatch-spring size-8 rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-accent"
                  style={{
                    backgroundColor: preset.value,
                    transform: selected ? 'scale(1.12)' : 'none',
                    boxShadow: selected ? `0 0 0 2px var(--background-color-card), 0 0 0 4px ${preset.value}` : 'none'
                  }}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {isEdit && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                aria-disabled={busy ? true : undefined}
                className="h-10 px-2 rounded-lg text-sm font-bold text-danger hover:bg-danger-subtle transition-colors focus-danger"
              >
                Delete
              </button>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={dismiss}
              className="h-11 px-[18px] rounded-full border border-strong bg-card text-sm font-bold text-secondary hover:bg-muted transition-colors focus-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              aria-disabled={blank || busy ? true : undefined}
              onClick={handlePrimaryClick}
              className={cn(
                'h-11 px-[22px] rounded-full bg-accent text-sm font-bold text-on-accent shadow-sm transition-[opacity,scale] duration-200 focus-primary',
                blank ? 'opacity-45 cursor-default' : 'hover:bg-accent-hover active:scale-95'
              )}
            >
              {isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CategorySheet;

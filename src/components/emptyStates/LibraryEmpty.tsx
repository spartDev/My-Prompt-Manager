import type { FC, Ref } from 'react';

import EmptyState, { EMPTY_PRIMARY_BUTTON, EMPTY_SECONDARY_BUTTON } from './EmptyState';

export interface LibraryEmptyProps {
  /** Opens the editor on a new Prompt */
  onWriteFirstPrompt: () => void;
  /** Opens Settings on its Backup import; the button is left out when the Library cannot offer it */
  onImportBackup?: () => void;
  /** The main action: it takes the keyboard when the last Prompt is deleted from the editor */
  primaryButtonRef?: Ref<HTMLButtonElement>;
}

const PlusIcon = (
  <svg className="size-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const GHOST_CARD = 'absolute w-[150px] h-[92px] rounded-[18px] border-[1.5px] border-dashed border-ghost';
/** A line of the Prompt card: the color of a card's border, as a fill */
const LINE = 'h-[7px] rounded-full bg-(--border-color-default)';

/**
 * The illustration of the empty Library: two ghost cards behind a Prompt card that floats, with a
 * Variable in its text, and a + badge.
 */
const LibraryIllustration: FC = () => (
  <div className="relative w-[236px] h-32">
    <div className={`${GHOST_CARD} left-2 top-[22px] -rotate-8`} />
    <div className={`${GHOST_CARD} right-2 top-[18px] rotate-7`} />
    <div className="absolute left-1/2 top-1.5 w-[172px] -ml-[86px] animate-float">
      <div className="flex flex-col gap-[9px] p-3.5 rounded-[20px] bg-card shadow-xl text-left text-primary animate-card-rise">
        <span className="w-[62%] h-[9px] rounded-full bg-current" />
        <span className={`${LINE} w-full`} />
        <span className="flex items-center gap-1.5">
          <span className={`${LINE} w-[34%]`} />
          <span className="inline-flex h-5 items-center px-2 rounded-full border-[1.5px] border-dashed border-accent bg-accent-subtle text-accent-strong text-[10.5px] font-bold">
            {'{{name}}'}
          </span>
        </span>
        <span className={`${LINE} w-[48%]`} />
      </div>
    </div>
    <span className="absolute right-[26px] top-0 grid size-[30px] place-items-center rounded-full bg-accent text-on-accent shadow-lg animate-badge-pop">
      {PlusIcon}
    </span>
  </div>
);

/**
 * The Library with no Prompt (Atelier 1C 5a): write the first one, or restore a Backup. It leaves as
 * soon as a Prompt exists.
 */
const LibraryEmpty: FC<LibraryEmptyProps> = ({ onWriteFirstPrompt, onImportBackup, primaryButtonRef }) => (
  <EmptyState
    data-testid="library-empty"
    illustration={<LibraryIllustration />}
    title="Your library is empty"
    description="Save the prompts you keep retyping. Add variables for the parts that change, and fill them in when you insert one."
  >
    <div className="flex w-full flex-col items-center gap-2">
      <button ref={primaryButtonRef} type="button" onClick={onWriteFirstPrompt} className={EMPTY_PRIMARY_BUTTON}>
        Write your first prompt
      </button>
      {onImportBackup && (
        <button type="button" onClick={onImportBackup} className={EMPTY_SECONDARY_BUTTON}>
          Import a backup
        </button>
      )}
    </div>
  </EmptyState>
);

export default LibraryEmpty;

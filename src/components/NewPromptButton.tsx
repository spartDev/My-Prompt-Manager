import type { FC } from 'react';

export interface NewPromptButtonProps {
  /** Opens the editor on a new Prompt */
  onClick: () => void;
  disabled?: boolean;
}

/**
 * The main action of the Library: a round accent button, as high as the search pill it ends the
 * row of. It lives there, not in the Section header, where it sat against the close button of the
 * side panel and left the title no room.
 */
const NewPromptButton: FC<NewPromptButtonProps> = ({ onClick, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="size-11 flex-none grid place-items-center rounded-full text-on-accent bg-accent hover:bg-accent-hover shadow-sm transition-colors focus-primary disabled:opacity-50 disabled:cursor-not-allowed"
    title="Add new prompt"
    aria-label="Add new prompt"
    data-testid="new-prompt-button"
  >
    <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14m7-7H5" />
    </svg>
  </button>
);

export default NewPromptButton;

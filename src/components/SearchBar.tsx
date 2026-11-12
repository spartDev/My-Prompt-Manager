import type { FC, KeyboardEvent } from 'react';
import { memo, useRef } from 'react';

import type { SearchBarProps } from '../types/components';
import { isApplePlatform } from '../utils/modifierKey';

/**
 * The search field of the Library (Atelier 1C): a pill holding a magnifier, the field, and either
 * the badge of its shortcut (empty) or a round button that clears it (filled). Focus shows as an
 * accent border and a halo around the pill, which stand for the outline of the field.
 *
 * Presentation only: it knows nothing of the search, and the shortcut itself is handled by the app.
 * Escape clears a filled field and keeps the keyboard in it; in an empty field it lets go of the
 * keyboard, and is left to the browser, which closes the popup.
 */
const SearchBar: FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search your prompts',
  inputRef
}) => {
  const ownRef = useRef<HTMLInputElement>(null);
  const fieldRef = inputRef ?? ownRef;
  const apple = isApplePlatform();
  const filled = value !== '';

  const handleClear = () => {
    onClear();
    fieldRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') { return; }
    if (filled) {
      event.preventDefault();
      event.stopPropagation();
      onClear();
    } else {
      event.currentTarget.blur();
    }
  };

  return (
    <div
      data-testid="search-bar"
      className="flex items-center gap-2.5 h-11 pl-3.5 pr-2 rounded-full bg-card border-[1.5px] border-default shadow-xs transition-search has-[input:focus]:border-focus has-[input:focus]:shadow-search-focus"
    >
      <svg
        className="h-[17px] w-[17px] flex-none text-tertiary"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.2-4.2" />
      </svg>

      <input
        ref={fieldRef}
        type="search"
        value={value}
        onChange={(event) => { onChange(event.target.value); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 min-w-0 h-full p-0 bg-transparent border-0 outline-none text-[14.5px] text-primary placeholder:text-tertiary"
        aria-label="Search prompts"
        aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
      />

      {filled ? (
        <button
          type="button"
          onClick={handleClear}
          className="h-7 w-7 flex-none grid place-items-center rounded-full bg-accent-subtle text-accent hover:bg-accent-selected transition-colors animate-clear-pop focus-interactive"
          aria-label="Clear search"
          title="Clear search"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.8}
            strokeLinecap="round"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : (
        <span
          data-testid="search-shortcut"
          className="h-6 px-2 flex-none inline-flex items-center rounded-full bg-subtle text-tertiary text-[11.5px] font-semibold"
          aria-hidden="true"
        >
          {apple ? '⌘K' : 'Ctrl K'}
        </span>
      )}
    </div>
  );
};

export default memo(SearchBar);

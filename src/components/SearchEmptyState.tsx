import type { FC } from 'react';

import type { SearchEmptyStateProps } from '../types/components';

/**
 * What the Library shows when a search finds nothing: the search, and Create it, which opens the
 * editor on a new Prompt titled with it. Under a Library filter other than All it also says where
 * the search looked, and offers to search the whole Library.
 */
const SearchEmptyState: FC<SearchEmptyStateProps> = ({ query, onCreate, filterLabel, onSearchAll }) => (
  <div
    role="region"
    aria-label="No search results"
    className="flex flex-col items-center gap-2.5 px-[18px] py-[26px] rounded-[18px] border-[1.5px] border-dashed border-strong text-center animate-empty-rise"
  >
    <h2 className="max-w-full text-sm font-bold text-primary break-words">Nothing called “{query}” yet</h2>
    {filterLabel !== undefined && (
      <p className="text-sm text-secondary">Nothing in {filterLabel} matches your search.</p>
    )}
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={onCreate}
        className="h-[34px] px-3.5 rounded-full bg-accent text-on-accent text-[13px] font-bold hover:bg-accent-hover transition-colors focus-primary"
      >
        Create it
      </button>
      {onSearchAll && (
        <button
          type="button"
          onClick={onSearchAll}
          className="h-[34px] px-3.5 rounded-full bg-accent-subtle text-accent text-[13px] font-bold hover:bg-accent-selected transition-colors focus-interactive"
        >
          Search all prompts
        </button>
      )}
    </div>
  </div>
);

export default SearchEmptyState;

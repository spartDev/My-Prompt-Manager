import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_SETTINGS } from '../constants';
// PROTOTYPE: placements of the New button, see src/prototype
import { NewAsFirstRow, NewBesideSearch, NewFloating, useNewButtonVariant } from '../prototype/newButtonPlacement.prototype';
import {
  ALL_PROMPTS,
  applyLibraryFilter,
  getFilterableCategories,
  resolveLibraryFilter
} from '../services/libraryFilter';
import { StorageManager } from '../services/storage';
import { MOTION } from '../theme/motion';
import type { Prompt, Settings, SortOrder } from '../types';
import type { LibraryViewProps } from '../types/components';
import { Logger, toError } from '../utils';
import { cn } from '../utils/cn';
import { isLibraryEmpty } from '../utils/emptyStates';

import LibraryEmpty from './emptyStates/LibraryEmpty';
import { CheckIcon, StarIcon, UsageIcon } from './icons/UIIcons';
import LibraryFilterBar, { reviewFilterLabel } from './LibraryFilterBar';
import PromptCard from './PromptCard';
import SearchBar from './SearchBar';
import SearchEmptyState from './SearchEmptyState';
import ViewHeader from './ViewHeader';

const LibraryView: FC<LibraryViewProps> = ({
  prompts,
  categories,
  searchWithDebounce,
  libraryFilter,
  onAddNew,
  onImportBackup,
  onCreateFromSearch,
  focusSearch,
  onSearchFocused,
  onEditPrompt,
  onTogglePin,
  onCopyPrompt,
  showToast,
  onLibraryFilterChange,
  focusLibraryFilter,
  onLibraryFilterFocused,
  loading,
  context = 'popup'
}) => {
  const { query, debouncedQuery, filteredPrompts, isSearching } = searchWithDebounce;
  const newVariant = useNewButtonVariant();
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SETTINGS.sortOrder);
  // "Show all prompts" leaves with its empty state, so focus goes to the All pill
  const [focusAll, setFocusAll] = useState(false);
  const handleFilterFocused = useCallback(() => {
    setFocusAll(false);
    onLibraryFilterFocused?.();
  }, [onLibraryFilterFocused]);

  // With no Prompt there is nothing to search, filter or list: the empty state takes the whole Section
  const libraryEmpty = !loading && isLibraryEmpty(prompts);

  // The search and the Library filter go out of sight with the last Prompt, so they go back to
  // nothing and All: the next Prompt must not be hidden by a search or a filter nobody can see
  const { clearSearch } = searchWithDebounce;
  useEffect(() => {
    if (!libraryEmpty) { return; }
    if (query !== '') { clearSearch(); }
    if (libraryFilter.kind !== 'all') { onLibraryFilterChange(ALL_PROMPTS); }
  }, [libraryEmpty, query, clearSearch, libraryFilter, onLibraryFilterChange]);

  // The Library filter takes the keyboard when the Prompt that had it is gone. With the last Prompt
  // there is no filter left: the main action of the empty state takes it instead
  const writeFirstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (libraryEmpty && focusLibraryFilter) {
      writeFirstRef.current?.focus();
      onLibraryFilterFocused?.();
    }
  }, [libraryEmpty, focusLibraryFilter, onLibraryFilterFocused]);

  // The search shortcut moves the keyboard into the field, also when it has just brought the Library
  // back. An empty Library has no field: the shortcut then only brings the Library back
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusSearch) {
      searchRef.current?.focus();
      onSearchFocused?.();
    }
  }, [focusSearch, onSearchFocused]);

  // The sort is chosen in Settings. Read it once, then follow every later save: a save can
  // land after this view has mounted (or come from the other context)
  useEffect(() => {
    let savedSinceMount = false;
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && 'settings' in changes) {
        const newSettings = changes.settings.newValue as Partial<Settings> | undefined;
        if (newSettings?.sortOrder) {
          savedSinceMount = true;
          setSortOrder(newSettings.sortOrder);
        }
      }
    };
    // chrome.storage.onChanged may not be available in all contexts (see useTheme)
    const onChangedApi = typeof chrome !== 'undefined' ? chrome.storage.onChanged : undefined;
    onChangedApi?.addListener(handleStorageChange);

    const loadSortOrder = async () => {
      try {
        const settings = await StorageManager.getInstance().getSettings();
        // A save seen meanwhile is newer than this first read
        if (!savedSinceMount) {
          setSortOrder(settings.sortOrder);
        }
      } catch (error) {
        Logger.error('Failed to load sort settings', toError(error), { component: 'LibraryView' });
      }
    };
    void loadSortOrder();

    return () => { onChangedApi?.removeListener(handleStorageChange); };
  }, []);

  // Pills are offered from the whole Library, so a search never hides one
  const filterableCategories = useMemo(
    () => getFilterableCategories(categories, prompts),
    [categories, prompts]
  );
  const activeFilter = useMemo(
    () => resolveLibraryFilter(libraryFilter, filterableCategories),
    [libraryFilter, filterableCategories]
  );

  // Return to All once the chosen Category is gone or holds no Prompt
  useEffect(() => {
    if (!loading && activeFilter !== libraryFilter) {
      onLibraryFilterChange(ALL_PROMPTS);
    }
  }, [loading, activeFilter, libraryFilter, onLibraryFilterChange]);

  // A search looks only inside the active Library filter
  const finalFilteredPrompts = useMemo(
    () => applyLibraryFilter(filteredPrompts, activeFilter, categories, sortOrder, prompts),
    [filteredPrompts, activeFilter, categories, sortOrder, prompts]
  );

  const activeFilterLabel = activeFilter.kind === 'category'
    ? categories.find(category => category.id === activeFilter.categoryId)?.name ?? ''
    : reviewFilterLabel(activeFilter) ?? (activeFilter.kind === 'pinned' ? 'Pinned' : 'Most Used');
  const searchedFor = debouncedQuery.trim();
  const isSearchActive = searchedFor !== '';
  const resultCount = finalFilteredPrompts.length;
  const resultsLabel = resultCount === 0 ? 'No results' : `${String(resultCount)} result${resultCount !== 1 ? 's' : ''}`;

  // The cards rise again when the Library filter or the Prompts listed change, not at a keystroke
  // that lists the same ones, nor when a pin only reorders them
  const listedKey = [
    activeFilter.kind,
    activeFilter.kind === 'category' ? activeFilter.categoryId : '',
    ...finalFilteredPrompts.map(prompt => prompt.id).sort()
  ].join('|');
  const [rise, setRise] = useState({ listed: listedKey, again: false });
  if (rise.listed !== listedKey) {
    setRise({ listed: listedKey, again: !rise.again });
  }
  const riseClass = rise.again ? 'animate-list-rise-again' : 'animate-list-rise';

  const totalLabel = `${String(prompts.length)} prompt${prompts.length !== 1 ? 's' : ''}`;
  const countLabel = finalFilteredPrompts.length === prompts.length
    ? totalLabel
    : `${String(finalFilteredPrompts.length)} of ${totalLabel}`;

  return (
    <div className="h-full flex flex-col bg-app relative">
      {/* Header with Search and Filter */}
      <ViewHeader
        icon="logo"
        title="My Prompt Manager"
        subtitle={loading ? undefined : countLabel}
        // While a search runs, the number of results is the one announcement (the status below)
        subtitleLive={!isSearchActive}
        context={context}
      >
        <ViewHeader.Actions>
          {newVariant === 'A' && <ViewHeader.NewButton onClick={onAddNew} disabled={loading} />}
          {context === 'sidepanel' && (
            <ViewHeader.CloseButton onClick={() => { window.close(); }} context="sidepanel" />
          )}
        </ViewHeader.Actions>
        {/* Search and Filter */}
        {!libraryEmpty && (
        <div className="space-y-4 pb-6" role="search" aria-label="Search and filter prompts">
          {/* The header pads its content by 24px; the pill keeps 16px on each side */}
          <div className="-mx-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
            <SearchBar
              value={query}
              onChange={searchWithDebounce.setQuery}
              onClear={searchWithDebounce.clearSearch}
              inputRef={searchRef}
            />
            </div>
            {newVariant === 'B' && <NewBesideSearch onClick={onAddNew} disabled={loading} />}
          </div>

          <LibraryFilterBar
            categories={filterableCategories}
            activeFilter={activeFilter}
            onChange={onLibraryFilterChange}
            disabled={loading}
            focusActive={focusLibraryFilter === true || focusAll}
            onFocusActiveDone={handleFilterFocused}
          />
        </div>
        )}
      </ViewHeader>

      {/* Content */}
      <main className="flex-1 overflow-auto custom-scrollbar" data-scroll-container aria-label="My Prompt Manager content">
        {/* The one announcement of a search: the number found. It is in the document before any search,
            empty, since a screen reader says what changes in a status it already knows */}
        {!loading && (
          <p role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="search-status">
            {isSearchActive ? resultsLabel : ''}
          </p>
        )}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4" role="status" aria-live="polite">
            <div className="w-8 h-8 border-4 border-current/30 border-t-current text-accent rounded-full animate-spin" aria-hidden="true"></div>
            <div className="text-secondary font-medium">Loading your prompts...</div>
          </div>
        ) : libraryEmpty ? (
          <LibraryEmpty onWriteFirstPrompt={onAddNew} onImportBackup={onImportBackup} primaryButtonRef={writeFirstRef} />
        ) : resultCount === 0 && !isSearchActive ? (
          <div className="flex items-center justify-center h-full">
            {!isSearchActive && activeFilter.kind === 'pinned' ? (
              <div className="max-w-sm mx-auto text-center px-6" role="region" aria-label="No pinned prompts">
                <div className="w-14 h-14 bg-accent-subtle rounded-full flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                  <StarIcon className="w-7 h-7 text-accent" />
                </div>
                <h2 className="text-base font-semibold text-primary mb-1">No pinned prompts yet</h2>
                <p className="text-secondary text-sm">Pin a prompt with its star to keep it here.</p>
              </div>
            ) : !isSearchActive && reviewFilterLabel(activeFilter) ? (
              <div className="max-w-sm mx-auto text-center px-6" role="region" aria-label={`No ${activeFilterLabel} prompts`}>
                <div className="w-14 h-14 bg-accent-subtle rounded-full flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                  <CheckIcon className="w-7 h-7 text-accent" />
                </div>
                <h2 className="text-base font-semibold text-primary mb-1">Nothing left in {activeFilterLabel}</h2>
                <p className="text-secondary text-sm mb-4">Every Prompt here has been tidied up.</p>
                <button
                  type="button"
                  onClick={() => {
                    setFocusAll(true);
                    onLibraryFilterChange(ALL_PROMPTS);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-accent bg-accent-subtle border border-accent rounded-lg hover:bg-accent-selected transition-colors focus-interactive"
                >
                  Show all prompts
                </button>
              </div>
            ) : !isSearchActive && activeFilter.kind === 'mostUsed' ? (
              <div className="max-w-sm mx-auto text-center px-6" role="region" aria-label="No used prompts">
                <div className="w-14 h-14 bg-accent-subtle rounded-full flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                  <UsageIcon className="w-7 h-7 text-accent" />
                </div>
                <h2 className="text-base font-semibold text-primary mb-1">No prompts used yet</h2>
                <p className="text-secondary text-sm">Prompts you insert into an AI chat appear here, most used first.</p>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {isSearchActive && (
              <div className="flex items-baseline justify-between gap-3 px-[18px] pt-4 pb-2" data-testid="list-header">
                <h2 className="min-w-0 truncate text-[13px] font-bold text-secondary">
                  {activeFilter.kind === 'all' ? 'Results' : activeFilterLabel}
                </h2>
                {/* Said, with its unit, by the status above */}
                <span className="flex-none text-xs text-tertiary" aria-hidden="true">{String(resultCount)}</span>
              </div>
            )}
            {resultCount === 0 ? (
              <div className="px-4 pb-3">
                <SearchEmptyState
                  query={searchedFor}
                  // The field already shows another search, not looked up yet: this one is no longer the one to create
                  createDisabled={isSearching}
                  onCreate={() => {
                    onCreateFromSearch(searchedFor, activeFilter.kind === 'category' ? activeFilterLabel : undefined);
                  }}
                  filterLabel={activeFilter.kind === 'all' ? undefined : activeFilterLabel}
                  onSearchAll={activeFilter.kind === 'all' ? undefined : () => {
                    // The button leaves with the filter: the keyboard goes to the All pill
                    setFocusAll(true);
                    onLibraryFilterChange(ALL_PROMPTS);
                  }}
                />
              </div>
            ) : (
              <div
                className={cn('grid grid-cols-1 gap-3 px-4 pb-3', !isSearchActive && 'pt-3', newVariant === 'C' && 'pb-20')}
                role="list"
                aria-label={`${String(resultCount)} prompt${resultCount !== 1 ? 's' : ''} found`}
              >
                {newVariant === 'E' && !isSearchActive && (
                  <div role="listitem"><NewAsFirstRow onClick={onAddNew} /></div>
                )}
                {finalFilteredPrompts.map((prompt: Prompt, index) => (
                  <div
                    key={prompt.id}
                    className={cn('min-w-0', riseClass)}
                    style={{ animationDelay: `${String(Math.min(index, MOTION.listStaggerSteps) * MOTION.listStagger)}ms` }}
                  >
                    <PromptCard
                      prompt={prompt}
                      categories={categories}
                      onEdit={onEditPrompt}
                      onTogglePin={onTogglePin}
                      onCopy={onCopyPrompt}
                      showToast={showToast}
                      searchQuery={debouncedQuery}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      {newVariant === 'C' && !libraryEmpty && <NewFloating onClick={onAddNew} disabled={loading} />}
    </div>
  );
};

export default LibraryView;
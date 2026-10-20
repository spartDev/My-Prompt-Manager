import { useMemo, useEffect, useState } from 'react';
import type { FC } from 'react';

import { DEFAULT_SETTINGS } from '../constants';
import {
  ALL_PROMPTS,
  applyLibraryFilter,
  getFilterableCategories,
  resolveLibraryFilter
} from '../services/libraryFilter';
import { StorageManager } from '../services/storage';
import type { Prompt, Settings, SortOrder } from '../types';
import type { LibraryViewProps } from '../types/components';
import { Logger, toError } from '../utils';

import { StarIcon, UsageIcon } from './icons/UIIcons';
import LibraryFilterBar from './LibraryFilterBar';
import PromptCard from './PromptCard';
import SearchBar from './SearchBar';
import ViewHeader from './ViewHeader';

const LibraryView: FC<LibraryViewProps> = ({
  prompts,
  categories,
  searchWithDebounce,
  libraryFilter,
  onAddNew,
  onEditPrompt,
  onTogglePin,
  onCopyPrompt,
  showToast,
  onLibraryFilterChange,
  loading,
  context = 'popup'
}) => {
  const { query, debouncedQuery, filteredPrompts, isSearching } = searchWithDebounce;
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SETTINGS.sortOrder);

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
    () => applyLibraryFilter(filteredPrompts, activeFilter, categories, sortOrder),
    [filteredPrompts, activeFilter, categories, sortOrder]
  );

  const activeFilterLabel = activeFilter.kind === 'category'
    ? categories.find(category => category.id === activeFilter.categoryId)?.name ?? ''
    : activeFilter.kind === 'pinned' ? 'Pinned' : 'Most Used';
  const isSearchActive = debouncedQuery.trim() !== '';

  const totalLabel = `${String(prompts.length)} prompt${prompts.length !== 1 ? 's' : ''}`;
  const countLabel = finalFilteredPrompts.length === prompts.length
    ? totalLabel
    : `${String(finalFilteredPrompts.length)} of ${totalLabel}`;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with Search and Filter */}
      <ViewHeader
        icon="logo"
        title="My Prompt Manager"
        subtitle={loading ? undefined : countLabel}
        subtitleLive
        context={context}
      >
        <ViewHeader.Actions>
          <ViewHeader.NewButton onClick={onAddNew} disabled={loading} />
          {context === 'sidepanel' && (
            <ViewHeader.CloseButton onClick={() => { window.close(); }} context="sidepanel" />
          )}
        </ViewHeader.Actions>
        {/* Search and Filter */}
        <div className="space-y-4 pb-6" role="search" aria-label="Search and filter prompts">
          <div className="relative">
            <SearchBar
              value={query}
              onChange={searchWithDebounce.setQuery}
              onClear={searchWithDebounce.clearSearch}
              placeholder="Search your prompts..."
            />
            {isSearching && (
              <div className="absolute top-1/2 right-12 transform -translate-y-1/2 z-10">
                <div className="w-4 h-4 border-2 border-purple-200 dark:border-purple-800 border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin" aria-hidden="true"></div>
              </div>
            )}
          </div>

          <LibraryFilterBar
            categories={filterableCategories}
            activeFilter={activeFilter}
            onChange={onLibraryFilterChange}
            disabled={loading}
          />
        </div>
      </ViewHeader>

      {/* Content */}
      <main className="flex-1 overflow-auto custom-scrollbar" data-scroll-container aria-label="My Prompt Manager content">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4" role="status" aria-live="polite">
            <div className="w-8 h-8 border-4 border-purple-200 dark:border-purple-800 border-t-purple-500 dark:border-t-purple-400 rounded-full animate-spin" aria-hidden="true"></div>
            <div className="text-gray-600 dark:text-gray-400 font-medium">Loading your prompts...</div>
          </div>
        ) : finalFilteredPrompts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            {(prompts).length === 0 ? (
              <div className="max-w-md mx-auto text-center px-6" role="region" aria-label="Empty state">
                <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4" role="img" aria-label="Empty library illustration">
                  <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">You&apos;re ready to go</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm leading-relaxed">Create your first prompt to start building your personal collection of reusable content.</p>
                <button
                  onClick={onAddNew}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl focus-primary"
                  aria-label="Create your first prompt"
                >
                  Create First Prompt
                </button>
              </div>
            ) : !isSearchActive && activeFilter.kind === 'pinned' ? (
              <div className="max-w-sm mx-auto text-center px-6" role="region" aria-label="No pinned prompts">
                <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                  <StarIcon className="w-7 h-7 text-purple-500 dark:text-purple-300" />
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No pinned prompts yet</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Pin a prompt with its star to keep it here.</p>
              </div>
            ) : !isSearchActive && activeFilter.kind === 'mostUsed' ? (
              <div className="max-w-sm mx-auto text-center px-6" role="region" aria-label="No used prompts">
                <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                  <UsageIcon className="w-7 h-7 text-purple-500 dark:text-purple-300" />
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No prompts used yet</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Prompts you insert into an AI chat appear here, most used first.</p>
              </div>
            ) : (
              <div className="max-w-sm mx-auto text-center px-6" role="region" aria-label="No search results">
                <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3" role="img" aria-label="No results illustration">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No matches found</h2>
                {activeFilter.kind === 'all' ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Try a different search</p>
                ) : (
                  <>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Nothing in {activeFilterLabel} matches your search.</p>
                    <button
                      type="button"
                      onClick={() => { onLibraryFilterChange(ALL_PROMPTS); }}
                      className="px-4 py-2 text-sm font-semibold text-purple-700 dark:text-purple-200 bg-purple-100 dark:bg-purple-900/60 border border-purple-300 dark:border-purple-500 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900 transition-colors focus-interactive"
                    >
                      Search all prompts
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 px-4 py-3" role="list" aria-label={`${String(finalFilteredPrompts.length)} prompt${finalFilteredPrompts.length !== 1 ? 's' : ''} found`}>
            {finalFilteredPrompts.map((prompt: Prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                categories={categories}
                onEdit={onEditPrompt}
                onTogglePin={onTogglePin}
                onCopy={onCopyPrompt}
                showToast={showToast}
                searchQuery={debouncedQuery}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default LibraryView;
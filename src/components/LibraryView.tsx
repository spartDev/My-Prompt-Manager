import { useMemo } from 'react';
import type { FC } from 'react';

import { Prompt } from '../types';
import { LibraryViewProps } from '../types/components';

import FilterSortControls from './FilterSortControls';
import PromptCard from './PromptCard';
import SearchBar from './SearchBar';
import ViewHeader from './ViewHeader';

const LibraryView: FC<LibraryViewProps> = ({
  prompts,
  categories,
  searchWithDebounce,
  selectedCategory,
  sortOrder,
  sortDirection,
  onAddNew,
  onEditPrompt,
  onDeletePrompt,
  onCopyPrompt,
  showToast,
  onCategoryChange,
  onSortChange,
  onManageCategories,
  onSettings,
  loading,
  context = 'popup'
}) => {
  const { query, debouncedQuery, filteredPrompts, isSearching } = searchWithDebounce;

  const finalFilteredPrompts = useMemo(() => {
    // Apply category filter to search-filtered prompts
    if (selectedCategory) {
      return filteredPrompts.filter((prompt: Prompt) => prompt.category === selectedCategory);
    }
    
    return filteredPrompts;
  }, [filteredPrompts, selectedCategory]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with Search and Filter */}
      <ViewHeader
        icon="logo"
        title="My Prompt Manager"
        subtitle="Organize your creative prompts"
        context={context}
      >
        <ViewHeader.Actions>
          <ViewHeader.SettingsButton onClick={onSettings} />
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

          <FilterSortControls
            categories={categories}
            selectedCategory={selectedCategory}
            sortOrder={sortOrder}
            sortDirection={sortDirection}
            onCategoryChange={onCategoryChange}
            onSortChange={onSortChange}
            onManageCategories={onManageCategories}
            loading={loading}
          />
        </div>
      </ViewHeader>

      {/* Content */}
      <main className={`flex-1 overflow-auto custom-scrollbar ${finalFilteredPrompts.length > 0 ? 'pb-24' : ''}`} aria-label="My Prompt Manager content">
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
            ) : (
              <div className="max-w-sm mx-auto text-center px-6" role="region" aria-label="No search results">
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3" role="img" aria-label="No results illustration">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No matches found</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid" role="list" aria-label={`${String(finalFilteredPrompts.length)} prompt${finalFilteredPrompts.length !== 1 ? 's' : ''} found`}>
            {finalFilteredPrompts.map((prompt: Prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                categories={categories}
                onEdit={onEditPrompt}
                onDelete={onDeletePrompt}
                onCopy={onCopyPrompt}
                showToast={showToast}
                searchQuery={debouncedQuery}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer with stats */}
      {!loading && (prompts).length > 0 && (
        <footer className="flex-shrink-0 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400" role="contentinfo" aria-label="Library statistics">
          <span aria-live="polite" aria-atomic="true">
            {finalFilteredPrompts.length === (prompts).length ? (
              `${String((prompts).length)} prompt${(prompts).length !== 1 ? 's' : ''}`
            ) : (
              `${String(finalFilteredPrompts.length)} of ${String((prompts).length)} prompt${(prompts).length !== 1 ? 's' : ''}`
            )}
          </span>
        </footer>
      )}

      {/* Floating Add Button */}
      <button
        onClick={onAddNew}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAddNew();
          }
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-2xl hover:shadow-3xl transform hover:scale-110 z-50 flex items-center justify-center focus-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        disabled={loading}
        aria-label="Add new prompt"
        title="Add New Prompt"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};

export default LibraryView;
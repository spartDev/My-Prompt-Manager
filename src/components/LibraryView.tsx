import { useMemo } from 'react';
import type { FC } from 'react';

import { Prompt } from '../types';
import { LibraryViewProps } from '../types/components';

import CategoryFilter from './CategoryFilter';
import PromptCard from './PromptCard';
import SearchBar from './SearchBar';

const LibraryView: FC<LibraryViewProps> = ({
  prompts,
  categories,
  searchWithDebounce,
  selectedCategory,
  onAddNew,
  onEditPrompt,
  onDeletePrompt,
  onCopyPrompt,
  onCategoryChange,
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
      {/* Header */}
      <header className="flex-shrink-0 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center" role="img" aria-label="My Prompt Manager icon">
              <svg className="w-6 h-6 text-white" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path fill="currentColor" d="M5.085 8.476a.848.848 0 0 0 .641-.273.946.946 0 0 0 .259-.676.946.946 0 0 0-.259-.677.848.848 0 0 0-.641-.273.848.848 0 0 0-.641.273.946.946 0 0 0-.259.677c0 .269.086.494.259.676a.848.848 0 0 0 .641.273Zm3.983 0a.848.848 0 0 0 .64-.273.946.946 0 0 0 .26-.676.946.946 0 0 0-.26-.677.848.848 0 0 0-.64-.273.848.848 0 0 0-.642.273.946.946 0 0 0-.258.677c0 .269.086.494.258.676a.848.848 0 0 0 .642.273Zm3.825 0a.848.848 0 0 0 .64-.273.945.945 0 0 0 .26-.676.945.945 0 0 0-.26-.677.848.848 0 0 0-.64-.273.848.848 0 0 0-.642.273.945.945 0 0 0-.258.677c0 .269.086.494.258.676a.848.848 0 0 0 .642.273ZM0 17.285V1.425C0 1.06.135.732.405.439.675.146.99 0 1.35 0h15.3c.345 0 .656.146.934.44.277.292.416.62.416.985V13.77c0 .364-.139.692-.416.985-.278.293-.589.44-.934.44H3.6l-2.453 2.588c-.21.221-.453.273-.73.154-.278-.119-.417-.336-.417-.653Zm1.35-1.733 1.688-1.781H16.65V1.425H1.35v14.127Zm0-14.127V15.55 1.426Z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">My Prompt Manager</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Organize your creative prompts</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => { (onSettings as () => void)(); }}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive"
              title="Settings"
              aria-label="Open settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </button>
            {context === 'sidepanel' && (
              <button
                onClick={() => { window.close(); }}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors focus-interactive"
                title="Close side panel"
                aria-label="Close side panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4" role="search" aria-label="Search and filter prompts">
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
          
          <div className="flex items-center justify-between">
            <div role="group" aria-label="Filter by category">
              <CategoryFilter
                categories={categories}
                selectedCategory={selectedCategory}
                onChange={onCategoryChange as (category: string | null) => void}
                showAll={true}
              />
            </div>
            
            <button
              onClick={onManageCategories as () => void}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  (onManageCategories as () => void)();
                }
              }}
              className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold px-3 py-2 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors focus-interactive disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading as boolean}
              aria-label="Manage categories"
            >
              Manage Categories
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className={`flex-1 overflow-auto custom-scrollbar ${finalFilteredPrompts.length > 0 ? 'pb-24' : ''}`} aria-label="My Prompt Manager content">
        {(loading as boolean) ? (
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
                  onClick={onAddNew as () => void}
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
                onEdit={onEditPrompt as (prompt: Prompt) => void}
                onDelete={onDeletePrompt as (id: string) => void}
                onCopy={onCopyPrompt as (content: string) => void}
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
        onClick={onAddNew as () => void}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            (onAddNew as () => void)();
          }
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-2xl hover:shadow-3xl transform hover:scale-110 z-50 flex items-center justify-center focus-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        disabled={loading as boolean}
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
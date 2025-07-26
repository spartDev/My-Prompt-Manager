import React, { useMemo } from 'react';
import { LibraryViewProps } from '../types/components';
import SearchBar from './SearchBar';
import CategoryFilter from './CategoryFilter';
import PromptCard from './PromptCard';
import { useSearch } from '../hooks';

const LibraryView: React.FC<LibraryViewProps> = ({
  prompts,
  categories,
  searchQuery,
  selectedCategory,
  onAddNew,
  onEditPrompt,
  onDeletePrompt,
  onCopyPrompt,
  onSearchChange,
  onCategoryChange,
  onManageCategories,
  loading
}) => {
  const { filteredPrompts } = useSearch(prompts);

  const finalFilteredPrompts = useMemo(() => {
    let filtered = filteredPrompts;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(prompt => 
        prompt.title.toLowerCase().includes(searchTerm) ||
        prompt.content.toLowerCase().includes(searchTerm) ||
        prompt.category.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(prompt => prompt.category === selectedCategory);
    }
    
    return filtered;
  }, [filteredPrompts, searchQuery, selectedCategory]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white/80 backdrop-blur-sm border-b border-purple-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Prompt Library</h1>
              <p className="text-sm text-gray-500">Organize your creative prompts</p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="space-y-4">
          <div className="relative">
            <SearchBar
              value={searchQuery}
              onChange={onSearchChange}
              onClear={() => onSearchChange('')}
              placeholder="Search your prompts..."
            />
          </div>
          
          <div className="flex items-center justify-between">
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onChange={onCategoryChange}
              showAll={true}
            />
            
            <button
              onClick={onManageCategories}
              className="text-xs text-purple-600 hover:text-purple-700 font-semibold px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors"
              disabled={loading}
            >
              Manage Categories
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-32 space-y-4">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin"></div>
            <div className="text-gray-600 font-medium">Loading your prompts...</div>
          </div>
        ) : finalFilteredPrompts.length === 0 ? (
          <div className="text-center py-16">
            {prompts.length === 0 ? (
              <div className="max-w-sm mx-auto">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">You're ready to go ✨</h3>
                <p className="text-gray-500 mb-6 text-sm leading-relaxed">Create your first prompt to start building your personal collection of reusable content.</p>
                <button
                  onClick={onAddNew}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-105"
                >
                  Create First Prompt
                </button>
              </div>
            ) : (
              <div className="max-w-sm mx-auto">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No matches found</h3>
                <p className="text-gray-500 text-sm">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {finalFilteredPrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                onEdit={onEditPrompt}
                onDelete={onDeletePrompt}
                onCopy={onCopyPrompt}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {!loading && prompts.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 bg-gray-100 border-t border-gray-200 text-xs text-gray-600">
          {finalFilteredPrompts.length === prompts.length ? (
            `${prompts.length} prompt${prompts.length !== 1 ? 's' : ''}`
          ) : (
            `${finalFilteredPrompts.length} of ${prompts.length} prompt${prompts.length !== 1 ? 's' : ''}`
          )}
        </div>
      )}

      {/* Floating Add Button */}
      <button
        onClick={onAddNew}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full hover:from-purple-600 hover:to-indigo-700 transition-all duration-200 shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 transform hover:scale-110 z-50 flex items-center justify-center"
        disabled={loading}
        title="Add New Prompt"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
};

export default LibraryView;
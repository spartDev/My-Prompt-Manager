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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Prompt Library</h1>
          <button
            onClick={onAddNew}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            disabled={loading}
          >
            + Add Prompt
          </button>
        </div>

        {/* Search and Filter */}
        <div className="space-y-3">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            onClear={() => onSearchChange('')}
            placeholder="Search prompts..."
          />
          
          <div className="flex items-center justify-between">
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onChange={onCategoryChange}
              showAll={true}
            />
            
            <button
              onClick={onManageCategories}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              disabled={loading}
            >
              Manage Categories
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading prompts...</div>
          </div>
        ) : finalFilteredPrompts.length === 0 ? (
          <div className="text-center py-12">
            {prompts.length === 0 ? (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No prompts yet</h3>
                <p className="text-gray-500 mb-4">Create your first prompt to get started</p>
                <button
                  onClick={onAddNew}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Create First Prompt
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No matches found</h3>
                <p className="text-gray-500">Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
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
    </div>
  );
};

export default LibraryView;
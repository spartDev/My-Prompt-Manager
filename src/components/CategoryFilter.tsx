import React, { memo } from 'react';
import type { FC } from 'react';

import { Category } from '../types';
import { CategoryFilterProps } from '../types/components';

const CategoryFilter: FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onChange,
  showAll = true
}) => {
  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filter:</span>
      <div className="relative">
        <select
          value={(selectedCategory) || ''}
          onChange={(e) => { (onChange as (value: string | null) => void)(e.target.value || null); }}
          className="text-sm border border-purple-200 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 font-medium appearance-none cursor-pointer text-gray-900 dark:text-gray-100"
        >
          {showAll && <option value="">All Categories</option>}
          {(categories).map((category: Category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="w-4 h-4 text-purple-400 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

// Custom comparison function for React.memo optimization
// Re-render only when categories array content or selected category changes
const arePropsEqual = (prevProps: CategoryFilterProps, nextProps: CategoryFilterProps): boolean => {
  // Check if selected category changed
  if (prevProps.selectedCategory !== nextProps.selectedCategory) {return false;}
  
  // Check if showAll flag changed
  if (prevProps.showAll !== nextProps.showAll) {return false;}
  
  // Check categories array length
  if (prevProps.categories.length !== nextProps.categories.length) {return false;}
  
  // Deep comparison of categories array - check if any category data changed
  for (let i = 0; i < prevProps.categories.length; i++) {
    const prevCategory = prevProps.categories[i];
    const nextCategory = nextProps.categories[i];
    
    if (prevCategory.id !== nextCategory.id) {return false;}
    if (prevCategory.name !== nextCategory.name) {return false;}
    // Note: We don't need to check color here as it doesn't affect the CategoryFilter UI
  }
  
  // Function reference comparison - should be stable from parent
  if (prevProps.onChange !== nextProps.onChange) {return false;}
  
  return true;
};

export default memo(CategoryFilter, arePropsEqual);
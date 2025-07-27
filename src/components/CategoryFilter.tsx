import React from 'react';

import { CategoryFilterProps } from '../types/components';

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onChange,
  showAll = true
}) => {
  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm font-semibold text-gray-700">Filter:</span>
      <div className="relative">
        <select
          value={selectedCategory || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="text-sm border border-purple-200 rounded-lg px-4 py-2 pr-10 bg-white/60 backdrop-blur-sm focus:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-purple-500 hover:bg-white/80 transition-all duration-200 font-medium appearance-none cursor-pointer"
        >
          {showAll && <option value="">All Categories</option>}
          {categories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default CategoryFilter;
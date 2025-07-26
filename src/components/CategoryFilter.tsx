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
      <select
        value={selectedCategory || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-sm border border-purple-200 rounded-lg px-4 py-2 bg-white/60 backdrop-blur-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 hover:bg-white/80 transition-all duration-200 font-medium"
      >
        {showAll && <option value="">🌟 All Categories</option>}
        {categories.map((category) => (
          <option key={category.id} value={category.name}>
            📁 {category.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CategoryFilter;
import React from 'react';
import { CategoryFilterProps } from '../types/components';

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onChange,
  showAll = true
}) => {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700">Category:</span>
      <select
        value={selectedCategory || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="text-sm border border-gray-300 rounded px-3 py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        {showAll && <option value="">All Categories</option>}
        {categories.map((category) => (
          <option key={category.id} value={category.name}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CategoryFilter;
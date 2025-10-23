import type { FC } from 'react';
import { memo } from 'react';

import { DEFAULT_COLORS } from '../constants/ui';
import { SortOrder } from '../types';
import { FilterSortControlsProps } from '../types/components';

import { Dropdown, DropdownSeparator, DropdownItem } from './Dropdown';

// Sort option icons
const ClockIcon: FC = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon: FC = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const AlphabeticalIcon: FC = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 12h12M3 20h6" />
  </svg>
);

const SORT_OPTIONS: Array<{ value: SortOrder; label: string; icon: FC }> = [
  { value: 'updatedAt', label: 'Recently Updated', icon: ClockIcon },
  { value: 'createdAt', label: 'Recently Created', icon: CalendarIcon },
  { value: 'title', label: 'Alphabetical', icon: AlphabeticalIcon }
];

const FilterSortControls: FC<FilterSortControlsProps> = ({
  categories,
  selectedCategory,
  sortOrder,
  sortDirection,
  onCategoryChange,
  onSortChange,
  onManageCategories,
  loading = false
}) => {
  // Derived values for active state text
  const categoryLabel = selectedCategory || 'All Categories';

  const getSortLabel = (): string => {
    const option = SORT_OPTIONS.find(opt => opt.value === sortOrder);
    if (!option) {return 'A→Z';}

    if (sortOrder === 'title') {
      return sortDirection === 'asc' ? 'A→Z' : 'Z→A';
    }
    return sortDirection === 'desc' ? 'Newest' : 'Oldest';
  };

  const sortLabel = getSortLabel();

  // Handlers
  const handleCategorySelect = (category: string | null) => {
    onCategoryChange(category);
  };

  const handleSortSelect = (order: SortOrder) => {
    // If same sort order, toggle direction
    if (order === sortOrder) {
      onSortChange(order, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort order, use default direction
      const defaultDirection = order === 'title' ? 'asc' : 'desc';
      onSortChange(order, defaultDirection);
    }
  };

  // Build filter dropdown items
  const filterItems: DropdownItem[] = [
    {
      id: 'all',
      label: (
        <span className="flex items-center justify-between w-full">
          <span>All Categories</span>
          {!selectedCategory && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </span>
      ),
      onSelect: () => { handleCategorySelect(null); },
      className: !selectedCategory
        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
        : ''
    }
  ];

  // Add separator if there are categories
  if (categories.length > 0) {
    filterItems.push({
      id: 'separator',
      label: <DropdownSeparator />,
      onSelect: () => {},
      disabled: true,
      className: 'p-0 hover:bg-transparent cursor-default'
    });
  }

  // Add category items
  categories.forEach(category => {
    filterItems.push({
      id: category.id,
      label: (
        <span className="flex items-center justify-between w-full">
          <span className="flex items-center space-x-2">
            {category.color && (
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: category.color }}
                aria-hidden="true"
              />
            )}
            <span>{category.name}</span>
          </span>
          {selectedCategory === category.name && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </span>
      ),
      onSelect: () => { handleCategorySelect(category.name); },
      className: selectedCategory === category.name
        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
        : ''
    });
  });

  // Build sort dropdown items
  const sortItems: DropdownItem[] = SORT_OPTIONS.map(option => {
    const Icon = option.icon;
    const isActive = sortOrder === option.value;

    return {
      id: option.value,
      label: (
        <span className="flex items-center justify-between w-full">
          <span className="flex items-center space-x-3">
            <Icon />
            <span>{option.label}</span>
          </span>
          <span className="flex items-center space-x-2">
            {isActive && (
              <>
                {/* Direction indicator */}
                {option.value === 'title' ? (
                  <span className="text-xs font-semibold">
                    {sortDirection === 'asc' ? 'A→Z' : 'Z→A'}
                  </span>
                ) : (
                  <span className="text-xs font-semibold">
                    {sortDirection === 'desc' ? '↓' : '↑'}
                  </span>
                )}
                {/* Checkmark */}
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </span>
        </span>
      ),
      onSelect: () => { handleSortSelect(option.value); },
      className: isActive
        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
        : ''
    };
  });

  return (
    <div className="flex items-center justify-between">
      {/* Left: Filter + Sort + Active State */}
      <div className="flex items-center space-x-2" role="group" aria-label="Filter and sort controls">
        {/* Filter Dropdown */}
        <Dropdown
          trigger={
            <button
              disabled={loading}
              className="
                h-11 px-3
                flex items-center space-x-2
                text-gray-700 dark:text-gray-300
                bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm
                border border-purple-200 dark:border-gray-600
                rounded-lg
                hover:bg-white/80 dark:hover:bg-gray-700/80
                hover:border-purple-300 dark:hover:border-gray-500
                transition-all duration-200
                focus-interactive
                disabled:opacity-50 disabled:cursor-not-allowed
                relative
              "
              aria-label={`Filter by category: ${categoryLabel}`}
              title={`Filter: ${categoryLabel}`}
            >
              {/* Funnel icon */}
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>

              {/* Filter label */}
              <span className="text-sm font-semibold truncate max-w-[100px]">
                {categoryLabel}
              </span>

              {/* Badge indicator when category selected */}
              {selectedCategory && (
                <span
                  className="absolute -top-1 -right-1 w-3 h-3 border-2 border-white dark:border-gray-800 rounded-full"
                  style={{
                    backgroundColor: selectedCategory
                      ? categories.find(cat => cat.name === selectedCategory)?.color || DEFAULT_COLORS.CATEGORY_BADGE
                      : DEFAULT_COLORS.CATEGORY_BADGE
                  }}
                  aria-hidden="true"
                />
              )}
            </button>
          }
          items={filterItems}
          className="min-w-[200px] max-h-[250px] overflow-y-auto custom-scrollbar"
          itemClassName="px-4 py-3 text-sm font-medium"
        />

        {/* Sort Dropdown */}
        <Dropdown
          trigger={
            <button
              disabled={loading}
              className="
                w-11 h-11
                flex items-center justify-center
                text-gray-700 dark:text-gray-300
                bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm
                border border-purple-200 dark:border-gray-600
                rounded-lg
                hover:bg-white/80 dark:hover:bg-gray-700/80
                hover:border-purple-300 dark:hover:border-gray-500
                transition-all duration-200
                focus-interactive
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              aria-label={`Sort order: ${sortLabel}`}
              title={`Sort: ${sortLabel}`}
            >
              {/* Sort icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          }
          items={sortItems}
          className="min-w-[200px] max-h-[400px] overflow-y-auto custom-scrollbar"
          itemClassName="px-4 py-3 text-sm font-medium"
        />
      </div>

      {/* Right: Manage Categories Button */}
      <button
        onClick={onManageCategories}
        disabled={loading}
        className="
          flex items-center space-x-2
          px-3 py-2
          text-purple-600 dark:text-purple-400
          hover:text-purple-700 dark:hover:text-purple-300
          bg-purple-50/50 dark:bg-purple-900/10
          hover:bg-purple-50 dark:hover:bg-purple-900/20
          rounded-lg
          text-xs font-semibold
          transition-colors
          focus-interactive
          disabled:opacity-50 disabled:cursor-not-allowed
        "
        aria-label="Manage categories"
        title="Manage Categories"
      >
        {/* Folder/archive icon - always visible */}
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>

        {/* Text - desktop only (>= 375px) */}
        <span className="hidden min-[375px]:inline">Categories</span>
      </button>
    </div>
  );
};

// Performance optimization: memoize with custom comparison
const arePropsEqual = (
  prev: FilterSortControlsProps,
  next: FilterSortControlsProps
): boolean => {
  // Deep compare categories by ID to avoid re-renders on same data
  if (prev.categories.length !== next.categories.length) {
    return false;
  }

  const prevCategoryIds = prev.categories.map(c => c.id).join(',');
  const nextCategoryIds = next.categories.map(c => c.id).join(',');

  return (
    prevCategoryIds === nextCategoryIds &&
    prev.selectedCategory === next.selectedCategory &&
    prev.sortOrder === next.sortOrder &&
    prev.sortDirection === next.sortDirection &&
    prev.onCategoryChange === next.onCategoryChange &&
    prev.onSortChange === next.onSortChange &&
    prev.onManageCategories === next.onManageCategories &&
    prev.loading === next.loading
  );
};

export default memo(FilterSortControls, arePropsEqual);
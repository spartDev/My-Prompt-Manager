import type { FC } from 'react';
import { memo, useMemo, useCallback } from 'react';

import { DEFAULT_COLORS } from '../constants/ui';
import { SortOrder } from '../types';
import { FilterSortControlsProps } from '../types/components';

import CategoryBadge from './CategoryBadge';
import { Dropdown, DropdownItem } from './Dropdown';
import { CheckIcon, ClockIcon, CalendarIcon, AlphabeticalIcon, StarIcon, HistoryIcon } from './icons/UIIcons';

const SORT_OPTIONS: Array<{ value: SortOrder; label: string; icon: FC<{ className?: string }> }> = [
  { value: 'usageCount', label: 'Most Used', icon: StarIcon },
  { value: 'lastUsedAt', label: 'Recently Used', icon: HistoryIcon },
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
  loading = false
}) => {
  // Derived values for active state text
  const categoryLabel = selectedCategory || 'All';

  const getSortLabel = (): string => {
    const option = SORT_OPTIONS.find(opt => opt.value === sortOrder);
    if (!option) {return 'A→Z';}

    if (sortOrder === 'title') {
      return sortDirection === 'asc' ? 'A→Z' : 'Z→A';
    }

    if (sortOrder === 'usageCount') {
      return sortDirection === 'desc' ? 'Most Used' : 'Least Used';
    }

    if (sortOrder === 'lastUsedAt') {
      return sortDirection === 'desc' ? 'Recently Used' : 'Least Recent';
    }

    return sortDirection === 'desc' ? 'Newest' : 'Oldest';
  };

  const sortLabel = getSortLabel();

  // Get the active sort icon - memoized to prevent re-computation on every render
  const ActiveSortIcon = useMemo(
    () => SORT_OPTIONS.find(opt => opt.value === sortOrder)?.icon || AlphabeticalIcon,
    [sortOrder]
  );

  // Handlers - Memoized to prevent recreating callbacks on every render
  const handleCategorySelect = useCallback((category: string | null) => {
    onCategoryChange(category);
  }, [onCategoryChange]);

  const handleSortSelect = useCallback((order: SortOrder) => {
    // If same sort order, toggle direction
    if (order === sortOrder) {
      onSortChange(order, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New sort order, use default direction
      const defaultDirection = order === 'title' ? 'asc' : 'desc';
      onSortChange(order, defaultDirection);
    }
  }, [sortOrder, sortDirection, onSortChange]);

  // Build filter dropdown items - Memoized to prevent rebuilding on every render
  const filterItems = useMemo((): DropdownItem[] => {
    const items: DropdownItem[] = [
      {
        id: 'all',
        label: (
          <span className="flex items-center justify-between w-full">
            <span>All Categories</span>
            {!selectedCategory && <CheckIcon />}
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
      items.push({
        id: 'separator',
        type: 'separator',
        label: '',
        onSelect: () => {}
      });
    }

    // Add category items
    categories.forEach(category => {
      items.push({
        id: category.id,
        label: (
          <span className="flex items-center justify-between w-full">
            <span className="flex items-center space-x-2">
              <CategoryBadge category={category} variant="dot" />
              <span>{category.name}</span>
            </span>
            {selectedCategory === category.name && <CheckIcon />}
          </span>
        ),
        onSelect: () => { handleCategorySelect(category.name); },
        className: selectedCategory === category.name
          ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
          : ''
      });
    });

    return items;
  }, [categories, selectedCategory, handleCategorySelect]);

  // Build sort dropdown items - Memoized to prevent rebuilding on every render
  const sortItems = useMemo((): DropdownItem[] => {
    return SORT_OPTIONS.map(option => {
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
                  <CheckIcon />
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
  }, [sortOrder, sortDirection, handleSortSelect]);

  return (
    <div className="flex items-center space-x-2" role="group" aria-label="Filter and sort controls">
      {/* Filter Dropdown */}
      <Dropdown
        trigger={
          <button
            disabled={loading}
            id="category-filter-button"
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
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>

            {/* Filter label */}
            <span className="text-sm font-semibold truncate max-w-[100px]">
              {categoryLabel}
            </span>

            {/* Dropdown arrow */}
            <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>

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
        ariaLabel="Category filter menu"
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

            {/* Active sort badge indicator */}
            <span
              className="absolute -top-1 -right-1 w-5 h-5 bg-purple-100 dark:bg-purple-900/40 border-2 border-white dark:border-gray-800 rounded-full flex items-center justify-center text-purple-700 dark:text-purple-400"
              aria-hidden="true"
            >
              <ActiveSortIcon />
            </span>
          </button>
        }
        items={sortItems}
        className="min-w-[200px] max-h-[400px] overflow-y-auto custom-scrollbar"
        itemClassName="px-4 py-3 text-sm font-medium"
      />
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
    prev.loading === next.loading
  );
};

export default memo(FilterSortControls, arePropsEqual);

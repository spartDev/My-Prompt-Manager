import type { FC } from 'react';
import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';

import { DROPDOWN_CONFIG, DEFAULT_COLORS } from '../constants/ui';
import { useFloatingPosition } from '../hooks';
import { SortOrder } from '../types';
import { FilterSortControlsProps } from '../types/components';

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
  // Dropdown state
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Refs for floating-ui positioning
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (showFilterMenu && filterMenuRef.current && !filterMenuRef.current.contains(target) &&
          filterButtonRef.current && !filterButtonRef.current.contains(target)) {
        setShowFilterMenu(false);
      }

      if (showSortMenu && sortMenuRef.current && !sortMenuRef.current.contains(target) &&
          sortButtonRef.current && !sortButtonRef.current.contains(target)) {
        setShowSortMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [showFilterMenu, showSortMenu]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowFilterMenu(false);
        setShowSortMenu(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('keydown', handleEscape); };
  }, []);

  // Position dropdowns with floating-ui custom hook
  useFloatingPosition(showFilterMenu, filterButtonRef, filterMenuRef);
  useFloatingPosition(showSortMenu, sortButtonRef, sortMenuRef);

  // Derived values for active state text
  const categoryLabel = selectedCategory || 'All';

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
    setShowFilterMenu(false);
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
    setShowSortMenu(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent, handler: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  };

  // Menu keyboard navigation
  const handleMenuKeyDown = (
    event: React.KeyboardEvent,
    currentIndex: number
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const parent = event.currentTarget.parentElement;
      if (parent) {
        const nextIndex = (currentIndex + 1) % parent.children.length;
        (parent.children[nextIndex] as HTMLElement).focus();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const parent = event.currentTarget.parentElement;
      if (parent) {
        const prevIndex = (currentIndex - 1 + parent.children.length) % parent.children.length;
        (parent.children[prevIndex] as HTMLElement).focus();
      }
    }
  };

  return (
    <div className="flex items-center justify-between">
      {/* Left: Filter + Sort + Active State */}
      <div className="flex items-center space-x-2" role="group" aria-label="Filter and sort controls">
        {/* Filter Button */}
        <div className="relative">
          <button
            ref={filterButtonRef}
            onClick={() => { setShowFilterMenu(!showFilterMenu); }}
            onKeyDown={(e) => { handleKeyDown(e, () => { setShowFilterMenu(!showFilterMenu); }); }}
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
            aria-expanded={showFilterMenu}
            aria-haspopup="menu"
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

          {/* Filter Dropdown Menu */}
          {showFilterMenu && createPortal(
            <div
              ref={filterMenuRef}
              className="
                fixed
                min-w-[200px]
                bg-white dark:bg-gray-800 backdrop-blur-sm
                rounded-xl
                shadow-xl
                border border-purple-200 dark:border-gray-700
                overflow-y-auto
                overflow-x-hidden
                animate-in fade-in-0 zoom-in-95
                custom-scrollbar
              "
              style={{
                maxHeight: `${String(DROPDOWN_CONFIG.FILTER_MAX_HEIGHT)}px`,
                zIndex: DROPDOWN_CONFIG.PORTAL_Z_INDEX
              }}
              role="menu"
              aria-label="Category filter menu"
            >
              {/* All Categories option */}
              <button
                onClick={() => { handleCategorySelect(null); }}
                onKeyDown={(e) => { handleMenuKeyDown(e, 0); }}
                className={`
                  block w-full text-left
                  px-4 py-3
                  text-sm font-medium
                  transition-colors
                  focus-secondary
                  ${!selectedCategory
                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400'
                  }
                `}
                role="menuitem"
              >
                <span className="flex items-center justify-between">
                  <span>All Categories</span>
                  {!selectedCategory && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
              </button>

              {/* Divider */}
              {categories.length > 0 && (
                <div className="h-px bg-gray-200 dark:bg-gray-700" />
              )}

              {/* Category options */}
              {categories.map((category, index) => (
                <button
                  key={category.id}
                  onClick={() => { handleCategorySelect(category.name); }}
                  onKeyDown={(e) => { handleMenuKeyDown(e, index + 1); }}
                  className={`
                    block w-full text-left
                    px-4 py-3
                    text-sm font-medium
                    transition-colors
                    focus-secondary
                    ${selectedCategory === category.name
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400'
                    }
                  `}
                  role="menuitem"
                >
                  <span className="flex items-center justify-between">
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
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>

        {/* Sort Button */}
        <div className="relative">
          <button
            ref={sortButtonRef}
            onClick={() => { setShowSortMenu(!showSortMenu); }}
            onKeyDown={(e) => { handleKeyDown(e, () => { setShowSortMenu(!showSortMenu); }); }}
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
            aria-expanded={showSortMenu}
            aria-haspopup="menu"
            title={`Sort: ${sortLabel}`}
          >
            {/* Sort icon (arrows up/down) */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>

            {/* Badge indicator with current sort icon */}
            <span
              className="absolute -top-1 -right-1 w-5 h-5 bg-purple-100 dark:bg-purple-900/40 border-2 border-white dark:border-gray-800 rounded-full flex items-center justify-center"
              aria-hidden="true"
            >
              <div className="w-3 h-3 text-purple-700 dark:text-purple-400">
                {(() => {
                  const option = SORT_OPTIONS.find(opt => opt.value === sortOrder);
                  const Icon = option?.icon || ClockIcon;
                  return <Icon />;
                })()}
              </div>
            </span>
          </button>

          {/* Sort Dropdown Menu */}
          {showSortMenu && createPortal(
            <div
              ref={sortMenuRef}
              className="
                fixed
                min-w-[220px]
                bg-white dark:bg-gray-800 backdrop-blur-sm
                rounded-xl
                shadow-xl
                border border-purple-200 dark:border-gray-700
                overflow-y-auto
                overflow-x-hidden
                animate-in fade-in-0 zoom-in-95
                custom-scrollbar
              "
              style={{
                maxHeight: `${String(DROPDOWN_CONFIG.SORT_MAX_HEIGHT)}px`,
                zIndex: DROPDOWN_CONFIG.PORTAL_Z_INDEX
              }}
              role="menu"
              aria-label="Sort order menu"
            >
              {SORT_OPTIONS.map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => { handleSortSelect(option.value); }}
                  onKeyDown={(e) => { handleMenuKeyDown(e, index); }}
                  className={`
                    block w-full text-left
                    px-4 py-3
                    text-sm font-medium
                    transition-colors
                    focus-secondary
                    ${sortOrder === option.value
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400'
                    }
                  `}
                  role="menuitem"
                >
                  <span className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <option.icon />
                      <span>{option.label}</span>
                    </span>
                    {sortOrder === option.value && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>

        {/* Active State Text */}
        <div
          className="
            hidden sm:flex
            items-center
            text-sm font-medium
            text-gray-600 dark:text-gray-400
            min-w-0
          "
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="truncate">{categoryLabel}</span>
          <span className="mx-2 text-purple-400 dark:text-purple-500" aria-hidden="true">•</span>
          <span className="truncate">{sortLabel}</span>
        </div>
      </div>

      {/* Right: Manage Categories Button */}
      <button
        onClick={onManageCategories}
        onKeyDown={(e) => { handleKeyDown(e, onManageCategories); }}
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

// Custom props comparison for React.memo optimization
// Prevents unnecessary re-renders when props haven't actually changed
const arePropsEqual = (
  prev: FilterSortControlsProps,
  next: FilterSortControlsProps
): boolean => {
  // Check primitive props
  if (prev.selectedCategory !== next.selectedCategory) {return false;}
  if (prev.sortOrder !== next.sortOrder) {return false;}
  if (prev.sortDirection !== next.sortDirection) {return false;}
  if (prev.loading !== next.loading) {return false;}

  // Check categories array length first (fast check)
  if (prev.categories.length !== next.categories.length) {return false;}

  // Deep comparison of categories (only if lengths match)
  for (let i = 0; i < prev.categories.length; i++) {
    if (prev.categories[i].id !== next.categories[i].id) {return false;}
    if (prev.categories[i].name !== next.categories[i].name) {return false;}
    if (prev.categories[i].color !== next.categories[i].color) {return false;}
  }

  // Handler stability check (these should be stable from useCallback in parent)
  if (prev.onCategoryChange !== next.onCategoryChange) {return false;}
  if (prev.onSortChange !== next.onSortChange) {return false;}
  if (prev.onManageCategories !== next.onManageCategories) {return false;}

  // All props are equal
  return true;
};

export default memo(FilterSortControls, arePropsEqual);

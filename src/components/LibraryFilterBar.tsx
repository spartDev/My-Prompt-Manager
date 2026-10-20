import type { FC, KeyboardEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_CATEGORY_COLOR } from '../constants/colors';
import { ALL_PROMPTS } from '../services/libraryFilter';
import type { Category, LibraryFilter } from '../types';

import { StarIcon, UsageIcon } from './icons/UIIcons';

export interface LibraryFilterBarProps {
  /** Categories that hold at least one Prompt, in the order of the Categories section */
  categories: Category[];
  activeFilter: LibraryFilter;
  onChange: (filter: LibraryFilter) => void;
  disabled?: boolean;
}

interface FilterOption {
  key: string;
  label: string;
  filter: LibraryFilter;
  icon?: FC<{ className?: string }>;
  color?: string;
}

const FIXED_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'All', filter: ALL_PROMPTS },
  { key: 'pinned', label: 'Pinned', filter: { kind: 'pinned' }, icon: StarIcon },
  { key: 'mostUsed', label: 'Most Used', filter: { kind: 'mostUsed' }, icon: UsageIcon }
];

/** Room kept beside a pill scrolled into view, so the edge fade does not cover it */
const FADE_WIDTH = 32;

const filterKey = (filter: LibraryFilter): string =>
  filter.kind === 'category' ? `category:${filter.categoryId}` : filter.kind;

/**
 * The Library filter as a row of pills that scrolls sideways: All, Pinned, Most Used,
 * then one pill per Category. Implements the WAI-ARIA radio group pattern
 * (roving tabindex, arrow keys move the selection).
 */
const LibraryFilterBar: FC<LibraryFilterBarProps> = ({ categories, activeFilter, onChange, disabled = false }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [fades, setFades] = useState({ start: false, end: false });

  const options: FilterOption[] = [
    ...FIXED_OPTIONS,
    ...categories.map(category => ({
      key: `category:${category.id}`,
      label: category.name,
      filter: { kind: 'category', categoryId: category.id } as const,
      color: category.color || DEFAULT_CATEGORY_COLOR
    }))
  ];
  const activeKey = filterKey(activeFilter);

  const updateFades = useCallback(() => {
    const row = rowRef.current;
    if (!row) { return; }
    const maxScroll = row.scrollWidth - row.clientWidth;
    const start = row.scrollLeft > 1;
    const end = row.scrollLeft < maxScroll - 1;
    setFades(prev => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  // Mouse wheels only scroll vertically: turn that into sideways scrolling while the row overflows
  useEffect(() => {
    const row = rowRef.current;
    if (!row) { return; }
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) { return; }
      const maxScroll = row.scrollWidth - row.clientWidth;
      const next = Math.min(maxScroll, Math.max(0, row.scrollLeft + event.deltaY));
      if (maxScroll <= 0 || next === row.scrollLeft) { return; }
      event.preventDefault();
      row.scrollLeft = next;
      updateFades();
    };
    row.addEventListener('wheel', handleWheel, { passive: false });
    return () => { row.removeEventListener('wheel', handleWheel); };
  }, [updateFades]);

  // Re-measure the fades after every render (pills come and go) and when the row is resized
  useEffect(updateFades);
  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') { return; }
    const observer = new ResizeObserver(updateFades);
    observer.observe(row);
    return () => { observer.disconnect(); };
  }, [updateFades]);

  // Keep the active pill fully visible, clear of the edge fades
  const activeIndex = options.findIndex(option => option.key === activeKey);
  useEffect(() => {
    const row = rowRef.current;
    const pill = pillRefs.current[activeIndex];
    if (!row || !pill) { return; }
    const start = pill.offsetLeft - FADE_WIDTH;
    const end = pill.offsetLeft + pill.offsetWidth + FADE_WIDTH;
    if (start < row.scrollLeft) {
      row.scrollLeft = Math.max(0, start);
    } else if (end > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = end - row.clientWidth;
    }
    updateFades();
  }, [activeIndex, updateFades]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') { nextIndex = (index + 1) % options.length; }
    if (e.key === 'ArrowLeft') { nextIndex = (index - 1 + options.length) % options.length; }
    if (e.key === 'Home') { nextIndex = 0; }
    if (e.key === 'End') { nextIndex = options.length - 1; }
    if (nextIndex === null) { return; }

    e.preventDefault();
    pillRefs.current[nextIndex]?.focus();
    onChange(options[nextIndex].filter);
  };

  return (
    <div className="relative -mx-6">
      <div
        ref={rowRef}
        role="radiogroup"
        aria-label="Library filter"
        onScroll={updateFades}
        className="relative flex gap-2 overflow-x-auto px-6 py-0.5 scrollbar-hidden"
      >
        {options.map((option, index) => {
          const isActive = option.key === activeKey;
          const Icon = option.icon;
          return (
            <button
              key={option.key}
              ref={(el) => { pillRefs.current[index] = el; }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              disabled={disabled}
              title={option.filter.kind === 'category' ? option.label : undefined}
              data-testid={`library-filter-${option.key}`}
              onClick={() => { onChange(option.filter); }}
              onKeyDown={(e) => { handleKeyDown(e, index); }}
              className={`shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-full border text-sm whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:focus-visible:ring-purple-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-purple-100 dark:bg-purple-900/60 border-purple-300 dark:border-purple-500 text-purple-700 dark:text-purple-100 font-semibold'
                  : 'bg-white dark:bg-gray-700/60 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
              {option.color && (
                <span
                  data-testid="category-dot"
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: option.color }}
                  aria-hidden="true"
                />
              )}
              <span className="truncate max-w-[10rem]">{option.label}</span>
            </button>
          );
        })}
      </div>
      {fades.start && (
        <div
          data-testid="library-filter-fade-start"
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white dark:from-gray-800 to-transparent"
          aria-hidden="true"
        />
      )}
      {fades.end && (
        <div
          data-testid="library-filter-fade-end"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white dark:from-gray-800 to-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default LibraryFilterBar;

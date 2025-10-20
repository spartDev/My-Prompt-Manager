# Solution 1: Icon-Based Compact Controls - Implementation Plan

**Version:** 1.0.0
**Created:** 2025-10-19
**Status:** Production-Ready Implementation Guide

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Detailed Implementation Steps](#detailed-implementation-steps)
4. [Design System Integration](#design-system-integration)
5. [Accessibility Requirements](#accessibility-requirements)
6. [Testing Strategy](#testing-strategy)
7. [Migration Path](#migration-path)
8. [Risk Assessment](#risk-assessment)
9. [Success Metrics](#success-metrics)
10. [Implementation Checklist](#implementation-checklist)

---

## Executive Summary

### What We're Building

A mobile-first filter and sort control system for the Library View that replaces the current full-width filter dropdown and text-based "Manage Categories" button with a compact, icon-based interface optimized for narrow viewports (320px minimum).

### Current State (Before)

```
┌─────────────────────────────────────────┐
│ Search Bar (full width)                 │
├─────────────────────────────────────────┤
│ Filter: [All Categories ▼]  Manage...  │
│         └─ ~200px wide      └─ ~100px   │
└─────────────────────────────────────────┘
Total width: ~352px (requires 400px viewport)
```

### Target State (After)

```
┌─────────────────────────────────────────┐
│ Search Bar (full width)                 │
├─────────────────────────────────────────┤
│ [🔽][↕️]  All • A→Z     [⚙️] / [⚙️ M..] │
│  44  44   ~110px flex    44    ~90px    │
└─────────────────────────────────────────┘
Total width: ~232px (fits 320px + 88px buffer)
Mobile: Icons only (232px)
Desktop: Text shows on Manage (290px)
```

### Key Features

- **Icon-based dropdowns**: Filter (44x44px) and Sort (44x44px) buttons
- **Active state text**: "All • A→Z" shows current selections
- **Responsive "Manage"**: Icon on mobile (<375px), text on desktop
- **WCAG AAA compliant**: 44x44px touch targets, 4.5:1+ contrast
- **Keyboard navigation**: Full Tab, Enter, Escape, Arrow support
- **Smooth animations**: 200ms transitions matching design system
- **Badge indicators**: Visual feedback on filter icon when active

### Why This Matters

1. **Mobile-first**: Works perfectly on 320px viewports (iPhone SE)
2. **Future-proof**: Room for additional controls if needed
3. **Accessibility**: Meets WCAG AAA touch target requirements
4. **Consistency**: Follows existing purple-indigo design system
5. **Discoverability**: Icons with tooltips make features obvious

---

## Architecture Overview

### Component Structure

```
LibraryView (existing)
  └─ ViewHeader (existing)
       └─ FilterSortControls (NEW)
            ├─ FilterButton (NEW)
            │    ├─ Icon (filter funnel)
            │    ├─ Badge (when category selected)
            │    └─ Dropdown Menu (floating-ui)
            ├─ SortButton (NEW)
            │    ├─ Icon (arrows up/down)
            │    └─ Dropdown Menu (floating-ui)
            ├─ ActiveStateText (NEW)
            │    └─ "All • A→Z" (dynamic)
            └─ ManageButton (NEW - responsive)
                 ├─ Icon (gear) - always
                 └─ Text "Manage..." - desktop only
```

### Data Flow

```
App.tsx (state container)
  ├─ selectedCategory (string | null)
  ├─ sortOrder (SortOrder type - NEW)
  └─ sortDirection ('asc' | 'desc' - NEW)
       ↓
LibraryView (props)
  ├─ selectedCategory
  ├─ sortOrder (NEW)
  ├─ sortDirection (NEW)
  ├─ onCategoryChange(category)
  ├─ onSortChange(order, direction) (NEW)
  └─ onManageCategories()
       ↓
FilterSortControls (NEW component)
  ├─ Renders UI
  ├─ Manages dropdown state (local)
  └─ Calls parent callbacks
       ↓
StorageManager (via PromptManager)
  └─ getSortedPrompts(sortBy, direction)
```

### State Management

**Global State (App.tsx):**
```typescript
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
const [sortOrder, setSortOrder] = useState<SortOrder>('updatedAt');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
```

**Local State (FilterSortControls):**
```typescript
const [showFilterMenu, setShowFilterMenu] = useState(false);
const [showSortMenu, setShowSortMenu] = useState(false);
```

### Dependencies

- **Existing**: `@floating-ui/dom` (already in package.json) - dropdown positioning
- **No new dependencies required**

### File Changes Summary

| File | Type | Description |
|------|------|-------------|
| `src/components/FilterSortControls.tsx` | CREATE | New main component |
| `src/components/LibraryView.tsx` | MODIFY | Lines 70-94 replacement |
| `src/types/components.ts` | MODIFY | Add FilterSortControlsProps |
| `src/types/index.ts` | MODIFY | Add SortOrder type |
| `src/App.tsx` | MODIFY | Add sort state management |
| `src/hooks/usePrompts.ts` | MODIFY | Add sort support |

---

## Detailed Implementation Steps

### Step 1: Create Type Definitions

**File:** `/Users/e0538224/Developer/My-Prompt-Manager/src/types/index.ts`

**Action:** Add after line 21 (after Settings interface):

```typescript
// Sort order type for prompts
export type SortOrder = 'createdAt' | 'updatedAt' | 'title';
export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  value: SortOrder;
  label: string;
  icon: string; // Unicode character or emoji
}
```

**File:** `/Users/e0538224/Developer/My-Prompt-Manager/src/types/components.ts`

**Action:** Add at end of file (after ConfirmDialogProps):

```typescript
export interface FilterSortControlsProps {
  categories: Category[];
  selectedCategory: string | null;
  sortOrder: SortOrder;
  sortDirection: SortDirection;
  onCategoryChange: (category: string | null) => void;
  onSortChange: (order: SortOrder, direction: SortDirection) => void;
  onManageCategories: () => void;
  loading?: boolean;
  context?: 'popup' | 'sidepanel';
}
```

---

### Step 2: Create FilterSortControls Component

**File:** `/Users/e0538224/Developer/My-Prompt-Manager/src/components/FilterSortControls.tsx`

**Action:** Create new file with complete implementation:

```typescript
import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import { computePosition, flip, offset, autoUpdate } from '@floating-ui/dom';

import { Category, SortOrder, SortDirection } from '../types';
import { FilterSortControlsProps } from '../types/components';

const SORT_OPTIONS: Array<{ value: SortOrder; label: string; icon: string }> = [
  { value: 'updatedAt', label: 'Recently Updated', icon: '🕒' },
  { value: 'createdAt', label: 'Recently Created', icon: '📅' },
  { value: 'title', label: 'Alphabetical', icon: '🔤' }
];

const FilterSortControls: FC<FilterSortControlsProps> = ({
  categories,
  selectedCategory,
  sortOrder,
  sortDirection,
  onCategoryChange,
  onSortChange,
  onManageCategories,
  loading = false,
  context = 'popup'
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Position filter dropdown with floating-ui
  useEffect(() => {
    if (!showFilterMenu || !filterButtonRef.current || !filterMenuRef.current) return;

    const cleanup = autoUpdate(
      filterButtonRef.current,
      filterMenuRef.current,
      () => {
        if (!filterButtonRef.current || !filterMenuRef.current) return;

        void computePosition(filterButtonRef.current, filterMenuRef.current, {
          placement: 'bottom-start',
          middleware: [
            offset(4),
            flip()
          ]
        }).then(({ x, y }) => {
          if (!filterMenuRef.current) return;
          Object.assign(filterMenuRef.current.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
        });
      }
    );

    return cleanup;
  }, [showFilterMenu]);

  // Position sort dropdown with floating-ui
  useEffect(() => {
    if (!showSortMenu || !sortButtonRef.current || !sortMenuRef.current) return;

    const cleanup = autoUpdate(
      sortButtonRef.current,
      sortMenuRef.current,
      () => {
        if (!sortButtonRef.current || !sortMenuRef.current) return;

        void computePosition(sortButtonRef.current, sortMenuRef.current, {
          placement: 'bottom-start',
          middleware: [
            offset(4),
            flip()
          ]
        }).then(({ x, y }) => {
          if (!sortMenuRef.current) return;
          Object.assign(sortMenuRef.current.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
        });
      }
    );

    return cleanup;
  }, [showSortMenu]);

  // Get active state text
  const getCategoryLabel = useCallback(() => {
    if (!selectedCategory) return 'All';
    return selectedCategory;
  }, [selectedCategory]);

  const getSortLabel = useCallback(() => {
    const option = SORT_OPTIONS.find(opt => opt.value === sortOrder);
    if (!option) return 'A→Z';

    if (sortOrder === 'title') {
      return sortDirection === 'asc' ? 'A→Z' : 'Z→A';
    }
    return sortDirection === 'desc' ? 'Newest' : 'Oldest';
  }, [sortOrder, sortDirection]);

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
    items: Array<{ handler: () => void }>,
    currentIndex: number
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      (event.currentTarget.parentElement?.children[nextIndex] as HTMLElement)?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      (event.currentTarget.parentElement?.children[prevIndex] as HTMLElement)?.focus();
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
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            onKeyDown={(e) => handleKeyDown(e, () => setShowFilterMenu(!showFilterMenu))}
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
              relative
            "
            aria-label={`Filter by category: ${getCategoryLabel()}`}
            aria-expanded={showFilterMenu}
            aria-haspopup="menu"
            title={`Filter: ${getCategoryLabel()}`}
          >
            {/* Funnel icon */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>

            {/* Badge indicator when category selected */}
            {selectedCategory && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 border-2 border-white dark:border-gray-800 rounded-full" aria-hidden="true" />
            )}
          </button>

          {/* Filter Dropdown Menu */}
          {showFilterMenu && (
            <div
              ref={filterMenuRef}
              className="
                fixed z-50
                min-w-[200px]
                bg-white dark:bg-gray-800 backdrop-blur-sm
                rounded-xl
                shadow-xl
                border border-purple-200 dark:border-gray-700
                overflow-hidden
                animate-in fade-in-0 zoom-in-95
              "
              role="menu"
              aria-label="Category filter menu"
            >
              {/* All Categories option */}
              <button
                onClick={() => handleCategorySelect(null)}
                onKeyDown={(e) => handleMenuKeyDown(e, [], 0)}
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
                  onClick={() => handleCategorySelect(category.name)}
                  onKeyDown={(e) => handleMenuKeyDown(e, [], index + 1)}
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
            </div>
          )}
        </div>

        {/* Sort Button */}
        <div className="relative">
          <button
            ref={sortButtonRef}
            onClick={() => setShowSortMenu(!showSortMenu)}
            onKeyDown={(e) => handleKeyDown(e, () => setShowSortMenu(!showSortMenu))}
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
            aria-label={`Sort order: ${getSortLabel()}`}
            aria-expanded={showSortMenu}
            aria-haspopup="menu"
            title={`Sort: ${getSortLabel()}`}
          >
            {/* Sort icon (arrows up/down) */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>

          {/* Sort Dropdown Menu */}
          {showSortMenu && (
            <div
              ref={sortMenuRef}
              className="
                fixed z-50
                min-w-[220px]
                bg-white dark:bg-gray-800 backdrop-blur-sm
                rounded-xl
                shadow-xl
                border border-purple-200 dark:border-gray-700
                overflow-hidden
                animate-in fade-in-0 zoom-in-95
              "
              role="menu"
              aria-label="Sort order menu"
            >
              {SORT_OPTIONS.map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => handleSortSelect(option.value)}
                  onKeyDown={(e) => handleMenuKeyDown(e, [], index)}
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
                      <span aria-hidden="true">{option.icon}</span>
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
            </div>
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
          <span className="truncate">{getCategoryLabel()}</span>
          <span className="mx-2 text-purple-400 dark:text-purple-500" aria-hidden="true">•</span>
          <span className="truncate">{getSortLabel()}</span>
        </div>
      </div>

      {/* Right: Manage Categories Button */}
      <button
        onClick={onManageCategories}
        onKeyDown={(e) => handleKeyDown(e, onManageCategories)}
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
        {/* Gear icon - always visible */}
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>

        {/* Text - desktop only (>= 375px) */}
        <span className="hidden min-[375px]:inline">Manage...</span>
      </button>
    </div>
  );
};

export default FilterSortControls;
```

---

### Step 3: Update LibraryView Component

**File:** `/Users/e0538224/Developer/My-Prompt-Manager/src/components/LibraryView.tsx`

**Action:** Replace lines 70-94 with:

```typescript
          <FilterSortControls
            categories={categories}
            selectedCategory={selectedCategory}
            sortOrder={sortOrder}
            sortDirection={sortDirection}
            onCategoryChange={onCategoryChange as (category: string | null) => void}
            onSortChange={onSortChange as (order: SortOrder, direction: SortDirection) => void}
            onManageCategories={onManageCategories as () => void}
            loading={loading as boolean}
            context={context}
          />
```

**Also add import at top of file (line 7):**

```typescript
import FilterSortControls from './FilterSortControls';
```

**And add import for types (line 4):**

```typescript
import { Prompt, SortOrder, SortDirection } from '../types';
```

---

### Step 4: Update LibraryViewProps

**File:** `/Users/e0538224/Developer/My-Prompt-Manager/src/types/components.ts`

**Action:** Update LibraryViewProps (lines 44-59) to add sort properties:

```typescript
export interface LibraryViewProps {
  prompts: Prompt[];
  categories: Category[];
  searchWithDebounce: UseSearchWithDebounceReturn;
  selectedCategory: string | null;
  sortOrder: SortOrder;  // ADD THIS
  sortDirection: SortDirection;  // ADD THIS
  onAddNew: () => void;
  onEditPrompt: (prompt: Prompt) => void;
  onDeletePrompt: (id: string) => void;
  onCopyPrompt: (content: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onCategoryChange: (category: string | null) => void;
  onSortChange: (order: SortOrder, direction: SortDirection) => void;  // ADD THIS
  onManageCategories: () => void;
  onSettings: () => void;
  loading?: boolean;
  context?: 'popup' | 'sidepanel';
}
```

**Also add import at top:**

```typescript
import { Prompt, Category, SortOrder, SortDirection } from './index';
```

---

### Step 5: Add Sort State to App.tsx

**File:** `/Users/e0538224/Developer/My-Prompt-Manager/src/App.tsx`

**Action 1:** Add imports (line 13):

```typescript
import { Prompt, ErrorType, AppError, SortOrder, SortDirection } from './types';
```

**Action 2:** Add state after line 29 (after selectedCategory):

```typescript
  const [sortOrder, setSortOrder] = useState<SortOrder>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
```

**Action 3:** Add handler after handleDeletePrompt (around line 180):

```typescript
  const handleSortChange = useCallback((order: SortOrder, direction: SortDirection) => {
    setSortOrder(order);
    setSortDirection(direction);
  }, []);
```

**Action 4:** Add useMemo to sort prompts (after line 64, before handleAddNew):

```typescript
  // Sort optimistic prompts based on current sort settings
  const sortedPrompts = useMemo(() => {
    const prompts = [...optimisticPrompts];

    prompts.sort((a, b) => {
      let comparison = 0;

      switch (sortOrder) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'updatedAt':
          comparison = a.updatedAt - b.updatedAt;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return prompts;
  }, [optimisticPrompts, sortOrder, sortDirection]);
```

**Action 5:** Update searchWithDebounce to use sortedPrompts (line 64):

```typescript
  const searchWithDebounce = useSearchWithDebounce(sortedPrompts);
```

**Action 6:** Update LibraryView props (around line 200):

```typescript
        <LibraryView
          prompts={prompts}
          categories={categories}
          searchWithDebounce={searchWithDebounce}
          selectedCategory={selectedCategory}
          sortOrder={sortOrder}  // ADD THIS
          sortDirection={sortDirection}  // ADD THIS
          onAddNew={handleAddNew}
          onEditPrompt={handleEditPrompt}
          onDeletePrompt={handleDeletePrompt}
          onCopyPrompt={handleCopyPrompt}
          showToast={showToast}
          onCategoryChange={setSelectedCategory}
          onSortChange={handleSortChange}  // ADD THIS
          onManageCategories={handleManageCategories}
          onSettings={handleSettings}
          loading={promptsLoading || categoriesLoading}
          context={context}
        />
```

---

### Step 6: Add Tailwind Animation Support

**File:** `/Users/e0538224/Developer/My-Prompt-Manager/tailwind.config.js`

**Action:** Add animation utilities (if not already present):

```javascript
module.exports = {
  // ... existing config
  theme: {
    extend: {
      // ... existing extensions
      keyframes: {
        'in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        }
      },
      animation: {
        'in': 'in 0.2s ease-out',
      }
    }
  }
};
```

---

### Step 7: Add Tests

**File:** `/Users/e0538224/Developer/My-Prompt-Manager/src/components/__tests__/FilterSortControls.test.tsx`

**Action:** Create new test file:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import FilterSortControls from '../FilterSortControls';
import { Category, SortOrder, SortDirection } from '../../types';

const mockCategories: Category[] = [
  { id: '1', name: 'Work', color: '#3B82F6' },
  { id: '2', name: 'Personal', color: '#10B981' },
  { id: '3', name: 'Ideas', color: '#F59E0B' }
];

describe('FilterSortControls', () => {
  const defaultProps = {
    categories: mockCategories,
    selectedCategory: null,
    sortOrder: 'updatedAt' as SortOrder,
    sortDirection: 'desc' as SortDirection,
    onCategoryChange: vi.fn(),
    onSortChange: vi.fn(),
    onManageCategories: vi.fn(),
    loading: false,
    context: 'popup' as const
  };

  it('renders filter and sort buttons', () => {
    render(<FilterSortControls {...defaultProps} />);

    expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sort order/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/manage categories/i)).toBeInTheDocument();
  });

  it('shows active state text', () => {
    render(<FilterSortControls {...defaultProps} />);

    // Active state text should show "All • Newest"
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Newest')).toBeInTheDocument();
  });

  it('shows badge when category is selected', () => {
    render(<FilterSortControls {...defaultProps} selectedCategory="Work" />);

    const filterButton = screen.getByLabelText(/filter by category/i);
    const badge = filterButton.querySelector('.bg-purple-500');
    expect(badge).toBeInTheDocument();
  });

  it('opens filter dropdown on click', async () => {
    const user = userEvent.setup();
    render(<FilterSortControls {...defaultProps} />);

    const filterButton = screen.getByLabelText(/filter by category/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /category filter menu/i })).toBeInTheDocument();
    });

    expect(screen.getByText('All Categories')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Ideas')).toBeInTheDocument();
  });

  it('opens sort dropdown on click', async () => {
    const user = userEvent.setup();
    render(<FilterSortControls {...defaultProps} />);

    const sortButton = screen.getByLabelText(/sort order/i);
    await user.click(sortButton);

    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /sort order menu/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Recently Updated')).toBeInTheDocument();
    expect(screen.getByText('Recently Created')).toBeInTheDocument();
    expect(screen.getByText('Alphabetical')).toBeInTheDocument();
  });

  it('calls onCategoryChange when category is selected', async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    render(<FilterSortControls {...defaultProps} onCategoryChange={onCategoryChange} />);

    const filterButton = screen.getByLabelText(/filter by category/i);
    await user.click(filterButton);

    const workOption = await screen.findByText('Work');
    await user.click(workOption);

    expect(onCategoryChange).toHaveBeenCalledWith('Work');
  });

  it('calls onSortChange when sort option is selected', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<FilterSortControls {...defaultProps} onSortChange={onSortChange} />);

    const sortButton = screen.getByLabelText(/sort order/i);
    await user.click(sortButton);

    const alphabeticalOption = await screen.findByText('Alphabetical');
    await user.click(alphabeticalOption);

    expect(onSortChange).toHaveBeenCalledWith('title', 'asc');
  });

  it('toggles sort direction when same option clicked twice', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<FilterSortControls {...defaultProps} onSortChange={onSortChange} />);

    const sortButton = screen.getByLabelText(/sort order/i);
    await user.click(sortButton);

    const updatedOption = await screen.findByText('Recently Updated');
    await user.click(updatedOption);

    // Should toggle from desc to asc
    expect(onSortChange).toHaveBeenCalledWith('updatedAt', 'asc');
  });

  it('closes dropdown on outside click', async () => {
    const user = userEvent.setup();
    render(<FilterSortControls {...defaultProps} />);

    const filterButton = screen.getByLabelText(/filter by category/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /category filter menu/i })).toBeInTheDocument();
    });

    // Click outside
    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: /category filter menu/i })).not.toBeInTheDocument();
    });
  });

  it('closes dropdown on Escape key', async () => {
    const user = userEvent.setup();
    render(<FilterSortControls {...defaultProps} />);

    const filterButton = screen.getByLabelText(/filter by category/i);
    await user.click(filterButton);

    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /category filter menu/i })).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: /category filter menu/i })).not.toBeInTheDocument();
    });
  });

  it('disables buttons when loading', () => {
    render(<FilterSortControls {...defaultProps} loading={true} />);

    expect(screen.getByLabelText(/filter by category/i)).toBeDisabled();
    expect(screen.getByLabelText(/sort order/i)).toBeDisabled();
    expect(screen.getByLabelText(/manage categories/i)).toBeDisabled();
  });

  it('shows correct label for alphabetical sort direction', () => {
    const { rerender } = render(
      <FilterSortControls {...defaultProps} sortOrder="title" sortDirection="asc" />
    );

    expect(screen.getByText('A→Z')).toBeInTheDocument();

    rerender(
      <FilterSortControls {...defaultProps} sortOrder="title" sortDirection="desc" />
    );

    expect(screen.getByText('Z→A')).toBeInTheDocument();
  });

  it('shows "Manage..." text on desktop viewport', () => {
    // Mock window.matchMedia for desktop
    global.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('min-width: 375px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));

    render(<FilterSortControls {...defaultProps} />);

    const manageButton = screen.getByLabelText(/manage categories/i);
    expect(manageButton.textContent).toContain('Manage...');
  });

  it('calls onManageCategories when manage button is clicked', async () => {
    const user = userEvent.setup();
    const onManageCategories = vi.fn();
    render(<FilterSortControls {...defaultProps} onManageCategories={onManageCategories} />);

    const manageButton = screen.getByLabelText(/manage categories/i);
    await user.click(manageButton);

    expect(onManageCategories).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard navigation with Enter key', async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    render(<FilterSortControls {...defaultProps} onCategoryChange={onCategoryChange} />);

    const filterButton = screen.getByLabelText(/filter by category/i);
    filterButton.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /category filter menu/i })).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation with Space key', async () => {
    const user = userEvent.setup();
    render(<FilterSortControls {...defaultProps} />);

    const sortButton = screen.getByLabelText(/sort order/i);
    sortButton.focus();
    await user.keyboard(' ');

    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /sort order menu/i })).toBeInTheDocument();
    });
  });

  it('highlights selected category in dropdown', async () => {
    const user = userEvent.setup();
    render(<FilterSortControls {...defaultProps} selectedCategory="Work" />);

    const filterButton = screen.getByLabelText(/filter by category/i);
    await user.click(filterButton);

    const workOption = await screen.findByText('Work');
    const workButton = workOption.closest('button');

    expect(workButton).toHaveClass('bg-purple-50');
  });

  it('highlights selected sort option in dropdown', async () => {
    const user = userEvent.setup();
    render(<FilterSortControls {...defaultProps} sortOrder="updatedAt" />);

    const sortButton = screen.getByLabelText(/sort order/i);
    await user.click(sortButton);

    const updatedOption = await screen.findByText('Recently Updated');
    const updatedButton = updatedOption.closest('button');

    expect(updatedButton).toHaveClass('bg-purple-50');
  });
});
```

---

## Design System Integration

### Color Palette Usage

**Primary Actions:**
- Icon buttons: `border-purple-200 dark:border-gray-600`
- Hover states: `hover:border-purple-300 dark:hover:border-gray-500`
- Selected items: `bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400`
- Badge indicator: `bg-purple-500`

**Backgrounds:**
- Buttons: `bg-white/60 dark:bg-gray-700/60 backdrop-blur-sm`
- Dropdowns: `bg-white dark:bg-gray-800 backdrop-blur-sm`
- Hover: `hover:bg-white/80 dark:hover:bg-gray-700/80`

**Text Colors:**
- Primary: `text-gray-700 dark:text-gray-300`
- Active state: `text-gray-600 dark:text-gray-400`
- Purple accent: `text-purple-600 dark:text-purple-400`

### Typography

- Button text: `text-xs font-semibold`
- Menu items: `text-sm font-medium`
- Active state: `text-sm font-medium`

### Spacing

- Button size: `w-11 h-11` (44x44px touch target)
- Button gap: `space-x-2` (8px)
- Menu padding: `px-4 py-3` (16px/12px)
- Border radius: `rounded-lg` (8px buttons), `rounded-xl` (12px dropdowns)

### Shadows & Effects

- Dropdown shadow: `shadow-xl`
- Backdrop blur: `backdrop-blur-sm`
- Animations: `transition-all duration-200`

### Focus States

Using existing design system classes:
- Buttons: `.focus-interactive`
- Menu items: `.focus-secondary`

---

## Accessibility Requirements

### WCAG AAA Compliance Checklist

#### Touch Targets (2.5.5 - AAA)
- ✅ All buttons are 44x44px minimum
- ✅ 8px spacing between interactive elements
- ✅ No overlapping touch targets

#### Contrast Ratios (1.4.6 - AAA)
- ✅ Text: 7:1 contrast minimum
- ✅ Interactive elements: 4.5:1 minimum
- ✅ Focus indicators: 3:1 minimum

#### Keyboard Navigation (2.1.1 - A)
- ✅ Tab navigation through all controls
- ✅ Enter/Space to activate buttons
- ✅ Escape to close dropdowns
- ✅ Arrow keys for menu navigation
- ✅ Focus visible at all times

#### ARIA Labels (4.1.2 - A)
- ✅ `aria-label` on all icon buttons
- ✅ `aria-expanded` on dropdown triggers
- ✅ `aria-haspopup="menu"` on dropdown triggers
- ✅ `role="menu"` on dropdown containers
- ✅ `role="menuitem"` on dropdown options
- ✅ `aria-live="polite"` on active state text

#### Screen Reader Support
- ✅ Descriptive button labels (e.g., "Filter by category: All")
- ✅ State announcements (e.g., "Sort order: Newest")
- ✅ `aria-hidden="true"` on decorative icons
- ✅ Live region updates for state changes

#### Tooltips (1.4.13 - AA)
- ✅ `title` attribute on all icon buttons
- ✅ Hover states provide visual feedback
- ✅ Focus states provide visual feedback

### Accessibility Testing Checklist

**Keyboard Navigation:**
- [ ] Tab through all controls in logical order
- [ ] Enter/Space activates all buttons
- [ ] Escape closes all dropdowns
- [ ] Arrow keys navigate within menus
- [ ] Focus returns to trigger after closing dropdown

**Screen Reader:**
- [ ] VoiceOver announces all button labels correctly
- [ ] NVDA announces menu structure
- [ ] State changes are announced
- [ ] Selected items are indicated

**Visual:**
- [ ] Focus indicators visible at 400% zoom
- [ ] All text readable at 200% zoom
- [ ] No content loss at 320px width
- [ ] Color is not the only differentiator

---

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

**Coverage targets: 90%+**

**Test file:** `src/components/__tests__/FilterSortControls.test.tsx`

**Test cases:**
1. ✅ Renders all buttons correctly
2. ✅ Shows active state text
3. ✅ Shows badge when category selected
4. ✅ Opens/closes filter dropdown
5. ✅ Opens/closes sort dropdown
6. ✅ Calls onCategoryChange correctly
7. ✅ Calls onSortChange correctly
8. ✅ Toggles sort direction on repeat click
9. ✅ Closes dropdown on outside click
10. ✅ Closes dropdown on Escape
11. ✅ Disables buttons when loading
12. ✅ Shows correct sort direction labels
13. ✅ Highlights selected items
14. ✅ Keyboard navigation works
15. ✅ Responsive text visibility

**Run tests:**
```bash
npm test FilterSortControls
```

### Integration Tests

**Test file:** `src/components/__tests__/LibraryView.integration.test.tsx`

```typescript
describe('LibraryView with FilterSortControls', () => {
  it('filters and sorts prompts correctly', async () => {
    // Test full integration with LibraryView
    const user = userEvent.setup();
    render(<LibraryView {...defaultProps} />);

    // 1. Select category
    await user.click(screen.getByLabelText(/filter by category/i));
    await user.click(screen.getByText('Work'));

    // 2. Verify filtered prompts
    expect(screen.getAllByRole('article')).toHaveLength(5);

    // 3. Change sort
    await user.click(screen.getByLabelText(/sort order/i));
    await user.click(screen.getByText('Alphabetical'));

    // 4. Verify sort order
    const titles = screen.getAllByRole('heading', { level: 3 });
    expect(titles[0]).toHaveTextContent('Alpha Prompt');
    expect(titles[1]).toHaveTextContent('Beta Prompt');
  });
});
```

### E2E Tests (Playwright)

**Test file:** `tests/filter-sort.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Filter and Sort Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('chrome-extension://[ID]/popup.html');
  });

  test('filters prompts by category', async ({ page }) => {
    // Click filter button
    await page.click('[aria-label*="Filter by category"]');

    // Wait for dropdown
    await page.waitForSelector('role=menu[name="Category filter menu"]');

    // Select "Work" category
    await page.click('text=Work');

    // Verify active state shows "Work"
    await expect(page.locator('text=Work • ')).toBeVisible();

    // Verify prompts are filtered
    const promptCards = page.locator('[role="article"]');
    await expect(promptCards).toHaveCount(5); // Adjust based on test data
  });

  test('sorts prompts alphabetically', async ({ page }) => {
    // Click sort button
    await page.click('[aria-label*="Sort order"]');

    // Wait for dropdown
    await page.waitForSelector('role=menu[name="Sort order menu"]');

    // Select "Alphabetical"
    await page.click('text=Alphabetical');

    // Verify active state shows "A→Z"
    await expect(page.locator('text=A→Z')).toBeVisible();

    // Verify sort order
    const firstTitle = page.locator('[role="article"]').first().locator('h3');
    await expect(firstTitle).toHaveText(/^A/);
  });

  test('toggles sort direction', async ({ page }) => {
    // Set to alphabetical
    await page.click('[aria-label*="Sort order"]');
    await page.click('text=Alphabetical');
    await expect(page.locator('text=A→Z')).toBeVisible();

    // Click again to toggle
    await page.click('[aria-label*="Sort order"]');
    await page.click('text=Alphabetical');

    // Verify reversed
    await expect(page.locator('text=Z→A')).toBeVisible();
  });

  test('opens manage categories', async ({ page }) => {
    await page.click('[aria-label="Manage categories"]');

    // Verify navigation to category management
    await expect(page.locator('h1:has-text("Manage Categories")')).toBeVisible();
  });

  test('keyboard navigation works', async ({ page }) => {
    // Tab to filter button
    await page.keyboard.press('Tab');
    // Skip search bar and clear button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Activate with Enter
    await page.keyboard.press('Enter');

    // Verify dropdown opens
    await expect(page.locator('role=menu[name="Category filter menu"]')).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');

    // Verify dropdown closes
    await expect(page.locator('role=menu[name="Category filter menu"]')).not.toBeVisible();
  });

  test('works on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });

    // All buttons should be visible
    await expect(page.locator('[aria-label*="Filter"]')).toBeVisible();
    await expect(page.locator('[aria-label*="Sort"]')).toBeVisible();
    await expect(page.locator('[aria-label*="Manage"]')).toBeVisible();

    // "Manage..." text should be hidden
    await expect(page.locator('text=Manage...')).not.toBeVisible();
  });
});
```

**Run E2E tests:**
```bash
npm run test:e2e
```

### Visual Regression Tests

**Test file:** `tests/visual/filter-sort.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('FilterSortControls Visual Regression', () => {
  test('default state', async ({ page }) => {
    await page.goto('chrome-extension://[ID]/popup.html');
    await expect(page.locator('[role="group"][aria-label*="Filter and sort"]')).toHaveScreenshot('filter-sort-default.png');
  });

  test('filter dropdown open', async ({ page }) => {
    await page.goto('chrome-extension://[ID]/popup.html');
    await page.click('[aria-label*="Filter by category"]');
    await expect(page).toHaveScreenshot('filter-dropdown-open.png');
  });

  test('sort dropdown open', async ({ page }) => {
    await page.goto('chrome-extension://[ID]/popup.html');
    await page.click('[aria-label*="Sort order"]');
    await expect(page).toHaveScreenshot('sort-dropdown-open.png');
  });

  test('category selected with badge', async ({ page }) => {
    await page.goto('chrome-extension://[ID]/popup.html');
    await page.click('[aria-label*="Filter by category"]');
    await page.click('text=Work');
    await expect(page.locator('[role="group"][aria-label*="Filter and sort"]')).toHaveScreenshot('filter-selected-badge.png');
  });

  test('dark mode', async ({ page }) => {
    await page.goto('chrome-extension://[ID]/popup.html');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('[role="group"][aria-label*="Filter and sort"]')).toHaveScreenshot('filter-sort-dark.png');
  });
});
```

---

## Migration Path

### Phase 1: Preparation (No Breaking Changes)

**Duration:** 1 day

1. ✅ Add new type definitions to `src/types/index.ts`
2. ✅ Add FilterSortControlsProps to `src/types/components.ts`
3. ✅ Run `npm test` and `npm run lint` - should pass
4. ✅ Commit: "feat: add types for filter/sort controls"

### Phase 2: Create Component (Isolated)

**Duration:** 2 days

1. ✅ Create `src/components/FilterSortControls.tsx`
2. ✅ Create `src/components/__tests__/FilterSortControls.test.tsx`
3. ✅ Run tests: `npm test FilterSortControls`
4. ✅ Fix any test failures
5. ✅ Run lint: `npm run lint`
6. ✅ Commit: "feat: add FilterSortControls component with tests"

### Phase 3: Integration (Breaking Change Controlled)

**Duration:** 1 day

1. ✅ Add sort state to App.tsx (backward compatible)
2. ✅ Update LibraryViewProps with optional sort props
3. ✅ Run tests: `npm test`
4. ✅ Commit: "feat: add sort state management to App"

### Phase 4: Replace UI (Breaking Change)

**Duration:** 1 day

1. ✅ Update LibraryView.tsx to use FilterSortControls
2. ✅ Make sort props required in LibraryViewProps
3. ✅ Update all LibraryView usages in App.tsx
4. ✅ Run tests: `npm test`
5. ✅ Run E2E tests: `npm run test:e2e`
6. ✅ Manual testing in Chrome
7. ✅ Commit: "feat: replace category filter with FilterSortControls"

### Phase 5: Cleanup

**Duration:** 0.5 days

1. ✅ Remove old CategoryFilter component (if no longer used)
2. ✅ Update documentation
3. ✅ Run full test suite
4. ✅ Create PR with all changes
5. ✅ Commit: "chore: remove deprecated CategoryFilter component"

### Rollback Strategy

If issues arise during integration:

1. **Immediate rollback**: Git revert the commit that updated LibraryView.tsx
2. **Keep new code**: FilterSortControls component and tests remain for future use
3. **No data loss**: Sort preferences stored in local state, not persisted
4. **Zero downtime**: Extension continues to work with old UI

---

## Risk Assessment

### High Risk

**Risk:** Dropdown positioning fails on certain screen sizes
**Likelihood:** Medium
**Impact:** High
**Mitigation:**
- Use battle-tested `@floating-ui/dom` library
- Extensive manual testing on 320px, 375px, 400px viewports
- Fallback to bottom-aligned positioning if calculations fail

**Risk:** Keyboard navigation breaks existing patterns
**Likelihood:** Low
**Impact:** High
**Mitigation:**
- Follow WCAG keyboard navigation standards
- Comprehensive keyboard navigation tests
- Manual testing with screen readers

### Medium Risk

**Risk:** Performance degradation from sorting large prompt lists
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:**
- Use useMemo to cache sorted results
- Sort happens client-side with optimized comparison functions
- Expected max prompts: ~1000 (sorting 1000 items takes <10ms)

**Risk:** Dark mode contrast issues
**Likelihood:** Low
**Impact:** Medium
**Mitigation:**
- Use existing design system colors
- Test with contrast checker tools
- Manual visual testing in dark mode

### Low Risk

**Risk:** Animation jank on low-end devices
**Likelihood:** Low
**Impact:** Low
**Mitigation:**
- Use CSS transforms (GPU-accelerated)
- 200ms duration (imperceptible on slow devices)
- Graceful degradation with `prefers-reduced-motion`

**Risk:** Tooltip overflow on narrow viewports
**Likelihood:** Low
**Impact:** Low
**Mitigation:**
- Tooltips use `title` attribute (browser-handled)
- Text truncation with ellipsis for active state
- Tested on 320px minimum width

---

## Success Metrics

### Quantitative Metrics

**Performance:**
- ✅ Component renders in <50ms
- ✅ Dropdown opens in <100ms
- ✅ Sort operation completes in <50ms (1000 prompts)
- ✅ No layout shift (CLS = 0)

**Accessibility:**
- ✅ Lighthouse accessibility score: 100
- ✅ WCAG AAA compliance: 100%
- ✅ Keyboard navigation: 100% of controls operable
- ✅ Screen reader compatibility: VoiceOver + NVDA

**Code Quality:**
- ✅ Test coverage: >90%
- ✅ ESLint: 0 errors, 0 warnings
- ✅ TypeScript: 0 type errors
- ✅ Bundle size increase: <5KB gzipped

### Qualitative Metrics

**User Experience:**
- ✅ Controls fit on 320px viewport with room to spare
- ✅ Icons are recognizable without tooltips
- ✅ Active state clearly shows current selections
- ✅ Dropdown animations feel smooth and responsive
- ✅ Dark mode looks consistent with design system

**Developer Experience:**
- ✅ Component is easy to understand and maintain
- ✅ Props API is intuitive and well-typed
- ✅ Tests provide confidence in functionality
- ✅ Documentation is comprehensive

### Acceptance Criteria

- [ ] All unit tests pass (90%+ coverage)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Lighthouse accessibility score: 100
- [ ] Manual testing on 320px, 375px, 400px viewports
- [ ] Manual testing on Chrome (latest 3 versions)
- [ ] Manual keyboard navigation testing
- [ ] Manual screen reader testing (VoiceOver)
- [ ] Dark mode visual inspection
- [ ] Code review approved
- [ ] PR merged to main branch

---

## Implementation Checklist

### Pre-Implementation

- [ ] Read this entire document
- [ ] Review existing LibraryView component
- [ ] Review design guidelines document
- [ ] Set up development environment
- [ ] Create feature branch: `feature/filter-sort-controls`

### Step 1: Type Definitions (15 minutes)

- [ ] Open `src/types/index.ts`
- [ ] Add SortOrder, SortDirection, SortOption types after Settings interface
- [ ] Open `src/types/components.ts`
- [ ] Add FilterSortControlsProps interface at end of file
- [ ] Add import for SortOrder and SortDirection in LibraryViewProps
- [ ] Run `npm run typecheck` - should pass
- [ ] Commit: "feat: add types for filter/sort controls"

### Step 2: Create Component (2 hours)

- [ ] Create `src/components/FilterSortControls.tsx`
- [ ] Copy complete implementation from Step 2 above
- [ ] Verify imports resolve correctly
- [ ] Verify no TypeScript errors
- [ ] Run `npm run typecheck` - should pass
- [ ] Run `npm run lint` - should pass
- [ ] Commit: "feat: add FilterSortControls component"

### Step 3: Create Tests (1 hour)

- [ ] Create `src/components/__tests__/FilterSortControls.test.tsx`
- [ ] Copy complete test implementation from Step 7 above
- [ ] Run `npm test FilterSortControls` - should pass
- [ ] Verify coverage: `npm run test:coverage`
- [ ] Coverage should be >90% for FilterSortControls
- [ ] Commit: "test: add comprehensive tests for FilterSortControls"

### Step 4: Update App.tsx (30 minutes)

- [ ] Open `src/App.tsx`
- [ ] Add imports: SortOrder, SortDirection
- [ ] Add state: sortOrder, sortDirection (after line 29)
- [ ] Add handler: handleSortChange (after handleDeletePrompt)
- [ ] Add useMemo: sortedPrompts (before handleAddNew)
- [ ] Update searchWithDebounce to use sortedPrompts
- [ ] Update LibraryView props with sort state
- [ ] Run `npm test` - should pass
- [ ] Run `npm run typecheck` - should pass
- [ ] Commit: "feat: add sort state management to App"

### Step 5: Update LibraryView (15 minutes)

- [ ] Open `src/components/LibraryView.tsx`
- [ ] Add import: FilterSortControls
- [ ] Add import: SortOrder, SortDirection
- [ ] Replace lines 70-94 with FilterSortControls component
- [ ] Update props destructuring to include sortOrder, sortDirection, onSortChange
- [ ] Run `npm run typecheck` - should pass
- [ ] Run `npm test` - should pass
- [ ] Commit: "feat: replace CategoryFilter with FilterSortControls in LibraryView"

### Step 6: Update Types (15 minutes)

- [ ] Open `src/types/components.ts`
- [ ] Update LibraryViewProps to include sortOrder, sortDirection, onSortChange
- [ ] Make properties required (not optional)
- [ ] Add imports: SortOrder, SortDirection
- [ ] Run `npm run typecheck` - should pass
- [ ] Commit: "feat: update LibraryViewProps with sort properties"

### Step 7: Manual Testing (1 hour)

- [ ] Run `npm run build`
- [ ] Load extension in Chrome (chrome://extensions/)
- [ ] Test filter dropdown opens/closes
- [ ] Test sort dropdown opens/closes
- [ ] Test category selection works
- [ ] Test sort selection works
- [ ] Test sort direction toggle works
- [ ] Test "Manage Categories" button works
- [ ] Test badge appears when category selected
- [ ] Test active state text updates
- [ ] Test on 320px viewport (mobile)
- [ ] Test on 375px viewport (iPhone)
- [ ] Test on 400px viewport (popup default)
- [ ] Test dark mode
- [ ] Test keyboard navigation (Tab, Enter, Escape, Arrows)
- [ ] Test with screen reader (VoiceOver on Mac)

### Step 8: E2E Testing (30 minutes)

- [ ] Create `tests/filter-sort.spec.ts`
- [ ] Copy E2E test implementation from Testing Strategy section
- [ ] Update extension ID in test file
- [ ] Run `npm run test:e2e`
- [ ] All tests should pass
- [ ] Commit: "test: add E2E tests for filter/sort controls"

### Step 9: Code Quality (15 minutes)

- [ ] Run `npm run lint` - should pass with 0 errors
- [ ] Run `npm run lint:fix` to auto-fix any issues
- [ ] Run `npm test` - should pass all tests
- [ ] Run `npm run test:coverage` - coverage should be >85%
- [ ] Run `npm run typecheck` - should pass with 0 errors
- [ ] Verify bundle size: `npm run build` and check dist/ size
- [ ] Commit: "chore: fix linting issues"

### Step 10: Documentation (15 minutes)

- [ ] Update CHANGELOG.md with new feature
- [ ] Update README.md if UI changes are significant
- [ ] Add JSDoc comments to FilterSortControls if not present
- [ ] Commit: "docs: update documentation for filter/sort controls"

### Step 11: PR & Review (30 minutes)

- [ ] Create pull request with descriptive title
- [ ] Add PR description with screenshots
- [ ] Link to this implementation plan in PR
- [ ] Request code review
- [ ] Address review feedback
- [ ] Squash commits if requested
- [ ] Merge to main

### Step 12: Post-Merge Verification (15 minutes)

- [ ] Pull main branch
- [ ] Run `npm install` (in case of dependency changes)
- [ ] Run `npm test` - should pass
- [ ] Run `npm run build` - should succeed
- [ ] Load extension in Chrome - should work
- [ ] Verify filter and sort work correctly
- [ ] Monitor for bug reports

### Optional: Cleanup (15 minutes)

- [ ] Check if CategoryFilter component is still used elsewhere
- [ ] If not used, delete `src/components/CategoryFilter.tsx`
- [ ] If not used, delete `src/components/__tests__/CategoryFilter.test.tsx`
- [ ] Update imports in index files if necessary
- [ ] Run tests to verify nothing broke
- [ ] Commit: "chore: remove deprecated CategoryFilter component"

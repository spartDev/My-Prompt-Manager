/**
 * Optimized search hooks with debouncing and indexing
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import { getSearchIndex } from '../services/SearchIndex';
import { Prompt } from '../types';
import { HighlightedPrompt } from '../types/hooks';
import { Logger, toError } from '../utils';
import { findTextHighlights } from '../utils/textHighlight';

/**
 * Debounce delay in milliseconds
 */
const DEFAULT_DEBOUNCE_DELAY = 300;

/**
 * Custom hook for debounced value
 * Returns the debounced value after the specified delay
 *
 * @param value Value to debounce
 * @param delay Delay in milliseconds
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = DEFAULT_DEBOUNCE_DELAY): T {
  // If delay is 0, return value immediately without debouncing
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // If delay is 0, update immediately (for testing)
    if (delay === 0) {
      setDebouncedValue(value);
      return;
    }

    // Set up the timeout
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up timeout on value change or unmount
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  // Return value directly if delay is 0 (synchronous behavior for tests)
  return delay === 0 ? value : debouncedValue;
}

/**
 * Options for optimized search
 */
interface SearchOptions {
  debounceDelay?: number;
  minRelevance?: number;
  maxResults?: number;
  categoryFilter?: string | null;
  enableIndexing?: boolean;
}

/**
 * Result from optimized search hook
 */
interface SearchHookResult {
  results: Prompt[];
  isSearching: boolean;
  searchStats: {
    resultCount: number;
    searchTime: number;
    isIndexed: boolean;
  };
}

/**
 * Custom hook for optimized prompt search with indexing and debouncing
 *
 * Usage:
 * ```typescript
 * const { results, isSearching, searchStats } = useSearchOptimized(
 *   prompts,
 *   searchQuery,
 *   { debounceDelay: 300, categoryFilter: selectedCategory }
 * );
 * ```
 *
 * @param prompts Array of all prompts
 * @param query Search query string
 * @param options Search options
 * @returns Search results and metadata
 */
export function useSearchOptimized(
  prompts: Prompt[],
  query: string,
  options: SearchOptions = {}
): SearchHookResult {
  const {
    debounceDelay = DEFAULT_DEBOUNCE_DELAY,
    minRelevance = 0.1,
    maxResults = 100,
    categoryFilter = null,
    enableIndexing = true
  } = options;

  // Debounce the search query
  const debouncedQuery = useDebounce(query, debounceDelay);

  // Track if currently searching (during debounce period)
  const [isSearching, setIsSearching] = useState(false);

  // Search statistics
  const [searchStats, setSearchStats] = useState({
    resultCount: 0,
    searchTime: 0,
    isIndexed: false
  });

  // Get search index instance
  const searchIndex = useMemo(() => getSearchIndex(), []);

  // Build/rebuild index when prompts change (using useMemo for synchronous execution)
  useMemo(() => {
    if (!enableIndexing) {return;}

    const startTime = performance.now();

    // Check if index needs rebuilding
    if (searchIndex.needsRebuild(prompts)) {
      searchIndex.buildIndex(prompts);
    }

    const buildTime = performance.now() - startTime;
    if (buildTime > 10) {
      Logger.debug('Search index rebuild completed', {
        component: 'useSearchOptimized',
        buildTimeMs: buildTime.toFixed(2),
        promptCount: prompts.length
      });
    }
  }, [prompts, enableIndexing, searchIndex]);

  // Update searching state when query changes
  useEffect(() => {
    setIsSearching(query !== debouncedQuery);
  }, [query, debouncedQuery]);

  // Perform search
  const results = useMemo(() => {
    const startTime = performance.now();

    // Empty query returns all prompts (filtered by category if specified)
    if (!debouncedQuery.trim()) {
      let filteredPrompts = prompts;

      if (categoryFilter) {
        filteredPrompts = prompts.filter(p => p.category === categoryFilter);
      }

      setSearchStats({
        resultCount: filteredPrompts.length,
        searchTime: 0,
        isIndexed: false
      });

      return filteredPrompts;
    }

    let searchResults: Prompt[];
    let isIndexed = false;

    if (enableIndexing) {
      // Use indexed search
      const indexResults = searchIndex.search(debouncedQuery, {
        maxResults,
        minRelevance,
        categoryFilter: categoryFilter || undefined
      });

      searchResults = indexResults.map(r => r.prompt);
      isIndexed = true;
    } else {
      // Fallback to linear search
      searchResults = linearSearch(prompts, debouncedQuery, categoryFilter);
    }

    const searchTime = performance.now() - startTime;

    setSearchStats({
      resultCount: searchResults.length,
      searchTime,
      isIndexed
    });

    return searchResults;
  }, [prompts, debouncedQuery, categoryFilter, enableIndexing, maxResults, minRelevance, searchIndex]);

  return {
    results,
    isSearching,
    searchStats
  };
}

/**
 * Fallback linear search implementation
 */
function linearSearch(
  prompts: Prompt[],
  query: string,
  categoryFilter: string | null
): Prompt[] {
  const searchTerm = query.toLowerCase().trim();

  return prompts.filter(prompt => {
    // Category filter
    if (categoryFilter && prompt.category !== categoryFilter) {
      return false;
    }

    // Search filter
    return (
      prompt.title.toLowerCase().includes(searchTerm) ||
      prompt.content.toLowerCase().includes(searchTerm) ||
      prompt.category.toLowerCase().includes(searchTerm)
    );
  });
}

/**
 * Custom hook for search with highlighted results
 *
 * @param prompts Array of all prompts
 * @param query Search query string
 * @param options Search options
 * @returns Search results with highlights and metadata
 */
export function useSearchWithHighlights(
  prompts: Prompt[],
  query: string,
  options: SearchOptions = {}
): {
  results: HighlightedPrompt[];
  isSearching: boolean;
  searchStats: SearchHookResult['searchStats'];
} {
  const { results, isSearching, searchStats } = useSearchOptimized(prompts, query, options);

  const debouncedQuery = useDebounce(query, options.debounceDelay);

  // Add highlights to results
  const highlightedResults = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return results.map(prompt => ({
        ...prompt,
        titleHighlights: [],
        contentHighlights: []
      }));
    }

    return results.map(prompt => ({
      ...prompt,
      titleHighlights: findTextHighlights(prompt.title, debouncedQuery),
      contentHighlights: findTextHighlights(prompt.content, debouncedQuery)
    }));
  }, [results, debouncedQuery]);

  return {
    results: highlightedResults,
    isSearching,
    searchStats
  };
}

/**
 * Custom hook for search input with automatic debouncing
 *
 * Usage:
 * ```typescript
 * const { value, onChange, debouncedValue, isDebouncing } = useSearchInput('', 300);
 *
 * <input
 *   type="text"
 *   value={value}
 *   onChange={onChange}
 *   placeholder="Search..."
 * />
 * ```
 *
 * @param initialValue Initial search value
 * @param debounceDelay Debounce delay in milliseconds
 * @returns Search input state and handlers
 */
export function useSearchInput(
  initialValue: string = '',
  debounceDelay: number = DEFAULT_DEBOUNCE_DELAY
) {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebounce(value, debounceDelay);
  const isDebouncing = value !== debouncedValue;

  const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  }, []);

  const clear = useCallback(() => {
    setValue('');
  }, []);

  return {
    value,
    setValue,
    onChange,
    debouncedValue,
    isDebouncing,
    clear
  };
}

/**
 * Custom hook for managing search state with persistence
 *
 * @param storageKey Key for localStorage persistence
 * @param debounceDelay Debounce delay
 * @returns Search state management
 */
export function useSearchState(
  storageKey: string = 'promptSearch',
  debounceDelay: number = DEFAULT_DEBOUNCE_DELAY
) {
  // Load initial value from localStorage
  const [query, setQuery] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored || '';
    } catch {
      return '';
    }
  });

  const debouncedQuery = useDebounce(query, debounceDelay);
  const isDebouncing = query !== debouncedQuery;

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, query);
    } catch (err) {
      Logger.error('Failed to persist search query', toError(err), {
        component: 'useSearchState',
        storageKey
      });
    }
  }, [query, storageKey]);

  const clear = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    isDebouncing,
    clear
  };
}

/**
 * Hook for tracking search performance metrics
 */
export function useSearchMetrics() {
  const metricsRef = useRef<{
    totalSearches: number;
    avgSearchTime: number;
    maxSearchTime: number;
    minSearchTime: number;
  }>({
    totalSearches: 0,
    avgSearchTime: 0,
    maxSearchTime: 0,
    minSearchTime: Infinity
  });

  const recordSearch = useCallback((searchTime: number) => {
    const metrics = metricsRef.current;
    metrics.totalSearches++;
    metrics.maxSearchTime = Math.max(metrics.maxSearchTime, searchTime);
    metrics.minSearchTime = Math.min(metrics.minSearchTime, searchTime);
    metrics.avgSearchTime =
      (metrics.avgSearchTime * (metrics.totalSearches - 1) + searchTime) /
      metrics.totalSearches;
  }, []);

  const getMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      totalSearches: 0,
      avgSearchTime: 0,
      maxSearchTime: 0,
      minSearchTime: Infinity
    };
  }, []);

  return {
    recordSearch,
    getMetrics,
    resetMetrics
  };
}

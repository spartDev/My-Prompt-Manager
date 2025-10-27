/**
 * Optimized search hooks with debouncing and indexing
 */

import { useState, useEffect, useMemo } from 'react';

import { getSearchIndex } from '../services/SearchIndex';
import { Prompt } from '../types';
import { HighlightedPrompt } from '../types/hooks';
import * as Logger from '../utils/logger';
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
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setDebouncedValue(value);
      });
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

  // Build/rebuild index when prompts change (side effect in useEffect)
  useEffect(() => {
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

  // Perform search and compute stats (no state updates during render)
  const searchResult = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- Performance measurement for debugging
    const startTime = performance.now();

    // Empty query returns all prompts (filtered by category if specified)
    if (!debouncedQuery.trim()) {
      let filteredPrompts = prompts;

      if (categoryFilter) {
        filteredPrompts = prompts.filter(p => p.category === categoryFilter);
      }

      return {
        results: filteredPrompts,
        stats: {
          resultCount: filteredPrompts.length,
          searchTime: 0,
          isIndexed: false
        }
      };
    }

    let searchResults: Prompt[];
    let isIndexed = false;

    if (enableIndexing) {
      // Use indexed search (SearchIndex handles auto-rebuild internally)
      const indexResults = searchIndex.search(debouncedQuery, {
        maxResults,
        minRelevance,
        categoryFilter: categoryFilter || undefined,
        prompts // Pass prompts for auto-rebuild if needed
      });

      searchResults = indexResults.map(r => r.prompt);
      isIndexed = true;
    } else {
      // Fallback to linear search
      searchResults = linearSearch(prompts, debouncedQuery, categoryFilter);
    }

    // eslint-disable-next-line react-hooks/purity -- Performance measurement for debugging
    const searchTime = performance.now() - startTime;

    return {
      results: searchResults,
      stats: {
        resultCount: searchResults.length,
        searchTime,
        isIndexed
      }
    };
  }, [prompts, debouncedQuery, categoryFilter, enableIndexing, maxResults, minRelevance, searchIndex]);

  // Update stats in effect (after render, not during)
  useEffect(() => {
    setSearchStats(searchResult.stats);
  }, [searchResult.stats]);

  return {
    results: searchResult.results,
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


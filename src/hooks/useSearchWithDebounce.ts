import { useState, useEffect, useCallback, useRef } from 'react';

import { Prompt } from '../types';
import { UseSearchWithDebounceReturn } from '../types/hooks';
import { debounce } from '../utils';

import { useSearch } from './useSearch';

const DEBOUNCE_DELAY = 300; // 300ms debounce delay

export const useSearchWithDebounce = (prompts: Prompt[]): UseSearchWithDebounceReturn => {
  const [inputQuery, setInputQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  // Derive isSearching from state (no need for separate state tracking)
  // We're searching if: input has value AND input differs from debounced value
  const isSearching = inputQuery.trim() !== '' && inputQuery !== debouncedQuery;

  // Use ref to store the debounced function to maintain reference stability
  const debouncedUpdateQuery = useRef(
    debounce((...args: unknown[]) => {
      const query = args[0] as string;
      setDebouncedQuery(query);
    }, DEBOUNCE_DELAY)
  );

  // Get search results using the existing useSearch hook
  const searchResults = useSearch(prompts, debouncedQuery);

  // Update debounced query when input changes
  useEffect(() => {
    // If query is empty, update immediately (no debounce for clear operations)
    if (inputQuery.trim() === '') {
      debouncedUpdateQuery.current.cancel();
      // Use setTimeout(0) to avoid synchronous setState in effect (works with fake timers)
      const timeoutId = setTimeout(() => {
        setDebouncedQuery('');
      }, 0);
      return () => {
        clearTimeout(timeoutId);
      };
    }

    // For non-empty queries, debounce the update
    debouncedUpdateQuery.current(inputQuery);
  }, [inputQuery]);

  // Cleanup on unmount
  useEffect(() => {
    const debouncedFunction = debouncedUpdateQuery.current;
    return () => {
      debouncedFunction.cancel();
    };
  }, []);

  const setQuery = useCallback((query: string) => {
    setInputQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    // Cancel any pending debounced updates
    debouncedUpdateQuery.current.cancel();
    setInputQuery('');
    setDebouncedQuery('');
    // Note: isSearching is derived, so no need to set it
  }, []);

  return {
    query: inputQuery,
    debouncedQuery,
    filteredPrompts: searchResults.filteredPrompts,
    highlightedResults: searchResults.highlightedResults,
    isSearching,
    setQuery,
    clearSearch
  };
};
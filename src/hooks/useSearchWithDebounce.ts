import { useState, useEffect, useCallback, useRef } from 'react';

import { Prompt } from '../types';
import { UseSearchWithDebounceReturn } from '../types/hooks';
import { debounce } from '../utils';

import { useSearch } from './useSearch';

const DEBOUNCE_DELAY = 300; // 300ms debounce delay

export const useSearchWithDebounce = (prompts: Prompt[]): UseSearchWithDebounceReturn => {
  const [inputQuery, setInputQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
  // Use ref to store the debounced function to maintain reference stability
  const debouncedUpdateQuery = useRef(
    debounce((...args: unknown[]) => {
      const query = args[0] as string;
      setDebouncedQuery(query);
      setIsSearching(false);
    }, DEBOUNCE_DELAY)
  );

  // Get search results using the existing useSearch hook
  const searchResults = useSearch(prompts, debouncedQuery);

  // Update debounced query when input changes
  useEffect(() => {
    // If query is empty, update immediately (no debounce for clear operations)
    if (inputQuery.trim() === '') {
      debouncedUpdateQuery.current.cancel();
      setDebouncedQuery('');
      setIsSearching(false);
      return;
    }

    // For non-empty queries, show loading state and debounce the update
    setIsSearching(true);
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
    setIsSearching(false);
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
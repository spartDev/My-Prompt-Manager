import { useCallback, useMemo } from 'react';

import { Prompt } from '../types';
import { UseSearchReturn } from '../types/hooks';
import { findTextHighlights } from '../utils';

export const useSearch = (prompts: Prompt[], query: string): UseSearchReturn => {
  const filteredPrompts = useMemo(() => {
    if (!query.trim()) {
      return prompts;
    }

    const searchTerm = query.toLowerCase().trim();
    return prompts.filter(prompt => 
      prompt.title.toLowerCase().includes(searchTerm) ||
      prompt.content.toLowerCase().includes(searchTerm) ||
      prompt.category.toLowerCase().includes(searchTerm)
    );
  }, [prompts, query]);

  const highlightedResults = useMemo(() => {
    if (!query.trim()) {
      return filteredPrompts.map(prompt => ({
        ...prompt,
        titleHighlights: [],
        contentHighlights: []
      }));
    }

    const searchTerm = query.toLowerCase().trim();

    return filteredPrompts.map(prompt => ({
      ...prompt,
      titleHighlights: findTextHighlights(prompt.title, searchTerm),
      contentHighlights: findTextHighlights(prompt.content, searchTerm)
    }));
  }, [filteredPrompts, query]);

  const clearSearch = useCallback(() => {
    // This will be handled by the parent component
  }, []);

  return {
    query,
    filteredPrompts,
    highlightedResults,
    clearSearch
  };
};
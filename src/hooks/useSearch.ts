import { useState, useCallback, useMemo } from 'react';
import { Prompt } from '../types';
import { UseSearchReturn, HighlightedPrompt, TextHighlight } from '../types/hooks';

export const useSearch = (prompts: Prompt[]): UseSearchReturn => {
  const [query, setQuery] = useState<string>('');

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
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    filteredPrompts,
    highlightedResults,
    clearSearch
  };
};

function findTextHighlights(text: string, searchTerm: string): TextHighlight[] {
  const highlights: TextHighlight[] = [];
  const lowerText = text.toLowerCase();
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  let startIndex = 0;
  let index = lowerText.indexOf(lowerSearchTerm, startIndex);
  
  while (index !== -1) {
    highlights.push({
      start: index,
      end: index + searchTerm.length,
      text: text.substring(index, index + searchTerm.length)
    });
    
    startIndex = index + searchTerm.length;
    index = lowerText.indexOf(lowerSearchTerm, startIndex);
  }
  
  return highlights;
}
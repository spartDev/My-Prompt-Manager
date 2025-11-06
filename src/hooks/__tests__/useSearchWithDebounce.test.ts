import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { Prompt } from '../../types';
import { useSearchWithDebounce } from '../useSearchWithDebounce';

const prompts: Prompt[] = [
  { id: '1', title: 'Hello World', content: 'Sample prompt', category: 'General', createdAt: 1, updatedAt: 1 },
  { id: '2', title: 'Meeting notes', content: 'Discuss quarterly goals', category: 'Work', createdAt: 2, updatedAt: 2 }
];

describe('useSearchWithDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Debouncing Behavior', () => {
    it('debounces search input and produces highlighted results', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Set query
      act(() => {
        result.current.setQuery('hello');
      });

      // Assert - Before debounce completes
      expect(result.current.isSearching).toBe(true);
      expect(result.current.query).toBe('hello');

      // Act - Advance time to complete debounce
      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - After debounce completes
      expect(result.current.debouncedQuery).toBe('hello');
      expect(result.current.isSearching).toBe(false);
      expect(result.current.highlightedResults[0].titleHighlights).toHaveLength(1);
    });

    it('cancels previous debounce when new query is entered', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Enter first query
      act(() => {
        result.current.setQuery('hello');
      });

      // Act - Enter second query before first completes (at 100ms)
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.setQuery('meeting');
      });

      // Act - Complete the second debounce
      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Only second query should be debounced, not first
      expect(result.current.debouncedQuery).toBe('meeting');
      expect(result.current.filteredPrompts).toHaveLength(1);
      expect(result.current.filteredPrompts[0].id).toBe('2');
    });

    it('does not debounce when clearing search', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Set a query first
      act(() => {
        result.current.setQuery('hello');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Act - Clear immediately (should not wait for debounce)
      act(() => {
        result.current.clearSearch();
      });

      // Assert - Cleared immediately without debounce delay
      expect(result.current.query).toBe('');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('Empty States', () => {
    it('handles empty prompt list', async () => {
      // Arrange
      const emptyPrompts: Prompt[] = [];
      const { result } = renderHook(() => useSearchWithDebounce(emptyPrompts));

      // Act - Search with empty list
      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Returns empty results
      expect(result.current.filteredPrompts).toEqual([]);
      expect(result.current.highlightedResults).toEqual([]);
    });

    it('handles empty query by returning all prompts', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Set empty query
      act(() => {
        result.current.setQuery('');
      });

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Assert - All prompts returned with no highlights
      expect(result.current.filteredPrompts).toHaveLength(2);
      expect(result.current.highlightedResults).toHaveLength(2);
      expect(result.current.highlightedResults[0].titleHighlights).toEqual([]);
      expect(result.current.highlightedResults[1].titleHighlights).toEqual([]);
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.isSearching).toBe(false);
    });

    it('handles whitespace-only query as empty', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Set whitespace query
      act(() => {
        result.current.setQuery('   ');
      });

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Assert - Treated as empty query
      expect(result.current.filteredPrompts).toHaveLength(2);
      expect(result.current.highlightedResults[0].titleHighlights).toEqual([]);
      expect(result.current.debouncedQuery).toBe('');
    });
  });

  describe('Search Functionality', () => {
    it('performs case-insensitive search', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Search with lowercase when title is capitalized
      act(() => {
        result.current.setQuery('hello world');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Finds the prompt despite case difference
      expect(result.current.filteredPrompts).toHaveLength(1);
      expect(result.current.filteredPrompts[0].title).toBe('Hello World');
    });

    it('searches across title, content, and category', async () => {
      // Arrange
      const testPrompts: Prompt[] = [
        { id: '1', title: 'Test Title', content: 'Content', category: 'General', createdAt: 1, updatedAt: 1 },
        { id: '2', title: 'Another', content: 'Test Content', category: 'Work', createdAt: 2, updatedAt: 2 },
        { id: '3', title: 'Different', content: 'Something', category: 'Test Category', createdAt: 3, updatedAt: 3 }
      ];
      const { result } = renderHook(() => useSearchWithDebounce(testPrompts));

      // Act - Search for 'test'
      act(() => {
        result.current.setQuery('test');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Finds all three prompts (matches in different fields)
      expect(result.current.filteredPrompts).toHaveLength(3);
    });

    it('handles special characters in search query', async () => {
      // Arrange
      const specialPrompts: Prompt[] = [
        { id: '1', title: 'C++ Tutorial', content: 'Learn C++', category: 'Code', createdAt: 1, updatedAt: 1 },
        { id: '2', title: 'Regular Expression', content: 'Use ^regex$', category: 'Code', createdAt: 2, updatedAt: 2 }
      ];
      const { result } = renderHook(() => useSearchWithDebounce(specialPrompts));

      // Act - Search with special characters
      act(() => {
        result.current.setQuery('c++');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Finds prompt with special characters
      expect(result.current.filteredPrompts).toHaveLength(1);
      expect(result.current.filteredPrompts[0].title).toBe('C++ Tutorial');
    });

    it('handles partial word matches', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Search with partial word
      act(() => {
        result.current.setQuery('meet');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Finds 'Meeting notes'
      expect(result.current.filteredPrompts).toHaveLength(1);
      expect(result.current.filteredPrompts[0].title).toBe('Meeting notes');
    });

    it('returns no results when query matches nothing', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Search for non-existent term
      act(() => {
        result.current.setQuery('nonexistent');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Empty results
      expect(result.current.filteredPrompts).toHaveLength(0);
      expect(result.current.highlightedResults).toHaveLength(0);
    });
  });

  describe('Highlight Generation', () => {
    it('generates highlights for matching query', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Search for 'hello'
      act(() => {
        result.current.setQuery('hello');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Has highlights
      expect(result.current.highlightedResults).toHaveLength(1);
      expect(result.current.highlightedResults[0].titleHighlights).toHaveLength(1);
      expect(result.current.highlightedResults[0].titleHighlights[0]).toEqual({
        start: 0,
        end: 5,
        text: 'Hello'
      });
    });

    it('does not generate highlights for empty query', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Start with a query, then clear
      act(() => {
        result.current.setQuery('hello');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.clearSearch();
      });

      // Assert - No highlights after clear
      expect(result.current.highlightedResults[0].titleHighlights).toEqual([]);
      expect(result.current.highlightedResults[1].titleHighlights).toEqual([]);
    });
  });

  describe('isSearching State', () => {
    it('sets isSearching to true when query is entered', () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Set query
      act(() => {
        result.current.setQuery('hello');
      });

      // Assert - Searching before debounce completes
      expect(result.current.isSearching).toBe(true);
    });

    it('sets isSearching to false after debounce completes', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Set query and wait
      act(() => {
        result.current.setQuery('hello');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Not searching after debounce
      expect(result.current.isSearching).toBe(false);
    });

    it('sets isSearching to false for empty query', () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Set empty query
      act(() => {
        result.current.setQuery('');
      });

      // Assert - Not searching with empty query
      expect(result.current.isSearching).toBe(false);
    });

    it('updates isSearching correctly when query changes rapidly', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Rapid query changes
      act(() => {
        result.current.setQuery('h');
      });
      expect(result.current.isSearching).toBe(true);

      act(() => {
        result.current.setQuery('he');
      });
      expect(result.current.isSearching).toBe(true);

      act(() => {
        result.current.setQuery('hel');
      });
      expect(result.current.isSearching).toBe(true);

      // Act - Complete debounce
      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - Not searching after final debounce
      expect(result.current.isSearching).toBe(false);
      expect(result.current.debouncedQuery).toBe('hel');
    });
  });

  describe('Query State Management', () => {
    it('clears search results immediately when cleared', () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - Set query then clear
      act(() => {
        result.current.setQuery('notes');
      });
      act(() => {
        result.current.clearSearch();
      });

      // Assert - Everything cleared
      expect(result.current.query).toBe('');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.isSearching).toBe(false);
      expect(result.current.highlightedResults[0].titleHighlights).toHaveLength(0);
    });

    it('maintains query state correctly when switching between values', async () => {
      // Arrange
      const { result } = renderHook(() => useSearchWithDebounce(prompts));

      // Act - First query
      act(() => {
        result.current.setQuery('hello');
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - First query completed
      expect(result.current.query).toBe('hello');
      expect(result.current.debouncedQuery).toBe('hello');

      // Act - Second query
      act(() => {
        result.current.setQuery('meeting');
      });

      // Assert - Before second debounce
      expect(result.current.query).toBe('meeting');
      expect(result.current.debouncedQuery).toBe('hello');
      expect(result.current.isSearching).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });

      // Assert - After second debounce
      expect(result.current.query).toBe('meeting');
      expect(result.current.debouncedQuery).toBe('meeting');
      expect(result.current.isSearching).toBe(false);
    });
  });
});

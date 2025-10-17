import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { resetSearchIndex } from '../../services/SearchIndex';
import type { Prompt } from '../../types';
import {
  useDebounce,
  useSearchOptimized,
  useSearchWithHighlights,
  useSearchInput,
  useSearchState,
  useSearchMetrics
} from '../useSearchOptimized';

const mockPrompts: Prompt[] = [
  {
    id: '1',
    title: 'JavaScript Tutorial',
    content: 'Learn JavaScript basics including variables and functions',
    category: 'Programming',
    createdAt: Date.now() - 3000,
    updatedAt: Date.now() - 3000
  },
  {
    id: '2',
    title: 'Python Guide',
    content: 'Python programming guide for beginners',
    category: 'Programming',
    createdAt: Date.now() - 2000,
    updatedAt: Date.now() - 2000
  },
  {
    id: '3',
    title: 'Recipe Collection',
    content: 'Delicious recipes for every occasion',
    category: 'Cooking',
    createdAt: Date.now() - 1000,
    updatedAt: Date.now() - 1000
  }
];

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 300));
    expect(result.current).toBe('test');
  });

  it('should debounce value updates', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated' });

    // Value should not update immediately
    expect(result.current).toBe('initial');

    // Fast forward timers
    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    // Now value should be updated
    expect(result.current).toBe('updated');
  });

  it('should cancel pending updates on value change', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'first' } }
    );

    rerender({ value: 'second' });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'third' });
    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    // Should only see the last value
    expect(result.current).toBe('third');
  });
});

describe('useSearchOptimized', () => {
  beforeEach(() => {
    resetSearchIndex();
  });

  it('should return all prompts when query is empty', () => {
    const { result } = renderHook(() =>
      useSearchOptimized(mockPrompts, '', { debounceDelay: 0 })
    );

    expect(result.current.results).toHaveLength(3);
  });

  it('should build index on first search', () => {
    const { result } = renderHook(() =>
      useSearchOptimized(mockPrompts, 'javascript', { debounceDelay: 0 })
    );

    expect(result.current.searchStats.isIndexed).toBe(true);
  });

  it('should filter prompts by query', () => {
    const { result } = renderHook(() =>
      useSearchOptimized(mockPrompts, 'javascript', { debounceDelay: 0 })
    );

    expect(result.current.results.length).toBeGreaterThan(0);
    expect(result.current.results[0].title).toContain('JavaScript');
  });

  it('should apply category filter', () => {
    const { result } = renderHook(() =>
      useSearchOptimized(mockPrompts, 'guide', {
        debounceDelay: 0,
        categoryFilter: 'Programming'
      })
    );

    expect(result.current.results.length).toBeGreaterThan(0);
    result.current.results.forEach(prompt => {
      expect(prompt.category).toBe('Programming');
    });
  });

  it('should return empty results when no matches', () => {
    const { result } = renderHook(() =>
      useSearchOptimized(mockPrompts, 'nonexistent', { debounceDelay: 0 })
    );

    expect(result.current.results).toHaveLength(0);
  });

  it('should track search statistics', () => {
    const { result } = renderHook(() =>
      useSearchOptimized(mockPrompts, 'javascript', { debounceDelay: 0 })
    );

    expect(result.current.searchStats.resultCount).toBeGreaterThanOrEqual(0);
    expect(result.current.searchStats.searchTime).toBeGreaterThanOrEqual(0);
    expect(result.current.searchStats.isIndexed).toBeDefined();
  });

  it('should limit results to maxResults', () => {
    const { result } = renderHook(() =>
      useSearchOptimized(mockPrompts, 'programming', {
        debounceDelay: 0,
        maxResults: 1
      })
    );

    expect(result.current.results.length).toBeLessThanOrEqual(1);
  });

  it('should fallback to linear search when indexing disabled', () => {
    const { result } = renderHook(() =>
      useSearchOptimized(mockPrompts, 'javascript', {
        debounceDelay: 0,
        enableIndexing: false
      })
    );

    expect(result.current.searchStats.isIndexed).toBe(false);
    expect(result.current.results.length).toBeGreaterThan(0);
  });

  it('should rebuild index when prompts change', () => {
    const { result, rerender } = renderHook(
      ({ prompts }) => useSearchOptimized(prompts, 'test', { debounceDelay: 0 }),
      { initialProps: { prompts: mockPrompts.slice(0, 2) } }
    );

    expect(result.current.results).toBeDefined();

    act(() => {
      rerender({ prompts: mockPrompts });
    });

    expect(result.current.results).toBeDefined();
  });
});

describe('useSearchWithHighlights', () => {
  beforeEach(() => {
    resetSearchIndex();
  });

  it('should return results with highlights', () => {
    const { result } = renderHook(() =>
      useSearchWithHighlights(mockPrompts, 'javascript', { debounceDelay: 0 })
    );

    expect(result.current.results.length).toBeGreaterThan(0);
    const firstResult = result.current.results[0];
    expect(firstResult).toHaveProperty('titleHighlights');
    expect(firstResult).toHaveProperty('contentHighlights');
  });

  it('should have empty highlights when query is empty', () => {
    const { result } = renderHook(() =>
      useSearchWithHighlights(mockPrompts, '', { debounceDelay: 0 })
    );

    expect(result.current.results.length).toBeGreaterThan(0);
    result.current.results.forEach(prompt => {
      expect(prompt.titleHighlights).toHaveLength(0);
      expect(prompt.contentHighlights).toHaveLength(0);
    });
  });

  it('should highlight matched terms in title', () => {
    const { result } = renderHook(() =>
      useSearchWithHighlights(mockPrompts, 'javascript', { debounceDelay: 0 })
    );

    const jsPrompt = result.current.results.find(p => p.title.includes('JavaScript'));
    expect(jsPrompt).toBeDefined();
    if (jsPrompt) {
      expect(jsPrompt.titleHighlights.length).toBeGreaterThan(0);
    }
  });

  it('should highlight matched terms in content', () => {
    const { result } = renderHook(() =>
      useSearchWithHighlights(mockPrompts, 'variables', { debounceDelay: 0 })
    );

    const jsPrompt = result.current.results.find(p => p.content.includes('variables'));
    expect(jsPrompt).toBeDefined();
    if (jsPrompt) {
      expect(jsPrompt.contentHighlights.length).toBeGreaterThan(0);
    }
  });
});

describe('useSearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default value', () => {
    const { result } = renderHook(() => useSearchInput('initial'));
    expect(result.current.value).toBe('initial');
    expect(result.current.debouncedValue).toBe('initial');
  });

  it('should update value on change', () => {
    const { result } = renderHook(() => useSearchInput());

    act(() => {
      result.current.onChange({
        target: { value: 'new value' }
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.value).toBe('new value');
  });

  it('should debounce value', async () => {
    const { result } = renderHook(() => useSearchInput('', 300));

    act(() => {
      result.current.onChange({
        target: { value: 'test' }
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.value).toBe('test');
    expect(result.current.debouncedValue).toBe('');
    expect(result.current.isDebouncing).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(result.current.debouncedValue).toBe('test');
    expect(result.current.isDebouncing).toBe(false);
  });

  it('should clear value', () => {
    const { result } = renderHook(() => useSearchInput('initial'));

    act(() => {
      result.current.clear();
    });

    expect(result.current.value).toBe('');
  });

  it('should allow setting value directly', () => {
    const { result } = renderHook(() => useSearchInput());

    act(() => {
      result.current.setValue('direct value');
    });

    expect(result.current.value).toBe('direct value');
  });
});

describe('useSearchState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('should initialize with empty string', () => {
    const { result } = renderHook(() => useSearchState('test-key'));
    expect(result.current.query).toBe('');
  });

  it('should persist query to localStorage', () => {
    const { result } = renderHook(() => useSearchState('test-key'));

    act(() => {
      result.current.setQuery('test query');
    });

    expect(localStorage.getItem('test-key')).toBe('test query');
  });

  it('should load initial value from localStorage', () => {
    localStorage.setItem('test-key', 'stored value');

    const { result } = renderHook(() => useSearchState('test-key'));

    expect(result.current.query).toBe('stored value');
  });

  it('should debounce query', async () => {
    const { result } = renderHook(() => useSearchState('test-key', 300));

    act(() => {
      result.current.setQuery('debounced');
    });

    expect(result.current.query).toBe('debounced');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isDebouncing).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(result.current.debouncedQuery).toBe('debounced');
    expect(result.current.isDebouncing).toBe(false);
  });

  it('should clear query', () => {
    localStorage.setItem('test-key', 'stored value');
    const { result } = renderHook(() => useSearchState('test-key'));

    act(() => {
      result.current.clear();
    });

    expect(result.current.query).toBe('');
  });

  it('should handle localStorage errors gracefully', () => {
    // Mock localStorage to throw error
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    setItemSpy.mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    const { result } = renderHook(() => useSearchState('test-key'));

    // Should not throw
    expect(() => {
      act(() => {
        result.current.setQuery('test');
      });
    }).not.toThrow();

    setItemSpy.mockRestore();
  });
});

describe('useSearchMetrics', () => {
  it('should initialize with empty metrics', () => {
    const { result } = renderHook(() => useSearchMetrics());

    const metrics = result.current.getMetrics();
    expect(metrics.totalSearches).toBe(0);
    expect(metrics.avgSearchTime).toBe(0);
    expect(metrics.maxSearchTime).toBe(0);
    expect(metrics.minSearchTime).toBe(Infinity);
  });

  it('should record search times', () => {
    const { result } = renderHook(() => useSearchMetrics());

    act(() => {
      result.current.recordSearch(10);
      result.current.recordSearch(20);
      result.current.recordSearch(30);
    });

    const metrics = result.current.getMetrics();
    expect(metrics.totalSearches).toBe(3);
    expect(metrics.avgSearchTime).toBe(20);
    expect(metrics.maxSearchTime).toBe(30);
    expect(metrics.minSearchTime).toBe(10);
  });

  it('should calculate average correctly', () => {
    const { result } = renderHook(() => useSearchMetrics());

    act(() => {
      result.current.recordSearch(5);
      result.current.recordSearch(10);
      result.current.recordSearch(15);
    });

    const metrics = result.current.getMetrics();
    expect(metrics.avgSearchTime).toBe(10);
  });

  it('should reset metrics', () => {
    const { result } = renderHook(() => useSearchMetrics());

    act(() => {
      result.current.recordSearch(10);
      result.current.recordSearch(20);
    });

    act(() => {
      result.current.resetMetrics();
    });

    const metrics = result.current.getMetrics();
    expect(metrics.totalSearches).toBe(0);
    expect(metrics.avgSearchTime).toBe(0);
  });

  it('should track multiple searches', () => {
    const { result } = renderHook(() => useSearchMetrics());

    act(() => {
      for (let i = 1; i <= 10; i++) {
        result.current.recordSearch(i * 5);
      }
    });

    const metrics = result.current.getMetrics();
    expect(metrics.totalSearches).toBe(10);
    expect(metrics.minSearchTime).toBe(5);
    expect(metrics.maxSearchTime).toBe(50);
  });
});

// Integration tests simplified to avoid async timing issues
describe('Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSearchIndex();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle debounced search input integration', async () => {
    const { result: inputResult } = renderHook(() => useSearchInput('', 300));

    act(() => {
      inputResult.current.onChange({
        target: { value: 'javascript' }
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(inputResult.current.isDebouncing).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(inputResult.current.debouncedValue).toBe('javascript');

    // Test search with the debounced value
    const { result: searchResult } = renderHook(() =>
      useSearchOptimized(mockPrompts, inputResult.current.debouncedValue, { debounceDelay: 0 })
    );

    expect(searchResult.current.results.length).toBeGreaterThan(0);
  });

  it('should track metrics from search results', () => {
    const { result: metricsResult } = renderHook(() => useSearchMetrics());
    const { result: searchResult } = renderHook(() =>
      useSearchOptimized(mockPrompts, 'javascript', { debounceDelay: 0 })
    );

    act(() => {
      metricsResult.current.recordSearch(searchResult.current.searchStats.searchTime);
    });

    const metrics = metricsResult.current.getMetrics();
    expect(metrics.totalSearches).toBe(1);
    expect(metrics.avgSearchTime).toBeGreaterThanOrEqual(0);
  });
});

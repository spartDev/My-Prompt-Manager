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

  it('debounces search input and produces highlighted results', async () => {
    const { result } = renderHook(() => useSearchWithDebounce(prompts));

    act(() => {
      result.current.setQuery('hello');
    });
    expect(result.current.isSearching).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(result.current.debouncedQuery).toBe('hello');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.highlightedResults[0].titleHighlights).toHaveLength(1);
  });

  it('clears search results immediately when cleared', () => {
    const { result } = renderHook(() => useSearchWithDebounce(prompts));

    act(() => {
      result.current.setQuery('notes');
    });
    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.query).toBe('');
    expect(result.current.debouncedQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.highlightedResults[0].titleHighlights).toHaveLength(0);
  });
});

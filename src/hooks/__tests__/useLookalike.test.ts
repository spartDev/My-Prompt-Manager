import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateSimilarityOptimized } from '../../services/SimilarityAlgorithms';
import type { Prompt } from '../../types';
import { LOOKALIKE_PAUSE_MS, LOOKALIKE_TASK_BUDGET_MS, useLookalike } from '../useLookalike';

// The real comparison, watched: how much of it runs at once is what keeps the editor responsive
vi.mock('../../services/SimilarityAlgorithms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/SimilarityAlgorithms')>();
  return { ...actual, calculateSimilarityOptimized: vi.fn(actual.calculateSimilarityOptimized) };
});
const comparisons = vi.mocked(calculateSimilarityOptimized);

const TEXT = 'Summarize this article in three bullets.';
const libraryPrompt = (i: number, content: string): Prompt => ({
  id: `p${String(i)}`,
  title: `Prompt ${String(i)}`,
  content,
  category: 'Uncategorized',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000
});
// A large Library, none of it alike enough, and the one alike Prompt last
const LIBRARY = [
  ...Array.from({ length: 40 }, (_, i) => libraryPrompt(i, `Unrelated text number ${String(i)} here.`)),
  libraryPrompt(999, `${TEXT} Please.`)
];

/** Runs the next task: the pending timer that is due first */
const nextTask = () => act(() => { vi.advanceTimersToNextTimer(); });

describe('useLookalike', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    comparisons.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    comparisons.mockReset();
  });

  it('compares nothing until typing pauses, then finds the Lookalike', async () => {
    const { result } = renderHook(() => useLookalike(TEXT, LIBRARY));

    expect(comparisons).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(LOOKALIKE_PAUSE_MS); });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current?.prompt.id).toBe('p999');
  });

  /** Each comparison takes `ms` on the task's clock */
  const comparisonsTake = (ms: number) => {
    let clock = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    comparisons.mockImplementation(() => {
      clock += ms;
      return -1;
    });
  };

  it('yields after a comparison that uses up the task budget, so no task holds the editor for long', () => {
    comparisonsTake(LOOKALIKE_TASK_BUDGET_MS);
    renderHook(() => useLookalike(TEXT, LIBRARY));
    act(() => { vi.advanceTimersByTime(LOOKALIKE_PAUSE_MS); });

    expect(comparisons).toHaveBeenCalledTimes(1);
    nextTask();
    expect(comparisons).toHaveBeenCalledTimes(2);
  });

  it('runs as many quick comparisons in one task as its budget allows', () => {
    comparisonsTake(1);
    renderHook(() => useLookalike(TEXT, LIBRARY));
    act(() => { vi.advanceTimersByTime(LOOKALIKE_PAUSE_MS); });

    expect(comparisons).toHaveBeenCalledTimes(LOOKALIKE_TASK_BUDGET_MS);
  });

  it('drops a scan as soon as the text changes', async () => {
    const { result, rerender } = renderHook(({ text }) => useLookalike(text, LIBRARY), { initialProps: { text: TEXT } });
    act(() => { vi.advanceTimersByTime(LOOKALIKE_PAUSE_MS); });
    const startedWithOldText = comparisons.mock.calls.length;

    rerender({ text: 'Something else entirely, typed after.' });
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(comparisons.mock.calls.filter(([a]) => a === TEXT)).toHaveLength(startedWithOldText);
    expect(result.current).toBeNull();
  });
});

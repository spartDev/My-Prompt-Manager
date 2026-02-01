import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useNow } from '../useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the current timestamp on initial render', () => {
    const mockNow = 1700000000000;
    vi.setSystemTime(mockNow);

    const { result } = renderHook(() => useNow());

    expect(result.current).toBe(mockNow);
  });

  it('updates timestamp at the specified interval', () => {
    const initialTime = 1700000000000;
    vi.setSystemTime(initialTime);

    const { result } = renderHook(() => useNow(60000));

    expect(result.current).toBe(initialTime);

    // Advance time by 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Should have updated
    expect(result.current).toBe(initialTime + 60000);

    // Advance another 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current).toBe(initialTime + 120000);
  });

  it('uses default interval of 60000ms when not specified', () => {
    const initialTime = 1700000000000;
    vi.setSystemTime(initialTime);

    const { result } = renderHook(() => useNow());

    expect(result.current).toBe(initialTime);

    // Advance by less than 60 seconds - should not update
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(result.current).toBe(initialTime);

    // Advance to complete the 60 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(result.current).toBe(initialTime + 60000);
  });

  it('respects custom interval', () => {
    const initialTime = 1700000000000;
    vi.setSystemTime(initialTime);

    // Use a 10 second interval
    const { result } = renderHook(() => useNow(10000));

    expect(result.current).toBe(initialTime);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(result.current).toBe(initialTime + 10000);
  });

  it('cleans up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = renderHook(() => useNow());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });

  it('updates interval when interval prop changes', () => {
    const initialTime = 1700000000000;
    vi.setSystemTime(initialTime);

    const { result, rerender } = renderHook(
      ({ interval }) => useNow(interval),
      { initialProps: { interval: 60000 } }
    );

    // Advance 30 seconds - should not update yet
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(result.current).toBe(initialTime);

    // Change to 10 second interval
    rerender({ interval: 10000 });

    // Now 10 seconds later should update
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Time is now initialTime + 30000 + 10000 = initialTime + 40000
    expect(result.current).toBe(initialTime + 40000);
  });

  it('triggers re-render when timestamp updates', () => {
    const initialTime = 1700000000000;
    vi.setSystemTime(initialTime);

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useNow(60000);
    });

    const initialRenderCount = renderCount;

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Should have re-rendered
    expect(renderCount).toBeGreaterThan(initialRenderCount);
    expect(result.current).toBe(initialTime + 60000);
  });
});

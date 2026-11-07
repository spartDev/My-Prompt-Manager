import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnimatedPresence } from '../useAnimatedPresence';

const EXIT_MS = 320;

describe('useAnimatedPresence', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows nothing while closed', () => {
    const { result } = renderHook(() => useAnimatedPresence<string>(null, EXIT_MS));

    expect(result.current).toEqual({ shown: null, exiting: false });
  });

  it('shows the value as soon as it opens', () => {
    const { result } = renderHook(() => useAnimatedPresence<string>('editor', EXIT_MS));

    expect(result.current).toEqual({ shown: 'editor', exiting: false });
  });

  it('keeps the value, leaving, for the exit duration once closed', () => {
    const { result, rerender } = renderHook(({ value }) => useAnimatedPresence<string>(value, EXIT_MS), {
      initialProps: { value: 'editor' as string | null }
    });

    rerender({ value: null });
    expect(result.current).toEqual({ shown: 'editor', exiting: true });

    act(() => { vi.advanceTimersByTime(EXIT_MS - 1); });
    expect(result.current).toEqual({ shown: 'editor', exiting: true });

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toEqual({ shown: null, exiting: false });
  });

  it('cancels the unmount when it opens again while leaving', () => {
    const { result, rerender } = renderHook(({ value }) => useAnimatedPresence<string>(value, EXIT_MS), {
      initialProps: { value: 'editor' as string | null }
    });

    rerender({ value: null });
    act(() => { vi.advanceTimersByTime(EXIT_MS / 2); });
    rerender({ value: 'editor again' });
    expect(result.current).toEqual({ shown: 'editor again', exiting: false });

    act(() => { vi.advanceTimersByTime(EXIT_MS * 2); });
    expect(result.current).toEqual({ shown: 'editor again', exiting: false });
  });

  it('leaves no timer behind when it unmounts', () => {
    const { rerender, unmount } = renderHook(({ value }) => useAnimatedPresence<string>(value, EXIT_MS), {
      initialProps: { value: 'editor' as string | null }
    });

    rerender({ value: null });
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves at once under prefers-reduced-motion', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    const { result, rerender } = renderHook(({ value }) => useAnimatedPresence<string>(value, EXIT_MS), {
      initialProps: { value: 'editor' as string | null }
    });

    rerender({ value: null });
    act(() => { vi.advanceTimersByTime(0); });

    expect(result.current).toEqual({ shown: null, exiting: false });
  });
});

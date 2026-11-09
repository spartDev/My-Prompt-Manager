import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCountUp } from '../useCountUp';

const setReducedMotion = (reduce: boolean) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
};

describe('useCountUp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows the final value at once under reduced motion', () => {
    setReducedMotion(true);

    const { result } = renderHook(() => useCountUp(124, 800));

    expect(result.current).toBe(124);
  });

  it('counts up from 0 to the value over the duration', async () => {
    setReducedMotion(false);
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });

    const { result } = renderHook(() => useCountUp(124, 800));
    expect(result.current).toBe(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(124);

    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(result.current).toBe(124);
  });
});

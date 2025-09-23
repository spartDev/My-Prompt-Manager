import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useToast } from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds and automatically removes toasts after the duration elapses', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Hello', 'success', 1000);
    });

    expect(result.current.toasts).toHaveLength(1);
    const toastId = result.current.toasts[0]?.id;
    expect(toastId).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('allows manual dismissal of toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Manual hide', 'info', 0);
    });

    const toastId = result.current.toasts[0]?.id;
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      if (toastId) {
        result.current.hideToast(toastId);
      }
    });

    expect(result.current.toasts).toHaveLength(0);

    act(() => {
      result.current.showToast('Another', 'info', 0);
      result.current.showToast('Second', 'info', 0);
    });
    expect(result.current.toasts).toHaveLength(2);

    act(() => {
      result.current.clearAllToasts();
    });

    expect(result.current.toasts).toHaveLength(0);
  });
});

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

  it('adds toasts with correct properties', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Hello', 'success', 1000);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.message).toBe('Hello');
    expect(result.current.toasts[0]?.type).toBe('success');
    expect(result.current.toasts[0]?.duration).toBe(1000);
    const toastId = result.current.toasts[0]?.id;
    expect(toastId).toBeTruthy();

    // Manual dismissal works
    act(() => {
      if (toastId) {
        result.current.hideToast(toastId);
      }
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('allows manual dismissal and queue management', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Manual hide', 'info', 5000);
    });

    const toastId = result.current.toasts[0]?.id;
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      if (toastId) {
        result.current.hideToast(toastId);
      }
    });

    expect(result.current.toasts).toHaveLength(0);

    // With queue system, only one toast shows at a time
    act(() => {
      result.current.showToast('First', 'info', 5000);
    });

    act(() => {
      result.current.showToast('Second', 'info', 5000);
    });

    // First toast shows immediately, second is queued
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.message).toBe('First');

    act(() => {
      result.current.clearAllToasts();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('supports warning type with correct duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Warning message', 'warning');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.type).toBe('warning');
    expect(result.current.toasts[0]?.duration).toBe(5000);
    expect(result.current.toasts[0]?.message).toBe('Warning message');
  });

  it('truncates messages longer than 80 characters', () => {
    const { result } = renderHook(() => useToast());
    const longMessage = 'A'.repeat(100);

    act(() => {
      result.current.showToast(longMessage, 'info');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.message).toHaveLength(80);
    expect(result.current.toasts[0]?.message).toMatch(/\.\.\.$/);
  });

  it('applies correct durations for all toast types', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Error', 'error');
    });
    expect(result.current.toasts[0]?.duration).toBe(7000);

    act(() => {
      result.current.clearAllToasts();
    });

    act(() => {
      result.current.showToast('Warning', 'warning');
    });
    expect(result.current.toasts[0]?.duration).toBe(5000);

    act(() => {
      result.current.clearAllToasts();
    });

    act(() => {
      result.current.showToast('Success', 'success');
    });
    expect(result.current.toasts[0]?.duration).toBe(2750);

    act(() => {
      result.current.clearAllToasts();
    });

    act(() => {
      result.current.showToast('Info', 'info');
    });
    expect(result.current.toasts[0]?.duration).toBe(2750);
  });

  it('supports action buttons', () => {
    const { result } = renderHook(() => useToast());
    const mockAction = vi.fn();

    act(() => {
      result.current.showToast('Action toast', 'info', 5000, {
        label: 'Undo',
        onClick: mockAction
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.action).toBeDefined();
    expect(result.current.toasts[0]?.action?.label).toBe('Undo');
  });

  it('tracks queue length', async () => {
    const { result } = renderHook(() => useToast());

    // Wait for settings to load
    await vi.waitFor(() => {
      expect(result.current.settings).toBeDefined();
    });

    act(() => {
      result.current.showToast('First', 'info');
    });

    act(() => {
      result.current.showToast('Second', 'info');
    });

    act(() => {
      result.current.showToast('Third', 'info');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.queueLength).toBe(2);
  });

  it('respects enabled types setting', () => {
    const { result } = renderHook(() => useToast());

    // Disable info toasts
    act(() => {
      result.current.updateSettings({
        enabledTypes: {
          success: true,
          error: true,
          info: false,
          warning: true
        }
      });
    });

    act(() => {
      result.current.showToast('Info message', 'info');
    });

    // Should not show disabled type
    expect(result.current.toasts).toHaveLength(0);

    act(() => {
      result.current.showToast('Success message', 'success');
    });

    // Should show enabled type
    expect(result.current.toasts).toHaveLength(1);
  });

  it('handles synchronous toast calls without dropping toasts', () => {
    const { result } = renderHook(() => useToast());

    // Fire two toasts synchronously (in the same tick)
    act(() => {
      result.current.showToast('First toast', 'info');
      result.current.showToast('Second toast', 'success');
    });

    // First should be displayed, second should be queued
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.message).toBe('First toast');
    expect(result.current.queueLength).toBe(1);

    // Fire three toasts synchronously when no toast is displayed
    act(() => {
      result.current.clearAllToasts();
    });

    act(() => {
      result.current.showToast('Toast A', 'info');
      result.current.showToast('Toast B', 'warning');
      result.current.showToast('Toast C', 'error');
    });

    // First should display, other two should be queued
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]?.message).toBe('Toast A');
    expect(result.current.queueLength).toBe(2);
  });
});

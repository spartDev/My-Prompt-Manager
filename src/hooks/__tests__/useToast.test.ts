import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useToast } from '../useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Mock chrome.storage.local to return immediately
    vi.spyOn(chrome.storage.local, 'get').mockResolvedValue({});
    vi.spyOn(chrome.storage.local, 'set').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

    // Wait for settings to load (useEffect with chrome.storage.local.get)
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.settings).toBeDefined();

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

  describe('error handling', () => {
    it('handles action onClick errors gracefully', () => {
      const { result } = renderHook(() => useToast());

      const errorAction = {
        label: 'Error Action',
        onClick: () => {
          throw new Error('Action failed');
        }
      };

      act(() => {
        result.current.showToast('Test', 'info', 5000, errorAction);
      });

      const toast = result.current.toasts[0];
      expect(toast).toBeDefined();
      expect(toast?.action).toBeDefined();

      // Should not crash when action throws
      expect(() => toast?.action?.onClick()).toThrow('Action failed');

      // Toast should still be dismissible
      act(() => {
        if (toast?.id) {
          result.current.hideToast(toast.id);
        }
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('handles exactly 80 character messages', () => {
      const { result } = renderHook(() => useToast());

      const exactly80 = 'a'.repeat(80);

      act(() => {
        result.current.showToast(exactly80, 'info');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]?.message).toBe(exactly80);
      expect(result.current.toasts[0]?.message).toHaveLength(80);
    });

    it('handles 79 character messages without truncation', () => {
      const { result } = renderHook(() => useToast());

      const exactly79 = 'b'.repeat(79);

      act(() => {
        result.current.showToast(exactly79, 'info');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]?.message).toBe(exactly79);
      expect(result.current.toasts[0]?.message).toHaveLength(79);
    });

    it('handles 81 character messages with truncation', () => {
      const { result } = renderHook(() => useToast());

      const exactly81 = 'c'.repeat(81);

      act(() => {
        result.current.showToast(exactly81, 'info');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]?.message).toHaveLength(80);
      expect(result.current.toasts[0]?.message).toMatch(/\.\.\.$/);
      expect(result.current.toasts[0]?.message).toMatch(/^c+\.\.\.$/);
    });

    it('preserves queue when clearing displayed toast', async () => {
      const { result } = renderHook(() => useToast());

      // Add multiple toasts quickly
      act(() => {
        result.current.showToast('First', 'success');
        result.current.showToast('Second', 'error');
        result.current.showToast('Third', 'warning');
      });

      // First should display, other two should be queued
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]?.message).toBe('First');
      expect(result.current.queueLength).toBe(2);

      // Clear the displayed toast
      const firstToastId = result.current.toasts[0]?.id;
      act(() => {
        if (firstToastId) {
          result.current.hideToast(firstToastId);
        }
      });

      // Queue should still have items
      expect(result.current.queueLength).toBe(2);

      // Next toast should be processed from queue
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]?.message).toBe('Second');
      expect(result.current.queueLength).toBe(1);
    });

    it('handles empty message strings', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('', 'info');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]?.message).toBe('');
    });

    it('handles whitespace-only messages', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('   ', 'info');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]?.message).toBe('   ');
    });
  });

  describe('settings persistence', () => {
    it('loads settings from storage on mount', async () => {
      const mockSettings = {
        toast_settings: {
          position: 'bottom-left',
          enabledTypes: {
            success: true,
            error: true,
            info: false,
            warning: true
          },
          enableGrouping: false,
          groupingWindow: 1000
        }
      };

      vi.mocked(chrome.storage.local.get).mockResolvedValue(mockSettings);

      const { result } = renderHook(() => useToast());

      // Wait for settings to load
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.settings).toBeDefined();
      expect(result.current.settings.position).toBe('bottom-left');
      expect(result.current.settings.enabledTypes.info).toBe(false);
      expect(result.current.settings.enableGrouping).toBe(false);
      expect(result.current.settings.groupingWindow).toBe(1000);
    });

    it('uses default settings when storage is empty', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({});

      const { result } = renderHook(() => useToast());

      // Wait for settings to load
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.settings).toBeDefined();
      expect(result.current.settings.position).toBe('top-right');
      expect(result.current.settings.enabledTypes.info).toBe(true);
      expect(result.current.settings.enableGrouping).toBe(true);
      expect(result.current.settings.groupingWindow).toBe(500);
    });

    it('saves settings to storage when updated', async () => {
      const { result } = renderHook(() => useToast());

      const newSettings = {
        position: 'bottom-right' as const,
        enabledTypes: {
          success: true,
          error: true,
          info: false,
          warning: false
        }
      };

      act(() => {
        result.current.updateSettings(newSettings);
      });

      // Wait for async storage operation
      await act(async () => {
        await Promise.resolve();
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        toast_settings: expect.objectContaining({
          position: 'bottom-right',
          enabledTypes: {
            success: true,
            error: true,
            info: false,
            warning: false
          }
        })
      });
    });

    it('handles storage errors gracefully when loading', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(chrome.storage.local.get).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useToast());

      // Wait for settings load attempt
      await act(async () => {
        await Promise.resolve();
      });

      // Should use default settings on error
      expect(result.current.settings).toBeDefined();
      expect(result.current.settings.position).toBe('top-right');

      consoleErrorSpy.mockRestore();
    });

    it('handles storage errors gracefully when saving', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.updateSettings({ position: 'bottom-left' });
      });

      // Wait for async storage operation
      await act(async () => {
        await Promise.resolve();
      });

      // Settings should still update in memory despite storage error
      expect(result.current.settings.position).toBe('bottom-left');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('queue processing', () => {
    it('processes queue in FIFO order', async () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('First', 'info');
        result.current.showToast('Second', 'success');
        result.current.showToast('Third', 'warning');
      });

      expect(result.current.toasts[0]?.message).toBe('First');

      // Dismiss first toast
      const firstId = result.current.toasts[0]?.id;
      act(() => {
        if (firstId) {
          result.current.hideToast(firstId);
        }
      });

      // Wait for queue processing
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.toasts[0]?.message).toBe('Second');

      // Dismiss second toast
      const secondId = result.current.toasts[0]?.id;
      act(() => {
        if (secondId) {
          result.current.hideToast(secondId);
        }
      });

      // Wait for queue processing
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.toasts[0]?.message).toBe('Third');
    });

    it('clears entire queue when clearAllToasts is called', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('First', 'info');
        result.current.showToast('Second', 'success');
        result.current.showToast('Third', 'warning');
        result.current.showToast('Fourth', 'error');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.queueLength).toBe(3);

      act(() => {
        result.current.clearAllToasts();
      });

      expect(result.current.toasts).toHaveLength(0);
      expect(result.current.queueLength).toBe(0);
    });

    it('does not process queue if toasts are still displayed', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('First', 'info');
        result.current.showToast('Second', 'success');
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]?.message).toBe('First');
      expect(result.current.queueLength).toBe(1);

      // Add another toast while first is still showing
      act(() => {
        result.current.showToast('Third', 'warning');
      });

      // Should still show only first toast
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0]?.message).toBe('First');
      expect(result.current.queueLength).toBe(2);
    });
  });

  describe('action buttons', () => {
    it('preserves action properties', () => {
      const { result } = renderHook(() => useToast());
      const mockAction = vi.fn();

      act(() => {
        result.current.showToast('Action toast', 'info', 5000, {
          label: 'Undo',
          onClick: mockAction
        });
      });

      const toast = result.current.toasts[0];
      expect(toast?.action).toBeDefined();
      expect(toast?.action?.label).toBe('Undo');
      expect(toast?.action?.onClick).toBe(mockAction);

      // Verify action can be called
      act(() => {
        toast?.action?.onClick();
      });

      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('handles toasts without actions', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('No action', 'info');
      });

      expect(result.current.toasts[0]?.action).toBeUndefined();
    });

    it('allows actions with empty label', () => {
      const { result } = renderHook(() => useToast());
      const mockAction = vi.fn();

      act(() => {
        result.current.showToast('Action toast', 'info', 5000, {
          label: '',
          onClick: mockAction
        });
      });

      expect(result.current.toasts[0]?.action).toBeDefined();
      expect(result.current.toasts[0]?.action?.label).toBe('');
    });
  });
});

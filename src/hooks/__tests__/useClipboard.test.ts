import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useClipboard } from '../useClipboard';

describe('useClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('copies text when secure context clipboard API is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      const success = await result.current.copyToClipboard('copy me');
      expect(success).toBe(true);
    });

    expect(writeText).toHaveBeenCalledWith('copy me');
    expect(result.current.copyStatus).toBe('success');
    expect(result.current.lastCopied).toBe('copy me');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copyStatus).toBe('idle');
  });

  it('falls back to execCommand and reports failure when copy fails', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(false);

    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      const success = await result.current.copyToClipboard('  ');
      expect(success).toBe(false);
    });

    await act(async () => {
      const success = await result.current.copyToClipboard('fallback content');
      expect(success).toBe(false);
    });

    expect(result.current.copyStatus).toBe('error');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copyStatus).toBe('idle');
  });
});

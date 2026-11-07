import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TOAST_DURATION, TOAST_SETTINGS_KEY, useToast } from '../useToast';

const mockStored = (stored: unknown) => {
  (vi.spyOn(chrome.storage.local, 'get') as any).mockResolvedValue(
    stored === undefined ? {} : { [TOAST_SETTINGS_KEY]: stored }
  );
};

// Lets the settings load (a resolved promise) finish under fake timers
const flushLoad = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useToast', () => {
  let setSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStored(undefined);
    setSpy = (vi.spyOn(chrome.storage.local, 'set') as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows a Notification with its message, sub and type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Prompt saved', 'success', { sub: 'Weekly status update' });
    });

    expect(result.current.toast).toMatchObject({ message: 'Prompt saved', sub: 'Weekly status update', type: 'success' });
    expect(result.current.toast?.id).toBeTruthy();
  });

  it('shows info when no type is given, and drops an empty sub', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Hello', undefined, { sub: '' });
    });

    expect(result.current.toast?.type).toBe('info');
    expect(result.current.toast?.sub).toBeUndefined();
  });

  it('keeps the whole message, however long', () => {
    const { result } = renderHook(() => useToast());
    const message = 'x'.repeat(200);

    act(() => {
      result.current.showToast(message, 'error');
    });

    expect(result.current.toast?.message).toBe(message);
  });

  it('replaces the Notification on screen with a new one, without a queue', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Prompt copied', 'success', { sub: 'First' });
    });
    const firstId = result.current.toast?.id;
    act(() => {
      result.current.showToast('Prompt copied', 'success', { sub: 'Second' });
    });

    expect(result.current.toast?.sub).toBe('Second');
    expect(result.current.toast?.id).not.toBe(firstId);
    expect(result.current).not.toHaveProperty('queueLength');
  });

  it.each([
    ['success', TOAST_DURATION.confirmation],
    ['info', TOAST_DURATION.confirmation],
    ['error', TOAST_DURATION.failure],
    ['warning', TOAST_DURATION.failure]
  ] as const)('a %s Notification leaves after %i ms', (type, duration) => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Message', type);
    });
    expect(result.current.toast?.duration).toBe(duration);

    act(() => {
      vi.advanceTimersByTime(duration - 1);
    });
    expect(result.current.toast).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toast).toBeNull();
  });

  it('gives a confirmation 2.7 s and a failure 6 s', () => {
    expect(TOAST_DURATION).toEqual({ confirmation: 2700, failure: 6000 });
  });

  it('starts the time again for the Notification that replaces another', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First', 'success');
    });
    act(() => {
      vi.advanceTimersByTime(2000);
      result.current.showToast('Second', 'success');
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.toast?.message).toBe('Second');
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current.toast).toBeNull();
  });

  it('takes a duration of its own, and 0 stays until dismissed', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Stays', 'info', { duration: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toast?.message).toBe('Stays');
  });

  it('stops its time while paused (hovered or focused), and runs out the rest once resumed', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Category deleted', 'success', { duration: 6000 });
    });
    const id = result.current.toast?.id ?? '';
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    act(() => {
      result.current.pauseToast(id);
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toast?.message).toBe('Category deleted');

    act(() => {
      result.current.resumeToast(id);
    });
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(result.current.toast?.message).toBe('Category deleted');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toast).toBeNull();
  });

  it('ignores a pause or resume for a Notification no longer shown, or one that stays anyway', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First', 'success');
    });
    const firstId = result.current.toast?.id ?? '';
    act(() => {
      result.current.showToast('Second', 'success', { duration: 3000 });
    });
    act(() => {
      result.current.pauseToast(firstId);
      result.current.resumeToast(firstId);
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.toast).toBeNull();

    act(() => {
      result.current.showToast('Stays', 'info', { duration: 0 });
    });
    const staysId = result.current.toast?.id ?? '';
    act(() => {
      result.current.pauseToast(staysId);
      result.current.resumeToast(staysId);
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toast?.message).toBe('Stays');
  });

  it('hides the Notification on screen, and ignores an id that is no longer shown', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('First', 'success');
    });
    const firstId = result.current.toast?.id ?? '';
    act(() => {
      result.current.showToast('Second', 'success');
    });
    act(() => {
      result.current.hideToast(firstId);
    });
    expect(result.current.toast?.message).toBe('Second');

    act(() => {
      result.current.hideToast(result.current.toast?.id ?? '');
    });
    expect(result.current.toast).toBeNull();
  });

  it('keeps the action of a Notification', () => {
    const { result } = renderHook(() => useToast());
    const onClick = vi.fn();

    act(() => {
      result.current.showToast('Category deleted', 'success', { sub: 'Marketing', action: { label: 'Undo', onClick } });
    });

    expect(result.current.toast?.action).toEqual({ label: 'Undo', onClick });
  });

  describe('settings', () => {
    it('says when the stored settings have been read', async () => {
      mockStored({ enabled: false });
      const { result } = renderHook(() => useToast());

      expect(result.current.settingsLoaded).toBe(false);
      await flushLoad();
      expect(result.current).toMatchObject({ settingsLoaded: true, settings: { enabled: false } });
    });

    it('counts the settings as read when reading them failed, with Notifications on', async () => {
      (vi.spyOn(chrome.storage.local, 'get') as any).mockRejectedValue(new Error('Storage unavailable'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { result } = renderHook(() => useToast());

      await flushLoad();
      expect(result.current).toMatchObject({ settingsLoaded: true, settings: { enabled: true } });
    });

    it('shows Notifications by default, with nothing stored', async () => {
      const { result } = renderHook(() => useToast());
      await flushLoad();

      expect(result.current.settings).toEqual({ enabled: true });
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('shows no Notification at all when turned off, failures included', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.updateSettings({ enabled: false });
      });
      act(() => {
        result.current.showToast('Saved', 'success');
        result.current.showToast("Couldn't delete Prompt", 'error');
        result.current.showToast('Skipped 2', 'warning');
      });

      expect(result.current.toast).toBeNull();
      expect(setSpy).toHaveBeenCalledWith({ [TOAST_SETTINGS_KEY]: { enabled: false } });
    });

    it('hides the Notification on screen when turned off', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.showToast('Saved', 'success');
      });
      act(() => {
        result.current.updateSettings({ enabled: false });
      });

      expect(result.current.toast).toBeNull();
    });

    it('can show a Notification right after being turned on, in the same handler', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.updateSettings({ enabled: false });
      });
      act(() => {
        result.current.updateSettings({ enabled: true });
        result.current.showToast('Notifications on', 'success');
      });

      expect(result.current.toast?.message).toBe('Notifications on');
      expect(result.current.settings).toEqual({ enabled: true });
    });

    it('loads a stored switch and does not write it back', async () => {
      mockStored({ enabled: false });
      const { result } = renderHook(() => useToast());
      await flushLoad();

      expect(result.current.settings).toEqual({ enabled: false });
      act(() => {
        result.current.showToast("Couldn't delete Prompt", 'error');
      });
      expect(result.current.toast).toBeNull();
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('migrates old settings with all four types off to off', async () => {
      mockStored({
        position: 'bottom-right',
        enabledTypes: { success: false, error: false, info: false, warning: false },
        enableGrouping: true,
        groupingWindow: 500
      });
      const { result } = renderHook(() => useToast());
      await flushLoad();

      expect(result.current.settings).toEqual({ enabled: false });
      expect(setSpy).toHaveBeenCalledWith({ [TOAST_SETTINGS_KEY]: { enabled: false } });
    });

    it.each([
      ['one type on', { position: 'top-right', enabledTypes: { success: false, error: true, info: false, warning: false } }],
      ['only info off', { enabledTypes: { success: true, error: true, info: false, warning: true } }],
      ['no types stored', { position: 'bottom-right' }]
    ])('migrates old settings with %s to on', async (_name, stored) => {
      mockStored(stored);
      const { result } = renderHook(() => useToast());
      await flushLoad();

      expect(result.current.settings).toEqual({ enabled: true });
      expect(setSpy).toHaveBeenCalledWith({ [TOAST_SETTINGS_KEY]: { enabled: true } });
    });

    it('keeps the default when the settings cannot be read', async () => {
      (vi.spyOn(chrome.storage.local, 'get') as any).mockRejectedValue(new Error('read failed'));
      const { result } = renderHook(() => useToast());
      await flushLoad();

      expect(result.current.settings).toEqual({ enabled: true });
    });
  });
});

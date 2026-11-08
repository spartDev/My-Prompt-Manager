import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CATEGORY_COLOR } from '../../constants/colors';
import { MOTION } from '../../theme/motion';
import { useCategorySheet } from '../useCategorySheet';

const SHEET_EXIT_MS = MOTION.categorySheetOut;

describe('useCategorySheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts closed', () => {
    const { result } = renderHook(() => useCategorySheet());

    expect(result.current.isMounted).toBe(false);
    expect(result.current.isOpen).toBe(false);
  });

  it('opens empty to create, with the color it is given', () => {
    const { result } = renderHook(() => useCategorySheet());

    act(() => { result.current.openCreate('#0F766E'); });

    expect(result.current).toMatchObject({ isMounted: true, isOpen: true, mode: 'create', category: null, name: '', color: '#0F766E' });
  });

  it('opens on a Category to edit it, its name and color filled in', () => {
    const { result } = renderHook(() => useCategorySheet());
    const work = { id: 'work', name: 'Work', color: '#DB2777' };

    act(() => { result.current.openEdit(work); });
    expect(result.current).toMatchObject({ mode: 'edit', category: work, name: 'Work', color: '#DB2777' });

    act(() => { result.current.openEdit({ id: 'plain', name: 'Plain' }); });
    expect(result.current.color).toBe(DEFAULT_CATEGORY_COLOR);
  });

  it('keeps the draft name and color', () => {
    const { result } = renderHook(() => useCategorySheet());

    act(() => { result.current.openCreate('#2563EB'); });
    act(() => { result.current.setName('Research'); });
    act(() => { result.current.setColor('#E11D48'); });

    expect(result.current).toMatchObject({ name: 'Research', color: '#E11D48' });
  });

  it('plays the exit for MOTION.categorySheetOut, then leaves the page and says so once', () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useCategorySheet({ onClosed }));

    act(() => { result.current.openCreate('#2563EB'); });
    act(() => { result.current.close(); });
    expect(result.current).toMatchObject({ isMounted: true, isOpen: false });

    act(() => { result.current.close(); });
    act(() => { vi.advanceTimersByTime(SHEET_EXIT_MS - 1); });
    expect(result.current.isMounted).toBe(true);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.isMounted).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('leaves the page at once under prefers-reduced-motion', () => {
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
    const onClosed = vi.fn();
    const { result } = renderHook(() => useCategorySheet({ onClosed }));

    act(() => { result.current.openCreate('#2563EB'); });
    act(() => { result.current.close(); });
    act(() => { vi.advanceTimersByTime(0); });

    expect(result.current.isMounted).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('does nothing when closed while already closed', () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useCategorySheet({ onClosed }));

    act(() => { result.current.close(); });
    act(() => { vi.advanceTimersByTime(SHEET_EXIT_MS); });

    expect(onClosed).not.toHaveBeenCalled();
  });

  it('cancels the exit when opened again during it: one sheet, a new session', () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useCategorySheet({ onClosed }));

    act(() => { result.current.openCreate('#2563EB'); });
    const first = result.current.session;
    act(() => { result.current.setName('Draft'); });
    act(() => { result.current.close(); });
    act(() => { vi.advanceTimersByTime(SHEET_EXIT_MS / 2); });
    act(() => { result.current.openCreate('#0369A1'); });
    act(() => { vi.advanceTimersByTime(SHEET_EXIT_MS); });

    expect(result.current).toMatchObject({ isMounted: true, isOpen: true, name: '', color: '#0369A1' });
    expect(result.current.session).toBe(first + 1);
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('can be closed again after reopening', () => {
    const { result } = renderHook(() => useCategorySheet());

    act(() => { result.current.openCreate('#2563EB'); });
    act(() => { result.current.close(); });
    act(() => { result.current.openEdit({ id: 'work', name: 'Work' }); });
    act(() => { result.current.close(); });
    act(() => { vi.advanceTimersByTime(SHEET_EXIT_MS); });

    expect(result.current.isMounted).toBe(false);
  });

  it('leaves no timer behind when the screen goes away during the exit', () => {
    const onClosed = vi.fn();
    const { result, unmount } = renderHook(() => useCategorySheet({ onClosed }));

    act(() => { result.current.openCreate('#2563EB'); });
    act(() => { result.current.close(); });
    unmount();
    vi.advanceTimersByTime(SHEET_EXIT_MS);

    expect(onClosed).not.toHaveBeenCalled();
  });
});

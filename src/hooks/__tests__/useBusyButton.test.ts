import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RETRY_FAILURE_HOLD_MS } from '../../constants/ui';
import { type BusyResult, useBusyButton } from '../useBusyButton';

/** Work the test ends when it chooses: `end` resolves it with its result */
const heldWork = () => {
  let end: (result: BusyResult) => void = () => undefined;
  const work = vi.fn(() => new Promise<BusyResult>((resolve) => { end = resolve; }));
  return { work, end: (result: BusyResult) => { end(result); } };
};

// The Loading State of docs/DESIGN_GUIDELINES.md, for a button that keeps the keyboard while it is
// busy (My-Prompt-Manager-tg6l): busy at the press, a press meanwhile doing nothing, a success ending
// it at once and a failure no sooner than RETRY_FAILURE_HOLD_MS after the press
describe('useBusyButton', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('is busy from the press until work that succeeds ends, and no longer: a success is not held', async () => {
    const { result } = renderHook(() => useBusyButton());
    const { work, end } = heldWork();

    expect(result.current.busy).toBe(false);
    act(() => { void result.current.run(work); });
    expect(result.current.busy).toBe(true);

    await act(async () => { end(undefined); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.busy).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing for a press while it is busy', async () => {
    const { result } = renderHook(() => useBusyButton());
    const first = heldWork();
    const second = vi.fn(() => Promise.resolve<BusyResult>(undefined));

    // Twice: in the same task as the press, before the busy state is committed, and once it is shown
    act(() => {
      void result.current.run(first.work);
      void result.current.run(second);
    });
    act(() => { void result.current.run(second); });

    expect(second).not.toHaveBeenCalled();
    await act(async () => { first.end(undefined); await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.busy).toBe(false);
  });

  it(`holds a failure that comes at once until ${String(RETRY_FAILURE_HOLD_MS)} ms after the press, then shows it in the same commit as the idle button`, async () => {
    const { result } = renderHook(() => useBusyButton());
    const busyWhenShown: boolean[] = [];
    const showFailure = vi.fn(() => { busyWhenShown.push(result.current.busy); });

    act(() => { void result.current.run(() => Promise.resolve<BusyResult>(showFailure)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_FAILURE_HOLD_MS - 1); });
    expect(result.current.busy).toBe(true);
    expect(showFailure).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(showFailure).toHaveBeenCalledTimes(1);
    // Called before the busy state ends, which then commits with what it showed
    expect(busyWhenShown).toEqual([true]);
    expect(result.current.busy).toBe(false);
  });

  it('shows a failure that comes after the hold as soon as it comes', async () => {
    const { result } = renderHook(() => useBusyButton());
    const { work, end } = heldWork();
    const showFailure = vi.fn();

    act(() => { void result.current.run(work); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_FAILURE_HOLD_MS + 200); });
    expect(result.current.busy).toBe(true);

    await act(async () => { end(showFailure); await vi.advanceTimersByTimeAsync(0); });
    expect(showFailure).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(false);
  });

  it('can be pressed again once a held failure has shown', async () => {
    const { result } = renderHook(() => useBusyButton());
    const again = vi.fn(() => Promise.resolve<BusyResult>(undefined));

    act(() => { void result.current.run(() => Promise.resolve<BusyResult>(() => undefined)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_FAILURE_HOLD_MS); });
    act(() => { void result.current.run(again); });

    expect(again).toHaveBeenCalledTimes(1);
  });

  it('unmounted during the hold, shows the failure at once and leaves no timer behind', async () => {
    const { result, unmount } = renderHook(() => useBusyButton());
    const showFailure = vi.fn();

    act(() => { void result.current.run(() => Promise.resolve<BusyResult>(showFailure)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(showFailure).not.toHaveBeenCalled();

    unmount();
    await act(async () => { await Promise.resolve(); });

    expect(showFailure).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

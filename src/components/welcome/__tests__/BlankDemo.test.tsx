/**
 * Step 2's typing demo stops by itself (My-Prompt-Manager-ojz.20, WCAG 2.2.2 Pause, Stop, Hide): the
 * name is typed twice at most, then held whole with a still caret, 4.76s after the step shows, within
 * the 5s of MOTION.welcomeMotionLimit; no timer is left running then, nor once the step is left.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MOTION } from '../../../theme/motion';
import BlankDemo from '../BlankDemo';

const NAME = 'Claire, Head of Sales';
const HOLD_TICKS = Math.round(MOTION.welcomeTypePause / MOTION.welcomeTypeLetter);
/** When the last typing completes, from the step's display */
const DEMO_ENDS = ((NAME.length + HOLD_TICKS) * (MOTION.welcomeTypings - 1) + NAME.length) * MOTION.welcomeTypeLetter;

const blank = (): string => screen.getByTestId('welcome-blank').textContent ?? '';
const caret = (): Element | null => screen.getByTestId('welcome-blank').querySelector('[data-welcome-caret]');
const demo = (): Element | null => screen.getByTestId('welcome-blank').closest('[data-welcome-demo]');
const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('BlankDemo: the typing stops by itself', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ends within the 5s limit: the last letter 4760ms after the step shows', () => {
    expect(DEMO_ENDS).toBe(4760);
    expect(DEMO_ENDS).toBeLessThanOrEqual(MOTION.welcomeMotionLimit);
  });

  it('types the name at most twice: every change of the blank, millisecond by millisecond, over a minute', () => {
    render(<BlankDemo />);
    const seen: string[] = [blank()];
    for (let ms = 0; ms < 60_000; ms++) {
      advance(1);
      if (blank() !== seen.at(-1)) {
        seen.push(blank());
      }
    }

    // How many times the name was completed, and how many times the blank emptied after it
    const completed = seen.filter((text) => text === NAME).length;
    const emptiedAgain = seen.slice(1).filter((text) => text === '').length;
    expect(completed).toBe(MOTION.welcomeTypings);
    expect(completed).toBeLessThanOrEqual(2);
    expect(emptiedAgain).toBe(MOTION.welcomeTypings - 1);
    expect(seen.at(-1)).toBe(NAME);
  });

  it('then holds the whole sentence with a still caret: no timer left, nothing changes after', () => {
    render(<BlankDemo />);
    expect(caret()?.className).toContain('animate-welcome-caret');
    expect(demo()).toHaveAttribute('data-welcome-demo', 'typing');

    advance(DEMO_ENDS - 1);
    expect(blank()).toBe(NAME.slice(0, -1));
    expect(vi.getTimerCount()).toBe(1);

    advance(1);
    expect(blank()).toBe(NAME);
    expect(demo()).toHaveAttribute('data-welcome-demo', 'done');
    // Still: the caret keeps its place after the name, and blinks no more
    expect(caret()).not.toBeNull();
    expect(caret()?.className).not.toContain('animate-');
    expect(vi.getTimerCount()).toBe(0);

    advance(60_000);
    expect(blank()).toBe(NAME);
    expect(caret()?.className).not.toContain('animate-');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('holds the name about 1.2s between the two typings, then types it again from the first letter', () => {
    render(<BlankDemo />);
    advance(NAME.length * MOTION.welcomeTypeLetter);
    expect(blank()).toBe(NAME);

    advance(HOLD_TICKS * MOTION.welcomeTypeLetter - 1);
    expect(blank()).toBe(NAME);
    advance(1);
    expect(blank()).toBe('');
    expect(demo()).toHaveAttribute('data-welcome-demo', 'typing');
    advance(MOTION.welcomeTypeLetter);
    expect(blank()).toBe('C');
  });

  it.each([
    ['while typing the first time', 500],
    ['while the name is held', 2200],
    ['while typing the second time', 3800]
  ])('leaves no timer once unmounted %s', (_when, ms) => {
    const { unmount } = render(<BlankDemo />);
    advance(ms);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps one timer at a time, aimed at each letter from the start: a timer that fires late is followed by a shorter one, so the end does not drift', () => {
    // The page's clock runs `late` ms ahead of the timers, as on a busy machine where a timer fires late
    let late = 0;
    const now = performance.now.bind(performance);
    vi.spyOn(performance, 'now').mockImplementation(() => now() + late);
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    render(<BlankDemo />);
    const waits = (): unknown[] => setTimeoutSpy.mock.calls.map(([, wait]) => wait);

    // On time, every wait is one letter
    advance(MOTION.welcomeTypeLetter * 2);
    expect(waits()).toEqual([MOTION.welcomeTypeLetter, MOTION.welcomeTypeLetter, MOTION.welcomeTypeLetter]);
    expect(blank()).toBe(NAME.slice(0, 2));

    // The third letter's timer fires 40ms late: the fourth waits 45ms, not 85
    late = 40;
    advance(MOTION.welcomeTypeLetter);
    expect(blank()).toBe(NAME.slice(0, 3));
    expect(waits().at(-1)).toBe(MOTION.welcomeTypeLetter - 40);

    // Fired 200ms late: the letters due by then show at once, and the next waits for its own time
    late = 240;
    advance(MOTION.welcomeTypeLetter - 40);
    expect(blank()).toBe(NAME.slice(0, Math.floor((4 * MOTION.welcomeTypeLetter - 40 + 240) / MOTION.welcomeTypeLetter)));
    expect(vi.getTimerCount()).toBe(1);
  });

  it('under reduced motion shows the whole name at once, with no timer and no caret: nothing moves', () => {
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
    render(<BlankDemo />);

    expect(blank()).toBe(NAME);
    expect(caret()).toBeNull();
    expect(demo()).toHaveAttribute('data-welcome-demo', 'done');
    expect(vi.getTimerCount()).toBe(0);
  });
});

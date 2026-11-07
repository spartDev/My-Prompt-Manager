/**
 * Motion of the Atelier 1C design. The CSS side is in tokens.css (`--ease-*`, `--animate-*`, the
 * keyframes); the timers of the components take their durations here, so the two stay in step
 * (src/theme/__tests__/motion.test.ts checks it).
 */

/** The curves: panels rise with `sheet` and leave with `sheetOut`; pops, bounces and presses use `spring` */
export const EASE = {
  sheet: 'cubic-bezier(0.25, 0.8, 0.3, 1)',
  sheetOut: 'cubic-bezier(0.5, 0, 0.75, 0)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
} as const;

/** Durations and delays, in milliseconds */
export const MOTION = {
  /** A panel rising from the bottom, while what lies beneath recedes under a scrim */
  sheetIn: 400,
  /** A panel leaving to the bottom; the component unmounts after it */
  sheetOut: 340,
  /** How long Save shows "Saved" before the editor closes and the Notification appears */
  savedPause: 620,
  /** A new chip (a Variable) popping in */
  pop: 450,
  /** A check mark or an inline row popping in */
  popCheck: 400,
  /** The Notification pill dropping in */
  toastIn: 450,
  /** The round of the Notification pops this long after the pill */
  toastMarkDelay: 80
} as const;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** True when the user asked for reduced motion: every animation is then near instant */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches;

/** The duration a timer waits for an animation of `ms`: none under reduced motion */
export const motionDuration = (ms: number): number => (prefersReducedMotion() ? 0 : ms);

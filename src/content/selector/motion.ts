/**
 * Motion of the Prompt selector (Atelier 1C): durations in milliseconds and easing curves, read by
 * its stylesheet and by the controller, which waits for the closing animation before it unmounts.
 */

export const EASE = {
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  sheet: 'cubic-bezier(0.32, 0.72, 0, 1)'
} as const;

export const DURATION = {
  /** The popover opens */
  open: 420,
  /** The popover closes; it is unmounted when this has run */
  close: 180,
  /** A row of the list appears */
  row: 350,
  /** The variables step slides in */
  step: 400,
  /** A tab changes color */
  tab: 250,
  /** The Prompts button changes color */
  button: 300
} as const;

/** Whether the user asked for reduced motion: animations then run for 1ms and timers do not wait. */
export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

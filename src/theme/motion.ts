/**
 * Motion of the Atelier 1C design. The CSS side is in tokens.css (`--ease-*`, `--animate-*`, the
 * keyframes); the timers of the components take their durations here, so the two stay in step
 * (src/theme/__tests__/motion.test.ts checks it).
 */

/** The curves: panels rise with `sheet` and leave with `sheetOut`; pops, bounces and presses use `spring` */
export const EASE = {
  sheet: 'cubic-bezier(0.25, 0.8, 0.3, 1)',
  sheetOut: 'cubic-bezier(0.5, 0, 0.75, 0)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Arriving on a Section from the tab bar */
  section: 'cubic-bezier(0.32, 0.72, 0, 1)',
  // --- What's new tiles (My-Prompt-Manager-d1g.6) ---
  /** What's new: a tile rising into the grid, a softer spring than `spring` */
  rise: 'cubic-bezier(0.34, 1.3, 0.64, 1)'
  // --- end What's new tiles ---
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
  toastMarkDelay: 80,
  /** A Section sliding in from the side of its tab */
  sectionIn: 450,
  /** The Category sheet rising from the bottom */
  categorySheetIn: 500,
  /** The Category sheet leaving, faster than the editor; useCategorySheet unmounts it after */
  categorySheetOut: 280,
  /** The backdrop of the Category sheet fading in */
  backdropIn: 300,
  /** The backdrop of the Category sheet fading out, with the sheet */
  backdropOut: 280,
  /** A Category appearing in the list (created, or back from Undo) */
  categoryPop: 500,
  /** Analytics: a bar growing from the bottom; the first starts after barDelay, each next one barStagger later */
  barGrow: 800,
  barDelay: 200,
  barStagger: 60,
  /** Analytics: the "Prompts used" counter counting up, alongside the bars */
  countUp: 800,
  /** Analytics: the Top platform and Top category cards rising, the second cardStagger after the first */
  cardRise: 500,
  cardDelay: 100,
  cardStagger: 80,
  /** Analytics: a Most used bar filling from the left; the first starts after rankDelay, each next one rankStagger later */
  rankFill: 1000,
  rankDelay: 300,
  rankStagger: 90,
  /** Library search: the clear button popping in */
  clearPop: 350,
  /** Library: the listed cards rising when the list changes, each listStagger after the one before, up to listStaggerSteps */
  listRise: 500,
  listStagger: 50,
  listStaggerSteps: 8,
  /** Library search: the no-results block rising */
  emptyRise: 350,
  /** Empty states: their blocks rise with cardRise, each emptyStagger after the one before */
  emptyStagger: 70,
  /** Empty Library: the Prompt card of the illustration floating up and back, in a loop */
  float: 5400,
  /** Empty Library: the + badge popping, badgePopDelay after the illustration */
  badgePop: 500,
  badgePopDelay: 350,
  /** Empty Analytics: a ghost bar growing from the bottom; the first starts after ghostDelay, each next one barStagger later */
  ghostGrow: 700,
  ghostDelay: 150,
  // --- What's new tiles (My-Prompt-Manager-d1g.6) ---
  /** What's new: a tile rising 12px with a fade; the first starts after tileDelay, each next one tileStagger later */
  tileRise: 550,
  tileDelay: 180,
  tileStagger: 70,
  /** What's new: a pressed Feature tile shrinking to 97% and springing back */
  tilePress: 300,
  // --- end What's new tiles ---

  // --- What's new sheet (My-Prompt-Manager-d1g.5) ---
  /** What's new: the sheet rising from the bottom, on the Section curve (EASE.section) */
  whatsNewSheetIn: 600,
  /** What's new: the sheet leaving to the bottom; whoever renders it unmounts it after (useAnimatedPresence) */
  whatsNewSheetOut: 340,
  /** What's new: its backdrop fading in */
  whatsNewBackdropIn: 300,
  /** What's new: its backdrop fading out, with the sheet */
  whatsNewBackdropOut: 340,
  // --- end What's new sheet ---

  // --- Welcome frame (My-Prompt-Manager-ojz.7) ---
  /**
   * Welcome: the screen fading in at the opening. The mockup's 500ms left the screen less than
   * opaque until 534ms after the popup opened (median of 10 openings); 150ms shows it whole within
   * the 200ms the Welcome has to be on screen (decision Q3 of My-Prompt-Manager-ojz)
   */
  welcomeIn: 150,
  /** Welcome: a step sliding 26px in from the side it comes from while it fades in, on the Section curve (EASE.section) */
  welcomeStep: 500,
  /** Welcome: the active progress dot widening from 7 to 22px, on the spring */
  welcomeDot: 450,
  /** Welcome: Back popping in when a step change brings it, from the second step */
  welcomeBackPop: 350,
  /** Welcome: the primary button shrinking to 97% while pressed, on the spring */
  welcomePress: 250
  // --- end Welcome frame ---
} as const;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** True when the user asked for reduced motion: every animation is then near instant */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches;

/** The duration a timer waits for an animation of `ms`: none under reduced motion */
export const motionDuration = (ms: number): number => (prefersReducedMotion() ? 0 : ms);

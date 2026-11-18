import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { MOTION, prefersReducedMotion } from '../../theme/motion';
import { cn } from '../../utils';

/** The name typed into the blank, and the words around it */
const NAME = 'Claire, Head of Sales';
const BEFORE = 'Write a follow-up email to';
const AFTER = 'and end with one clear next step.';

/** The caret after the letters: blinking, still (where it only takes its room), or none */
type Caret = 'blink' | 'still' | 'none';

/** The blank, a Variable being filled in: the accent's tint, underlined in the accent */
const Blank: FC<{ text: string; caret: Caret; testId?: string }> = ({ text, caret, testId }) => (
  <span
    data-testid={testId}
    className="inline-block h-[27px] min-w-[3ch] rounded-t-lg rounded-b-[3px] border-b-2 border-blank bg-accent-selected px-2 align-baseline leading-[27px] font-bold text-accent-strong"
  >
    {text}
    {caret !== 'none' && (
      <span data-welcome-caret className={cn('ml-px inline-block h-4 w-0.5 bg-accent align-[-2px]', caret === 'blink' && 'animate-welcome-caret')} />
    )}
  </span>
);

/** The sentence with the blank holding `text` */
const Sentence: FC<{ text: string; caret: Caret; className?: string; testId?: string }> = ({ text, caret, className, testId }) => (
  <p aria-hidden="true" className={className}>
    {BEFORE} <Blank text={text} caret={caret} testId={testId} /> {AFTER}
  </p>
);

/** How many ticks of MOTION.welcomeTypeLetter the whole name stays: about MOTION.welcomeTypePause */
const HOLD_TICKS = Math.round(MOTION.welcomeTypePause / MOTION.welcomeTypeLetter);

/** The ticks of one cycle: the empty blank, a letter a tick, then the whole name held */
const CYCLE_TICKS = NAME.length + HOLD_TICKS;

/**
 * The tick on which the last typing completes: the demonstration ends there, the name whole, and
 * stays so. Every typing but the last is followed by its hold, then the blank empties again
 */
const LAST_TICK = CYCLE_TICKS * (MOTION.welcomeTypings - 1) + NAME.length;

/** The letters the blank holds at `tick`: none at the start of a cycle, then one more a tick, then all of them */
const typedAt = (tick: number): number => Math.min(tick % CYCLE_TICKS, NAME.length);

/**
 * The demonstration of the Welcome's second step (Atelier 1C 'Premier lancement', ob1, TYPE): a
 * Prompt whose blank fills itself, one letter every MOTION.welcomeTypeLetter, holds the whole name
 * about MOTION.welcomeTypePause, then empties and starts again, a caret blinking after the letters.
 * It types the name MOTION.welcomeTypings times (twice), then holds it for good with a still caret:
 * 4.76s after the step shows, within the 5s of MOTION.welcomeMotionLimit (WCAG 2.2.2), where the
 * mockup loops forever (My-Prompt-Manager-ojz.20).
 *
 * One timer at a time, each aimed at its letter's time from the start, so a timer that fires late
 * makes the next one shorter and the end does not drift; cleared when the step is left (the step
 * slot unmounts it) or the Welcome closes. The card keeps the height of the whole sentence while the
 * name grows, so the title and the text under it never move. The typing is hidden from assistive
 * technology, which reads the whole sentence instead. Under reduced motion the whole name shows at
 * once, with no timer and no caret. `data-welcome-demo` says whether it is still typing or done.
 */
const BlankDemo: FC = () => {
  // Read once, like the frame
  const [animated] = useState(() => !prefersReducedMotion());
  // The tick of the demonstration, from 0 (the empty blank) to LAST_TICK (the name whole, for good)
  const [tick, setTick] = useState(animated ? 0 : LAST_TICK);

  useEffect(() => {
    if (!animated) {
      return;
    }
    const start = performance.now();
    let timer: number | undefined;
    // Waits for `next`'s time, then shows the tick that is due by then: a late timer catches up
    const schedule = (next: number): void => {
      const wait = Math.max(0, next * MOTION.welcomeTypeLetter - (performance.now() - start));
      timer = window.setTimeout(() => {
        const due = Math.min(LAST_TICK, Math.max(next, Math.floor((performance.now() - start) / MOTION.welcomeTypeLetter)));
        setTick(due);
        timer = undefined;
        if (due < LAST_TICK) {
          schedule(due + 1);
        }
      }, wait);
    };
    schedule(1);
    return () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [animated]);

  const done = tick >= LAST_TICK;
  const typed = done ? NAME.length : typedAt(tick);

  return (
    <div
      data-welcome-demo={done ? 'done' : 'typing'}
      className="relative grid rounded-[22px] bg-card p-[18px] text-[15px] leading-loose text-primary shadow-welcome-demo"
    >
      {/* The whole sentence and its caret, unseen, hold the card at its full height */}
      {animated && <Sentence text={NAME} caret="still" className="invisible col-start-1 row-start-1" />}
      <Sentence text={NAME.slice(0, typed)} caret={animated ? (done ? 'still' : 'blink') : 'none'} className="col-start-1 row-start-1" testId="welcome-blank" />
      <p className="sr-only">{`${BEFORE} ${NAME} ${AFTER}`}</p>
    </div>
  );
};

export default BlankDemo;

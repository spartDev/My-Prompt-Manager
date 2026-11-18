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
 * The demonstration of the Welcome's second step (Atelier 1C 'Premier lancement', ob1, TYPE): a
 * Prompt whose blank fills itself, one letter every MOTION.welcomeTypeLetter, holds the whole name
 * about MOTION.welcomeTypePause, then empties and starts again, a caret blinking after the letters.
 *
 * One interval, cleared when the step is left (the step slot unmounts it) or the Welcome closes.
 * The card keeps the height of the whole sentence while the name grows, so the title and the text
 * under it never move. The typing is hidden from assistive technology, which reads the whole
 * sentence instead. Under reduced motion the whole name shows at once, with no timer and no caret.
 */
const BlankDemo: FC = () => {
  // Read once, like the frame
  const [animated] = useState(() => !prefersReducedMotion());
  // The tick of the cycle; from NAME.length on, the whole name is held
  const [tick, setTick] = useState(animated ? 0 : NAME.length);

  useEffect(() => {
    if (!animated) {
      return;
    }
    const interval = window.setInterval(() => {
      setTick((current) => (current + 1) % CYCLE_TICKS);
    }, MOTION.welcomeTypeLetter);
    return () => {
      window.clearInterval(interval);
    };
  }, [animated]);

  const typed = Math.min(tick, NAME.length);

  return (
    <div className="relative grid rounded-[22px] bg-card p-[18px] text-[15px] leading-loose text-primary shadow-welcome-demo">
      {/* The whole sentence and its caret, unseen, hold the card at its full height */}
      {animated && <Sentence text={NAME} caret="still" className="invisible col-start-1 row-start-1" />}
      <Sentence text={NAME.slice(0, typed)} caret={animated ? 'blink' : 'none'} className="col-start-1 row-start-1" testId="welcome-blank" />
      <p className="sr-only">{`${BEFORE} ${NAME} ${AFTER}`}</p>
    </div>
  );
};

export default BlankDemo;

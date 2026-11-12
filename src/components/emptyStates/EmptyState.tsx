import type { FC, ReactNode } from 'react';

import { MOTION } from '../../theme/motion';

export interface EmptyStateProps {
  /** Drawn in HTML and CSS, decorative: it is hidden from assistive technology here */
  illustration: ReactNode;
  /** The h2 of the empty state, under the Section's h1 */
  title: string;
  /** One or two sentences that say what the Section is for */
  description: string;
  /** The one main action first, then the secondary ones, in the order they are read */
  children: ReactNode;
  'data-testid'?: string;
}

/** The delay of a block of an empty state: each rises emptyStagger after the one before */
export const emptyRiseDelay = (index: number): string => `${String(index * MOTION.emptyStagger)}ms`;

/** The main action of an empty state: one per screen, 46px high, as wide as the text column */
export const EMPTY_PRIMARY_BUTTON =
  'flex w-full max-w-[300px] h-[46px] items-center justify-center gap-2 rounded-full bg-accent text-on-accent text-[14.5px] font-bold shadow-lg hover:bg-accent-hover active:scale-96 transition-chip focus-primary';

/** A secondary action of an empty state: a bordered pill, 40px high */
export const EMPTY_SECONDARY_BUTTON =
  'h-10 px-5 rounded-full bg-card border-[1.5px] border-strong text-primary text-[13px] font-bold hover:bg-raised hover:border-accent active:scale-96 transition-chip focus-secondary';

/**
 * What a Section shows when it has nothing to list (Atelier 1C 5a, 5b): an illustration, a title, a
 * line of explanation and the actions, centered in the room the Section header leaves. The
 * illustration brings its own entrance; the text and the actions rise after it. In the popup, which
 * is shorter than the mockups, it tightens (short:) so that it fits without scrolling.
 */
const EmptyState: FC<EmptyStateProps> = ({ illustration, title, description, children, 'data-testid': testId }) => (
  <div
    data-testid={testId}
    className="min-h-full flex flex-col items-center justify-center gap-[18px] px-6 pt-3.5 pb-[22px] text-center short:gap-3 short:py-2"
  >
    <div aria-hidden="true" className="flex-none short:scale-85 short:-my-2.5">{illustration}</div>
    <div className="flex flex-col gap-1.5 max-w-[300px] animate-card-rise" style={{ animationDelay: emptyRiseDelay(1) }}>
      <h2 className="text-[21px] leading-[1.15] font-extrabold tracking-[-0.03em] text-primary">{title}</h2>
      <p className="text-[13.5px] leading-normal text-secondary text-pretty">{description}</p>
    </div>
    <div className="flex w-full flex-col items-center gap-[18px] short:gap-3 animate-card-rise" style={{ animationDelay: emptyRiseDelay(2) }}>
      {children}
    </div>
  </div>
);

export default EmptyState;

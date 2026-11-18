import type { FC } from 'react';
import { useState } from 'react';

import { prefersReducedMotion } from '../../theme/motion';
import { cn } from '../../utils';

/** A line of text on a light card: the card border's color, or the muted fill for a shorter, fainter one */
const LINE = 'h-2 rounded';
/** A Category chip on a light card: its tile color, faint */
const LIGHT_CHIP = 'h-[18px] rounded-full bg-[color-mix(in_srgb,currentColor_16%,transparent)]';

/**
 * The illustration of the Welcome's first step (Atelier 1C 'Premier lancement', ob0): three Prompt
 * cards, two light ones tilted -9° and +8° behind an ink one whose text holds a dashed blank. Each
 * floats 8px up and back at its own pace; the tilt is on the wrapper, the float on the card, so the
 * two transforms never meet. Decorative: hidden from assistive technology, and still under reduced
 * motion. The cards span about 310px: in a side panel narrower than 360px they are drawn at 88%,
 * so the step's edges do not cut them.
 */
const WelcomeCards: FC = () => {
  // Read once, like the frame: a setting changed while the Welcome is open starts nothing late
  const [animated] = useState(() => !prefersReducedMotion());

  return (
    <div data-testid="welcome-cards" aria-hidden="true" className="relative h-[168px] w-full flex-none max-[359px]:scale-88">
      <div className="absolute top-[26px] left-1/2 -ml-[150px] w-[176px] -rotate-9">
        <div
          data-welcome-card="left"
          className={cn('flex flex-col gap-2 rounded-[18px] bg-card p-[13px] shadow-welcome-card', animated && 'animate-welcome-float-left')}
        >
          <span className={cn(LIGHT_CHIP, 'w-[58px] text-tile-pink')} />
          <span className={cn(LINE, 'w-[86%] bg-(--border-color-default)')} />
          <span className={cn(LINE, 'w-[60%] bg-muted')} />
        </div>
      </div>
      <div className="absolute top-[22px] left-1/2 -ml-[26px] w-[176px] rotate-8">
        <div
          data-welcome-card="right"
          className={cn('flex flex-col gap-2 rounded-[18px] bg-card p-[13px] shadow-welcome-card', animated && 'animate-welcome-float-right')}
        >
          <span className={cn(LIGHT_CHIP, 'w-[50px] text-tile-blue')} />
          <span className={cn(LINE, 'w-[78%] bg-(--border-color-default)')} />
          <span className={cn(LINE, 'w-[52%] bg-muted')} />
        </div>
      </div>
      <div className="absolute top-2 left-1/2 -ml-[98px] w-[196px]">
        <div
          data-welcome-card="center"
          className={cn('flex flex-col gap-[9px] rounded-[20px] bg-inverse p-[15px] shadow-welcome-ink-card', animated && 'animate-welcome-float-center')}
        >
          <span className="h-[18px] w-16 rounded-full bg-inverse-mark/35" />
          <span className={cn(LINE, 'w-[90%] bg-inverse-bar')} />
          <span className="flex items-center gap-1.5">
            <span className={cn(LINE, 'w-[34%] bg-inverse-action')} />
            <span className="h-4 w-[52px] rounded-md border-[1.5px] border-dashed border-inverse-blank" />
          </span>
          <span className={cn(LINE, 'w-[46%] bg-inverse-action')} />
        </div>
      </div>
    </div>
  );
};

export default WelcomeCards;

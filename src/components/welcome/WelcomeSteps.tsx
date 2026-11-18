import type { FC } from 'react';

import { LAST_STEP, type WelcomeState } from '../../welcome/reducer';
import type { WelcomeStep } from '../../welcome/storage';

import { WelcomeTitle } from './WelcomeFrame';

/**
 * What fills the frame's step slot, and the label of the primary button, for each step of the
 * Welcome. Placeholders for now: the step titles of the spec only. My-Prompt-Manager-ojz.8 brings
 * the illustration, the texts, the typing demo, the Pack toggles and the Platform pills, and the last
 * step's label ("Add N prompts" or "Start empty").
 */
export interface WelcomeStepProps {
  /** The step shown and the Packs selected */
  state: WelcomeState;
  /** A Pack in or out of the selection */
  onTogglePack: (id: string) => void;
}

const TITLES: Record<WelcomeStep, string> = {
  0: 'Your best prompts, one tap away',
  1: 'Leave blanks, fill them later',
  2: 'Start with a pack'
};

export const WelcomeStepContent: FC<WelcomeStepProps> = ({ state }) => (
  <div className="flex flex-col gap-2">
    <WelcomeTitle>{TITLES[state.step]}</WelcomeTitle>
  </div>
);

/** The label of the primary button: Next, then on the last step the label that finishes the Welcome */
export const primaryLabelOf = (state: WelcomeState): string => (state.step === LAST_STEP ? 'Finish' : 'Next');

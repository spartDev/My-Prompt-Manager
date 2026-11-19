import type { FC } from 'react';

import { LAST_STEP, promptCountOf, type WelcomeState } from '../../welcome/reducer';

import BlankDemo from './BlankDemo';
import PackPicker from './PackPicker';
import WelcomeCards from './WelcomeCards';
import { WelcomeText, WelcomeTitle } from './WelcomeFrame';

/**
 * What fills the frame's step slot for each step of the Welcome (Atelier 1C 'Premier lancement',
 * ob0 to ob2), with the texts of the spec word for word but step 1's "here", and the label of the
 * primary button.
 */
export interface WelcomeStepProps {
  /** The step shown and the Packs selected */
  state: WelcomeState;
  /** A Pack in or out of the selection */
  onTogglePack: (id: string) => void;
}

/** Step 1, what the extension does: three Prompt cards floating, over the title and the text */
const WhatItDoes: FC = () => (
  <div className="flex flex-col gap-[22px]">
    <WelcomeCards />
    <div className="flex flex-col gap-2">
      <WelcomeTitle>Your best prompts, one tap away</WelcomeTitle>
      {/* "here", not the spec's "in this popup": the Welcome shows in the side panel too, its default surface (decision D1) */}
      <WelcomeText>Save the prompts you reuse and find them in a second, here or right inside your AI chat.</WelcomeText>
    </div>
  </div>
);

/** Step 2, what a blank is: a Prompt whose blank fills itself, over the title and the text */
const Blanks: FC = () => (
  <div className="flex flex-col gap-[22px]">
    <BlankDemo />
    <div className="flex flex-col gap-2">
      <WelcomeTitle>Leave blanks, fill them later</WelcomeTitle>
      <WelcomeText>{'Put {{name}} where the details change. When you use the prompt, you fill the blanks right in the text.'}</WelcomeText>
    </div>
  </div>
);

/**
 * Step 3, something to start with: the title and the text, the Packs, the Platforms. Bounded by the
 * room the frame leaves (min-h-0), so the Packs' grid scrolls within itself when it is taller
 */
const StartWithAPack: FC<WelcomeStepProps> = ({ state, onTogglePack }) => (
  <div className="flex min-h-0 flex-col gap-4">
    <div className="flex flex-none flex-col gap-1.5">
      <WelcomeTitle>Start with a pack</WelcomeTitle>
      <WelcomeText>Pick what fits your work. Everything stays editable.</WelcomeText>
    </div>
    <PackPicker selectedPacks={state.selectedPacks} onTogglePack={onTogglePack} />
  </div>
);

export const WelcomeStepContent: FC<WelcomeStepProps> = ({ state, onTogglePack }) => {
  switch (state.step) {
    case 0:
      return <WhatItDoes />;
    case 1:
      return <Blanks />;
    case 2:
      return <StartWithAPack state={state} onTogglePack={onTogglePack} />;
  }
};

/**
 * The label of the primary button: Next, then on the last step what finishing adds, "Add N prompts"
 * with N the Prompts of the Packs selected, or "Start empty" with none
 */
export const primaryLabelOf = (state: WelcomeState): string => {
  if (state.step !== LAST_STEP) {
    return 'Next';
  }
  const count = promptCountOf(state.selectedPacks);
  return count === 0 ? 'Start empty' : `Add ${String(count)} ${count === 1 ? 'prompt' : 'prompts'}`;
};

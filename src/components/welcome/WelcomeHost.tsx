import type { FC } from 'react';
import { useCallback, useRef, useState } from 'react';

import { initialWelcomeState, transition, type WelcomeAction, type WelcomeState } from '../../welcome/reducer';
import type { WelcomeStep } from '../../welcome/storage';

import WelcomeFrame from './WelcomeFrame';
import { primaryLabelOf, WelcomeStepContent } from './WelcomeSteps';

export interface WelcomeHostProps {
  /** The step the Welcome opens at: 0 at a first opening, else the step it was closed at */
  step: WelcomeStep;
  /** The Packs selected when it was closed; left out, the Packs selected by default */
  packs?: readonly string[];
  /** Records the step reached, and the Packs selected when given (useLaunchScreen's saveStep) */
  saveStep: (step: WelcomeStep, packs?: readonly string[]) => void;
  /** Ends the Welcome (useLaunchScreen's finishWelcome) */
  finishWelcome: () => void;
  /**
   * What the primary button of the last step does, with the Packs selected; finishWelcome when left
   * out. My-Prompt-Manager-ojz.9 passes the add of the Packs here
   */
  onFinish?: (packs: readonly string[]) => void;
  /**
   * Called when the user moves to another step (Back, a dot, an arrow, Next, Skip). App hides the
   * failure Notification of a refused add there: it belongs to the last step, and would otherwise
   * stay over a step whose header has Skip (My-Prompt-Manager-ojz.20)
   */
  onStepChange?: (step: WelcomeStep) => void;
  context?: 'popup' | 'sidepanel';
}

/**
 * The Welcome in App, in place of the Library while the launch decision shows it (src/hooks/
 * useLaunchScreen.ts). It holds the Welcome's state, moved only by the pure reducer of
 * src/welcome/reducer.ts, and renders the frame with the step's content.
 *
 * Each step change is recorded at once, in the click or key handler, without waiting for storage,
 * so a popup closed right after it reopens on that step; a Pack toggled records the step with the
 * new selection. The primary button of the last step finishes, with the Packs selected. The close
 * button records nothing: the step shown is already recorded.
 */
const WelcomeHost: FC<WelcomeHostProps> = ({ step, packs, saveStep, finishWelcome, onFinish = finishWelcome, onStepChange, context = 'popup' }) => {
  const [state, setState] = useState<WelcomeState>(() => initialWelcomeState(step, packs));
  // The state the next action applies to: two actions in a row never read a render behind
  const current = useRef(state);

  const apply = useCallback(
    (action: WelcomeAction) => {
      const before = current.current;
      const { state: after, finish } = transition(before, action);
      if (finish) {
        onFinish(after.selectedPacks);
        return;
      }
      if (after === before) {
        return;
      }
      current.current = after;
      setState(after);
      if (after.step !== before.step) {
        // The Packs left out: those already recorded are kept
        saveStep(after.step);
        onStepChange?.(after.step);
      } else if (after.selectedPacks !== before.selectedPacks) {
        saveStep(after.step, after.selectedPacks);
      }
    },
    [onFinish, saveStep, onStepChange]
  );

  const togglePack = useCallback(
    (id: string) => {
      apply({ type: 'togglePack', id });
    },
    [apply]
  );

  const close = useCallback(() => {
    window.close();
  }, []);

  return (
    <WelcomeFrame
      step={state.step}
      direction={state.direction}
      primaryLabel={primaryLabelOf(state)}
      onAction={apply}
      onClose={close}
      context={context}
    >
      <WelcomeStepContent state={state} onTogglePack={togglePack} />
    </WelcomeFrame>
  );
};

export default WelcomeHost;

import type { FC, ReactNode } from 'react';
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
  /**
   * Called when the user toggles a Pack, with the new selection. App hides the failure Notification
   * of a refused add there: its Try again was about the Packs selected before, and the primary
   * button, which follows the selection, is the way on (My-Prompt-Manager-5lf)
   */
  onPacksChange?: (packs: readonly string[]) => void;
  /**
   * While true, a Pack toggle does nothing: App sets it while the Packs selected are being added, so
   * the selection on screen stays the one a refusal's Try again adds (My-Prompt-Manager-5lf)
   */
  packsLocked?: boolean;
  /** The Notification over the Welcome, which the frame shows under its header (WelcomeFrame's notification) */
  notification?: ReactNode;
  context?: 'popup' | 'sidepanel';
}

/**
 * The Welcome in App, in place of the Library while the launch decision shows it (src/hooks/
 * useLaunchScreen.ts). It holds the Welcome's state, moved only by the pure reducer of
 * src/welcome/reducer.ts, and renders the frame with the step's content.
 *
 * Each step change is recorded from the click or key handler, without waiting for storage: the
 * handler requests the Welcome lock, and the step is written once the lock is granted and the record
 * read, a few milliseconds later. A popup closed after that write reopens on the step. One closed
 * before it loses the write, the window the epic accepted (D24), and reopens on what the last write
 * that landed recorded, so for the one action whose write is lost: after Next (or ArrowRight), one
 * step earlier than the step left on screen; after Back (or ArrowLeft), one step later; after Skip or
 * a dot, the step the user moved from. A Pack toggled records the step with the new selection, and
 * says it to onPacksChange; that write lost, the Welcome reopens on the same step with the selection
 * from before the toggle (the Packs last recorded, else those selected by default). While
 * packsLocked, a toggle does nothing. The primary button of the last step finishes, with the Packs
 * selected. The close button records nothing: the step shown is already recorded, or being recorded.
 * (src/components/__tests__/App.launch.test.tsx, "a write of the Welcome lost to a popup closed early")
 */
const WelcomeHost: FC<WelcomeHostProps> = ({ step, packs, saveStep, finishWelcome, onFinish = finishWelcome, onStepChange, onPacksChange, packsLocked = false, notification, context = 'popup' }) => {
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
        onPacksChange?.(after.selectedPacks);
      }
    },
    [onFinish, saveStep, onStepChange, onPacksChange]
  );

  const togglePack = useCallback(
    (id: string) => {
      if (!packsLocked) {
        apply({ type: 'togglePack', id });
      }
    },
    [apply, packsLocked]
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
      notification={notification}
    >
      <WelcomeStepContent state={state} onTogglePack={togglePack} />
    </WelcomeFrame>
  );
};

export default WelcomeHost;

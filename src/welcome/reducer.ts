/**
 * The Welcome's state machine (architecture A6 of My-Prompt-Manager-ojz): the step shown, the way
 * the last step change went (the side the step slides in from) and the Packs selected. Pure: no
 * storage, no timer, no React. The frame (src/components/welcome/WelcomeHost.tsx) holds the state,
 * records each step change through the launch hook and finishes the Welcome on the finish signal.
 * Terms: CONTEXT.md, "Welcome", "Pack".
 */

import { PACKS } from './packs';
import type { WelcomeStep } from './storage';
import type { PromptPack } from './types';

/** How many steps the Welcome has */
export const STEP_COUNT = 3;

/** The last step, the Packs: its primary button finishes the Welcome */
export const LAST_STEP: WelcomeStep = 2;

/**
 * How the step shown was reached: from the step before it (it slides in from the right), from a
 * step after it (from the left), or not by a step change, at the opening (it shows at once)
 */
export type WelcomeDirection = 'none' | 'forward' | 'back';

export interface WelcomeState {
  readonly step: WelcomeStep;
  readonly direction: WelcomeDirection;
  /** The ids of the Packs selected on the last step */
  readonly selectedPacks: readonly string[];
}

export type WelcomeAction =
  /** The primary button: the next step, or at the last step the finish signal */
  | { readonly type: 'next' }
  /** One step back; nothing at the first step */
  | { readonly type: 'back' }
  /** Straight to the last step, the Packs; never finishes the Welcome */
  | { readonly type: 'skip' }
  /** A progress dot: its step */
  | { readonly type: 'goTo'; readonly step: WelcomeStep }
  /** A Pack in or out of the selection; an id that is no Pack changes nothing */
  | { readonly type: 'togglePack'; readonly id: string }
  /** The step and the Packs a Welcome closed early stored, ids that are no Pack dropped; without Packs, the default selection */
  | { readonly type: 'restore'; readonly step: WelcomeStep; readonly packs?: readonly string[] };

export interface WelcomeTransition {
  /** The state after the action; the very state given when the action changes nothing */
  readonly state: WelcomeState;
  /** True only for next at the last step: the Welcome is to finish. The state is then the one given */
  readonly finish: boolean;
}

/** The Packs selected when the user has chosen none yet: those marked defaultSelected, in their order */
export const defaultPackSelection = (packs: readonly PromptPack[] = PACKS): readonly string[] =>
  packs.filter((pack) => pack.defaultSelected).map((pack) => pack.id);

/** How many Prompts the Packs of a selection hold together: the N of the last step's "Add N prompts" */
export const promptCountOf = (selectedPacks: readonly string[], packs: readonly PromptPack[] = PACKS): number =>
  packs.filter((pack) => selectedPacks.includes(pack.id)).reduce((count, pack) => count + pack.prompts.length, 0);

/** The ids of the Packs the Welcome offers: the only ones a selection holds */
const PACK_IDS: ReadonlySet<string> = new Set(PACKS.map((pack) => pack.id));

const unchanged = (state: WelcomeState): WelcomeTransition => ({ state, finish: false });

/** The state at `step`, reached from the current step; the current step itself changes nothing */
const goTo = (state: WelcomeState, step: WelcomeStep): WelcomeTransition =>
  step === state.step ? unchanged(state) : { state: { ...state, step, direction: step > state.step ? 'forward' : 'back' }, finish: false };

/** The step after `step`, or none after the last */
const stepAfter = (step: WelcomeStep): WelcomeStep | undefined => (step === 0 ? 1 : step === 1 ? 2 : undefined);

/** The step before `step`, or none before the first */
const stepBefore = (step: WelcomeStep): WelcomeStep | undefined => (step === 2 ? 1 : step === 1 ? 0 : undefined);

/**
 * What an action makes of a state, and whether it finishes the Welcome. Never changes the state it
 * is given: an action that changes nothing gives that very state back.
 */
export const transition = (state: WelcomeState, action: WelcomeAction): WelcomeTransition => {
  switch (action.type) {
    case 'next': {
      const after = stepAfter(state.step);
      return after === undefined ? { state, finish: true } : goTo(state, after);
    }
    case 'back': {
      const before = stepBefore(state.step);
      return before === undefined ? unchanged(state) : goTo(state, before);
    }
    case 'skip':
      return goTo(state, LAST_STEP);
    case 'goTo':
      return goTo(state, action.step);
    case 'togglePack': {
      // An id that is no Pack selects nothing
      if (!PACK_IDS.has(action.id)) {
        return unchanged(state);
      }
      const selectedPacks = state.selectedPacks.includes(action.id)
        ? state.selectedPacks.filter((id) => id !== action.id)
        : [...state.selectedPacks, action.id];
      return { state: { ...state, selectedPacks }, finish: false };
    }
    case 'restore':
      return {
        state: {
          step: action.step,
          direction: 'none',
          // A stored id that is no Pack (one a later Release removed) is dropped
          selectedPacks: action.packs === undefined ? defaultPackSelection() : [...new Set(action.packs.filter((id) => PACK_IDS.has(id)))]
        },
        finish: false
      };
  }
};

/** The reducer of the Welcome, for useReducer: the state of `transition`, without the finish signal */
export const welcomeReducer = (state: WelcomeState, action: WelcomeAction): WelcomeState => transition(state, action).state;

/** The state a Welcome opens in: at its stored step and Packs, or at the first step with the default selection */
export const initialWelcomeState = (step: WelcomeStep = 0, packs?: readonly string[]): WelcomeState =>
  welcomeReducer(
    { step: 0, direction: 'none', selectedPacks: [] },
    { type: 'restore', step, ...(packs === undefined ? {} : { packs }) }
  );

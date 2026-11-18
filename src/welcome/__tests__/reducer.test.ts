import { describe, expect, it } from 'vitest';

import { PACKS } from '../packs';
import {
  defaultPackSelection,
  initialWelcomeState,
  LAST_STEP,
  STEP_COUNT,
  transition,
  type WelcomeAction,
  type WelcomeDirection,
  type WelcomeState,
  welcomeReducer
} from '../reducer';
import type { WelcomeStep } from '../storage';

const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected).map((pack) => pack.id);

/** A state at `step`, as after a step change forward, with a selection of its own */
const at = (step: WelcomeStep, selectedPacks: readonly string[] = ['writing']): WelcomeState => ({
  step,
  direction: 'forward',
  selectedPacks
});

/** Freezes a state and its selection, so a reducer that writes into them throws */
const frozen = (state: WelcomeState): WelcomeState => Object.freeze({ ...state, selectedPacks: Object.freeze([...state.selectedPacks]) });

interface Row {
  readonly from: WelcomeStep;
  readonly action: WelcomeAction;
  /** The state after, or 'same' for the input state itself, unchanged */
  readonly to: { readonly step: WelcomeStep; readonly direction: WelcomeDirection; readonly selectedPacks: readonly string[] } | 'same';
  readonly finish: boolean;
}

/** Every action from every step: the transition table of the Welcome */
const TABLE: readonly Row[] = [
  // next: one step forward; at the last step, the finish signal and no change of state
  { from: 0, action: { type: 'next' }, to: { step: 1, direction: 'forward', selectedPacks: ['writing'] }, finish: false },
  { from: 1, action: { type: 'next' }, to: { step: 2, direction: 'forward', selectedPacks: ['writing'] }, finish: false },
  { from: 2, action: { type: 'next' }, to: 'same', finish: true },
  // back: one step back; nothing at the first step
  { from: 0, action: { type: 'back' }, to: 'same', finish: false },
  { from: 1, action: { type: 'back' }, to: { step: 0, direction: 'back', selectedPacks: ['writing'] }, finish: false },
  { from: 2, action: { type: 'back' }, to: { step: 1, direction: 'back', selectedPacks: ['writing'] }, finish: false },
  // skip: to the last step from anywhere, never a finish
  { from: 0, action: { type: 'skip' }, to: { step: 2, direction: 'forward', selectedPacks: ['writing'] }, finish: false },
  { from: 1, action: { type: 'skip' }, to: { step: 2, direction: 'forward', selectedPacks: ['writing'] }, finish: false },
  { from: 2, action: { type: 'skip' }, to: 'same', finish: false },
  // goTo: the step asked for, sliding from the side it lies on; the current step changes nothing
  { from: 0, action: { type: 'goTo', step: 0 }, to: 'same', finish: false },
  { from: 0, action: { type: 'goTo', step: 1 }, to: { step: 1, direction: 'forward', selectedPacks: ['writing'] }, finish: false },
  { from: 0, action: { type: 'goTo', step: 2 }, to: { step: 2, direction: 'forward', selectedPacks: ['writing'] }, finish: false },
  { from: 1, action: { type: 'goTo', step: 0 }, to: { step: 0, direction: 'back', selectedPacks: ['writing'] }, finish: false },
  { from: 1, action: { type: 'goTo', step: 1 }, to: 'same', finish: false },
  { from: 1, action: { type: 'goTo', step: 2 }, to: { step: 2, direction: 'forward', selectedPacks: ['writing'] }, finish: false },
  { from: 2, action: { type: 'goTo', step: 0 }, to: { step: 0, direction: 'back', selectedPacks: ['writing'] }, finish: false },
  { from: 2, action: { type: 'goTo', step: 1 }, to: { step: 1, direction: 'back', selectedPacks: ['writing'] }, finish: false },
  { from: 2, action: { type: 'goTo', step: 2 }, to: 'same', finish: false },
  // togglePack: a Pack in or out of the selection, the step kept, from any step
  { from: 0, action: { type: 'togglePack', id: 'product' }, to: { step: 0, direction: 'forward', selectedPacks: ['writing', 'product'] }, finish: false },
  { from: 1, action: { type: 'togglePack', id: 'writing' }, to: { step: 1, direction: 'forward', selectedPacks: [] }, finish: false },
  { from: 2, action: { type: 'togglePack', id: 'product' }, to: { step: 2, direction: 'forward', selectedPacks: ['writing', 'product'] }, finish: false },
  { from: 2, action: { type: 'togglePack', id: 'writing' }, to: { step: 2, direction: 'forward', selectedPacks: [] }, finish: false },
  // restore: the stored step and Packs, shown at once (no slide); without Packs, the default selection
  { from: 0, action: { type: 'restore', step: 1, packs: ['product'] }, to: { step: 1, direction: 'none', selectedPacks: ['product'] }, finish: false },
  { from: 1, action: { type: 'restore', step: 2 }, to: { step: 2, direction: 'none', selectedPacks: DEFAULTS }, finish: false },
  { from: 2, action: { type: 'restore', step: 0, packs: [] }, to: { step: 0, direction: 'none', selectedPacks: [] }, finish: false }
];

const describeAction = (action: WelcomeAction): string => {
  switch (action.type) {
    case 'goTo':
      return `goTo(${String(action.step)})`;
    case 'togglePack':
      return `togglePack(${action.id})`;
    case 'restore':
      return `restore(${String(action.step)}, ${action.packs === undefined ? 'no packs' : JSON.stringify(action.packs)})`;
    default:
      return action.type;
  }
};

describe('Welcome reducer', () => {
  it('has three steps, the last one the Packs', () => {
    expect(STEP_COUNT).toBe(3);
    expect(LAST_STEP).toBe(2);
  });

  describe('the transition table: every action from every step', () => {
    it.each(TABLE.map((row) => [`step ${String(row.from + 1)}`, describeAction(row.action), row] as const))(
      'from %s, %s',
      (_from, _action, { from, action, to, finish }) => {
        const before = frozen(at(from));

        const result = transition(before, action);

        expect(result.finish).toBe(finish);
        if (to === 'same') {
          // The input itself: React keeps the screen as it is
          expect(result.state).toBe(before);
          expect(welcomeReducer(before, action)).toBe(before);
        } else {
          expect(result.state).toEqual(to);
          expect(welcomeReducer(before, action)).toEqual(to);
        }
      }
    );

    it('covers each action from each of the three steps', () => {
      const actions = ['next', 'back', 'skip', 'goTo', 'togglePack', 'restore'] as const;
      for (const type of actions) {
        for (const step of [0, 1, 2] as const) {
          expect(TABLE.some((row) => row.from === step && row.action.type === type), `${type} from step ${String(step + 1)}`).toBe(true);
        }
      }
    });
  });

  it('never changes the state it is given', () => {
    for (const { from, action } of TABLE) {
      const before = at(from, ['writing', 'product']);
      const copy = structuredClone(before);

      transition(frozen(before), action);
      transition(before, action);

      expect(before).toEqual(copy);
    }
  });

  it('next at the last step is only a finish signal: the state is the one given, selection included', () => {
    const last = at(LAST_STEP, ['product', 'engineering']);

    const result = transition(last, { type: 'next' });

    expect(result).toEqual({ state: last, finish: true });
    expect(result.state).toBe(last);
  });

  it('only next at the last step finishes: skip from anywhere never does', () => {
    for (const step of [0, 1, 2] as const) {
      expect(transition(at(step), { type: 'skip' }).finish).toBe(false);
    }
    const finishing = TABLE.filter((row) => row.finish);
    expect(finishing).toHaveLength(1);
    expect(finishing[0]).toMatchObject({ from: LAST_STEP, action: { type: 'next' } });
  });

  it('togglePack twice gives the selection back', () => {
    const start = at(2, ['product', 'writing']);

    const twice = welcomeReducer(welcomeReducer(start, { type: 'togglePack', id: 'hiring' }), { type: 'togglePack', id: 'hiring' });

    expect(twice.selectedPacks).toEqual(['product', 'writing']);
  });

  it('restore keeps each Pack once', () => {
    expect(welcomeReducer(at(0), { type: 'restore', step: 2, packs: ['writing', 'writing', 'product'] }).selectedPacks).toEqual(['writing', 'product']);
  });

  describe('the state a Welcome opens in', () => {
    it('a first opening: step 1, no slide, the Packs selected by default', () => {
      expect(initialWelcomeState()).toEqual({ step: 0, direction: 'none', selectedPacks: DEFAULTS });
    });

    it('a Welcome closed early: its stored step and Packs, shown at once', () => {
      expect(initialWelcomeState(1, ['engineering'])).toEqual({ step: 1, direction: 'none', selectedPacks: ['engineering'] });
    });

    it('a stored step without Packs: the default selection', () => {
      expect(initialWelcomeState(2)).toEqual({ step: 2, direction: 'none', selectedPacks: DEFAULTS });
    });
  });

  it('the default selection is every Pack marked defaultSelected, in the order of the Packs', () => {
    expect(defaultPackSelection()).toEqual(DEFAULTS);
    expect(DEFAULTS.length).toBeGreaterThan(0);
    expect(
      defaultPackSelection([
        { id: 'a', name: 'A', color: '#2563EB', defaultSelected: false, prompts: [] },
        { id: 'b', name: 'B', color: '#15803D', defaultSelected: true, prompts: [] }
      ])
    ).toEqual(['b']);
  });
});

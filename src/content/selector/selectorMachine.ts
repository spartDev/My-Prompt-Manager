/**
 * The Prompt selector's state machine: closed, list, variables, closing. Pure, no DOM, no timer.
 *
 * Choosing a Prompt does not insert it: it moves to `closing` with the Insertion `pending`. The
 * controller performs it once the selector has closed, so the text arrives after the selector left.
 */

import type { Prompt } from '../types/index';

import { promptsOf, type SelectorLibrary, type TabKey, tabsOf, variableCount } from './selectorData';

export type SelectorPhase = 'closed' | 'list' | 'variables' | 'closing';

/** An Insertion to perform once the selector has closed. `values` is null for a Prompt inserted as saved. */
export interface PendingInsertion {
  promptId: string;
  values: Readonly<Record<string, string>> | null;
}

export interface SelectorState {
  phase: SelectorPhase;
  library: SelectorLibrary;
  tab: TabKey;
  /** Index of the selected row in the listed Prompts. */
  index: number;
  /** The search text; empty when not searching. */
  query: string;
  /** The Prompt whose Variables are being filled in; kept while the selector closes from that step. */
  promptId: string | null;
  values: Readonly<Record<string, string>>;
  pending: PendingInsertion | null;
}

export type SelectorAction =
  | { type: 'open'; library: SelectorLibrary }
  | { type: 'close' }
  | { type: 'closed' }
  | { type: 'selectTab'; tab: TabKey }
  | { type: 'stepTab'; delta: 1 | -1 }
  | { type: 'move'; delta: 1 | -1 }
  | { type: 'select'; index: number }
  | { type: 'setQuery'; query: string }
  | { type: 'choose'; index?: number }
  | { type: 'back' }
  | { type: 'setValue'; name: string; value: string }
  | { type: 'submit' };

const EMPTY_LIBRARY: SelectorLibrary = { prompts: [], categories: [] };

export const closedState: SelectorState = {
  phase: 'closed',
  library: EMPTY_LIBRARY,
  tab: 'all',
  index: 0,
  query: '',
  promptId: null,
  values: {},
  pending: null
};

/** The Prompt whose Variables are being filled in, if any. */
export const chosenPrompt = (state: SelectorState): Prompt | undefined =>
  state.promptId === null ? undefined : state.library.prompts.find((prompt) => prompt.id === state.promptId);

/** The Prompts the list shows in this state. */
export const listedPrompts = (state: SelectorState): Prompt[] =>
  promptsOf(state.library, state.tab, state.query);

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export function selectorReducer(state: SelectorState, action: SelectorAction): SelectorState {
  if (action.type === 'open') {
    return { ...closedState, phase: 'list', library: action.library };
  }
  if (action.type === 'closed') {
    return state.phase === 'closing' ? closedState : state;
  }
  if (state.phase === 'closed' || state.phase === 'closing') {
    return state;
  }
  if (action.type === 'close') {
    return { ...state, phase: 'closing', pending: null };
  }

  if (state.phase === 'variables') {
    switch (action.type) {
      case 'back':
        return { ...state, phase: 'list', promptId: null, values: {} };
      case 'setValue':
        return { ...state, values: { ...state.values, [action.name]: action.value } };
      case 'submit':
        return state.promptId === null
          ? state
          : { ...state, phase: 'closing', pending: { promptId: state.promptId, values: state.values } };
      default:
        return state;
    }
  }

  switch (action.type) {
    case 'selectTab':
      return action.tab === state.tab ? state : { ...state, tab: action.tab, index: 0 };
    case 'stepTab': {
      const keys = tabsOf(state.library).map((tab) => tab.key);
      const next = keys[clamp(keys.indexOf(state.tab) + action.delta, 0, keys.length - 1)];
      return next === state.tab ? state : { ...state, tab: next, index: 0 };
    }
    case 'move': {
      const last = listedPrompts(state).length - 1;
      const index = clamp(state.index + action.delta, 0, Math.max(0, last));
      return index === state.index ? state : { ...state, index };
    }
    case 'select': {
      const last = listedPrompts(state).length - 1;
      const index = clamp(action.index, 0, Math.max(0, last));
      return index === state.index ? state : { ...state, index };
    }
    case 'setQuery':
      return action.query === state.query ? state : { ...state, query: action.query, index: 0 };
    case 'choose': {
      // A click chooses the row it is on, which becomes the selected one: Back returns to it
      const index = action.index ?? state.index;
      const prompt = listedPrompts(state).at(index);
      if (!prompt) {
        return state;
      }
      if (variableCount(prompt) > 0) {
        return { ...state, index, phase: 'variables', promptId: prompt.id, values: {} };
      }
      return { ...state, index, phase: 'closing', pending: { promptId: prompt.id, values: null } };
    }
    default:
      return state;
  }
}

/** A minimal store around the reducer, so the state lives outside React and the controller can drive it. */
export interface SelectorStore {
  getState: () => SelectorState;
  dispatch: (action: SelectorAction) => void;
  /** Replaces the state with one a pure transition computed from it (the keyboard rules). */
  setState: (next: SelectorState) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createSelectorStore(): SelectorStore {
  let state = closedState;
  const listeners = new Set<() => void>();

  const setState = (next: SelectorState): void => {
    if (next === state) {
      return;
    }
    state = next;
    for (const listener of [...listeners]) {
      listener();
    }
  };

  return {
    getState: () => state,
    dispatch: (action) => {
      setState(selectorReducer(state, action));
    },
    setState,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

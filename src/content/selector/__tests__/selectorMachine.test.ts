// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { closedState, createSelectorStore, listedPrompts, type SelectorAction, type SelectorState, selectorReducer } from '../selectorMachine';

import { ids, library } from './selector.fixtures';

const run = (state: SelectorState, ...actions: SelectorAction[]): SelectorState =>
  actions.reduce(selectorReducer, state);

const open = (): SelectorState => selectorReducer(closedState, { type: 'open', library });

describe('Prompt selector state machine', () => {
  it('opens on All, first row selected, with no search', () => {
    expect(open()).toMatchObject({ phase: 'list', tab: 'all', index: 0, query: '', pending: null });
  });

  it('opens on All again after another tab was shown', () => {
    const reopened = run(open(), { type: 'selectTab', tab: 'recent' }, { type: 'close' }, { type: 'closed' }, { type: 'open', library });

    expect(reopened).toMatchObject({ phase: 'list', tab: 'all', index: 0 });
  });

  it('closes in two steps: closing, then closed', () => {
    const closing = run(open(), { type: 'close' });

    expect(closing.phase).toBe('closing');
    expect(closing.pending).toBeNull();
    expect(run(closing, { type: 'closed' })).toBe(closedState);
  });

  it('ignores every action but open while closed or closing', () => {
    const closing = run(open(), { type: 'close' });

    expect(run(closedState, { type: 'move', delta: 1 }, { type: 'choose' }, { type: 'close' }, { type: 'closed' })).toBe(closedState);
    expect(run(closing, { type: 'move', delta: 1 }, { type: 'choose' }, { type: 'selectTab', tab: 'pinned' })).toBe(closing);
  });

  it('moves the selection and stops at both ends', () => {
    const top = open();
    const count = listedPrompts(top).length;
    const bottom = run(top, ...Array.from({ length: count + 3 }, (): SelectorAction => ({ type: 'move', delta: 1 })));

    expect(run(top, { type: 'move', delta: -1 })).toBe(top);
    expect(bottom.index).toBe(count - 1);
  });

  it('selects the row the pointer is on', () => {
    expect(run(open(), { type: 'select', index: 3 }).index).toBe(3);
    expect(run(open(), { type: 'select', index: 99 }).index).toBe(6);
  });

  it('changes tab, back to the first row, and stops at both ends', () => {
    const state = run(open(), { type: 'move', delta: 1 }, { type: 'stepTab', delta: 1 });
    const last = run(open(), ...Array.from({ length: 9 }, (): SelectorAction => ({ type: 'stepTab', delta: 1 })));

    expect(state).toMatchObject({ tab: 'pinned', index: 0 });
    expect(run(open(), { type: 'stepTab', delta: -1 }).tab).toBe('all');
    expect(last.tab).toBe('category:Empty');
  });

  it('a search goes back to the first row and lists matches of the whole Library', () => {
    const state = run(open(), { type: 'selectTab', tab: 'pinned' }, { type: 'move', delta: 1 }, { type: 'setQuery', query: 'weekly' });

    expect(state.index).toBe(0);
    expect(ids(listedPrompts(state))).toEqual(['p4']);
  });

  it('choosing a Prompt without Variables closes with its Insertion pending', () => {
    const state = run(open(), { type: 'choose' });

    expect(state.phase).toBe('closing');
    expect(state.pending).toEqual({ promptId: 'p2', values: null });
  });

  it('chooses the row given, for a click, and that row becomes the selected one', () => {
    expect(run(open(), { type: 'choose', index: 4 })).toMatchObject({ index: 4, pending: { promptId: 'p4', values: null } });
    expect(run(open(), { type: 'choose', index: 3 }, { type: 'back' })).toMatchObject({ phase: 'list', index: 3 });
  });

  it('choosing in an empty list does nothing', () => {
    const empty = run(open(), { type: 'selectTab', tab: 'category:Empty' });

    expect(run(empty, { type: 'choose' })).toBe(empty);
  });

  it('choosing a Prompt with Variables goes to the variables step', () => {
    const state = run(open(), { type: 'choose', index: 3 });

    expect(state).toMatchObject({ phase: 'variables', promptId: 'p3', values: {}, pending: null });
  });

  it('fills Variables, then closes with the values pending', () => {
    const state = run(open(), { type: 'choose', index: 3 }, { type: 'setValue', name: 'name', value: 'Ada' }, { type: 'submit' });

    expect(state.phase).toBe('closing');
    expect(state.pending).toEqual({ promptId: 'p3', values: { name: 'Ada' } });
  });

  it('goes back from the variables step to the list, keeping the tab and the selection', () => {
    const state = run(open(), { type: 'selectTab', tab: 'category:Work' }, { type: 'move', delta: 1 }, { type: 'move', delta: 1 }, { type: 'choose' }, { type: 'setValue', name: 'name', value: 'Ada' }, { type: 'back' });

    expect(state).toMatchObject({ phase: 'list', tab: 'category:Work', index: 2, promptId: null, values: {} });
  });

  it('closing from the variables step leaves no Insertion pending', () => {
    expect(run(open(), { type: 'choose', index: 3 }, { type: 'close' })).toMatchObject({ phase: 'closing', pending: null });
  });
});

describe('Prompt selector store', () => {
  it('notifies its subscribers only when the state changes', () => {
    const store = createSelectorStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.dispatch({ type: 'move', delta: 1 });
    expect(listener).not.toHaveBeenCalled();

    store.dispatch({ type: 'open', library });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().phase).toBe('list');

    unsubscribe();
    store.dispatch({ type: 'close' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

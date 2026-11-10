// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { keyTransition, type SelectorKey } from '../selectorKeys';
import { closedState, type SelectorState, selectorReducer } from '../selectorMachine';

import { library } from './selector.fixtures';

const list = selectorReducer(closedState, { type: 'open', library });
const variables = selectorReducer(list, { type: 'choose', index: 3 });

const press = (state: SelectorState, ...keys: (string | SelectorKey)[]): SelectorState =>
  keys.reduce<SelectorState>((current, key) => keyTransition(current, typeof key === 'string' ? { key } : key) ?? current, state);

describe('Keyboard in the list step', () => {
  it('ArrowDown and ArrowUp change the selected row', () => {
    expect(press(list, 'ArrowDown', 'ArrowDown').index).toBe(2);
    expect(press(list, 'ArrowDown', 'ArrowDown', 'ArrowUp').index).toBe(1);
  });

  it('ArrowRight and ArrowLeft change the tab', () => {
    expect(press(list, 'ArrowRight', 'ArrowRight').tab).toBe('recent');
    expect(press(list, 'ArrowRight', 'ArrowRight', 'ArrowLeft').tab).toBe('pinned');
  });

  it('Enter chooses the selected Prompt', () => {
    expect(press(list, 'ArrowDown', 'Enter')).toMatchObject({ phase: 'closing', pending: { promptId: 'p5', values: null } });
    expect(press(list, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter')).toMatchObject({ phase: 'variables', promptId: 'p3' });
  });

  it('Enter is the selector\'s even when the list is empty, so it never reaches the Platform', () => {
    const empty = selectorReducer(list, { type: 'selectTab', tab: 'category:Empty' });

    expect(keyTransition(empty, { key: 'Enter' })).toBe(empty);
  });

  it('Escape closes', () => {
    expect(press(list, 'Escape').phase).toBe('closing');
  });

  it('Tab is left to the browser', () => {
    expect(keyTransition(list, { key: 'Tab' })).toBeNull();
  });

  it('a character starts a search', () => {
    expect(press(list, 'w')).toMatchObject({ query: 'w', index: 0 });
  });

  it('a space, or a character with a modifier, starts no search', () => {
    expect(keyTransition(list, { key: ' ' })).toBeNull();
    expect(keyTransition(list, { key: 'v', metaKey: true })).toBeNull();
    expect(keyTransition(list, { key: 'a', ctrlKey: true })).toBeNull();
    expect(keyTransition(list, { key: 'x', altKey: true })).toBeNull();
  });

  describe('while searching', () => {
    const searching = press(list, 'w');

    it('characters and Backspace typed in the search field are left to it', () => {
      expect(keyTransition(searching, { key: 'e', inSearchField: true })).toBeNull();
      expect(keyTransition(searching, { key: 'Backspace', inSearchField: true })).toBeNull();
    });

    it('the horizontal arrows are left to the search field', () => {
      expect(keyTransition(searching, { key: 'ArrowLeft', inSearchField: true })).toBeNull();
      expect(keyTransition(searching, { key: 'ArrowRight', inSearchField: true })).toBeNull();
      expect(keyTransition(searching, { key: 'ArrowLeft' })).toBeNull();
    });

    it('characters typed before the search field has the focus still go into the search', () => {
      expect(press(searching, 'e', 'e')).toMatchObject({ query: 'wee' });
      expect(press(searching, 'e', 'Backspace', 'Backspace')).toMatchObject({ query: '' });
    });

    it('the vertical arrows and Enter still drive the list', () => {
      const two = selectorReducer(searching, { type: 'setQuery', query: 'home' });

      expect(press(two, 'ArrowDown').index).toBe(1);
      expect(press(two, 'ArrowDown', 'Enter').pending).toEqual({ promptId: 'p4', values: null });
    });

    it('Escape first leaves the search, then closes', () => {
      const cleared = press(searching, 'Escape');

      expect(cleared).toMatchObject({ phase: 'list', query: '' });
      expect(press(cleared, 'Escape').phase).toBe('closing');
    });
  });
});

describe('Keyboard in the variables step', () => {
  it('Escape goes back to the list', () => {
    expect(press(variables, 'Escape')).toMatchObject({ phase: 'list', promptId: null });
  });

  it('Enter inserts', () => {
    const filled = selectorReducer(variables, { type: 'setValue', name: 'name', value: 'Ada' });

    expect(press(filled, 'Enter')).toMatchObject({ phase: 'closing', pending: { promptId: 'p3', values: { name: 'Ada' } } });
  });

  it('the arrows, Tab and characters are left to the Variable field', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'a']) {
      expect(keyTransition(variables, { key })).toBeNull();
    }
  });
});

describe('Keyboard while closed or closing', () => {
  it('no key is the selector\'s', () => {
    const closing = selectorReducer(list, { type: 'close' });

    for (const key of ['Enter', 'Escape', 'ArrowDown', 'a']) {
      expect(keyTransition(closedState, { key })).toBeNull();
      expect(keyTransition(closing, { key })).toBeNull();
    }
  });
});

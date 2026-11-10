/**
 * Keyboard rules of the Prompt selector, as a pure function: (state, key) -> new state.
 *
 * `null` means the key is not the selector's: the focused element handles it natively (Tab moves
 * the focus, the arrows move the caret of a text field, a character goes into the search field).
 */

import { type SelectorState, selectorReducer } from './selectorMachine';

export interface SelectorKey {
  key: string;
  /** Whether the key was typed in the search field, which then handles text keys natively. */
  inSearchField?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

const isCharacter = (key: SelectorKey): boolean =>
  key.key.length === 1 && !key.ctrlKey && !key.metaKey && !key.altKey;

export function keyTransition(state: SelectorState, key: SelectorKey): SelectorState | null {
  if (state.phase === 'variables') {
    switch (key.key) {
      case 'Escape':
        return selectorReducer(state, { type: 'back' });
      case 'Enter':
        return selectorReducer(state, { type: 'submit' });
      default:
        return null;
    }
  }

  if (state.phase !== 'list') {
    return null;
  }

  const searching = state.query !== '';
  switch (key.key) {
    case 'ArrowDown':
      return selectorReducer(state, { type: 'move', delta: 1 });
    case 'ArrowUp':
      return selectorReducer(state, { type: 'move', delta: -1 });
    case 'ArrowRight':
      // While searching, the arrows move the caret in the search field
      return searching ? null : selectorReducer(state, { type: 'stepTab', delta: 1 });
    case 'ArrowLeft':
      return searching ? null : selectorReducer(state, { type: 'stepTab', delta: -1 });
    case 'Enter':
      return selectorReducer(state, { type: 'choose' });
    case 'Escape':
      // Escape first leaves the search, then closes
      return searching
        ? selectorReducer(state, { type: 'setQuery', query: '' })
        : selectorReducer(state, { type: 'close' });
    case 'Backspace':
      // Typed before the search field had the focus: the search loses its last character all the same
      return searching && !key.inSearchField ? selectorReducer(state, { type: 'setQuery', query: state.query.slice(0, -1) }) : null;
    default:
      // A character typed in the list starts a search, or goes on with it when the search field
      // does not have the focus yet (fast typing); once it has, the field takes the characters itself
      // A space starts no search: on the list it is not text
      return isCharacter(key) && !(searching && key.inSearchField) && (searching || key.key !== ' ')
        ? selectorReducer(state, { type: 'setQuery', query: state.query + key.key })
        : null;
  }
}

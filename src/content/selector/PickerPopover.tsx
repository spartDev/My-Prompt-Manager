import { type FC, type KeyboardEvent, useId, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { PickerFill } from './PickerFill';
import { PickerList } from './PickerList';
import { PickerTabs } from './PickerTabs';
import type { Placement } from './position';
import { type TabKey, tabsOf } from './selectorData';
import { keyTransition } from './selectorKeys';
import { chosenPrompt, listedPrompts, type SelectorState, type SelectorStore } from './selectorMachine';

export interface PickerPopoverProps {
  store: SelectorStore;
  placement: Placement;
}

const FOCUSABLE = 'button:not([tabindex="-1"]), input, [tabindex="0"]';

const emptyMessage = (state: SelectorState): string => {
  if (state.library.prompts.length === 0) {
    return 'No prompts yet. Add some in the extension popup!';
  }
  if (state.query !== '') {
    return 'No matching prompts.';
  }
  if (state.tab === 'pinned') {
    return 'No pinned prompts yet.';
  }
  if (state.tab === 'recent') {
    return 'No recent prompts yet.';
  }
  return 'Nothing in this category yet.';
};

/**
 * The Prompt selector: a dialog above the Platform's input field, with the tabs, the list of
 * Prompts and the keyboard hint. Its state lives in the store (selectorMachine) and its keyboard
 * rules in selectorKeys; this component renders the state and forwards the events.
 */
export const PickerPopover: FC<PickerPopoverProps> = ({ store, placement }) => {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const listId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const tabs = useMemo(() => tabsOf(state.library), [state.library]);
  const categoryColors = useMemo(
    () => new Map(state.library.categories.flatMap((category) => (category.color === undefined ? [] : [[category.name, category.color] as const]))),
    [state.library]
  );

  const searching = state.query !== '';

  // The focus goes to the list when the selector opens and when the search ends, and to the search
  // field when a search starts: the first character was typed on the list, the next ones go there.
  // In a layout effect, so the focus has moved before the next key arrives.
  useLayoutEffect(() => {
    if (state.phase !== 'list') {
      return;
    }
    if (searching) {
      const input = searchRef.current;
      if (input && !input.matches(':focus')) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(input.value.length, input.value.length);
      }
    } else {
      listRef.current?.focus({ preventScroll: true });
    }
  }, [state.phase, searching]);

  if (state.phase === 'closed') {
    return null;
  }

  const prompts = listedPrompts(state);
  // The Prompt whose Variables are being filled in; it stays shown while the selector closes from that step
  const filling = chosenPrompt(state);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.nativeEvent.isComposing) {
      return;
    }

    // Tab stays inside the dialog: past its last control the focus would land on the Platform
    if (event.key === 'Tab') {
      const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      const root = dialogRef.current?.getRootNode();
      const active = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
      const edge = event.shiftKey ? controls.at(0) : controls.at(-1);
      if (controls.length > 0 && active === edge) {
        event.preventDefault();
        (event.shiftKey ? controls.at(-1) : controls.at(0))?.focus();
      }
      return;
    }

    // A focused button keeps Enter and Space for itself
    if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLButtonElement) {
      return;
    }

    const next = keyTransition(store.getState(), {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      inSearchField: event.target === searchRef.current
    });
    if (next === null) {
      return;
    }
    event.preventDefault();
    store.setState(next);
  };

  const selectTab = (tab: TabKey): void => {
    // Choosing a tab leaves the search: the list is that tab's again
    store.dispatch({ type: 'setQuery', query: '' });
    store.dispatch({ type: 'selectTab', tab });
    listRef.current?.focus({ preventScroll: true });
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: the dialog handles the keys of the controls inside it
    <div
      ref={dialogRef}
      className="mpm-popover"
      role="dialog"
      aria-label={filling ? `Fill in the variables of ${filling.title}` : 'Insert a prompt'}
      data-side={placement.side}
      data-closing={state.phase === 'closing'}
      style={{
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
        ...(placement.side === 'above' ? { bottom: placement.offset } : { top: placement.offset })
      }}
      onKeyDown={onKeyDown}
    >
      {filling ? (
        <PickerFill
          prompt={filling}
          values={state.values}
          onChange={(name, value) => { store.dispatch({ type: 'setValue', name, value }); }}
          onBack={() => { store.dispatch({ type: 'back' }); }}
          onInsert={() => { store.dispatch({ type: 'submit' }); }}
        />
      ) : (
        <>
          <div className="mpm-header">
            {searching ? (
              <input
                ref={searchRef}
                className="mpm-search"
                type="text"
                role="combobox"
                aria-label="Search prompts"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                value={state.query}
                onChange={(event) => { store.dispatch({ type: 'setQuery', query: event.target.value }); }}
              />
            ) : (
              <h2 className="mpm-title">Insert a prompt</h2>
            )}
            <button type="button" className="mpm-close" aria-label="Close" title="Close (esc)" onClick={() => { store.dispatch({ type: 'close' }); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <PickerTabs tabs={tabs} active={searching ? null : state.tab} listId={listId} onSelect={selectTab} />
          <PickerList
            id={listId}
            prompts={prompts}
            index={state.index}
            listKey={searching ? 'search' : state.tab}
            categoryColors={categoryColors}
            emptyMessage={emptyMessage(state)}
            listRef={listRef}
            onSelect={(index) => { store.dispatch({ type: 'select', index }); }}
            onChoose={(index) => { store.dispatch({ type: 'choose', index }); }}
          />
          <div className="mpm-footer" aria-hidden="true">↑↓ choose · ←→ category · ↵ insert · esc close</div>
        </>
      )}
    </div>
  );
};

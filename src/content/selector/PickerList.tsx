import { type FC, type Ref, useEffect, useRef } from 'react';

import type { Prompt } from '../types/index';

import { variableCount } from './selectorData';

interface PickerListProps {
  id: string;
  prompts: readonly Prompt[];
  /** Index of the selected row. */
  index: number;
  /** Changes with the tab or the search, so the rows of a new list animate in. */
  listKey: string;
  /** Color of each Category by name; a Category without one takes the default dot. */
  categoryColors: ReadonlyMap<string, string>;
  /** Shown in place of the rows when there is none. */
  emptyMessage: string;
  listRef: Ref<HTMLDivElement>;
  onSelect: (index: number) => void;
  onChoose: (index: number) => void;
}

export const rowId = (listId: string, promptId: string): string => `${listId}-${promptId}`;

const variablesLabel = (count: number): string => `${String(count)} variable${count > 1 ? 's' : ''}`;

/**
 * The list of Prompts: a listbox that keeps the focus while its selected row moves
 * (aria-activedescendant). Each row shows the Prompt's title, its Category and how many
 * Variables it has. Text is rendered as text, never as markup (Verbatim).
 */
export const PickerList: FC<PickerListProps> = ({ id, prompts, index, listKey, categoryColors, emptyMessage, listRef, onSelect, onChoose }) => {
  const selectedRef = useRef<HTMLDivElement | null>(null);
  const selected = prompts.at(index);
  // Names the selected row of this list: it changes when the selection moves and when the list does
  const selectedKey = selected ? `${listKey}:${selected.id}` : null;

  // The selected row stays visible when the keyboard moves it
  useEffect(() => {
    if (selectedKey !== null) {
      selectedRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedKey]);

  return (
    <div
      ref={listRef}
      id={id}
      className="mpm-list"
      role="listbox"
      aria-label="Prompts"
      aria-activedescendant={selected ? rowId(id, selected.id) : undefined}
      tabIndex={0}
    >
      {prompts.map((prompt, i) => {
        const variables = variableCount(prompt);
        const color = categoryColors.get(prompt.category);
        return (
          // The listbox holds the focus and the keyboard; a row only answers the pointer
          // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled on the dialog (selectorKeys)
          <div
            key={`${listKey}:${prompt.id}`}
            ref={i === index ? selectedRef : undefined}
            id={rowId(id, prompt.id)}
            className="mpm-row"
            role="option"
            aria-selected={i === index}
            tabIndex={-1}
            data-prompt-id={prompt.id}
            // mousemove, not mouseenter: a row that scrolls under a still pointer must not take the selection
            onMouseMove={() => { if (i !== index) { onSelect(i); } }}
            onClick={() => { onChoose(i); }}
          >
            <span className="mpm-row-title">{prompt.title}</span>
            <span className="mpm-row-meta">
              <span className="mpm-dot" style={color === undefined ? undefined : { background: color }} aria-hidden="true" />
              <span className="mpm-row-category">{prompt.category}</span>
              {variables > 0 && <span className="mpm-row-variables">{variablesLabel(variables)}</span>}
            </span>
          </div>
        );
      })}
      {prompts.length === 0 && <div className="mpm-empty">{emptyMessage}</div>}
    </div>
  );
};

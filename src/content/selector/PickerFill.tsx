import { type FC, useLayoutEffect, useRef } from 'react';

import { splitVariables } from '../../utils/promptVariables';
import type { Prompt } from '../types/index';

interface PickerFillProps {
  prompt: Prompt;
  /** What the user typed for each Variable, by name. */
  values: Readonly<Record<string, string>>;
  onChange: (name: string, value: string) => void;
  onBack: () => void;
  onInsert: () => void;
}

/** As wide as what it holds: the value typed, or the Variable's name while it is empty. */
const widthOf = (name: string, value: string): string => `${String(Math.max(value.length, name.length) + 1)}ch`;

/**
 * The variables step: the Prompt's text as saved, with a field in place of each Variable, in the
 * flow of the text. A Variable written twice has two fields that share one value. A field left
 * empty leaves its Variable as written ({{name}}) in the inserted text.
 */
export const PickerFill: FC<PickerFillProps> = ({ prompt, values, onChange, onBack, onInsert }) => {
  const firstRef = useRef<HTMLInputElement | null>(null);
  const segments = splitVariables(prompt.content);
  const firstVariable = segments.findIndex((segment) => segment.kind === 'variable');

  // The focus goes into the first Variable when the step opens
  useLayoutEffect(() => {
    firstRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="mpm-fill">
      <div className="mpm-fill-header">
        <button type="button" className="mpm-back" aria-label="Back to the list" title="Back (esc)" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h2 className="mpm-fill-title">{prompt.title}</h2>
      </div>
      <p className="mpm-fill-text">
        {segments.map((segment, i) => {
          if (segment.kind === 'text') {
            // biome-ignore lint/suspicious/noArrayIndexKey: the segments of a saved Prompt never reorder
            return <span key={i}>{segment.text}</span>;
          }
          const value = values[segment.name] ?? '';
          return (
            <input
              // biome-ignore lint/suspicious/noArrayIndexKey: the segments of a saved Prompt never reorder
              key={i}
              ref={i === firstVariable ? firstRef : undefined}
              className="mpm-variable"
              type="text"
              aria-label={segment.name}
              placeholder={segment.name}
              autoComplete="off"
              spellCheck={false}
              data-filled={value.trim() !== ''}
              style={{ width: widthOf(segment.name, value) }}
              value={value}
              onChange={(event) => { onChange(segment.name, event.target.value); }}
            />
          );
        })}
      </p>
      <div className="mpm-fill-actions">
        <button type="button" className="mpm-insert" onClick={onInsert}>Insert into the chat ↵</button>
      </div>
    </div>
  );
};

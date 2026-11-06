import type { FC } from 'react';
import { useMemo } from 'react';

import { cn } from '../../utils/cn';
import { splitVariables } from '../../utils/promptVariables';

export interface VariableTextareaProps {
  id: string;
  name: string;
  /** The text as typed: also the textarea's defaultValue, so a form reset restores it (React 19) */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  ariaLabel: string;
}

// Mirror and textarea share every rule that decides where a line wraps, so each Variable's mark
// sits exactly under its text
const TEXT_LAYOUT = 'px-4 py-3.5 text-sm leading-relaxed whitespace-pre-wrap break-words';

/**
 * A textarea whose Variables ({{name}}) are highlighted. The text is drawn by a mirror under a
 * transparent textarea, which keeps the caret, selection and editing native. The mirror is in the
 * flow, so the field grows with its text and never scrolls on its own. The text is never changed:
 * the mirror only shows it (Verbatim).
 */
const VariableTextarea: FC<VariableTextareaProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  describedBy,
  ariaLabel
}) => {
  // Each segment keyed by where it starts in the text
  const segments = useMemo(() => {
    let start = 0;
    return splitVariables(value).map(segment => {
      const keyed = { ...segment, start };
      start += segment.text.length;
      return keyed;
    });
  }, [value]);

  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-subtle transition-colors focus-within:ring-2 focus-within:ring-accent',
        invalid ? 'border-error' : 'border-input focus-within:border-focus',
        disabled && 'opacity-60'
      )}
    >
      <div aria-hidden="true" data-testid="variable-mirror" className={cn(TEXT_LAYOUT, 'min-h-44 text-primary')}>
        {segments.map(segment =>
          segment.kind === 'variable' ? (
            // Same weight as the textarea's text: a bolder mark would push the caret off its letters
            <mark key={segment.start} className="rounded bg-accent-selected text-accent-strong">
              {segment.text}
            </mark>
          ) : (
            <span key={segment.start}>{segment.text}</span>
          )
        )}
        {/* Keeps a last empty line (text ending with a line break) as tall as in the textarea */}
        {'\u200b'}
      </div>
      <textarea
        id={id}
        name={name}
        defaultValue={value}
        onChange={(event) => { onChange(event.target.value); }}
        placeholder={placeholder}
        disabled={disabled}
        required
        spellCheck={false}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cn(
          TEXT_LAYOUT,
          'absolute inset-0 w-full h-full resize-none overflow-hidden bg-transparent border-0 outline-none text-transparent caret-(--text-color-primary) placeholder:text-tertiary selection:bg-accent-selected/60 disabled:cursor-not-allowed'
        )}
      />
    </div>
  );
};

export default VariableTextarea;

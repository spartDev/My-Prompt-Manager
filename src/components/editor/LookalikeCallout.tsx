import type { FC } from 'react';
import { useId } from 'react';

import type { Lookalike } from '../../services/promptLookalike';

export interface LookalikeCalloutProps {
  /** The Prompt of the Library the text looks like, and how alike they are */
  lookalike: Lookalike;
  /** The text being written */
  yours: string;
  onKeepBoth: () => void;
  disabled?: boolean;
}

/**
 * "This looks familiar" (Atelier 1C): the Prompt of the Library the text being written looks like,
 * with how alike they are and the first lines of both. Keep both dismisses it; it never blocks Save.
 */
const LookalikeCallout: FC<LookalikeCalloutProps> = ({ lookalike, yours, onKeepBoth, disabled }) => {
  const titleId = useId();
  const sides = [
    { label: 'Yours', text: yours },
    { label: 'Existing', text: lookalike.prompt.content }
  ];

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-2.5 p-3.5 rounded-group bg-callout border-[1.5px] border-warning animate-pop"
    >
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="w-[30px] h-[30px] shrink-0 grid place-items-center rounded-full bg-warning-subtle text-warning text-[15px] font-extrabold">!</span>
        <div className="flex flex-col">
          <h2 id={titleId} className="text-sm font-extrabold text-callout">This looks familiar</h2>
          <p className="text-[12.5px] text-warning">
            {Math.round(lookalike.similarity * 100)}% like “{lookalike.prompt.title}”
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {sides.map(side => (
          <div key={side.label} className="px-2.5 py-2 rounded-xl bg-card">
            <span className="block text-[11px] font-bold text-warning">{side.label}</span>
            {/* Verbatim, cut to its first lines */}
            <p className="mt-0.5 text-xs leading-snug text-secondary whitespace-pre-wrap break-words line-clamp-3">{side.text}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onKeepBoth}
        disabled={disabled}
        className="self-start h-[34px] px-3.5 rounded-full border-[1.5px] border-warning text-warning text-[13px] font-bold hover:bg-card transition-colors focus-interactive disabled:opacity-50"
      >
        Keep both
      </button>
    </section>
  );
};

export default LookalikeCallout;

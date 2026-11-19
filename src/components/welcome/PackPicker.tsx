import { type CSSProperties, type FC, useId } from 'react';

import { cn } from '../../utils';
import { packColors } from '../../welcome/packColors';
import { PACKS } from '../../welcome/packs';
import { welcomePlatformNames } from '../../welcome/platforms';
import type { PromptPack } from '../../welcome/types';

/** The Platforms the extension works on, from the config */
const PLATFORM_NAMES = welcomePlatformNames();

/**
 * A Pack's colors in both themes, as variables its classes read: a Pack becomes a Category, and its
 * color is user data, drawn with the Category chip rule (src/welcome/packColors.ts) as CategoryChips
 * does. The tint and the text are a selected Pack's; the mark is its dot, and a selected Pack's
 * border and check round.
 */
const packStyle = (color: string): CSSProperties => {
  const { tint, light, dark } = packColors(color);
  return {
    '--pack-tint': tint,
    '--pack-text': light.text,
    '--pack-text-dark': dark.text,
    '--pack-mark': light.mark,
    '--pack-mark-dark': dark.mark
  } as CSSProperties;
};

/** The Pack's color as a fill: as is in light, lifted toward white in dark */
const MARK_FILL = 'bg-[var(--pack-mark)] dark:bg-[var(--pack-mark-dark)]';

const CheckIcon: FC = () => (
  <svg viewBox="0 0 24 24" className="size-[11px]" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/**
 * A Pack as a toggle button: its color dot, its name and its number of Prompts. Unselected, it is a
 * card outlined in the field border color, 3:1 on the frame. Selected, it takes its tint, a border
 * of its color and a round check that pops in at the top right; pressed, it shrinks to 95% on the
 * spring.
 */
const PackToggle: FC<{ pack: PromptPack; selected: boolean; onToggle: (id: string) => void }> = ({ pack, selected, onToggle }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={() => {
      onToggle(pack.id);
    }}
    style={packStyle(pack.color)}
    className={cn(
      'relative flex flex-col items-start gap-3 rounded-[18px] border-[1.5px] p-[13px] text-left active:scale-95 transition-chip focus-interactive',
      selected
        ? 'border-[color:var(--pack-mark)] bg-[var(--pack-tint)] text-[var(--pack-text)] dark:border-[color:var(--pack-mark-dark)] dark:text-[var(--pack-text-dark)]'
        : 'border-input bg-card text-primary'
    )}
  >
    {/* A Pack's color is user data, not a token */}
    <span data-pack-dot aria-hidden="true" className={cn('size-2.5 rounded-full', MARK_FILL)} />
    {/* The space between the name and the count is for assistive technology: "Product 5 prompts" */}
    <span className="flex flex-col">
      <span className="text-[14.5px] font-extrabold">{pack.name}</span>{' '}
      <span className={cn('text-xs', !selected && 'text-secondary')}>{`${String(pack.prompts.length)} prompts`}</span>
    </span>
    {selected && (
      <span
        data-pack-check
        aria-hidden="true"
        className={cn('absolute top-[11px] right-[11px] grid size-5 place-items-center rounded-full text-on-pack-check animate-welcome-check', MARK_FILL)}
      >
        <CheckIcon />
      </span>
    )}
  </button>
);

export interface PackPickerProps {
  /** The ids of the Packs selected */
  selectedPacks: readonly string[];
  /** A Pack in or out of the selection */
  onTogglePack: (id: string) => void;
}

/**
 * The Packs of the Welcome's last step in two columns, then the Platforms the extension works on as
 * a row of pills after the caption "Type // in the chat on": the row reads as one sentence ending in
 * the Platform names and says what to do in the chat (decision D1, My-Prompt-Manager-ojz.19; `//` is
 * SELECTOR_TRIGGER of src/content/selector/inputText.ts). The caption is also the pills' list's name.
 * The grid scrolls within itself when the Packs do not fit (a short side panel, more Packs), so the
 * Platforms, the dots and the primary button stay in view. While Packs remain beyond its top or
 * bottom, that edge fades out and a line shows along it (welcome-packs-* in src/popup.css, driven by
 * the grid's scroll), so a Pack, a selected one counted in the primary button included, is never out
 * of view unseen. A Pack the keyboard reaches scrolls into view with its focus outline, and while a
 * Pack has the focus the fades step aside, the lines staying, so its outline is whole.
 */
const PackPicker: FC<PackPickerProps> = ({ selectedPacks, onTogglePack }) => {
  const captionId = useId();
  return (
    <>
      {/* The edges: they draw the lines of the cue, outside the grid's scroll box and its fade */}
      <div className="welcome-packs-edges relative flex min-h-0 flex-col">
        {/* The padding leaves room for a toggle's focus outline (3px past its border) inside the grid's
            scroll box, with some to spare, so a 320 x 420 side panel holds a whole Pack with its outline
            whole; the negative margins take it back, so the Packs line up with the title and the pills.
            The scroll padding brings a Pack the keyboard reaches into view with its outline */}
        <div
          role="group"
          aria-label="Packs"
          data-testid="welcome-packs"
          className="welcome-packs-scroll -m-1.5 grid min-h-0 grid-cols-2 gap-2 overflow-y-auto scroll-py-1 p-1.5"
        >
          {PACKS.map((pack) => (
            <PackToggle key={pack.id} pack={pack} selected={selectedPacks.includes(pack.id)} onToggle={onTogglePack} />
          ))}
        </div>
      </div>
      {/* One wrapping row, the caption then the pills. The list takes no box of its own (contents, as
          CategoryChips' radiogroup), so its pills wrap with the caption as the words of one sentence */}
      <div data-testid="welcome-platforms" className="flex flex-none flex-wrap items-center justify-center gap-[5px]">
        <span id={captionId} className="px-0.5 text-xs font-medium whitespace-nowrap text-secondary">
          Type <span className="font-extrabold">{'//'}</span> in the chat on
        </span>
        <ul aria-labelledby={captionId} className="contents">
          {PLATFORM_NAMES.map((name) => (
            <li key={name} className="inline-flex h-6 items-center rounded-full bg-card px-2.5 text-[11.5px] font-semibold text-secondary">
              {name}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default PackPicker;

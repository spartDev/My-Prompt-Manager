import type { CSSProperties, FC } from 'react';

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
 * a row of pills. The grid scrolls within itself when more Packs than fit are offered, so the
 * Platforms, the dots and the primary button stay in view.
 */
const PackPicker: FC<PackPickerProps> = ({ selectedPacks, onTogglePack }) => (
  <>
    {/* The padding leaves room for a toggle's focus outline inside the grid's scroll box; the negative
        margins take it back, so the Packs line up with the title and the pills */}
    <div role="group" aria-label="Packs" data-testid="welcome-packs" className="-m-1 grid min-h-0 grid-cols-2 gap-2 overflow-y-auto p-1">
      {PACKS.map((pack) => (
        <PackToggle key={pack.id} pack={pack} selected={selectedPacks.includes(pack.id)} onToggle={onTogglePack} />
      ))}
    </div>
    <ul aria-label="Works on" className="flex flex-none flex-wrap justify-center gap-[5px]">
      {PLATFORM_NAMES.map((name) => (
        <li key={name} className="inline-flex h-6 items-center rounded-full bg-card px-2.5 text-[11.5px] font-semibold text-secondary">
          {name}
        </li>
      ))}
    </ul>
  </>
);

export default PackPicker;

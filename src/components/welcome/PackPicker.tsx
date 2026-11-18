import type { CSSProperties, FC } from 'react';

import { getSoftBadgeColors } from '../../constants/colors';
import { cn } from '../../utils';
import { PACKS } from '../../welcome/packs';
import { welcomePlatformNames } from '../../welcome/platforms';
import type { PromptPack } from '../../welcome/types';

/** The Platforms the extension works on, from the config */
const PLATFORM_NAMES = welcomePlatformNames();

/**
 * A selected Pack's tint and text, in both themes: a Pack becomes a Category, and its color is
 * user data, drawn with the Category chip rule (src/theme/categoryChip.ts) as CategoryChips does.
 * Its border and its check take the Pack's own color.
 */
const selectedStyle = (color: string): CSSProperties => {
  const light = getSoftBadgeColors(color, 'light');
  const dark = getSoftBadgeColors(color, 'dark');
  return {
    '--pack-bg': light.background,
    '--pack-fg': light.text,
    '--pack-bg-dark': dark.background,
    '--pack-fg-dark': dark.text,
    borderColor: color
  } as CSSProperties;
};

const CheckIcon: FC = () => (
  <svg viewBox="0 0 24 24" className="size-[11px]" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

/**
 * A Pack as a toggle button: its color dot, its name and its number of Prompts. Selected, it takes
 * its tint, a border of its color and a round check that pops in at the top right; pressed, it
 * shrinks to 95% on the spring.
 */
const PackToggle: FC<{ pack: PromptPack; selected: boolean; onToggle: (id: string) => void }> = ({ pack, selected, onToggle }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={() => {
      onToggle(pack.id);
    }}
    style={selected ? selectedStyle(pack.color) : undefined}
    className={cn(
      'relative flex flex-col items-start gap-3 rounded-[18px] border-[1.5px] p-[13px] text-left active:scale-95 transition-chip focus-interactive',
      selected
        ? 'bg-[var(--pack-bg)] text-[var(--pack-fg)] dark:bg-[var(--pack-bg-dark)] dark:text-[var(--pack-fg-dark)]'
        : 'border-default bg-card text-primary'
    )}
  >
    {/* A Pack's color is user data, not a token */}
    <span data-pack-dot aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: pack.color }} />
    {/* The space between the name and the count is for assistive technology: "Product 5 prompts" */}
    <span className="flex flex-col">
      <span className="text-[14.5px] font-extrabold">{pack.name}</span>{' '}
      <span className={cn('text-xs', !selected && 'text-secondary')}>{`${String(pack.prompts.length)} prompts`}</span>
    </span>
    {selected && (
      <span
        data-pack-check
        aria-hidden="true"
        className="absolute top-[11px] right-[11px] grid size-5 place-items-center rounded-full text-on-accent animate-welcome-check"
        style={{ backgroundColor: pack.color }}
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
    {/* The padding leaves room for a toggle's focus outline inside the grid's scroll box and the step's */}
    <div role="group" aria-label="Packs" data-testid="welcome-packs" className="-my-1 grid min-h-0 grid-cols-2 gap-2 overflow-y-auto p-1">
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

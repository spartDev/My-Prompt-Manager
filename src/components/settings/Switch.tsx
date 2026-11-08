import type { FC } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Id of the visible label that names the switch; prefer it to ariaLabel */
  labelledBy?: string;
  /** Name of the switch when no visible label names it */
  ariaLabel?: string;
}

/**
 * A setting that is on or off (Atelier 1C). On: the accent track; off: the field-outline track, 3:1 on
 * every surface. The knob slides with the spring curve; both durations are motion tokens.
 */
const Switch: FC<SwitchProps> = ({ checked, onChange, disabled = false, labelledBy, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelledBy}
    aria-label={labelledBy ? undefined : ariaLabel}
    onClick={() => { onChange(!checked); }}
    disabled={disabled}
    className={`
      relative inline-flex shrink-0 w-[42px] h-6 rounded-full
      transition-colors duration-(--duration-track) focus-interactive
      ${checked ? 'bg-accent' : 'bg-(--border-color-input)'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `}
  >
    <span
      aria-hidden="true"
      className={`
        absolute top-[3px] left-[3px] size-[18px] rounded-full bg-(--text-color-on-accent) shadow-knob
        transition-transform duration-(--duration-spring) ease-spring
        ${checked ? 'translate-x-[18px]' : 'translate-x-0'}
      `}
    />
  </button>
);

export default Switch;

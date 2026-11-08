import type { ReactNode } from 'react';

import { useRadioGroup } from '../../hooks/useRadioGroup';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Id of the visible label that names the group */
  labelledBy: string;
  /** Shown dimmed and does not change while true (a save in progress) */
  locked?: boolean;
}

/**
 * A choice among two or three options (Atelier 1C): a puck slides under the chosen one with the spring
 * curve. The puck carries a field-outline border, so the chosen option reads at 3:1 on the track.
 * A radio group: one tab stop, arrows move and choose (useRadioGroup).
 */
const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  labelledBy,
  locked = false
}: SegmentedControlProps<T>): ReactNode => {
  const selectedIndex = options.findIndex(option => option.value === value);
  const { getRadioProps } = useRadioGroup({
    options,
    selectedIndex,
    onSelect: (option) => { onChange(option.value); },
    locked
  });

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-disabled={locked || undefined}
      className={`relative grid shrink-0 w-[186px] h-[34px] p-[3px] rounded-full bg-subtle ${locked ? 'opacity-50' : ''}`}
      style={{ gridTemplateColumns: `repeat(${String(options.length)}, minmax(0, 1fr))` }}
    >
      {selectedIndex >= 0 && (
        <span
          data-testid="segmented-puck"
          aria-hidden="true"
          className="absolute top-[3px] bottom-[3px] left-[3px] rounded-full bg-card border-[1.5px] border-input shadow-puck transition-transform duration-(--duration-spring) ease-spring"
          style={{
            width: `calc((100% - 6px) / ${String(options.length)})`,
            transform: `translateX(${String(selectedIndex * 100)}%)`
          }}
        />
      )}
      {options.map((option, index) => {
        const chosen = index === selectedIndex;
        return (
          <button
            key={option.value}
            {...getRadioProps(index)}
            type="button"
            role="radio"
            aria-checked={chosen}
            aria-disabled={locked || undefined}
            className={`
              relative rounded-full text-[12.5px] font-bold transition-colors duration-(--duration-color) focus-interactive
              ${chosen ? 'text-primary' : 'text-tertiary hover:text-secondary'}
              ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;

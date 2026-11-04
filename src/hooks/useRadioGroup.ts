import { type KeyboardEvent, type RefObject, useRef } from 'react';

export interface UseRadioGroupOptions<T> {
  /** The options, in the order the radios render */
  options: readonly T[];
  /** Index of the chosen option; -1 when none is chosen (the first option then takes the tab stop) */
  selectedIndex: number;
  /** Chooses an option: called on click and on every arrow, Home or End */
  onSelect: (option: T, index: number) => void;
  /** Ignores clicks and keys while true (a save in progress); the keys still do not scroll the page */
  locked?: boolean;
}

export interface RadioProps<E extends HTMLElement> {
  ref: (element: E | null) => void;
  tabIndex: 0 | -1;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<E>) => void;
}

export interface RadioGroup<E extends HTMLElement> {
  /** Props to spread on the radio at `index`, next to its role="radio" and aria-checked */
  getRadioProps: (index: number) => RadioProps<E>;
  /** The radio elements by index, for callers that measure or scroll them */
  radios: RefObject<Array<E | null>>;
}

/**
 * The keyboard behavior of a WAI-ARIA radio group: one tab stop, on the chosen option; the four
 * arrows (with wrap), Home and End move the focus and the selection together.
 * Every component that renders role="radio" uses it (guarded by components/__tests__/radioGroups.test.ts).
 */
export function useRadioGroup<T, E extends HTMLElement = HTMLButtonElement>({
  options,
  selectedIndex,
  onSelect,
  locked = false
}: UseRadioGroupOptions<T>): RadioGroup<E> {
  const radios = useRef<Array<E | null>>([]);
  const count = options.length;
  const tabStop = selectedIndex >= 0 && selectedIndex < count ? selectedIndex : 0;

  const targetOf = (key: string, index: number): number | null => {
    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return (index + 1) % count;
      case 'ArrowLeft':
      case 'ArrowUp':
        return (index - 1 + count) % count;
      case 'Home':
        return 0;
      case 'End':
        return count - 1;
      default:
        return null;
    }
  };

  const getRadioProps = (index: number): RadioProps<E> => ({
    ref: (element) => { radios.current[index] = element; },
    tabIndex: index === tabStop ? 0 : -1,
    onClick: () => {
      if (!locked) { onSelect(options[index], index); }
    },
    onKeyDown: (event) => {
      const target = targetOf(event.key, index);
      if (target === null) { return; }

      event.preventDefault();
      if (locked) { return; }
      radios.current[target]?.focus();
      onSelect(options[target], target);
    }
  });

  return { getRadioProps, radios };
}

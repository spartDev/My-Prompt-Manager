import { fireEvent, render, screen } from '@testing-library/react';
import { type FC, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useRadioGroup } from '../useRadioGroup';

const OPTIONS = ['Light', 'Dark', 'System'] as const;
type Option = typeof OPTIONS[number];

interface GroupProps {
  initial?: Option | null;
  locked?: boolean;
  onSelect?: (option: Option) => void;
}

/** A radio group wired the way the components wire it: the chosen option lives in the caller */
const Group: FC<GroupProps> = ({ initial = 'Light', locked = false, onSelect }) => {
  const [chosen, setChosen] = useState<Option | null>(initial);
  const { getRadioProps } = useRadioGroup({
    options: OPTIONS,
    selectedIndex: chosen === null ? -1 : OPTIONS.indexOf(chosen),
    onSelect: (option) => { setChosen(option); onSelect?.(option); },
    locked
  });

  return (
    <div role="radiogroup" aria-label="Theme">
      {OPTIONS.map((option, index) => (
        <button key={option} type="button" role="radio" aria-checked={chosen === option} {...getRadioProps(index)}>
          {option}
        </button>
      ))}
    </div>
  );
};

const radio = (name: Option) => screen.getByRole('radio', { name });
const tabStops = () => screen.getAllByRole('radio').filter(element => element.tabIndex === 0);

describe('useRadioGroup', () => {
  it('gives the chosen option the only tab stop', () => {
    render(<Group initial="Dark" />);

    expect(tabStops()).toEqual([radio('Dark')]);
    expect(radio('Light').tabIndex).toBe(-1);
    expect(radio('System').tabIndex).toBe(-1);
  });

  it('gives the first option the tab stop while no option is chosen', () => {
    render(<Group initial={null} />);

    expect(tabStops()).toEqual([radio('Light')]);
  });

  it.each([
    ['ArrowRight', 'Light', 'Dark'],
    ['ArrowDown', 'Light', 'Dark'],
    ['ArrowLeft', 'Dark', 'Light'],
    ['ArrowUp', 'Dark', 'Light'],
    ['ArrowRight', 'System', 'Light'],
    ['ArrowDown', 'System', 'Light'],
    ['ArrowLeft', 'Light', 'System'],
    ['ArrowUp', 'Light', 'System'],
    ['Home', 'System', 'Light'],
    ['End', 'Light', 'System']
  ] as const)('%s from %s moves the focus and the selection to %s', (key, from, to) => {
    const onSelect = vi.fn();
    render(<Group initial={from} onSelect={onSelect} />);
    radio(from).focus();

    const notCancelled = fireEvent.keyDown(radio(from), { key });

    expect(notCancelled).toBe(false);
    expect(onSelect).toHaveBeenCalledWith(to);
    expect(document.activeElement).toBe(radio(to));
    expect(radio(to)).toHaveAttribute('aria-checked', 'true');
    expect(tabStops()).toEqual([radio(to)]);
  });

  it('leaves other keys to the browser', () => {
    const onSelect = vi.fn();
    render(<Group onSelect={onSelect} />);

    const notCancelled = fireEvent.keyDown(radio('Light'), { key: 'Tab' });

    expect(notCancelled).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects the clicked option', () => {
    const onSelect = vi.fn();
    render(<Group onSelect={onSelect} />);

    fireEvent.click(radio('System'));

    expect(onSelect).toHaveBeenCalledWith('System');
    expect(tabStops()).toEqual([radio('System')]);
  });

  it('ignores the arrows, Home, End and clicks while locked, without scrolling the page', () => {
    const onSelect = vi.fn();
    render(<Group initial="Dark" locked onSelect={onSelect} />);
    radio('Dark').focus();

    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      expect(fireEvent.keyDown(radio('Dark'), { key }), key).toBe(false);
    }
    fireEvent.click(radio('System'));

    expect(onSelect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(radio('Dark'));
    expect(tabStops()).toEqual([radio('Dark')]);
  });

  it('exposes the radio elements by index', () => {
    let radios: ReturnType<typeof useRadioGroup>['radios'] | undefined;
    const Probe: FC = () => {
      const group = useRadioGroup({ options: OPTIONS, selectedIndex: 0, onSelect: vi.fn() });
      radios = group.radios;
      return <>{OPTIONS.map((option, index) => <button key={option} role="radio" aria-checked={index === 0} {...group.getRadioProps(index)}>{option}</button>)}</>;
    };
    render(<Probe />);

    expect(radios?.current[2]).toBe(radio('System'));
  });
});

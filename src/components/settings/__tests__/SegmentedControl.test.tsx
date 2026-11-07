import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import SegmentedControl from '../SegmentedControl';

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
] as const;

type Theme = typeof THEMES[number]['value'];

const renderControl = (value: Theme, props: { onChange?: (value: Theme) => void; locked?: boolean } = {}) =>
  render(
    <>
      <span id="theme-label">Theme</span>
      <SegmentedControl options={THEMES} value={value} onChange={props.onChange ?? vi.fn()} labelledBy="theme-label" locked={props.locked} />
    </>
  );

describe('SegmentedControl', () => {
  it('is a radio group named by its label, with one radio per option', () => {
    renderControl('dark');

    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map(radio => radio.textContent)).toEqual(['Light', 'Dark', 'System']);
  });

  it('checks only the chosen option, which is the one tab stop', () => {
    renderControl('dark');

    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('tabindex', '0');
    for (const name of ['Light', 'System']) {
      expect(screen.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('radio', { name })).toHaveAttribute('tabindex', '-1');
    }
  });

  it('chooses an option on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderControl('light', { onChange });

    await user.click(screen.getByRole('radio', { name: 'System' }));
    expect(onChange).toHaveBeenCalledWith('system');
  });

  it('moves and chooses with the arrows, wrapping at the ends', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderControl('system', { onChange });

    await user.tab();
    expect(screen.getByRole('radio', { name: 'System' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('light');
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('system');
  });

  it('slides the puck under the chosen option, one option wide', () => {
    const { rerender } = renderControl('light');
    const puck = screen.getByTestId('segmented-puck');

    expect(puck.style.width).toBe('calc((100% - 6px) / 3)');
    expect(puck.style.transform).toBe('translateX(0%)');
    expect(puck).toHaveClass('border-input', 'duration-(--duration-spring)', 'ease-spring');

    rerender(
      <>
        <span id="theme-label">Theme</span>
        <SegmentedControl options={THEMES} value="system" onChange={vi.fn()} labelledBy="theme-label" />
      </>
    );
    expect(puck.style.transform).toBe('translateX(200%)');
  });

  it('gives the chosen label the ink and the others the grey', () => {
    renderControl('dark');

    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveClass('text-primary');
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveClass('text-tertiary');
  });

  it('does not change while locked, and says so', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderControl('light', { onChange, locked: true });

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-disabled', 'true');
  });
});

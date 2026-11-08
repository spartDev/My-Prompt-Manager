import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Switch from '../Switch';

describe('Switch', () => {
  it('reports its state with aria-checked', () => {
    const { rerender } = render(<Switch checked={false} onChange={vi.fn()} ariaLabel="Debug mode" />);
    expect(screen.getByRole('switch', { name: 'Debug mode' })).toHaveAttribute('aria-checked', 'false');

    rerender(<Switch checked onChange={vi.fn()} ariaLabel="Debug mode" />);
    expect(screen.getByRole('switch', { name: 'Debug mode' })).toHaveAttribute('aria-checked', 'true');
  });

  it('asks for the opposite state when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Switch checked={false} onChange={onChange} ariaLabel="Debug mode" />);

    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith(true);

    rerender(<Switch checked onChange={onChange} ariaLabel="Debug mode" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('toggles from the keyboard with Space and Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} ariaLabel="Debug mode" />);

    await user.tab();
    expect(screen.getByRole('switch')).toHaveFocus();
    await user.keyboard(' ');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('takes its name from the visible label it is linked to', () => {
    render(
      <>
        <span id="notifications-label">Show notifications</span>
        <Switch checked onChange={vi.fn()} labelledBy="notifications-label" ariaLabel="ignored" />
      </>
    );

    const toggle = screen.getByRole('switch', { name: 'Show notifications' });
    expect(toggle).not.toHaveAttribute('aria-label');
  });

  it('does not change while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} disabled ariaLabel="Debug mode" />);

    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('colors and moves from the tokens: accent when on, field outline when off, knob on the spring', () => {
    const { rerender } = render(<Switch checked={false} onChange={vi.fn()} ariaLabel="Debug mode" />);
    const toggle = screen.getByRole('switch');
    const knob = toggle.firstElementChild;

    expect(toggle).toHaveClass('bg-(--border-color-input)', 'duration-(--duration-track)');
    expect(knob).toHaveClass('translate-x-0', 'duration-(--duration-spring)', 'ease-spring');

    rerender(<Switch checked onChange={vi.fn()} ariaLabel="Debug mode" />);
    expect(toggle).toHaveClass('bg-accent');
    expect(knob).toHaveClass('translate-x-[18px]');
  });
});

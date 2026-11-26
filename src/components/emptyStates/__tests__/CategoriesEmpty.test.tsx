import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RETRY_FAILURE_HOLD_MS } from '../../../constants/ui';
import CategoriesEmpty, { STARTER_CATEGORIES } from '../CategoriesEmpty';

const NAMES = STARTER_CATEGORIES.map(category => category.name);

const renderEmpty = (onQuickCreate: (category: { name: string; color: string }, starter: HTMLElement) => Promise<void>) => {
  render(<CategoriesEmpty onCreate={vi.fn()} onQuickCreate={onQuickCreate} />);
  return { starter: (name: string) => screen.getByRole('button', { name: new RegExp(`^Creat(e|ing) category ${name}`) }) };
};

// My-Prompt-Manager-tg6l: a starter keeps the keyboard while its Category is created, so the starters
// follow the Loading State of docs/DESIGN_GUIDELINES.md: aria-disabled, never disabled, the spinner on
// the one tapped, full strength; a press meanwhile does nothing; a success ends it at once, a failure
// no sooner than RETRY_FAILURE_HOLD_MS after the tap
describe('CategoriesEmpty starters busy', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('while one is created: every starter aria-disabled and still enabled, the one tapped with the spinner and "Creating category ...", none dimmed, the keyboard kept; a tap or Enter on any creates nothing more', async () => {
    let finish: () => void = () => undefined;
    const onQuickCreate = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { starter } = renderEmpty(onQuickCreate);
    const user = userEvent.setup();

    const work = starter('Work');
    act(() => { work.focus(); });
    await user.keyboard('{Enter}');

    expect(onQuickCreate).toHaveBeenCalledTimes(1);
    expect(onQuickCreate).toHaveBeenCalledWith({ name: 'Work', color: '#2563EB' }, work);
    expect(work).toHaveAccessibleName('Creating category Work...');
    expect(work).toHaveFocus();
    expect(work.querySelector('.animate-spin')).toBeInTheDocument();
    for (const name of NAMES) {
      const button = starter(name);
      expect(button, name).toHaveAttribute('aria-disabled', 'true');
      expect(button, name).toBeEnabled();
      expect(button.className, name).not.toMatch(/opacity/);
      expect(button, name).toHaveClass('aria-disabled:cursor-wait');
    }
    expect(starter('Writing')).toHaveAccessibleName('Create category Writing');
    expect(starter('Writing').querySelector('.animate-spin')).not.toBeInTheDocument();

    await user.keyboard('{Enter}');
    await user.click(work);
    await user.click(starter('Email'));
    expect(onQuickCreate).toHaveBeenCalledTimes(1);
    // The spinner stays on the starter tapped
    expect(starter('Email')).toHaveAccessibleName('Create category Email');
    expect(work).toHaveAccessibleName('Creating category Work...');

    await act(async () => { finish(); await Promise.resolve(); });
    expect(work).toHaveAccessibleName('Create category Work');
    for (const name of NAMES) {
      expect(starter(name), name).not.toHaveAttribute('aria-disabled');
    }
  });

  it('a creation that works: the starters are idle as soon as it ends, not held', async () => {
    vi.useFakeTimers();
    const { starter } = renderEmpty(() => Promise.resolve());

    act(() => { starter('Writing').click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(starter('Writing')).toHaveAccessibleName('Create category Writing');
    expect(starter('Writing')).not.toHaveAttribute('aria-disabled');
  });

  it(`a creation that fails at once: the starter busy until ${String(RETRY_FAILURE_HOLD_MS)} ms after the tap, a tap meanwhile creating nothing; then idle, the keyboard on it`, async () => {
    vi.useFakeTimers();
    const onQuickCreate = vi.fn(() => Promise.reject(new Error('full')));
    const { starter } = renderEmpty(onQuickCreate);
    const research = starter('Research');
    act(() => { research.focus(); });

    act(() => { research.click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(RETRY_FAILURE_HOLD_MS - 1); });
    expect(research).toHaveAccessibleName('Creating category Research...');
    expect(research).toHaveAttribute('aria-disabled', 'true');
    act(() => { research.click(); });
    expect(onQuickCreate).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(research).toHaveAccessibleName('Create category Research');
    expect(research).not.toHaveAttribute('aria-disabled');
    expect(research).toHaveFocus();
    act(() => { research.click(); });
    expect(onQuickCreate).toHaveBeenCalledTimes(2);
  });
});

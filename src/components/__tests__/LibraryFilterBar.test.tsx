import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ALL_PROMPTS } from '../../services/libraryFilter';
import { buildCategory } from '../../test/builders/buildCategory';
import type { LibraryFilter } from '../../types';
import LibraryFilterBar from '../LibraryFilterBar';

const work = buildCategory({ id: 'cat-work', name: 'Work', color: '#3B82F6' });
const personal = buildCategory({ id: 'cat-personal', name: 'Personal', color: '#10B981' });

const renderBar = (activeFilter: LibraryFilter = ALL_PROMPTS, onChange = vi.fn()) =>
  render(<LibraryFilterBar categories={[work, personal]} activeFilter={activeFilter} onChange={onChange} />);

/** Gives the row a fixed size so it overflows: happy-dom does no layout */
const makeOverflowing = (row: HTMLElement, scrollWidth: number, clientWidth: number) => {
  Object.defineProperty(row, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(row, 'clientWidth', { configurable: true, value: clientWidth });
};

describe('LibraryFilterBar', () => {
  it('renders All, Pinned, Most Used, then the Categories in order, inside a labelled radiogroup', () => {
    renderBar();

    expect(screen.getByRole('radiogroup', { name: 'Library filter' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map(radio => radio.textContent))
      .toEqual(['All', 'Pinned', 'Most Used', 'Work', 'Personal']);
  });

  it('checks only the active filter and makes only it focusable', () => {
    renderBar({ kind: 'category', categoryId: personal.id });

    const active = screen.getByRole('radio', { name: 'Personal' });
    expect(active).toHaveAttribute('aria-checked', 'true');
    expect(active).toHaveAttribute('tabindex', '0');

    for (const name of ['All', 'Pinned', 'Most Used', 'Work']) {
      const radio = screen.getByRole('radio', { name });
      expect(radio).toHaveAttribute('aria-checked', 'false');
      expect(radio).toHaveAttribute('tabindex', '-1');
    }
  });

  it('calls onChange with the filter of the pill pressed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBar(ALL_PROMPTS, onChange);

    await user.click(screen.getByRole('radio', { name: 'Pinned' }));
    await user.click(screen.getByRole('radio', { name: 'Most Used' }));
    await user.click(screen.getByRole('radio', { name: 'Work' }));
    await user.click(screen.getByRole('radio', { name: 'All' }));

    expect(onChange.mock.calls.map(([filter]) => filter as LibraryFilter)).toEqual([
      { kind: 'pinned' },
      { kind: 'mostUsed' },
      { kind: 'category', categoryId: work.id },
      { kind: 'all' }
    ]);
  });

  it.each([
    ['ArrowRight', 'all', 'pinned'],
    ['ArrowRight', `category:${personal.id}`, 'all'],
    ['ArrowLeft', 'all', `category:${personal.id}`],
    ['ArrowLeft', 'mostUsed', 'pinned'],
    ['Home', `category:${work.id}`, 'all'],
    ['End', 'pinned', `category:${personal.id}`]
  ] as const)('%s from %s selects %s and moves focus', async (key, fromKey, toKey) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filterFor = (k: string): LibraryFilter =>
      k.startsWith('category:') ? { kind: 'category', categoryId: k.slice('category:'.length) } : { kind: k } as LibraryFilter;
    renderBar(filterFor(fromKey), onChange);

    screen.getByTestId(`library-filter-${fromKey}`).focus();
    await user.keyboard(`{${key}}`);

    expect(onChange).toHaveBeenCalledWith(filterFor(toKey));
    expect(screen.getByTestId(`library-filter-${toKey}`)).toHaveFocus();
  });

  it('shows each Category with its colour dot and its full name on hover', () => {
    renderBar();

    const pill = screen.getByRole('radio', { name: 'Work' });
    expect(pill).toHaveAttribute('title', 'Work');
    expect(within(pill).getByTestId('category-dot')).toHaveStyle({ backgroundColor: '#3B82F6' });
  });

  it('disables every pill while loading', () => {
    render(<LibraryFilterBar categories={[work]} activeFilter={ALL_PROMPTS} onChange={vi.fn()} disabled />);

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });

  it('scrolls the row sideways with a vertical mouse wheel when it overflows', () => {
    renderBar();
    const row = screen.getByRole('radiogroup', { name: 'Library filter' });
    makeOverflowing(row, 600, 300);

    const notPrevented = fireEvent.wheel(row, { deltaY: 120 });

    expect(notPrevented).toBe(false);
    expect(row.scrollLeft).toBe(120);
  });

  it('leaves the wheel alone when every pill fits', () => {
    renderBar();
    const row = screen.getByRole('radiogroup', { name: 'Library filter' });
    makeOverflowing(row, 300, 300);

    const notPrevented = fireEvent.wheel(row, { deltaY: 120 });

    expect(notPrevented).toBe(true);
    expect(row.scrollLeft).toBe(0);
  });

  it('shows an edge fade only on the sides where pills are hidden', () => {
    renderBar();
    const row = screen.getByRole('radiogroup', { name: 'Library filter' });
    makeOverflowing(row, 600, 300);

    fireEvent.scroll(row, { target: { scrollLeft: 0 } });
    expect(screen.queryByTestId('library-filter-fade-start')).not.toBeInTheDocument();
    expect(screen.getByTestId('library-filter-fade-end')).toBeInTheDocument();

    fireEvent.scroll(row, { target: { scrollLeft: 300 } });
    expect(screen.getByTestId('library-filter-fade-start')).toBeInTheDocument();
    expect(screen.queryByTestId('library-filter-fade-end')).not.toBeInTheDocument();
  });
});

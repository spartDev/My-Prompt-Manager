import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SearchBar from '../SearchBar';

/** The bar with its value held in state, as the Library holds it */
const Harness = ({ initial = '', onClear = vi.fn() }: { initial?: string; onClear?: () => void }) => {
  const [value, setValue] = useState(initial);
  return <SearchBar value={value} onChange={setValue} onClear={() => { setValue(''); onClear(); }} />;
};

const setPlatform = (platform: string) => {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
};

describe('SearchBar', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('is a search field with a label and the Library placeholder', () => {
    render(<Harness />);

    const field = screen.getByRole('searchbox', { name: 'Search prompts' });
    expect(field).toHaveAttribute('type', 'search');
    expect(field).toHaveAttribute('placeholder', 'Search your prompts');
  });

  it('shows the shortcut badge and no clear button while empty', () => {
    render(<Harness />);

    expect(screen.getByTestId('search-shortcut')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });

  it('shows the clear button and no shortcut badge while filled', () => {
    render(<Harness initial="email" />);

    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
    expect(screen.queryByTestId('search-shortcut')).not.toBeInTheDocument();
  });

  it('never shows the badge and the clear button together, at any keystroke', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByRole('searchbox');
    const shownTogether = () =>
      screen.queryByTestId('search-shortcut') !== null && screen.queryByRole('button', { name: 'Clear search' }) !== null;
    const shownNeither = () =>
      screen.queryByTestId('search-shortcut') === null && screen.queryByRole('button', { name: 'Clear search' }) === null;

    for (const step of ['a', 'b', '{Backspace}', '{Backspace}', ' ', '{Backspace}']) {
      await user.type(field, step);
      expect(shownTogether()).toBe(false);
      expect(shownNeither()).toBe(false);
    }
    expect(screen.getByTestId('search-shortcut')).toBeInTheDocument();
  });

  it('clears the field and keeps the keyboard in it when the clear button is pressed', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<Harness initial="email" onClear={onClear} />);

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('pops the clear button in', () => {
    render(<Harness initial="email" />);

    expect(screen.getByRole('button', { name: 'Clear search' })).toHaveClass('animate-clear-pop');
  });

  it('clears a filled field on Escape, keeps the keyboard in it and keeps the key from the browser', () => {
    const onClear = vi.fn();
    render(<Harness initial="email" onClear={onClear} />);
    const field = screen.getByRole('searchbox');
    field.focus();

    const passedOn = fireEvent.keyDown(field, { key: 'Escape' });

    expect(passedOn).toBe(false);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
  });

  it('lets go of the keyboard on Escape in an empty field, and leaves the key to the browser', () => {
    const onClear = vi.fn();
    render(<Harness onClear={onClear} />);
    const field = screen.getByRole('searchbox');
    field.focus();

    const passedOn = fireEvent.keyDown(field, { key: 'Escape' });

    expect(passedOn).toBe(true);
    expect(onClear).not.toHaveBeenCalled();
    expect(field).not.toHaveFocus();
  });

  it('names Command K on an Apple device: a decorative badge, and the shortcut announced on the field', () => {
    setPlatform('MacIntel');
    render(<Harness />);

    const badge = screen.getByTestId('search-shortcut');
    expect(badge).toHaveTextContent('⌘K');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('searchbox')).toHaveAttribute('aria-keyshortcuts', 'Meta+K');
  });

  it.each(['Win32', 'Linux x86_64'])('names Ctrl K on %s', (platform) => {
    setPlatform(platform);
    render(<Harness />);

    expect(screen.getByTestId('search-shortcut')).toHaveTextContent('Ctrl K');
    expect(screen.getByRole('searchbox')).toHaveAttribute('aria-keyshortcuts', 'Control+K');
  });

  it('shows focus on the pill: an accent border and the halo, in place of the outline of the field', () => {
    render(<Harness />);

    expect(screen.getByTestId('search-bar')).toHaveClass('has-[input:focus]:border-focus', 'has-[input:focus]:shadow-search-focus', 'transition-search');
    expect(screen.getByRole('searchbox')).toHaveClass('outline-none');
  });

  it('gives its field to whoever asks for it', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<SearchBar value="" onChange={vi.fn()} onClear={vi.fn()} inputRef={ref} />);

    expect(ref.current).toBe(screen.getByRole('searchbox'));
  });
});

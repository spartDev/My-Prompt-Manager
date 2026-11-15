import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CriticalFixItem, FeatureItem, ReleaseNoteItem, WhatsNewIcon } from '../../../whatsNew/types';
import { WhatsNewGrid } from '../WhatsNewGrid';

const feature = (title: string, extra: Partial<FeatureItem> = {}): FeatureItem => ({
  kind: 'feature',
  title,
  description: `${title} description`,
  icon: 'variables',
  destination: 'library',
  ...extra
});

const fix = (title: string): CriticalFixItem => ({ kind: 'critical-fix', title, description: `${title} description` });

const renderGrid = (items: readonly ReleaseNoteItem[]) => {
  const onOpen = vi.fn();
  render(<WhatsNewGrid items={items} onOpen={onOpen} />);
  const cells = within(screen.getByRole('list')).getAllByRole('listitem');
  return { onOpen, cells };
};

const kindOf = (cell: HTMLElement) => cell.querySelector('[data-whats-new-tile]')?.getAttribute('data-whats-new-tile');
const isWide = (cell: HTMLElement) => cell.classList.contains('col-span-2');

const reduceMotion = () =>
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WhatsNewGrid', () => {
  it('grid with 1 item: a lone Feature is the hero, full width', () => {
    const { cells } = renderGrid([feature('Variables')]);

    expect(cells).toHaveLength(1);
    expect(cells.map(kindOf)).toEqual(['hero']);
    expect(isWide(cells[0])).toBe(true);
  });

  it('grid with 1 item: a lone Critical fix is no hero, and spans both columns', () => {
    const { cells } = renderGrid([fix('Sync')]);

    expect(cells.map(kindOf)).toEqual(['critical-fix']);
    expect(isWide(cells[0])).toBe(true);
  });

  it('grid with 2 items: the hero, then the one small tile spanning both columns', () => {
    const { cells } = renderGrid([fix('Sync'), feature('Variables')]);

    expect(cells.map(kindOf)).toEqual(['hero', 'critical-fix']);
    expect(cells.map(isWide)).toEqual([true, true]);
  });

  it('grid with 5 items: the hero, then four small tiles in two full rows', () => {
    const { cells } = renderGrid([feature('A'), feature('B'), fix('X'), feature('C'), feature('D')]);

    expect(cells.map(kindOf)).toEqual(['hero', 'feature', 'feature', 'feature', 'critical-fix']);
    expect(cells.map(isWide)).toEqual([true, false, false, false, false]);
  });

  it('grid with 8 items: the hero, then seven small tiles, the last full width', () => {
    const items = [feature('A'), fix('X'), feature('B'), feature('C'), fix('Y'), feature('D'), feature('E'), feature('F')];
    const { cells } = renderGrid(items);

    expect(cells.map(kindOf)).toEqual(['hero', 'feature', 'feature', 'feature', 'feature', 'feature', 'critical-fix', 'critical-fix']);
    expect(cells.map(isWide)).toEqual([true, false, false, false, false, false, false, true]);
  });

  it('orders the tiles hero, Features, Critical fixes, each in the order of the Release notes', () => {
    const { cells } = renderGrid([fix('X'), feature('A'), fix('Y'), feature('B'), feature('C')]);

    expect(cells.map((cell) => cell.textContent)).toEqual([
      expect.stringContaining('A'),
      expect.stringContaining('B'),
      expect.stringContaining('C'),
      expect.stringContaining('X'),
      expect.stringContaining('Y')
    ]);
  });

  it('a release with only Critical fixes renders no hero', () => {
    const { cells } = renderGrid([fix('X'), fix('Y'), fix('Z')]);

    expect(cells.map(kindOf)).toEqual(['critical-fix', 'critical-fix', 'critical-fix']);
    expect(document.querySelector('[data-whats-new-tile="hero"]')).toBeNull();
    expect(cells.map(isWide)).toEqual([false, false, true]);
  });

  it('clicking each Feature tile with a destination calls onOpen with its destination', async () => {
    const a = feature('A', { destination: 'library-search' });
    const b = feature('B', { destination: 'categories' });
    const c = feature('C', { destination: 'analytics' });
    const { onOpen } = renderGrid([a, b, c]);

    await userEvent.click(screen.getByRole('button', { name: /A description/ }));
    await userEvent.click(screen.getByRole('button', { name: /B description/ }));
    await userEvent.click(screen.getByRole('button', { name: /C description/ }));

    expect(onOpen.mock.calls).toEqual([
      ['library-search', a],
      ['categories', b],
      ['analytics', c]
    ]);
  });

  it('clicking a Critical fix tile or a destination-less Feature calls nothing, and neither is in the tab order', async () => {
    const { onOpen } = renderGrid([feature('Hero'), feature('Platforms only', { destination: undefined }), fix('Data loss')]);

    await userEvent.click(screen.getByText('Platforms only'));
    await userEvent.click(screen.getByText('Data loss'));
    expect(onOpen).not.toHaveBeenCalled();

    expect(screen.getAllByRole('button')).toHaveLength(1);
    for (const kind of ['feature', 'critical-fix']) {
      const tile = document.querySelector<HTMLElement>(`[data-whats-new-tile="${kind}"]`);
      expect(tile?.tagName).toBe('DIV');
      expect(tile?.hasAttribute('tabindex')).toBe(false);
      expect(tile?.querySelector('button, [tabindex], a, input')).toBeNull();
    }

    await userEvent.tab();
    expect(screen.getByRole('button', { name: /Hero/ })).toHaveFocus();
    await userEvent.tab();
    expect(document.body).toHaveFocus();
  });

  it('each Feature button is named by its title and description', () => {
    renderGrid([
      feature('Fill in Variables', { description: 'Type the values once', example: 'Hi {{name}}' }),
      feature('Search everything', { description: 'Press Cmd+K from anywhere', icon: 'search', destination: 'library-search' })
    ]);

    expect(screen.getByRole('button', { name: 'Fill in Variables Type the values once' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search everything Press Cmd+K from anywhere' })).toBeInTheDocument();
  });

  it('numbers the Feature tiles that open something, from the hero, in display order', () => {
    renderGrid([fix('X'), feature('A'), feature('Platforms only', { destination: undefined }), feature('B'), feature('C')]);

    const numbered = [...document.querySelectorAll<HTMLElement>('[data-whats-new-tile-index]')];
    expect(numbered.map((tile) => [tile.getAttribute('data-whats-new-tile-index'), tile.textContent])).toEqual([
      ['1', expect.stringContaining('A')],
      ['2', expect.stringContaining('B')],
      ['3', expect.stringContaining('C')]
    ]);
  });

  it('animation delays: 180ms, 250ms, 320ms... per tile index', () => {
    renderGrid([feature('A'), feature('B'), fix('X'), feature('C', { destination: undefined }), fix('Y')]);

    const tiles = [...document.querySelectorAll<HTMLElement>('[data-whats-new-tile]')];
    expect(tiles.map((tile) => tile.style.animationDelay)).toEqual(['180ms', '250ms', '320ms', '390ms', '460ms']);
    for (const tile of tiles) {
      expect(tile).toHaveClass('animate-tile-rise');
    }
  });

  it('animation delays: none under reduced motion, so the tiles do not cascade', () => {
    reduceMotion();
    renderGrid([feature('A'), feature('B'), fix('X')]);

    const tiles = [...document.querySelectorAll<HTMLElement>('[data-whats-new-tile]')];
    expect(tiles.map((tile) => tile.style.animationDelay)).toEqual(['', '', '']);
  });

  it('draws a glyph for every icon of the closed set, hidden from screen readers', () => {
    const icons: WhatsNewIcon[] = ['variables', 'search', 'slash', 'pin', 'lookalike', 'broom', 'category', 'undo', 'wrench'];
    renderGrid([feature('Hero'), ...icons.map((icon) => feature(`Icon ${icon}`, { icon }))]);

    const glyphs = [...document.querySelectorAll('[data-icon-glyph]')];
    expect(glyphs).toHaveLength(icons.length);
    for (const glyph of glyphs) {
      expect(glyph).toHaveAttribute('aria-hidden', 'true');
    }
    expect(document.querySelector('[data-icon-glyph="kbd"]')).toHaveTextContent('⌘K');
  });
});

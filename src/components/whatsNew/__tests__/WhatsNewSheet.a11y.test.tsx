/**
 * What's new with the keyboard, a screen reader and reduced motion (My-Prompt-Manager-d1g.8): the
 * sheet with its real grid, as WhatsNewHost renders them. The number keys, Enter, the names the
 * tiles are heard by, and every animation near instant under prefers-reduced-motion.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOTION, motionDuration } from '../../../theme/motion';
import type { CriticalFixItem, FeatureItem, ReleaseNoteItem } from '../../../whatsNew/types';
import { WhatsNewGrid } from '../WhatsNewGrid';
import WhatsNewSheet, { type WhatsNewCloseReason } from '../WhatsNewSheet';

const feature = (title: string, extra: Partial<FeatureItem> = {}): FeatureItem => ({
  kind: 'feature',
  title,
  description: `${title} description`,
  icon: 'variables',
  destination: 'library',
  ...extra
});

const fix = (title: string): CriticalFixItem => ({ kind: 'critical-fix', title, description: `${title} description` });

/**
 * In the order of the registry. Displayed: Variables (hero, 1), Platforms only (no number), Search
 * (2), Categories (3), then the Critical fixes, which have no number
 */
const ITEMS: readonly ReleaseNoteItem[] = [
  feature('Variables', { destination: 'prompt-editor-new', example: 'Write to {{audience}} in a {{tone}} voice.' }),
  fix('Data kept'),
  feature('Platforms only', { destination: undefined }),
  feature('Search', { destination: 'library-search', icon: 'search' }),
  fix('Icon stays'),
  feature('Categories', { destination: 'categories', icon: 'category' })
];

const renderSheet = ({ open = true, items = ITEMS, field = false }: { open?: boolean; items?: readonly ReleaseNoteItem[]; field?: boolean } = {}) => {
  const onClose = vi.fn<(reason: WhatsNewCloseReason) => void>();
  const onOpen = vi.fn();
  const user = userEvent.setup();
  render(
    <WhatsNewSheet version="2.0.0" open={open} onClose={onClose}>
      {field && <input aria-label="A field" />}
      <WhatsNewGrid items={items} onOpen={onOpen} />
    </WhatsNewSheet>
  );
  return { onClose, onOpen, user };
};

/** The titles of the tiles onOpen was called for, in order */
const opened = (onOpen: ReturnType<typeof vi.fn>): string[] => onOpen.mock.calls.map((call) => (call[1] as FeatureItem).title);

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

describe("What's new: keyboard, focus, screen readers and reduced motion", () => {
  describe('AC1: number keys open the Feature tiles in display order', () => {
    it.each([
      ['1', 'Variables', 'prompt-editor-new'],
      ['2', 'Search', 'library-search'],
      ['3', 'Categories', 'categories']
    ])('number keys open the Feature tiles in display order: %s opens %s', async (key, title, destination) => {
      const { onOpen, onClose, user } = renderSheet();

      await user.keyboard(key);

      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen).toHaveBeenCalledWith(destination, expect.objectContaining({ title }));
      // Like a click: the tile asks to open, and its host closes the sheet; the sheet itself does not close-without-opening
      expect(onClose).not.toHaveBeenCalled();
    });

    it('number keys open the Feature tiles in display order: the keys follow the tiles numbered by the grid', async () => {
      const { onOpen, user } = renderSheet();
      const numbered = [...document.querySelectorAll<HTMLElement>('[data-whats-new-tile-index]')];

      for (const tile of numbered) {
        await user.keyboard(tile.getAttribute('data-whats-new-tile-index') ?? '');
      }

      expect(opened(onOpen)).toEqual(['Variables', 'Search', 'Categories']);
    });

    it.each(['4', '5', '9', '0'])('a number beyond the count does nothing: %s', async (key) => {
      const { onOpen, onClose, user } = renderSheet();

      await user.keyboard(key);

      expect(onOpen).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();
    });

    it('Critical fixes and destination-less Features are skipped: no number, and no key reaches them', async () => {
      const { onOpen, user } = renderSheet();

      for (const kind of ['critical-fix', 'feature']) {
        for (const tile of document.querySelectorAll(`div[data-whats-new-tile="${kind}"]`)) {
          expect(tile).not.toHaveAttribute('data-whats-new-tile-index');
        }
      }
      await user.keyboard('123456789');

      expect(opened(onOpen)).toEqual(['Variables', 'Search', 'Categories']);
    });

    it('with only Critical fixes, no key opens anything', async () => {
      const { onOpen, onClose, user } = renderSheet({ items: [fix('A'), fix('B')] });

      await user.keyboard('123456789');

      expect(onOpen).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it.each([
      ['Cmd', { metaKey: true }],
      ['Ctrl', { ctrlKey: true }],
      ['Alt', { altKey: true }]
    ])('a digit with %s does nothing', (_modifier, modifiers) => {
      const { onOpen } = renderSheet();

      const event = new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true, ...modifiers });
      document.activeElement?.dispatchEvent(event);

      expect(onOpen).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('a digit typed with Shift (the digits of an AZERTY keyboard) still opens its tile', () => {
      const { onOpen } = renderSheet();

      fireEvent.keyDown(screen.getByRole('button', { name: 'Got it' }), { key: '2', shiftKey: true });

      expect(opened(onOpen)).toEqual(['Search']);
    });

    it('a digit typed in a text field stays in the field', async () => {
      const { onOpen, user } = renderSheet({ field: true });
      const field = screen.getByRole('textbox', { name: 'A field' });

      await user.click(field);
      await user.keyboard('12');

      expect(field).toHaveValue('12');
      expect(onOpen).not.toHaveBeenCalled();
    });

    // The key handler is off while the exit plays (its `if (!open)` guard). A digit alone cannot
    // show it: leaving, the sheet drops its panel ref, so no tile is found for the digit anyway.
    // Enter reaches the same handler with no such second stop, so it is what proves the guard
    it('while the exit plays (open false), a digit does nothing: the key handler is off, Enter included', () => {
      const onClose = vi.fn<(reason: WhatsNewCloseReason) => void>();
      const onOpen = vi.fn();
      const sheetAt = (open: boolean) => (
        <WhatsNewSheet version="2.0.0" open={open} onClose={onClose}>
          <WhatsNewGrid items={ITEMS} onOpen={onOpen} />
        </WhatsNewSheet>
      );
      const { rerender } = render(sheetAt(true));
      // The exit starts: same sheet, same tiles, now closed
      rerender(sheetAt(false));

      const digitHandled = !fireEvent.keyDown(document, { key: '1' });
      const enterHandled = !fireEvent.keyDown(document, { key: 'Enter' });

      expect(onOpen).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(digitHandled).toBe(false);
      expect(enterHandled).toBe(false);
    });

    it('each numbered tile announces its key (aria-keyshortcuts)', () => {
      renderSheet();

      const buttons = within(screen.getByRole('list')).getAllByRole('button');
      expect(buttons.map((button) => button.getAttribute('aria-keyshortcuts'))).toEqual(['1', '2', '3']);
    });
  });

  describe('AC2: Enter opens a focused Feature tile, and closes everywhere else', () => {
    it('Enter on a focused Feature tile opens it and does not also close-without-opening', async () => {
      const { onOpen, onClose, user } = renderSheet();
      // From Got it: the scrolling body, the hero, then Search
      await user.tab();
      await user.tab();
      await user.tab();
      expect(screen.getByRole('button', { name: /^Search/ })).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(opened(onOpen)).toEqual(['Search']);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Enter on Got it closes, once, as enter, and opens nothing', async () => {
      const { onOpen, onClose, user } = renderSheet();
      const gotIt = screen.getByRole('button', { name: 'Got it' });
      expect(gotIt).toHaveFocus();
      const targets: EventTarget[] = [];
      document.addEventListener('keydown', (event) => { targets.push(event.target as EventTarget); }, { once: true });

      await user.keyboard('{Enter}');

      // The Enter landed on Got it itself, not on the page
      expect(targets).toEqual([gotIt]);
      expect(onClose).toHaveBeenCalledExactlyOnceWith('enter');
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('Enter on the sheet outside any control closes', () => {
      const { onClose, onOpen } = renderSheet();

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' });

      expect(onClose).toHaveBeenCalledExactlyOnceWith('enter');
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('Enter on a plain tile (a Critical fix) closes: it is no control of its own', () => {
      const { onClose, onOpen } = renderSheet();

      fireEvent.keyDown(screen.getByText('Data kept'), { key: 'Enter' });

      expect(onClose).toHaveBeenCalledExactlyOnceWith('enter');
      expect(onOpen).not.toHaveBeenCalled();
    });
  });

  describe('AC3: the keyboard stays in the sheet', () => {
    /** What has the keyboard: the scrolling body, a tile by its number, or Got it */
    const focused = (): string => {
      const active = document.activeElement;
      if (active === screen.getByTestId('whats-new-body')) {return 'body';}
      return active?.getAttribute('data-whats-new-tile-index') ?? active?.textContent ?? '';
    };

    it('Tab goes from Got it through the scrolling body and every Feature tile and back to Got it, never to a plain tile', async () => {
      const { user } = renderSheet();
      const dialog = screen.getByRole('dialog');
      expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();
      const visited: string[] = [];

      for (let step = 0; step < 5; step++) {
        await user.tab();
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        visited.push(focused());
      }

      expect(visited).toEqual(['body', '1', '2', '3', 'Got it']);
    });

    it('with only Critical fixes, the scrolling body takes the keyboard, so it scrolls; Tab and Shift+Tab stay between it and Got it', async () => {
      const { user } = renderSheet({ items: [fix('A'), fix('B'), fix('C')] });
      const dialog = screen.getByRole('dialog');
      expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();
      const visited: string[] = [];

      for (const shift of [false, false, true, true]) {
        await user.tab({ shift });
        expect(dialog).toContainElement(document.activeElement as HTMLElement);
        visited.push(focused());
      }

      expect(visited).toEqual(['body', 'Got it', 'body', 'Got it']);
    });

    it('the scrolling body is a region named by the title, with a visible focus ring for the keyboard', () => {
      renderSheet();

      const body = screen.getByTestId('whats-new-body');
      expect(body).toHaveAttribute('tabindex', '0');
      expect(within(screen.getByRole('dialog')).getByRole('region', { name: /What.s new/ })).toBe(body);
      expect(body).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-accent');
    });
  });

  describe('AC4: what a screen reader hears', () => {
    it('a modal dialog labelled by its title, holding the tiles as a list', () => {
      renderSheet();

      const dialog = screen.getByRole('dialog', { name: /What.s new/ });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      const list = within(dialog).getByRole('list');
      expect(within(list).getAllByRole('listitem')).toHaveLength(ITEMS.length);
    });

    it('each Feature tile is named by its title and its description', () => {
      renderSheet();

      expect(screen.getByRole('button', { name: 'Variables Variables description' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Search Search description' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Categories Categories description' })).toBeInTheDocument();
    });

    it("the hero's example sentence is its description, heard after the name, its Variables as words", () => {
      renderSheet();

      const hero = screen.getByRole('button', { name: 'Variables Variables description' });
      expect(hero).toHaveAccessibleDescription('Write to audience in a tone voice.');
      expect(screen.getByRole('button', { name: /^Search/ })).not.toHaveAttribute('aria-describedby');
    });

    it('a hero without an example has no description', () => {
      renderSheet({ items: [feature('Alone')] });

      expect(screen.getByRole('button', { name: 'Alone Alone description' })).not.toHaveAttribute('aria-describedby');
    });

    it('Critical fix tiles are not buttons and have no tabindex, and are read "Fixed: {title}"', () => {
      renderSheet();

      const fixes = [...document.querySelectorAll<HTMLElement>('[data-whats-new-tile="critical-fix"]')];
      expect(fixes).toHaveLength(2);
      for (const tile of fixes) {
        expect(tile.tagName).toBe('DIV');
        expect(tile).not.toHaveAttribute('tabindex');
        expect(tile).not.toHaveAttribute('role');
        expect(tile.querySelector('button, a, input, [tabindex]')).toBeNull();
      }
      // The colon is for the ear only: the pill still shows "Fixed"
      expect(fixes[0]).toHaveTextContent(/^Fixed: Data kept\s*Data kept description$/);
      expect(screen.getAllByText('Fixed')[0]).toHaveTextContent(/^Fixed$/);
      expect(within(fixes[0] as HTMLElement).getByText(':')).toHaveClass('sr-only');
    });
  });

  describe('AC5: under prefers-reduced-motion every animation is near instant, with no cascade', () => {
    const SRC = path.resolve(__dirname, '../../..');
    const popupCss = readFileSync(path.join(SRC, 'popup.css'), 'utf8');
    const tokensCss = readFileSync(path.join(SRC, 'theme/tokens.css'), 'utf8');

    /** The rules inside every @media (prefers-reduced-motion: reduce) block of a stylesheet, by selector */
    const reducedRules = (css: string): Map<string, string> => {
      const rules = new Map<string, string>();
      const marker = '@media (prefers-reduced-motion: reduce) {';
      let from = css.indexOf(marker);
      while (from !== -1) {
        let depth = 0;
        let end = from + marker.length - 1;
        for (; end < css.length; end++) {
          if (css[end] === '{') {depth++;}
          if (css[end] === '}' && --depth === 0) {break;}
        }
        const body = css.slice(from + marker.length, end);
        for (const match of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          for (const selector of (match[1] ?? '').split(',')) {
            const key = selector.trim();
            rules.set(key, `${rules.get(key) ?? ''}${match[2] ?? ''}`);
          }
        }
        from = css.indexOf(marker, end);
      }
      return rules;
    };

    it('the sheet, the backdrop and the tiles: every animation and transition they wear is 1ms, the tiles rise together', () => {
      reduceMotion();
      renderSheet();

      const popupRules = reducedRules(popupCss);
      const rootVars = reducedRules(tokensCss).get(':root') ?? '';
      const elements = [...document.body.querySelectorAll<HTMLElement>('[class]')];
      const moving = new Set<string>();

      for (const element of elements) {
        for (const name of element.classList) {
          if (name.startsWith('animate-')) {
            moving.add(name);
            const rule = popupRules.get(`.${name}`) ?? '';
            expect(rule, name).toMatch(/animation-duration:\s*1ms/);
            expect(rule, name).toMatch(/animation-delay:\s*0ms !important/);
          } else if (name === 'transition-colors') {
            // Tailwind's transition: its duration comes from a motion token, which reduced motion sets to 1ms
            const token = [...element.classList].map((other) => /^duration-\(--(duration-[a-z-]+)\)$/.exec(other)?.[1]).find(Boolean);
            expect(token, `${name} needs a duration token`).toBeDefined();
            moving.add(`${name} ${String(token)}`);
            expect(rootVars).toMatch(new RegExp(`--${String(token)}:\\s*1ms`));
          } else if (name.startsWith('transition-')) {
            moving.add(name);
            expect(popupRules.get(`.${name}`) ?? '', name).toMatch(/transition-duration:\s*1ms/);
          }
        }
      }

      // The sheet, its backdrop, Got it, the tiles and the hero's Variable pills were all checked
      expect([...moving].sort()).toEqual([
        'animate-tile-rise',
        'animate-whats-new-backdrop-in',
        'animate-whats-new-sheet-in',
        'transition-colors duration-color',
        'transition-got-it',
        'transition-tile'
      ]);
      // No cascade: no tile waits for the one before
      const tiles = [...document.querySelectorAll<HTMLElement>('[data-whats-new-tile]')];
      expect(tiles).toHaveLength(ITEMS.length);
      expect(tiles.map((tile) => tile.style.animationDelay)).toEqual(ITEMS.map(() => ''));
      // The exit is near instant too, and its caller waits for nothing
      expect(popupRules.get('.animate-whats-new-sheet-out')).toMatch(/animation-duration:\s*1ms/);
      expect(popupRules.get('.animate-whats-new-backdrop-out')).toMatch(/animation-duration:\s*1ms/);
      expect(motionDuration(MOTION.whatsNewSheetOut)).toBe(0);
    });
  });
});

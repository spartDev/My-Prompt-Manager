import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type FC, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAnimatedPresence } from '../../../hooks/useAnimatedPresence';
import { MOTION, motionDuration } from '../../../theme/motion';
import WhatsNewSheet, { type WhatsNewCloseReason } from '../WhatsNewSheet';

/** Two tile buttons, as the grid of the Tiles ticket renders them, and a tile that is not a button */
const Tiles: FC<{ onOpen?: (name: string) => void }> = ({ onOpen }) => (
  <div data-testid="grid">
    <button type="button" onClick={() => { onOpen?.('variables'); }}>Variables</button>
    <button type="button" onClick={() => { onOpen?.('search'); }}>Search</button>
    <div data-testid="static-tile">Works on Platforms</div>
  </div>
);

const renderSheet = (props: { open?: boolean; onOpen?: (name: string) => void } = {}) => {
  const onClose = vi.fn<(reason: WhatsNewCloseReason) => void>();
  const user = userEvent.setup();
  const utils = render(
    <WhatsNewSheet version="2.0.0" open={props.open ?? true} onClose={onClose}>
      <Tiles onOpen={props.onOpen} />
    </WhatsNewSheet>
  );
  return { onClose, user, ...utils };
};

/** The way the App ticket will render it: an opener, then the sheet kept in the document for its exit */
const Host: FC<{ exitMs?: number }> = ({ exitMs = MOTION.whatsNewSheetOut }) => {
  const [version, setVersion] = useState<string | null>(null);
  const { shown, exiting } = useAnimatedPresence(version, exitMs);
  return (
    <>
      <button type="button" onClick={() => { setVersion('2.0.0'); }}>Open What's new</button>
      {shown && (
        <WhatsNewSheet version={shown} open={!exiting} onClose={() => { setVersion(null); }}>
          <Tiles />
        </WhatsNewSheet>
      )}
    </>
  );
};

const mockReducedMotion = () => {
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
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('WhatsNewSheet', () => {
  describe('AC1: a labelled modal dialog with the version pill', () => {
    it('renders role=dialog aria-modal=true labelled by the "What\'s new" heading, and the pill "New in 2.0.0"', () => {
      renderSheet();

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      const heading = screen.getByRole('heading', { level: 2, name: /What.s new/ });
      expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
      expect(screen.getByRole('dialog', { name: /What.s new/ })).toBe(dialog);
      expect(screen.getByText('New in 2.0.0')).toBeInTheDocument();
    });

    it('draws the version pill as information (bg-accent-subtle, the dark mockup #2F2350), not as a chosen item', () => {
      renderSheet();

      const pill = screen.getByText('New in 2.0.0');
      expect(pill).toHaveClass('rounded-full', 'bg-accent-subtle', 'text-accent', 'font-bold');
      expect(pill).not.toHaveClass('bg-accent-selected');
    });

    it('renders the grid inside the scrolling body, between the title and the footer', () => {
      renderSheet();

      const grid = screen.getByTestId('grid');
      const body = grid.parentElement as HTMLElement;
      expect(body.className).toContain('overflow-y-auto');
      expect(body).toContainElement(screen.getByRole('heading', { level: 2 }));
      expect(body).not.toContainElement(screen.getByRole('button', { name: 'Got it' }));
    });

    it('shows a decorative handle and no "Also new" line', () => {
      renderSheet();

      const dialog = screen.getByRole('dialog');
      const handle = dialog.firstElementChild as HTMLElement;
      expect(handle).toHaveAttribute('aria-hidden', 'true');
      expect(handle.className).toContain('bg-handle');
      expect(dialog.textContent).not.toMatch(/Also new/i);
    });
  });

  describe('AC2: each way to close calls onClose once, with its reason', () => {
    it('Got it calls onClose once with got-it', async () => {
      const { onClose, user } = renderSheet();

      await user.click(screen.getByRole('button', { name: 'Got it' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('got-it');
    });

    it('a click on the backdrop calls onClose once with backdrop', async () => {
      const { onClose, user } = renderSheet();

      await user.click(screen.getByTestId('whats-new-backdrop'));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('backdrop');
    });

    it('Escape calls onClose once with escape', async () => {
      const { onClose, user } = renderSheet();

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('escape');
    });

    it('Enter calls onClose once with enter, on Got it too (its click is not fired as well)', async () => {
      const { onClose, user } = renderSheet();
      expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledWith('enter');
    });

    it('Enter on the dialog itself, outside any control, closes with enter', async () => {
      const { onClose, user } = renderSheet();
      act(() => { screen.getByRole('dialog').focus(); });

      await user.keyboard('{Enter}');

      expect(onClose).toHaveBeenCalledExactlyOnceWith('enter');
    });

    it('Enter on a tile button of the grid keeps its native activation and does not close', async () => {
      const onOpen = vi.fn();
      const { onClose, user } = renderSheet({ onOpen });
      act(() => { screen.getByRole('button', { name: 'Search' }).focus(); });

      await user.keyboard('{Enter}');

      expect(onOpen).toHaveBeenCalledExactlyOnceWith('search');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Space on Got it closes with got-it', async () => {
      const { onClose, user } = renderSheet();

      await user.keyboard(' ');

      expect(onClose).toHaveBeenCalledExactlyOnceWith('got-it');
    });

    it('while the exit plays (open false), nothing closes it again', () => {
      const { onClose } = renderSheet({ open: false });

      fireEvent.click(screen.getByTestId('whats-new-backdrop'));
      fireEvent.click(screen.getByRole('button', { name: 'Got it', hidden: true }));
      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Enter' });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('AC3: the keyboard stays inside, and goes back to the opener', () => {
    it('puts the focus on Got it at open', () => {
      renderSheet();

      expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();
    });

    it('Tab and Shift+Tab cycle through the tiles and Got it without leaving the sheet', async () => {
      const { user } = renderSheet();
      const gotIt = screen.getByRole('button', { name: 'Got it' });
      const variables = screen.getByRole('button', { name: 'Variables' });
      const search = screen.getByRole('button', { name: 'Search' });

      await user.tab();
      expect(variables).toHaveFocus();
      await user.tab();
      expect(search).toHaveFocus();
      await user.tab();
      expect(gotIt).toHaveFocus();
      await user.tab({ shift: true });
      expect(search).toHaveFocus();
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      expect(gotIt).toHaveFocus();
    });

    it.each([
      ['Got it', async (user: ReturnType<typeof userEvent.setup>) => { await user.click(screen.getByRole('button', { name: 'Got it' })); }],
      ['Escape', async (user: ReturnType<typeof userEvent.setup>) => { await user.keyboard('{Escape}'); }],
      ['Enter', async (user: ReturnType<typeof userEvent.setup>) => { await user.keyboard('{Enter}'); }]
    ])('gives the focus back to the opener after a close by %s, as soon as the exit starts', async (_label, closeWith) => {
      const user = userEvent.setup();
      render(<Host />);
      const opener = screen.getByRole('button', { name: "Open What's new" });
      await user.click(opener);
      expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();

      await closeWith(user);

      // Leaving: still in the document for its exit, inert, and the opener has the keyboard again
      expect(screen.getByRole('dialog', { hidden: true }).className).toContain('animate-whats-new-sheet-out');
      expect(opener).toHaveFocus();
    });
  });

  describe('AC5: the motion of the mockup, near instant under reduced motion', () => {
    it('rises and fades in while open, leaves and fades out while the exit plays', () => {
      const { rerender, onClose } = renderSheet();
      expect(screen.getByRole('dialog').className).toContain('animate-whats-new-sheet-in');
      expect(screen.getByTestId('whats-new-backdrop').className).toContain('animate-whats-new-backdrop-in');
      expect(screen.getByTestId('whats-new-backdrop').className).toContain('bg-backdrop');

      rerender(<WhatsNewSheet version="2.0.0" open={false} onClose={onClose}><Tiles /></WhatsNewSheet>);

      expect(screen.getByRole('dialog', { hidden: true }).className).toContain('animate-whats-new-sheet-out');
      expect(screen.getByTestId('whats-new-backdrop').className).toContain('animate-whats-new-backdrop-out');
    });

    it('stays for MOTION.whatsNewSheetOut after closing, then leaves the document', async () => {
      vi.useFakeTimers();
      render(<Host />);
      fireEvent.click(screen.getByRole('button', { name: "Open What's new" }));
      fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

      act(() => { vi.advanceTimersByTime(MOTION.whatsNewSheetOut - 1); });
      expect(screen.queryByRole('dialog', { hidden: true })).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(1); });
      expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
    });

    it('leaves the document at once under prefers-reduced-motion', () => {
      mockReducedMotion();
      vi.useFakeTimers();
      expect(motionDuration(MOTION.whatsNewSheetOut)).toBe(0);
      render(<Host />);
      fireEvent.click(screen.getByRole('button', { name: "Open What's new" }));
      fireEvent.click(screen.getByRole('button', { name: 'Got it' }));

      act(() => { vi.advanceTimersByTime(0); });

      expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
    });
  });

  describe('AC6: no timer outlives the sheet', () => {
    it('leaves no pending timer and no act warning when unmounted open', () => {
      vi.useFakeTimers();
      const consoleError = vi.spyOn(console, 'error');
      const { unmount } = renderSheet();

      unmount();

      expect(vi.getTimerCount()).toBe(0);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('leaves no pending timer and no act warning when unmounted during its exit', () => {
      vi.useFakeTimers();
      const consoleError = vi.spyOn(console, 'error');
      const { unmount } = render(<Host />);
      fireEvent.click(screen.getByRole('button', { name: "Open What's new" }));
      fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
      expect(vi.getTimerCount()).toBe(1);

      unmount();

      expect(vi.getTimerCount()).toBe(0);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });
});

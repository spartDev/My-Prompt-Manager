/**
 * AnalyticsTab (Atelier 1C): the hero with its weekday bars, Top platform and Top category, Most
 * used, Tidy up, and Clear history. The computations themselves are tested in usageInsights.test.ts.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDuplicateGroups } from '../../../hooks/useDuplicateGroups';
import { useUsageStats } from '../../../hooks/useUsageStats';
import { buildPrompt } from '../../../test/builders/buildPrompt';
import type { UsageEvent } from '../../../types';
import type { UsageStats, UseUsageStatsReturn } from '../../../types/hooks';
import AnalyticsTab from '../AnalyticsTab';

vi.mock('../../../hooks/useUsageStats', () => ({
  useUsageStats: vi.fn()
}));
vi.mock('../../../hooks/useDuplicateGroups', () => ({
  useDuplicateGroups: vi.fn()
}));

const mockUseUsageStats = vi.mocked(useUsageStats);
const mockUseDuplicateGroups = vi.mocked(useDuplicateGroups);

// 2026-11-03 is a Tuesday
const TUE = new Date(2026, 10, 3, 12).getTime();
const WED = new Date(2026, 10, 4, 12).getTime();

const review = buildPrompt({ id: 'p1', title: 'Code Review Helper', category: 'Development', usageCount: 3 });
const email = buildPrompt({ id: 'p2', title: 'Email Composer', category: 'Writing', usageCount: 2 });
const bug = buildPrompt({ id: 'p3', title: 'Bug Fixer', category: 'Development', usageCount: 1 });
const notes = buildPrompt({ id: 'p4', title: 'Meeting Notes', category: 'Writing', usageCount: 1 });
const unused = buildPrompt({ id: 'p5', title: 'Competitor Teardown', category: 'Research', usageCount: 0 });
const PROMPTS = [review, email, bug, notes, unused];

const event = (promptId: string, timestamp: number, platform = 'claude'): UsageEvent => ({ promptId, timestamp, platform, categoryId: null });

const HISTORY: UsageEvent[] = [
  event('p1', TUE), event('p1', TUE), event('p1', WED, 'chatgpt'),
  event('p2', TUE), event('p2', WED),
  event('p3', WED),
  event('p4', TUE)
];

const stats = { totalUses: HISTORY.length } as UsageStats;

const createMockReturn = (overrides: Partial<UseUsageStatsReturn> = {}): UseUsageStatsReturn => ({
  stats,
  history: HISTORY,
  prompts: PROMPTS,
  loading: false,
  error: null,
  refresh: vi.fn(),
  clearHistory: vi.fn(),
  ...overrides
});

describe('AnalyticsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUsageStats.mockReturnValue(createMockReturn());
    mockUseDuplicateGroups.mockReturnValue([]);
  });

  describe('Section header', () => {
    it('is titled Analytics with the period as its Eyebrow', () => {
      render(<AnalyticsTab />);

      expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });

    it('offers the full Dashboard and the close button in the side panel only', () => {
      const onExpand = vi.fn();
      const { unmount } = render(<AnalyticsTab context="sidepanel" onExpandDashboard={onExpand} />);
      fireEvent.click(screen.getByRole('button', { name: 'View full analytics dashboard' }));
      expect(onExpand).toHaveBeenCalled();
      unmount();

      render(<AnalyticsTab context="popup" onExpandDashboard={onExpand} />);
      expect(screen.queryByRole('button', { name: 'View full analytics dashboard' })).not.toBeInTheDocument();
    });
  });

  describe('Hero', () => {
    it('shows the Insertions of the period and names the busiest weekday', () => {
      render(<AnalyticsTab />);

      const hero = screen.getByTestId('stats-hero');
      expect(within(hero).getByText('Prompts used')).toBeInTheDocument();
      expect(within(hero).getByText('7')).toBeInTheDocument();
      expect(screen.getByTestId('stats-hero-subtitle')).toHaveTextContent('Tuesday is your busiest day.');
    });

    it('draws a bar per weekday, Monday to Sunday, with a text alternative', () => {
      render(<AnalyticsTab />);

      expect(screen.getAllByTestId('stats-bar').map(bar => bar.textContent?.replace(/\d+/g, ''))).toEqual(
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      );
      expect(screen.getByRole('img', { name: /Monday 0, Tuesday 4, Wednesday 3, .*Tuesday is the busiest/ })).toBeInTheDocument();
    });

    it("shows a hovered bar's count in the line under the total", () => {
      render(<AnalyticsTab />);

      const wednesday = screen.getAllByTestId('stats-bar')[2];
      fireEvent.mouseEnter(wednesday);
      expect(screen.getByTestId('stats-hero-subtitle')).toHaveTextContent('3 on Wednesdays');

      fireEvent.mouseLeave(wednesday);
      expect(screen.getByTestId('stats-hero-subtitle')).toHaveTextContent('Tuesday is your busiest day.');
    });
  });

  describe('Top platform and Top category', () => {
    it('name the Platform and the Category used most, with their uses', () => {
      render(<AnalyticsTab />);

      const platform = screen.getByRole('heading', { name: 'Top platform' }).parentElement as HTMLElement;
      expect(within(platform).getByText('Claude')).toBeInTheDocument();
      expect(within(platform).getByText('6 uses')).toBeInTheDocument();

      const category = screen.getByRole('heading', { name: 'Top category' }).parentElement as HTMLElement;
      expect(within(category).getByText('Development')).toBeInTheDocument();
      expect(within(category).getByText('4 uses')).toBeInTheDocument();
    });
  });

  describe('Most used', () => {
    it('ranks the three Prompts used most in the period', () => {
      render(<AnalyticsTab />);

      const rows = screen.getAllByTestId('most-used-row');
      expect(rows.map(row => row.getAttribute('aria-label'))).toEqual([
        'Code Review Helper, 3 uses. Open',
        'Email Composer, 2 uses. Open',
        'Bug Fixer, 1 use. Open'
      ]);
    });

    it('opens the Prompt of a row in the editor', () => {
      const onEditPrompt = vi.fn();
      render(<AnalyticsTab onEditPrompt={onEditPrompt} />);

      fireEvent.click(screen.getAllByTestId('most-used-row')[1]);

      expect(onEditPrompt).toHaveBeenCalledWith(email);
    });

    it('gives the keyboard to the first row left when asked to, once', () => {
      const onFocusTaken = vi.fn();
      render(<AnalyticsTab prompts={PROMPTS.filter(p => p.id !== 'p1')} takeFocus onFocusTaken={onFocusTaken} />);

      expect(screen.getAllByTestId('most-used-row')[0]).toHaveFocus();
      expect(screen.getAllByTestId('most-used-row')[0]).toHaveAccessibleName('Email Composer, 2 uses. Open');
      expect(onFocusTaken).toHaveBeenCalledTimes(1);
    });

    it('gives the keyboard to the Analytics content when no row is left', () => {
      render(<AnalyticsTab prompts={[unused]} takeFocus onFocusTaken={vi.fn()} />);

      expect(screen.getByRole('main', { name: 'Analytics' })).toHaveFocus();
    });

    it('offers View all when more Prompts were used than the rows shown', () => {
      const onExpand = vi.fn();
      render(<AnalyticsTab context="popup" onExpandDashboard={onExpand} />);

      fireEvent.click(screen.getByRole('button', { name: 'View all' }));

      expect(onExpand).toHaveBeenCalled();
    });

    it('has no View all when every Prompt used is shown', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({ history: HISTORY.filter(e => e.promptId !== 'p4') }));
      render(<AnalyticsTab onExpandDashboard={vi.fn()} />);

      expect(screen.queryByRole('button', { name: 'View all' })).not.toBeInTheDocument();
    });
  });

  describe('Tidy up', () => {
    it('counts the Never used Prompts and the Duplicate pairs', () => {
      mockUseDuplicateGroups.mockReturnValue([{ original: email, duplicates: [notes] }]);
      render(<AnalyticsTab />);

      expect(screen.getByTestId('tidy-up-never-used')).toHaveTextContent('1 prompt never used');
      expect(screen.getByTestId('tidy-up-duplicates')).toHaveTextContent('1 duplicate pair');
    });

    it('opens the Library on the Never used Prompts', () => {
      const onReviewPrompts = vi.fn();
      render(<AnalyticsTab onReviewPrompts={onReviewPrompts} />);

      fireEvent.click(screen.getByRole('button', { name: 'Review the 1 prompt never used' }));

      expect(onReviewPrompts).toHaveBeenCalledWith({ kind: 'neverUsed' });
    });

    it('opens the Library on the Prompts of the Duplicate pairs, each original first', () => {
      const onReviewPrompts = vi.fn();
      mockUseDuplicateGroups.mockReturnValue([{ original: email, duplicates: [notes, bug] }]);
      render(<AnalyticsTab onReviewPrompts={onReviewPrompts} />);

      fireEvent.click(screen.getByRole('button', { name: 'Review the 2 duplicate pairs' }));

      expect(onReviewPrompts).toHaveBeenCalledWith({ kind: 'duplicates', groups: [['p2', 'p4', 'p3']] });
    });

    it('hides a line with nothing to review, and the line for duplicates while they are looked for', () => {
      mockUseDuplicateGroups.mockReturnValue(null);
      render(<AnalyticsTab />);

      expect(screen.getByTestId('tidy-up-never-used')).toBeInTheDocument();
      expect(screen.queryByTestId('tidy-up-duplicates')).not.toBeInTheDocument();
    });

    it('is hidden when there is nothing to review', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({ prompts: PROMPTS.filter(p => p !== unused) }));
      render(<AnalyticsTab />);

      expect(screen.queryByTestId('tidy-up')).not.toBeInTheDocument();
    });

    it('uses the live Prompts the app passes, over the ones loaded with the history', () => {
      render(<AnalyticsTab prompts={[review, email, bug, notes]} />);

      expect(screen.queryByTestId('tidy-up')).not.toBeInTheDocument();
    });
  });

  describe('Without usage', () => {
    it('keeps the hero at 0 with flat bars, hides the usage cards and still shows Tidy up', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({ history: [], stats: { totalUses: 0 } as UsageStats }));
      render(<AnalyticsTab />);

      expect(screen.getByTestId('stats-hero-subtitle')).toHaveTextContent('No Prompts used yet.');
      expect(screen.getAllByTestId('stats-bar')).toHaveLength(7);
      expect(screen.queryByRole('heading', { name: 'Top platform' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Most used' })).not.toBeInTheDocument();
      expect(screen.getByTestId('tidy-up')).toBeInTheDocument();
    });
  });

  describe('Loading and errors', () => {
    it('shows a placeholder while loading', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({ loading: true, stats: null, history: [] }));
      render(<AnalyticsTab />);

      expect(screen.getByRole('status', { name: 'Loading analytics' })).toBeInTheDocument();
    });

    it('reports an error as an alert', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({
        error: { type: 'STORAGE_UNAVAILABLE', message: 'Storage failed' } as UseUsageStatsReturn['error']
      }));
      render(<AnalyticsTab />);

      expect(screen.getByRole('alert')).toHaveTextContent('Storage failed');
    });
  });

  describe('Clear History', () => {
    it('should show clear history button when there is data', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByRole('button', { name: /clear history/i })).toBeInTheDocument();
    });

    it('should not show clear history button when there is no data', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({ history: [] }));

      render(<AnalyticsTab />);

      expect(screen.queryByRole('button', { name: /clear history/i })).not.toBeInTheDocument();
    });

    it('should show confirmation modal when clear history button is clicked', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      fireEvent.click(screen.getByRole('button', { name: /clear history/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Clear Usage History?')).toBeInTheDocument();
    });

    it('should close confirmation modal when cancel is clicked', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      fireEvent.click(screen.getByRole('button', { name: /clear history/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should call clearHistory when confirm is clicked', async () => {
      const mockClearHistory = vi.fn().mockResolvedValue(undefined);
      mockUseUsageStats.mockReturnValue(createMockReturn({
        clearHistory: mockClearHistory
      }));

      render(<AnalyticsTab />);

      fireEvent.click(screen.getByRole('button', { name: /clear history/i }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /^clear history$/i }));

      await vi.waitFor(() => {
        expect(mockClearHistory).toHaveBeenCalled();
      });
    });

    it('should close modal after successful clear', async () => {
      const mockClearHistory = vi.fn().mockResolvedValue(undefined);
      mockUseUsageStats.mockReturnValue(createMockReturn({
        clearHistory: mockClearHistory
      }));

      render(<AnalyticsTab />);

      fireEvent.click(screen.getByRole('button', { name: /clear history/i }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /^clear history$/i }));

      await vi.waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should show clearing state while clearing', async () => {
      let resolvePromise: (() => void) | undefined;
      const clearPromise = new Promise<void>(resolve => {
        resolvePromise = resolve;
      });
      const mockClearHistory = vi.fn().mockReturnValue(clearPromise);
      mockUseUsageStats.mockReturnValue(createMockReturn({
        clearHistory: mockClearHistory
      }));

      render(<AnalyticsTab />);

      fireEvent.click(screen.getByRole('button', { name: /clear history/i }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /^clear history$/i }));

      expect(screen.getByText('Clearing...')).toBeInTheDocument();

      if (resolvePromise) {
        resolvePromise();
      }
      await vi.waitFor(() => {
        expect(screen.queryByText('Clearing...')).not.toBeInTheDocument();
      });
    });

    it('should close modal when clicking backdrop', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      fireEvent.click(screen.getByRole('button', { name: /clear history/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('modal-backdrop'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('moves focus into the dialog and keeps Tab and Shift+Tab inside it', async () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());
      const user = userEvent.setup();

      render(<AnalyticsTab />);

      await user.click(screen.getByRole('button', { name: /clear history/i }));
      const dialog = screen.getByRole('dialog', { name: 'Clear Usage History?' });
      const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
      const confirm = within(dialog).getByRole('button', { name: 'Clear History' });

      expect(cancel).toHaveFocus();
      await user.tab();
      expect(confirm).toHaveFocus();
      await user.tab();
      expect(cancel).toHaveFocus();
      await user.tab({ shift: true });
      expect(confirm).toHaveFocus();
    });

    it('keeps Tab inside the dialog while the clear is pending and both buttons are disabled', async () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({
        clearHistory: vi.fn().mockReturnValue(new Promise<void>(() => { /* never settles: the clear stays pending */ }))
      }));
      const user = userEvent.setup();

      render(<AnalyticsTab />);

      await user.click(screen.getByRole('button', { name: /clear history/i }));
      const dialog = screen.getByRole('dialog', { name: 'Clear Usage History?' });
      await user.click(within(dialog).getByRole('button', { name: 'Clear History' }));
      expect(within(dialog).getByRole('button', { name: 'Clearing...' })).toBeDisabled();

      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('closes on Escape and returns focus to the Clear history button', async () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());
      const user = userEvent.setup();

      render(<AnalyticsTab />);

      const opener = screen.getByRole('button', { name: /clear history/i });
      await user.click(opener);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    });
  });
});

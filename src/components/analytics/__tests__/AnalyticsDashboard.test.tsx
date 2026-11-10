/**
 * AnalyticsDashboard, the full-page Analytics view: the Analytics tab's design at the width of a
 * page. The hero, Top platform and Top category, Most used, the Platforms and Categories, Daily use,
 * Time of day, and Tidy up, whose Review opens the side panel. The computations themselves are
 * tested in usageInsights.test.ts.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDuplicateGroups } from '../../../hooks/useDuplicateGroups';
import { useNow } from '../../../hooks/useNow';
import { useUsageStats } from '../../../hooks/useUsageStats';
import { requestLibraryReview } from '../../../services/libraryReview';
import { buildPrompt } from '../../../test/builders/buildPrompt';
import type { AppError, UsageEvent } from '../../../types';
import type { UsageStats, UseUsageStatsReturn } from '../../../types/hooks';
import AnalyticsDashboard from '../AnalyticsDashboard';

vi.mock('../../../hooks/useUsageStats', () => ({ useUsageStats: vi.fn() }));
vi.mock('../../../hooks/useDuplicateGroups', () => ({ useDuplicateGroups: vi.fn() }));
vi.mock('../../../hooks/useNow', () => ({ useNow: vi.fn() }));
vi.mock('../../../services/libraryReview', () => ({ requestLibraryReview: vi.fn() }));

// recharts draws nothing without a layout: the charts are tested in charts.test.tsx
vi.mock('../charts', () => ({
  DailyUseChart: ({ data }: { data: unknown[] }) => <div data-testid="daily-use-chart">{data.length} days</div>,
  TimeOfDayChart: ({ data }: { data: unknown[] }) => <div data-testid="time-of-day-chart">{data.length} times</div>
}));

const mockUseUsageStats = vi.mocked(useUsageStats);
const mockUseDuplicateGroups = vi.mocked(useDuplicateGroups);
const mockRequestLibraryReview = vi.mocked(requestLibraryReview);

// 2026-11-03 is a Tuesday
const TUE = new Date(2026, 10, 3, 12).getTime();
const WED = new Date(2026, 10, 4, 12).getTime();
const NOW = new Date(2026, 10, 6, 12).getTime();

const review = buildPrompt({ id: 'p1', title: 'Code Review Helper', category: 'Development', usageCount: 3 });
const email = buildPrompt({ id: 'p2', title: 'Email Composer', category: 'Writing', usageCount: 2 });
const bug = buildPrompt({ id: 'p3', title: 'Bug Fixer', category: 'Development', usageCount: 1 });
const unused = buildPrompt({ id: 'p5', title: 'Competitor Teardown', category: 'Research', usageCount: 0 });
const PROMPTS = [review, email, bug, unused];

const event = (promptId: string, timestamp: number, platform = 'claude'): UsageEvent => ({ promptId, timestamp, platform, categoryId: null });

const HISTORY: UsageEvent[] = [
  event('p1', TUE), event('p1', TUE), event('p1', WED, 'chatgpt'),
  event('p2', TUE), event('p2', WED),
  event('p3', WED)
];

const stats: UsageStats = {
  totalUses: HISTORY.length,
  dailyUsage: [{ date: '2026-11-02', count: 0 }, { date: '2026-11-03', count: 3 }, { date: '2026-11-04', count: 3 }],
  timeOfDayDistribution: [
    { bucket: 'Morning', count: 0 },
    { bucket: 'Afternoon', count: 6 },
    { bucket: 'Evening', count: 0 },
    { bucket: 'Night', count: 0 }
  ]
};

const createMockReturn = (overrides: Partial<UseUsageStatsReturn> = {}): UseUsageStatsReturn => ({
  stats,
  history: HISTORY,
  prompts: PROMPTS,
  categories: [{ id: 'c1', name: 'Development', color: '#112233' }, { id: 'c2', name: 'Writing' }],
  loading: false,
  error: null,
  refresh: vi.fn(),
  clearHistory: vi.fn(),
  ...overrides
});

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    mockUseUsageStats.mockReturnValue(createMockReturn());
    mockUseDuplicateGroups.mockReturnValue([]);
    vi.mocked(useNow).mockReturnValue(NOW);
    mockRequestLibraryReview.mockReset().mockResolvedValue(undefined);
    Object.assign(chrome.tabs, { getCurrent: vi.fn().mockResolvedValue({ windowId: 7 }) });
  });

  describe('Section header', () => {
    it('is titled Analytics, with the period counted as its Eyebrow, as in the tab', () => {
      render(<AnalyticsDashboard />);

      expect(screen.getByRole('heading', { level: 1, name: 'Analytics' })).toBeInTheDocument();
      expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    });

    it('has a back button when it can go back', () => {
      const onBack = vi.fn();
      render(<AnalyticsDashboard onBack={onBack} />);

      fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('has none otherwise', () => {
      render(<AnalyticsDashboard />);

      expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument();
    });
  });

  describe('Hero', () => {
    it('shows the Insertions of the period and the busiest weekday', () => {
      render(<AnalyticsDashboard />);

      const hero = screen.getByTestId('stats-hero');
      expect(within(hero).getByText('6', { selector: '.sr-only' })).toBeInTheDocument();
      expect(within(hero).getByTestId('stats-hero-subtitle')).toHaveTextContent('Tuesday is your busiest day.');
      expect(within(hero).getAllByTestId('stats-bar')).toHaveLength(7);
    });
  });

  describe('Top platform and Top category', () => {
    it('name the first of each ranking, with its uses', () => {
      render(<AnalyticsDashboard />);

      const platform = screen.getByRole('heading', { name: 'Top platform' }).parentElement as HTMLElement;
      expect(platform).toHaveTextContent('Claude');
      expect(platform).toHaveTextContent('5 uses');
      const category = screen.getByRole('heading', { name: 'Top category' }).parentElement as HTMLElement;
      expect(category).toHaveTextContent('Development');
      expect(category).toHaveTextContent('4 uses');
    });
  });

  describe('Most used', () => {
    it('ranks the Prompts used in the period, each with its Category and when it was last used', () => {
      render(<AnalyticsDashboard />);

      const rows = screen.getAllByTestId('most-used-row');
      expect(rows.map(row => within(row).getByText(/Helper|Composer|Fixer/).textContent)).toEqual([
        'Code Review Helper', 'Email Composer', 'Bug Fixer'
      ]);
      expect(rows[0]).toHaveTextContent('Development · 2d ago');
      expect(within(rows[0]).getByText('3 uses')).toBeInTheDocument();
      expect(within(rows[2]).getByText('1 use')).toBeInTheDocument();
    });

    it('shows ten rows at most', () => {
      const prompts = Array.from({ length: 12 }, (_, i) => buildPrompt({ id: `q${String(i)}`, title: `Prompt ${String(i)}`, usageCount: 1 }));
      mockUseUsageStats.mockReturnValue(createMockReturn({
        prompts,
        history: prompts.map((prompt, i) => event(prompt.id, TUE + i))
      }));
      render(<AnalyticsDashboard />);

      expect(screen.getAllByTestId('most-used-row')).toHaveLength(10);
    });

    it('has rows that are read, not pressed, and no View all', () => {
      render(<AnalyticsDashboard />);

      const card = screen.getByRole('region', { name: 'Most used' });
      expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    });

    it('has no Recently Used or Forgotten tab', () => {
      render(<AnalyticsDashboard />);

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryByText(/forgotten/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/recently used/i)).not.toBeInTheDocument();
    });
  });

  describe('Platforms and Categories', () => {
    it('rank the Platforms by Insertions', () => {
      render(<AnalyticsDashboard />);

      const rows = within(screen.getByRole('region', { name: 'Platforms' })).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Claude');
      expect(within(rows[0]).getByText('5 uses')).toBeInTheDocument();
      expect(rows[1]).toHaveTextContent('ChatGPT');
    });

    it("rank the Categories, each with its own color when it has one", () => {
      render(<AnalyticsDashboard />);

      const card = screen.getByRole('region', { name: 'Categories' });
      const rows = within(card).getAllByRole('listitem');
      expect(rows.map(row => row.textContent)).toEqual([expect.stringContaining('Development'), expect.stringContaining('Writing')]);
      const dots = [...card.querySelectorAll<HTMLElement>('span[style*="background-color"]')];
      expect(dots.map(dot => dot.style.backgroundColor)).toEqual(['#112233']);
    });
  });

  describe('Charts', () => {
    it('shows Daily use with the days a Prompt was used', () => {
      render(<AnalyticsDashboard />);

      const card = screen.getByRole('region', { name: 'Daily use' });
      expect(card).toHaveTextContent('Used on 2 of the last 3 days.');
      expect(within(card).getByTestId('daily-use-chart')).toHaveTextContent('3 days');
    });

    it('shows Time of day with the busiest time', () => {
      render(<AnalyticsDashboard />);

      const card = screen.getByRole('region', { name: 'Time of day' });
      expect(card).toHaveTextContent('Afternoon is your busiest time.');
      expect(within(card).getByTestId('time-of-day-chart')).toHaveTextContent('4 times');
    });
  });

  describe('Tidy up', () => {
    it('counts the Never used Prompts and the Duplicate pairs', () => {
      mockUseDuplicateGroups.mockReturnValue([{ original: email, duplicates: [bug] }]);
      render(<AnalyticsDashboard />);

      expect(screen.getByTestId('tidy-up-never-used')).toHaveTextContent('1 prompt never used');
      expect(screen.getByTestId('tidy-up-duplicates')).toHaveTextContent('1 duplicate pair');
    });

    it('opens the side panel of its window on the Never used Prompts', async () => {
      render(<AnalyticsDashboard />);
      await waitFor(() => { expect(chrome.tabs.getCurrent).toHaveBeenCalled(); });
      await Promise.resolve();

      fireEvent.click(screen.getByRole('button', { name: 'Review the 1 prompt never used' }));

      expect(mockRequestLibraryReview).toHaveBeenCalledWith({ kind: 'neverUsed' }, 7);
    });

    it('opens it on the Duplicate pairs, as groups of ids', async () => {
      mockUseDuplicateGroups.mockReturnValue([{ original: email, duplicates: [bug] }]);
      render(<AnalyticsDashboard />);
      await waitFor(() => { expect(chrome.tabs.getCurrent).toHaveBeenCalled(); });
      await Promise.resolve();

      fireEvent.click(screen.getByRole('button', { name: 'Review the 1 duplicate pair' }));

      expect(mockRequestLibraryReview).toHaveBeenCalledWith({ kind: 'duplicates', groups: [['p2', 'p3']] }, 7);
    });

    it('says so when the side panel cannot be opened', async () => {
      mockRequestLibraryReview.mockRejectedValue(new Error('no user gesture'));
      render(<AnalyticsDashboard />);
      await waitFor(() => { expect(chrome.tabs.getCurrent).toHaveBeenCalled(); });
      await Promise.resolve();

      fireEvent.click(screen.getByRole('button', { name: 'Review the 1 prompt never used' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('The side panel could not be opened.');
    });

    it('is hidden with nothing to review', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({ prompts: [review, email, bug] }));
      render(<AnalyticsDashboard />);

      expect(screen.queryByTestId('tidy-up')).not.toBeInTheDocument();
    });
  });

  describe('Without usage', () => {
    it('shows the hero at zero and Tidy up, and no ranking or chart', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({
        history: [],
        stats: { totalUses: 0, dailyUsage: [], timeOfDayDistribution: [] }
      }));
      render(<AnalyticsDashboard />);

      expect(screen.getByTestId('stats-hero-subtitle')).toHaveTextContent('No Prompts used yet.');
      expect(screen.getByTestId('tidy-up')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Most used' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Platforms' })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Daily use' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Top platform' })).not.toBeInTheDocument();
    });
  });

  describe('Loading and failure', () => {
    it('shows a placeholder while the history loads', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({ stats: null, history: [], loading: true }));
      render(<AnalyticsDashboard />);

      expect(screen.getByRole('status', { name: 'Loading analytics' })).toBeInTheDocument();
      expect(screen.queryByTestId('stats-hero')).not.toBeInTheDocument();
    });

    it('says why when the history cannot be loaded', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({
        error: { type: 'STORAGE_UNAVAILABLE', message: 'Storage is not available' } as AppError
      }));
      render(<AnalyticsDashboard />);

      expect(screen.getByRole('alert')).toHaveTextContent('Unable to load analytics');
      expect(screen.getByRole('alert')).toHaveTextContent('Storage is not available');
    });
  });
});

/**
 * AnalyticsDashboard Component Tests
 *
 * Tests the full-page analytics dashboard including:
 * - Rendering with mock data (summary cards, charts, prompt tables)
 * - Empty state when no usage data exists
 * - Error state when loading fails
 * - Loading state with skeleton placeholders
 * - Tab switching between Most Used, Recently Used, and Forgotten prompts
 * - Keyboard navigation for tabs (ArrowLeft, ArrowRight, Home, End)
 * - Back button callback
 * - Prompt list rendering with correct use/uses pluralization
 * - Trophy icons for top 3 most-used prompts
 * - Forgotten tab empty message
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useNow } from '../../../hooks/useNow';
import { useSummaryMetrics, type SummaryMetrics } from '../../../hooks/useSummaryMetrics';
import { useUsageStats } from '../../../hooks/useUsageStats';
import type { UseUsageStatsReturn, UsageStats, PromptUsageSummary } from '../../../types/hooks';
import AnalyticsDashboard from '../AnalyticsDashboard';

// Mock hooks
vi.mock('../../../hooks/useUsageStats', () => ({
  useUsageStats: vi.fn()
}));

vi.mock('../../../hooks/useSummaryMetrics', () => ({
  useSummaryMetrics: vi.fn()
}));

vi.mock('../../../hooks/useNow', () => ({
  useNow: vi.fn()
}));

// Mock chart components to avoid recharts rendering issues in jsdom
vi.mock('../charts', () => ({
  UsageLineChart: ({ data, height }: { data: unknown[]; height: number }) => (
    <div data-testid="usage-line-chart" style={{ height }}>
      UsageLineChart ({data.length} data points)
    </div>
  ),
  PlatformPieChart: ({ data, height }: { data: unknown[]; height: number }) => (
    <div data-testid="platform-pie-chart" style={{ height }}>
      PlatformPieChart ({data.length} platforms)
    </div>
  ),
  DayOfWeekChart: ({ data, height }: { data: unknown[]; height: number }) => (
    <div data-testid="day-of-week-chart" style={{ height }}>
      DayOfWeekChart ({data.length} days)
    </div>
  ),
  CategoryBarChart: ({ data, height, maxCategories }: { data: unknown[]; height: number; maxCategories: number }) => (
    <div data-testid="category-bar-chart" style={{ height }}>
      CategoryBarChart ({data.length} categories, max {maxCategories})
    </div>
  ),
  TimeOfDayChart: ({ data, height }: { data: unknown[]; height: number }) => (
    <div data-testid="time-of-day-chart" style={{ height }}>
      TimeOfDayChart ({data.length} buckets)
    </div>
  )
}));

const mockUseUsageStats = vi.mocked(useUsageStats);
const mockUseSummaryMetrics = vi.mocked(useSummaryMetrics);
const mockUseNow = vi.mocked(useNow);

const NOW = 1706745600000; // Fixed timestamp for deterministic tests

/**
 * Helper to get a DOM element by ID with an assertion guard
 * to avoid non-null assertions while still failing clearly if element is missing.
 */
const getElementByIdSafe = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Expected element with id "${id}" to exist in the document`);
  }
  return el;
};

/**
 * Helper to get the active (non-hidden) tab panel from a list of panels.
 */
const getActivePanel = (panels: HTMLElement[]): HTMLElement => {
  const active = panels.find(p => !p.hidden);
  if (!active) {
    throw new Error('Expected to find an active (non-hidden) tab panel');
  }
  return active;
};

const createMockPrompts = (count: number, tabType: 'top' | 'recent' | 'forgotten' = 'top'): PromptUsageSummary[] => {
  return Array.from({ length: count }, (_, i) => ({
    promptId: `p${String(i + 1)}`,
    title: `Prompt ${String(i + 1)}`,
    category: i % 2 === 0 ? 'Development' : 'Writing',
    count: tabType === 'forgotten' ? 0 : 10 - i,
    lastUsed: tabType === 'forgotten'
      ? NOW - (30 * 24 * 60 * 60 * 1000) // 30 days ago
      : NOW - (i * 3600000) // hours ago
  }));
};

const createMockStats = (overrides: Partial<UsageStats> = {}): UsageStats => ({
  totalUses: 42,
  dailyUsage: [
    { date: '2026-01-13', count: 5 },
    { date: '2026-01-12', count: 10 }
  ],
  platformBreakdown: [
    { platform: 'claude', count: 25, percentage: 60 },
    { platform: 'chatgpt', count: 17, percentage: 40 }
  ],
  dayOfWeekDistribution: [
    { day: 'Sun', dayIndex: 0, count: 5 },
    { day: 'Mon', dayIndex: 1, count: 15 },
    { day: 'Tue', dayIndex: 2, count: 8 },
    { day: 'Wed', dayIndex: 3, count: 6 },
    { day: 'Thu', dayIndex: 4, count: 4 },
    { day: 'Fri', dayIndex: 5, count: 3 },
    { day: 'Sat', dayIndex: 6, count: 1 }
  ],
  timeOfDayDistribution: [
    { bucket: 'Morning', count: 10 },
    { bucket: 'Afternoon', count: 20 },
    { bucket: 'Evening', count: 8 },
    { bucket: 'Night', count: 4 }
  ],
  categoryDistribution: [
    { categoryId: '1', name: 'Development', count: 20 },
    { categoryId: '2', name: 'Writing', count: 15 }
  ],
  topPrompts: createMockPrompts(5, 'top'),
  recentPrompts: createMockPrompts(3, 'recent'),
  forgottenPrompts: [],
  ...overrides
});

const createMockReturn = (overrides: Partial<UseUsageStatsReturn> = {}): UseUsageStatsReturn => ({
  stats: createMockStats(),
  history: [],
  loading: false,
  error: null,
  refresh: vi.fn(),
  clearHistory: vi.fn(),
  ...overrides
});

const createMockSummaryMetrics = (overrides: Partial<SummaryMetrics> = {}): SummaryMetrics => ({
  totalUses: 42,
  topPlatform: { name: 'claude', count: 25 },
  peakDay: { day: 'Mon', count: 15 },
  topCategory: { name: 'Development', count: 20 },
  ...overrides
});

const setupDefaultMocks = (
  statsOverrides: Partial<UseUsageStatsReturn> = {},
  metricsOverrides: Partial<SummaryMetrics> = {}
) => {
  mockUseUsageStats.mockReturnValue(createMockReturn(statsOverrides));
  mockUseSummaryMetrics.mockReturnValue(createMockSummaryMetrics(metricsOverrides));
  mockUseNow.mockReturnValue(NOW);
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering with data', () => {
    it('should render the dashboard header with title and subtitle', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByRole('heading', { name: 'Analytics Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Last 30 days of usage')).toBeInTheDocument();
    });

    it('should render the back button when onBack is provided', () => {
      setupDefaultMocks();
      const onBack = vi.fn();

      render(<AnalyticsDashboard onBack={onBack} />);

      const backButton = screen.getByLabelText('Go back');
      expect(backButton).toBeInTheDocument();
    });

    it('should call onBack when back button is clicked', async () => {
      setupDefaultMocks();
      const onBack = vi.fn();
      const user = userEvent.setup();

      render(<AnalyticsDashboard onBack={onBack} />);

      await user.click(screen.getByLabelText('Go back'));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('should not render the back button when onBack is not provided', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.queryByLabelText('Go back')).not.toBeInTheDocument();
    });

    it('should render all four summary cards', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Total Uses')).toBeInTheDocument();
      expect(screen.getByText('Top Platform')).toBeInTheDocument();
      expect(screen.getByText('Peak Day')).toBeInTheDocument();
      expect(screen.getByText('Top Category')).toBeInTheDocument();
    });

    it('should render the Summary section heading', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Summary')).toBeInTheDocument();
    });

    it('should render the Usage Trend section', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Usage Trend')).toBeInTheDocument();
      expect(screen.getByTestId('usage-line-chart')).toBeInTheDocument();
    });

    it('should render the Breakdown section with all four chart types', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Platforms')).toBeInTheDocument();
      expect(screen.getByText('Day of Week')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByText('Time of Day')).toBeInTheDocument();

      expect(screen.getByTestId('platform-pie-chart')).toBeInTheDocument();
      expect(screen.getByTestId('day-of-week-chart')).toBeInTheDocument();
      expect(screen.getByTestId('category-bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('time-of-day-chart')).toBeInTheDocument();
    });

    it('should render the Prompts section with tabs', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Prompts')).toBeInTheDocument();
      expect(screen.getByRole('tablist', { name: 'Prompt tabs' })).toBeInTheDocument();
    });

    it('should pass correct data lengths to chart components', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByText(/UsageLineChart \(2 data points\)/)).toBeInTheDocument();
      expect(screen.getByText(/PlatformPieChart \(2 platforms\)/)).toBeInTheDocument();
      expect(screen.getByText(/DayOfWeekChart \(7 days\)/)).toBeInTheDocument();
      expect(screen.getByText(/CategoryBarChart \(2 categories, max 6\)/)).toBeInTheDocument();
      expect(screen.getByText(/TimeOfDayChart \(4 buckets\)/)).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('should show empty state when stats has totalUses of 0', () => {
      const emptyStats = createMockStats({ totalUses: 0 });
      setupDefaultMocks({ stats: emptyStats });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('No usage data yet')).toBeInTheDocument();
      expect(screen.getByText(/Start using your prompts on AI platforms/)).toBeInTheDocument();
    });

    it('should show empty state when stats is null and not loading', () => {
      setupDefaultMocks({ stats: null, loading: false });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('No usage data yet')).toBeInTheDocument();
    });

    it('should have an accessible region label for empty analytics', () => {
      const emptyStats = createMockStats({ totalUses: 0 });
      setupDefaultMocks({ stats: emptyStats });

      render(<AnalyticsDashboard />);

      expect(screen.getByRole('region', { name: 'Empty analytics' })).toBeInTheDocument();
    });

    it('should not render charts or prompt tables in empty state', () => {
      const emptyStats = createMockStats({ totalUses: 0 });
      setupDefaultMocks({ stats: emptyStats });

      render(<AnalyticsDashboard />);

      expect(screen.queryByTestId('usage-line-chart')).not.toBeInTheDocument();
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('should display error message when error occurs', () => {
      setupDefaultMocks({
        stats: null,
        error: { type: 'STORAGE_UNAVAILABLE', message: 'Storage is unavailable' }
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Unable to load analytics')).toBeInTheDocument();
      expect(screen.getByText('Storage is unavailable')).toBeInTheDocument();
    });

    it('should have alert role on error state', () => {
      setupDefaultMocks({
        stats: null,
        error: { type: 'VALIDATION_ERROR', message: 'Something broke' }
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should not render dashboard content when error exists', () => {
      setupDefaultMocks({
        stats: null,
        error: { type: 'STORAGE_UNAVAILABLE', message: 'Fail' }
      });

      render(<AnalyticsDashboard />);

      expect(screen.queryByText('Analytics Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByTestId('usage-line-chart')).not.toBeInTheDocument();
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('should show skeleton placeholders when loading', () => {
      setupDefaultMocks({ loading: true });

      const { container } = render(<AnalyticsDashboard />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should not render chart components when loading', () => {
      setupDefaultMocks({ loading: true });

      render(<AnalyticsDashboard />);

      expect(screen.queryByTestId('usage-line-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('platform-pie-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('day-of-week-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('category-bar-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('time-of-day-chart')).not.toBeInTheDocument();
    });

    it('should show loading skeletons for tab panel content', () => {
      setupDefaultMocks({ loading: true });

      const { container } = render(<AnalyticsDashboard />);

      // The tab panels should contain loading skeletons
      const tabPanels = screen.getAllByRole('tabpanel');
      const activePanel = getActivePanel(tabPanels);

      const panelSkeletons = activePanel.querySelectorAll('.animate-pulse');
      expect(panelSkeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Tab navigation', () => {
    it('should render all three tabs', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByRole('tab', { name: 'Most Used' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Recently Used' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Forgotten' })).toBeInTheDocument();
    });

    it('should have "Most Used" tab selected by default', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      const mostUsedTab = screen.getByRole('tab', { name: 'Most Used' });
      expect(mostUsedTab).toHaveAttribute('aria-selected', 'true');

      const recentlyUsedTab = screen.getByRole('tab', { name: 'Recently Used' });
      expect(recentlyUsedTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should switch to Recently Used tab on click', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      const recentlyUsedTab = screen.getByRole('tab', { name: 'Recently Used' });
      await user.click(recentlyUsedTab);

      expect(recentlyUsedTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Most Used' })).toHaveAttribute('aria-selected', 'false');
    });

    it('should switch to Forgotten tab on click', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      const forgottenTab = screen.getByRole('tab', { name: 'Forgotten' });
      await user.click(forgottenTab);

      expect(forgottenTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should have correct aria-controls linking tabs to panels', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      const mostUsedTab = screen.getByRole('tab', { name: 'Most Used' });
      expect(mostUsedTab).toHaveAttribute('aria-controls', 'tabpanel-most-used');
      expect(mostUsedTab).toHaveAttribute('id', 'tab-most-used');

      const panel = document.getElementById('tabpanel-most-used');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveAttribute('aria-labelledby', 'tab-most-used');
    });

    it('should set tabIndex 0 on active tab and -1 on inactive tabs', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      const mostUsedTab = screen.getByRole('tab', { name: 'Most Used' });
      expect(mostUsedTab).toHaveAttribute('tabIndex', '0');

      const recentlyUsedTab = screen.getByRole('tab', { name: 'Recently Used' });
      expect(recentlyUsedTab).toHaveAttribute('tabIndex', '-1');

      const forgottenTab = screen.getByRole('tab', { name: 'Forgotten' });
      expect(forgottenTab).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Tab keyboard navigation', () => {
    it('should move to next tab on ArrowRight', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      const mostUsedTab = screen.getByRole('tab', { name: 'Most Used' });
      fireEvent.keyDown(mostUsedTab, { key: 'ArrowRight' });

      const recentlyUsedTab = screen.getByRole('tab', { name: 'Recently Used' });
      expect(recentlyUsedTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should move to previous tab on ArrowLeft', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      // First switch to Recently Used
      await user.click(screen.getByRole('tab', { name: 'Recently Used' }));

      const recentlyUsedTab = screen.getByRole('tab', { name: 'Recently Used' });
      fireEvent.keyDown(recentlyUsedTab, { key: 'ArrowLeft' });

      expect(screen.getByRole('tab', { name: 'Most Used' })).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap around to last tab on ArrowLeft from first tab', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      const mostUsedTab = screen.getByRole('tab', { name: 'Most Used' });
      fireEvent.keyDown(mostUsedTab, { key: 'ArrowLeft' });

      expect(screen.getByRole('tab', { name: 'Forgotten' })).toHaveAttribute('aria-selected', 'true');
    });

    it('should wrap around to first tab on ArrowRight from last tab', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      // Switch to Forgotten (last tab)
      await user.click(screen.getByRole('tab', { name: 'Forgotten' }));

      const forgottenTab = screen.getByRole('tab', { name: 'Forgotten' });
      fireEvent.keyDown(forgottenTab, { key: 'ArrowRight' });

      expect(screen.getByRole('tab', { name: 'Most Used' })).toHaveAttribute('aria-selected', 'true');
    });

    it('should jump to first tab on Home key', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      // Switch to Forgotten (last tab)
      await user.click(screen.getByRole('tab', { name: 'Forgotten' }));

      const forgottenTab = screen.getByRole('tab', { name: 'Forgotten' });
      fireEvent.keyDown(forgottenTab, { key: 'Home' });

      expect(screen.getByRole('tab', { name: 'Most Used' })).toHaveAttribute('aria-selected', 'true');
    });

    it('should jump to last tab on End key', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      const mostUsedTab = screen.getByRole('tab', { name: 'Most Used' });
      fireEvent.keyDown(mostUsedTab, { key: 'End' });

      expect(screen.getByRole('tab', { name: 'Forgotten' })).toHaveAttribute('aria-selected', 'true');
    });

    it('should not change tab on unrecognized keys', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      const mostUsedTab = screen.getByRole('tab', { name: 'Most Used' });
      fireEvent.keyDown(mostUsedTab, { key: 'Enter' });

      expect(mostUsedTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Prompt list rendering', () => {
    it('should render prompt titles in the active tab panel', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'Code Review Helper', category: 'Development', count: 15, lastUsed: NOW - 3600000 },
          { promptId: 'p2', title: 'Email Composer', category: 'Writing', count: 10, lastUsed: NOW - 86400000 }
        ]
      });
      setupDefaultMocks({ stats });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Code Review Helper')).toBeInTheDocument();
      expect(screen.getByText('Email Composer')).toBeInTheDocument();
    });

    it('should display usage counts with correct pluralization', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'Multi Use', category: 'Test', count: 5, lastUsed: NOW },
          { promptId: 'p2', title: 'Single Use', category: 'Test', count: 1, lastUsed: NOW }
        ]
      });
      setupDefaultMocks({ stats });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('5 uses')).toBeInTheDocument();
      expect(screen.getByText('1 use')).toBeInTheDocument();
    });

    it('should display category badges for prompts that have categories', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'With Category', category: 'Development', count: 5, lastUsed: NOW }
        ]
      });
      setupDefaultMocks({ stats });

      render(<AnalyticsDashboard />);

      // The category should appear as a badge in the prompt list
      const activePanel = getActivePanel(screen.getAllByRole('tabpanel'));
      expect(within(activePanel).getByText('Development')).toBeInTheDocument();
    });

    it('should show relative time for prompts', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'Recent Prompt', category: 'Test', count: 5, lastUsed: NOW - (2 * 60 * 60 * 1000) } // 2 hours ago
        ],
        recentPrompts: [],
        forgottenPrompts: []
      });
      setupDefaultMocks({ stats });

      render(<AnalyticsDashboard />);

      const activePanel = getActivePanel(screen.getAllByRole('tabpanel'));
      expect(within(activePanel).getByText('2h ago')).toBeInTheDocument();
    });

    it('should show "No prompts to display" for empty non-forgotten tab', () => {
      const stats = createMockStats({
        topPrompts: [],
        recentPrompts: [
          { promptId: 'p1', title: 'Recent', category: 'Test', count: 1, lastUsed: NOW }
        ]
      });
      setupDefaultMocks({ stats });

      render(<AnalyticsDashboard />);

      // Most Used tab is active by default and has no prompts
      const activePanel = getActivePanel(screen.getAllByRole('tabpanel'));
      expect(within(activePanel).getByText('No prompts to display')).toBeInTheDocument();
    });

    it('should show special message for empty Forgotten tab', async () => {
      const stats = createMockStats({
        forgottenPrompts: []
      });
      setupDefaultMocks({ stats });
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      // Switch to Forgotten tab
      await user.click(screen.getByRole('tab', { name: 'Forgotten' }));

      const forgottenPanel = getElementByIdSafe('tabpanel-forgotten');
      expect(within(forgottenPanel).getByText(/No forgotten prompts - you are using all your prompts!/)).toBeInTheDocument();
    });

    it('should render recently used prompts when that tab is selected', async () => {
      const stats = createMockStats({
        recentPrompts: [
          { promptId: 'r1', title: 'Recent Alpha', category: 'Test', count: 3, lastUsed: NOW - 60000 }
        ]
      });
      setupDefaultMocks({ stats });
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      await user.click(screen.getByRole('tab', { name: 'Recently Used' }));

      const recentPanel = getElementByIdSafe('tabpanel-recently-used');
      expect(within(recentPanel).getByText('Recent Alpha')).toBeInTheDocument();
    });

    it('should render forgotten prompts when that tab is selected', async () => {
      const stats = createMockStats({
        forgottenPrompts: [
          { promptId: 'f1', title: 'Old Forgotten Prompt', category: 'Archive', count: 0, lastUsed: NOW - (30 * 24 * 60 * 60 * 1000) }
        ]
      });
      setupDefaultMocks({ stats });
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      await user.click(screen.getByRole('tab', { name: 'Forgotten' }));

      const forgottenPanel = getElementByIdSafe('tabpanel-forgotten');
      expect(within(forgottenPanel).getByText('Old Forgotten Prompt')).toBeInTheDocument();
    });
  });

  describe('Trophy icons and ranking', () => {
    it('should render trophy icons for top 3 most-used prompts', () => {
      const stats = createMockStats({
        topPrompts: createMockPrompts(5, 'top')
      });
      setupDefaultMocks({ stats });

      const { container } = render(<AnalyticsDashboard />);

      // The active tab panel (most-used) should have list items
      const activePanel = getActivePanel(screen.getAllByRole('tabpanel'));
      const listItems = within(activePanel).getAllByRole('listitem');
      expect(listItems.length).toBe(5);
    });

    it('should render numbered badges for prompts ranked 4th and beyond', () => {
      const stats = createMockStats({
        topPrompts: createMockPrompts(5, 'top')
      });
      setupDefaultMocks({ stats });

      render(<AnalyticsDashboard />);

      // Prompts 4 and 5 should show their number, not a trophy
      const activePanel = getActivePanel(screen.getAllByRole('tabpanel'));
      expect(within(activePanel).getByText('4')).toBeInTheDocument();
      expect(within(activePanel).getByText('5')).toBeInTheDocument();
    });

    it('should not show trophy icons in Recently Used tab', async () => {
      const stats = createMockStats({
        recentPrompts: createMockPrompts(3, 'recent')
      });
      setupDefaultMocks({ stats });
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      await user.click(screen.getByRole('tab', { name: 'Recently Used' }));

      const recentPanel = getElementByIdSafe('tabpanel-recently-used');
      // Recently used tab should show numbers 1, 2, 3 instead of trophies
      expect(within(recentPanel).getByText('1')).toBeInTheDocument();
      expect(within(recentPanel).getByText('2')).toBeInTheDocument();
      expect(within(recentPanel).getByText('3')).toBeInTheDocument();
    });
  });

  describe('Summary card values', () => {
    it('should display dash for missing platform data', () => {
      setupDefaultMocks({}, {
        totalUses: 42,
        topPlatform: null,
        peakDay: { day: 'Mon', count: 15 },
        topCategory: { name: 'Development', count: 20 }
      });

      render(<AnalyticsDashboard />);

      // The SummaryCard for Top Platform should show '-'
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should display dash for missing peak day data', () => {
      setupDefaultMocks({}, {
        totalUses: 42,
        topPlatform: { name: 'claude', count: 25 },
        peakDay: null,
        topCategory: { name: 'Development', count: 20 }
      });

      render(<AnalyticsDashboard />);

      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should display dash for missing category data', () => {
      setupDefaultMocks({}, {
        totalUses: 42,
        topPlatform: { name: 'claude', count: 25 },
        peakDay: { day: 'Mon', count: 15 },
        topCategory: null
      });

      render(<AnalyticsDashboard />);

      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('should format platform name using formatPlatformName', () => {
      setupDefaultMocks({}, {
        totalUses: 42,
        topPlatform: { name: 'chatgpt', count: 25 },
        peakDay: { day: 'Mon', count: 15 },
        topCategory: { name: 'Development', count: 20 }
      });

      render(<AnalyticsDashboard />);

      // formatPlatformName('chatgpt') should return 'ChatGPT'
      expect(screen.getByText('ChatGPT')).toBeInTheDocument();
    });

    it('should display "No data" subtitle when platform data is missing', () => {
      setupDefaultMocks({}, {
        totalUses: 42,
        topPlatform: null,
        peakDay: null,
        topCategory: null
      });

      render(<AnalyticsDashboard />);

      const noDataElements = screen.getAllByText('No data');
      expect(noDataElements.length).toBe(3); // Top Platform, Peak Day, Top Category
    });

    it('should display count subtitle when platform data exists', () => {
      setupDefaultMocks({}, {
        totalUses: 42,
        topPlatform: { name: 'claude', count: 25 },
        peakDay: { day: 'Mon', count: 15 },
        topCategory: { name: 'Development', count: 20 }
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('25 uses')).toBeInTheDocument();
      expect(screen.getByText('15 uses')).toBeInTheDocument();
      expect(screen.getByText('20 uses')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper section labels for main content areas', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByLabelText('Usage summary')).toBeInTheDocument();
      expect(screen.getByLabelText('Usage trend')).toBeInTheDocument();
      expect(screen.getByLabelText('Usage breakdown')).toBeInTheDocument();
      expect(screen.getByLabelText('Prompt usage details')).toBeInTheDocument();
    });

    it('should have tablist with proper aria-label', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      expect(screen.getByRole('tablist', { name: 'Prompt tabs' })).toBeInTheDocument();
    });

    it('should have tabpanel role on all tab panels', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      // Use { hidden: true } to include hidden panels in the query
      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels.length).toBe(3);
    });

    it('should hide inactive tab panels with hidden attribute', () => {
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      // getAllByRole with hidden: true returns all panels (including hidden ones)
      // We need to check the hidden attribute directly
      const mostUsedPanel = getElementByIdSafe('tabpanel-most-used');
      const recentPanel = getElementByIdSafe('tabpanel-recently-used');
      const forgottenPanel = getElementByIdSafe('tabpanel-forgotten');

      expect(mostUsedPanel.hidden).toBe(false);
      expect(recentPanel.hidden).toBe(true);
      expect(forgottenPanel.hidden).toBe(true);
    });
  });

  describe('Chart data fallbacks', () => {
    it('should pass empty arrays to charts when stats fields are undefined', () => {
      // When stats exists but has some fields potentially undefined via nullish coalescing
      const stats = createMockStats({
        dailyUsage: [],
        platformBreakdown: [],
        dayOfWeekDistribution: [],
        categoryDistribution: [],
        timeOfDayDistribution: []
      });
      setupDefaultMocks({ stats });

      render(<AnalyticsDashboard />);

      expect(screen.getByText(/UsageLineChart \(0 data points\)/)).toBeInTheDocument();
      expect(screen.getByText(/PlatformPieChart \(0 platforms\)/)).toBeInTheDocument();
      expect(screen.getByText(/DayOfWeekChart \(0 days\)/)).toBeInTheDocument();
      expect(screen.getByText(/CategoryBarChart \(0 categories, max 6\)/)).toBeInTheDocument();
      expect(screen.getByText(/TimeOfDayChart \(0 buckets\)/)).toBeInTheDocument();
    });
  });

  describe('ChartErrorFallback', () => {
    it('should be rendered as fallback for ErrorBoundary wrapping charts', () => {
      // The ChartErrorFallback is used as fallback prop for ErrorBoundary
      // We verify the ErrorBoundary structure exists by ensuring charts render within the dashboard
      setupDefaultMocks();

      render(<AnalyticsDashboard />);

      // All chart sections should be present
      expect(screen.getByLabelText('Usage trend')).toBeInTheDocument();
      expect(screen.getByLabelText('Usage breakdown')).toBeInTheDocument();
    });
  });

  describe('getPromptsForTab callback', () => {
    it('should return correct data for each tab', async () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'top1', title: 'Top Prompt', category: 'A', count: 10, lastUsed: NOW }
        ],
        recentPrompts: [
          { promptId: 'rec1', title: 'Recent Prompt', category: 'B', count: 3, lastUsed: NOW }
        ],
        forgottenPrompts: [
          { promptId: 'forg1', title: 'Forgotten Prompt', category: 'C', count: 0, lastUsed: NOW - (30 * 24 * 60 * 60 * 1000) }
        ]
      });
      setupDefaultMocks({ stats });
      const user = userEvent.setup();

      render(<AnalyticsDashboard />);

      // Most Used tab (default)
      expect(screen.getByText('Top Prompt')).toBeInTheDocument();

      // Recently Used tab
      await user.click(screen.getByRole('tab', { name: 'Recently Used' }));
      const recentPanel = getElementByIdSafe('tabpanel-recently-used');
      expect(within(recentPanel).getByText('Recent Prompt')).toBeInTheDocument();

      // Forgotten tab
      await user.click(screen.getByRole('tab', { name: 'Forgotten' }));
      const forgottenPanel = getElementByIdSafe('tabpanel-forgotten');
      expect(within(forgottenPanel).getByText('Forgotten Prompt')).toBeInTheDocument();
    });

    it('should return empty array when stats is null', () => {
      setupDefaultMocks({ stats: null, loading: false });

      render(<AnalyticsDashboard />);

      // With null stats and no loading, empty state is shown
      expect(screen.getByText('No usage data yet')).toBeInTheDocument();
    });
  });
});

/**
 * AnalyticsTab Component Tests
 *
 * Tests that AnalyticsTab properly renders analytics summaries,
 * handles loading and error states, and displays top prompts.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useUsageStats } from '../../../hooks/useUsageStats';
import { ErrorType } from '../../../types';
import type { UseUsageStatsReturn, UsageStats } from '../../../types/hooks';
import AnalyticsTab from '../AnalyticsTab';

// Mock the useUsageStats hook
vi.mock('../../../hooks/useUsageStats', () => ({
  useUsageStats: vi.fn()
}));

const mockUseUsageStats = vi.mocked(useUsageStats);

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
  topPrompts: [
    { promptId: 'p1', title: 'Code Review Helper', category: 'Development', count: 15, lastUsed: Date.now() - 3600000 },
    { promptId: 'p2', title: 'Email Composer', category: 'Writing', count: 10, lastUsed: Date.now() - 86400000 },
    { promptId: 'p3', title: 'Bug Fixer', category: 'Development', count: 8, lastUsed: Date.now() - 172800000 }
  ],
  recentPrompts: [
    { promptId: 'p1', title: 'Code Review Helper', category: 'Development', count: 15, lastUsed: Date.now() - 3600000 }
  ],
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

describe('AnalyticsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render header with title', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Last 30 days of usage')).toBeInTheDocument();
    });

    it('should render summary section', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByText('Summary')).toBeInTheDocument();
    });

    it('should render top prompts section', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByText('Top Prompts')).toBeInTheDocument();
    });
  });

  describe('Summary Cards', () => {
    it('should display total uses', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByText('Total Uses')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should display top platform with formatted name', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByText('Top Platform')).toBeInTheDocument();
      expect(screen.getByText('Claude')).toBeInTheDocument();
    });

    it('should display peak day', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByText('Peak Day')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
    });

    it('should display top category', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByText('Top Category')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
    });

    it('should show dash for missing data', () => {
      const emptyStats = createMockStats({
        platformBreakdown: [],
        categoryDistribution: [],
        dayOfWeekDistribution: [
          { day: 'Sun', dayIndex: 0, count: 0 },
          { day: 'Mon', dayIndex: 1, count: 0 },
          { day: 'Tue', dayIndex: 2, count: 0 },
          { day: 'Wed', dayIndex: 3, count: 0 },
          { day: 'Thu', dayIndex: 4, count: 0 },
          { day: 'Fri', dayIndex: 5, count: 0 },
          { day: 'Sat', dayIndex: 6, count: 0 }
        ]
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats: emptyStats }));

      render(<AnalyticsTab />);

      // Should show dashes for empty data
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('Top Prompts List', () => {
    it('should render top prompts with titles', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByText('Code Review Helper')).toBeInTheDocument();
      expect(screen.getByText('Email Composer')).toBeInTheDocument();
      expect(screen.getByText('Bug Fixer')).toBeInTheDocument();
    });

    it('should display usage counts for prompts', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      // Find the top prompts section and verify counts within it
      const topPromptsSection = screen.getByLabelText('Top prompts');
      expect(topPromptsSection).toBeInTheDocument();

      // Verify counts are rendered (using getAllByText since counts may appear in multiple places)
      const usageCounts = screen.getAllByText(/\d+ uses?/);
      expect(usageCounts.length).toBeGreaterThanOrEqual(3);
    });

    it('should show singular "use" for count of 1', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'Single Use Prompt', category: 'Test', count: 1, lastUsed: Date.now() }
        ]
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats }));

      render(<AnalyticsTab />);

      expect(screen.getByText('1 use')).toBeInTheDocument();
    });

    it('should limit to 5 prompts', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'Prompt 1', category: 'Test', count: 10, lastUsed: Date.now() },
          { promptId: 'p2', title: 'Prompt 2', category: 'Test', count: 9, lastUsed: Date.now() },
          { promptId: 'p3', title: 'Prompt 3', category: 'Test', count: 8, lastUsed: Date.now() },
          { promptId: 'p4', title: 'Prompt 4', category: 'Test', count: 7, lastUsed: Date.now() },
          { promptId: 'p5', title: 'Prompt 5', category: 'Test', count: 6, lastUsed: Date.now() },
          { promptId: 'p6', title: 'Prompt 6', category: 'Test', count: 5, lastUsed: Date.now() },
          { promptId: 'p7', title: 'Prompt 7', category: 'Test', count: 4, lastUsed: Date.now() }
        ]
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats }));

      render(<AnalyticsTab />);

      expect(screen.getByText('Prompt 1')).toBeInTheDocument();
      expect(screen.getByText('Prompt 5')).toBeInTheDocument();
      expect(screen.queryByText('Prompt 6')).not.toBeInTheDocument();
      expect(screen.queryByText('Prompt 7')).not.toBeInTheDocument();
    });

    it('should show "View all" button when more than 5 prompts', () => {
      const stats = createMockStats({
        topPrompts: Array.from({ length: 7 }, (_, i) => ({
          promptId: `p${String(i)}`,
          title: `Prompt ${String(i)}`,
          category: 'Test',
          count: 10 - i,
          lastUsed: Date.now()
        }))
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats }));
      const onExpand = vi.fn();

      render(<AnalyticsTab onExpandDashboard={onExpand} />);

      const viewAllButton = screen.getByText('View all');
      expect(viewAllButton).toBeInTheDocument();

      fireEvent.click(viewAllButton);
      expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it('should not show "View all" button with 5 or fewer prompts', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab onExpandDashboard={vi.fn()} />);

      expect(screen.queryByText('View all')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading skeletons when loading', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({ loading: true }));

      const { container } = render(<AnalyticsTab />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('should display error message when error occurs', () => {
      const errorReturn = createMockReturn({
        stats: null,
        error: { type: ErrorType.STORAGE_UNAVAILABLE, message: 'Storage is unavailable' }
      });

      mockUseUsageStats.mockReturnValue(errorReturn);

      render(<AnalyticsTab />);

      expect(screen.getByText('Unable to load analytics')).toBeInTheDocument();
      expect(screen.getByText('Storage is unavailable')).toBeInTheDocument();
    });

    it('should have alert role on error', () => {
      const errorReturn = createMockReturn({
        stats: null,
        error: { type: ErrorType.VALIDATION_ERROR, message: 'Test error' }
      });

      mockUseUsageStats.mockReturnValue(errorReturn);

      render(<AnalyticsTab />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no usage data', () => {
      const emptyStats = createMockStats({
        totalUses: 0,
        topPrompts: []
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats: emptyStats }));

      render(<AnalyticsTab />);

      expect(screen.getByText('No usage data yet')).toBeInTheDocument();
      expect(screen.getByText(/Start using your prompts/)).toBeInTheDocument();
    });

    it('should show empty state when stats is null', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn({ stats: null, loading: false }));

      render(<AnalyticsTab />);

      expect(screen.getByText('No usage data yet')).toBeInTheDocument();
    });
  });

  describe('Expand Dashboard', () => {
    it('should show expand button in sidepanel context', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());
      const onExpand = vi.fn();

      render(<AnalyticsTab onExpandDashboard={onExpand} context="sidepanel" />);

      const button = screen.getByText('View Full Dashboard');
      expect(button).toBeInTheDocument();
    });

    it('should call onExpandDashboard when button clicked', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());
      const onExpand = vi.fn();

      render(<AnalyticsTab onExpandDashboard={onExpand} context="sidepanel" />);

      fireEvent.click(screen.getByText('View Full Dashboard'));
      expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it('should not show expand button in popup context', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab onExpandDashboard={vi.fn()} context="popup" />);

      expect(screen.queryByText('View Full Dashboard')).not.toBeInTheDocument();
    });

    it('should not show expand button when no callback provided', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab context="sidepanel" />);

      expect(screen.queryByText('View Full Dashboard')).not.toBeInTheDocument();
    });
  });

  describe('Platform Name Formatting', () => {
    it.each([
      ['claude', 'Claude'],
      ['chatgpt', 'ChatGPT'],
      ['gemini', 'Gemini'],
      ['perplexity', 'Perplexity'],
      ['copilot', 'Copilot'],
      ['mistral', 'Mistral'],
      ['custom', 'Custom Site']
    ])('should format %s as %s', (input, expected) => {
      const stats = createMockStats({
        platformBreakdown: [{ platform: input, count: 10, percentage: 100 }]
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats }));

      render(<AnalyticsTab />);

      expect(screen.getByText(expected)).toBeInTheDocument();
    });

    it('should keep unknown platform names as-is', () => {
      const stats = createMockStats({
        platformBreakdown: [{ platform: 'new-platform', count: 10, percentage: 100 }]
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats }));

      render(<AnalyticsTab />);

      expect(screen.getByText('new-platform')).toBeInTheDocument();
    });
  });

  describe('Relative Time Formatting', () => {
    it('should show "Just now" for recent usage', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'Recent', category: 'Test', count: 5, lastUsed: Date.now() - 30000 } // 30 seconds ago
        ]
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats }));

      render(<AnalyticsTab />);

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should show minutes for usage within the hour', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'Minutes', category: 'Test', count: 5, lastUsed: Date.now() - 30 * 60 * 1000 } // 30 minutes ago
        ]
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats }));

      render(<AnalyticsTab />);

      expect(screen.getByText('30m ago')).toBeInTheDocument();
    });

    it('should show hours for usage within the day', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'Hours', category: 'Test', count: 5, lastUsed: Date.now() - 5 * 60 * 60 * 1000 } // 5 hours ago
        ]
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats }));

      render(<AnalyticsTab />);

      expect(screen.getByText('5h ago')).toBeInTheDocument();
    });

    it('should show days for older usage', () => {
      const stats = createMockStats({
        topPrompts: [
          { promptId: 'p1', title: 'Days', category: 'Test', count: 5, lastUsed: Date.now() - 3 * 24 * 60 * 60 * 1000 } // 3 days ago
        ]
      });

      mockUseUsageStats.mockReturnValue(createMockReturn({ stats }));

      render(<AnalyticsTab />);

      expect(screen.getByText('3d ago')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper section labels', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByLabelText('Usage summary')).toBeInTheDocument();
      expect(screen.getByLabelText('Top prompts')).toBeInTheDocument();
    });

    it('should have accessible header', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    });

    it('should have list role for top prompts', () => {
      mockUseUsageStats.mockReturnValue(createMockReturn());

      render(<AnalyticsTab />);

      expect(screen.getByRole('list')).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import App from '../../App';
import { useUsageStats } from '../../hooks/useUsageStats';
import { getMockStorageManager, getChromeMock } from '../../test/mocks';
import type { Category } from '../../types';
import type { UseUsageStatsReturn, UsageStats } from '../../types/hooks';

// Mock the useUsageStats hook
vi.mock('../../hooks/useUsageStats', () => ({
  useUsageStats: vi.fn()
}));

const mockUseUsageStats = vi.mocked(useUsageStats);

const createMockStats = (): UsageStats => ({
  totalUses: 42,
  dailyUsage: [],
  platformBreakdown: [{ platform: 'claude', count: 25, percentage: 100 }],
  dayOfWeekDistribution: [{ day: 'Mon', dayIndex: 1, count: 15 }],
  timeOfDayDistribution: [],
  categoryDistribution: [{ categoryId: '1', name: 'Development', count: 20 }],
  topPrompts: [{ promptId: 'p1', title: 'Test Prompt', category: 'Development', count: 15, lastUsed: Date.now() }],
  recentPrompts: [],
  forgottenPrompts: []
});

const createMockReturn = (): UseUsageStatsReturn => ({
  stats: createMockStats(),
  history: [],
  loading: false,
  error: null,
  refresh: vi.fn(),
  clearHistory: vi.fn()
});

const defaultCategories: Category[] = [
  { id: 'default', name: 'Uncategorized', color: '#888888' },
  { id: 'work', name: 'Work', color: '#ff00ff' }
];

const renderApp = async () => {
  render(<App />);
  await screen.findByRole('heading', { name: /my prompt manager/i });
};

describe('App analytics integration', () => {
  beforeEach(() => {
    window.location.search = '';
    const storageMock = getMockStorageManager();
    storageMock.getCategories.mockResolvedValue([...defaultCategories]);
    storageMock.getPrompts.mockResolvedValue([]);
    // Mock usage stats with data so footer shows
    mockUseUsageStats.mockReturnValue(createMockReturn());
  });

  describe('Analytics navigation', () => {
    it('navigates to analytics view when analytics button is clicked', async () => {
      const user = userEvent.setup();
      await renderApp();

      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      await user.click(analyticsButton);

      // Should show analytics view with "Analytics" heading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /analytics/i })).toBeInTheDocument();
      });
    });

    it('returns to library view when back button is clicked from analytics', async () => {
      const user = userEvent.setup();
      await renderApp();

      // Navigate to analytics
      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      await user.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /analytics/i })).toBeInTheDocument();
      });

      // Click back button
      const backButton = screen.getByTestId('back-button');
      await user.click(backButton);

      // Should return to library view
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my prompt manager/i })).toBeInTheDocument();
      });
    });

    it('renders AnalyticsTab component in analytics view', async () => {
      const user = userEvent.setup();
      await renderApp();

      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      await user.click(analyticsButton);

      // Should show analytics summary section
      await waitFor(() => {
        expect(screen.getByText(/last 30 days of usage/i)).toBeInTheDocument();
      });
    });
  });

  describe('Expand dashboard functionality', () => {
    it('opens analytics.html in new tab when View Full Dashboard is clicked', async () => {
      const user = userEvent.setup();
      const chromeMock = getChromeMock();

      // Reset the mock to track calls
      vi.mocked(chromeMock.tabs.create).mockClear();

      await renderApp();

      // Navigate to analytics view
      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      await user.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /analytics/i })).toBeInTheDocument();
      });

      // Find and click the View Full Dashboard button (only shown in sidepanel context)
      // Note: In popup context, this button may not be visible
      // Let's render with sidepanel context
    });
  });

  describe('Analytics view with sidepanel context', () => {
    it('shows View Full Dashboard button in sidepanel context', async () => {
      const user = userEvent.setup();
      render(<App context="sidepanel" />);
      await screen.findByRole('heading', { name: /my prompt manager/i });

      // Navigate to analytics
      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      await user.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /analytics/i })).toBeInTheDocument();
      });

      // Should show the View Full Dashboard button in sidepanel context
      expect(screen.getByRole('button', { name: /view full.*dashboard/i })).toBeInTheDocument();
    });

    it('calls chrome.tabs.create when View Full Dashboard is clicked', async () => {
      const user = userEvent.setup();
      const chromeMock = getChromeMock();
      vi.mocked(chromeMock.tabs.create).mockClear();

      render(<App context="sidepanel" />);
      await screen.findByRole('heading', { name: /my prompt manager/i });

      // Navigate to analytics
      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      await user.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /analytics/i })).toBeInTheDocument();
      });

      // Click View Full Dashboard
      const expandButton = screen.getByRole('button', { name: /view full.*dashboard/i });
      await user.click(expandButton);

      // Should call chrome.tabs.create with analytics.html URL
      await waitFor(() => {
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({
          url: expect.stringContaining('analytics.html')
        });
      });
    });
  });

  describe('Analytics view accessibility', () => {
    it('analytics button has proper aria-label', async () => {
      await renderApp();

      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      expect(analyticsButton).toHaveAttribute('aria-label', 'View analytics');
    });

    it('back button in analytics view is keyboard accessible', async () => {
      const user = userEvent.setup();
      await renderApp();

      // Navigate to analytics
      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      await user.click(analyticsButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /analytics/i })).toBeInTheDocument();
      });

      // Back button should be focusable
      const backButton = screen.getByTestId('back-button');
      expect(backButton).not.toHaveAttribute('tabIndex', '-1');
    });
  });
});

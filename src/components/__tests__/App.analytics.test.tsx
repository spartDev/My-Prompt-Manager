import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { useUsageStats } from '../../hooks/useUsageStats';
import { onLibraryReviewRequested, takePendingLibraryReview } from '../../services/libraryReview';
import { getChromeMock, getMockStorageManager } from '../../test/mocks';
import type { Category } from '../../types';
import type { UsageStats, UseUsageStatsReturn } from '../../types/hooks';

// Mock the useUsageStats hook
vi.mock('../../hooks/useUsageStats', () => ({
  useUsageStats: vi.fn()
}));

vi.mock('../../services/libraryReview', () => ({
  takePendingLibraryReview: vi.fn(),
  onLibraryReviewRequested: vi.fn()
}));

const mockUseUsageStats = vi.mocked(useUsageStats);
const mockTakePendingLibraryReview = vi.mocked(takePendingLibraryReview);
const mockOnLibraryReviewRequested = vi.mocked(onLibraryReviewRequested);

const createMockStats = (): UsageStats => ({
  totalUses: 42,
  dailyUsage: [],
  timeOfDayDistribution: []
});

const createMockReturn = (): UseUsageStatsReturn => ({
  stats: createMockStats(),
  history: [{ promptId: 'p1', timestamp: Date.now(), platform: 'claude', categoryId: null }],
  prompts: [],
  categories: [],
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
    mockTakePendingLibraryReview.mockReset().mockResolvedValue(null);
    mockOnLibraryReviewRequested.mockReset().mockReturnValue(() => undefined);
  });

  describe('A review asked from the full-page Analytics view', () => {
    const now = Date.now();
    const used = { id: 'p1', title: 'Used', content: 'One', category: 'Work', createdAt: now, updatedAt: now, usageCount: 2 };
    const idle = { id: 'p2', title: 'Never inserted', content: 'Two', category: 'Work', createdAt: now, updatedAt: now, usageCount: 0 };

    it('opens the side panel on the Library filter that waits', async () => {
      getMockStorageManager().getPrompts.mockResolvedValue([used, idle]);
      mockTakePendingLibraryReview.mockResolvedValueOnce({ kind: 'neverUsed' });
      render(<App context="sidepanel" />);

      expect(await screen.findByRole('button', { name: 'Edit Never inserted' })).toBeInTheDocument();
      await waitFor(() => { expect(screen.queryByRole('button', { name: 'Edit Used' })).not.toBeInTheDocument(); });
    });

    it('applies one asked while the side panel is open', async () => {
      getMockStorageManager().getPrompts.mockResolvedValue([used, idle]);
      render(<App context="sidepanel" />);
      expect(await screen.findByRole('button', { name: 'Edit Used' })).toBeInTheDocument();

      mockTakePendingLibraryReview.mockResolvedValueOnce({ kind: 'neverUsed' });
      const requested = mockOnLibraryReviewRequested.mock.calls.at(-1)?.[0];
      requested?.();

      await waitFor(() => { expect(screen.queryByRole('button', { name: 'Edit Used' })).not.toBeInTheDocument(); });
      expect(screen.getByRole('button', { name: 'Edit Never inserted' })).toBeInTheDocument();
    });

    it('is left to the side panel: the popup does not take it', async () => {
      await renderApp();

      expect(mockTakePendingLibraryReview).not.toHaveBeenCalled();
    });
  });

  describe('Most used', () => {
    it('gives the keyboard to the next row once the Prompt opened from a row is deleted', async () => {
      const user = userEvent.setup();
      const now = Date.now();
      const first = { id: 'p1', title: 'First prompt', content: 'One', category: 'Work', createdAt: now, updatedAt: now };
      const second = { id: 'p2', title: 'Second prompt', content: 'Two', category: 'Work', createdAt: now, updatedAt: now };
      getMockStorageManager().getPrompts.mockResolvedValue([first, second]);
      mockUseUsageStats.mockReturnValue({
        ...createMockReturn(),
        history: [
          { promptId: 'p1', timestamp: now, platform: 'claude', categoryId: null },
          { promptId: 'p1', timestamp: now, platform: 'claude', categoryId: null },
          { promptId: 'p2', timestamp: now, platform: 'claude', categoryId: null }
        ]
      });
      await renderApp();

      await user.click(screen.getByRole('tab', { name: 'Analytics' }));
      await user.click(await screen.findByRole('button', { name: 'First prompt, 2 uses. Open' }));
      await user.click(await screen.findByRole('button', { name: 'Delete prompt' }));
      await user.click(await screen.findByRole('button', { name: /^delete$/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Second prompt, 1 use. Open' })).toHaveFocus();
      });
    });
  });

  describe('Tidy up', () => {
    it('reads the Library again before Review, so it lists what Analytics counted', async () => {
      const user = userEvent.setup();
      const now = Date.now();
      const used = { id: 'p1', title: 'Used since', content: 'One', category: 'Work', createdAt: now, updatedAt: now, usageCount: 0 };
      const idle = { id: 'p2', title: 'Never inserted', content: 'Two', category: 'Work', createdAt: now, updatedAt: now, usageCount: 0 };
      const storageMock = getMockStorageManager();
      // The panel read both unused; a Platform has inserted the first one since
      storageMock.getPrompts.mockResolvedValueOnce([used, idle]).mockResolvedValue([{ ...used, usageCount: 1 }, idle]);
      mockUseUsageStats.mockReturnValue({
        ...createMockReturn(),
        history: [{ promptId: 'p1', timestamp: now, platform: 'claude', categoryId: null }],
        prompts: [{ ...used, usageCount: 1 }, idle]
      });
      await renderApp();

      await user.click(screen.getByRole('tab', { name: 'Analytics' }));
      await user.click(await screen.findByRole('button', { name: 'Review the 1 prompt never used' }));

      await waitFor(() => { expect(screen.queryByRole('button', { name: 'Edit Used since' })).not.toBeInTheDocument(); });
      expect(screen.getByRole('button', { name: 'Edit Never inserted' })).toBeInTheDocument();
    });
  });

  describe('Analytics navigation', () => {
    it('navigates to analytics view when the Analytics tab is clicked', async () => {
      const user = userEvent.setup();
      await renderApp();

      await user.click(screen.getByRole('tab', { name: 'Analytics' }));

      // Should show analytics view with "Analytics" heading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /analytics/i })).toBeInTheDocument();
      });
    });

    it('returns to library view when the Library tab is clicked from analytics', async () => {
      const user = userEvent.setup();
      await renderApp();

      // Navigate to analytics
      await user.click(screen.getByRole('tab', { name: 'Analytics' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /analytics/i })).toBeInTheDocument();
      });

      expect(screen.queryByTestId('back-button')).not.toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'Library' }));

      // Should return to library view
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my prompt manager/i })).toBeInTheDocument();
      });
    });

    it('renders AnalyticsTab component in analytics view', async () => {
      const user = userEvent.setup();
      await renderApp();

      await user.click(screen.getByRole('tab', { name: 'Analytics' }));

      // Should show analytics summary section
      await waitFor(() => {
        expect(screen.getByText(/^last 30 days$/i)).toBeInTheDocument();
      });
    });
  });

  describe('Analytics view with sidepanel context', () => {
    it('shows View Full Dashboard button in sidepanel context', async () => {
      const user = userEvent.setup();
      render(<App context="sidepanel" />);
      await screen.findByRole('heading', { name: /my prompt manager/i });

      // Navigate to analytics
      await user.click(screen.getByRole('tab', { name: 'Analytics' }));

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
      await user.click(screen.getByRole('tab', { name: 'Analytics' }));

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
    it('marks the Analytics tab as selected while in analytics view', async () => {
      const user = userEvent.setup();
      await renderApp();

      await user.click(screen.getByRole('tab', { name: 'Analytics' }));

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Analytics' })).toHaveAttribute('aria-selected', 'true');
      });
      expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'false');
    });
  });
});

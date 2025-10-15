import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AnalyticsManager } from '../../services/analyticsManager';
import { AnalyticsView } from '../AnalyticsView';

// Mock the AnalyticsManager
vi.mock('../../services/analyticsManager', () => {
  const mockInstance = {
    getComputedStats: vi.fn(),
    getData: vi.fn()
  };

  return {
    AnalyticsManager: {
      getInstance: vi.fn(() => mockInstance)
    }
  };
});

describe('AnalyticsView', () => {
  const mockAnalyticsManager = AnalyticsManager.getInstance();

  beforeEach(() => {
    vi.clearAllMocks();

    (mockAnalyticsManager.getComputedStats as any).mockResolvedValue({
      totalInsertions: 42,
      currentStreak: 7,
      longestStreak: 14,
      mostUsedPrompt: { id: 'p1', title: 'Test Prompt', count: 10 },
      mostActivePlatform: { name: 'claude', count: 25, percentage: 60 },
      weeklyActivity: [
        { day: 'Mon', count: 5 },
        { day: 'Tue', count: 8 }
      ],
      platformDistribution: [
        { platform: 'claude', count: 25, percentage: 60 }
      ],
      categoryBreakdown: [
        { categoryId: 'cat1', name: 'Work', count: 20 }
      ]
    });
  });

  it('should render stats overview cards', async () => {
    render(<AnalyticsView onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('7 days')).toBeInTheDocument();
    });
  });

  it('should display empty state when no data', async () => {
    (mockAnalyticsManager.getComputedStats as any).mockResolvedValue({
      totalInsertions: 0,
      currentStreak: 0,
      longestStreak: 0,
      mostUsedPrompt: null,
      mostActivePlatform: null,
      weeklyActivity: [],
      platformDistribution: [],
      categoryBreakdown: []
    });

    render(<AnalyticsView onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Start Building Your Stats/i)).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<AnalyticsView onBack={vi.fn()} />);

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('should display error state with retry button', async () => {
    (mockAnalyticsManager.getComputedStats as any).mockRejectedValue(
      new Error('Failed to load')
    );

    render(<AnalyticsView onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load analytics data/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('should call onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    render(<AnalyticsView onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    const backButton = screen.getByLabelText(/go back/i);
    backButton.click();

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

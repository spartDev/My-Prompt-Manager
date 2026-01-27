/**
 * Chart Components Tests
 *
 * Tests for all analytics chart components including UsageLineChart,
 * PlatformPieChart, DayOfWeekChart, CategoryBarChart, and TimeOfDayChart.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach, Mock } from 'vitest';

import { ThemeProvider } from '../../../../contexts/ThemeContext';
import { getChromeMockFunctions, getMockStorageManager } from '../../../../test/mocks';
import { DEFAULT_SETTINGS } from '../../../../types';
import CategoryBarChart from '../CategoryBarChart';
import DayOfWeekChart from '../DayOfWeekChart';
import PlatformPieChart from '../PlatformPieChart';
import TimeOfDayChart from '../TimeOfDayChart';
import UsageLineChart from '../UsageLineChart';

// Mock ResizeObserver as a proper class
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

// Helper to render chart components with ThemeProvider
const renderWithTheme = async (ui: React.ReactElement, theme: 'light' | 'dark' = 'light') => {
  const chromeMock = getChromeMockFunctions();
  const storageMock = getMockStorageManager();

  (chromeMock.storage.local.get as Mock).mockResolvedValue({
    settings: { ...DEFAULT_SETTINGS, theme }
  });

  storageMock.getSettings.mockResolvedValue({
    ...DEFAULT_SETTINGS,
    theme
  });

  const result = render(
    <ThemeProvider>
      {ui}
    </ThemeProvider>
  );

  // Wait for theme initialization
  await waitFor(() => {
    expect(storageMock.getSettings).toHaveBeenCalled();
  });

  return result;
};

beforeEach(() => {
  const chromeMock = getChromeMockFunctions();
  (chromeMock.tabs.query as Mock).mockResolvedValue([]);
});

describe('UsageLineChart', () => {
  const mockData = [
    { date: '2026-01-11', count: 5 },
    { date: '2026-01-12', count: 10 },
    { date: '2026-01-13', count: 8 }
  ];

  it('should render with data', async () => {
    await renderWithTheme(<UsageLineChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /usage trend chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', async () => {
    await renderWithTheme(<UsageLineChart data={[]} />);

    expect(screen.getByText('No usage data')).toBeInTheDocument();
  });

  it('should render with custom height', async () => {
    const { container } = await renderWithTheme(<UsageLineChart data={mockData} height={300} />);

    // ResponsiveContainer should exist
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('should render without grid when showGrid is false', async () => {
    await renderWithTheme(<UsageLineChart data={mockData} showGrid={false} />);

    const chart = screen.getByRole('img', { name: /usage trend chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should adapt to dark mode from theme context', async () => {
    await renderWithTheme(<UsageLineChart data={mockData} />, 'dark');

    const chart = screen.getByRole('img', { name: /usage trend chart/i });
    expect(chart).toBeInTheDocument();
  });
});

describe('PlatformPieChart', () => {
  const mockData = [
    { platform: 'claude', count: 20, percentage: 50 },
    { platform: 'chatgpt', count: 12, percentage: 30 },
    { platform: 'gemini', count: 8, percentage: 20 }
  ];

  it('should render with data', async () => {
    await renderWithTheme(<PlatformPieChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /platform breakdown chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', async () => {
    await renderWithTheme(<PlatformPieChart data={[]} />);

    expect(screen.getByText('No platform data')).toBeInTheDocument();
  });

  it('should hide legend when showLegend is false', async () => {
    await renderWithTheme(<PlatformPieChart data={mockData} showLegend={false} />);

    const chart = screen.getByRole('img', { name: /platform breakdown chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should adapt to dark mode from theme context', async () => {
    await renderWithTheme(<PlatformPieChart data={mockData} />, 'dark');

    const chart = screen.getByRole('img', { name: /platform breakdown chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should handle unknown platforms', async () => {
    const dataWithUnknown = [
      { platform: 'new-platform', count: 10, percentage: 100 }
    ];

    await renderWithTheme(<PlatformPieChart data={dataWithUnknown} />);

    const chart = screen.getByRole('img', { name: /platform breakdown chart/i });
    expect(chart).toBeInTheDocument();
  });
});

describe('DayOfWeekChart', () => {
  const mockData = [
    { day: 'Sun', dayIndex: 0, count: 3 },
    { day: 'Mon', dayIndex: 1, count: 15 },
    { day: 'Tue', dayIndex: 2, count: 10 },
    { day: 'Wed', dayIndex: 3, count: 8 },
    { day: 'Thu', dayIndex: 4, count: 12 },
    { day: 'Fri', dayIndex: 5, count: 6 },
    { day: 'Sat', dayIndex: 6, count: 4 }
  ];

  it('should render with data', async () => {
    await renderWithTheme(<DayOfWeekChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /day of week usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', async () => {
    await renderWithTheme(<DayOfWeekChart data={[]} />);

    expect(screen.getByText('No day of week data')).toBeInTheDocument();
  });

  it('should not highlight peak when highlightPeak is false', async () => {
    await renderWithTheme(<DayOfWeekChart data={mockData} highlightPeak={false} />);

    const chart = screen.getByRole('img', { name: /day of week usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should adapt to dark mode from theme context', async () => {
    await renderWithTheme(<DayOfWeekChart data={mockData} />, 'dark');

    const chart = screen.getByRole('img', { name: /day of week usage chart/i });
    expect(chart).toBeInTheDocument();
  });
});

describe('CategoryBarChart', () => {
  const mockData = [
    { categoryId: '1', name: 'Development', count: 25 },
    { categoryId: '2', name: 'Writing', count: 18 },
    { categoryId: '3', name: 'Marketing', count: 12 },
    { categoryId: '4', name: 'Design', count: 8 }
  ];

  it('should render with data', async () => {
    await renderWithTheme(<CategoryBarChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /category usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', async () => {
    await renderWithTheme(<CategoryBarChart data={[]} />);

    expect(screen.getByText('No category data')).toBeInTheDocument();
  });

  it('should limit categories when maxCategories is set', async () => {
    const manyCategories = [
      { categoryId: '1', name: 'Cat 1', count: 10 },
      { categoryId: '2', name: 'Cat 2', count: 9 },
      { categoryId: '3', name: 'Cat 3', count: 8 },
      { categoryId: '4', name: 'Cat 4', count: 7 },
      { categoryId: '5', name: 'Cat 5', count: 6 },
      { categoryId: '6', name: 'Cat 6', count: 5 }
    ];

    await renderWithTheme(<CategoryBarChart data={manyCategories} maxCategories={3} />);

    const chart = screen.getByRole('img', { name: /category usage chart showing 3 categories/i });
    expect(chart).toBeInTheDocument();
  });

  it('should adapt to dark mode from theme context', async () => {
    await renderWithTheme(<CategoryBarChart data={mockData} />, 'dark');

    const chart = screen.getByRole('img', { name: /category usage chart/i });
    expect(chart).toBeInTheDocument();
  });
});

describe('TimeOfDayChart', () => {
  const mockData = [
    { bucket: 'Morning', count: 15 },
    { bucket: 'Afternoon', count: 25 },
    { bucket: 'Evening', count: 12 },
    { bucket: 'Night', count: 5 }
  ];

  it('should render with data', async () => {
    await renderWithTheme(<TimeOfDayChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /time of day usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', async () => {
    await renderWithTheme(<TimeOfDayChart data={[]} />);

    expect(screen.getByText('No time of day data')).toBeInTheDocument();
  });

  it('should not highlight peak when highlightPeak is false', async () => {
    await renderWithTheme(<TimeOfDayChart data={mockData} highlightPeak={false} />);

    const chart = screen.getByRole('img', { name: /time of day usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should adapt to dark mode from theme context', async () => {
    await renderWithTheme(<TimeOfDayChart data={mockData} />, 'dark');

    const chart = screen.getByRole('img', { name: /time of day usage chart/i });
    expect(chart).toBeInTheDocument();
  });
});

describe('Chart Accessibility', () => {
  it('UsageLineChart should have accessible aria-label', async () => {
    const data = [{ date: '2026-01-13', count: 5 }];
    await renderWithTheme(<UsageLineChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });

  it('PlatformPieChart should have accessible aria-label', async () => {
    const data = [{ platform: 'claude', count: 10, percentage: 100 }];
    await renderWithTheme(<PlatformPieChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });

  it('DayOfWeekChart should have accessible aria-label', async () => {
    const data = [{ day: 'Mon', dayIndex: 1, count: 5 }];
    await renderWithTheme(<DayOfWeekChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });

  it('CategoryBarChart should have accessible aria-label', async () => {
    const data = [{ categoryId: '1', name: 'Test', count: 5 }];
    await renderWithTheme(<CategoryBarChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });

  it('TimeOfDayChart should have accessible aria-label', async () => {
    const data = [{ bucket: 'Morning', count: 5 }];
    await renderWithTheme(<TimeOfDayChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });
});

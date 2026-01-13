/**
 * Chart Components Tests
 *
 * Tests for all analytics chart components including UsageLineChart,
 * PlatformPieChart, DayOfWeekChart, CategoryBarChart, and TimeOfDayChart.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

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

describe('UsageLineChart', () => {
  const mockData = [
    { date: '2026-01-11', count: 5 },
    { date: '2026-01-12', count: 10 },
    { date: '2026-01-13', count: 8 }
  ];

  it('should render with data', () => {
    render(<UsageLineChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /usage trend chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<UsageLineChart data={[]} />);

    expect(screen.getByText('No usage data')).toBeInTheDocument();
  });

  it('should render with custom height', () => {
    const { container } = render(<UsageLineChart data={mockData} height={300} />);

    // ResponsiveContainer should exist
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument();
  });

  it('should render without grid when showGrid is false', () => {
    render(<UsageLineChart data={mockData} showGrid={false} />);

    const chart = screen.getByRole('img', { name: /usage trend chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should support dark mode', () => {
    render(<UsageLineChart data={mockData} isDarkMode={true} />);

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

  it('should render with data', () => {
    render(<PlatformPieChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /platform breakdown chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<PlatformPieChart data={[]} />);

    expect(screen.getByText('No platform data')).toBeInTheDocument();
  });

  it('should hide legend when showLegend is false', () => {
    render(<PlatformPieChart data={mockData} showLegend={false} />);

    const chart = screen.getByRole('img', { name: /platform breakdown chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should support dark mode', () => {
    render(<PlatformPieChart data={mockData} isDarkMode={true} />);

    const chart = screen.getByRole('img', { name: /platform breakdown chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should handle unknown platforms', () => {
    const dataWithUnknown = [
      { platform: 'new-platform', count: 10, percentage: 100 }
    ];

    render(<PlatformPieChart data={dataWithUnknown} />);

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

  it('should render with data', () => {
    render(<DayOfWeekChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /day of week usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<DayOfWeekChart data={[]} />);

    expect(screen.getByText('No day of week data')).toBeInTheDocument();
  });

  it('should not highlight peak when highlightPeak is false', () => {
    render(<DayOfWeekChart data={mockData} highlightPeak={false} />);

    const chart = screen.getByRole('img', { name: /day of week usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should support dark mode', () => {
    render(<DayOfWeekChart data={mockData} isDarkMode={true} />);

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

  it('should render with data', () => {
    render(<CategoryBarChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /category usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<CategoryBarChart data={[]} />);

    expect(screen.getByText('No category data')).toBeInTheDocument();
  });

  it('should limit categories when maxCategories is set', () => {
    const manyCategories = [
      { categoryId: '1', name: 'Cat 1', count: 10 },
      { categoryId: '2', name: 'Cat 2', count: 9 },
      { categoryId: '3', name: 'Cat 3', count: 8 },
      { categoryId: '4', name: 'Cat 4', count: 7 },
      { categoryId: '5', name: 'Cat 5', count: 6 },
      { categoryId: '6', name: 'Cat 6', count: 5 }
    ];

    render(<CategoryBarChart data={manyCategories} maxCategories={3} />);

    const chart = screen.getByRole('img', { name: /category usage chart showing 3 categories/i });
    expect(chart).toBeInTheDocument();
  });

  it('should support dark mode', () => {
    render(<CategoryBarChart data={mockData} isDarkMode={true} />);

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

  it('should render with data', () => {
    render(<TimeOfDayChart data={mockData} />);

    const chart = screen.getByRole('img', { name: /time of day usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<TimeOfDayChart data={[]} />);

    expect(screen.getByText('No time of day data')).toBeInTheDocument();
  });

  it('should not highlight peak when highlightPeak is false', () => {
    render(<TimeOfDayChart data={mockData} highlightPeak={false} />);

    const chart = screen.getByRole('img', { name: /time of day usage chart/i });
    expect(chart).toBeInTheDocument();
  });

  it('should support dark mode', () => {
    render(<TimeOfDayChart data={mockData} isDarkMode={true} />);

    const chart = screen.getByRole('img', { name: /time of day usage chart/i });
    expect(chart).toBeInTheDocument();
  });
});

describe('Chart Accessibility', () => {
  it('UsageLineChart should have accessible aria-label', () => {
    const data = [{ date: '2026-01-13', count: 5 }];
    render(<UsageLineChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });

  it('PlatformPieChart should have accessible aria-label', () => {
    const data = [{ platform: 'claude', count: 10, percentage: 100 }];
    render(<PlatformPieChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });

  it('DayOfWeekChart should have accessible aria-label', () => {
    const data = [{ day: 'Mon', dayIndex: 1, count: 5 }];
    render(<DayOfWeekChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });

  it('CategoryBarChart should have accessible aria-label', () => {
    const data = [{ categoryId: '1', name: 'Test', count: 5 }];
    render(<CategoryBarChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });

  it('TimeOfDayChart should have accessible aria-label', () => {
    const data = [{ bucket: 'Morning', count: 5 }];
    render(<TimeOfDayChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label');
  });
});

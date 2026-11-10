/**
 * The charts of the full-page Analytics view: Daily use and Time of day, their text alternatives and
 * their tooltip.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import ChartTooltip from '../ChartTooltip';
import DailyUseChart, { dailyUseSummary, formatDay } from '../DailyUseChart';
import TimeOfDayChart, { timeOfDaySummary } from '../TimeOfDayChart';

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

const DAYS = [
  { date: '2026-01-11', count: 5 },
  { date: '2026-01-12', count: 10 },
  { date: '2026-01-13', count: 0 }
];

const TIMES = [
  { bucket: 'Morning', count: 10 },
  { bucket: 'Afternoon', count: 20 },
  { bucket: 'Evening', count: 8 },
  { bucket: 'Night', count: 0 }
];

describe('DailyUseChart', () => {
  it('says the period, its total and the busiest day to assistive technology', () => {
    render(<DailyUseChart data={DAYS} />);

    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Prompts used per day over the last 3 days: 15 in all. The busiest day is Jan 12, with 10.'
    );
  });

  it('says so when no Prompt was used', () => {
    expect(dailyUseSummary([{ date: '2026-01-11', count: 0 }])).toBe('Prompts used per day over the last 1 days: none yet.');
  });

  it('reads a day as a local day, west of UTC too', () => {
    const systemTimeZone = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(formatDay('2026-01-11')).toBe('Jan 11');
    } finally {
      if (systemTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = systemTimeZone;
      }
    }
  });
});

describe('TimeOfDayChart', () => {
  it('says every count and the busiest time to assistive technology', () => {
    render(<TimeOfDayChart data={TIMES} />);

    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Prompts used per time of day: Morning 10, Afternoon 20, Evening 8, Night 0. Afternoon is the busiest.'
    );
  });

  it('says so when no Prompt was used', () => {
    expect(timeOfDaySummary([{ bucket: 'Morning', count: 0 }])).toBe('Prompts used per time of day: none yet.');
  });
});

describe('ChartTooltip', () => {
  it('shows the label of the hovered bar and its uses', () => {
    render(<ChartTooltip active payload={[{ value: 12 }]} label="Morning" formatLabel={label => `${label}, 6-12`} />);

    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Morning, 6-12 12 uses');
  });

  it('counts one use in the singular', () => {
    render(<ChartTooltip active payload={[{ value: 1 }]} label="Night" />);

    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Night 1 use');
  });

  it('shows nothing while no bar is hovered', () => {
    const { container } = render(<ChartTooltip active={false} payload={[{ value: 1 }]} label="Night" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('Chart tooltips, drawn', () => {
  let layout: MockInstance<HTMLElement['getBoundingClientRect']>;

  // happy-dom lays nothing out: give each element a size so the charts draw and can be hovered
  beforeEach(() => {
    layout = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 200));
  });

  afterEach(() => {
    layout.mockRestore();
  });

  /** Hovers the middle of a chart, as a user does to read a value */
  const hoverChart = (container: HTMLElement) => {
    const chart = container.querySelector('.recharts-wrapper');
    expect(chart, 'chart drawn').not.toBeNull();
    fireEvent.mouseMove(chart as Element, { clientX: 200, clientY: 100 });
  };

  it('DailyUseChart shows the hovered day and its uses', async () => {
    const { container } = render(<DailyUseChart data={[{ date: '2026-01-11', count: 5 }]} />);

    hoverChart(container);

    await waitFor(() => {
      expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Jan 11 5 uses');
    });
  });

  it('TimeOfDayChart shows the hovered time of day, its hours and its uses', async () => {
    const { container } = render(<TimeOfDayChart data={[{ bucket: 'Morning', count: 12 }]} />);

    hoverChart(container);

    await waitFor(() => {
      expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Morning, 6-12 12 uses');
    });
  });
});

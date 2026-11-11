/**
 * The charts of the full-page Analytics view: Daily use and Time of day, their text alternatives and
 * their tooltip.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ChartTooltip from '../ChartTooltip';
import DailyUseChart, { dailyUseSummary, formatDay } from '../DailyUseChart';
import TimeOfDayChart, { timeOfDaySummary } from '../TimeOfDayChart';

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

describe('DailyUseChart axis', () => {
  it('names every seventh day, counting back from the last one', () => {
    const fifteenDays = Array.from({ length: 15 }, (_, index) => ({ date: `2026-01-${String(index + 1).padStart(2, '0')}`, count: index }));

    render(<DailyUseChart data={fifteenDays} />);

    expect(screen.getAllByTestId('chart-axis-label').map(label => label.textContent)).toEqual(['Jan 1', 'Jan 8', 'Jan 15']);
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
    render(<ChartTooltip label="Morning, 6-12" count={12} />);

    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Morning, 6-12 12 uses');
  });

  it('counts one use in the singular', () => {
    render(<ChartTooltip label="Night" count={1} />);

    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Night 1 use');
  });
});

describe('Chart hover', () => {
  it('DailyUseChart shows the hovered day and its uses', () => {
    render(<DailyUseChart data={DAYS} />);

    fireEvent.mouseEnter(screen.getAllByTestId('chart-bar')[0]);

    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Jan 11 5 uses');
  });

  it('hides the tooltip as soon as the pointer leaves the bars', () => {
    render(<DailyUseChart data={DAYS} />);
    const [bar] = screen.getAllByTestId('chart-bar');

    fireEvent.mouseEnter(bar);
    fireEvent.mouseLeave(bar);

    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
  });

  it('sizes each bar against the busiest one, and keeps an empty day visible', () => {
    render(<DailyUseChart data={DAYS} />);

    const pills = screen.getAllByTestId('chart-pill');
    expect(pills.map(pill => pill.style.height)).toEqual(['50%', '100%', '0%']);
    expect(pills.map(pill => pill.style.minHeight)).toEqual(['4px', '4px', '4px']);
  });

  it('TimeOfDayChart shows the hovered time of day, its hours and its uses', () => {
    render(<TimeOfDayChart data={TIMES} />);

    fireEvent.mouseEnter(screen.getAllByTestId('chart-bar')[0]);

    expect(screen.getByTestId('chart-tooltip')).toHaveTextContent('Morning, 6-12 10 uses');
  });

  it('TimeOfDayChart names every time of day on its axis', () => {
    render(<TimeOfDayChart data={TIMES} />);

    expect(screen.getAllByTestId('chart-axis-label').map(label => label.textContent)).toEqual(['Morning', 'Afternoon', 'Evening', 'Night']);
  });

  it('DailyUseChart lists every day and its uses to assistive technology', () => {
    render(<DailyUseChart data={DAYS} />);

    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['Jan 11: 5 uses', 'Jan 12: 10 uses', 'Jan 13: 0 uses']);
  });

  it('TimeOfDayChart lists every time of day, its hours and its uses to assistive technology', () => {
    render(<TimeOfDayChart data={TIMES.slice(0, 2)} />);

    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['Morning, 6-12: 10 uses', 'Afternoon, 12-18: 20 uses']);
  });
});

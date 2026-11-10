import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import RankedRows from '../RankedRows';
import StatCard from '../StatCard';

describe('RankedRows', () => {
  const rows = [
    { key: 'claude', label: 'Claude', count: 4 },
    { key: 'chatgpt', label: 'ChatGPT', count: 1, dotColor: '#112233' }
  ];

  it('lists the rows in order under the card title, each with its uses', () => {
    render(<RankedRows title="Platforms" rows={rows} />);

    const card = screen.getByRole('region', { name: 'Platforms' });
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Claude');
    expect(within(items[0]).getByText('4 uses')).toBeInTheDocument();
    expect(within(items[1]).getByText('1 use')).toBeInTheDocument();
  });

  it('sizes each bar against the first row', () => {
    render(<RankedRows title="Platforms" rows={rows} />);

    const bars = [...document.querySelectorAll<HTMLElement>('.animate-rank-fill')];
    expect(bars.map(bar => bar.style.width)).toEqual(['100%', '25%']);
  });

  it("shows a Category's own color as a dot", () => {
    render(<RankedRows title="Categories" rows={rows} />);

    const dots = [...document.querySelectorAll<HTMLElement>('li span[style*="background-color"]')];
    expect(dots).toHaveLength(1);
    expect(dots[0].style.backgroundColor).toBe('#112233');
  });

  it('has no button: the rows are read, not pressed', () => {
    render(<RankedRows title="Platforms" rows={rows} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('shows the label, the name and its uses', () => {
    render(<StatCard label="Top platform" name="Claude" count={1} delayIndex={0} />);

    expect(screen.getByRole('heading', { name: 'Top platform' })).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('1 use')).toBeInTheDocument();
  });
});

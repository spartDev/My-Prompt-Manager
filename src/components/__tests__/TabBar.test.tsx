import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import TabBar from '../TabBar';

describe('TabBar', () => {
  it('renders the four Sections in order inside a labelled tablist', () => {
    render(<TabBar activeSection="library" onSelect={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent)).toEqual(['Library', 'Categories', 'Analytics', 'Settings']);
  });

  it('marks only the active Section as selected and focusable', () => {
    render(<TabBar activeSection="analytics" onSelect={vi.fn()} />);

    const active = screen.getByRole('tab', { name: 'Analytics' });
    expect(active).toHaveAttribute('aria-selected', 'true');
    expect(active).toHaveAttribute('tabindex', '0');

    for (const name of ['Library', 'Categories', 'Settings']) {
      const tab = screen.getByRole('tab', { name });
      expect(tab).toHaveAttribute('aria-selected', 'false');
      expect(tab).toHaveAttribute('tabindex', '-1');
    }
  });

  it('calls onSelect on click, including for the already active tab', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar activeSection="library" onSelect={onSelect} />);

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    await user.click(screen.getByRole('tab', { name: 'Library' }));

    expect(onSelect).toHaveBeenNthCalledWith(1, 'settings');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'library');
  });

  it.each([
    ['ArrowRight', 'library', 'categories'],
    ['ArrowRight', 'settings', 'library'],
    ['ArrowLeft', 'library', 'settings'],
    ['ArrowLeft', 'analytics', 'categories'],
    ['Home', 'settings', 'library'],
    ['End', 'library', 'settings']
  ] as const)('%s from %s selects %s and moves focus', async (key, from, to) => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar activeSection={from} onSelect={onSelect} />);

    screen.getByTestId(`tab-${from}`).focus();
    await user.keyboard(`{${key}}`);

    expect(onSelect).toHaveBeenCalledWith(to);
    expect(screen.getByTestId(`tab-${to}`)).toHaveFocus();
  });

  it('ignores unrelated keys', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TabBar activeSection="library" onSelect={onSelect} />);

    screen.getByTestId('tab-library').focus();
    await user.keyboard('{ArrowDown}');

    expect(onSelect).not.toHaveBeenCalled();
  });
});

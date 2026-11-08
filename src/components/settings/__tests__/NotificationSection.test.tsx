import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import NotificationSection from '../NotificationSection';

describe('NotificationSection', () => {
  it('has one switch, on when Notifications are shown', () => {
    render(<NotificationSection settings={{ enabled: true }} onEnabledChange={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(screen.getByRole('switch', { name: 'Show notifications' })).toHaveAttribute('aria-checked', 'true');
    // One compact row, as Atelier 1C draws it: no line of help under the label
    expect(screen.queryByText('Brief messages at the top after you save, copy or delete.')).not.toBeInTheDocument();
  });

  it('is open from the start: no expand button, position or Test button', () => {
    render(<NotificationSection settings={{ enabled: true }} onEnabledChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Notifications/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Top Right|Bottom Right/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test' })).not.toBeInTheDocument();
  });

  it('turns Notifications off and on', () => {
    const onEnabledChange = vi.fn();
    const { rerender } = render(<NotificationSection settings={{ enabled: true }} onEnabledChange={onEnabledChange} />);

    fireEvent.click(screen.getByRole('switch', { name: 'Show notifications' }));
    expect(onEnabledChange).toHaveBeenLastCalledWith(false);

    rerender(<NotificationSection settings={{ enabled: false }} onEnabledChange={onEnabledChange} />);
    const toggle = screen.getByRole('switch', { name: 'Show notifications' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(onEnabledChange).toHaveBeenLastCalledWith(true);
  });
});

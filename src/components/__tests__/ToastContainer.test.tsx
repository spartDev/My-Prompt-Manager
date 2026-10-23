import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Toast } from '../../types/hooks';
import ToastContainer from '../ToastContainer';

describe('ToastContainer', () => {
  const mockOnDismiss = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnDismiss.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createToast = (overrides?: Partial<Toast>): Toast => ({
    id: 'test-id',
    message: 'Test message',
    type: 'info',
    duration: 3000,
    ...overrides
  });

  it('renders nothing when toasts array is empty', () => {
    const { container } = render(
      <ToastContainer toasts={[]} onDismiss={mockOnDismiss} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders toasts in top-right position by default', () => {
    const toast = createToast();
    const { container } = render(
      <ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />
    );

    const positionedDiv = container.querySelector('.fixed.top-4.right-4');
    expect(positionedDiv).toBeInTheDocument();
  });

  it('renders toasts in bottom-right position when specified', () => {
    const toast = createToast();
    const { container } = render(
      <ToastContainer
        toasts={[toast]}
        onDismiss={mockOnDismiss}
        position="bottom-right"
      />
    );

    const positionedDiv = container.querySelector('.fixed.bottom-4.right-4');
    expect(positionedDiv).toBeInTheDocument();
  });

  // Toasts sit on bg-inverse in both modes; the icon and the progress bar take the type's bright variant
  it.each([
    ['success', 'status', 'text-inverse-success'],
    ['error', 'alert', 'text-inverse-danger'],
    ['warning', 'alert', 'text-inverse-warning'],
    ['info', 'status', 'text-inverse-info']
  ] as const)('renders a %s toast on bg-inverse with its bright icon and progress bar', (type, role, tone) => {
    const toast = createToast({ type, message: `A ${type} message`, duration: 3000 });
    const { container } = render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    const element = screen.getByRole(role);
    expect(element).toHaveClass('bg-inverse', 'text-on-inverse');
    expect(element.querySelector('svg')?.closest('div')).toHaveClass(tone);
    expect(container.querySelector('.absolute.bottom-0.left-0.h-1.w-full')).toHaveClass('bg-current', tone);
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const toast = createToast();
    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    const dismissButton = screen.getByLabelText('Dismiss notification');

    act(() => {
      fireEvent.click(dismissButton);
    });

    // Fast-forward through the animation delay (250ms)
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(mockOnDismiss).toHaveBeenCalledWith('test-id');
  });

  it('auto-dismisses after duration', () => {
    const toast = createToast({ duration: 1000 });
    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    expect(mockOnDismiss).not.toHaveBeenCalled();

    // Fast-forward time (duration + animation delay)
    act(() => {
      vi.advanceTimersByTime(1250);
    });

    expect(mockOnDismiss).toHaveBeenCalledWith('test-id');
  });

  it('does not auto-dismiss when duration is 0', () => {
    const toast = createToast({ duration: 0 });
    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it('dismisses on ESC key press', () => {
    const toast = createToast();
    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    // Fast-forward through animation delay
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(mockOnDismiss).toHaveBeenCalledWith('test-id');
  });

  it('renders action button when action is provided', () => {
    const mockAction = vi.fn();
    const toast = createToast({
      action: {
        label: 'Undo',
        onClick: mockAction
      }
    });

    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    const actionButton = screen.getByText('Undo');
    expect(actionButton).toBeInTheDocument();
  });

  it('calls action onClick and dismisses when action button is clicked', () => {
    const mockAction = vi.fn();
    const toast = createToast({
      action: {
        label: 'Undo',
        onClick: mockAction
      }
    });

    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    const actionButton = screen.getByText('Undo');

    act(() => {
      fireEvent.click(actionButton);
    });

    expect(mockAction).toHaveBeenCalled();

    // Fast-forward through animation delay
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(mockOnDismiss).toHaveBeenCalledWith('test-id');
  });

  it('renders secondary action button with correct styling', () => {
    const toast = createToast({
      action: {
        label: 'Dismiss',
        onClick: vi.fn(),
        variant: 'secondary'
      }
    });

    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    // Outlined in the message color, on bg-inverse
    const actionButton = screen.getByText('Dismiss');
    expect(actionButton).toHaveClass('text-on-inverse', 'border');
  });

  it('renders progress bar when duration is set', () => {
    const toast = createToast({ duration: 3000 });
    const { container } = render(
      <ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />
    );

    const progressBar = container.querySelector('.absolute.bottom-0.left-0.h-1.w-full');
    expect(progressBar).toBeInTheDocument();
  });

  it('does not render progress bar when duration is 0', () => {
    const toast = createToast({ duration: 0 });
    const { container } = render(
      <ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />
    );

    const progressBar = container.querySelector('.absolute.bottom-0.left-0.h-1.w-full');
    expect(progressBar).not.toBeInTheDocument();
  });

  it('displays queue indicator when queueLength is provided', () => {
    const toast = createToast();
    render(
      <ToastContainer
        toasts={[toast]}
        onDismiss={mockOnDismiss}
        queueLength={3}
      />
    );

    expect(screen.getByText('3 more notifications')).toBeInTheDocument();
  });

  it('uses singular form for queue indicator when queueLength is 1', () => {
    const toast = createToast();
    render(
      <ToastContainer
        toasts={[toast]}
        onDismiss={mockOnDismiss}
        queueLength={1}
      />
    );

    expect(screen.getByText('1 more notification')).toBeInTheDocument();
  });

  it('does not display queue indicator when queueLength is 0', () => {
    const toast = createToast();
    render(
      <ToastContainer
        toasts={[toast]}
        onDismiss={mockOnDismiss}
        queueLength={0}
      />
    );

    expect(screen.queryByText(/more notification/)).not.toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    const toasts = [
      createToast({ id: '1', message: 'First' }),
      createToast({ id: '2', message: 'Second' })
    ];

    render(<ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('uses assertive aria-live for error and warning toasts', () => {
    const errorToast = createToast({ type: 'error' });
    const { rerender } = render(
      <ToastContainer toasts={[errorToast]} onDismiss={mockOnDismiss} />
    );

    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');

    const warningToast = createToast({ type: 'warning' });
    rerender(<ToastContainer toasts={[warningToast]} onDismiss={mockOnDismiss} />);

    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('uses polite aria-live for success and info toasts', () => {
    const successToast = createToast({ type: 'success' });
    const { rerender } = render(
      <ToastContainer toasts={[successToast]} onDismiss={mockOnDismiss} />
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

    const infoToast = createToast({ type: 'info' });
    rerender(<ToastContainer toasts={[infoToast]} onDismiss={mockOnDismiss} />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
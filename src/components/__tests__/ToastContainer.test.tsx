import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Toast } from '../../types/hooks';
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

  it('renders success toast with correct styling', () => {
    const toast = createToast({ type: 'success', message: 'Operation succeeded' });
    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Operation succeeded')).toBeInTheDocument();
    const successIcon = screen.getByRole('status').querySelector('.text-green-500');
    expect(successIcon).toBeInTheDocument();
  });

  it('renders error toast with correct styling', () => {
    const toast = createToast({ type: 'error', message: 'Operation failed' });
    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Operation failed')).toBeInTheDocument();
    const errorIcon = screen.getByRole('alert').querySelector('.text-red-500');
    expect(errorIcon).toBeInTheDocument();
  });

  it('renders warning toast with correct styling', () => {
    const toast = createToast({ type: 'warning', message: 'Warning message' });
    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Warning message')).toBeInTheDocument();
    const warningIcon = screen.getByRole('alert').querySelector('.text-yellow-500');
    expect(warningIcon).toBeInTheDocument();
  });

  it('renders info toast with correct styling', () => {
    const toast = createToast({ type: 'info', message: 'Info message' });
    render(<ToastContainer toasts={[toast]} onDismiss={mockOnDismiss} />);

    expect(screen.getByText('Info message')).toBeInTheDocument();
    const infoIcon = screen.getByRole('status').querySelector('.text-purple-500');
    expect(infoIcon).toBeInTheDocument();
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

    const actionButton = screen.getByText('Dismiss');
    expect(actionButton).toHaveClass('bg-gray-100');
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
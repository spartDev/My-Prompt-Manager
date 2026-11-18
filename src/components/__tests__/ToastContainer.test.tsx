import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Toast } from '../../types/hooks';
import ToastContainer from '../ToastContainer';

describe('ToastContainer', () => {
  const onDismiss = vi.fn();

  beforeEach(() => {
    onDismiss.mockClear();
  });

  const createToast = (overrides?: Partial<Toast>): Toast => ({
    id: 'toast-1',
    message: 'Prompt saved',
    type: 'success',
    duration: 2700,
    ...overrides
  });

  it('renders nothing without a Notification', () => {
    const { container } = render(<ToastContainer toast={null} onDismiss={onDismiss} />);
    expect(container.firstChild).toBeNull();
  });

  it('is a pill at the top center, entering with the Atelier 1C animation', () => {
    render(<ToastContainer toast={createToast()} onDismiss={onDismiss} />);

    const pill = screen.getByTestId('toast');
    expect(pill).toHaveClass('fixed', 'top-3', 'left-1/2', 'animate-toast-in', 'h-10', 'rounded-full', 'bg-inverse', 'shadow-toast');
    expect(pill.className).not.toMatch(/bottom-|right-4/);
    expect(screen.getByTestId('toast-mark')).toHaveClass('animate-toast-mark');
  });

  it.each([
    ['success', 'status', 'polite', 'bg-inverse-mark'],
    ['info', 'status', 'polite', 'bg-inverse-mark'],
    ['error', 'alert', 'assertive', 'bg-inverse-alert'],
    ['warning', 'alert', 'assertive', 'bg-inverse-alert']
  ] as const)('a %s Notification is a %s with its round in %s', (type, role, live, round) => {
    render(<ToastContainer toast={createToast({ type })} onDismiss={onDismiss} />);

    const pill = screen.getByRole(role);
    expect(pill).toHaveAttribute('aria-live', live);
    expect(pill).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByTestId('toast-mark')).toHaveClass(round);
  });

  it('shows the message and its sub, and cuts only the sub', () => {
    render(<ToastContainer toast={createToast({ sub: 'Weekly status update' })} onDismiss={onDismiss} />);

    expect(screen.getByText('Prompt saved')).toHaveClass('font-semibold', 'shrink-0', 'max-w-full');
    const sub = screen.getByText('Weekly status update');
    expect(sub).toHaveClass('truncate', 'text-on-inverse');
  });

  it('has no close button and no progress bar', () => {
    render(<ToastContainer toast={createToast()} onDismiss={onDismiss} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('toast').querySelector('[style*="shrink-width"]')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<ToastContainer toast={createToast()} onDismiss={onDismiss} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('ignores other keys, and Escape once the Notification is gone', () => {
    const { rerender } = render(<ToastContainer toast={createToast()} onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: 'Enter' });

    rerender(<ToastContainer toast={null} onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('runs its action, then leaves', () => {
    const onClick = vi.fn();
    render(<ToastContainer toast={createToast({ sub: 'Marketing', action: { label: 'Undo', onClick } })} onDismiss={onDismiss} />);

    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toHaveClass('bg-inverse-action', 'rounded-full', 'h-7');
    fireEvent.click(undo);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('holds its time while it is hovered or has the focus, so its action can be reached', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    render(
      <ToastContainer
        toast={createToast({ sub: 'Marketing', action: { label: 'Undo', onClick: vi.fn() } })}
        onDismiss={onDismiss}
        onPause={onPause}
        onResume={onResume}
      />
    );
    const pill = screen.getByTestId('toast');
    const undo = screen.getByRole('button', { name: 'Undo' });

    fireEvent.mouseEnter(pill);
    expect(onPause).toHaveBeenCalledWith('toast-1');
    undo.focus();
    fireEvent.mouseLeave(pill);
    // Still focused: the time stays held
    expect(onResume).not.toHaveBeenCalled();

    undo.blur();
    expect(onResume).toHaveBeenCalledWith('toast-1');
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('mounts a new pill for a new Notification, so the entrance plays again', () => {
    const { rerender } = render(<ToastContainer toast={createToast()} onDismiss={onDismiss} />);
    const first = screen.getByTestId('toast');

    rerender(<ToastContainer toast={createToast({ id: 'toast-2', message: 'Prompt copied' })} onDismiss={onDismiss} />);

    expect(screen.getByTestId('toast')).not.toBe(first);
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
  });

  // The Welcome's opt-ins (My-Prompt-Manager-ojz.20): every other screen leaves them out and keeps the pill above
  describe('opt-ins for a Notification read whole beside a control at the top right', () => {
    const failure = createToast({ type: 'error', message: "Couldn't add the prompts", duration: 0, action: { label: 'Try again', onClick: vi.fn() } });

    it('left out, nothing changes: one line high, centered on the screen, a long message cut', () => {
      render(<ToastContainer toast={failure} onDismiss={onDismiss} />);

      const pill = screen.getByTestId('toast');
      expect(pill).toHaveClass('h-10', 'rounded-full', 'left-1/2', 'max-w-[calc(100%-32px)]');
      expect(pill).not.toHaveClass('w-max');
      expect(pill.getAttribute('style')).toBeNull();
      expect(screen.getByTestId('toast-message')).toHaveClass('shrink-0', 'max-w-full', 'truncate');
    });

    it('wrap: the pill takes the width of its text up to its room, and the message wraps onto more lines instead of being cut', () => {
      render(<ToastContainer toast={failure} onDismiss={onDismiss} wrap />);

      const pill = screen.getByTestId('toast');
      expect(pill).toHaveClass('w-max', 'min-h-10', 'py-1.5', 'rounded-[20px]');
      expect(pill).not.toHaveClass('h-10');
      const message = screen.getByTestId('toast-message');
      expect(message).toHaveTextContent("Couldn't add the prompts");
      expect(message).not.toHaveClass('truncate');
      expect(message).not.toHaveClass('shrink-0');
      expect(message).toHaveClass('min-w-0');
    });

    it('clearRight: centered in the room left of that many pixels at the right edge, never wider than it', () => {
      render(<ToastContainer toast={failure} onDismiss={onDismiss} wrap clearRight={58} />);

      const pill = screen.getByTestId('toast');
      expect(pill).not.toHaveClass('left-1/2');
      // From 16px at the left to 58px from the right: its center 21px left of the screen's
      expect(pill.style.left).toBe('calc(50% + -21px)');
      expect(pill.style.maxWidth).toBe('calc(100% - 74px)');
    });

    it('keeps a failure an alert, announced at once, its action a button that runs then leaves', () => {
      const onClick = vi.fn();
      render(<ToastContainer toast={{ ...failure, action: { label: 'Try again', onClick } }} onDismiss={onDismiss} wrap clearRight={58} />);

      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledWith('toast-1');
    });
  });
});

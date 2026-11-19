import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
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

  // The Welcome's opt-ins (My-Prompt-Manager-ojz.20, 5lf): every other screen leaves them out and keeps the pill above
  describe('opt-ins for a Notification read whole in the flow of a screen', () => {
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

    // My-Prompt-Manager-5lf: under the Welcome's header, it covers neither the brand nor the step's title
    it('inFlow: the pill takes its place in its parent, centered there and never wider, instead of floating at the top of the screen', () => {
      render(<ToastContainer toast={failure} onDismiss={onDismiss} wrap inFlow />);

      const pill = screen.getByTestId('toast');
      expect(pill).toHaveClass('relative', 'left-1/2', 'max-w-full', '[transform:translateX(-50%)]', 'animate-toast-in', 'w-max');
      expect(pill).not.toHaveClass('fixed');
      expect(pill).not.toHaveClass('top-3');
      expect(pill).not.toHaveClass('max-w-[calc(100%-32px)]');
      expect(pill.getAttribute('style')).toBeNull();
    });

    // My-Prompt-Manager-ojz.19: the exit of the Welcome, shown on the Library, which passes neither opt-in
    it('a Notification read whole, on a screen with no opt-in: the pill grows, its sub a line of its own under the message, never cut', () => {
      const exit = createToast({ message: '9 prompts added', sub: 'Open your AI chat and type //', whole: true });
      render(<ToastContainer toast={exit} onDismiss={onDismiss} />);

      const pill = screen.getByTestId('toast');
      expect(pill).toHaveClass('w-max', 'min-h-10', 'py-1.5', 'rounded-[20px]', 'left-1/2', 'max-w-[calc(100%-32px)]');
      expect(pill).not.toHaveClass('h-10');
      expect(pill).toHaveAttribute('role', 'status');
      const text = screen.getByTestId('toast-text');
      expect(text).toHaveClass('flex-col', 'items-start');
      expect(text).not.toHaveClass('items-center');
      expect(screen.getByTestId('toast-message')).toHaveClass('min-w-0');
      expect(screen.getByTestId('toast-message')).not.toHaveClass('truncate');
      const sub = screen.getByTestId('toast-sub');
      expect(sub).toHaveTextContent('Open your AI chat and type //');
      expect(sub).not.toHaveClass('truncate');
      expect(sub).toHaveClass('min-w-0', 'text-on-inverse');
    });

    it('the next Notification, not read whole, is one line again with its sub cut', () => {
      const { rerender } = render(<ToastContainer toast={createToast({ id: 'exit', sub: 'Open your AI chat and type //', whole: true })} onDismiss={onDismiss} />);
      rerender(<ToastContainer toast={createToast({ id: 'saved', sub: 'Weekly status update' })} onDismiss={onDismiss} />);

      expect(screen.getByTestId('toast')).toHaveClass('h-10', 'rounded-full');
      expect(screen.getByTestId('toast-text')).toHaveClass('items-center');
      expect(screen.getByTestId('toast-sub')).toHaveClass('truncate');
    });

    it('keeps a failure an alert, announced at once, its action a button that runs then leaves', () => {
      const onClick = vi.fn();
      render(<ToastContainer toast={{ ...failure, action: { label: 'Try again', onClick } }} onDismiss={onDismiss} wrap inFlow />);

      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledWith('toast-1');
    });
  });

  // My-Prompt-Manager-5lf: the Welcome's Try again refused again, whose pressed button left with its Notification
  describe('focusAction: the action takes the keyboard as the Notification shows', () => {
    const failure = createToast({ type: 'error', message: "Couldn't add the prompts", duration: 0, action: { label: 'Try again', onClick: vi.fn() } });

    it('with the keyboard on no element, the action takes it', () => {
      (document.activeElement as HTMLElement | null)?.blur();
      expect(document.activeElement).toBe(document.body);

      render(<ToastContainer toast={{ ...failure, id: 'again', focusAction: true }} onDismiss={onDismiss} wrap />);

      expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus();
    });

    it('the keyboard on an element already stays there', () => {
      render(
        <>
          <button type="button">Product</button>
          <ToastContainer toast={null} onDismiss={onDismiss} />
        </>
      );
      screen.getByRole('button', { name: 'Product' }).focus();

      render(<ToastContainer toast={{ ...failure, id: 'again', focusAction: true }} onDismiss={onDismiss} wrap />);

      expect(screen.getByRole('button', { name: 'Product' })).toHaveFocus();
    });

    it('left out, a Notification never takes the keyboard, even from the body', () => {
      (document.activeElement as HTMLElement | null)?.blur();

      render(<ToastContainer toast={failure} onDismiss={onDismiss} wrap />);

      expect(document.activeElement).toBe(document.body);
    });

    it('each new Notification that asks takes it, even one straight after another that did (a Try again refused twice in a row)', () => {
      (document.activeElement as HTMLElement | null)?.blur();
      const { rerender } = render(<ToastContainer toast={{ ...failure, id: 'again', focusAction: true }} onDismiss={onDismiss} wrap />);
      const second = screen.getByRole('button', { name: 'Try again' });
      expect(second).toHaveFocus();

      // Pressed, it leaves with its pill, the next one in the same render
      rerender(<ToastContainer toast={{ ...failure, id: 'third', focusAction: true }} onDismiss={onDismiss} wrap />);

      const third = screen.getByRole('button', { name: 'Try again' });
      expect(third).not.toBe(second);
      expect(third).toHaveFocus();
    });

    // A timed one: the Welcome's own has none (duration 0), where a pause changes nothing. Under
    // StrictMode, as the side panel runs in development, the effects run twice, and the action has the
    // keyboard before the hold listeners are put on the pill both times
    it.each([
      ['alone', false],
      ['under StrictMode, whose effects run twice', true]
    ] as const)('holds its time from that focus on, as from any other (%s): paused as its action takes the keyboard, resumed when the focus leaves', (_mode, strict) => {
      (document.activeElement as HTMLElement | null)?.blur();
      const onPause = vi.fn();
      const onResume = vi.fn();
      const pill = <ToastContainer toast={{ ...failure, id: 'timed', duration: 6000, focusAction: true }} onDismiss={onDismiss} onPause={onPause} onResume={onResume} wrap />;
      render(strict ? <StrictMode>{pill}</StrictMode> : pill);
      const action = screen.getByRole('button', { name: 'Try again' });
      expect(action).toHaveFocus();

      expect(onPause).toHaveBeenCalledWith('timed');
      expect(onResume).not.toHaveBeenCalled();
      action.blur();
      expect(onResume.mock.calls).toEqual([['timed']]);
    });

    it('takes it once, as the Notification shows: a render of the same Notification moves nothing', () => {
      (document.activeElement as HTMLElement | null)?.blur();
      const toast = { ...failure, id: 'again', focusAction: true };
      const { rerender } = render(<ToastContainer toast={toast} onDismiss={onDismiss} wrap />);
      screen.getByRole('button', { name: 'Try again' }).blur();

      rerender(<ToastContainer toast={{ ...toast }} onDismiss={onDismiss} wrap />);

      expect(document.activeElement).toBe(document.body);
    });
  });
});

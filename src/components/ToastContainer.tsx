import type { FC } from 'react';
import { memo, useEffect, useRef } from 'react';

import type { Toast } from '../types/hooks';
import { cn } from '../utils';

// Module-scope glyphs: the round under them carries the color
const CheckGlyph = (
  <svg viewBox="0 0 24 24" className="size-3 fill-none stroke-current" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

const AlertGlyph = (
  <svg viewBox="0 0 24 24" className="size-3 fill-none stroke-current" strokeWidth={3.2} strokeLinecap="round" aria-hidden="true">
    <path d="M12 5.5v8" />
    <path d="M12 18.5h.01" />
  </svg>
);

interface ToastContainerProps {
  /** The one Notification on screen, or none */
  toast: Toast | null;
  onDismiss: (id: string) => void;
  /** The pointer or the focus came onto the Notification: its time stops */
  onPause?: (id: string) => void;
  /** Neither is on it any longer: its time runs on */
  onResume?: (id: string) => void;
  /**
   * Opt-in, for a screen where a Notification must be read whole: the pill takes the width of its
   * text, up to the room it has, and a message longer than that wraps onto more lines instead of
   * being cut (the Welcome, My-Prompt-Manager-ojz.20). Left out, the pill is one line high
   */
  wrap?: boolean;
  /**
   * Opt-in, for a screen that makes room for the Notification in its own layout (the Welcome, under
   * its header, My-Prompt-Manager-5lf): the pill takes its place in the flow of its parent, centered
   * in it and never wider, instead of floating at the top of the screen, so it covers nothing of the
   * screen. Left out, the pill floats at the top center
   */
  inFlow?: boolean;
}

/**
 * The Notification pill of the Atelier 1C design: always at the top center, one at a time. A new
 * Notification has a new key, so it mounts again and replays its entrance; it leaves at once.
 * `wrap` and `inFlow` are opt-ins for one screen (the Welcome); without them nothing changes.
 * One Notification can ask to be read whole wherever it shows (`Toast.whole`, the exit of the Welcome
 * on the Library): the pill grows as with `wrap`, and the sub takes a line of its own, never cut.
 * One can ask its action to take the keyboard as it shows (`Toast.focusAction`, the Welcome's Try
 * again refused again): it does when the keyboard is on no element, the pressed action having left
 * with the Notification before; otherwise no Notification ever moves the keyboard.
 */
const ToastContainer: FC<ToastContainerProps> = ({ toast, onDismiss, onPause, onResume, wrap = false, inFlow = false }) => {
  const pillRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const toastId = toast?.id;
  const focusAction = toast?.focusAction === true;

  // Once, as each Notification shows (a Try again refused twice in a row shows two that ask it): its
  // action takes the keyboard, unless the user has put it on an element
  useEffect(() => {
    if (toastId === undefined || !focusAction) {return;}
    const active = document.activeElement;
    if (active === null || active === document.body) {
      actionRef.current?.focus();
    }
  }, [toastId, focusAction]);

  // Hovered or focused, the Notification keeps its time, so its action (Undo) can be reached and
  // read; it runs on once neither is true. Each Notification starts unheld, unless the keyboard is in
  // it already: its action took it as it showed (focusAction, above), before these listeners were
  // put on, so the hold starts from where the keyboard is, whatever order the effects run in.
  // Listened to on the element, as hovering or focusing the status region is no interaction with it.
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill || toastId === undefined) {return;}
    let hovered = false;
    let focused = pill.contains(document.activeElement);
    if (focused) {
      onPause?.(toastId);
    }
    const update = (change: () => void) => {
      const wasHeld = hovered || focused;
      change();
      const isHeld = hovered || focused;
      if (isHeld && !wasHeld) {
        onPause?.(toastId);
      } else if (wasHeld && !isHeld) {
        onResume?.(toastId);
      }
    };
    const handleEnter = () => { update(() => { hovered = true; }); };
    const handleLeave = () => { update(() => { hovered = false; }); };
    const handleFocusIn = () => { update(() => { focused = true; }); };
    const handleFocusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node && pill.contains(event.relatedTarget))) {
        update(() => { focused = false; });
      }
    };
    pill.addEventListener('mouseenter', handleEnter);
    pill.addEventListener('mouseleave', handleLeave);
    pill.addEventListener('focusin', handleFocusIn);
    pill.addEventListener('focusout', handleFocusOut);
    return () => {
      pill.removeEventListener('mouseenter', handleEnter);
      pill.removeEventListener('mouseleave', handleLeave);
      pill.removeEventListener('focusin', handleFocusIn);
      pill.removeEventListener('focusout', handleFocusOut);
    };
  }, [toastId, onPause, onResume]);

  useEffect(() => {
    if (!toast) {return;}
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss(toast.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toast, onDismiss]);

  if (!toast) {return null;}

  // A failure is announced at once; a confirmation waits for the screen reader to be idle
  const isFailure = toast.type === 'error' || toast.type === 'warning';
  // A Notification to read whole (the exit of the Welcome, My-Prompt-Manager-ojz.19) grows as `wrap`
  // makes it, on whichever screen it shows, its sub on a line of its own under the message
  const whole = toast.whole === true;
  const grows = wrap || whole;

  return (
    <div
      key={toast.id}
      ref={pillRef}
      role={isFailure ? 'alert' : 'status'}
      aria-live={isFailure ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid="toast"
      data-type={toast.type}
      className={cn(
        'animate-toast-in left-1/2 [transform:translateX(-50%)] z-50 flex items-center gap-[9px] pl-3.5 pr-1.5',
        'bg-inverse text-on-inverse-strong shadow-toast leading-[1.4] antialiased',
        // In the flow, it is centered in its parent as toast-in centers it on the screen: half its room
        // to the right, then half its own width back
        inFlow ? 'relative max-w-full' : 'fixed top-3 max-w-[calc(100%-32px)]',
        // Wrapped, the pill grows a line at a time: 40px for one line, as the default one, rounded the same
        grows ? 'w-max min-h-10 py-1.5 rounded-[20px]' : 'h-10 rounded-full'
      )}
    >
      <span
        data-testid="toast-mark"
        className={`animate-toast-mark grid place-items-center size-5 flex-none rounded-full text-on-inverse-mark ${isFailure ? 'bg-inverse-alert' : 'bg-inverse-mark'}`}
      >
        {isFailure ? AlertGlyph : CheckGlyph}
      </span>
      {/* The text is the one part that gives way, so the round, the gaps and the action keep their room.
          Inside it, the message never gives way to the sub: only a message longer than the room left is
          cut, or, wrapped, goes on to the next line. Read whole, the sub is the second line, never cut */}
      <span data-testid="toast-text" className={cn('flex min-w-0', whole ? 'flex-col items-start' : 'items-center gap-[9px]')}>
        <span data-testid="toast-message" className={cn('text-[13px] font-semibold', grows ? 'min-w-0' : 'shrink-0 max-w-full truncate')}>
          {toast.message}
        </span>
        {toast.sub && (
          <span data-testid="toast-sub" className={cn('min-w-0 text-[12.5px] text-on-inverse', !whole && 'truncate')}>
            {toast.sub}
          </span>
        )}
      </span>
      {toast.action ? (
        <button
          ref={actionRef}
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss(toast.id);
          }}
          className="flex-none h-7 px-[11px] rounded-full bg-inverse-action text-on-inverse-strong text-[12.5px] font-semibold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          {toast.action.label}
        </button>
      ) : (
        <span aria-hidden="true" className="w-2 flex-none" />
      )}
    </div>
  );
};

export default memo(ToastContainer);

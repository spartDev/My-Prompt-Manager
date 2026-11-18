import type { CSSProperties, FC } from 'react';
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
   * Opt-in, for a screen with a control at its top right (the Welcome's close button): the pixels
   * from the right edge the pill leaves free, instead of 16. It sits centered in the room left of
   * them, so it never covers that control. Left out, the pill is centered on the screen
   */
  clearRight?: number;
}

/** The room the pill leaves on each side of the screen */
const EDGE_PX = 16;

/** Centered between EDGE_PX on the left and `clearRight` on the right, no wider than that room */
const placementBeside = (clearRight: number): CSSProperties => ({
  left: `calc(50% + ${String((EDGE_PX - clearRight) / 2)}px)`,
  maxWidth: `calc(100% - ${String(EDGE_PX + clearRight)}px)`
});

/**
 * The Notification pill of the Atelier 1C design: always at the top center, one at a time. A new
 * Notification has a new key, so it mounts again and replays its entrance; it leaves at once.
 * `wrap` and `clearRight` are opt-ins for one screen (the Welcome); without them nothing changes.
 */
const ToastContainer: FC<ToastContainerProps> = ({ toast, onDismiss, onPause, onResume, wrap = false, clearRight }) => {
  const pillRef = useRef<HTMLDivElement>(null);
  const toastId = toast?.id;

  // Hovered or focused, the Notification keeps its time, so its action (Undo) can be reached and
  // read; it runs on once neither is true. Each Notification starts unheld. Listened to on the
  // element, as hovering or focusing the status region is no interaction with it.
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill || toastId === undefined) {return;}
    let hovered = false;
    let focused = false;
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
        'animate-toast-in fixed top-3 [transform:translateX(-50%)] z-50 flex items-center gap-[9px] pl-3.5 pr-1.5',
        'bg-inverse text-on-inverse-strong shadow-toast leading-[1.4] antialiased',
        clearRight === undefined && 'left-1/2 max-w-[calc(100%-32px)]',
        // Wrapped, the pill grows a line at a time: 40px for one line, as the default one, rounded the same
        wrap ? 'w-max min-h-10 py-1.5 rounded-[20px]' : 'h-10 rounded-full'
      )}
      style={clearRight === undefined ? undefined : placementBeside(clearRight)}
    >
      <span
        data-testid="toast-mark"
        className={`animate-toast-mark grid place-items-center size-5 flex-none rounded-full text-on-inverse-mark ${isFailure ? 'bg-inverse-alert' : 'bg-inverse-mark'}`}
      >
        {isFailure ? AlertGlyph : CheckGlyph}
      </span>
      {/* The text is the one part that gives way, so the round, the gaps and the action keep their room.
          Inside it, the message never gives way to the sub: only a message longer than the room left is
          cut, or, wrapped, goes on to the next line */}
      <span data-testid="toast-text" className="flex min-w-0 items-center gap-[9px]">
        <span data-testid="toast-message" className={cn('text-[13px] font-semibold', wrap ? 'min-w-0' : 'shrink-0 max-w-full truncate')}>
          {toast.message}
        </span>
        {toast.sub && (
          <span className="min-w-0 truncate text-[12.5px] text-on-inverse">
            {toast.sub}
          </span>
        )}
      </span>
      {toast.action ? (
        <button
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

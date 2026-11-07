import type { FC } from 'react';
import { memo, useEffect } from 'react';

import type { Toast } from '../types/hooks';

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
}

/**
 * The Notification pill of the Atelier 1C design: always at the top center, one at a time. A new
 * Notification has a new key, so it mounts again and replays its entrance; it leaves at once.
 */
const ToastContainer: FC<ToastContainerProps> = ({ toast, onDismiss }) => {
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
      role={isFailure ? 'alert' : 'status'}
      aria-live={isFailure ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid="toast"
      data-type={toast.type}
      className="
        toast-in fixed top-3 left-1/2 z-50
        flex items-center gap-[9px] h-10 max-w-[calc(100%-32px)] pl-3.5 pr-1.5
        rounded-full bg-inverse text-on-inverse-strong shadow-toast
        leading-[1.4] antialiased
      "
    >
      <span
        data-testid="toast-mark"
        className={`toast-mark-pop grid place-items-center size-5 flex-none rounded-full text-on-inverse-mark ${isFailure ? 'bg-inverse-alert' : 'bg-inverse-mark'}`}
      >
        {isFailure ? AlertGlyph : CheckGlyph}
      </span>
      {/* The message never gives way to the sub: only a message longer than the whole pill is cut */}
      <span className="shrink-0 max-w-full truncate text-[13px] font-semibold">
        {toast.message}
      </span>
      {toast.sub && (
        <span className="min-w-0 truncate text-[12.5px] text-on-inverse">
          {toast.sub}
        </span>
      )}
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

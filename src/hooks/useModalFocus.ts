import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface UseModalFocusOptions {
  /**
   * True while the dialog has the keyboard: false once it is closed, and false while a confirmation
   * is open above it (the dialog then stays in the document, `inert`, and pauses)
   */
  isOpen: boolean;
  /** Called on Escape */
  onClose: () => void;
  /**
   * The dialog panel, with tabIndex={-1}: Tab and Shift+Tab cycle through its enabled focusable
   * elements, and focus the panel itself when every one is disabled
   */
  containerRef: RefObject<HTMLElement | null>;
  /** The element focused when the dialog opens (the safe choice, e.g. Cancel) */
  initialFocusRef: RefObject<HTMLElement | null>;
}

/**
 * The keyboard behavior of a modal dialog (role="dialog" aria-modal="true"): focus moves into it
 * on open, Tab and Shift+Tab wrap inside it, Escape calls onClose, and on close the focus returns
 * to the element that had it before the dialog opened. Beneath a confirmation (isOpen false while
 * the panel stays in the document) the dialog pauses: it gives nothing back and keeps its opener,
 * and when it resumes it leaves the focus where the confirmation put it, on the button that opened
 * the confirmation.
 */
export function useModalFocus({ isOpen, onClose, containerRef, initialFocusRef }: UseModalFocusOptions): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // The element that had the focus when the dialog opened: kept through a pause, null once closed
  const openerRef = useRef<{ element: HTMLElement | null } | null>(null);

  useEffect(() => {
    if (!isOpen) {return;}

    const active = document.activeElement;
    if (openerRef.current === null) {
      openerRef.current = { element: active instanceof HTMLElement ? active : null };
    }
    // Resuming beneath a closed confirmation: the focus is already inside, where the confirmation left it
    if (!containerRef.current?.contains(active)) {
      initialFocusRef.current?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) {return;}

      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(element => !element.hasAttribute('disabled'));
      event.preventDefault();
      if (focusable.length === 0) {
        // Every control is disabled (an action in progress): hold the focus on the panel itself
        containerRef.current.focus();
        return;
      }

      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const next = current === -1
        ? (event.shiftKey ? focusable.length - 1 : 0)
        : (current + step + focusable.length) % focusable.length;
      focusable[next]?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Paused beneath a confirmation, which has the keyboard now: nothing to give back yet
      if (containerRef.current?.isConnected) {return;}
      const opener = openerRef.current?.element;
      openerRef.current = null;
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [isOpen, containerRef, initialFocusRef]);
}

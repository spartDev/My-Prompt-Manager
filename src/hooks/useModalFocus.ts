import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface UseModalFocusOptions {
  /** True while the dialog is rendered */
  isOpen: boolean;
  /** Called on Escape */
  onClose: () => void;
  /** The dialog panel: Tab and Shift+Tab cycle through its enabled focusable elements */
  containerRef: RefObject<HTMLElement | null>;
  /** The element focused when the dialog opens (the safe choice, e.g. Cancel) */
  initialFocusRef: RefObject<HTMLElement | null>;
}

/**
 * The keyboard behavior of a modal dialog (role="dialog" aria-modal="true"): focus moves into it
 * on open, Tab and Shift+Tab wrap inside it, Escape calls onClose, and on close the focus returns
 * to the element that had it before the dialog opened.
 */
export function useModalFocus({ isOpen, onClose, containerRef, initialFocusRef }: UseModalFocusOptions): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {return;}

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFocusRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) {return;}

      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(element => !element.hasAttribute('disabled'));
      if (focusable.length === 0) {return;}

      event.preventDefault();
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
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [isOpen, containerRef, initialFocusRef]);
}

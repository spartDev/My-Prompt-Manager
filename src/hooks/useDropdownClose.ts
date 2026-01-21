import { useEffect } from 'react';

export interface UseDropdownCloseOptions {
  /** Whether the dropdown is currently open */
  isOpen: boolean;
  /**
   * Callback to close the dropdown.
   * **Important:** This callback should be stable (memoized with `useCallback`)
   * to avoid re-running the effect on every render.
   */
  onClose: () => void;
  /** Ref to the dropdown trigger button */
  triggerRef: { readonly current: HTMLElement | null };
  /** Ref to the dropdown menu/content */
  menuRef: { readonly current: HTMLElement | null };
  /** Whether to close on Escape key (default: true) */
  closeOnEscape?: boolean;
  /** Element to focus when closing via Escape (default: triggerRef) */
  focusOnEscape?: { readonly current: HTMLElement | null };
}

/**
 * Custom hook for handling dropdown close interactions
 * Handles click-outside and optional Escape key closing
 *
 * @param options - Configuration options for dropdown close behavior
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * const menuRef = useRef<HTMLDivElement>(null);
 *
 * // Memoize onClose to prevent effect from re-running on every render
 * const handleClose = useCallback(() => setIsOpen(false), []);
 *
 * useDropdownClose({
 *   isOpen,
 *   onClose: handleClose,
 *   triggerRef: buttonRef,
 *   menuRef: menuRef,
 *   closeOnEscape: true
 * });
 * ```
 */
export const useDropdownClose = ({
  isOpen,
  onClose,
  triggerRef,
  menuRef,
  closeOnEscape = true,
  focusOnEscape
}: UseDropdownCloseOptions): void => {
  useEffect(() => {
    if (!isOpen) {return;}

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;

      // Guard: Ensure target is a valid Node before using contains()
      if (!(target instanceof Node)) {
        return;
      }

      // Check if click is outside both trigger and menu
      const menu = menuRef.current;
      const trigger = triggerRef.current;

      if (
        menu &&
        !menu.contains(target) &&
        trigger &&
        !trigger.contains(target)
      ) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();

        // Restore focus to specified element or trigger
        const focusTarget = focusOnEscape || triggerRef;
        const focusElement = focusTarget.current;
        if (focusElement) {
          focusElement.focus();
        }
      }
    };

    // Attach listeners
    document.addEventListener('mousedown', handleClickOutside);
    if (closeOnEscape) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (closeOnEscape) {
        document.removeEventListener('keydown', handleEscapeKey);
      }
    };
  }, [isOpen, onClose, triggerRef, menuRef, closeOnEscape, focusOnEscape]);
};

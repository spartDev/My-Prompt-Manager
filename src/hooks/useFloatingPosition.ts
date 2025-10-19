import { computePosition, flip, offset, autoUpdate } from '@floating-ui/dom';
import { useEffect, RefObject } from 'react';

/**
 * Custom hook for positioning floating elements using Floating UI
 *
 * This hook automatically positions a floating element (like a dropdown menu)
 * relative to a reference element (like a button). It handles viewport boundaries,
 * scroll events, and dynamic content changes.
 *
 * @param isOpen - Whether the floating element is visible
 * @param referenceRef - Ref to the reference element (e.g., button)
 * @param floatingRef - Ref to the floating element (e.g., dropdown)
 *
 * @example
 * ```tsx
 * const buttonRef = useRef<HTMLButtonElement>(null);
 * const menuRef = useRef<HTMLDivElement>(null);
 * const [isOpen, setIsOpen] = useState(false);
 *
 * useFloatingPosition(isOpen, buttonRef, menuRef);
 *
 * return (
 *   <>
 *     <button ref={buttonRef} onClick={() => setIsOpen(!isOpen)}>Toggle</button>
 *     {isOpen && <div ref={menuRef}>Menu content</div>}
 *   </>
 * );
 * ```
 */
export const useFloatingPosition = (
  isOpen: boolean,
  referenceRef: RefObject<HTMLElement | null>,
  floatingRef: RefObject<HTMLElement | null>
): void => {
  useEffect(() => {
    // Only run positioning when dropdown is open and refs are available
     
    if (!isOpen || !referenceRef.current || !floatingRef.current) {
      return;
    }

    const reference = referenceRef.current;
    const floating = floatingRef.current;

    // Set up auto-update for position recalculation on scroll/resize
    const cleanup = autoUpdate(
      reference,
      floating,
      () => {
        // Compute optimal position with middleware
        void computePosition(reference, floating, {
          placement: 'bottom-start', // Default placement below reference element
          middleware: [
            offset(4), // 4px gap between reference and floating elements
            flip()     // Flip to opposite side if doesn't fit in viewport
          ]
        }).then(({ x, y }) => {
          // Apply computed position
          Object.assign(floating.style, {
            left: `${String(x)}px`,
            top: `${String(y)}px`,
          });
        });
      }
    );

    // Cleanup function removes auto-update listener
    return cleanup;
  }, [isOpen, referenceRef, floatingRef]);
};

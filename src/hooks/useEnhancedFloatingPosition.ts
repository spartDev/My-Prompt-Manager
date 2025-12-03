import {
  computePosition,
  flip,
  offset,
  shift,
  size,
  autoUpdate,
  Placement
} from '@floating-ui/dom';
import { useEffect, RefObject } from 'react';

export interface FloatingOptions {
  /** Placement of the floating element relative to reference */
  placement?: Placement;
  /** Offset from the reference element in pixels */
  offset?: number;
  /** Enable shifting to keep element in viewport */
  enableShift?: boolean;
  /** Enable flipping to opposite side if doesn't fit */
  enableFlip?: boolean;
  /** Maximum height for the floating element */
  maxHeight?: number;
  /** Padding from viewport edges when shifting */
  shiftPadding?: number;
  /** Match the width of the reference element */
  matchWidth?: boolean;
}

/**
 * Enhanced hook for positioning floating elements using Floating UI
 *
 * Improvements over basic useFloatingPosition:
 * - Configurable placement
 * - Shift middleware to prevent viewport overflow
 * - Size middleware to constrain height
 * - All options are configurable
 *
 * @param isOpen - Whether the floating element is visible
 * @param referenceRef - Ref to the reference element (e.g., button)
 * @param floatingRef - Ref to the floating element (e.g., dropdown)
 * @param options - Configuration options for positioning
 *
 * @example
 * ```tsx
 * useEnhancedFloatingPosition(isOpen, buttonRef, menuRef, {
 *   placement: 'bottom-start',
 *   offset: 8,
 *   enableShift: true,
 *   enableFlip: true,
 *   maxHeight: 400
 * });
 * ```
 */
export const useEnhancedFloatingPosition = (
  isOpen: boolean,
  referenceRef: RefObject<HTMLElement | null>,
  floatingRef: RefObject<HTMLElement | null>,
  options: FloatingOptions = {}
): void => {
  const {
    placement = 'bottom-start',
    offset: offsetValue = 4,
    enableShift = true,
    enableFlip = true,
    maxHeight = 400,
    shiftPadding = 8,
    matchWidth = false
  } = options;

  useEffect(() => {
    // Only run positioning when dropdown is open and refs are available
    if (!isOpen || !referenceRef.current || !floatingRef.current) {
      return;
    }

    const reference = referenceRef.current;
    const floating = floatingRef.current;

    // Track mount status to prevent DOM mutations after unmount
    // Prevents memory leaks and React warnings from async computePosition
    let isMounted = true;

    // Build middleware array based on options
    const middleware = [
      // Offset from reference element
      offset(offsetValue),

      // Flip to opposite side if doesn't fit
      enableFlip && flip({
        fallbackAxisSideDirection: 'start',
      }),

      // Shift along axis to keep in viewport
      enableShift && shift({
        padding: shiftPadding
      }),

      // Constrain size to available space
      size({
        apply({ availableHeight, elements, rects }) {
          // Only mutate DOM if component is still mounted
          if (isMounted) {
            const styles: Record<string, string> = {
              maxHeight: `${String(Math.min(availableHeight - 16, maxHeight))}px`,
              overflow: 'auto'
            };
            // Match width of reference element if enabled
            if (matchWidth) {
              styles.minWidth = `${String(rects.reference.width)}px`;
            }
            Object.assign(elements.floating.style, styles);
          }
        },
        padding: shiftPadding
      })
    ].filter(Boolean);

    // Set up auto-update for position recalculation on scroll/resize
    const cleanup = autoUpdate(
      reference,
      floating,
      () => {
        // Compute optimal position with middleware
        void computePosition(reference, floating, {
          placement,
          middleware
        }).then(({ x, y }) => {
          // Only apply position if component is still mounted
          // Prevents React warnings and memory leaks from unmounted DOM mutations
          if (isMounted) {
            Object.assign(floating.style, {
              left: `${String(x)}px`,
              top: `${String(y)}px`,
            });
          }
        });
      },
      {
        // Options for auto-update
        animationFrame: true // Use animation frame for smooth updates
      }
    );

    // Cleanup function marks component as unmounted and removes auto-update listener
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [isOpen, referenceRef, floatingRef, placement, offsetValue, enableShift, enableFlip, maxHeight, shiftPadding, matchWidth]);
};
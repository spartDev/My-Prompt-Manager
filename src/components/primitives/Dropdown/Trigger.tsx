import { ReactElement, cloneElement, forwardRef, MouseEvent, KeyboardEvent, useCallback } from 'react';

import { useDropdownContext } from './DropdownContext';

export interface TriggerProps {
  /**
   * Whether to render as child element without wrapper
   * When true, passes props to child element directly
   */
  asChild?: boolean;
  /** Child element(s) to render as trigger */
  children: ReactElement;
  /** Additional class name */
  className?: string;
}

interface ChildProps {
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  className?: string;
}

/**
 * Trigger component for Dropdown
 * Handles opening/closing the dropdown and ARIA attributes
 *
 * @example
 * ```tsx
 * <Dropdown.Trigger asChild>
 *   <button>Open Menu</button>
 * </Dropdown.Trigger>
 * ```
 */
export const Trigger = forwardRef<HTMLElement, TriggerProps>(
  ({ asChild = false, children, className }, ref) => {
    const { isOpen, onOpenChange, triggerRef, dropdownId, setFocusedIndex } = useDropdownContext();

    const handleClick = (event: MouseEvent<HTMLElement>) => {
      // Toggle dropdown open state
      onOpenChange(!isOpen);

      // Reset focus index when opening
      if (!isOpen) {
        setFocusedIndex(-1);
      }

      // Call original onClick if exists
      const childProps = children.props as ChildProps;
      if (asChild && childProps.onClick) {
        childProps.onClick(event);
      }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      // Open dropdown with arrow down
      if (event.key === 'ArrowDown' && !isOpen) {
        event.preventDefault();
        onOpenChange(true);
        // Focus first item when opening with keyboard
        setFocusedIndex(0);
      }

      // Open dropdown with arrow up
      if (event.key === 'ArrowUp' && !isOpen) {
        event.preventDefault();
        onOpenChange(true);
        // Focus last item when opening with arrow up
        setFocusedIndex(-2); // Special value for last item
      }

      // Toggle with Enter or Space
      if ((event.key === 'Enter' || event.key === ' ') && !isOpen) {
        event.preventDefault();
        onOpenChange(true);
        setFocusedIndex(0);
      }

      // Call original onKeyDown if exists
      const childProps = children.props as ChildProps;
      if (asChild && childProps.onKeyDown) {
        childProps.onKeyDown(event);
      }
    };

    // Create a callback ref that sets both refs
    const setRefs = useCallback((node: HTMLElement | null) => {
      // Set triggerRef
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (triggerRef) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, react-hooks/immutability
        (triggerRef as any).current = node;
      }

      // Set forwarded ref
      if (ref) {
        if (typeof ref === 'function') {
          ref(node);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          (ref as any).current = node;
        }
      }
    }, [ref, triggerRef]);

    // ARIA attributes for accessibility
    const ariaProps = {
      'aria-haspopup': 'menu' as const,
      'aria-expanded': isOpen,
      'aria-controls': isOpen ? `${dropdownId}-content` : undefined,
      id: `${dropdownId}-trigger`
    };

    // Get child props safely
    const childProps = children.props as ChildProps;
    const mergedClassName = className || childProps.className;

    // Common props for trigger element
    const triggerProps = {
      ...ariaProps,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      className: mergedClassName,
      ref: setRefs
    };

    // If asChild, clone the child element with merged props
    if (asChild) {
      return cloneElement(children, triggerProps);
    }

    // Otherwise, wrap in a button
    return (
      <button type="button" {...triggerProps}>
        {children}
      </button>
    );
  }
);

Trigger.displayName = 'Dropdown.Trigger';
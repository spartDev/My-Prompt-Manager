import { useState, useRef, useId, useCallback, ReactNode } from 'react';

import { DropdownContext } from './DropdownContext';

export interface RootProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Whether to close dropdown when item is selected */
  closeOnSelect?: boolean;
  /** Whether dropdown is modal (traps focus) */
  modal?: boolean;
  /** Children components */
  children: ReactNode;
}

/**
 * Root component for Dropdown
 * Provides context and state management for all child components
 *
 * @example
 * ```tsx
 * <Dropdown.Root>
 *   <Dropdown.Trigger>Open</Dropdown.Trigger>
 *   <Dropdown.Content>
 *     <Dropdown.Item>Option 1</Dropdown.Item>
 *   </Dropdown.Content>
 * </Dropdown.Root>
 * ```
 */
export const Root = ({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  closeOnSelect = true,
  modal = false,
  children
}: RootProps) => {
  // Support both controlled and uncontrolled modes
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  // Handle open state changes
  const onOpenChange = useCallback((open: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(open);
    } else {
      setUncontrolledOpen(open);
    }
  }, [isControlled, controlledOnOpenChange]);

  // Refs for trigger and content elements
  const triggerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  // Focus management
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Unique ID for ARIA attributes
  const dropdownId = useId();

  return (
    <DropdownContext.Provider
      value={{
        isOpen,
        onOpenChange,
        triggerRef,
        contentRef,
        focusedIndex,
        setFocusedIndex,
        closeOnSelect,
        dropdownId,
        modal
      }}
    >
      {children}
    </DropdownContext.Provider>
  );
};
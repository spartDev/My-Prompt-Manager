import { createContext, useContext, RefObject } from 'react';

export interface DropdownContextValue {
  /** Whether the dropdown is open */
  isOpen: boolean;
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void;
  /** Ref to the trigger element */
  triggerRef: RefObject<HTMLElement>;
  /** Ref to the content element */
  contentRef: RefObject<HTMLElement>;
  /** Currently focused item index */
  focusedIndex: number;
  /** Set the focused item index */
  setFocusedIndex: (index: number) => void;
  /** Close the dropdown when an item is selected */
  closeOnSelect: boolean;
  /** ID for ARIA attributes */
  dropdownId: string;
  /** Whether the dropdown is modal (traps focus) */
  modal: boolean;
}

export const DropdownContext = createContext<DropdownContextValue | null>(null);

/**
 * Hook to access dropdown context
 * @throws Error if used outside of Dropdown.Root
 */
export const useDropdownContext = (): DropdownContextValue => {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error(
      'Dropdown components must be used within Dropdown.Root. ' +
      'Make sure you wrap your dropdown components with <Dropdown.Root>'
    );
  }
  return context;
};
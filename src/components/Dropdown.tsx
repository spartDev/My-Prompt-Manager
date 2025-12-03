import type { Placement } from '@floating-ui/dom';
import {
  FC,
  ReactElement,
  ReactNode,
  cloneElement,
  useRef,
  useState,
  createContext,
  useContext,
  useEffect,
  useId
} from 'react';
import { createPortal } from 'react-dom';

import { useEnhancedFloatingPosition, useDropdownClose } from '../hooks';
import { cn } from '../utils';

// Context for custom content to access dropdown controls
interface DropdownContextValue {
  close: () => void;
  isOpen: boolean;
}

const DropdownContext = createContext<DropdownContextValue>({
  close: () => {},
  isOpen: false
});

// Export hook for custom content to use
export const useDropdown = () => useContext(DropdownContext);

// Dropdown items type for simple list mode
export interface DropdownItem {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  /** Type of item - 'separator' items render as dividers */
  type?: 'item' | 'separator';
}

// Main dropdown props
export interface DropdownProps {
  /** The trigger element (button, etc.) */
  trigger: ReactElement;
  /** Items for simple list mode (mutually exclusive with children) */
  items?: DropdownItem[];
  /** Custom content (mutually exclusive with items) */
  children?: ReactNode;
  /** Placement of dropdown relative to trigger */
  placement?: Placement;
  /** Whether to close on item selection (default: true) */
  closeOnSelect?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Additional CSS classes for dropdown content */
  className?: string;
  /** Additional CSS classes for items */
  itemClassName?: string;
  /** Whether to render in a portal (default: true) */
  portal?: boolean;
  /** Container for portal (default: document.body). If invalid or not in document, falls back to document.body */
  portalContainer?: HTMLElement;
  /** Offset from trigger in pixels */
  offset?: number;
  /** Whether to close on escape key (default: true) */
  closeOnEscape?: boolean;
  /** Whether to focus trigger on close (default: true) */
  focusTriggerOnClose?: boolean;
  /** Optional aria-label for the dropdown menu */
  ariaLabel?: string;
  /** Match the width of the trigger element */
  matchWidth?: boolean;
}

/**
 * Flexible dropdown component that supports both simple item lists and custom content
 *
 * @example
 * // Simple list mode
 * <Dropdown
 *   trigger={<button>Open Menu</button>}
 *   items={[
 *     { id: '1', label: 'Option 1', onSelect: handleOption1 },
 *     { id: '2', label: 'Option 2', onSelect: handleOption2 }
 *   ]}
 * />
 *
 * @example
 * // Custom content mode
 * <Dropdown trigger={<button>Open</button>}>
 *   <div className="p-4">
 *     <CustomContent />
 *   </div>
 * </Dropdown>
 */
export const Dropdown: FC<DropdownProps> = ({
  trigger,
  items,
  children,
  placement = 'bottom-start',
  closeOnSelect = true,
  open: controlledOpen,
  onOpenChange,
  className,
  itemClassName,
  portal = true,
  portalContainer = document.body,
  offset = 4,
  closeOnEscape = true,
  focusTriggerOnClose = true,
  ariaLabel,
  matchWidth = false
}) => {
  // State management - support both controlled and uncontrolled modes
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  // Generate unique IDs for ARIA relationships
  const dropdownId = useId();

  // Refs for positioning and close detection
  const triggerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle open state changes
  const handleOpenChange = (open: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(open);
    }
    onOpenChange?.(open);
  };

  // Toggle function for trigger click
  const handleToggle = () => {
    handleOpenChange(!isOpen);
  };

  // Close function for context
  const handleClose = () => {
    handleOpenChange(false);
  };

  // Use positioning hook
  useEnhancedFloatingPosition(isOpen, triggerRef, contentRef, {
    placement,
    offset,
    enableShift: true,
    enableFlip: true,
    maxHeight: 400,
    matchWidth
  });

  // Use close detection hook
  useDropdownClose({
    isOpen,
    onClose: handleClose,
    triggerRef,
    menuRef: contentRef,
    closeOnEscape,
    focusOnEscape: focusTriggerOnClose ? triggerRef : undefined
  });

  // Handle keyboard navigation for items mode
  useEffect(() => {
    if (!isOpen || !items || !contentRef.current) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const itemElements = contentRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="menuitem"]:not([disabled])'
      );

      if (!itemElements || itemElements.length === 0) {
        return;
      }

      const currentIndex = Array.from(itemElements).findIndex(
        el => el === document.activeElement
      );

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const nextIndex = currentIndex < itemElements.length - 1 ? currentIndex + 1 : 0;
          itemElements[nextIndex].focus();
          break;
        }

        case 'ArrowUp': {
          event.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : itemElements.length - 1;
          itemElements[prevIndex].focus();
          break;
        }

        case 'Home':
          event.preventDefault();
          itemElements[0].focus();
          break;

        case 'End':
          event.preventDefault();
          itemElements[itemElements.length - 1].focus();
          break;

        case 'Enter':
        case ' ':
          if (document.activeElement instanceof HTMLButtonElement) {
            event.preventDefault();
            document.activeElement.click();
          }
          break;
      }
    };

    // Store ref to avoid stale closure
    const contentElement = contentRef.current;

    // Attach keyboard listener
    contentElement.addEventListener('keydown', handleKeyDown);

    // Focus first item when opened with keyboard
    if (items.length > 0) {
      const firstItem = contentElement.querySelector<HTMLButtonElement>(
        'button[role="menuitem"]:not([disabled])'
      );

      // Only auto-focus if the trigger was activated with keyboard
      if (document.activeElement === triggerRef.current) {
        firstItem?.focus();
      }
    }

    return () => {
      contentElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, items]);

  // Define interface for trigger element props we need to extract
  interface TriggerHandlers {
    onClick?: (e: React.MouseEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    id?: string;
  }

  // Type guards for proper function signature validation
  const isMouseEventHandler = (fn: unknown): fn is (e: React.MouseEvent) => void => {
    return typeof fn === 'function';
  };

  const isKeyboardEventHandler = (fn: unknown): fn is (e: React.KeyboardEvent) => void => {
    return typeof fn === 'function';
  };

  // Helper to safely extract trigger handlers with runtime validation
  const extractTriggerHandlers = (props: unknown): TriggerHandlers => {
    if (!props || typeof props !== 'object') {
      return { onClick: undefined, onKeyDown: undefined, id: undefined };
    }

    const obj = props as Record<string, unknown>;
    return {
      onClick: isMouseEventHandler(obj.onClick) ? obj.onClick : undefined,
      onKeyDown: isKeyboardEventHandler(obj.onKeyDown) ? obj.onKeyDown : undefined,
      id: typeof obj.id === 'string' ? obj.id : undefined
    };
  };

  // Extract trigger props with runtime validation
  const triggerHandlers = extractTriggerHandlers(trigger.props);

  // Define the props type for cloneElement to avoid unsafe type assertions
  type EnhancedTriggerProps = React.HTMLAttributes<HTMLElement> & {
    ref: React.Ref<HTMLElement>;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu' | 'dialog';
    'aria-controls': string;
  };

  // Build enhanced trigger props with proper typing
  const enhancedTriggerProps: EnhancedTriggerProps = {
    ref: triggerRef,
    onClick: (e: React.MouseEvent) => {
      triggerHandlers.onClick?.(e);
      handleToggle();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      // Handle Space and Enter keys to toggle dropdown and prevent scrolling
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggle();
      }
      triggerHandlers.onKeyDown?.(e);
    },
    'aria-expanded': isOpen,
    'aria-haspopup': items ? 'menu' : 'dialog',
    'aria-controls': dropdownId
  };

  // SAFETY: Using ref callback pattern which is safe with cloneElement.
  // The ref is assigned synchronously during render, and triggerRef is stable
  // across renders because it's created with useRef outside this function.
  // This pattern is documented in React docs: https://react.dev/reference/react/cloneElement#caveats
  // We must disable the rule because ESLint doesn't recognize this safe usage.
  // eslint-disable-next-line react-hooks/refs -- Safe: ref callback with stable useRef
  const enhancedTrigger = cloneElement(trigger, enhancedTriggerProps);

  // Validate portal container - ensure it's a valid HTMLElement in the document
  // Falls back to document.body if invalid to prevent runtime errors
  const getValidPortalContainer = (): HTMLElement => {
    // Check if portalContainer is a valid HTMLElement and is connected to the document
    // Note: portalContainer has a default value of document.body, but could be overridden with an invalid element
    if (
      portalContainer instanceof HTMLElement &&
      portalContainer.isConnected // Ensure element is in the document
    ) {
      return portalContainer;
    }

    // Fallback to document.body if validation fails
    return document.body;
  };

  const validPortalContainer = getValidPortalContainer();

  // Render dropdown content
  const dropdownContent = isOpen ? (
    <div
      ref={contentRef}
      id={dropdownId}
      role={items ? 'menu' : 'dialog'}
      aria-label={ariaLabel}
      aria-labelledby={!ariaLabel ? triggerHandlers.id : undefined}
      className={cn(
        'absolute z-50 min-w-[8rem] overflow-hidden',
        'rounded-xl border bg-white shadow-lg',
        'dark:bg-gray-800 dark:border-gray-700',
        'animate-in fade-in-0 zoom-in-95',
        className
      )}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      {items ? (
        // Simple list mode
        <div className="py-1">
          {items.map(item => {
            // Check if this is a separator (special case)
            // Use explicit type field or fallback to id check for backward compatibility
            if (item.type === 'separator' || item.id === 'separator') {
              return (
                <div key={item.id} role="separator" className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
              );
            }

            // Regular menu item
            return (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    item.onSelect();
                    if (closeOnSelect) {
                      handleClose();
                    }
                  }
                }}
                className={cn(
                  'flex w-full items-center px-3 py-2 text-sm',
                  'text-gray-700 dark:text-gray-300',
                  'hover:bg-gray-100 dark:hover:bg-gray-700',
                  'focus:bg-gray-100 dark:focus:bg-gray-700',
                  'focus:outline-none transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  item.disabled && 'hover:bg-transparent dark:hover:bg-transparent',
                  item.className,
                  itemClassName
                )}
              >
                {item.icon && (
                  <span className="mr-2 flex-shrink-0">{item.icon}</span>
                )}
                <span className="text-left flex-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        // Custom content mode - provide context
        <DropdownContext.Provider value={{ close: handleClose, isOpen }}>
          {children}
        </DropdownContext.Provider>
      )}
    </div>
  ) : null;

  return (
    <>
      {enhancedTrigger}
      {portal && dropdownContent
        ? createPortal(dropdownContent, validPortalContainer)
        : dropdownContent}
    </>
  );
};

// Export a separator component for visual separation in item lists
export const DropdownSeparator: FC<{ className?: string }> = ({ className }) => (
  <div
    role="separator"
    className={cn('my-1 h-px bg-gray-200 dark:bg-gray-700', className)}
  />
);
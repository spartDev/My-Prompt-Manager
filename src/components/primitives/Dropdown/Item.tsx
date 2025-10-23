import { ReactNode, forwardRef, MouseEvent, KeyboardEvent, useRef, useEffect } from 'react';

import { useDropdownContext } from './DropdownContext';

export interface ItemProps {
  /** Content to display in the item */
  children: ReactNode;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Callback when item is selected */
  onSelect?: (event: Event) => void;
  /** Text value for typeahead (defaults to text content) */
  textValue?: string;
  /** CSS class name */
  className?: string;
  /** Whether this item should close dropdown on select */
  closeOnSelect?: boolean;
}

/**
 * Item component for Dropdown
 * Represents a selectable item with keyboard navigation support
 *
 * @example
 * ```tsx
 * <Dropdown.Item onSelect={handleEdit}>
 *   Edit
 * </Dropdown.Item>
 * ```
 */
export const Item = forwardRef<HTMLDivElement, ItemProps>(
  (
    {
      children,
      disabled = false,
      onSelect,
      textValue: _textValue,
      className = '',
      closeOnSelect: itemCloseOnSelect
    },
    ref
  ) => {
    const {
      onOpenChange,
      closeOnSelect: rootCloseOnSelect,
      focusedIndex,
      setFocusedIndex,
      triggerRef
    } = useDropdownContext();

    const itemRef = useRef<HTMLDivElement>(null);
    const shouldCloseOnSelect = itemCloseOnSelect ?? rootCloseOnSelect;

    // Get the item's index within the menu
    useEffect(() => {
      const item = itemRef.current;
      if (!item) {return;}

      const menu = item.closest('[role="menu"]');
      if (!menu) {return;}

      const items = Array.from(menu.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])'));
      const index = items.indexOf(item);

      // Focus this item if it matches the focused index
      if (index === focusedIndex) {
        item.focus();
      }

      // Special case: focus last item
      if (focusedIndex === -2 && index === items.length - 1) {
        item.focus();
        setFocusedIndex(index);
      }
    }, [focusedIndex, setFocusedIndex]);

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }

      // Fire onSelect callback
      onSelect?.(new Event('select'));

      // Close dropdown if configured
      if (shouldCloseOnSelect) {
        onOpenChange(false);
        // Return focus to trigger
        triggerRef.current.focus();
      }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const menu = itemRef.current?.closest('[role="menu"]');
      if (!menu || !itemRef.current) {return;}

      const items = Array.from(menu.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])'));
      const currentIndex = items.indexOf(itemRef.current);

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          // Move to next item (wrap to first)
          const nextIndex = (currentIndex + 1) % items.length;
          setFocusedIndex(nextIndex);
          break;
        }

        case 'ArrowUp': {
          event.preventDefault();
          // Move to previous item (wrap to last)
          const prevIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
          setFocusedIndex(prevIndex);
          break;
        }

        case 'Home':
          event.preventDefault();
          // Move to first item
          setFocusedIndex(0);
          break;

        case 'End':
          event.preventDefault();
          // Move to last item
          setFocusedIndex(items.length - 1);
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          if (!disabled) {
            const mockEvent = new MouseEvent('click', { bubbles: true });
            handleClick(mockEvent as unknown as MouseEvent<HTMLDivElement>);
          }
          break;

        case 'Tab':
          // Let Tab close the dropdown and move focus naturally
          event.preventDefault();
          onOpenChange(false);
          triggerRef.current.focus();
          break;
      }
    };

    // Default classes for styling
    const itemClasses = `
      relative flex cursor-pointer select-none items-center
      px-3 py-2.5 text-sm outline-none
      transition-colors duration-150
      hover:bg-purple-50 dark:hover:bg-purple-900/20
      focus:bg-purple-50 dark:focus:bg-purple-900/20
      disabled:pointer-events-none disabled:opacity-50
      ${className}
    `.trim();

    return (
      <div
        ref={(node) => {
          // Set both refs using Object.defineProperty
          if (node !== null) {
            Object.defineProperty(itemRef, 'current', {
              writable: true,
              value: node
            });
          }
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref && node !== null) {
            Object.defineProperty(ref, 'current', {
              writable: true,
              value: node
            });
          }
        }}
        role="menuitem"
        tabIndex={disabled ? -1 : -1} // Use roving tabindex
        aria-disabled={disabled}
        className={itemClasses}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        data-disabled={disabled}
      >
        {children}
      </div>
    );
  }
);

Item.displayName = 'Dropdown.Item';
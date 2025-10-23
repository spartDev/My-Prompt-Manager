import { Placement } from '@floating-ui/dom';
import { ReactNode, forwardRef, useEffect, CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { Z_INDEX } from '../../../constants/ui';
import { useDropdownClose } from '../../../hooks/useDropdownClose';
import { useEnhancedFloatingPosition } from '../../../hooks/useEnhancedFloatingPosition';

import { useDropdownContext } from './DropdownContext';


export interface ContentProps {
  /** Children to render in dropdown */
  children: ReactNode;
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Whether to render in a portal */
  portal?: boolean;
  /** Custom portal container */
  portalContainer?: HTMLElement;
  /** Positioning placement */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Alignment relative to trigger */
  align?: 'start' | 'center' | 'end';
  /** Offset from trigger in pixels */
  sideOffset?: number;
  /** Prevent collisions with viewport edges */
  avoidCollisions?: boolean;
  /** Close when clicking outside */
  closeOnClickOutside?: boolean;
  /** Close when pressing Escape */
  closeOnEscape?: boolean;
  /** Callback when Escape is pressed */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** Callback when clicking outside */
  onInteractOutside?: (event: Event) => void;
  /** Maximum height for content */
  maxHeight?: number;
}

/**
 * Content component for Dropdown
 * Renders dropdown content with positioning and portal support
 *
 * @example
 * ```tsx
 * <Dropdown.Content
 *   side="bottom"
 *   align="start"
 *   sideOffset={4}
 *   portal={true}
 * >
 *   <Dropdown.Item>Option 1</Dropdown.Item>
 * </Dropdown.Content>
 * ```
 */
export const Content = forwardRef<HTMLDivElement, ContentProps>(
  (
    {
      children,
      className = '',
      style,
      portal = true,
      portalContainer,
      side = 'bottom',
      align = 'start',
      sideOffset = 4,
      avoidCollisions = true,
      closeOnClickOutside: _closeOnClickOutside = true,
      closeOnEscape = true,
      onEscapeKeyDown,
      onInteractOutside,
      maxHeight = 400
    },
    ref
  ) => {
    const { isOpen, onOpenChange, triggerRef, contentRef, dropdownId } = useDropdownContext();

    // Convert side/align to Placement
    const placement: Placement = `${side}${align === 'center' ? '' : `-${align}`}` as Placement;

    // Position the dropdown using floating-ui
    useEnhancedFloatingPosition(isOpen, triggerRef, contentRef, {
      placement,
      offset: sideOffset,
      enableShift: avoidCollisions,
      enableFlip: avoidCollisions,
      maxHeight
    });

    // Handle close interactions
    useDropdownClose({
      isOpen,
      onClose: () => {
        onOpenChange(false);
        onInteractOutside?.(new Event('click'));
      },
      triggerRef,
      menuRef: contentRef,
      closeOnEscape: false // We handle escape separately below
    });

    // Handle Escape key with custom callback
    useEffect(() => {
      if (!isOpen || !closeOnEscape) {return;}

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onEscapeKeyDown?.(event);
          if (!event.defaultPrevented) {
            onOpenChange(false);
            triggerRef.current.focus();
          }
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => { document.removeEventListener('keydown', handleEscape); };
    }, [isOpen, closeOnEscape, onEscapeKeyDown, onOpenChange, triggerRef]);

    // Don't render if closed
    if (!isOpen) {return null;}

    // Base styles for dropdown content
    const contentStyles: CSSProperties = {
      position: 'fixed',
      zIndex: Z_INDEX.DROPDOWN,
      outline: 'none',
      ...style
    };

    // Default classes for styling
    const contentClasses = `
      min-w-[8rem] overflow-hidden rounded-xl
      bg-white dark:bg-gray-800
      shadow-xl dark:shadow-2xl
      border border-gray-200 dark:border-gray-700
      backdrop-blur-sm
      animate-in fade-in-0 zoom-in-95
      ${className}
    `.trim();

    const contentElement = (
      <div
        ref={(node) => {
          // Use Object.defineProperty to bypass readonly constraint
          if (node !== null) {
            Object.defineProperty(contentRef, 'current', {
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
        id={`${dropdownId}-content`}
        role="menu"
        aria-labelledby={`${dropdownId}-trigger`}
        className={contentClasses}
        style={contentStyles}
        data-state="open"
        data-side={side}
        data-align={align}
      >
        {children}
      </div>
    );

    // Render in portal or inline
    if (portal) {
      const container = portalContainer || document.body;
      return createPortal(contentElement, container);
    }

    return contentElement;
  }
);

Content.displayName = 'Dropdown.Content';
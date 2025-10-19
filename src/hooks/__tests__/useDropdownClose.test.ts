import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useDropdownClose } from '../useDropdownClose';

describe('useDropdownClose', () => {
  let triggerElement: HTMLButtonElement;
  let menuElement: HTMLDivElement;
  let outsideElement: HTMLDivElement;

  beforeEach(() => {
    // Create DOM elements
    triggerElement = document.createElement('button');
    menuElement = document.createElement('div');
    outsideElement = document.createElement('div');

    document.body.appendChild(triggerElement);
    document.body.appendChild(menuElement);
    document.body.appendChild(outsideElement);
  });

  afterEach(() => {
    // Clean up DOM
    document.body.removeChild(triggerElement);
    document.body.removeChild(menuElement);
    document.body.removeChild(outsideElement);
    vi.clearAllMocks();
  });

  describe('Click Outside Behavior', () => {
    it('should call onClose when clicking outside trigger and menu', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Click outside
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when clicking trigger element', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Click trigger
      triggerElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not call onClose when clicking menu element', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Click menu
      menuElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not call onClose when clicking child of menu element', () => {
      const onClose = vi.fn();
      const menuChild = document.createElement('button');
      menuElement.appendChild(menuChild);

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Click menu child
      menuChild.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(onClose).not.toHaveBeenCalled();

      menuElement.removeChild(menuChild);
    });
  });

  describe('Escape Key Behavior', () => {
    it('should call onClose when Escape key is pressed (default behavior)', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose for non-Escape keys', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Press other keys
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should not attach Escape listener when closeOnEscape is false', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef,
          closeOnEscape: false
        });
      });

      // Press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Focus Restoration', () => {
    it('should focus trigger element on Escape when no focusOnEscape provided', () => {
      const onClose = vi.fn();
      const focusSpy = vi.spyOn(triggerElement, 'focus');

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(focusSpy).toHaveBeenCalledTimes(1);
    });

    it('should focus custom element on Escape when focusOnEscape provided', () => {
      const onClose = vi.fn();
      const customFocusElement = document.createElement('button');
      document.body.appendChild(customFocusElement);

      const focusSpy = vi.spyOn(customFocusElement, 'focus');

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);
        const customFocusRef = useRef<HTMLButtonElement>(customFocusElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef,
          focusOnEscape: customFocusRef
        });
      });

      // Press Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(focusSpy).toHaveBeenCalledTimes(1);

      document.body.removeChild(customFocusElement);
    });
  });

  describe('isOpen State Management', () => {
    it('should not attach listeners when isOpen is false', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: false,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Try click outside
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      // Try Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should clean up listeners when isOpen changes from true to false', () => {
      const onClose = vi.fn();
      let isOpen = true;

      const { rerender } = renderHook(
        ({ open }: { open: boolean }) => {
          const triggerRef = useRef<HTMLButtonElement>(triggerElement);
          const menuRef = useRef<HTMLDivElement>(menuElement);

          useDropdownClose({
            isOpen: open,
            onClose,
            triggerRef,
            menuRef
          });
        },
        { initialProps: { open: isOpen } }
      );

      // Close dropdown
      isOpen = false;
      rerender({ open: isOpen });

      // Try click outside - should not call onClose because listeners are cleaned up
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should attach listeners when isOpen changes from false to true', () => {
      const onClose = vi.fn();
      let isOpen = false;

      const { rerender } = renderHook(
        ({ open }: { open: boolean }) => {
          const triggerRef = useRef<HTMLButtonElement>(triggerElement);
          const menuRef = useRef<HTMLDivElement>(menuElement);

          useDropdownClose({
            isOpen: open,
            onClose,
            triggerRef,
            menuRef
          });
        },
        { initialProps: { open: isOpen } }
      );

      // Initially closed - should not trigger
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      // Open dropdown
      isOpen = true;
      rerender({ open: isOpen });

      // Now should trigger
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null refs gracefully', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(null);
        const menuRef = useRef<HTMLDivElement>(null);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Should not throw
      expect(() => {
        outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      }).not.toThrow();

      // Should not call onClose when refs are null (can't determine if outside)
      expect(onClose).not.toHaveBeenCalled();
    });

    it('should handle multiple rapid clicks', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Rapid clicks outside
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('should handle Escape key while click listener is also active', () => {
      const onClose = vi.fn();

      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(triggerElement);
        const menuRef = useRef<HTMLDivElement>(menuElement);

        useDropdownClose({
          isOpen: true,
          onClose,
          triggerRef,
          menuRef
        });
      });

      // Both interactions should work
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(1);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should simulate typical dropdown interaction flow', () => {
      const onClose = vi.fn();
      let isOpen = false;

      const { rerender } = renderHook(
        ({ open }: { open: boolean }) => {
          const triggerRef = useRef<HTMLButtonElement>(triggerElement);
          const menuRef = useRef<HTMLDivElement>(menuElement);

          useDropdownClose({
            isOpen: open,
            onClose,
            triggerRef,
            menuRef
          });
        },
        { initialProps: { open: isOpen } }
      );

      // 1. User opens dropdown (simulated elsewhere)
      isOpen = true;
      rerender({ open: isOpen });

      // 2. User clicks inside menu - should not close
      menuElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).not.toHaveBeenCalled();

      // 3. User clicks outside - should close
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple dropdowns independently', () => {
      const onClose1 = vi.fn();
      const onClose2 = vi.fn();

      const trigger1 = document.createElement('button');
      const menu1 = document.createElement('div');
      const trigger2 = document.createElement('button');
      const menu2 = document.createElement('div');

      document.body.appendChild(trigger1);
      document.body.appendChild(menu1);
      document.body.appendChild(trigger2);
      document.body.appendChild(menu2);

      // First dropdown
      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(trigger1);
        const menuRef = useRef<HTMLDivElement>(menu1);

        useDropdownClose({
          isOpen: true,
          onClose: onClose1,
          triggerRef,
          menuRef
        });
      });

      // Second dropdown
      renderHook(() => {
        const triggerRef = useRef<HTMLButtonElement>(trigger2);
        const menuRef = useRef<HTMLDivElement>(menu2);

        useDropdownClose({
          isOpen: true,
          onClose: onClose2,
          triggerRef,
          menuRef
        });
      });

      // Click first menu - should not close dropdown1, but WILL close dropdown2
      // (because menu1 is "outside" of dropdown2's trigger and menu)
      menu1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose1).not.toHaveBeenCalled();
      expect(onClose2).toHaveBeenCalledTimes(1);

      // Reset
      onClose2.mockClear();

      // Click outside - should close both
      outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose1).toHaveBeenCalledTimes(1);
      expect(onClose2).toHaveBeenCalledTimes(1);

      document.body.removeChild(trigger1);
      document.body.removeChild(menu1);
      document.body.removeChild(trigger2);
      document.body.removeChild(menu2);
    });
  });
});

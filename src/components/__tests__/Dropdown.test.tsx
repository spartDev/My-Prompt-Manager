import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Dropdown, DropdownItem, DropdownSeparator, useDropdown } from '../Dropdown';

describe('Dropdown', () => {
  const mockItems: DropdownItem[] = [
    {
      id: '1',
      label: 'Option 1',
      onSelect: vi.fn()
    },
    {
      id: '2',
      label: 'Option 2',
      onSelect: vi.fn(),
      icon: <span>🎨</span>
    },
    {
      id: '3',
      label: 'Option 3',
      onSelect: vi.fn(),
      disabled: true
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders trigger button', () => {
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });

    it('does not render dropdown content when closed', () => {
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('applies aria-expanded false when closed', () => {
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('applies aria-haspopup menu for items mode', () => {
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('applies aria-haspopup dialog for custom content mode', () => {
      render(
        <Dropdown trigger={<button>Open Menu</button>}>
          <div>Custom Content</div>
        </Dropdown>
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    });
  });

  describe('Opening and Closing', () => {
    it('opens dropdown on trigger click', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('applies aria-expanded true when open', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });
      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('closes dropdown on second trigger click', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });

      // Open
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Close
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('opens dropdown with Space key', async () => {
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });
      trigger.focus();
      fireEvent.keyDown(trigger, { key: ' ' });

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('closes dropdown on Escape key', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('respects closeOnEscape=false', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
          closeOnEscape={false}
        />
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      // Should still be open
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });
  });

  describe('Items Mode', () => {
    it('renders all menu items', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /option 1/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /option 2/i })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /option 3/i })).toBeInTheDocument();
      });
    });

    it('renders item icons', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByText('🎨')).toBeInTheDocument();
      });
    });

    it('calls onSelect when item is clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const items: DropdownItem[] = [
        { id: '1', label: 'Test Item', onSelect }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /test item/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('menuitem', { name: /test item/i }));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('closes dropdown after item selection by default', async () => {
      const user = userEvent.setup();
      const items: DropdownItem[] = [
        { id: '1', label: 'Test Item', onSelect: vi.fn() }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('menuitem', { name: /test item/i }));

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('respects closeOnSelect=false', async () => {
      const user = userEvent.setup();
      const items: DropdownItem[] = [
        { id: '1', label: 'Test Item', onSelect: vi.fn() }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
          closeOnSelect={false}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('menuitem', { name: /test item/i }));

      // Should still be open
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('does not call onSelect for disabled items', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const items: DropdownItem[] = [
        { id: '1', label: 'Disabled Item', onSelect, disabled: true }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /disabled item/i })).toBeInTheDocument();
      });

      const disabledItem = screen.getByRole('menuitem', { name: /disabled item/i });
      expect(disabledItem).toBeDisabled();

      // Try to click disabled item
      await user.click(disabledItem);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('renders separators with type="separator"', async () => {
      const user = userEvent.setup();
      const items: DropdownItem[] = [
        { id: '1', label: 'Item 1', onSelect: vi.fn() },
        { id: 'sep', label: '', onSelect: vi.fn(), type: 'separator' },
        { id: '2', label: 'Item 2', onSelect: vi.fn() }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        const separator = screen.getByRole('separator');
        expect(separator).toBeInTheDocument();
      });
    });

    it('renders separators with legacy id="separator"', async () => {
      const user = userEvent.setup();
      const items: DropdownItem[] = [
        { id: '1', label: 'Item 1', onSelect: vi.fn() },
        { id: 'separator', label: '', onSelect: vi.fn() },
        { id: '2', label: 'Item 2', onSelect: vi.fn() }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        const separator = screen.getByRole('separator');
        expect(separator).toBeInTheDocument();
      });
    });

    it('applies custom className to items', async () => {
      const user = userEvent.setup();
      const items: DropdownItem[] = [
        { id: '1', label: 'Custom Item', onSelect: vi.fn(), className: 'custom-class' }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        const item = screen.getByRole('menuitem', { name: /custom item/i });
        expect(item).toHaveClass('custom-class');
      });
    });

    it('applies itemClassName to all items', async () => {
      const user = userEvent.setup();
      const items: DropdownItem[] = [
        { id: '1', label: 'Item 1', onSelect: vi.fn() },
        { id: '2', label: 'Item 2', onSelect: vi.fn() }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
          itemClassName="global-item-class"
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        const item1 = screen.getByRole('menuitem', { name: /item 1/i });
        const item2 = screen.getByRole('menuitem', { name: /item 2/i });
        expect(item1).toHaveClass('global-item-class');
        expect(item2).toHaveClass('global-item-class');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates down with ArrowDown key', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems.slice(0, 2)} // Only non-disabled items
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const menu = screen.getByRole('menu');
      const item1 = screen.getByRole('menuitem', { name: /option 1/i });
      const item2 = screen.getByRole('menuitem', { name: /option 2/i });

      // Focus first item manually
      item1.focus();

      // Arrow down moves to second item
      fireEvent.keyDown(menu, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(item2).toHaveFocus();
      });

      // Arrow down wraps to first item
      fireEvent.keyDown(menu, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(item1).toHaveFocus();
      });
    });

    it('navigates up with ArrowUp key', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems.slice(0, 2)}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const menu = screen.getByRole('menu');

      // ArrowUp from no focus should wrap to last item
      fireEvent.keyDown(menu, { key: 'ArrowUp' });

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /option 2/i })).toHaveFocus();
      });
    });

    it('focuses first item with Home key', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems.slice(0, 2)}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const menu = screen.getByRole('menu');
      fireEvent.keyDown(menu, { key: 'Home' });

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /option 1/i })).toHaveFocus();
      });
    });

    it('focuses last item with End key', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems.slice(0, 2)}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const menu = screen.getByRole('menu');
      fireEvent.keyDown(menu, { key: 'End' });

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /option 2/i })).toHaveFocus();
      });
    });

    it('activates focused item with Enter key', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const items: DropdownItem[] = [
        { id: '1', label: 'Test Item', onSelect }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const item = screen.getByRole('menuitem', { name: /test item/i });
      item.focus();
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('activates focused item with Space key', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const items: DropdownItem[] = [
        { id: '1', label: 'Test Item', onSelect }
      ];

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={items}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const item = screen.getByRole('menuitem', { name: /test item/i });
      item.focus();
      fireEvent.keyDown(item, { key: ' ' });

      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Content Mode', () => {
    it('renders custom content', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown trigger={<button>Open Menu</button>}>
          <div>Custom Content Here</div>
        </Dropdown>
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByText('Custom Content Here')).toBeInTheDocument();
      });
    });

    it('provides close function via useDropdown hook', async () => {
      const user = userEvent.setup();

      const CustomContent = () => {
        const { close } = useDropdown();
        return <button onClick={close}>Close Menu</button>;
      };

      render(
        <Dropdown trigger={<button>Open Menu</button>}>
          <CustomContent />
        </Dropdown>
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /close menu/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('provides isOpen state via useDropdown hook', async () => {
      const user = userEvent.setup();

      const CustomContent = () => {
        const { isOpen } = useDropdown();
        return <div>{isOpen ? 'Open' : 'Closed'}</div>;
      };

      render(
        <Dropdown trigger={<button>Open Menu</button>}>
          <CustomContent />
        </Dropdown>
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        expect(screen.getByText('Open')).toBeInTheDocument();
      });
    });
  });

  describe('Controlled Mode', () => {
    it('respects controlled open state', () => {
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
          open={true}
        />
      );

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('calls onOpenChange when opening', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
          onOpenChange={onOpenChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('calls onOpenChange when closing', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
          open={true}
          onOpenChange={onOpenChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Styling and Customization', () => {
    it('applies custom className to dropdown content', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
          className="custom-dropdown-class"
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        const menu = screen.getByRole('menu');
        expect(menu).toHaveClass('custom-dropdown-class');
      });
    });

    it('preserves original trigger onClick handler', async () => {
      const user = userEvent.setup();
      const originalOnClick = vi.fn();

      render(
        <Dropdown
          trigger={<button onClick={originalOnClick}>Open Menu</button>}
          items={mockItems}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      expect(originalOnClick).toHaveBeenCalled();
    });

    it('preserves original trigger onKeyDown handler', () => {
      const originalOnKeyDown = vi.fn();

      render(
        <Dropdown
          trigger={<button onKeyDown={originalOnKeyDown}>Open Menu</button>}
          items={mockItems}
        />
      );

      const trigger = screen.getByRole('button', { name: /open menu/i });
      fireEvent.keyDown(trigger, { key: 'a' });

      expect(originalOnKeyDown).toHaveBeenCalled();
    });
  });

  describe('Portal Rendering', () => {
    it('renders in portal by default', async () => {
      const user = userEvent.setup();
      render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        const menu = screen.getByRole('menu');
        // Portal renders in document.body
        expect(menu.parentElement).toBe(document.body);
      });
    });

    it('respects portal=false', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <Dropdown
          trigger={<button>Open Menu</button>}
          items={mockItems}
          portal={false}
        />
      );

      await user.click(screen.getByRole('button', { name: /open menu/i }));

      await waitFor(() => {
        const menu = screen.getByRole('menu');
        // Not in portal, should be in container
        expect(container.contains(menu)).toBe(true);
      });
    });
  });

  describe('DropdownSeparator Component', () => {
    it('renders separator with correct role', () => {
      render(<DropdownSeparator />);

      const separator = screen.getByRole('separator');
      expect(separator).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<DropdownSeparator className="custom-separator" />);

      const separator = screen.getByRole('separator');
      expect(separator).toHaveClass('custom-separator');
    });
  });
});

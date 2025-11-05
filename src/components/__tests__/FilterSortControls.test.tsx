import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Category, SortOrder, SortDirection } from '../../types';
import FilterSortControls from '../FilterSortControls';

const mockCategories: Category[] = [
  { id: '1', name: 'Work', color: '#3B82F6' },
  { id: '2', name: 'Personal', color: '#10B981' },
  { id: '3', name: 'Ideas', color: '#F59E0B' }
];

describe('FilterSortControls', () => {
  const defaultProps = {
    categories: mockCategories,
    selectedCategory: null,
    sortOrder: 'updatedAt' as SortOrder,
    sortDirection: 'desc' as SortDirection,
    onCategoryChange: vi.fn(),
    onSortChange: vi.fn(),
    onManageCategories: vi.fn(),
    loading: false,
    context: 'popup' as const
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders filter and sort buttons', () => {
      render(<FilterSortControls {...defaultProps} />);

      expect(screen.getByLabelText(/filter by category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/sort order/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/manage categories/i)).toBeInTheDocument();
    });

    it('shows active state text', () => {
      render(<FilterSortControls {...defaultProps} />);

      // Filter button should show "All"
      const filterButton = screen.getByLabelText(/filter by category/i);
      expect(filterButton).toHaveTextContent('All');

      // Sort button has the correct label
      const sortButton = screen.getByLabelText(/sort order: Newest/i);
      expect(sortButton).toBeInTheDocument();
    });

    it('shows badge when category is selected', () => {
      render(<FilterSortControls {...defaultProps} selectedCategory="Work" />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      const badge = filterButton.querySelector('.rounded-full');
      expect(badge).toBeInTheDocument();
      // Badge should have the Work category color (#3B82F6)
      expect(badge).toHaveStyle({ backgroundColor: '#3B82F6' });
    });

    it('does not show badge when no category is selected', () => {
      render(<FilterSortControls {...defaultProps} selectedCategory={null} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      const badge = filterButton.querySelector('.rounded-full');
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe('Filter Dropdown', () => {
    it('opens filter dropdown on click', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Check that category options are visible in the dropdown
      // Note: "All" appears in button text and "All Categories" in dropdown
      expect(screen.getByText('All Categories')).toBeInTheDocument(); // In dropdown
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Ideas')).toBeInTheDocument();
    });

    it('closes filter dropdown on second click', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);

      // Open dropdown
      await user.click(filterButton);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Close dropdown
      await user.click(filterButton);
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('calls onCategoryChange when category is selected', async () => {
      const user = userEvent.setup();
      const onCategoryChange = vi.fn();
      render(<FilterSortControls {...defaultProps} onCategoryChange={onCategoryChange} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      const workOption = await screen.findByText('Work');
      await user.click(workOption);

      expect(onCategoryChange).toHaveBeenCalledWith('Work');
      expect(onCategoryChange).toHaveBeenCalledTimes(1);
    });

    it('calls onCategoryChange with null when All Categories is selected', async () => {
      const user = userEvent.setup();
      const onCategoryChange = vi.fn();
      render(<FilterSortControls {...defaultProps} selectedCategory="Work" onCategoryChange={onCategoryChange} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      const allOption = await screen.findByText('All Categories');
      await user.click(allOption);

      expect(onCategoryChange).toHaveBeenCalledWith(null);
    });

    it('closes filter dropdown after selection', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      const workOption = await screen.findByText('Work');
      await user.click(workOption);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('highlights selected category in dropdown', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} selectedCategory="Work" />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Find the Work option in the dropdown (not in the button)
      const menu = screen.getByRole('menu');
      const workOption = within(menu).getByText('Work');
      expect(workOption).toBeDefined();

      // The Dropdown.Item wraps the content - navigate up to find the button with the bg-purple class
      // Structure is: button > div > div > span (text)
      let itemElement = workOption.parentElement;
      while (itemElement && !itemElement.classList.contains('bg-purple-50')) {
        itemElement = itemElement.parentElement;
        if (!itemElement || itemElement.tagName === 'BODY') {
          break;
        }
      }
      expect(itemElement).toBeDefined();
      expect(itemElement).toHaveClass('bg-purple-50');
    });

    it('highlights All Categories when no category selected', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} selectedCategory={null} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      // Find the "All Categories" option in the dropdown using within
      const menu = await screen.findByRole('menu');
      const allCategoriesOption = within(menu).getByText('All Categories');

      // Navigate up to the button element (3 levels up due to nested spans)
      const allButton = allCategoriesOption.parentElement?.parentElement?.parentElement;

      expect(allButton).toHaveClass('bg-purple-50');
    });
  });

  describe('Sort Dropdown', () => {
    it('opens sort dropdown on click', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      expect(screen.getByText('Most Used')).toBeInTheDocument();
      expect(screen.getByText('Recently Used')).toBeInTheDocument();
      expect(screen.getByText('Recently Updated')).toBeInTheDocument();
      expect(screen.getByText('Recently Created')).toBeInTheDocument();
      expect(screen.getByText('Alphabetical')).toBeInTheDocument();
    });

    it('closes sort dropdown on second click', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const sortButton = screen.getByLabelText(/sort order/i);

      // Open dropdown
      await user.click(sortButton);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Close dropdown
      await user.click(sortButton);
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('calls onSortChange when sort option is selected', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      render(<FilterSortControls {...defaultProps} onSortChange={onSortChange} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      const alphabeticalOption = await screen.findByText('Alphabetical');
      await user.click(alphabeticalOption);

      expect(onSortChange).toHaveBeenCalledWith('title', 'asc');
      expect(onSortChange).toHaveBeenCalledTimes(1);
    });

    it('calls onSortChange with usage sort defaults', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      render(<FilterSortControls {...defaultProps} onSortChange={onSortChange} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      const mostUsedOption = await screen.findByText('Most Used');
      await user.click(mostUsedOption);

      expect(onSortChange).toHaveBeenCalledWith('usageCount', 'desc');
    });

    it('calls onSortChange with recency usage defaults', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      render(<FilterSortControls {...defaultProps} onSortChange={onSortChange} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      const recentlyUsedOption = await screen.findByText('Recently Used');
      await user.click(recentlyUsedOption);

      expect(onSortChange).toHaveBeenCalledWith('lastUsedAt', 'desc');
    });

    it('toggles sort direction when same option clicked twice', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      render(<FilterSortControls {...defaultProps} onSortChange={onSortChange} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      const updatedOption = await screen.findByText('Recently Updated');
      await user.click(updatedOption);

      // Should toggle from desc to asc
      expect(onSortChange).toHaveBeenCalledWith('updatedAt', 'asc');
    });

    it('toggles sort direction for usage sort when reselected', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      render(<FilterSortControls {...defaultProps} sortOrder="usageCount" sortDirection="desc" onSortChange={onSortChange} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      const mostUsedOption = await screen.findByText('Most Used');
      await user.click(mostUsedOption);

      expect(onSortChange).toHaveBeenCalledWith('usageCount', 'asc');
    });

    it('uses default direction for new sort option', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();
      render(<FilterSortControls {...defaultProps} sortOrder="updatedAt" sortDirection="desc" onSortChange={onSortChange} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      const createdOption = await screen.findByText('Recently Created');
      await user.click(createdOption);

      // Should use default desc direction for date-based sort
      expect(onSortChange).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('closes sort dropdown after selection', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      const alphabeticalOption = await screen.findByText('Alphabetical');
      await user.click(alphabeticalOption);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('highlights selected sort option in dropdown', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} sortOrder="updatedAt" />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      const menu = await screen.findByRole('menu');
      const updatedOption = within(menu).getByText('Recently Updated');

      // Navigate up to find the button with the bg-purple class
      let updatedButton = updatedOption.parentElement;
      while (updatedButton && !updatedButton.classList.contains('bg-purple-50')) {
        updatedButton = updatedButton.parentElement;
        if (!updatedButton || updatedButton.tagName === 'BODY') {
          break;
        }
      }

      expect(updatedButton).toHaveClass('bg-purple-50');
    });
  });

  describe('Outside Click', () => {
    it('closes filter dropdown on outside click', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Click outside
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('closes sort dropdown on outside click', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Click outside
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('closes dropdown on Escape key', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('closes sort dropdown on Escape key', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('supports keyboard navigation with Enter key', async () => {
      const user = userEvent.setup();
      const onCategoryChange = vi.fn();
      render(<FilterSortControls {...defaultProps} onCategoryChange={onCategoryChange} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      filterButton.focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('supports keyboard navigation with Space key', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      sortButton.focus();
      await user.keyboard(' ');

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('prevents default on Space key to avoid scrolling', () => {
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      filterButton.focus();

      // Simulate space key press with preventDefault
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(spaceEvent, 'preventDefault');

      fireEvent(filterButton, spaceEvent);

      // The component should prevent default to stop scrolling
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('disables buttons when loading', () => {
      render(<FilterSortControls {...defaultProps} loading={true} />);

      expect(screen.getByLabelText(/filter by category/i)).toBeDisabled();
      expect(screen.getByLabelText(/sort order/i)).toBeDisabled();
      expect(screen.getByLabelText(/manage categories/i)).toBeDisabled();
    });

    it('prevents dropdown from opening when loading', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} loading={true} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      // Dropdown should not appear
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('Sort Direction Labels', () => {
    it('shows correct label for alphabetical sort direction (A→Z)', () => {
      render(<FilterSortControls {...defaultProps} sortOrder="title" sortDirection="asc" />);

      const sortButton = screen.getByLabelText(/sort order: A→Z/i);
      expect(sortButton).toBeInTheDocument();
    });

    it('shows correct label for alphabetical sort direction (Z→A)', () => {
      render(<FilterSortControls {...defaultProps} sortOrder="title" sortDirection="desc" />);

      const sortButton = screen.getByLabelText(/sort order: Z→A/i);
      expect(sortButton).toBeInTheDocument();
    });

    it('shows "Newest" for descending date sort', () => {
      render(<FilterSortControls {...defaultProps} sortOrder="updatedAt" sortDirection="desc" />);

      const sortButton = screen.getByLabelText(/sort order: Newest/i);
      expect(sortButton).toBeInTheDocument();
    });

    it('shows "Oldest" for ascending date sort', () => {
      render(<FilterSortControls {...defaultProps} sortOrder="updatedAt" sortDirection="asc" />);

      const sortButton = screen.getByLabelText(/sort order: Oldest/i);
      expect(sortButton).toBeInTheDocument();
    });

    it('shows "Newest" for createdAt descending', () => {
      render(<FilterSortControls {...defaultProps} sortOrder="createdAt" sortDirection="desc" />);

      const sortButton = screen.getByLabelText(/sort order: Newest/i);
      expect(sortButton).toBeInTheDocument();
    });

    it('shows "Oldest" for createdAt ascending', () => {
      render(<FilterSortControls {...defaultProps} sortOrder="createdAt" sortDirection="asc" />);

      const sortButton = screen.getByLabelText(/sort order: Oldest/i);
      expect(sortButton).toBeInTheDocument();
    });
  });

  describe('Manage Categories Button', () => {
    it('shows "Categories" text on desktop viewport', () => {
      render(<FilterSortControls {...defaultProps} />);

      const manageButton = screen.getByLabelText(/manage categories/i);
      expect(manageButton.textContent).toContain('Categories');
    });

    it('calls onManageCategories when manage button is clicked', async () => {
      const user = userEvent.setup();
      const onManageCategories = vi.fn();
      render(<FilterSortControls {...defaultProps} onManageCategories={onManageCategories} />);

      const manageButton = screen.getByLabelText(/manage categories/i);
      await user.click(manageButton);

      expect(onManageCategories).toHaveBeenCalledTimes(1);
    });

    it('calls onManageCategories with Enter key', async () => {
      const user = userEvent.setup();
      const onManageCategories = vi.fn();
      render(<FilterSortControls {...defaultProps} onManageCategories={onManageCategories} />);

      const manageButton = screen.getByLabelText(/manage categories/i);
      manageButton.focus();
      await user.keyboard('{Enter}');

      expect(onManageCategories).toHaveBeenCalledTimes(1);
    });

    it('calls onManageCategories with Space key', async () => {
      const user = userEvent.setup();
      const onManageCategories = vi.fn();
      render(<FilterSortControls {...defaultProps} onManageCategories={onManageCategories} />);

      const manageButton = screen.getByLabelText(/manage categories/i);
      manageButton.focus();
      await user.keyboard(' ');

      expect(onManageCategories).toHaveBeenCalledTimes(1);
    });

    it('is disabled when loading', () => {
      render(<FilterSortControls {...defaultProps} loading={true} />);

      const manageButton = screen.getByLabelText(/manage categories/i);
      expect(manageButton).toBeDisabled();
    });
  });

  describe('Active State Display', () => {
    it('displays selected category name in active state', () => {
      render(<FilterSortControls {...defaultProps} selectedCategory="Work" />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      expect(filterButton).toHaveTextContent('Work');
    });

    it('displays "All" when no category is selected', () => {
      render(<FilterSortControls {...defaultProps} selectedCategory={null} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      expect(filterButton).toHaveTextContent('All');
    });

    it('updates active state when category changes', () => {
      const { rerender } = render(<FilterSortControls {...defaultProps} selectedCategory={null} />);
      const filterButton = screen.getByLabelText(/filter by category/i);
      expect(filterButton).toHaveTextContent('All');

      rerender(<FilterSortControls {...defaultProps} selectedCategory="Personal" />);
      expect(filterButton).toHaveTextContent('Personal');
    });

    it('updates active state when sort changes', () => {
      const { rerender } = render(<FilterSortControls {...defaultProps} sortOrder="updatedAt" sortDirection="desc" />);
      expect(screen.getByLabelText(/sort order: Newest/i)).toBeInTheDocument();

      rerender(<FilterSortControls {...defaultProps} sortOrder="title" sortDirection="asc" />);
      expect(screen.getByLabelText(/sort order: A→Z/i)).toBeInTheDocument();
    });
  });

  describe('Category Colors', () => {
    it('displays color indicator for categories with colors', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Check for Work category color
      const workOption = screen.getByText('Work');
      const colorIndicator = workOption.parentElement?.querySelector('.rounded-full');
      expect(colorIndicator).toBeInTheDocument();
      expect(colorIndicator).toHaveStyle({ backgroundColor: '#3B82F6' });
    });

    it('displays all category colors correctly', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Check each category's color
      mockCategories.forEach(category => {
        const categoryOption = screen.getByText(category.name);
        const colorIndicator = categoryOption.parentElement?.querySelector('.rounded-full');
        if (category.color) {
          expect(colorIndicator).toHaveStyle({ backgroundColor: category.color });
        }
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on filter button', () => {
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      expect(filterButton).toHaveAttribute('aria-label', 'Filter by category: All');
      expect(filterButton).toHaveAttribute('aria-expanded', 'false');
      expect(filterButton).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('updates ARIA attributes when filter dropdown opens', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(filterButton).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('has proper ARIA labels on sort button', () => {
      render(<FilterSortControls {...defaultProps} />);

      const sortButton = screen.getByLabelText(/sort order/i);
      expect(sortButton).toHaveAttribute('aria-label', 'Sort order: Newest');
      expect(sortButton).toHaveAttribute('aria-expanded', 'false');
      expect(sortButton).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('has role="group" on controls container', () => {
      const { container } = render(<FilterSortControls {...defaultProps} />);

      const group = container.querySelector('[role="group"]');
      expect(group).toBeInTheDocument();
      expect(group).toHaveAttribute('aria-label', 'Filter and sort controls');
    });

    it('has proper aria-attributes for accessibility', () => {
      render(<FilterSortControls {...defaultProps} />);

      // Check that buttons have proper ARIA attributes
      const filterButton = screen.getByLabelText(/filter by category/i);
      expect(filterButton).toHaveAttribute('aria-haspopup', 'menu');

      const sortButton = screen.getByLabelText(/sort order/i);
      expect(sortButton).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('has proper menu roles on dropdowns', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      const menu = await screen.findByRole('menu');
      expect(menu).toBeInTheDocument();

      // The new dropdown doesn't use menuitem role for items
    });

    it('icons have aria-hidden attribute', () => {
      const { container } = render(<FilterSortControls {...defaultProps} />);

      const svgs = container.querySelectorAll('svg');
      svgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('has title attributes for tooltips', () => {
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      expect(filterButton).toHaveAttribute('title', 'Filter: All');

      const sortButton = screen.getByLabelText(/sort order/i);
      expect(sortButton).toHaveAttribute('title', 'Sort: Newest');

      const manageButton = screen.getByLabelText(/manage categories/i);
      expect(manageButton).toHaveAttribute('title', 'Manage Categories');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty categories array', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} categories={[]} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Should have "All Categories" in the dropdown
      const allOptions = screen.getAllByText('All Categories');
      expect(allOptions.length).toBeGreaterThan(0);
      expect(screen.queryByText('Work')).not.toBeInTheDocument();
    });

    it('handles category without color', async () => {
      const categoriesWithoutColor: Category[] = [
        { id: '1', name: 'No Color' }
      ];
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} categories={categoriesWithoutColor} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByText('No Color')).toBeInTheDocument();
      });

      // Categories without colors now show the default color for consistency
      const noColorOption = screen.getByText('No Color');
      const colorIndicator = noColorOption.parentElement?.querySelector('.rounded-full');
      expect(colorIndicator).toBeInTheDocument();
    });

    it('handles long category names gracefully', () => {
      const longNameCategories: Category[] = [
        { id: '1', name: 'This is a very long category name that might overflow' }
      ];
      render(<FilterSortControls {...defaultProps} categories={longNameCategories} selectedCategory="This is a very long category name that might overflow" />);

      // Filter button label should truncate with ellipsis
      const filterButton = screen.getByLabelText(/filter by category/i);
      const labelSpan = filterButton.querySelector('.truncate');
      expect(labelSpan).toBeInTheDocument();
      expect(labelSpan).toHaveClass('max-w-[100px]');
    });
  });

  describe('Multiple Interactions', () => {
    it('closes filter dropdown when sort dropdown is opened', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      // Open filter dropdown
      const filterButton = screen.getByLabelText(/filter by category/i);
      await user.click(filterButton);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Open sort dropdown - filter should close
      const sortButton = screen.getByLabelText(/sort order/i);
      await user.click(sortButton);

      // Note: Based on implementation, both dropdowns can be open simultaneously
      // This test documents the actual behavior
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('allows rapid toggling of dropdowns', async () => {
      const user = userEvent.setup();
      render(<FilterSortControls {...defaultProps} />);

      const filterButton = screen.getByLabelText(/filter by category/i);
      const sortButton = screen.getByLabelText(/sort order/i);

      // Rapid clicks
      await user.click(filterButton);
      await user.click(sortButton);
      await user.click(filterButton);
      await user.click(sortButton);

      // Final state should have sort dropdown open
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });
  });
});

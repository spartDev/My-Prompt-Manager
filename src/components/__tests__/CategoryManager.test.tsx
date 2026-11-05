import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Category } from '../../types';
import CategoryManager from '../CategoryManager';

const baseCategories: Category[] = [
  { id: 'uncat', name: 'Uncategorized' },
  { id: 'ideas', name: 'Ideas', color: '#ff9900' }
];

const renderManager = (overrides: Partial<React.ComponentProps<typeof CategoryManager>> = {}) => {
  const props: React.ComponentProps<typeof CategoryManager> = {
    categories: [...baseCategories],
    onCreateCategory: vi.fn().mockResolvedValue(undefined),
    onUpdateCategory: vi.fn().mockResolvedValue(undefined),
    onDeleteCategory: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };

  const utils = render(<CategoryManager {...props} />);
  return { props, ...utils };
};

describe('CategoryManager', () => {
  it('is titled "Categories" with the category count as subtitle and no Back button', () => {
    renderManager();

    expect(screen.getByRole('heading', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByText('2 categories')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
  });

  it('uses the singular for a single category', () => {
    renderManager({ categories: [baseCategories[0]] });

    expect(screen.getByText('1 category')).toBeInTheDocument();
  });

  it('shows a Close button only in the side panel', () => {
    const { unmount } = renderManager({ context: 'popup' });
    expect(screen.queryByRole('button', { name: /close side panel/i })).not.toBeInTheDocument();
    unmount();

    renderManager({ context: 'sidepanel' });
    expect(screen.getByRole('button', { name: /close side panel/i })).toBeInTheDocument();
  });

  it('prevents creating duplicate category names', async () => {
    const { props } = renderManager();

    const input = screen.getByPlaceholderText(/category name/i);
    await userEvent.type(input, baseCategories[1].name);
    const addButton = screen.getByRole('button', { name: /add/i });
    await userEvent.click(addButton);

    expect(await screen.findByText(/category already exists/i)).toBeInTheDocument();
    expect(props.onCreateCategory).not.toHaveBeenCalled();
  });

  it('shows an error when attempting to delete the default category', async () => {
    const categories: Category[] = [
      { id: 'uncat', name: 'Uncategorized' },
      { id: 'ideas', name: 'Ideas' }
    ];
    const { props } = renderManager({ categories });

    // Find the Ideas category row by text
    const ideasText = screen.getByText('Ideas');
    // Navigate up to the row container
    const rowContainer = ideasText.parentElement?.parentElement?.parentElement as HTMLElement | null;
    expect(rowContainer).not.toBeNull();

    // Temporarily modify the category name to trigger the error
    categories[1].name = 'Uncategorized';

    // Get all buttons within this row, expecting [editButton, deleteButton]
    const buttons = within(rowContainer as HTMLElement).getAllByRole('button');
    const deleteButton = buttons[1]; // Second button is delete
    await userEvent.click(deleteButton);

    expect(await screen.findByText(/cannot delete the default category/i)).toBeInTheDocument();
    expect(props.onDeleteCategory).not.toHaveBeenCalled();
  });

  it('updates a category name when edit input loses focus', async () => {
    const { props } = renderManager();

    // Find the Ideas category row by text
    const ideasText = screen.getByText('Ideas');
    // Navigate up to the row container
    const rowContainer = ideasText.parentElement?.parentElement?.parentElement as HTMLElement | null;
    expect(rowContainer).not.toBeNull();

    // Get the first button (edit button) within the row
    const [editButton] = within(rowContainer as HTMLElement).getAllByRole('button');
    await userEvent.click(editButton);

    const editInput = await screen.findByDisplayValue('Ideas');
    await userEvent.clear(editInput);
    await userEvent.type(editInput, 'Ideas Updated');
    await userEvent.tab();

    await screen.findByRole('heading', { name: 'Categories' });

    expect(props.onUpdateCategory).toHaveBeenCalledWith('ideas', { name: 'Ideas Updated' });
  });
});

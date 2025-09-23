import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, it, expect, vi } from 'vitest';

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
    isOpen: true,
    onClose: vi.fn(),
    ...overrides
  };

  const utils = render(<CategoryManager {...props} />);
  return { props, ...utils };
};

describe('CategoryManager', () => {
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

    const row = screen.getByText('Ideas').closest('div');
    const rowContainer = row?.parentElement?.parentElement as HTMLElement | null;
    expect(rowContainer).not.toBeNull();

    categories[1].name = 'Uncategorized';

    const buttons = within(rowContainer as HTMLElement).getAllByRole('button');
    const deleteButton = buttons[1];
    await userEvent.click(deleteButton);

    expect(await screen.findByText(/cannot delete the default category/i)).toBeInTheDocument();
    expect(props.onDeleteCategory).not.toHaveBeenCalled();
  });

  it('updates a category name when edit input loses focus', async () => {
    const { props } = renderManager();

    const row = screen.getByText('Ideas').closest('div');
    const rowContainer = row?.parentElement?.parentElement as HTMLElement | null;
    expect(rowContainer).not.toBeNull();

    const [editButton] = within(rowContainer as HTMLElement).getAllByRole('button');
    await userEvent.click(editButton);

    const editInput = await screen.findByDisplayValue('Ideas');
    await userEvent.clear(editInput);
    await userEvent.type(editInput, 'Ideas Updated');
    await userEvent.tab();

    await screen.findByText(/manage categories/i);

    expect(props.onUpdateCategory).toHaveBeenCalledWith('ideas', { name: 'Ideas Updated' });
  });
});

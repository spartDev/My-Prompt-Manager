import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { buildPrompt } from '../../test/builders';
import type { Category } from '../../types';
import EditPromptForm from '../EditPromptForm';

describe('EditPromptForm - Delete prompt', () => {
  const prompt = buildPrompt({ id: 'p1', title: 'Meeting Notes' });
  const categories: Category[] = [{ id: 'c1', name: prompt.category }];

  const renderForm = (onDelete = vi.fn()) => {
    render(
      <EditPromptForm
        prompt={prompt}
        categories={categories}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onDelete={onDelete}
      />
    );
    return onDelete;
  };

  it('should ask for confirmation before deleting', async () => {
    const onDelete = renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Delete prompt' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Are you sure you want to delete "Meeting Notes"?');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('should delete the prompt once confirmed', async () => {
    const onDelete = renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Delete prompt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledWith('p1');
  });

  it('should keep the prompt when the confirmation is cancelled', async () => {
    const onDelete = renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Delete prompt' }));
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    await userEvent.click(cancelButtons[cancelButtons.length - 1]);

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { formatCharacterCount } from '../../constants/validation';
import { PROMPT_LIMITS } from '../../services/promptAdmission';
import { buildPrompt } from '../../test/builders';
import type { Category, Prompt } from '../../types';
import EditPromptForm from '../EditPromptForm';

const categories: Category[] = [
  { id: 'default', name: 'Uncategorized', color: '#888888' },
  { id: 'work', name: 'Work', color: '#ff00ff' }
];

const prompt: Prompt = {
  id: 'p1',
  title: 'Title',
  content: 'Body',
  category: 'Work',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000
};

const renderForm = () => {
  const props: React.ComponentProps<typeof EditPromptForm> = {
    prompt,
    categories,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    onDelete: vi.fn()
  };

  return { ...render(<EditPromptForm {...props} />), props };
};

// ADR-001: over-limit text is refused, never shortened. A maxLength attribute would let the
// browser cut a paste at the limit without a word, so the fields have none; the text stays in
// the field, the counter turns red and the refusal is shown instead.
describe('EditPromptForm - Limits', () => {
  it('keeps content pasted over the limit in the field, shows the refusal and does not submit', async () => {
    const { props } = renderForm();
    const content = 'x'.repeat(PROMPT_LIMITS.content + 1);
    const contentInput = screen.getByLabelText(/content/i);

    await userEvent.clear(contentInput);
    await userEvent.paste(content);

    expect(contentInput).toHaveValue(content);
    expect(screen.getByText(formatCharacterCount(content.length, PROMPT_LIMITS.content))).toHaveClass('text-danger');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/Content cannot exceed 20,000 characters/)).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('keeps a title pasted over the limit in the field, shows the refusal and does not submit', async () => {
    const { props } = renderForm();
    const title = 't'.repeat(PROMPT_LIMITS.title + 1);
    const titleInput = screen.getByLabelText(/title/i);

    await userEvent.clear(titleInput);
    await userEvent.paste(title);

    expect(titleInput).toHaveValue(title);
    expect(screen.getByText(formatCharacterCount(title.length, PROMPT_LIMITS.title))).toHaveClass('text-danger');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/Title cannot exceed 100 characters/)).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('accepts content over the limit only because of a Hidden character and hands it over unchanged', async () => {
    const { props } = renderForm();
    const content = `${'x'.repeat(PROMPT_LIMITS.content)}\u{200B}`;

    await userEvent.clear(screen.getByLabelText(/content/i));
    await userEvent.paste(content);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({ title: 'Title', content, category: 'Work' });
    });
  });

  // React 19 resets the uncontrolled fields of a form once its action completes, so a refused
  // save must not put the stored text back: what the user typed stays, with the refusal next to it.
  it('keeps the title, content and category exactly as typed when the save is refused, then saves the corrected text', async () => {
    const { props } = renderForm();
    const overLimit = 'x'.repeat(PROMPT_LIMITS.content + 1);

    await userEvent.clear(screen.getByLabelText(/title/i));
    await userEvent.type(screen.getByLabelText(/title/i), 'New Title');
    await userEvent.click(screen.getByRole('button', { name: /category/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /uncategorized/i }));
    await userEvent.clear(screen.getByLabelText(/content/i));
    await userEvent.paste(overLimit);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/Content cannot exceed 20,000 characters/)).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue('New Title');
    expect(screen.getByLabelText(/content/i)).toHaveValue(overLimit);
    expect(screen.getByRole('button', { name: /category/i })).toHaveTextContent('Uncategorized');
    expect(screen.getByText(formatCharacterCount(overLimit.length, PROMPT_LIMITS.content))).toHaveClass('text-danger');
    expect(props.onSubmit).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/content/i));
    await userEvent.paste('New body');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({ title: 'New Title', content: 'New body', category: 'Uncategorized' });
    });
  });
});

// An edit has no title to generate (create does): a blank one has to be refused here, because
// refused later, by Admission, the app shows the refusal as a full-screen load error.
describe('EditPromptForm - Title', () => {
  it('refuses a cleared title in the form and does not submit', async () => {
    const { props } = renderForm();

    await userEvent.clear(screen.getByLabelText(/title/i));
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/Title is required/)).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });
});

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

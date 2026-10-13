import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { describe, it, expect, vi } from 'vitest';

import { formatCharacterCount } from '../../constants/validation';
import { PROMPT_LIMITS } from '../../services/promptAdmission';
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
    onCancel: vi.fn()
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
    expect(screen.getByText(formatCharacterCount(content.length, PROMPT_LIMITS.content))).toHaveClass('text-red-600');

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
    expect(screen.getByText(formatCharacterCount(title.length, PROMPT_LIMITS.title))).toHaveClass('text-red-600');

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
});

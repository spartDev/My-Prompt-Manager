import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { encode } from '../../services/promptEncoder';
import type { Category, Prompt } from '../../types';
import AddPromptForm from '../AddPromptForm';

const defaultCategories: Category[] = [
  { id: 'default', name: 'Uncategorized', color: '#888888' },
  { id: 'work', name: 'Work', color: '#ff00ff' },
  { id: 'personal', name: 'Personal', color: '#00ff00' }
];

const testPrompt: Prompt = {
  id: 'test-1',
  title: 'Test Prompt Title',
  content: 'This is a test prompt content that will be shared and imported.',
  category: 'Work',
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const renderForm = (props: Partial<React.ComponentProps<typeof AddPromptForm>> = {}) => {
  const defaultProps: React.ComponentProps<typeof AddPromptForm> = {
    categories: [...defaultCategories],
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    ...props
  };

  return { ...render(<AddPromptForm {...defaultProps} />), props: defaultProps };
};

describe('AddPromptForm - Import Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully imports a prompt using a real sharing code', async () => {
    // Generate a real sharing code using the encoder
    const sharingCode = encode(testPrompt);

    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /📥 import shared/i });
    await userEvent.click(importButton);

    // Paste the sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode);

    // Wait for debounced validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    // Verify decoded data is displayed
    expect(screen.getByText(testPrompt.title)).toBeInTheDocument();
    expect(screen.getByText(testPrompt.content)).toBeInTheDocument();

    // Submit the import
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    expect(submitButton).not.toBeDisabled();
    await userEvent.click(submitButton);

    // Verify onSubmit was called with the correct data
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        title: testPrompt.title,
        content: testPrompt.content,
        category: testPrompt.category
      });
    });
  });

  it('handles import with category that does not exist in user categories', async () => {
    // Create a prompt with a category that doesn't exist
    const promptWithNonExistentCategory: Prompt = {
      ...testPrompt,
      category: 'NonExistentCategory'
    };
    const sharingCode = encode(promptWithNonExistentCategory);

    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /📥 import shared/i });
    await userEvent.click(importButton);

    // Paste the sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    // Verify category selector falls back to default
    const categorySelect = screen.getByLabelText(/import to category/i);
    expect(categorySelect).toHaveValue('Uncategorized');

    // Submit the import
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    await userEvent.click(submitButton);

    // Verify onSubmit was called with the default category
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        title: promptWithNonExistentCategory.title,
        content: promptWithNonExistentCategory.content,
        category: 'Uncategorized'
      });
    });
  });

  it('allows user to change category before importing', async () => {
    const sharingCode = encode(testPrompt);

    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /📥 import shared/i });
    await userEvent.click(importButton);

    // Paste the sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    // Change the category from Work to Personal
    const categorySelect = screen.getByLabelText(/import to category/i);
    await userEvent.selectOptions(categorySelect, 'Personal');

    // Verify the help text shows the change
    expect(screen.getByText(/importing to "personal" instead of "work"/i)).toBeInTheDocument();

    // Submit the import
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    await userEvent.click(submitButton);

    // Verify onSubmit was called with the new category
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        title: testPrompt.title,
        content: testPrompt.content,
        category: 'Personal'
      });
    });
  });

  it('handles very long content in imported prompts', async () => {
    // Create a prompt with very long content (close to the limit)
    const longContent = 'A'.repeat(9000); // Close to 10000 char limit
    const longPrompt: Prompt = {
      ...testPrompt,
      content: longContent
    };
    const sharingCode = encode(longPrompt);

    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /📥 import shared/i });
    await userEvent.click(importButton);

    // Paste the sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    // Check character count is displayed
    expect(screen.getByText(/9000 characters/i)).toBeInTheDocument();

    // Submit the import
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    await userEvent.click(submitButton);

    // Verify onSubmit was called with the long content
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        title: longPrompt.title,
        content: longContent,
        category: longPrompt.category
      });
    });
  });

  it('handles special characters in imported prompts', async () => {
    // Create a prompt with special characters
    const specialPrompt: Prompt = {
      ...testPrompt,
      title: 'Test 💡 Prompt with "quotes" & <tags>',
      content: 'Content with\nnewlines\nand\ttabs & special chars: ©®™'
    };
    const sharingCode = encode(specialPrompt);

    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /📥 import shared/i });
    await userEvent.click(importButton);

    // Paste the sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    // Verify special characters are preserved (but sanitized)
    // Note: DOMPurify strips HTML tags, so <tags> becomes empty
    expect(screen.getByText(/Test.*Prompt with "quotes"/)).toBeInTheDocument();

    // Submit the import
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    await userEvent.click(submitButton);

    // Verify onSubmit was called (content will be sanitized)
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalled();
    });
  });

  it('prevents import when switching away and back without valid code', async () => {
    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /📥 import shared/i });
    await userEvent.click(importButton);

    // Switch back to create mode without entering code
    const createButton = screen.getByRole('button', { name: /📝 create new/i });
    await userEvent.click(createButton);

    // Switch back to import mode
    await userEvent.click(importButton);

    // Try to submit (should be disabled)
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    expect(submitButton).toBeDisabled();

    // Try clicking anyway (shouldn't do anything due to disabled state)
    await userEvent.click(submitButton);

    // Verify onSubmit was not called
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('successfully re-validates when pasting a new code', async () => {
    const sharingCode1 = encode(testPrompt);
    const prompt2: Prompt = {
      ...testPrompt,
      id: 'test-2',
      title: 'Second Prompt',
      content: 'Different content'
    };
    const sharingCode2 = encode(prompt2);

    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /📥 import shared/i });
    await userEvent.click(importButton);

    // Paste first sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode1);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(testPrompt.title)).toBeInTheDocument();
    }, { timeout: 600 });

    // Clear and paste second sharing code
    await userEvent.clear(codeInput);
    await userEvent.type(codeInput, sharingCode2);

    // Wait for re-validation
    await waitFor(() => {
      expect(screen.getByText(prompt2.title)).toBeInTheDocument();
      expect(screen.queryByText(testPrompt.title)).not.toBeInTheDocument();
    }, { timeout: 600 });
  });
});

describe('AddPromptForm - End-to-End Workflow Tests', () => {
  it('complete workflow: create mode -> import mode -> create mode with submission', async () => {
    const { props } = renderForm();

    // Start in create mode, fill in some data
    await userEvent.type(screen.getByLabelText(/content/i), 'Initial content');

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /📥 import shared/i });
    await userEvent.click(importButton);

    // Import a prompt
    const sharingCode = encode(testPrompt);
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode);

    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    const importSubmitButton = screen.getByRole('button', { name: /import prompt/i });
    await userEvent.click(importSubmitButton);

    // Verify import submission
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        title: testPrompt.title,
        content: testPrompt.content,
        category: testPrompt.category
      });
    });

    // After successful import, form should still be usable
    // (In a real app, the parent would close the form or reset it)
  });
});

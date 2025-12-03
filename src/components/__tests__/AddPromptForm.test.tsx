import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import * as promptEncoder from '../../services/promptEncoder';
import type { Category } from '../../types';
import AddPromptForm from '../AddPromptForm';

const defaultCategories: Category[] = [
  { id: 'default', name: 'Uncategorized', color: '#888888' },
  { id: 'work', name: 'Work', color: '#ff00ff' },
  { id: 'personal', name: 'Personal', color: '#00ff00' }
];

const mockDecodedPrompt = {
  title: 'Test Title',
  content: 'Test Content',
  category: 'Work'
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

describe('AddPromptForm - Create Mode', () => {
  it('renders in create mode by default', () => {
    renderForm();

    expect(screen.getByRole('button', { name: /create new prompt/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save prompt/i })).toBeInTheDocument();
  });

  it('submits form with title, content, and category in create mode', async () => {
    const { props } = renderForm();

    await userEvent.type(screen.getByLabelText(/title/i), 'My Title');
    await userEvent.type(screen.getByLabelText(/content/i), 'My Content');

    // Open category dropdown and select 'Work'
    const categoryButton = document.getElementById('category') as HTMLButtonElement;
    await userEvent.click(categoryButton);
    const workOption = await screen.findByRole('menuitem', { name: /work/i });
    await userEvent.click(workOption);

    const saveButton = screen.getByRole('button', { name: /save prompt/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        title: 'My Title',
        content: 'My Content',
        category: 'Work'
      });
    });
  });

  it('prevents submission when content is empty in create mode', async () => {
    const { props } = renderForm();
    const onSubmitSpy = vi.fn();
    props.onSubmit = onSubmitSpy;

    // Try to submit without content
    const saveButton = screen.getByRole('button', { name: /save prompt/i });
    await userEvent.click(saveButton);

    // Wait a moment for any submission attempt
    await new Promise(resolve => setTimeout(resolve, 100));

    // The HTML5 required attribute should prevent submission
    // or useActionState should return validation errors
    // Either way, onSubmit should not be called
    expect(onSubmitSpy).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const { props } = renderForm();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelButton);

    expect(props.onCancel).toHaveBeenCalled();
  });
});

describe('AddPromptForm - Import Mode', () => {
  beforeEach(() => {
    // Mock the decode function
    vi.spyOn(promptEncoder, 'decode').mockReturnValue(mockDecodedPrompt);
  });

  it('switches to import mode when import button is clicked', async () => {
    renderForm();

    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    expect(importButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/sharing code/i)).toBeInTheDocument();
    expect(screen.getByText(/how to import/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();
  });

  it('validates sharing code and shows preview after debounce', async () => {
    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Type sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'valid-sharing-code');

    // Wait for debounced validation (300ms) and check decode was called
    await waitFor(() => {
      expect(promptEncoder.decode).toHaveBeenCalledWith('valid-sharing-code');
    }, { timeout: 600 });

    // Check that preview is shown
    expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();

    // Check that the preview section shows the category
    // The preview shows both "Original Category" label and "Using original category" text
    expect(screen.getByText('Original Category')).toBeInTheDocument();
  });

  it('shows validation error for invalid sharing code', async () => {
    vi.spyOn(promptEncoder, 'decode').mockImplementation(() => {
      throw new Error('Invalid sharing code format');
    });

    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Type invalid sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'invalid-code');

    // Wait for debounced validation
    await waitFor(() => {
      expect(screen.getByText(/invalid sharing code format/i)).toBeInTheDocument();
    }, { timeout: 500 });

    // Check that preview is NOT shown
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
  });

  it('disables submit button when no valid prompt is decoded', async () => {
    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Submit button should be disabled initially
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when valid prompt is decoded', async () => {
    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Type valid sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'valid-code');

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 500 });

    // Submit button should be enabled
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('auto-selects decoded category if it exists', async () => {
    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Type valid sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'valid-code');

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 500 });

    // Check that category dropdown trigger shows original category
    // The trigger button shows the selected category name
    const categoryButton = document.getElementById('import-category') as HTMLButtonElement;
    expect(categoryButton).toBeInTheDocument();
    expect(categoryButton).toHaveTextContent('Work');
    expect(screen.getByText(/using original category/i)).toBeInTheDocument();
  });

  it('falls back to default category if decoded category does not exist', async () => {
    vi.spyOn(promptEncoder, 'decode').mockReturnValue({
      title: 'Test Title',
      content: 'Test Content',
      category: 'NonExistent'
    });

    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Type valid sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'valid-code');

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 500 });

    // Check that category dropdown trigger falls back to default
    const categoryButton = document.getElementById('import-category') as HTMLButtonElement;
    expect(categoryButton).toBeInTheDocument();
    expect(categoryButton).toHaveTextContent('Uncategorized');
  });

  it('allows changing the import category', async () => {
    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Type valid sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'valid-code');

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 500 });

    // Open category dropdown and select 'Personal'
    const categoryButton = document.getElementById('import-category') as HTMLButtonElement;
    await userEvent.click(categoryButton);
    const personalOption = await screen.findByRole('menuitem', { name: /personal/i });
    await userEvent.click(personalOption);

    // Check that the help text reflects the change
    expect(screen.getByText(/importing to "personal" instead of "work"/i)).toBeInTheDocument();
  });

  it('submits imported prompt with decoded data and selected category', async () => {
    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Type valid sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'valid-code');

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 500 });

    // Open category dropdown and select 'Personal'
    const categoryButton = document.getElementById('import-category') as HTMLButtonElement;
    await userEvent.click(categoryButton);
    const personalOption = await screen.findByRole('menuitem', { name: /personal/i });
    await userEvent.click(personalOption);

    // Submit
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    await userEvent.click(submitButton);

    // Check that onSubmit was called with decoded data
    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        title: 'Test Title',
        content: 'Test Content',
        category: 'Personal'
      });
    });
  });

  it('shows error when trying to import without valid sharing code', async () => {
    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Try to submit without entering code (button is disabled, but test the validation)
    // Type and then clear the code to trigger validation
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'test');
    await userEvent.clear(codeInput);

    // Wait for debounce
    await waitFor(() => {
      // No preview should be shown
      expect(screen.queryByText(/valid sharing code detected/i)).not.toBeInTheDocument();
    }, { timeout: 500 });

    // Submit button should still be disabled
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    expect(submitButton).toBeDisabled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('clears validation state when import code is cleared', async () => {
    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Type valid sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'valid-code');

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    // Clear the input
    await userEvent.clear(codeInput);

    // Wait for debounce and check that preview is gone
    await waitFor(() => {
      expect(screen.queryByText(/valid sharing code detected/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
    }, { timeout: 600 });
  });

  it('shows create mode form when switching back from import mode', async () => {
    renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Verify we're in import mode
    expect(screen.getByLabelText(/sharing code/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();

    // Switch back to create mode
    const createButton = screen.getByRole('button', { name: /create new prompt/i });
    await userEvent.click(createButton);

    // Check that create mode form is shown again
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/sharing code/i)).not.toBeInTheDocument();
  });
});

describe('AddPromptForm - Submit Button Text', () => {
  beforeEach(() => {
    vi.spyOn(promptEncoder, 'decode').mockReturnValue(mockDecodedPrompt);
  });

  it('shows "Save Prompt" in create mode', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /save prompt/i })).toBeInTheDocument();
  });

  it('shows "Import Prompt" in import mode', async () => {
    renderForm();

    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    expect(screen.getByRole('button', { name: /import prompt/i })).toBeInTheDocument();
  });

  it('shows "Saving..." during create mode submission', async () => {
    const { props } = renderForm();

    // Mock slow submission
    (props.onSubmit as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    await userEvent.type(screen.getByLabelText(/content/i), 'Test');
    const saveButton = screen.getByRole('button', { name: /save prompt/i });
    await userEvent.click(saveButton);

    expect(screen.getByText(/saving\.\.\./i)).toBeInTheDocument();
  });

  it('shows "Importing..." during import mode submission', async () => {
    const { props } = renderForm();

    // Mock slow submission
    (props.onSubmit as any).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Enter valid code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, 'valid-code');

    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 500 });

    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    await userEvent.click(submitButton);

    expect(screen.getByText(/importing\.\.\./i)).toBeInTheDocument();
  });
});

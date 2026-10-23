/**
 * @vitest-environment jsdom
 *
 * jsdom, not happy-dom: happy-dom keeps <script> text when DOMPurify >=3.4.12
 * strips tags, so XSS assertions would fail although real browsers strip it.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LZString from 'lz-string';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdmissionRefusedError, admit } from '../../services/promptAdmission';
import { encode } from '../../services/promptEncoder';
import { PromptManager } from '../../services/promptManager';
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
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
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
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Paste the sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    // Verify category dropdown trigger falls back to default
    const categoryButton = screen.getByRole('button', { name: /import to category/i });
    expect(categoryButton).toBeInTheDocument();
    expect(categoryButton).toHaveTextContent('Uncategorized');

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
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Paste the sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    // Open category dropdown and select 'Personal'
    const categoryButton = screen.getByRole('button', { name: /import to category/i });
    await userEvent.click(categoryButton);
    const personalOption = await screen.findByRole('menuitem', { name: /personal/i });
    await userEvent.click(personalOption);

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
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
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

  it('hands special characters and tags in imported prompts to onSubmit unchanged', async () => {
    const specialPrompt: Prompt = {
      ...testPrompt,
      title: 'Test 💡 Prompt with "quotes" & <tags>',
      content: 'Content with\nnewlines\nand\ttabs & special chars: ©®™ <example>kept</example>'
    };
    const sharingCode = encode(specialPrompt);

    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Paste the sharing code
    const codeInput = screen.getByLabelText(/sharing code/i);
    await userEvent.type(codeInput, sharingCode);

    // Wait for validation
    await waitFor(() => {
      expect(screen.getByText(/valid sharing code detected/i)).toBeInTheDocument();
    }, { timeout: 600 });

    // The preview shows the text as shared, tags included
    expect(screen.getByText('Test 💡 Prompt with "quotes" & <tags>')).toBeInTheDocument();

    // Submit the import
    const submitButton = screen.getByRole('button', { name: /import prompt/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(props.onSubmit).toHaveBeenCalledWith({
        title: specialPrompt.title,
        content: specialPrompt.content,
        category: specialPrompt.category
      });
    });
  });

  it('prevents import when switching away and back without valid code', async () => {
    const { props } = renderForm();

    // Switch to import mode
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
    await userEvent.click(importButton);

    // Switch back to create mode without entering code
    const createButton = screen.getByRole('button', { name: /create new prompt/i });
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
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
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
    const importButton = screen.getByRole('button', { name: /import shared prompt/i });
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

/**
 * Opening a Share code is one of the routes into the Library (ADR-001): the text must arrive
 * Verbatim, and Hidden characters must be removed once, when the Prompt is saved. These tests go
 * through the real form, PromptManager and StorageManager over the in-memory chrome.storage.
 */
describe('AddPromptForm - Share code Admission (real StorageManager)', () => {
  const storedPrompts = async (): Promise<Prompt[]> =>
    ((await chrome.storage.local.get('prompts')).prompts ?? []) as Prompt[];

  beforeEach(async () => {
    await chrome.storage.local.set({
      prompts: [],
      categories: defaultCategories,
      settings: { defaultCategory: 'Uncategorized', sortOrder: 'updatedAt' }
    });
  });

  // Pastes the code into the form and clicks Import, saving through the real PromptManager.
  const openShareCode = async (code: string) => {
    const onSubmit = vi.fn(async (data: { title: string; content: string; category: string }) => {
      await PromptManager.getInstance().createPrompt(data.title, data.content, data.category);
    });
    renderForm({ onSubmit });

    await userEvent.click(screen.getByRole('button', { name: /import shared prompt/i }));
    await userEvent.click(screen.getByLabelText(/sharing code/i));
    await userEvent.paste(code);

    await screen.findByText(/valid sharing code detected/i);
    await userEvent.click(screen.getByRole('button', { name: /import prompt/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    return onSubmit;
  };

  it('saves tags, "metadata:" and surrounding whitespace exactly as shared', async () => {
    const content = '  Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true\n\n';
    const code = encode({ ...testPrompt, title: 'Metadata helper', content });

    await openShareCode(code);

    await waitFor(async () => {
      expect(await storedPrompts()).toHaveLength(1);
    });
    expect(await storedPrompts()).toEqual([
      expect.objectContaining({ title: 'Metadata helper', content, category: 'Work' })
    ]);
  });

  it('removes Hidden characters from a Share code when the Prompt is saved, and nothing else', async () => {
    const code = LZString.compressToEncodedURIComponent(
      JSON.stringify({
        title: '  Hid\u{200B}den\u{E0041} title ',
        content: ' Keep <context>this</context>,\u{202E} drop the rest\u{FEFF}. \n',
        category: 'Work'
      })
    );

    await openShareCode(code);

    await waitFor(async () => {
      expect(await storedPrompts()).toHaveLength(1);
    });
    expect(await storedPrompts()).toEqual([
      expect.objectContaining({
        title: 'Hidden title',
        content: ' Keep <context>this</context>, drop the rest. \n',
        category: 'Work'
      })
    ]);
  });

  it('tells the user straight away when a Share code holds a Prompt that Admission would refuse', async () => {
    const code = encode({ ...testPrompt, content: 'x'.repeat(20_001) });
    const { props } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: /import shared prompt/i }));
    await userEvent.click(screen.getByLabelText(/sharing code/i));
    await userEvent.paste(code);

    expect(await screen.findByText('Content cannot exceed 20,000 characters')).toBeInTheDocument();
    expect(screen.queryByText(/valid sharing code detected/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import prompt/i })).toBeDisabled();
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(await storedPrompts()).toEqual([]);
  });

  it('imports a Prompt whose title is over the limit only because of a Hidden character', async () => {
    const code = LZString.compressToEncodedURIComponent(
      JSON.stringify({ title: `${'T'.repeat(50)}\u{200B}${'t'.repeat(50)}`, content: 'Body', category: 'Work' })
    );

    await openShareCode(code);

    await waitFor(async () => {
      expect(await storedPrompts()).toHaveLength(1);
    });
    expect((await storedPrompts())[0].title).toBe(`${'T'.repeat(50)}${'t'.repeat(50)}`);
  });

  it('selects the Category a Share code names even when the name has spaces or a Hidden character around it', async () => {
    const code = LZString.compressToEncodedURIComponent(
      JSON.stringify({ title: 'Title', content: 'Body', category: ' Per\u{200B}sonal ' })
    );

    await openShareCode(code);

    await waitFor(async () => {
      expect(await storedPrompts()).toHaveLength(1);
    });
    expect((await storedPrompts())[0].category).toBe('Personal');
  });

  it('shows the refusal in the form when saving is refused at Admission', async () => {
    const refusal = admit({ title: 'T', content: 'x'.repeat(20_001), category: 'Work' });
    if (refusal.ok) {
      throw new Error('Expected the text to be refused');
    }
    const onSubmit = vi.fn().mockRejectedValue(new AdmissionRefusedError(refusal.errors));
    renderForm({ onSubmit });

    await userEvent.click(screen.getByRole('button', { name: /import shared prompt/i }));
    await userEvent.click(screen.getByLabelText(/sharing code/i));
    await userEvent.paste(encode(testPrompt));
    await screen.findByText(/valid sharing code detected/i);
    await userEvent.click(screen.getByRole('button', { name: /import prompt/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Content cannot exceed 20,000 characters');
  });
});

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { getMockPromptManager, getMockStorageManager } from '../../test/mocks';
import type { AppError, Category, Prompt } from '../../types';

const defaultCategories: Category[] = [
  { id: 'default', name: 'Uncategorized', color: '#888888' },
  { id: 'work', name: 'Work', color: '#ff00ff' }
];

const basePrompt: Prompt = {
  id: 'prompt-1',
  title: 'Draft email',
  content: 'Hello world',
  category: 'Work',
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const renderApp = async () => {
  render(<App />);
  await screen.findByRole('heading', { name: /my prompt manager/i });
};

describe('App prompt workflows', () => {
  beforeEach(() => {
    window.location.search = '';
    const storageMock = getMockStorageManager();
    storageMock.getCategories.mockResolvedValue([...defaultCategories]);
    storageMock.getPrompts.mockResolvedValue([]);
  });

  it('creates a new prompt and returns to the library with a success toast', async () => {
    const storageMock = getMockStorageManager();
    const promptMock = getMockPromptManager();

    (promptMock.createPrompt as any).mockResolvedValue({
      ...basePrompt,
      id: 'prompt-created',
      title: 'Greeting',
      content: 'Hello testers',
      category: 'Work'
    });

    await renderApp();

    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    const emptyState = await screen.findByRole('region', { name: /empty state/i });
    const addButton = await within(emptyState).findByRole('button', { name: /create your first prompt/i });
    await userEvent.click(addButton);

    const titleInput = await screen.findByLabelText(/title/i);
    await userEvent.type(titleInput, 'Greeting');

    const contentInput = screen.getByLabelText(/content/i);
    await userEvent.type(contentInput, 'Hello testers');

    // Open category dropdown and select 'Work'
    const categoryButton = screen.getByRole('button', { name: /category/i });
    await userEvent.click(categoryButton);
    const workOption = await screen.findByRole('menuitem', { name: /work/i });
    await userEvent.click(workOption);

    const saveButton = await screen.findByRole('button', { name: /save prompt/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(promptMock.createPrompt).toHaveBeenCalledWith('Greeting', 'Hello testers', 'Work');
    });

    await screen.findByText(/prompt created successfully/i);

    expect(screen.getByRole('heading', { name: /my prompt manager/i })).toBeInTheDocument();
    expect(storageMock.getPrompts).toHaveBeenCalled();
  });

  it('edits an existing prompt and shows a confirmation toast', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);
    const promptMock = getMockPromptManager();

    await renderApp();

    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    await screen.findByText(basePrompt.title);
    await userEvent.click(await screen.findByRole('button', { name: `Edit ${basePrompt.title}` }));

    const contentInput = await screen.findByLabelText(/content/i);
    await userEvent.clear(contentInput);
    await userEvent.type(contentInput, 'Updated body copy');

    const saveButton = await screen.findByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(promptMock.updatePrompt).toHaveBeenCalledWith(basePrompt.id, {
        title: basePrompt.title,
        content: 'Updated body copy',
        category: basePrompt.category
      });
    });

    await screen.findByText(/prompt updated successfully/i);
  });

  it('deletes a prompt from the edit form after confirming the dialog', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);

    await renderApp();

    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    await screen.findByText(basePrompt.title);
    await userEvent.click(await screen.findByRole('button', { name: `Edit ${basePrompt.title}` }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete prompt' }));

    const confirmButton = await screen.findByRole('button', { name: /^delete$/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(storageMock.deletePrompt).toHaveBeenCalledWith(basePrompt.id);
    });

    await screen.findByText(/prompt deleted successfully/i);
  });

  it('keeps the Library, brings the Prompt back and shows a toast when a delete fails', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);
    vi.mocked(storageMock.deletePrompt).mockRejectedValue(new Error('Storage write failed'));

    await renderApp();

    await userEvent.click(await screen.findByRole('button', { name: `Edit ${basePrompt.title}` }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete prompt' }));
    await userEvent.click(await screen.findByRole('button', { name: /^delete$/i }));

    await screen.findByText(/failed to delete prompt/i);
    expect(screen.getByText(basePrompt.title)).toBeInTheDocument();
    expect(screen.queryByText(/error loading data/i)).not.toBeInTheDocument();
  });

  it('copies prompt content to the clipboard in secure contexts', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true
    });

    await renderApp();

    const copyButton = await screen.findByRole('button', { name: /copy/i });
    await userEvent.click(copyButton);

    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledWith(basePrompt.content);
    });

    await screen.findByText(/prompt copied to clipboard/i);
  });

  it('opens the storage warning over the Add form, which keeps the typed text, when a save exceeds the quota', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getStorageUsage.mockResolvedValue({ used: 5120000, total: 5242880 });

    const promptMock = getMockPromptManager();
    const quotaError: AppError = {
      type: 'STORAGE_QUOTA_EXCEEDED',
      message: 'Quota reached'
    };
    (promptMock.createPrompt as any).mockRejectedValue(quotaError);

    await renderApp();

    const emptyState = await screen.findByRole('region', { name: /empty state/i });
    const createButton = await within(emptyState).findByRole('button', { name: /create your first prompt/i });
    await userEvent.click(createButton);

    await userEvent.type(screen.getByLabelText(/content/i), 'Some content');

    const saveFromEmpty = await screen.findByRole('button', { name: /save prompt/i });
    await userEvent.click(saveFromEmpty);

    const warning = await screen.findByRole('dialog', { name: 'Storage Limit Reached' });
    expect(within(warning).getByText('Quota reached')).toBeInTheDocument();
    expect(screen.queryByText(/error loading data/i)).not.toBeInTheDocument();

    await userEvent.click(within(warning).getByRole('button', { name: 'Continue' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Quota reached');
    expect(screen.getByLabelText(/content/i)).toHaveValue('Some content');
  });

  it('gives the keyboard back to Save Prompt when the storage warning closes', async () => {
    const promptMock = getMockPromptManager();
    const quotaError: AppError = { type: 'STORAGE_QUOTA_EXCEEDED', message: 'Quota reached' };
    (promptMock.createPrompt as any).mockRejectedValue(quotaError);

    await renderApp();

    const emptyState = await screen.findByRole('region', { name: /empty state/i });
    await userEvent.click(await within(emptyState).findByRole('button', { name: /create your first prompt/i }));
    await userEvent.type(screen.getByLabelText(/content/i), 'Some content');
    await userEvent.click(await screen.findByRole('button', { name: /save prompt/i }));

    const warning = await screen.findByRole('dialog', { name: 'Storage Limit Reached' });
    await waitFor(() => { expect(within(warning).getByRole('button', { name: 'Continue' })).toHaveFocus(); });

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save prompt/i })).toHaveFocus();
  });

  it('gives the keyboard back to Add when the storage warning of a refused Category closes', async () => {
    const storageMock = getMockStorageManager();
    const quotaError: AppError = { type: 'STORAGE_QUOTA_EXCEEDED', message: 'Quota reached' };
    vi.mocked(storageMock.saveCategory).mockRejectedValue(quotaError);

    await renderApp();

    await userEvent.click(screen.getByRole('tab', { name: 'Categories' }));
    await userEvent.type(await screen.findByPlaceholderText('Enter category name...'), 'Research');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    const warning = await screen.findByRole('dialog', { name: 'Storage Limit Reached' });
    expect(within(warning).getByText('Quota reached')).toBeInTheDocument();
    await waitFor(() => { expect(within(warning).getByRole('button', { name: 'Continue' })).toHaveFocus(); });

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus();
  });

  it('keeps the library on screen and shows a toast when pinning fails', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);
    const setSpy = vi.spyOn(chrome.storage.local, 'set');
    setSpy.mockRejectedValue(new Error('Storage write failed'));

    await renderApp();

    await userEvent.click(await screen.findByRole('button', { name: `Pin ${basePrompt.title}` }));

    await screen.findByText(/failed to update pin/i);
    expect(screen.getByText(basePrompt.title)).toBeInTheDocument();
    expect(screen.queryByText(/error loading data/i)).not.toBeInTheDocument();

    setSpy.mockRestore();
  });

  it('keeps the Edit form, the typed text and the refusal in the form when a save is refused', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);

    const promptMock = getMockPromptManager();
    const validationError: AppError = {
      type: 'VALIDATION_ERROR',
      message: 'Title is required'
    };
    (promptMock.updatePrompt as any).mockRejectedValue(validationError);

    await renderApp();

    await userEvent.click(await screen.findByRole('button', { name: `Edit ${basePrompt.title}` }));

    const contentInput = await screen.findByLabelText(/content/i);
    await userEvent.type(contentInput, ' additional');

    const saveButton = await screen.findByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(promptMock.updatePrompt).toHaveBeenCalled();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Title is required');
    expect(screen.getAllByText(/title is required/i)).toHaveLength(1);
    expect(screen.queryByText(/error loading data/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toHaveValue(`${basePrompt.content} additional`);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });
});

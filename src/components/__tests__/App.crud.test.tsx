import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import App from '../../App';
import { getMockPromptManager, getMockStorageManager } from '../../test/mocks';
import { ErrorType, type Prompt, type Category, type AppError } from '../../types';

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
    const menuButton = await screen.findByLabelText(`More actions for ${basePrompt.title}`);
    await userEvent.click(menuButton);

    const editOption = await screen.findByRole('menuitem', { name: /edit/i });
    await userEvent.click(editOption);

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

  it('deletes a prompt after confirming the dialog', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);

    await renderApp();

    await waitFor(() => {
      expect(storageMock.getPrompts).toHaveBeenCalled();
    });

    await screen.findByText(basePrompt.title);
    const menuButton = await screen.findByLabelText(`More actions for ${basePrompt.title}`);
    await userEvent.click(menuButton);

    const deleteOption = await screen.findByRole('menuitem', { name: /delete/i });
    await userEvent.click(deleteOption);

    const confirmButton = await screen.findByRole('button', { name: /^delete$/i });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(storageMock.deletePrompt).toHaveBeenCalledWith(basePrompt.id);
    });

    await screen.findByText(/prompt deleted successfully/i);
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

  it('shows a storage warning when quota errors occur', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getStorageUsage.mockResolvedValue({ used: 5120000, total: 5242880 });

    const promptMock = getMockPromptManager();
    const quotaError: AppError = {
      type: ErrorType.STORAGE_QUOTA_EXCEEDED,
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

    const errorHeading = await screen.findByRole('heading', { name: /error loading data/i });
    expect(errorHeading).toBeInTheDocument();
    
    const errorMessage = await screen.findByText(/quota reached/i);
    expect(errorMessage).toBeInTheDocument();
  });

  it('surfaces validation errors through an error toast', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);

    const promptMock = getMockPromptManager();
    const validationError: AppError = {
      type: ErrorType.VALIDATION_ERROR,
      message: 'Title is required'
    };
    (promptMock.updatePrompt as any).mockRejectedValue(validationError);

    await renderApp();

    const menuButton = await screen.findByLabelText(`More actions for ${basePrompt.title}`);
    await userEvent.click(menuButton);
    const editOption = await screen.findByRole('menuitem', { name: /edit/i });
    await userEvent.click(editOption);

    const contentInput = await screen.findByLabelText(/content/i);
    await userEvent.type(contentInput, ' additional');

    const saveButton = await screen.findByRole('button', { name: /save changes/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(promptMock.updatePrompt).toHaveBeenCalled();
    });

    await screen.findByText(/title is required/i);
  });
});

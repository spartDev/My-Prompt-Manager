import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { PROMPT_LIMITS } from '../../services/promptAdmission';
import { getChromeMock, getMockPromptManager, getMockStorageManager } from '../../test/mocks';
import type { AppError, Category, DeletedCategory, Prompt } from '../../types';

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

    await userEvent.click(screen.getByRole('radio', { name: 'Work' }));

    const saveButton = await screen.findByRole('button', { name: 'Save' });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(promptMock.createPrompt).toHaveBeenCalledWith('Greeting', 'Hello testers', 'Work');
    });

    const created = await screen.findByRole('status');
    expect(created).toHaveTextContent('Prompt created');
    expect(created).toHaveTextContent('Greeting');

    // The editor shows "Saved" for a moment, then the Library is back
    expect(await screen.findByRole('heading', { name: /my prompt manager/i })).toBeInTheDocument();
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

    const saveButton = await screen.findByRole('button', { name: 'Save' });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(promptMock.updatePrompt).toHaveBeenCalledWith(basePrompt.id, {
        title: basePrompt.title,
        content: 'Updated body copy',
        category: basePrompt.category
      });
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Prompt saved');
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

    const deleted = await screen.findByRole('status');
    expect(deleted).toHaveTextContent('Prompt deleted');
    expect(deleted).toHaveTextContent(basePrompt.title);
  });

  it('keeps the Library, brings the Prompt back and shows a toast when a delete fails', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);
    vi.mocked(storageMock.deletePrompt).mockRejectedValue(new Error('Storage write failed'));

    await renderApp();

    await userEvent.click(await screen.findByRole('button', { name: `Edit ${basePrompt.title}` }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete prompt' }));
    await userEvent.click(await screen.findByRole('button', { name: /^delete$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't delete Prompt");
    expect(screen.getByRole('button', { name: `Edit ${basePrompt.title}` })).toBeInTheDocument();
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

    const copied = await screen.findByRole('status');
    expect(copied).toHaveTextContent('Prompt copied');
    expect(copied).toHaveTextContent(basePrompt.title);
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

    const saveFromEmpty = await screen.findByRole('button', { name: 'Save' });
    await userEvent.click(saveFromEmpty);

    const warning = await screen.findByRole('dialog', { name: 'Storage Limit Reached' });
    expect(within(warning).getByText('Quota reached')).toBeInTheDocument();
    expect(screen.queryByText(/error loading data/i)).not.toBeInTheDocument();

    await userEvent.click(within(warning).getByRole('button', { name: 'Continue' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Quota reached');
    expect(screen.getByLabelText(/content/i)).toHaveValue('Some content');
  });

  it('gives the keyboard back to Save when the storage warning closes', async () => {
    const promptMock = getMockPromptManager();
    const quotaError: AppError = { type: 'STORAGE_QUOTA_EXCEEDED', message: 'Quota reached' };
    (promptMock.createPrompt as any).mockRejectedValue(quotaError);

    await renderApp();

    const emptyState = await screen.findByRole('region', { name: /empty state/i });
    await userEvent.click(await within(emptyState).findByRole('button', { name: /create your first prompt/i }));
    await userEvent.type(screen.getByLabelText(/content/i), 'Some content');
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

    const warning = await screen.findByRole('dialog', { name: 'Storage Limit Reached' });
    await waitFor(() => { expect(within(warning).getByRole('button', { name: 'Continue' })).toHaveFocus(); });

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('gives the keyboard back to Add category when the storage warning of a refused Category closes', async () => {
    const storageMock = getMockStorageManager();
    const quotaError: AppError = { type: 'STORAGE_QUOTA_EXCEEDED', message: 'Quota reached' };
    vi.mocked(storageMock.saveCategory).mockRejectedValue(quotaError);

    await renderApp();

    await userEvent.click(screen.getByRole('tab', { name: 'Categories' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add category' }));
    await userEvent.keyboard('Research');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));

    // The sheet makes way for the warning
    const warning = await screen.findByRole('dialog', { name: 'Storage Limit Reached' });
    expect(within(warning).getByText('Quota reached')).toBeInTheDocument();
    await waitFor(() => { expect(within(warning).getByRole('button', { name: 'Continue' })).toHaveFocus(); });

    await userEvent.keyboard('{Escape}');

    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: 'Add category' })).toHaveFocus();
  });

  it('shows Admission’s reason in the sheet when a rename is refused, keeps the pasted name whole, and adds no failure Notification', async () => {
    const storageMock = getMockStorageManager();
    const longName = 'R'.repeat(PROMPT_LIMITS.category + 1);
    const reason = `Category name cannot exceed ${PROMPT_LIMITS.category} characters`;

    await renderApp();
    await userEvent.click(screen.getByRole('tab', { name: 'Categories' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Edit category Work' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit category' });
    const editInput = within(sheet).getByRole('textbox', { name: 'Category name' });
    await userEvent.clear(editInput);
    await userEvent.paste(longName);

    expect(editInput).toHaveValue(longName);

    await userEvent.keyboard('{Enter}');

    expect(await within(sheet).findByRole('alert')).toHaveTextContent(reason);
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    expect(editInput).toHaveValue(longName);
    expect(storageMock.updateCategory).not.toHaveBeenCalled();
  });

  it('keeps a long pasted Category name whole on create and shows Admission’s reason in the sheet', async () => {
    const storageMock = getMockStorageManager();
    const longName = 'N'.repeat(PROMPT_LIMITS.category + 1);
    const reason = `Category name cannot exceed ${PROMPT_LIMITS.category} characters`;

    await renderApp();
    await userEvent.click(screen.getByRole('tab', { name: 'Categories' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add category' }));

    const sheet = screen.getByRole('dialog', { name: 'New category' });
    const nameInput = within(sheet).getByRole('textbox', { name: 'Category name' });
    await userEvent.paste(longName);

    expect(nameInput).toHaveValue(longName);

    await userEvent.click(within(sheet).getByRole('button', { name: 'Create' }));

    expect(await within(sheet).findByRole('alert')).toHaveTextContent(reason);
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    expect(nameInput).toHaveValue(longName);
    expect(storageMock.saveCategory).not.toHaveBeenCalled();
  });

  it('creates a Category from the sheet and confirms it with its name', async () => {
    const storageMock = getMockStorageManager();
    vi.mocked(storageMock.saveCategory).mockImplementation((category: Omit<Category, 'id'>) =>
      Promise.resolve({ id: 'research', ...category, name: category.name.trim() }));

    await renderApp();
    await userEvent.click(screen.getByRole('tab', { name: 'Categories' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add category' }));
    await userEvent.keyboard('  Research {Enter}');

    const notification = await screen.findByTestId('toast');
    expect(notification).toHaveTextContent('Category created');
    expect(notification).toHaveTextContent('Research');
    expect(await screen.findByRole('button', { name: 'Edit category Research' })).toBeInTheDocument();
  });

  it('saves a Category from the sheet and confirms it with its new name', async () => {
    const storageMock = getMockStorageManager();
    vi.mocked(storageMock.updateCategory).mockResolvedValue({ id: 'work', name: 'Office', color: '#E11D48' });

    await renderApp();
    await userEvent.click(screen.getByRole('tab', { name: 'Categories' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit category Work' }));
    const name = screen.getByRole('textbox', { name: 'Category name' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Office');
    await userEvent.click(screen.getByRole('button', { name: 'Rose' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(storageMock.updateCategory).toHaveBeenCalledWith('work', { name: 'Office', color: '#E11D48' });
    const notification = await screen.findByTestId('toast');
    expect(notification).toHaveTextContent('Category saved');
    expect(notification).toHaveTextContent('Office');
    expect(await screen.findByRole('button', { name: 'Edit category Office' })).toBeInTheDocument();
  });

  it('deletes a Category at once and puts it back, with its Prompts, from the Undo of its Notification', async () => {
    const storageMock = getMockStorageManager();
    const work = defaultCategories[1];
    const deleted: DeletedCategory = { category: work, index: 1, movedPrompts: [{ id: 'prompt-1', updatedAt: 1, movedAt: 2 }] };
    vi.mocked(storageMock.deleteCategory).mockResolvedValue(deleted);
    vi.mocked(storageMock.restoreCategory).mockResolvedValue(work);

    await renderApp();
    await userEvent.click(screen.getByRole('tab', { name: 'Categories' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit category Work' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Edit category' })).getByRole('button', { name: 'Delete' }));

    expect(storageMock.deleteCategory).toHaveBeenCalledWith('work');
    const notification = await screen.findByTestId('toast');
    expect(notification).toHaveTextContent('Category deleted');
    expect(notification).toHaveTextContent('Work');
    await waitFor(() => { expect(screen.queryByRole('button', { name: 'Edit category Work' })).not.toBeInTheDocument(); });

    await userEvent.click(within(notification).getByRole('button', { name: 'Undo' }));

    expect(storageMock.restoreCategory).toHaveBeenCalledWith(deleted);
    expect(await screen.findByRole('button', { name: 'Edit category Work' })).toBeInTheDocument();
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('asks before deleting a Category when the Notifications are off, as there is no Undo', async () => {
    const storageMock = getMockStorageManager();
    await getChromeMock().storage.local.set({ toast_settings: { enabled: false } });
    vi.mocked(storageMock.deleteCategory).mockResolvedValue({ category: defaultCategories[1], index: 1, movedPrompts: [] });

    await renderApp();
    await userEvent.click(screen.getByRole('tab', { name: 'Categories' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit category Work' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Edit category' })).getByRole('button', { name: 'Delete' }));

    const confirm = screen.getByRole('dialog', { name: 'Delete Category' });
    expect(storageMock.deleteCategory).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(storageMock.deleteCategory).toHaveBeenCalledWith('work');
  });

  it('opens the storage warning, not an alert, when storage stops a Settings import', async () => {
    const storageMock = getMockStorageManager();
    const quotaError: AppError = { type: 'STORAGE_QUOTA_EXCEEDED', message: 'Quota reached' };
    vi.mocked(storageMock.importPrompt).mockRejectedValue(quotaError);
    // jsdom has no alert(): give it one to watch
    const alertMock = vi.fn();
    window.alert = alertMock;

    await renderApp();
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings' });

    const backup = JSON.stringify({ prompts: [basePrompt], categories: [] });
    const file = new File([backup], 'backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(backup) });
    await userEvent.upload(document.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement, file);

    const warning = await screen.findByRole('dialog', { name: 'Storage Limit Reached' });
    expect(within(warning).getByText('The import stopped when storage was full: 0 of 1 prompt was imported. Quota reached')).toBeInTheDocument();
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('keeps the library on screen and shows a toast when pinning fails', async () => {
    const storageMock = getMockStorageManager();
    storageMock.getPrompts.mockResolvedValue([basePrompt]);
    const setSpy = vi.spyOn(chrome.storage.local, 'set');
    setSpy.mockRejectedValue(new Error('Storage write failed'));

    await renderApp();

    await userEvent.click(await screen.findByRole('button', { name: `Pin ${basePrompt.title}` }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't update pin");
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

    const saveButton = await screen.findByRole('button', { name: 'Save' });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(promptMock.updatePrompt).toHaveBeenCalled();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Title is required');
    expect(screen.getAllByText(/title is required/i)).toHaveLength(1);
    expect(screen.queryByText(/error loading data/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toHaveValue(`${basePrompt.content} additional`);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});

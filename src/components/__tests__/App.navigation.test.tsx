import { render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { getMockStorageManager } from '../../test/mocks';
import type { Category, Prompt } from '../../types';

const defaultCategories: Category[] = [
  { id: 'default', name: 'Uncategorized', color: '#888888' },
  { id: 'work', name: 'Work', color: '#ff00ff' }
];

const prompts: Prompt[] = [
  { id: 'p1', title: 'Draft email', content: 'Hello', category: 'Work', createdAt: 1, updatedAt: 1 },
  { id: 'p2', title: 'Summarize', content: 'Sum it up', category: 'Uncategorized', createdAt: 2, updatedAt: 2 }
];

const renderApp = async () => {
  render(<App />);
  await screen.findByRole('heading', { name: /my prompt manager/i });
};

describe('App tab bar navigation', () => {
  beforeEach(() => {
    window.location.search = '';
    const storageMock = getMockStorageManager();
    storageMock.getCategories.mockResolvedValue([...defaultCategories]);
    storageMock.getPrompts.mockResolvedValue([...prompts]);
  });

  afterEach(() => {
    window.location.search = '';
  });

  it('opens on the Library with the tab bar and the prompt count', async () => {
    await renderApp();

    expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('2 prompts')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /manage categories/i })).not.toBeInTheDocument();
  });

  it.each([
    ['Categories', 'Categories'],
    ['Analytics', 'Analytics'],
    ['Settings', 'Settings']
  ])('switches to the %s Section without a Back button', async (tab, heading) => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole('tab', { name: tab }));

    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('back-button')).not.toBeInTheDocument();
  });

  it('opens the editor as a sheet over the Library, which waits inert, and gives New the keyboard back once the sheet has left', async () => {
    const user = userEvent.setup();
    await renderApp();
    const newButton = screen.getByRole('button', { name: /add new prompt/i });

    await user.click(newButton);

    const sheet = await screen.findByTestId('editor-sheet');
    expect(sheet).toHaveClass('animate-sheet-in');
    expect(screen.getByLabelText(/title/i)).toHaveFocus();
    // The Library and the tab bar stay in the document, beneath the sheet and out of reach
    expect(screen.getByRole('heading', { name: /my prompt manager/i }).closest('[inert]')).not.toBeNull();
    expect(screen.getByRole('tablist').closest('[inert]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // The sheet leaves to the bottom, out of reach, then unmounts
    expect(sheet).toHaveClass('animate-sheet-out');
    expect(sheet).toHaveAttribute('inert');
    await waitForElementToBeRemoved(sheet);
    expect(newButton).toHaveFocus();
    expect(screen.getByRole('heading', { name: /my prompt manager/i }).closest('[inert]')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens a fresh editor when New is pressed again while the sheet is leaving', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole('button', { name: /add new prompt/i }));
    await user.type(await screen.findByLabelText(/title/i), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByTestId('editor-sheet')).toHaveClass('animate-sheet-out');

    await user.click(screen.getByRole('button', { name: /add new prompt/i }));

    const sheet = screen.getByTestId('editor-sheet');
    expect(sheet).toHaveClass('animate-sheet-in');
    expect(screen.getAllByTestId('editor-sheet')).toHaveLength(1);
    expect(screen.getByLabelText(/title/i)).toHaveValue('');
  });

  it('keeps the search query when switching Sections and coming back', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.type(screen.getByPlaceholderText(/search your prompts/i), 'email');
    await user.click(screen.getByRole('tab', { name: 'Analytics' }));
    await screen.findByRole('heading', { name: 'Analytics', level: 1 });
    await user.click(screen.getByRole('tab', { name: 'Library' }));

    expect(await screen.findByPlaceholderText(/search your prompts/i)).toHaveValue('email');
  });

  it('refreshes prompts and categories when leaving Settings', async () => {
    const user = userEvent.setup();
    const storageMock = getMockStorageManager();
    await renderApp();

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    const promptCalls = storageMock.getPrompts.mock.calls.length;
    const categoryCalls = storageMock.getCategories.mock.calls.length;

    await user.click(screen.getByRole('tab', { name: 'Library' }));

    await waitFor(() => {
      expect(storageMock.getPrompts.mock.calls.length).toBeGreaterThan(promptCalls);
      expect(storageMock.getCategories.mock.calls.length).toBeGreaterThan(categoryCalls);
    });
  });

  it('scrolls the active Section back to the top when its tab is pressed again', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.fn();
    const original = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo as typeof HTMLElement.prototype.scrollTo;

    try {
      await renderApp();
      await user.click(screen.getByRole('tab', { name: 'Library' }));

      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
      expect(screen.getByRole('main')).toHaveAttribute('data-scroll-container');
    } finally {
      HTMLElement.prototype.scrollTo = original;
    }
  });

  it('shows the tab bar with Settings selected in picker mode', async () => {
    window.location.search = '?picker=true';
    render(<App />);

    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    expect(screen.getByRole('tab', { name: 'Settings' })).toHaveAttribute('aria-selected', 'true');
  });
});

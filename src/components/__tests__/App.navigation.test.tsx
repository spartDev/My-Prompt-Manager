import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
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

  it('shows the first Section at once when the popup opens', async () => {
    await renderApp();

    expect(screen.getByTestId('section').className).not.toMatch(/animate-section/);
  });

  it('slides a Section further along the tab bar in from the right', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole('tab', { name: 'Settings' }));

    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    expect(screen.getByTestId('section')).toHaveClass('animate-section-forward');
  });

  it('slides a Section further back along the tab bar in from the left', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings', level: 1 });

    await user.click(screen.getByRole('tab', { name: 'Categories' }));

    await screen.findByRole('heading', { name: 'Categories', level: 1 });
    expect(screen.getByTestId('section')).toHaveClass('animate-section-back');
    expect(screen.getByTestId('section')).not.toHaveClass('animate-section-forward');
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
    // ...and recede a little under a scrim as the sheet rises
    const beneath = screen.getByTestId('editor-beneath');
    const scrim = screen.getByTestId('editor-scrim');
    expect(beneath).toHaveClass('animate-recede-in');
    expect(scrim).toHaveClass('animate-scrim-in');
    // The backdrop of a drawer, as the design system prescribes it
    expect(scrim).toHaveClass('bg-backdrop', 'backdrop-blur-sm');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // The sheet leaves to the bottom, out of reach, then unmounts; the Library comes back with it
    expect(sheet).toHaveClass('animate-sheet-out');
    expect(sheet).toHaveAttribute('inert');
    expect(beneath).toHaveClass('animate-recede-out');
    expect(scrim).toHaveClass('animate-scrim-out');
    await waitForElementToBeRemoved(sheet);
    expect(scrim).not.toBeInTheDocument();
    expect(beneath).not.toHaveClass('animate-recede-out');
    // The focus comes back in an effect of the commit that removed the sheet, which React may run
    // a scheduler task later on a slow machine
    await waitFor(() => { expect(newButton).toHaveFocus(); });
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

  it.each([
    ['Cmd+K', { metaKey: true }],
    ['Ctrl+K', { ctrlKey: true }]
  ])('comes back to the Library and puts the keyboard in the search field on %s, from another Section', async (_name, modifier) => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    await screen.findByRole('heading', { name: 'Settings', level: 1 });

    const passedOn = fireEvent.keyDown(document.body, { key: 'k', ...modifier });

    expect(passedOn).toBe(false);
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => { expect(screen.getByRole('searchbox', { name: 'Search prompts' })).toHaveFocus(); });
  });

  it.each(['Categories', 'Analytics'])('reaches the search field with Cmd+K from %s', async (tab) => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('tab', { name: tab }));
    await screen.findByRole('heading', { name: tab, level: 1 });

    fireEvent.keyDown(document.body, { key: 'K', metaKey: true });

    await waitFor(() => { expect(screen.getByRole('searchbox', { name: 'Search prompts' })).toHaveFocus(); });
  });

  it('puts the keyboard in the search field on Cmd+K from the Library itself, each time', async () => {
    await renderApp();
    const field = screen.getByRole('searchbox', { name: 'Search prompts' });

    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
    await waitFor(() => { expect(field).toHaveFocus(); });
    field.blur();
    fireEvent.keyDown(document.body, { key: 'k', metaKey: true });

    await waitFor(() => { expect(field).toHaveFocus(); });
  });

  it('leaves Cmd+K alone while the editor is open', async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole('button', { name: /add new prompt/i }));
    const title = await screen.findByLabelText(/title/i);

    const passedOn = fireEvent.keyDown(title, { key: 'k', metaKey: true });

    expect(passedOn).toBe(true);
    expect(title).toHaveFocus();
  });

  it('opens the editor on a new Prompt titled with a search that found nothing', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.type(screen.getByRole('searchbox', { name: 'Search prompts' }), 'Quarterly review');
    const empty = await screen.findByRole('region', { name: /no search results/i });
    expect(empty).toHaveTextContent('Nothing called “Quarterly review” yet');
    await user.click(screen.getByRole('button', { name: 'Create it' }));

    await screen.findByTestId('editor-sheet');
    expect(screen.getByLabelText(/title/i)).toHaveValue('Quarterly review');
    expect(screen.getByRole('heading', { name: /new prompt/i })).toBeInTheDocument();
    // The title it opened with is not a change to discard
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument();
  });

  it('lists the same Prompts in the same order for a same search', async () => {
    const user = userEvent.setup();
    getMockStorageManager().getPrompts.mockResolvedValue([
      { id: 'a', title: 'Zeta email', content: 'x', category: 'Work', createdAt: 1, updatedAt: 5 },
      { id: 'b', title: 'Alpha', content: 'send an EMAIL', category: 'Work', createdAt: 2, updatedAt: 9 },
      { id: 'c', title: 'Beta', content: 'x', category: 'Email drafts', createdAt: 3, updatedAt: 7 },
      { id: 'd', title: 'Pinned email', content: 'x', category: 'Work', createdAt: 4, updatedAt: 1, pinned: true },
      { id: 'e', title: 'Unrelated', content: 'nothing', category: 'Work', createdAt: 5, updatedAt: 8 }
    ]);
    await renderApp();

    await user.type(screen.getByRole('searchbox', { name: 'Search prompts' }), ' Email ');

    // Title, content and Category name are searched, ignoring case and the spaces around; the
    // Pinned Prompt comes first, then the sort of Settings (last updated first)
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.getAttribute('aria-label')))
        .toEqual(['Pinned email', 'Alpha', 'Beta', 'Zeta email']);
    });
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

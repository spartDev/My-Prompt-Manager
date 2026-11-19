/**
 * The Library's read failed or found malformed data (My-Prompt-Manager-ou48), in App over the store
 * of an opening: StorageManager is the real one over the test storage, its reads made to fail where
 * a test says so.
 *
 * - AC1: Try again on Error Loading Data, from the keyboard, never leaves the keyboard on the document.
 *   While the Library is read again the screen stays, its Try again with the keyboard; a read that
 *   fails again leaves it there. The Library back, the keyboard goes to its active Library filter (All,
 *   as at every opening), or with no Prompt to the main action of the empty Library; another Section
 *   back, to that Section's tab.
 * - AC2: Categories stored malformed (an entry that is not a Category, or a value that is not a list)
 *   show the Library with the Categories that are well formed, never Error Loading Data, never a
 *   TypeError at render.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { getMockStorageManager } from '../../test/mocks';
import { type KeyboardAtCommits, keyboardAtCommits } from '../../test/utils/keyboardAtCommits';
import { type Category, DEFAULT_CATEGORY, type Prompt } from '../../types';

const ERROR_TITLE = 'Error Loading Data';

const uncategorized: Category = { id: 'default', name: DEFAULT_CATEGORY };
const work: Category = { id: 'work', name: 'Work', color: '#DB2777' };

const prompt = (id: string, title: string, category: string): Prompt => ({
  id,
  title,
  content: `Content of ${title}`,
  category,
  createdAt: 1,
  updatedAt: 1,
  usageCount: 0,
  lastUsedAt: 1
});

const LIBRARY: Prompt[] = [prompt('p1', 'Draft email', 'Work'), prompt('p2', 'Summarize', DEFAULT_CATEGORY)];

const seed = async ({ prompts = LIBRARY, categories = [uncategorized, work] as unknown }: { prompts?: Prompt[]; categories?: unknown } = {}): Promise<void> => {
  await chrome.storage.local.set({ prompts, categories });
};

/** A read of the Prompts that fails when the test says, so it can be looked at while it runs */
const heldRead = (): { fail: (message: string) => void } => {
  let reject: (error: Error) => void = () => undefined;
  getMockStorageManager().getPrompts.mockImplementationOnce(() => new Promise((_, rejectRead) => { reject = rejectRead; }));
  return { fail: (message) => { act(() => { reject(new Error(message)); }); } };
};

/** Error Loading Data's Try again, given the keyboard as a keyboard user gives it: Tab from the document */
const tabToTryAgain = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
  const tryAgain = await screen.findByRole('button', { name: 'Try again' });
  await user.tab();
  expect(tryAgain).toHaveFocus();
  return tryAgain;
};

/**
 * No commit since the press of Try again ended with the keyboard on the document: the control asked to
 * take it does so in the commit that shows it (a layout effect), not after (a passive effect)
 */
const expectNeverOnTheDocument = (keyboard: KeyboardAtCommits): void => {
  expect(keyboard.commits()).toBeGreaterThan(0);
  expect(keyboard.onDocument()).toEqual([]);
};

describe('App: Error Loading Data and malformed stored Categories (My-Prompt-Manager-ou48)', () => {
  beforeEach(() => {
    window.location.search = '';
  });

  describe('AC1: the keyboard after Try again', () => {
    it.each([
      { read: 'getPrompts' },
      { read: 'getCategories' }
    ] as const)('a read that fails again ($read): the screen and its Try again keep the keyboard while the Library is read, and after', async ({ read }) => {
      await seed();
      const storageManager = getMockStorageManager();
      storageManager[read].mockRejectedValueOnce(new Error('Storage unavailable'));
      let rejectAgain: (error: Error) => void = () => undefined;
      storageManager[read].mockImplementationOnce(() => new Promise((_, reject) => { rejectAgain = reject; }));
      const user = userEvent.setup();
      render(<App />);
      const tryAgain = await tabToTryAgain(user);

      await user.keyboard('{Enter}');

      // The Library is being read: the screen stays, and its Try again keeps the keyboard
      expect(screen.getByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
      expect(document.activeElement).toBe(tryAgain);
      expect(screen.queryByText('Loading your prompts...')).not.toBeInTheDocument();

      act(() => { rejectAgain(new Error('Still unavailable')); });

      expect(await screen.findByText('Still unavailable')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus();
      expect(screen.queryAllByTestId('prompt-card')).toHaveLength(0);
    });

    it('the Library back, with Prompts: the keyboard is on its active Library filter, All, never on the document on the way', async () => {
      await seed();
      getMockStorageManager().getPrompts.mockRejectedValueOnce(new Error('Storage unavailable'));
      const user = userEvent.setup();
      const keyboard = keyboardAtCommits();
      render(keyboard.wrap(<App />));
      await tabToTryAgain(user);
      keyboard.start();

      await user.keyboard('{Enter}');

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(LIBRARY.length);
      expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument();
      await waitFor(() => { expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus(); });
      expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
      expectNeverOnTheDocument(keyboard);
    });

    it('the Library back, with no Prompt: the keyboard is on the main action of the empty Library, never on the document on the way', async () => {
      await seed({ prompts: [] });
      getMockStorageManager().getPrompts.mockRejectedValueOnce(new Error('Storage unavailable'));
      const user = userEvent.setup();
      const keyboard = keyboardAtCommits();
      render(keyboard.wrap(<App />));
      await tabToTryAgain(user);
      keyboard.start();

      await user.keyboard('{Enter}');

      const empty = await screen.findByTestId('library-empty');
      await waitFor(() => { expect(within(empty).getByRole('button', { name: /write your first prompt/i })).toHaveFocus(); });
      expectNeverOnTheDocument(keyboard);
    });

    it('a Try again that fails, then one that reads the Library: the keyboard on Try again, then on All', async () => {
      await seed();
      const failing = heldRead();
      const user = userEvent.setup();
      render(<App />);
      failing.fail('Storage unavailable');
      const tryAgain = await tabToTryAgain(user);
      const again = heldRead();

      await user.keyboard('{Enter}');
      again.fail('Still unavailable');

      expect(await screen.findByText('Still unavailable')).toBeInTheDocument();
      expect(tryAgain).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(LIBRARY.length);
      await waitFor(() => { expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus(); });
    });

    it('another Section back (Categories, after a deletion whose Prompts could not be read again): the keyboard is on its tab, never on the document on the way', async () => {
      await seed();
      const user = userEvent.setup();
      const keyboard = keyboardAtCommits();
      render(keyboard.wrap(<App />));
      await user.click(await screen.findByRole('tab', { name: 'Categories' }));
      await user.click(await screen.findByRole('button', { name: 'Edit category Work' }));
      // The deletion itself goes through; the read of the Prompts after it fails
      const storageManager = getMockStorageManager();
      vi.mocked(storageManager.deleteCategory).mockResolvedValueOnce({ category: work, index: 1, movedPrompts: [] });
      storageManager.getPrompts.mockRejectedValueOnce(new Error('Storage unavailable'));
      await user.click(within(screen.getByRole('dialog', { name: 'Edit category' })).getByRole('button', { name: 'Delete' }));
      const tryAgain = await screen.findByRole('button', { name: 'Try again' });
      act(() => { tryAgain.focus(); });
      keyboard.start();

      await user.keyboard('{Enter}');

      await waitFor(() => { expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument(); });
      await waitFor(() => { expect(screen.getByRole('tab', { name: 'Categories' })).toHaveFocus(); });
      expect(screen.getByRole('tab', { name: 'Categories' })).toHaveAttribute('aria-selected', 'true');
      expectNeverOnTheDocument(keyboard);
    });
  });

  describe('AC2: Categories stored malformed', () => {
    it.each<{ stored: string; categories: unknown }>([
      { stored: '[null, Uncategorized, Work]', categories: [null, uncategorized, work] },
      { stored: '[Uncategorized, null, Work]', categories: [uncategorized, null, work] },
      { stored: 'an object that is not a list', categories: { id: 'work', name: 'Work' } },
      { stored: '[Uncategorized, an entry without a string name, Work]', categories: [uncategorized, { id: 'nameless', name: 42 }, work] },
      { stored: '[an entry without a name, Uncategorized, Work]', categories: [{ id: 'nameless' }, uncategorized, work] }
    ])('$stored: the Library with its Prompts and the filters of the well-formed Categories, never Error Loading Data; Categories lists them', async ({ categories }) => {
      await seed({ categories });
      const wellFormed = Array.isArray(categories);
      const user = userEvent.setup();

      render(<App />);

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(LIBRARY.length);
      expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument();
      if (wellFormed) {
        expect(screen.getByRole('radio', { name: 'Work' })).toBeInTheDocument();
      }

      await user.click(screen.getByRole('tab', { name: 'Categories' }));

      expect(await screen.findByRole('heading', { name: 'Categories' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument();
      // The well-formed Categories, and no row for an entry that is not one
      const rows = screen.queryAllByRole('button', { name: /^Edit category / }).map((button) => button.getAttribute('aria-label'));
      expect(rows).toEqual(wellFormed ? ['Edit category Work'] : []);
    });
  });
});

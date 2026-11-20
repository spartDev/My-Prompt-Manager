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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  describe('Try again shows that it reads, and says how it went (My-Prompt-Manager-p4y9)', () => {
    /** How long Try again waits for a read before it can be pressed again (RETRY_READ_BOUND_MS) */
    const BOUND_MS = 10_000;

    /** The read of the Prompts made by the press of Try again, held until the test settles it */
    const heldRetry = (): { succeed: () => void; fail: (message: string) => void } => {
      let resolve: (prompts: Prompt[]) => void = () => undefined;
      let reject: (error: Error) => void = () => undefined;
      getMockStorageManager().getPrompts.mockImplementationOnce(() => new Promise<Prompt[]>((resolveRead, rejectRead) => { resolve = resolveRead; reject = rejectRead; }));
      return {
        succeed: () => { act(() => { resolve(LIBRARY); }); },
        fail: (message) => { act(() => { reject(new Error(message)); }); }
      };
    };

    /** The live region that says how Try again went: in the document before the press, and after it */
    const loadStatus = (): HTMLElement => screen.getByTestId('load-status');

    /** Opens the popup on Error Loading Data, the opening's read of the Prompts refused, the keyboard on Try again */
    const openOnTheError = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
      await seed();
      getMockStorageManager().getPrompts.mockRejectedValueOnce(new Error('Storage unavailable'));
      render(<App />);
      return tabToTryAgain(user);
    };

    it('AC1: while it reads, Try again shows the busy state of the Loading State and keeps the keyboard, aria-disabled and never disabled; a press meanwhile reads nothing more', async () => {
      const user = userEvent.setup();
      const tryAgain = await openOnTheError(user);
      const retry = heldRetry();

      await user.keyboard('{Enter}');

      // The same button, busy: its spinner and its label, the keyboard on it
      expect(tryAgain).toHaveAccessibleName('Trying again...');
      expect(tryAgain).toHaveAttribute('aria-disabled', 'true');
      expect(tryAgain).not.toBeDisabled();
      expect(tryAgain).toHaveFocus();
      expect(tryAgain.querySelector('[aria-hidden="true"].animate-spin')).not.toBeNull();
      const reads = getMockStorageManager().getPrompts.mock.calls.length;
      await user.keyboard('{Enter}');
      await user.click(tryAgain);
      expect(getMockStorageManager().getPrompts.mock.calls.length).toBe(reads);

      retry.succeed();

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(LIBRARY.length);
    });

    it('AC2: the Library back, the role=status says so, the same live region as before the press, silent while it read', async () => {
      const user = userEvent.setup();
      await openOnTheError(user);
      const status = loadStatus();
      expect(status).toHaveAttribute('role', 'status');
      expect(status).toBeEmptyDOMElement();
      const retry = heldRetry();

      await user.keyboard('{Enter}');
      expect(status).toBeEmptyDOMElement();
      retry.succeed();

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(LIBRARY.length);
      expect(loadStatus()).toBe(status);
      expect(status).toHaveTextContent('Your library is back');
    });

    // PR #610's e2e on 51d05623: the status first in #root, the side panel's editor motion measured it
    // (its sr-only box at -1px) for the app. The app is the root's first element, on either screen
    it('AC2: the live region comes after the screen, never first in the root, on the error screen and on the Library', async () => {
      const user = userEvent.setup();
      await openOnTheError(user);
      const status = loadStatus();
      const root = status.parentElement;
      expect(root?.firstElementChild).not.toBe(status);
      expect(root?.firstElementChild).toContainElement(screen.getByRole('heading', { name: ERROR_TITLE }));

      await user.keyboard('{Enter}');

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(LIBRARY.length);
      expect(loadStatus()).toBe(status);
      expect(status.parentElement).toBe(root);
      expect(root?.firstElementChild).not.toBe(status);
      expect(root?.firstElementChild).toContainElement(screen.getAllByTestId('prompt-card')[0]);
    });

    it('AC2: the read failing again, the role=status says so; Try again leaves its busy state, the keyboard on it', async () => {
      const user = userEvent.setup();
      const tryAgain = await openOnTheError(user);
      const status = loadStatus();
      const retry = heldRetry();

      await user.keyboard('{Enter}');
      retry.fail('Still unavailable');

      await waitFor(() => { expect(status).toHaveTextContent("Still couldn't read your library"); });
      expect(screen.getByText('Still unavailable')).toBeInTheDocument();
      expect(tryAgain).toHaveAccessibleName('Try again');
      expect(tryAgain).not.toHaveAttribute('aria-disabled');
      expect(tryAgain).toHaveFocus();
    });

    // Owner decision on PR #610: a failure is held so its busy state is seen, a success is not
    describe('the busy state held 300 ms after the press when the read fails again (RETRY_FAILURE_HOLD_MS)', () => {
      afterEach(() => { vi.useRealTimers(); });

      it('a read that fails again at once: "Trying again..." stays until 300 ms after the press, over the message it tries past, nothing said; a press meanwhile reads nothing; at 300 ms, Try again with the failure, the role=status saying so then, the keyboard on it', async () => {
        const user = userEvent.setup();
        const tryAgain = await openOnTheError(user);
        const status = loadStatus();
        const getPrompts = getMockStorageManager().getPrompts;
        getPrompts.mockRejectedValueOnce(new Error('Still unavailable'));
        vi.useFakeTimers();

        act(() => { tryAgain.click(); });
        // The reads end, the Prompts' refused, with no time gone by
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.queryByText('Still unavailable')).not.toBeInTheDocument();

        await act(async () => { await vi.advanceTimersByTimeAsync(299); });
        expect(tryAgain).toHaveAccessibleName('Trying again...');
        expect(tryAgain).toHaveAttribute('aria-disabled', 'true');
        expect(tryAgain).toHaveFocus();
        expect(screen.getByText('Storage unavailable')).toBeInTheDocument();
        expect(screen.queryByText('Still unavailable')).not.toBeInTheDocument();
        expect(status).toBeEmptyDOMElement();
        const reads = getPrompts.mock.calls.length;
        act(() => { tryAgain.click(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(getPrompts.mock.calls.length).toBe(reads);

        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(tryAgain).toHaveAccessibleName('Try again');
        expect(tryAgain).not.toHaveAttribute('aria-disabled');
        expect(tryAgain).toHaveFocus();
        expect(screen.getByText('Still unavailable')).toBeInTheDocument();
        expect(status).toHaveTextContent("Still couldn't read your library");
      });

      it('a read that works at once: the Library as soon as the reads end, not held', async () => {
        const user = userEvent.setup();
        const tryAgain = await openOnTheError(user);
        vi.useFakeTimers();

        act(() => { tryAgain.click(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });

        expect(screen.getAllByTestId('prompt-card')).toHaveLength(LIBRARY.length);
        expect(screen.queryByRole('heading', { name: ERROR_TITLE })).not.toBeInTheDocument();
        expect(loadStatus()).toHaveTextContent('Your library is back');
      });

      it('unmounted during the hold of a failure, it leaves no timer behind', async () => {
        await seed();
        const getPrompts = getMockStorageManager().getPrompts;
        getPrompts.mockRejectedValueOnce(new Error('Storage unavailable'));
        const user = userEvent.setup();
        const { unmount } = render(<App />);
        const tryAgain = await tabToTryAgain(user);
        getPrompts.mockRejectedValueOnce(new Error('Still unavailable'));
        vi.useFakeTimers();
        act(() => { tryAgain.click(); });
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        expect(tryAgain).toHaveAccessibleName('Trying again...');

        unmount();

        expect(vi.getTimerCount()).toBe(0);
      });
    });

    it('AC3: a read that never settles: Try again stays busy for 10 s, then can be pressed again and the role=status says so; a read that works then brings the Library', async () => {
      const user = userEvent.setup();
      const tryAgain = await openOnTheError(user);
      const status = loadStatus();
      getMockStorageManager().getPrompts.mockImplementationOnce(() => new Promise<Prompt[]>(() => undefined));
      // Faked from here, still running with the real clock, so the reads and user-event's waits go on
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        await user.keyboard('{Enter}');
        expect(tryAgain).toHaveAttribute('aria-disabled', 'true');

        // 100ms short of the bound (the clock also moves with real time while the test runs): still busy
        act(() => { vi.advanceTimersByTime(BOUND_MS - 100); });
        expect(tryAgain).toHaveAttribute('aria-disabled', 'true');
        expect(status).toBeEmptyDOMElement();

        act(() => { vi.advanceTimersByTime(100); });
        expect(tryAgain).not.toHaveAttribute('aria-disabled');
        expect(tryAgain).toHaveAccessibleName('Try again');
        expect(tryAgain).toHaveFocus();
        expect(status).toHaveTextContent('Still reading your library. You can try again.');
        expect(screen.getByRole('heading', { name: ERROR_TITLE })).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }

      // Pressed again: a new read, which works
      await user.keyboard('{Enter}');

      expect(await screen.findAllByTestId('prompt-card')).toHaveLength(LIBRARY.length);
      expect(status).toHaveTextContent('Your library is back');
      await waitFor(() => { expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus(); });
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

import { act, fireEvent, render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { getMockStorageManager } from '../../test/mocks';
import { MOTION } from '../../theme/motion';
import type { Category, Prompt } from '../../types';
import { markReleaseSeen, readWhatsNewRecord, WHATS_NEW_KEY } from '../../whatsNew/storage';

// The real storage module, watched: when the Release is marked seen, and whether the record is read at all
vi.mock('../../whatsNew/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../whatsNew/storage')>();
  return {
    ...actual,
    markReleaseSeen: vi.fn(actual.markReleaseSeen),
    readWhatsNewRecord: vi.fn(actual.readWhatsNewRecord)
  };
});

const categories: Category[] = [{ id: 'default', name: 'Uncategorized', color: '#888888' }];
const prompts: Prompt[] = [
  { id: 'p1', title: 'Draft email', content: 'Hello', category: 'Uncategorized', createdAt: 1, updatedAt: 1 }
];

const WHATS_NEW = /what.s new/i;

/** An opening of the popup after the update from 1.9.0 to 2.0.0, whose Release notes ship */
const updateTo2_0 = async (): Promise<void> => {
  vi.mocked(chrome.runtime.getManifest).mockReturnValue({ version: '2.0.0' } as chrome.runtime.Manifest);
  await chrome.storage.local.set({ [WHATS_NEW_KEY]: { lastSeenVersion: '1.9.0' } });
};

/** Renders the popup and waits for What's new over the Library */
const openWithWhatsNew = async () => {
  render(<App />);
  const sheet = await screen.findByRole('dialog', { name: WHATS_NEW });
  await waitFor(() => { expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus(); });
  return sheet;
};

const storedLastSeen = async (): Promise<unknown> =>
  ((await chrome.storage.local.get(WHATS_NEW_KEY))[WHATS_NEW_KEY] as { lastSeenVersion?: string } | undefined)?.lastSeenVersion;

/** The sheet leaves: it stays in the document, closed, for its exit, then unmounts */
const expectLeavingThenGone = (sheet: HTMLElement): void => {
  expect(sheet).toBeInTheDocument();
  expect(sheet).toHaveClass('animate-whats-new-sheet-out');
  act(() => { vi.advanceTimersByTime(MOTION.whatsNewSheetOut - 1); });
  expect(sheet).toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(1); });
  expect(sheet).not.toBeInTheDocument();
};

describe("App: What's new", () => {
  beforeEach(async () => {
    window.location.search = '';
    const storageMock = getMockStorageManager();
    storageMock.getCategories.mockResolvedValue([...categories]);
    storageMock.getPrompts.mockResolvedValue([...prompts]);
    await updateTo2_0();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.search = '';
  });

  it('shows the sheet over the Library once the decision is known, and leaves the Library usable once closed', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Not while the decision loads
    expect(screen.queryByRole('dialog', { name: WHATS_NEW })).not.toBeInTheDocument();

    const sheet = await screen.findByRole('dialog', { name: WHATS_NEW });
    expect(sheet).toHaveTextContent('New in 2.0.0');
    // The Library is beneath it
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /my prompt manager/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await waitForElementToBeRemoved(sheet);

    await user.type(screen.getByRole('searchbox', { name: 'Search prompts' }), 'Draft');
    expect(screen.getByRole('searchbox', { name: 'Search prompts' })).toHaveValue('Draft');
    await user.click(screen.getByRole('button', { name: /add new prompt/i }));
    expect(await screen.findByTestId('editor-sheet')).toBeInTheDocument();
  });

  describe('marks the Release seen before the exit ends', () => {
    it.each([
      ['Got it', () => { fireEvent.click(screen.getByRole('button', { name: 'Got it' })); }],
      ['the backdrop', () => { fireEvent.click(screen.getByTestId('whats-new-backdrop')); }],
      ['Escape', () => { fireEvent.keyDown(document.body, { key: 'Escape' }); }],
      ['Enter', () => { fireEvent.keyDown(document.body, { key: 'Enter' }); }],
      ['a tile', () => { fireEvent.click(screen.getByRole('button', { name: /^Pinned prompts/ })); }]
    ])('on %s', async (_means, closeIt) => {
      const sheet = await openWithWhatsNew();
      vi.mocked(markReleaseSeen).mockClear();
      vi.useFakeTimers();

      closeIt();

      // The write has started, while the sheet is still on its way out
      expect(markReleaseSeen).toHaveBeenCalledTimes(1);
      expect(vi.mocked(markReleaseSeen).mock.calls[0]?.[0]).toBe('2.0.0');
      expectLeavingThenGone(sheet);

      vi.useRealTimers();
      await waitFor(async () => { expect(await storedLastSeen()).toBe('2.0.0'); });
    });
  });

  it('marks the Release seen once when two closing events land in the same task', async () => {
    await openWithWhatsNew();
    vi.mocked(markReleaseSeen).mockClear();

    act(() => {
      screen.getByTestId('whats-new-backdrop').click();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(markReleaseSeen).toHaveBeenCalledTimes(1);
  });

  it('gives the keyboard back to the page once closed, when the sheet opened before anything had it', async () => {
    const sheet = await openWithWhatsNew();

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    await waitForElementToBeRemoved(sheet);

    expect(document.activeElement).toBe(document.body);
  });

  describe('opens the destination of each Feature tile', () => {
    const openTile = async (title: RegExp): Promise<void> => {
      const sheet = await openWithWhatsNew();
      vi.mocked(markReleaseSeen).mockClear();
      fireEvent.click(screen.getByRole('button', { name: title }));
      expect(markReleaseSeen).toHaveBeenCalledTimes(1);
      await waitForElementToBeRemoved(sheet);
    };

    it('library: the Library', async () => {
      await openTile(/^Pinned prompts/);

      expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('heading', { name: /my prompt manager/i })).toBeInTheDocument();
      expect(screen.queryByTestId('editor-sheet')).not.toBeInTheDocument();
    });

    it('library-search: the Library with the keyboard in its search field, as Cmd/Ctrl+K', async () => {
      await openTile(/^Search with ⌘K/);

      expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => { expect(screen.getByRole('searchbox', { name: 'Search prompts' })).toHaveFocus(); });
    });

    it('prompt-editor-new: the editor on a new Prompt', async () => {
      await openTile(/^Fill-in variables/);

      expect(screen.getByTestId('editor-sheet')).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toHaveValue('');
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it.each([
      [/^Undo a Category deletion/, 'Categories'],
      [/^Tidy up/, 'Analytics'],
      [/^Fix the icon yourself/, 'Settings']
    ])('%s: the %s Section', async (title, section) => {
      await openTile(title);

      expect(await screen.findByRole('heading', { name: section, level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: section })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('keyboard, focus and screen readers, end to end (My-Prompt-Manager-d1g.8)', () => {
    /** Where each number key leads with the 2.0.0 Release notes: "Type // on a Platform" has no destination, so no number */
    it.each([
      ['1', 'the editor on a new Prompt, the keyboard in its title field', async () => {
        expect(await screen.findByTestId('editor-sheet')).toBeInTheDocument();
        await waitFor(() => { expect(screen.getByLabelText(/title/i)).toHaveFocus(); });
        expect(screen.getByLabelText(/title/i)).toHaveValue('');
      }],
      ['2', 'the Library, the keyboard in its search field', async () => {
        expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
        await waitFor(() => { expect(screen.getByRole('searchbox', { name: 'Search prompts' })).toHaveFocus(); });
      }],
      ['3', 'the Library (Pinned prompts)', () => {
        expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.queryByTestId('editor-sheet')).not.toBeInTheDocument();
      }],
      ['5', 'the Analytics Section (Tidy up)', async () => {
        expect(await screen.findByRole('heading', { name: 'Analytics', level: 1 })).toBeInTheDocument();
      }],
      ['7', 'the Categories Section (Undo a Category deletion)', async () => {
        expect(await screen.findByRole('heading', { name: 'Categories', level: 1 })).toBeInTheDocument();
      }],
      ['8', 'the Settings Section (Fix the icon yourself)', async () => {
        expect(await screen.findByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
      }]
    ])('number keys open the Feature tiles in display order: %s opens %s', async (key, _destination, expectDestination) => {
      const user = userEvent.setup();
      const sheet = await openWithWhatsNew();
      vi.mocked(markReleaseSeen).mockClear();

      await user.keyboard(key);

      expect(markReleaseSeen).toHaveBeenCalledTimes(1);
      expect(vi.mocked(markReleaseSeen).mock.calls[0]?.[0]).toBe('2.0.0');
      await waitForElementToBeRemoved(sheet);
      await expectDestination();
    });

    it('number keys open the Feature tiles in display order: a number beyond the count (9) does nothing', async () => {
      const user = userEvent.setup();
      const sheet = await openWithWhatsNew();
      vi.mocked(markReleaseSeen).mockClear();

      await user.keyboard('9');

      expect(sheet).toBeInTheDocument();
      expect(sheet).toHaveClass('animate-whats-new-sheet-in');
      expect(markReleaseSeen).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();
    });

    it('Enter on a focused Feature tile opens it, once, with the keyboard in the editor title field', async () => {
      const user = userEvent.setup();
      const sheet = await openWithWhatsNew();
      vi.mocked(markReleaseSeen).mockClear();
      // From Got it, Tab wraps to the first tile: the hero
      await user.tab();
      expect(screen.getByRole('button', { name: /^Fill-in variables/ })).toHaveFocus();

      await user.keyboard('{Enter}');

      expect(markReleaseSeen).toHaveBeenCalledTimes(1);
      await waitForElementToBeRemoved(sheet);
      expect(screen.getByTestId('editor-sheet')).toBeInTheDocument();
      await waitFor(() => { expect(screen.getByLabelText(/title/i)).toHaveFocus(); });
    });

    it('Enter on Got it closes, opens nothing, and gives the keyboard back to the page', async () => {
      const user = userEvent.setup();
      const sheet = await openWithWhatsNew();
      vi.mocked(markReleaseSeen).mockClear();
      const gotIt = screen.getByRole('button', { name: 'Got it' });
      const targets: EventTarget[] = [];
      document.addEventListener('keydown', (event) => { targets.push(event.target as EventTarget); }, { once: true });

      await user.keyboard('{Enter}');

      // The Enter landed on Got it itself
      expect(targets).toEqual([gotIt]);
      expect(markReleaseSeen).toHaveBeenCalledTimes(1);
      expect(vi.mocked(markReleaseSeen).mock.calls[0]?.[0]).toBe('2.0.0');
      await waitForElementToBeRemoved(sheet);
      expect(screen.queryByTestId('editor-sheet')).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
      expect(document.activeElement).toBe(document.body);
    });

    it('keeps the keyboard inside while open: Tab and Shift+Tab cycle through the 8 Feature tiles and Got it only', async () => {
      const user = userEvent.setup();
      const sheet = await openWithWhatsNew();
      const gotIt = screen.getByRole('button', { name: 'Got it' });
      const visited: (string | null)[] = [];

      for (let step = 0; step < 9; step++) {
        await user.tab();
        expect(sheet).toContainElement(document.activeElement as HTMLElement);
        visited.push(document.activeElement?.getAttribute('data-whats-new-tile-index') ?? null);
      }
      expect(visited).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', null]);
      expect(gotIt).toHaveFocus();

      await user.tab({ shift: true });
      expect(document.activeElement).toHaveAttribute('data-whats-new-tile-index', '8');
      await user.tab();
      expect(gotIt).toHaveFocus();
    });

    it('is heard as a modal dialog named "What\u2019s new", its tiles a list, each Feature tile named by its title and description', async () => {
      const sheet = await openWithWhatsNew();

      expect(sheet).toHaveAttribute('aria-modal', 'true');
      const list = within(sheet).getByRole('list');
      expect(within(list).getAllByRole('listitem')).toHaveLength(15);
      expect(within(sheet).getByRole('button', { name: /^Search with ⌘K / })).toHaveAttribute('aria-keyshortcuts', '2');
      const hero = within(sheet).getByRole('button', { name: /^Fill-in variables / });
      expect(hero).toHaveAccessibleDescription('Write a launch email for audience in a tone voice.');
      // Critical fixes: no button, no tab stop, read "Fixed: {title}"
      const fixes = sheet.querySelectorAll<HTMLElement>('[data-whats-new-tile="critical-fix"]');
      expect(fixes).toHaveLength(6);
      for (const tile of fixes) {
        expect(tile.tagName).toBe('DIV');
        expect(tile).not.toHaveAttribute('tabindex');
        expect(tile.textContent).toMatch(/^Fixed: /);
      }
    });
  });

  it('is not shown in picker mode, where the record is not even read', async () => {
    window.location.search = '?picker=true';
    render(<App />);

    await screen.findByRole('heading', { name: 'Settings', level: 1 });
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });

    expect(readWhatsNewRecord).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: WHATS_NEW })).not.toBeInTheDocument();
  });

  it('is not shown when there are no Release notes to show (the Release already seen)', async () => {
    await chrome.storage.local.set({ [WHATS_NEW_KEY]: { lastSeenVersion: '2.0.0' } });
    render(<App />);

    await screen.findByRole('heading', { name: /my prompt manager/i });
    await waitFor(() => { expect(readWhatsNewRecord).toHaveBeenCalled(); });
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });

    expect(screen.queryByRole('dialog', { name: WHATS_NEW })).not.toBeInTheDocument();
    expect(markReleaseSeen).not.toHaveBeenCalled();
  });
});

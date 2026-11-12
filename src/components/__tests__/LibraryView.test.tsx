import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_PROMPTS } from '../../services/libraryFilter';
import { triggerChromeStorageChange } from '../../test/mocks';
import type { Category, LibraryFilter, Prompt } from '../../types';
import type { UseSearchWithDebounceReturn } from '../../types/hooks';
import LibraryView from '../LibraryView';

const { getSettings, sortPrompts } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  sortPrompts: vi.fn((prompts: unknown[]) => prompts)
}));

// Mock the storage and prompt manager singletons
vi.mock('../../services/storage', () => ({
  StorageManager: {
    getInstance: vi.fn(() => ({
      getSettings,
      updateSettings: vi.fn().mockResolvedValue(undefined)
    }))
  }
}));

vi.mock('../../services/promptManager', () => ({
  PromptManager: {
    getInstance: vi.fn(() => ({ sortPrompts }))
  }
}));

const defaultCategories: Category[] = [
  { id: 'default', name: 'Uncategorized', color: '#888888' },
  { id: 'work', name: 'Work', color: '#ff00ff' }
];

const defaultPrompts: Prompt[] = [
  {
    id: 'prompt-1',
    title: 'Test Prompt',
    content: 'Hello world',
    category: 'Work',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

const createMockSearchWithDebounce = (prompts: Prompt[] = defaultPrompts, query = ''): UseSearchWithDebounceReturn => ({
  query,
  debouncedQuery: query,
  filteredPrompts: prompts,
  highlightedResults: [],
  isSearching: false,
  setQuery: vi.fn(),
  clearSearch: vi.fn()
});

const defaultProps = {
  prompts: defaultPrompts,
  categories: defaultCategories,
  searchWithDebounce: createMockSearchWithDebounce(),
  libraryFilter: ALL_PROMPTS,
  onAddNew: vi.fn(),
  onCreateFromSearch: vi.fn(),
  onEditPrompt: vi.fn(),
  onTogglePin: vi.fn(),
  onCopyPrompt: vi.fn(),
  showToast: vi.fn(),
  onLibraryFilterChange: vi.fn(),
  loading: false,
  context: 'popup' as const
};

/** A Library whose filter is held in state, starting on the Never used review */
const ReviewHarness = ({ prompts }: { prompts: Prompt[] }) => {
  const [filter, setFilter] = useState<LibraryFilter>({ kind: 'neverUsed' });
  return (
    <LibraryView
      {...defaultProps}
      prompts={prompts}
      searchWithDebounce={createMockSearchWithDebounce(prompts)}
      libraryFilter={filter}
      onLibraryFilterChange={setFilter}
    />
  );
};

/** A Library on the Work Category whose search finds nothing there, and `foundUnderAll` under All */
const SearchAllHarness = ({ library, foundUnderAll }: { library: Prompt[]; foundUnderAll: Prompt[] }) => {
  const [filter, setFilter] = useState<LibraryFilter>({ kind: 'category', categoryId: 'work' });
  return (
    <LibraryView
      {...defaultProps}
      prompts={library}
      searchWithDebounce={createMockSearchWithDebounce(filter.kind === 'all' ? foundUnderAll : [], 'pinned')}
      libraryFilter={filter}
      onLibraryFilterChange={setFilter}
    />
  );
};

describe('LibraryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue({ sortOrder: 'updatedAt', sortDirection: 'desc' });
  });

  describe('Header rendering', () => {
    it('renders the main header with title', () => {
      render(<LibraryView {...defaultProps} />);
      expect(screen.getByRole('heading', { name: /my prompt manager/i })).toBeInTheDocument();
    });

    it('shows the prompt count as subtitle', () => {
      render(<LibraryView {...defaultProps} />);
      const subtitle = screen.getByText('1 prompt');
      expect(subtitle).toHaveAttribute('aria-live', 'polite');
    });

    it('shows "X of N prompts" when search or filter narrows the list', () => {
      const prompts: Prompt[] = [
        ...defaultPrompts,
        { ...defaultPrompts[0], id: 'prompt-2', title: 'Other', category: 'Uncategorized' }
      ];
      render(
        <LibraryView
          {...defaultProps}
          prompts={prompts}
          searchWithDebounce={createMockSearchWithDebounce(prompts)}
          libraryFilter={{ kind: 'category', categoryId: 'work' }}
        />
      );
      expect(screen.getByText('1 of 2 prompts')).toBeInTheDocument();
    });

    it('no longer renders the Analytics and Settings header buttons or the footer', () => {
      render(<LibraryView {...defaultProps} />);
      expect(screen.queryByRole('button', { name: /view analytics/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /open settings/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    });
  });

  describe('Close button in sidepanel context', () => {
    it('renders close button in sidepanel context', () => {
      render(<LibraryView {...defaultProps} context="sidepanel" />);
      expect(screen.getByRole('button', { name: /close side panel/i })).toBeInTheDocument();
    });

    it('does not render close button in popup context', () => {
      render(<LibraryView {...defaultProps} context="popup" />);
      expect(screen.queryByRole('button', { name: /close side panel/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^close$/i })).not.toBeInTheDocument();
    });
  });

  describe('Empty Library', () => {
    const emptyProps = { ...defaultProps, prompts: [], searchWithDebounce: createMockSearchWithDebounce([]) };

    it('shows its empty state under the header, with a title of its own', () => {
      render(<LibraryView {...emptyProps} />);

      const empty = screen.getByTestId('library-empty');
      expect(within(empty).getByRole('heading', { level: 2, name: 'Your library is empty' })).toBeInTheDocument();
      expect(empty).toHaveTextContent('Add variables for the parts that change');
      // The header stays: its title, the count and New
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByText('0 prompts')).toBeInTheDocument();
      expect(screen.getByTestId('new-prompt-button')).toBeInTheDocument();
    });

    it('hides the search and the Library filters: there is nothing to search', () => {
      render(<LibraryView {...emptyProps} />);

      expect(screen.queryByRole('search')).not.toBeInTheDocument();
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });

    it('opens the editor from "Write your first prompt"', async () => {
      const onAddNew = vi.fn();
      render(<LibraryView {...emptyProps} onAddNew={onAddNew} />);

      await userEvent.click(screen.getByRole('button', { name: 'Write your first prompt' }));

      expect(onAddNew).toHaveBeenCalledTimes(1);
    });

    it('offers "Import a backup" only when the app can open the import', async () => {
      const onImportBackup = vi.fn();
      const { rerender } = render(<LibraryView {...emptyProps} />);
      expect(screen.queryByRole('button', { name: 'Import a backup' })).not.toBeInTheDocument();

      rerender(<LibraryView {...emptyProps} onImportBackup={onImportBackup} />);
      await userEvent.click(screen.getByRole('button', { name: 'Import a backup' }));

      expect(onImportBackup).toHaveBeenCalledTimes(1);
    });

    it('offers neither a pack nor a shortcut, which the app does not have', () => {
      render(<LibraryView {...emptyProps} onImportBackup={vi.fn()} />);

      expect(screen.queryByRole('button', { name: /pack/i })).not.toBeInTheDocument();
      expect(within(screen.getByTestId('library-empty')).getAllByRole('button')).toHaveLength(2);
    });

    it('keeps its illustration away from assistive technology', () => {
      render(<LibraryView {...emptyProps} />);

      expect(screen.getByText('{{name}}').closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('gives way to the list as soon as a Prompt exists, and comes back when the last one goes', () => {
      const { rerender } = render(<LibraryView {...emptyProps} />);
      expect(screen.getByTestId('library-empty')).toBeInTheDocument();

      rerender(<LibraryView {...defaultProps} />);
      expect(screen.queryByTestId('library-empty')).not.toBeInTheDocument();
      expect(screen.getByText('Test Prompt')).toBeInTheDocument();
      expect(screen.getByRole('search')).toBeInTheDocument();

      rerender(<LibraryView {...emptyProps} />);
      expect(screen.getByTestId('library-empty')).toBeInTheDocument();
    });

    it('does not show while the Library loads', () => {
      render(<LibraryView {...emptyProps} loading={true} />);

      expect(screen.queryByTestId('library-empty')).not.toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading spinner when loading', () => {
      render(<LibraryView {...defaultProps} loading={true} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/loading your prompts/i)).toBeInTheDocument();
    });
  });

  describe('Prompt list', () => {
    it('renders prompts when they exist', () => {
      render(<LibraryView {...defaultProps} />);
      expect(screen.getByText('Test Prompt')).toBeInTheDocument();
    });
  });

  describe('New button', () => {
    it('renders exactly one "New" button in the header', () => {
      render(<LibraryView {...defaultProps} />);
      const buttons = screen.getAllByRole('button', { name: /add new prompt/i });
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveTextContent('New');
      expect(screen.getByRole('banner')).toContainElement(buttons[0]);
    });

    it('calls onAddNew when clicked', async () => {
      const user = userEvent.setup();
      const onAddNew = vi.fn();

      render(<LibraryView {...defaultProps} onAddNew={onAddNew} />);

      await user.click(screen.getByRole('button', { name: /add new prompt/i }));

      expect(onAddNew).toHaveBeenCalledTimes(1);
    });

    it('is disabled when loading', () => {
      render(<LibraryView {...defaultProps} loading={true} />);
      expect(screen.getByRole('button', { name: /add new prompt/i })).toBeDisabled();
    });
  });

  describe('Library filter', () => {
    const pinned: Prompt = { ...defaultPrompts[0], id: 'prompt-pinned', title: 'Pinned One', category: 'Uncategorized', pinned: true };
    const used: Prompt = { ...defaultPrompts[0], id: 'prompt-used', title: 'Used One', usageCount: 3 };
    const library = [...defaultPrompts, pinned, used];

    const renderWith = (libraryFilter: LibraryFilter, overrides: Partial<typeof defaultProps> = {}) =>
      render(
        <LibraryView
          {...defaultProps}
          prompts={library}
          searchWithDebounce={createMockSearchWithDebounce(library)}
          libraryFilter={libraryFilter}
          {...overrides}
        />
      );

    const cardTitles = () => screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);

    it('shows the Library filter pills instead of the category and sort menus', () => {
      renderWith(ALL_PROMPTS);

      expect(screen.getByRole('radiogroup', { name: 'Library filter' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /filter by category/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sort order/i })).not.toBeInTheDocument();
    });

    it('offers a pill only for Categories that hold a Prompt', () => {
      render(<LibraryView {...defaultProps} />);

      expect(screen.getByRole('radio', { name: 'Work' })).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'Uncategorized' })).not.toBeInTheDocument();
    });

    it('moves focus to All when Show all prompts leaves an emptied review', async () => {
      const user = userEvent.setup();
      render(<ReviewHarness prompts={[used]} />);

      await user.click(screen.getByRole('button', { name: 'Show all prompts' }));

      expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();
    });

    it('reports the pill pressed', async () => {
      const user = userEvent.setup();
      const onLibraryFilterChange = vi.fn();
      renderWith(ALL_PROMPTS, { onLibraryFilterChange });

      await user.click(screen.getByRole('radio', { name: 'Pinned' }));

      expect(onLibraryFilterChange).toHaveBeenCalledWith({ kind: 'pinned' });
    });

    it('lists only Pinned Prompts under Pinned', () => {
      renderWith({ kind: 'pinned' });

      expect(screen.getByRole('radio', { name: 'Pinned' })).toHaveAttribute('aria-checked', 'true');
      expect(cardTitles()).toEqual(['Pinned One']);
    });

    it('lists only Prompts inserted at least once under Most Used', () => {
      renderWith({ kind: 'mostUsed' });

      expect(cardTitles()).toEqual(['Used One']);
    });

    it('lists only the Prompts of the chosen Category', () => {
      renderWith({ kind: 'category', categoryId: 'default' });

      expect(cardTitles()).toEqual(['Pinned One']);
    });

    it('returns to All once the active Category holds no Prompt', async () => {
      const onLibraryFilterChange = vi.fn();
      render(<LibraryView {...defaultProps} libraryFilter={{ kind: 'category', categoryId: 'default' }} onLibraryFilterChange={onLibraryFilterChange} />);

      expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
      await waitFor(() => { expect(onLibraryFilterChange).toHaveBeenCalledWith(ALL_PROMPTS); });
    });

    it('keeps the chosen filter while the Library is loading', () => {
      const onLibraryFilterChange = vi.fn();
      render(
        <LibraryView
          {...defaultProps}
          prompts={[]}
          categories={[]}
          libraryFilter={{ kind: 'category', categoryId: 'work' }}
          onLibraryFilterChange={onLibraryFilterChange}
          loading
        />
      );

      expect(onLibraryFilterChange).not.toHaveBeenCalled();
    });

    it('searches inside the active filter and offers to search all prompts when nothing matches', async () => {
      const user = userEvent.setup();
      const onLibraryFilterChange = vi.fn();
      const clearSearch = vi.fn();
      const search = { ...createMockSearchWithDebounce([pinned], 'pinned'), clearSearch };
      renderWith({ kind: 'category', categoryId: 'work' }, { searchWithDebounce: search, onLibraryFilterChange });

      expect(screen.getByRole('region', { name: /no search results/i })).toHaveTextContent('Nothing in Work matches your search');
      await user.click(screen.getByRole('button', { name: 'Search all prompts' }));

      expect(onLibraryFilterChange).toHaveBeenCalledWith(ALL_PROMPTS);
      expect(clearSearch).not.toHaveBeenCalled();
    });

    it('moves the keyboard to All when Search all prompts leaves with its filter', async () => {
      const user = userEvent.setup();
      render(<SearchAllHarness library={library} foundUnderAll={[pinned]} />);

      await user.click(screen.getByRole('button', { name: 'Search all prompts' }));

      expect(screen.queryByRole('button', { name: 'Search all prompts' })).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'All' })).toHaveFocus();
    });

    it('does not offer to search all prompts when All finds nothing', () => {
      renderWith(ALL_PROMPTS, { searchWithDebounce: createMockSearchWithDebounce([], 'zzz') });

      expect(screen.getByRole('region', { name: /no search results/i })).toHaveTextContent('Nothing called “zzz” yet');
      expect(screen.queryByRole('button', { name: 'Search all prompts' })).not.toBeInTheDocument();
    });

    it('offers to create the Prompt a search did not find, titled with the search', async () => {
      const user = userEvent.setup();
      const onCreateFromSearch = vi.fn();
      renderWith(ALL_PROMPTS, { searchWithDebounce: createMockSearchWithDebounce([], '  Weekly report '), onCreateFromSearch });

      const empty = screen.getByRole('region', { name: /no search results/i });
      expect(empty).toHaveTextContent('Nothing called “Weekly report” yet');
      expect(empty).toHaveClass('animate-empty-rise', 'border-dashed');
      await user.click(screen.getByRole('button', { name: 'Create it' }));

      expect(onCreateFromSearch).toHaveBeenCalledWith('Weekly report', undefined);
    });

    it('shows the empty Library, not a search with no result, when a search outlives the last Prompt', () => {
      render(<LibraryView {...defaultProps} prompts={[]} searchWithDebounce={createMockSearchWithDebounce([], 'First idea')} />);

      expect(screen.getByTestId('library-empty')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: /no search results/i })).not.toBeInTheDocument();
    });

    it('holds Create it back while the field shows a search not looked up yet', async () => {
      const user = userEvent.setup();
      const onCreateFromSearch = vi.fn();
      // The field already reads "zzz report"; the search that found nothing is still "zzz"
      const search = { ...createMockSearchWithDebounce([], 'zzz'), query: 'zzz report', isSearching: true };
      renderWith(ALL_PROMPTS, { searchWithDebounce: search, onCreateFromSearch });

      const create = screen.getByRole('button', { name: 'Create it' });
      expect(create).toBeDisabled();
      await user.click(create);

      expect(onCreateFromSearch).not.toHaveBeenCalled();
    });

    it('creates it in the Category of the active Library filter', async () => {
      const user = userEvent.setup();
      const onCreateFromSearch = vi.fn();
      renderWith({ kind: 'category', categoryId: 'work' }, { searchWithDebounce: createMockSearchWithDebounce([pinned], 'zzz'), onCreateFromSearch });

      await user.click(screen.getByRole('button', { name: 'Create it' }));

      expect(onCreateFromSearch).toHaveBeenCalledWith('zzz', 'Work');
    });

    it('heads the list of a search with Results and announces the number found', () => {
      renderWith(ALL_PROMPTS, { searchWithDebounce: createMockSearchWithDebounce([pinned, used], 'e') });

      const header = screen.getByTestId('list-header');
      expect(header).toHaveTextContent('Results');
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveTextContent('2 results');
      // The number shown is the same one, not said twice
      expect(within(header).getByText('2')).toHaveAttribute('aria-hidden', 'true');
      // The count of the header is no longer announced as well
      expect(screen.getByText(/^2 of \d+ prompts$/)).not.toHaveAttribute('aria-live');
    });

    it('keeps the name of the active Library filter as the heading of a search', () => {
      renderWith({ kind: 'category', categoryId: 'work' }, { searchWithDebounce: createMockSearchWithDebounce([pinned], 'pinned') });

      expect(screen.getByTestId('list-header')).toHaveTextContent('Work');
      expect(screen.getByTestId('list-header')).not.toHaveTextContent('Results');
    });

    it('announces a search that found nothing', () => {
      renderWith(ALL_PROMPTS, { searchWithDebounce: createMockSearchWithDebounce([], 'zzz') });

      expect(screen.getByRole('status')).toHaveTextContent('No results');
    });

    it('shows no list heading without a search', () => {
      renderWith(ALL_PROMPTS);

      expect(screen.queryByTestId('list-header')).not.toBeInTheDocument();
      // The status is already there, saying nothing: its first number is then a change, which is announced
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    describe('cards rising', () => {
      const riseOf = () => screen.getAllByTestId('prompt-card').map(card => card.parentElement?.className ?? '');
      const withSearch = (found: Prompt[], query: string) => (
        <LibraryView {...defaultProps} prompts={library} searchWithDebounce={createMockSearchWithDebounce(found, query)} />
      );

      it('rise one after the other, each a step later, up to a last step', () => {
        const many = Array.from({ length: 11 }, (_, index) => ({ ...defaultPrompts[0], id: `p-${String(index)}`, title: `Prompt ${String(index)}` }));
        render(<LibraryView {...defaultProps} prompts={many} searchWithDebounce={createMockSearchWithDebounce(many)} />);

        const delays = screen.getAllByTestId('prompt-card').map(card => card.parentElement?.style.animationDelay);
        expect(delays.slice(0, 3)).toEqual(['0ms', '50ms', '100ms']);
        expect(delays.slice(8)).toEqual(['400ms', '400ms', '400ms']);
        expect(riseOf().every(className => className.includes('animate-list-rise'))).toBe(true);
      });

      it('do not rise again at a keystroke that lists the same Prompts', () => {
        const { rerender } = render(withSearch([pinned, used], 'on'));
        const before = riseOf();

        rerender(withSearch([pinned, used], 'one'));

        expect(riseOf()).toEqual(before);
      });

      it('rise again when the Prompts listed change, without being mounted anew', () => {
        const { rerender } = render(withSearch([pinned, used], 'one'));
        const before = riseOf();
        const card = screen.getAllByTestId('prompt-card')[0];

        rerender(withSearch([pinned], 'pinned'));

        expect(riseOf()[0]).not.toBe(before[0]);
        expect(riseOf()[0]).toMatch(/animate-list-rise(-again)?/);
        expect(screen.getAllByTestId('prompt-card')[0]).toBe(card);
      });

      it('do not rise again when a pin only reorders them', () => {
        const { rerender } = render(<LibraryView {...defaultProps} prompts={library} searchWithDebounce={createMockSearchWithDebounce(library)} />);
        const before = riseOf();

        const reordered = [used, pinned, ...defaultPrompts];
        rerender(<LibraryView {...defaultProps} prompts={reordered} searchWithDebounce={createMockSearchWithDebounce(reordered)} />);

        expect(riseOf()).toEqual(before);
      });
    });

    it('explains an empty Pinned filter', () => {
      render(<LibraryView {...defaultProps} libraryFilter={{ kind: 'pinned' }} />);

      expect(screen.getByRole('region', { name: /no pinned prompts/i })).toBeInTheDocument();
      expect(screen.getByText('No pinned prompts yet')).toBeInTheDocument();
    });

    it('explains an empty Most Used filter', () => {
      render(<LibraryView {...defaultProps} libraryFilter={{ kind: 'mostUsed' }} />);

      expect(screen.getByRole('region', { name: /no used prompts/i })).toBeInTheDocument();
      expect(screen.getByText('No prompts used yet')).toBeInTheDocument();
    });
  });

  describe('Sort', () => {
    it('sorts with the order saved in Settings, in its natural direction', async () => {
      getSettings.mockResolvedValue({ sortOrder: 'title', sortDirection: 'desc' });

      render(<LibraryView {...defaultProps} />);

      await waitFor(() => {
        expect(sortPrompts).toHaveBeenLastCalledWith(expect.any(Array), 'title', 'asc');
      });
    });

    it('follows a sort saved after it opened', async () => {
      render(<LibraryView {...defaultProps} />);
      await waitFor(() => { expect(getSettings).toHaveBeenCalled(); });

      act(() => {
        triggerChromeStorageChange({ settings: { newValue: { sortOrder: 'title', sortDirection: 'asc' } } });
      });

      await waitFor(() => {
        expect(sortPrompts).toHaveBeenLastCalledWith(expect.any(Array), 'title', 'asc');
      });
    });

    it('keeps a newer save when its first read of the settings answers late', async () => {
      let answerFirstRead: (settings: unknown) => void = () => undefined;
      getSettings.mockReturnValue(new Promise(resolve => { answerFirstRead = resolve; }));
      render(<LibraryView {...defaultProps} />);

      act(() => {
        triggerChromeStorageChange({ settings: { newValue: { sortOrder: 'title', sortDirection: 'asc' } } });
      });
      await act(async () => {
        answerFirstRead({ sortOrder: 'updatedAt', sortDirection: 'desc' });
        await Promise.resolve();
      });

      expect(sortPrompts).toHaveBeenLastCalledWith(expect.any(Array), 'title', 'asc');
    });
  });
});

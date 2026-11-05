import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  onEditPrompt: vi.fn(),
  onTogglePin: vi.fn(),
  onCopyPrompt: vi.fn(),
  showToast: vi.fn(),
  onLibraryFilterChange: vi.fn(),
  loading: false,
  context: 'popup' as const
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

  describe('Empty state', () => {
    it('shows empty state when no prompts exist', () => {
      const props = {
        ...defaultProps,
        prompts: [],
        searchWithDebounce: createMockSearchWithDebounce([])
      };

      render(<LibraryView {...props} />);
      expect(screen.getByRole('region', { name: /empty state/i })).toBeInTheDocument();
      expect(screen.getByText(/you're ready to go/i)).toBeInTheDocument();
    });

    it('shows create first prompt button in empty state', () => {
      const props = {
        ...defaultProps,
        prompts: [],
        searchWithDebounce: createMockSearchWithDebounce([])
      };

      render(<LibraryView {...props} />);
      // The aria-label is "Create your first prompt" but button text is "Create First Prompt"
      expect(screen.getByRole('button', { name: /create.*first prompt/i })).toBeInTheDocument();
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

    it('does not offer to search all prompts when All finds nothing', () => {
      renderWith(ALL_PROMPTS, { searchWithDebounce: createMockSearchWithDebounce([], 'zzz') });

      expect(screen.getByText('No matches found')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Search all prompts' })).not.toBeInTheDocument();
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

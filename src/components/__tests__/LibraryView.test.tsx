import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Prompt, Category } from '../../types';
import type { UseSearchWithDebounceReturn } from '../../types/hooks';
import LibraryView from '../LibraryView';

// Mock the storage and prompt manager singletons
vi.mock('../../services/storage', () => ({
  StorageManager: {
    getInstance: vi.fn(() => ({
      getSettings: vi.fn().mockResolvedValue({
        sortOrder: 'date',
        sortDirection: 'desc'
      }),
      updateSettings: vi.fn().mockResolvedValue(undefined)
    }))
  }
}));

vi.mock('../../services/promptManager', () => ({
  PromptManager: {
    getInstance: vi.fn(() => ({
      sortPrompts: vi.fn((prompts: Prompt[]) => prompts)
    }))
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

const createMockSearchWithDebounce = (prompts: Prompt[] = defaultPrompts): UseSearchWithDebounceReturn => ({
  query: '',
  debouncedQuery: '',
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
  selectedCategory: null,
  onAddNew: vi.fn(),
  onEditPrompt: vi.fn(),
  onTogglePin: vi.fn(),
  onCopyPrompt: vi.fn(),
  showToast: vi.fn(),
  onCategoryChange: vi.fn(),
  loading: false,
  context: 'popup' as const
};

describe('LibraryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          selectedCategory="Work"
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
});

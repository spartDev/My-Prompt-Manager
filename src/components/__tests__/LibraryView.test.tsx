import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Prompt, Category } from '../../types';
import { UseSearchWithDebounceReturn } from '../../types/hooks';
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
  onDeletePrompt: vi.fn(),
  onCopyPrompt: vi.fn(),
  showToast: vi.fn(),
  onCategoryChange: vi.fn(),
  onManageCategories: vi.fn(),
  onSettings: vi.fn(),
  onAnalytics: vi.fn(),
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

    it('renders subtitle', () => {
      render(<LibraryView {...defaultProps} />);
      expect(screen.getByText(/organize your creative prompts/i)).toBeInTheDocument();
    });
  });

  describe('Analytics button', () => {
    it('renders analytics button in header', () => {
      render(<LibraryView {...defaultProps} />);
      expect(screen.getByRole('button', { name: /view analytics/i })).toBeInTheDocument();
    });

    it('calls onAnalytics when analytics button is clicked', async () => {
      const user = userEvent.setup();
      const onAnalytics = vi.fn();

      render(<LibraryView {...defaultProps} onAnalytics={onAnalytics} />);

      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      await user.click(analyticsButton);

      expect(onAnalytics).toHaveBeenCalledTimes(1);
    });

    it('analytics button has correct aria-label', () => {
      render(<LibraryView {...defaultProps} />);
      const analyticsButton = screen.getByRole('button', { name: /view analytics/i });
      expect(analyticsButton).toHaveAttribute('aria-label', 'View analytics');
    });

    it('analytics button is positioned before settings button', () => {
      const { container } = render(<LibraryView {...defaultProps} />);

      const analyticsButton = container.querySelector('[aria-label="View analytics"]');
      const settingsButton = container.querySelector('[aria-label="Open settings"]');

      expect(analyticsButton).toBeInTheDocument();
      expect(settingsButton).toBeInTheDocument();

      // Check order by DOM position
      const allButtons = container.querySelectorAll('button[aria-label]');
      const buttonLabels = Array.from(allButtons).map(b => b.getAttribute('aria-label'));

      const analyticsIndex = buttonLabels.indexOf('View analytics');
      const settingsIndex = buttonLabels.indexOf('Open settings');

      expect(analyticsIndex).toBeLessThan(settingsIndex);
    });
  });

  describe('Settings button', () => {
    it('renders settings button in header', () => {
      render(<LibraryView {...defaultProps} />);
      expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument();
    });

    it('calls onSettings when settings button is clicked', async () => {
      const user = userEvent.setup();
      const onSettings = vi.fn();

      render(<LibraryView {...defaultProps} onSettings={onSettings} />);

      const settingsButton = screen.getByRole('button', { name: /open settings/i });
      await user.click(settingsButton);

      expect(onSettings).toHaveBeenCalledTimes(1);
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

    it('shows prompt count in footer', () => {
      render(<LibraryView {...defaultProps} />);
      expect(screen.getByText(/1 prompt/i)).toBeInTheDocument();
    });
  });

  describe('Floating add button', () => {
    it('renders floating add button', () => {
      render(<LibraryView {...defaultProps} />);
      expect(screen.getByRole('button', { name: /add new prompt/i })).toBeInTheDocument();
    });

    it('calls onAddNew when floating add button is clicked', async () => {
      const user = userEvent.setup();
      const onAddNew = vi.fn();

      render(<LibraryView {...defaultProps} onAddNew={onAddNew} />);

      const addButton = screen.getByRole('button', { name: /add new prompt/i });
      await user.click(addButton);

      expect(onAddNew).toHaveBeenCalledTimes(1);
    });

    it('floating add button is disabled when loading', () => {
      render(<LibraryView {...defaultProps} loading={true} />);
      const addButton = screen.getByRole('button', { name: /add new prompt/i });
      expect(addButton).toBeDisabled();
    });
  });
});

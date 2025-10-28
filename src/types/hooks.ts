import { Prompt, Category, AppError } from './index';

// Hook return types
export interface UsePromptsReturn {
  prompts: Prompt[];
  loading: boolean;
  error: AppError | null;
  createPrompt: (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'>) => Promise<void>;
  updatePrompt: (id: string, updates: Partial<Prompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  searchPrompts: (query: string) => Prompt[];
  filterByCategory: (category: string | null) => Prompt[];
  refreshPrompts: () => Promise<void>;
}

export interface UseCategoriesReturn {
  categories: Category[];
  loading: boolean;
  error: AppError | null;
  createCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  refreshCategories: () => Promise<void>;
}

export interface UseClipboardReturn {
  copyToClipboard: (text: string) => Promise<boolean>;
  lastCopied: string | null;
  copyStatus: 'idle' | 'copying' | 'success' | 'error';
}

export interface UseSearchReturn {
  query: string;
  filteredPrompts: Prompt[];
  highlightedResults: HighlightedPrompt[];
  clearSearch: () => void;
}

export interface UseSearchWithDebounceReturn {
  query: string;
  debouncedQuery: string;
  filteredPrompts: Prompt[];
  highlightedResults: HighlightedPrompt[];
  isSearching: boolean;
  setQuery: (query: string) => void;
  clearSearch: () => void;
}

export interface UseStorageReturn {
  saveData: (key: string, data: unknown) => Promise<void>;
  loadData: <T>(key: string) => Promise<T | null>;
  removeData: (key: string) => Promise<void>;
  clearAll: () => Promise<void>;
  getStorageUsage: () => Promise<{ used: number; total: number }>;
}

// Extended interfaces for search functionality
export interface HighlightedPrompt extends Prompt {
  titleHighlights: TextHighlight[];
  contentHighlights: TextHighlight[];
}

export interface TextHighlight {
  start: number;
  end: number;
  text: string;
}

// Toast hook types
export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  action?: ToastAction;
  groupKey?: string; // For grouping similar toasts
}

export interface ToastSettings {
  position: 'top-right' | 'bottom-right';
  enabledTypes: {
    success: boolean;
    error: boolean;
    info: boolean;
    warning: boolean;
  };
  enableGrouping: boolean;
  groupingWindow: number; // milliseconds
}

export interface UseToastReturn {
  toasts: Toast[];
  queueLength: number;
  settings: ToastSettings;
  showToast: (message: string, type?: Toast['type'], duration?: number, action?: ToastAction) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
  updateSettings: (settings: Partial<ToastSettings>) => void;
}

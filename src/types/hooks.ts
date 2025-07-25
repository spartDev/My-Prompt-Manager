import { Prompt, Category, AppError } from './index';

// Hook return types
export interface UsePromptsReturn {
  prompts: Prompt[];
  loading: boolean;
  error: AppError | null;
  createPrompt: (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
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
  setQuery: (query: string) => void;
  filteredPrompts: Prompt[];
  highlightedResults: HighlightedPrompt[];
  clearSearch: () => void;
}

export interface UseStorageReturn {
  saveData: <T>(key: string, data: T) => Promise<void>;
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
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

export interface UseToastReturn {
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
}
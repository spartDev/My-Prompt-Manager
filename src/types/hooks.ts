import { ToastType } from './components';

import { Prompt, Category, AppError, UsageEvent } from './index';

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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- Generic provides caller type inference and API consistency with loadData
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
export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
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

// Usage Analytics types
export interface DailyUsage {
  date: string;  // YYYY-MM-DD format
  count: number;
}

export interface PlatformBreakdown {
  platform: string;
  count: number;
  percentage: number;
}

export interface DayOfWeekDistribution {
  day: string;  // 'Mon', 'Tue', etc.
  dayIndex: number;  // 0-6 (Sunday = 0)
  count: number;
}

export interface TimeOfDayDistribution {
  bucket: string;  // 'Morning', 'Afternoon', 'Evening', 'Night'
  count: number;
}

export interface CategoryDistribution {
  categoryId: string | null;
  name: string;
  count: number;
}

export interface PromptUsageSummary {
  promptId: string;
  title: string;
  category: string;
  count: number;
  lastUsed: number;
}

export interface UsageStats {
  totalUses: number;
  dailyUsage: DailyUsage[];
  platformBreakdown: PlatformBreakdown[];
  dayOfWeekDistribution: DayOfWeekDistribution[];
  timeOfDayDistribution: TimeOfDayDistribution[];
  categoryDistribution: CategoryDistribution[];
  topPrompts: PromptUsageSummary[];
  recentPrompts: PromptUsageSummary[];
  forgottenPrompts: PromptUsageSummary[];  // Prompts not used in 14+ days
}

export interface UseUsageStatsReturn {
  stats: UsageStats | null;
  history: UsageEvent[];
  loading: boolean;
  error: AppError | null;
  refresh: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

import type { ToastType } from './components';

import type { AppError, Category, DeletedCategory, Prompt, UsageEvent } from './index';

/**
 * Type guard function that validates an unknown value is of type T.
 * Used for runtime type validation in storage operations.
 *
 * @example
 * ```typescript
 * // Simple type guard
 * const isString: TypeGuard<string> = (value): value is string =>
 *   typeof value === 'string';
 *
 * // Object type guard
 * const isPrompt: TypeGuard<Prompt> = (value): value is Prompt =>
 *   value !== null &&
 *   typeof value === 'object' &&
 *   typeof (value as Prompt).id === 'string' &&
 *   typeof (value as Prompt).title === 'string';
 * ```
 */
export type TypeGuard<T> = (value: unknown) => value is T;

// Hook return types
export interface UsePromptsReturn {
  prompts: Prompt[];
  loading: boolean;
  /** A failed load only: a failed save rejects to its caller instead */
  error: AppError | null;
  createPrompt: (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'>) => Promise<void>;
  updatePrompt: (id: string, updates: Partial<Prompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  searchPrompts: (query: string) => Prompt[];
  filterByCategory: (category: string | null) => Prompt[];
  refreshPrompts: () => Promise<void>;
}

export interface UseCategoriesReturn {
  categories: Category[];
  loading: boolean;
  error: AppError | null;
  createCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<DeletedCategory>;
  restoreCategory: (deleted: DeletedCategory) => Promise<Category>;
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
  saveData: <T>(key: string, data: T) => Promise<void>;
  /**
   * Load data from storage with optional runtime type validation.
   *
   * @param key - Storage key to retrieve data from
   * @param validator - Optional type guard function for runtime validation.
   *                    If provided and validation fails, returns null.
   *                    If not provided, returns data cast to T (unsafe, TypeScript-only).
   * @returns Promise resolving to validated data of type T, or null if not found/invalid
   *
   * @example
   * ```typescript
   * // Without validator (TypeScript-only safety)
   * const data = await loadData<Settings>('settings');
   *
   * // With validator (runtime safety)
   * const isSettings: TypeGuard<Settings> = (v): v is Settings =>
   *   v !== null && typeof v === 'object' && 'theme' in v;
   * const data = await loadData<Settings>('settings', isSettings);
   * ```
   */
  loadData: <T>(key: string, validator?: TypeGuard<T>) => Promise<T | null>;
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

// Notification (toast) hook types
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Second, lighter part of the Notification, cut with an ellipsis when it does not fit: the object's name or the reason */
  sub?: string;
  /** Milliseconds on screen; by default 2.7 s for success and info, 6 s for error and warning */
  duration?: number;
  action?: ToastAction;
}

export interface Toast {
  id: string;
  message: string;
  sub?: string;
  type: ToastType;
  duration: number;
  action?: ToastAction;
}

export interface ToastSettings {
  /** Off: no Notification at all, failures included */
  enabled: boolean;
}

export type ShowToast = (message: string, type?: ToastType, options?: ToastOptions) => void;

export interface UseToastReturn {
  /** The one Notification on screen: a new one replaces it */
  toast: Toast | null;
  settings: ToastSettings;
  showToast: ShowToast;
  hideToast: (id: string) => void;
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
  color: string;  // The Category's stored color, else the default Category color
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

export interface Prompt {
  id: string; // uuid-v4-string
  title: string; // max 100 chars
  content: string; // max 10000 chars
  category: string; // default: 'Uncategorized'
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

export interface Category {
  id: string; // uuid-v4-string
  name: string; // max 50 chars
  color?: string; // hex color code (optional)
}

export interface Settings {
  defaultCategory: string;
  sortOrder: 'createdAt' | 'updatedAt' | 'title';
  viewMode: 'grid' | 'list';
}

export interface StorageData {
  prompts: Prompt[];
  categories: Category[];
  settings: Settings;
}

// Form data interfaces for components
export interface PromptFormData {
  title: string;
  content: string;
  category: string;
}

export interface CategoryFormData {
  name: string;
  color?: string;
}

// UI state interfaces
export interface AppState {
  prompts: Prompt[];
  categories: Category[];
  currentView: 'library' | 'add' | 'edit';
  selectedPrompt: Prompt | null;
  searchQuery: string;
  selectedCategory: string | null;
  loading: boolean;
  error: string | null;
}

// Error types
export enum ErrorType {
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  EXTENSION_CONTEXT_LOST = 'EXTENSION_CONTEXT_LOST'
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: any;
}

// Validation constants
export const VALIDATION_LIMITS = {
  PROMPT_TITLE_MAX: 100,
  PROMPT_CONTENT_MAX: 10000,
  CATEGORY_NAME_MAX: 50,
  TITLE_GENERATION_LENGTH: 50
} as const;

// Default values
export const DEFAULT_CATEGORY = 'Uncategorized';
export const DEFAULT_SETTINGS: Settings = {
  defaultCategory: DEFAULT_CATEGORY,
  sortOrder: 'updatedAt',
  viewMode: 'grid'
};
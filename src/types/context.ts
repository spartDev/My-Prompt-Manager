import { Prompt, Category, Settings, AppError, ViewType } from './index';

// App Context types
export interface AppContextType {
  // State
  prompts: Prompt[];
  categories: Category[];
  settings: Settings;
  currentView: ViewType;
  selectedPrompt: Prompt | null;
  searchQuery: string;
  selectedCategory: string | null;
  loading: boolean;
  error: AppError | null;

  // Actions
  setCurrentView: (view: ViewType) => void;
  setSelectedPrompt: (prompt: Prompt | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  clearError: () => void;
  
  // Prompt operations
  createPrompt: (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'>) => Promise<void>;
  updatePrompt: (id: string, updates: Partial<Prompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  
  // Category operations
  createCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  
  // Utility operations
  copyToClipboard: (text: string) => Promise<boolean>;
  searchPrompts: (query: string) => Prompt[];
  filterByCategory: (category: string | null) => Prompt[];
}

// Theme Context types (for future extension)
export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => Promise<void>;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
  };
}

// Settings Context types
export interface SettingsContextType {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

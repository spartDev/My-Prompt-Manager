import { v4 as uuidv4 } from 'uuid';

import { 
  Prompt, 
  Category, 
  Settings, 
  StorageData, 
  DEFAULT_SETTINGS, 
  DEFAULT_CATEGORY,
  ErrorType,
  AppError 
} from '../types';

class StorageError extends Error implements AppError {
  public type: ErrorType;
  public details?: unknown;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = 'StorageError';
    this.type = appError.type;
    this.details = appError.details;
  }
}

export class StorageManager {
  private static instance: StorageManager | undefined;
  private readonly STORAGE_KEYS = {
    PROMPTS: 'prompts',
    CATEGORIES: 'categories',
    SETTINGS: 'settings'
  } as const;

  // Mutex for preventing concurrent storage operations
  private operationLocks = new Map<string, Promise<unknown>>();

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Prompt operations
  async savePrompt(prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prompt> {
    return this.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const newPrompt: Prompt = {
          ...prompt,
          id: uuidv4(),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const existingPrompts = await this.getPrompts();
        const updatedPrompts = [...existingPrompts, newPrompt];
        
        await this.setStorageData(this.STORAGE_KEYS.PROMPTS, updatedPrompts);
        return newPrompt;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async getPrompts(): Promise<Prompt[]> {
    try {
      const prompts = await this.getStorageData<Prompt[]>(this.STORAGE_KEYS.PROMPTS);
      return prompts || [];
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async updatePrompt(id: string, updates: Partial<Omit<Prompt, 'id' | 'createdAt'>>): Promise<Prompt> {
    return this.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const existingPrompts = await this.getPrompts();
        const promptIndex = existingPrompts.findIndex(p => p.id === id);
        
        if (promptIndex === -1) {
          throw new Error(`Prompt with id ${id} not found`);
        }

        const updatedPrompt: Prompt = {
          ...existingPrompts[promptIndex],
          ...updates,
          updatedAt: Date.now()
        };

        existingPrompts[promptIndex] = updatedPrompt;
        await this.setStorageData(this.STORAGE_KEYS.PROMPTS, existingPrompts);
        
        return updatedPrompt;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async deletePrompt(id: string): Promise<void> {
    return this.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const existingPrompts = await this.getPrompts();
        const filteredPrompts = existingPrompts.filter(p => p.id !== id);
        
        if (filteredPrompts.length === existingPrompts.length) {
          throw new Error(`Prompt with id ${id} not found`);
        }

        await this.setStorageData(this.STORAGE_KEYS.PROMPTS, filteredPrompts);
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  // Category operations
  async saveCategory(category: Omit<Category, 'id'>): Promise<Category> {
    try {
      const newCategory: Category = {
        ...category,
        id: uuidv4()
      };

      const existingCategories = await this.getCategories();
      
      // Check for duplicate names
      if (existingCategories.some(c => c.name.toLowerCase() === category.name.toLowerCase())) {
        throw new Error(`Category with name "${category.name}" already exists`);
      }

      const updatedCategories = [...existingCategories, newCategory];
      await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, updatedCategories);
      
      return newCategory;
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  // Import operations for backup/restore functionality
  async importPrompt(prompt: Prompt): Promise<Prompt> {
    return this.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const existingPrompts = await this.getPrompts();
        const existingIndex = existingPrompts.findIndex(p => p.id === prompt.id);
        
        if (existingIndex >= 0) {
          // Update existing prompt, preserving original timestamps if they exist
          const updatedPrompt: Prompt = {
            ...prompt,
            updatedAt: Date.now() // Update the modification time
          };
          existingPrompts[existingIndex] = updatedPrompt;
          await this.setStorageData(this.STORAGE_KEYS.PROMPTS, existingPrompts);
          return updatedPrompt;
        } else {
          // Add new prompt, preserving original timestamps if they exist
          const newPrompt: Prompt = {
            ...prompt,
            // Use provided timestamps or set current time as fallback
            createdAt: prompt.createdAt || Date.now(),
            updatedAt: prompt.updatedAt || Date.now()
          };
          const updatedPrompts = [...existingPrompts, newPrompt];
          await this.setStorageData(this.STORAGE_KEYS.PROMPTS, updatedPrompts);
          return newPrompt;
        }
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async importCategory(category: Category): Promise<Category> {
    try {
      const existingCategories = await this.getCategories();
      const existingIndex = existingCategories.findIndex(c => c.id === category.id);
      
      if (existingIndex >= 0) {
        // Update existing category
        existingCategories[existingIndex] = category;
        await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, existingCategories);
        return category;
      } else {
        // Check for duplicate names before adding new category
        const duplicateNameIndex = existingCategories.findIndex(
          c => c.name.toLowerCase() === category.name.toLowerCase()
        );
        
        if (duplicateNameIndex >= 0) {
          // Update the existing category with the same name, preserving the existing ID
          const updatedCategory: Category = {
            ...category,
            id: existingCategories[duplicateNameIndex].id // Keep existing ID
          };
          existingCategories[duplicateNameIndex] = updatedCategory;
          await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, existingCategories);
          return updatedCategory;
        } else {
          // Add new category
          const updatedCategories = [...existingCategories, category];
          await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, updatedCategories);
          return category;
        }
      }
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async getCategories(): Promise<Category[]> {
    try {
      const categories = await this.getStorageData<Category[]>(this.STORAGE_KEYS.CATEGORIES);
      const defaultCategories = categories || [];
      
      // Ensure default category exists
      if (!defaultCategories.some(c => c.name === DEFAULT_CATEGORY)) {
        const defaultCat: Category = {
          id: uuidv4(),
          name: DEFAULT_CATEGORY
        };
        defaultCategories.unshift(defaultCat);
        await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, defaultCategories);
      }
      
      return defaultCategories;
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async updateCategory(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<Category> {
    try {
      const existingCategories = await this.getCategories();
      const categoryIndex = existingCategories.findIndex(c => c.id === id);
      
      if (categoryIndex === -1) {
        throw new Error(`Category with id ${id} not found`);
      }

      // Check for duplicate names (excluding current category)
      if (updates.name) {
        const duplicateCategory = existingCategories.find(
          (c, index) => index !== categoryIndex && 
          c.name.toLowerCase() === updates.name.toLowerCase()
        );
        
        if (duplicateCategory) {
          throw new Error(`Category with name "${updates.name}" already exists`);
        }
      }

      const updatedCategory: Category = {
        ...existingCategories[categoryIndex],
        ...updates
      };

      existingCategories[categoryIndex] = updatedCategory;
      await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, existingCategories);
      
      return updatedCategory;
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async deleteCategory(id: string): Promise<void> {
    return this.withLock(`deleteCategory-${id}`, async () => {
      try {
        const existingCategories = await this.getCategories();
        const categoryToDelete = existingCategories.find(c => c.id === id);
        
        if (!categoryToDelete) {
          throw new Error(`Category with id ${id} not found`);
        }

        // Prevent deletion of default category
        if (categoryToDelete.name === DEFAULT_CATEGORY) {
          throw new Error('Cannot delete the default category');
        }

        // Atomic operation: Update both prompts and categories together
        const [prompts] = await Promise.all([
          this.getPrompts()
        ]);

        const updatedPrompts = prompts.map(prompt => 
          prompt.category === categoryToDelete.name 
            ? { ...prompt, category: DEFAULT_CATEGORY, updatedAt: Date.now() }
            : prompt
        );
        
        const filteredCategories = existingCategories.filter(c => c.id !== id);

        // Perform both updates atomically using Promise.all
        const hasPromptsToUpdate = updatedPrompts.some((p, i) => p.category !== prompts[i].category);
        
        if (hasPromptsToUpdate) {
          await Promise.all([
            this.setStorageData(this.STORAGE_KEYS.PROMPTS, updatedPrompts),
            this.setStorageData(this.STORAGE_KEYS.CATEGORIES, filteredCategories)
          ]);
        } else {
          await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, filteredCategories);
        }
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  // Settings operations
  async getSettings(): Promise<Settings> {
    try {
      const settings = await this.getStorageData<Settings>(this.STORAGE_KEYS.SETTINGS);
      return settings || DEFAULT_SETTINGS;
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...updates };
      
      await this.setStorageData(this.STORAGE_KEYS.SETTINGS, updatedSettings);
      return updatedSettings;
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  // Utility methods
  async getAllData(): Promise<StorageData> {
    try {
      const [prompts, categories, settings] = await Promise.all([
        this.getPrompts(),
        this.getCategories(),
        this.getSettings()
      ]);

      return { prompts, categories, settings };
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await chrome.storage.local.clear();
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async getStorageUsage(): Promise<{ used: number; total: number }> {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      
      return {
        used: usage,
        total: quota
      };
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async exportData(): Promise<string> {
    try {
      const data = await this.getAllData();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData) as unknown;
      
      // Validate imported data structure
      if (!this.validateImportedData(data)) {
        throw new Error('Invalid data format');
      }

      // Clear existing data and import new data
      await this.clearAllData();
      
      await Promise.all([
        this.setStorageData(this.STORAGE_KEYS.PROMPTS, data.prompts),
        this.setStorageData(this.STORAGE_KEYS.CATEGORIES, data.categories),
        this.setStorageData(this.STORAGE_KEYS.SETTINGS, data.settings)
      ]);
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  // Private helper methods
  private async getStorageData<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get([key]);
    return (result[key] as T) || null;
  }

  private async setStorageData(key: string, data: unknown): Promise<void> {
    await chrome.storage.local.set({ [key]: data });
  }

  // Mutex implementation for preventing race conditions
  private async withLock<T>(lockKey: string, operation: () => Promise<T>): Promise<T> {
    // Wait for any existing operation with the same key
    const existingLock = this.operationLocks.get(lockKey);
    if (existingLock) {
      await existingLock.catch(() => {}); // Ignore errors from previous operations
    }

    // Create new operation promise
    const operationPromise = operation();
    this.operationLocks.set(lockKey, operationPromise);

    try {
      const result = await operationPromise;
      return result;
    } finally {
      // Clean up the lock if this was the current operation
      if (this.operationLocks.get(lockKey) === operationPromise) {
        this.operationLocks.delete(lockKey);
      }
    }
  }

  private handleStorageError(error: unknown): StorageError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('QUOTA_EXCEEDED')) {
      return new StorageError({
        type: ErrorType.STORAGE_QUOTA_EXCEEDED,
        message: 'Storage quota exceeded. Please delete some prompts to free up space.',
        details: error
      });
    }

    if (errorMessage.includes('storage API')) {
      return new StorageError({
        type: ErrorType.STORAGE_UNAVAILABLE,
        message: 'Storage API is unavailable. Please try again later.',
        details: error
      });
    }

    if (error instanceof SyntaxError) {
      return new StorageError({
        type: ErrorType.DATA_CORRUPTION,
        message: 'Data corruption detected. Some data may need to be recovered.',
        details: error
      });
    }

    return new StorageError({
      type: ErrorType.VALIDATION_ERROR,
      message: errorMessage || 'An unknown storage error occurred.',
      details: error
    });
  }

  private validateImportedData(data: unknown): data is StorageData {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    const obj = data as Record<string, unknown>;
    return (
      'prompts' in obj &&
      'categories' in obj &&
      'settings' in obj &&
      Array.isArray(obj.prompts) &&
      Array.isArray(obj.categories) &&
      typeof obj.settings === 'object' &&
      obj.settings !== null
    );
  }
}
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

export class StorageManager {
  private static instance: StorageManager;
  private readonly STORAGE_KEYS = {
    PROMPTS: 'prompts',
    CATEGORIES: 'categories',
    SETTINGS: 'settings'
  } as const;

  // Mutex for preventing concurrent storage operations
  private operationLocks = new Map<string, Promise<any>>();

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
          c.name.toLowerCase() === updates.name!.toLowerCase()
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
      const data: StorageData = JSON.parse(jsonData);
      
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
    return result[key] || null;
  }

  private async setStorageData<T>(key: string, data: T): Promise<void> {
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

  private handleStorageError(error: any): AppError {
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      return {
        type: ErrorType.STORAGE_QUOTA_EXCEEDED,
        message: 'Storage quota exceeded. Please delete some prompts to free up space.',
        details: error
      };
    }

    if (error.message?.includes('storage API')) {
      return {
        type: ErrorType.STORAGE_UNAVAILABLE,
        message: 'Storage API is unavailable. Please try again later.',
        details: error
      };
    }

    if (error instanceof SyntaxError) {
      return {
        type: ErrorType.DATA_CORRUPTION,
        message: 'Data corruption detected. Some data may need to be recovered.',
        details: error
      };
    }

    return {
      type: ErrorType.VALIDATION_ERROR,
      message: error.message || 'An unknown storage error occurred.',
      details: error
    };
  }

  private validateImportedData(data: any): data is StorageData {
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.prompts) &&
      Array.isArray(data.categories) &&
      typeof data.settings === 'object'
    );
  }
}
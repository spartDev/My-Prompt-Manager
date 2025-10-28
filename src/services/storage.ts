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
import {
  checkQuotaAvailability,
  estimatePromptSize,
  estimatePromptsArraySize
} from '../utils';

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
        // Proactive quota check BEFORE attempting write
        const estimatedSize = estimatePromptSize(prompt.title, prompt.content, prompt.category);
        await this.checkQuotaBeforeWrite(estimatedSize);

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

        // Check if update would increase size (content/title getting longer)
        const oldPrompt = existingPrompts[promptIndex];
        const oldSize = estimatePromptSize(oldPrompt.title, oldPrompt.content, oldPrompt.category);
        const newSize = estimatePromptSize(updatedPrompt.title, updatedPrompt.content, updatedPrompt.category);
        const sizeDelta = newSize - oldSize;

        // Only check quota if size is increasing
        if (sizeDelta > 0) {
          await this.checkQuotaBeforeWrite(sizeDelta);
        }

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
          // Update existing prompt - check quota if size is increasing
          const oldPrompt = existingPrompts[existingIndex];
          const oldSize = estimatePromptSize(oldPrompt.title, oldPrompt.content, oldPrompt.category);
          const newSize = estimatePromptSize(prompt.title, prompt.content, prompt.category);
          const sizeDelta = newSize - oldSize;

          if (sizeDelta > 0) {
            await this.checkQuotaBeforeWrite(sizeDelta);
          }

          const updatedPrompt: Prompt = {
            ...prompt,
            updatedAt: Date.now() // Update the modification time
          };
          existingPrompts[existingIndex] = updatedPrompt;
          await this.setStorageData(this.STORAGE_KEYS.PROMPTS, existingPrompts);
          return updatedPrompt;
        } else {
          // Add new prompt - check quota for full size
          const promptSize = estimatePromptSize(prompt.title, prompt.content, prompt.category);
          await this.checkQuotaBeforeWrite(promptSize);

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
    return this.withLock(this.STORAGE_KEYS.CATEGORIES, async () => {
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
    });
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
    return this.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const existingCategories = await this.getCategories();
        const categoryIndex = existingCategories.findIndex(c => c.id === id);
        
        if (categoryIndex === -1) {
          throw new Error(`Category with id ${id} not found`);
        }

        const oldCategory = existingCategories[categoryIndex];

        // Check for duplicate names (excluding current category)
        if (updates.name) {
          const duplicateCategory = existingCategories.find(
            (c, index) => index !== categoryIndex &&
            c.name.toLowerCase() === (updates.name || '').toLowerCase()
          );
          
          if (duplicateCategory) {
            throw new Error(`Category with name "${updates.name}" already exists`);
          }
        }

        const updatedCategory: Category = {
          ...oldCategory,
          ...updates
        };

        existingCategories[categoryIndex] = updatedCategory;
        
        // If the category name changed, update all prompts using the old name
        if (updates.name && updates.name !== oldCategory.name) {
          const prompts = await this.getPrompts();
          const updatedPrompts = prompts.map(prompt =>
            prompt.category === oldCategory.name
              ? { ...prompt, category: updates.name, updatedAt: Date.now() }
              : prompt
          );
          
          // Update both categories and prompts atomically
          await Promise.all([
            this.setStorageData(this.STORAGE_KEYS.CATEGORIES, existingCategories),
            this.setStorageData(this.STORAGE_KEYS.PROMPTS, updatedPrompts)
          ]);
        } else {
          // Only update categories if name hasn't changed
          await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, existingCategories);
        }
        
        return updatedCategory;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return this.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
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

        // Update prompts that belong to the deleted category
        const prompts = await this.getPrompts();
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

  async getStorageUsageWithWarnings(): Promise<{
    used: number;
    total: number;
    percentage: number;
    warningLevel: 'safe' | 'warning' | 'critical' | 'danger';
  }> {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      const percentage = (usage / quota) * 100;

      let warningLevel: 'safe' | 'warning' | 'critical' | 'danger';
      if (percentage < 70) {
        warningLevel = 'safe';
      } else if (percentage < 85) {
        warningLevel = 'warning';
      } else if (percentage < 95) {
        warningLevel = 'critical';
      } else {
        warningLevel = 'danger';
      }

      return {
        used: usage,
        total: quota,
        percentage,
        warningLevel
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

      // Validate imported data structure FIRST
      if (!this.validateImportedData(data)) {
        throw new Error('Invalid data format');
      }

      // Proactive quota check BEFORE clearing data
      // Since we clear ALL existing data before import, check if import size
      // fits within total quota (not current usage + import size)
      const estimatedPromptsSize = estimatePromptsArraySize(data.prompts);
      const estimatedCategoriesSize = data.categories.length * 100; // Rough estimate
      const estimatedSettingsSize = 500; // Settings overhead
      const totalEstimatedSize = estimatedPromptsSize + estimatedCategoriesSize + estimatedSettingsSize;

      // Check against total quota since existing data will be cleared
      const quota = chrome.storage.local.QUOTA_BYTES;
      if (totalEstimatedSize > quota) {
        throw new StorageError({
          type: ErrorType.STORAGE_QUOTA_EXCEEDED,
          message: `Import size (${Math.round(totalEstimatedSize / 1024).toString()} KB) exceeds storage quota (${Math.round(quota / 1024).toString()} KB).`,
          details: {
            estimatedSize: totalEstimatedSize,
            totalQuota: quota,
            percentageOfQuota: Math.round((totalEstimatedSize / quota) * 100)
          }
        });
      }

      // Create backup of existing data before clearing
      const backup = await this.getAllData();

      try {
        // Clear existing data and import new data
        await this.clearAllData();

        await Promise.all([
          this.setStorageData(this.STORAGE_KEYS.PROMPTS, data.prompts),
          this.setStorageData(this.STORAGE_KEYS.CATEGORIES, data.categories),
          this.setStorageData(this.STORAGE_KEYS.SETTINGS, data.settings)
        ]);
      } catch (importError) {
        // Rollback: restore backup if import fails
        // Use Promise.allSettled to ensure ALL rollback operations are attempted
        // even if some fail, to maximize chances of data recovery
        const rollbackResults = await Promise.allSettled([
          this.setStorageData(this.STORAGE_KEYS.PROMPTS, backup.prompts),
          this.setStorageData(this.STORAGE_KEYS.CATEGORIES, backup.categories),
          this.setStorageData(this.STORAGE_KEYS.SETTINGS, backup.settings)
        ]);

        // Check if any rollback operations failed
        const rollbackFailures = rollbackResults.filter(r => r.status === 'rejected');

        if (rollbackFailures.length > 0) {
          // Construct detailed error message with which operations failed
          const failureDetails = rollbackResults
            .map((result, index) => {
              const keys = ['prompts', 'categories', 'settings'];
              if (result.status === 'rejected') {
                return `${keys[index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
              }
              return null;
            })
            .filter(Boolean)
            .join(', ');

          throw new Error(
            `Import failed and rollback partially failed (${rollbackFailures.length.toString()}/3 operations failed). ` +
            `Original error: ${importError instanceof Error ? importError.message : String(importError)}. ` +
            `Rollback failures: ${failureDetails}`
          );
        }

        // All rollback operations succeeded - re-throw the original import error
        throw importError;
      }
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

  /**
   * Check if there's enough storage quota before performing a write operation
   * Throws an error if quota would be exceeded
   *
   * @param estimatedSize Estimated size of data to be written (in bytes)
   * @throws StorageError if quota check fails
   */
  private async checkQuotaBeforeWrite(estimatedSize: number): Promise<void> {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;

      const quotaCheck = checkQuotaAvailability(estimatedSize, usage, quota);

      if (!quotaCheck.canWrite) {
        throw new StorageError({
          type: ErrorType.STORAGE_QUOTA_EXCEEDED,
          message: quotaCheck.reason || 'Storage quota would be exceeded by this operation.',
          details: {
            estimatedSize,
            currentUsage: usage,
            totalQuota: quota,
            available: quotaCheck.available,
            percentageAfterWrite: quotaCheck.percentageAfterWrite
          }
        });
      }
    } catch (error) {
      // If it's already a StorageError, re-throw it
      if (error instanceof StorageError) {
        throw error;
      }
      // Otherwise, wrap it
      throw this.handleStorageError(error);
    }
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
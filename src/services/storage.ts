import { v4 as uuidv4 } from 'uuid';

import {
  type Prompt,
  type Category,
  type Settings,
  type StorageData,
  DEFAULT_SETTINGS,
  DEFAULT_CATEGORY,
  type ErrorType,
  type AppError
} from '../types';
import { AsyncMutex } from '../utils/asyncMutex';
import { ensureStorageAvailable } from '../utils/chromeStorage';
import {
  checkQuotaAvailability,
  estimatePromptSize,
  estimatePromptsArraySize
} from '../utils/storageQuota';

import {
  AdmissionRefusedError,
  PROMPT_LIMITS,
  admit,
  admitEdit,
  admitNew,
  admitRestored,
  readPrompt,
  readPrompts,
  recordUse,
  scrubStored,
  scrubStoredCategories,
  scrubStoredSettings,
  type PromptTextPatch,
  type StoredPrompt
} from './promptAdmission';

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

const STORAGE_KEYS = {
  PROMPTS: 'prompts',
  CATEGORIES: 'categories',
  SETTINGS: 'settings'
} as const;

/** Every key except the prompts key, which can only be written through writePrompts. */
type NonPromptStorageKey = Exclude<(typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS], typeof STORAGE_KEYS.PROMPTS>;

export class StorageManager {
  private static instance: StorageManager | undefined;
  private readonly STORAGE_KEYS = STORAGE_KEYS;

  // Hard limits for storage quota enforcement
  private readonly STORAGE_LIMITS = {
    MAX_PROMPTS: 5000,            // Maximum number of prompts
    MAX_PROMPT_SIZE: 50000,       // Maximum size per prompt (50KB) - accounts for 20K chars × 2 bytes/char + overhead
    MAX_TOTAL_SIZE: 8000000       // Maximum total storage (8MB, leaving 2MB buffer)
  } as const;

  // Mutex for preventing concurrent storage operations
  private readonly mutex = new AsyncMutex();

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  // Prompt operations
  async savePrompt(prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'>): Promise<Prompt> {
    return this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        // Admission: remove Hidden characters, trim, refuse empty/over-limit text (ADR-001).
        // Runs before the size and quota estimates so they see the text that will be stored.
        const admission = admitNew(prompt, { id: uuidv4(), now: Date.now() });
        if (!admission.ok) {
          throw new AdmissionRefusedError(admission.errors);
        }
        const newPrompt = admission.prompt;

        const existingPrompts = await this.getPrompts();

        // HARD LIMIT: Enforce maximum prompt count
        if (existingPrompts.length >= this.STORAGE_LIMITS.MAX_PROMPTS) {
          throw new StorageError({
            message: `Maximum prompt limit reached (${String(this.STORAGE_LIMITS.MAX_PROMPTS)}). Please delete old prompts.`,
            type: 'STORAGE_QUOTA_EXCEEDED',
            details: {
              current: existingPrompts.length,
              max: this.STORAGE_LIMITS.MAX_PROMPTS
            }
          });
        }

        // HARD LIMIT: Enforce individual prompt size
        const estimatedSize = estimatePromptSize(newPrompt.title, newPrompt.content, newPrompt.category);
        if (estimatedSize > this.STORAGE_LIMITS.MAX_PROMPT_SIZE) {
          throw new StorageError({
            message: `Prompt exceeds maximum size limit (${String(this.STORAGE_LIMITS.MAX_PROMPT_SIZE)} bytes)`,
            type: 'VALIDATION_ERROR',
            details: {
              size: estimatedSize,
              max: this.STORAGE_LIMITS.MAX_PROMPT_SIZE
            }
          });
        }

        // HARD LIMIT: Check total storage before write
        const totalSize = estimatePromptsArraySize(existingPrompts) + estimatedSize;
        if (totalSize > this.STORAGE_LIMITS.MAX_TOTAL_SIZE) {
          throw new StorageError({
            message: 'Storage quota exceeded. Please delete old prompts to free up space.',
            type: 'STORAGE_QUOTA_EXCEEDED',
            details: {
              total: totalSize,
              max: this.STORAGE_LIMITS.MAX_TOTAL_SIZE
            }
          });
        }

        // Proactive quota check BEFORE attempting write (Chrome API check)
        await this.checkQuotaBeforeWrite(estimatedSize);

        const updatedPrompts = [...existingPrompts, newPrompt];

        await this.writePrompts(updatedPrompts);
        return newPrompt;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async getPrompts(): Promise<StoredPrompt[]> {
    try {
      const raw = await this.getStorageData<unknown>(this.STORAGE_KEYS.PROMPTS);
      // Reading never writes: usage fields missing from older entries are backfilled in memory only.
      return readPrompts(raw);
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  async updatePrompt(id: string, updates: PromptTextPatch): Promise<Prompt> {
    return this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const existingPrompts = await this.getPrompts();
        const promptIndex = existingPrompts.findIndex(p => p.id === id);

        if (promptIndex === -1) {
          throw new Error(`Prompt with id ${id} not found`);
        }

        // Admission: only the fields in the patch are checked; the rest is carried over.
        const admission = admitEdit(existingPrompts[promptIndex], updates, Date.now());
        if (!admission.ok) {
          throw new AdmissionRefusedError(admission.errors);
        }
        const updatedPrompt = admission.prompt;

        // Check if update would increase size (content/title getting longer)
        const oldPrompt = existingPrompts[promptIndex];
        const oldSize = estimatePromptSize(oldPrompt.title, oldPrompt.content, oldPrompt.category);
        const newSize = estimatePromptSize(updatedPrompt.title, updatedPrompt.content, updatedPrompt.category);
        const sizeDelta = newSize - oldSize;

        // HARD LIMIT: Enforce individual prompt size (same check as savePrompt)
        if (newSize > this.STORAGE_LIMITS.MAX_PROMPT_SIZE) {
          throw new StorageError({
            message: `Prompt exceeds maximum size limit (${String(this.STORAGE_LIMITS.MAX_PROMPT_SIZE)} bytes)`,
            type: 'VALIDATION_ERROR',
            details: {
              size: newSize,
              max: this.STORAGE_LIMITS.MAX_PROMPT_SIZE
            }
          });
        }

        // Only check quota if size is increasing
        if (sizeDelta > 0) {
          await this.checkQuotaBeforeWrite(sizeDelta);
        }

        existingPrompts[promptIndex] = updatedPrompt;
        await this.writePrompts(existingPrompts);

        return updatedPrompt;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async deletePrompt(id: string): Promise<void> {
    return this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const existingPrompts = await this.getPrompts();
        const filteredPrompts = existingPrompts.filter(p => p.id !== id);
        
        if (filteredPrompts.length === existingPrompts.length) {
          throw new Error(`Prompt with id ${id} not found`);
        }

        await this.writePrompts(filteredPrompts);
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async incrementUsageCount(id: string): Promise<Prompt> {
    return this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const existingPrompts = await this.getPrompts();
        const promptIndex = existingPrompts.findIndex(p => p.id === id);

        if (promptIndex === -1) {
          throw new Error(`Prompt with id ${id} not found`);
        }

        const updatedPrompt = recordUse(existingPrompts[promptIndex], Date.now());

        existingPrompts[promptIndex] = updatedPrompt;
        await this.writePrompts(existingPrompts);

        return updatedPrompt;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  // Category operations
  async saveCategory(category: Omit<Category, 'id'>): Promise<Category> {
    return this.mutex.withLock(this.STORAGE_KEYS.CATEGORIES, async () => {
      try {
        const newCategory: Category = {
          ...category,
          name: this.admitCategoryName(category.name),
          id: uuidv4()
        };

        const existingCategories = await this.getCategories();

        // Check for duplicate names (on the admitted name, so invisible differences cannot hide one)
        if (existingCategories.some(c => c.name.toLowerCase() === newCategory.name.toLowerCase())) {
          throw new Error(`Category with name "${newCategory.name}" already exists`);
        }

        const updatedCategories = [...existingCategories, newCategory];
        await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, updatedCategories);

        return newCategory;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  // Import operations for backup/restore functionality
  async importPrompt(prompt: Prompt): Promise<Prompt> {
    return this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const incoming = readPrompt(prompt);
        if (!incoming) {
          throw new Error('Cannot import: the Prompt is missing its id, title or content');
        }

        const existingPrompts = await this.getPrompts();
        const existingIndex = existingPrompts.findIndex(p => p.id === incoming.id);
        const replacing = existingIndex >= 0;

        // Admission: the same rules as every other route, before any size or quota estimate.
        const admission = admitRestored(incoming, Date.now(), { replacing });
        if (!admission.ok) {
          throw new AdmissionRefusedError(admission.errors);
        }
        const admitted = admission.prompt;

        if (replacing) {
          // Update existing prompt - check quota if size is increasing
          const oldPrompt = existingPrompts[existingIndex];
          const oldSize = estimatePromptSize(oldPrompt.title, oldPrompt.content, oldPrompt.category);
          const newSize = estimatePromptSize(admitted.title, admitted.content, admitted.category);
          const sizeDelta = newSize - oldSize;

          if (sizeDelta > 0) {
            await this.checkQuotaBeforeWrite(sizeDelta);
          }

          existingPrompts[existingIndex] = admitted;
          await this.writePrompts(existingPrompts);
          return admitted;
        }

        // Add new prompt - check quota for full size
        await this.checkQuotaBeforeWrite(estimatePromptSize(admitted.title, admitted.content, admitted.category));
        await this.writePrompts([...existingPrompts, admitted]);
        return admitted;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async importCategory(incoming: Category): Promise<Category> {
    return this.mutex.withLock(this.STORAGE_KEYS.CATEGORIES, async () => {
      try {
        // Admission: the name is admitted like every other Category name
        const category: Category = { ...incoming, name: this.admitCategoryName(incoming.name) };

        const existingCategories = await this.getCategories();
        const existingIndex = existingCategories.findIndex(c => c.id === category.id);

        if (existingIndex >= 0) {
          // Update existing category
          existingCategories[existingIndex] = category;
          await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, existingCategories);
          return category;
        } else {
          // Check for duplicate names (on the admitted name) before adding new category
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
    // Lock CATEGORIES first (always modified), then PROMPTS if name changes
    return this.mutex.withLock(this.STORAGE_KEYS.CATEGORIES, async () => {
      try {
        const existingCategories = await this.getCategories();
        const categoryIndex = existingCategories.findIndex(c => c.id === id);

        if (categoryIndex === -1) {
          throw new Error(`Category with id ${id} not found`);
        }

        const oldCategory = existingCategories[categoryIndex];

        // Admission: a new name is admitted like every other Category name
        const name = updates.name === undefined ? undefined : this.admitCategoryName(updates.name);

        // Check for duplicate names (excluding current category), on the admitted name
        if (name !== undefined) {
          const duplicateCategory = existingCategories.find(
            (c, index) => index !== categoryIndex && c.name.toLowerCase() === name.toLowerCase()
          );

          if (duplicateCategory) {
            throw new Error(`Category with name "${name}" already exists`);
          }
        }

        const updatedCategory: Category = {
          ...oldCategory,
          ...updates,
          ...(name === undefined ? {} : { name })
        };

        existingCategories[categoryIndex] = updatedCategory;

        // If the category name changed, also lock PROMPTS to update references
        if (name !== undefined && name !== oldCategory.name) {
          return await this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
            const prompts = await this.getPrompts();
            const updatedPrompts = this.moveCategoryPrompts(prompts, oldCategory.name, name);

            // Update both categories and prompts atomically with both locks held
            await this.writeCategoriesAndPrompts(existingCategories, updatedPrompts);

            return updatedCategory;
          });
        } else {
          // Only update categories if name hasn't changed (no need for PROMPTS lock)
          await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, existingCategories);
          return updatedCategory;
        }
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async deleteCategory(id: string): Promise<void> {
    // Lock CATEGORIES first (always modified), then PROMPTS if prompts need updating
    await this.mutex.withLock(this.STORAGE_KEYS.CATEGORIES, async () => {
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

        const filteredCategories = existingCategories.filter(c => c.id !== id);

        // Check if any prompts need to be updated
        // Lock PROMPTS only if we need to modify prompts
        await this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
          const prompts = await this.getPrompts();
          const hasPromptsToUpdate = prompts.some(p => p.category === categoryToDelete.name);

          if (hasPromptsToUpdate) {
            const updatedPrompts = this.moveCategoryPrompts(prompts, categoryToDelete.name, DEFAULT_CATEGORY);

            // Update both categories and prompts atomically with both locks held
            await this.writeCategoriesAndPrompts(filteredCategories, updatedPrompts);
          } else {
            // No prompts to update, just delete category
            await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, filteredCategories);
          }
        });
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  /**
   * The one-time upgrade pass (ADR-001, "Existing data"): cleans stored Prompts, Category names
   * and the default Category of Hidden characters. It works on the raw stored values, so it never
   * refuses, trims, shortens or drops a Prompt, including a malformed one or one already over the
   * limits. The only Categories it drops are later ones whose name becomes the same as an earlier
   * one's once cleaned; every Prompt, and the default Category, that named a dropped Category is
   * re-pointed to the kept one in the same write. It writes nothing when there is nothing to
   * clean, and every key that changed in one atomic write. Safe to run any number of times.
   */
  upgradeStoredData(): Promise<{ promptsChanged: boolean; categoriesChanged: boolean }> {
    // Same lock order as updateCategory, CATEGORIES then PROMPTS, with SETTINGS last
    return this.mutex.withLock(this.STORAGE_KEYS.CATEGORIES, () =>
      this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, () =>
        this.mutex.withLock(this.STORAGE_KEYS.SETTINGS, async () => {
          try {
            // Raw values: getPrompts drops malformed entries and getCategories may write the default Category
            const categories = scrubStoredCategories(await this.getStorageData<unknown>(this.STORAGE_KEYS.CATEGORIES));
            const prompts = scrubStored(await this.getStorageData<unknown>(this.STORAGE_KEYS.PROMPTS), categories.renames);
            const settings = scrubStoredSettings(
              await this.getStorageData<unknown>(this.STORAGE_KEYS.SETTINGS),
              categories.renames
            );

            if (prompts.changed || categories.changed || settings.changed) {
              await this.writeScrubbed({
                prompts: prompts.changed ? prompts.entries : undefined,
                categories: categories.changed ? categories.entries : undefined,
                settings: settings.changed ? settings.settings : undefined
              });
            }

            return { promptsChanged: prompts.changed, categoriesChanged: categories.changed };
          } catch (error) {
            throw this.handleStorageError(error);
          }
        })
      )
    );
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

  updateSettings(updates: Partial<Settings>): Promise<Settings> {
    return this.mutex.withLock(this.STORAGE_KEYS.SETTINGS, async () => {
      try {
        const currentSettings = await this.getSettings();
        const updatedSettings = { ...currentSettings, ...updates };

        await this.setStorageData(this.STORAGE_KEYS.SETTINGS, updatedSettings);
        return updatedSettings;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
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

      // Admission: every Prompt and Category name in the file is admitted before anything is
      // cleared, so a refusal leaves the existing data untouched.
      const importedAt = Date.now();
      const admittedPrompts: StoredPrompt[] = data.prompts.map(raw => {
        const incoming = readPrompt(raw);
        if (!incoming) {
          throw new Error('Invalid data format');
        }
        const admission = admitRestored(incoming, importedAt);
        if (!admission.ok) {
          throw new AdmissionRefusedError(admission.errors);
        }
        return admission.prompt;
      });
      const admittedCategories: Category[] = data.categories.map(category => ({
        ...category,
        name: this.admitCategoryName(category.name)
      }));

      // Proactive quota check BEFORE clearing data
      // Since we clear ALL existing data before import, check if import size
      // fits within total quota (not current usage + import size)
      const estimatedPromptsSize = estimatePromptsArraySize(admittedPrompts);
      const estimatedCategoriesSize = admittedCategories.length * 100; // Rough estimate
      const estimatedSettingsSize = 500; // Settings overhead
      const totalEstimatedSize = estimatedPromptsSize + estimatedCategoriesSize + estimatedSettingsSize;

      // Check against total quota since existing data will be cleared
      const quota = chrome.storage.local.QUOTA_BYTES;
      if (totalEstimatedSize > quota) {
        throw new StorageError({
          type: 'STORAGE_QUOTA_EXCEEDED',
          message: `Import size (${Math.round(totalEstimatedSize / 1024).toString()} KB) exceeds storage quota (${Math.round(quota / 1024).toString()} KB).`,
          details: {
            estimatedSize: totalEstimatedSize,
            totalQuota: quota,
            percentageOfQuota: Math.round((totalEstimatedSize / quota) * 100)
          }
        });
      }

      // Create backup of existing data before clearing
      const [backupPrompts, backupCategories, backupSettings] = await Promise.all([
        this.getPrompts(),
        this.getCategories(),
        this.getSettings()
      ]);
      const backup = { prompts: backupPrompts, categories: backupCategories, settings: backupSettings };

      try {
        // Clear existing data and import new data
        await this.clearAllData();

        await Promise.all([
          this.writePrompts(admittedPrompts),
          this.setStorageData(this.STORAGE_KEYS.CATEGORIES, admittedCategories),
          this.setStorageData(this.STORAGE_KEYS.SETTINGS, data.settings)
        ]);
      } catch (importError) {
        // Rollback: restore backup if import fails
        // Use Promise.allSettled to ensure ALL rollback operations are attempted
        // even if some fail, to maximize chances of data recovery
        const rollbackResults = await Promise.allSettled([
          this.writePrompts(backup.prompts),
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
    await ensureStorageAvailable();
    const result = await chrome.storage.local.get([key]);
    const value = result[key] as T;
    return value !== undefined ? value : null;
  }

  /**
   * The only way to write the prompts key. It accepts only values produced by the
   * Admission module, so a route that skips Admission does not compile.
   */
  private async writePrompts(prompts: readonly StoredPrompt[]): Promise<void> {
    await ensureStorageAvailable();
    await chrome.storage.local.set({ [STORAGE_KEYS.PROMPTS]: prompts });
  }

  /**
   * The single exception to "the prompts key is only written through writePrompts", used
   * only by upgradeStoredData. The upgrade pass works on raw entries and must keep the ones
   * that are not StoredPrompts (malformed, or already over the limits) rather than drop them.
   * Writes only the keys given (`undefined` means the key is left alone), in one atomic set.
   */
  private async writeScrubbed(scrubbed: {
    prompts: readonly unknown[] | undefined;
    categories: readonly unknown[] | undefined;
    settings: unknown;
  }): Promise<void> {
    await ensureStorageAvailable();
    await chrome.storage.local.set({
      ...(scrubbed.prompts && { [STORAGE_KEYS.PROMPTS]: scrubbed.prompts }),
      ...(scrubbed.categories && { [STORAGE_KEYS.CATEGORIES]: scrubbed.categories }),
      ...(scrubbed.settings !== undefined && { [STORAGE_KEYS.SETTINGS]: scrubbed.settings })
    });
  }

  /** Writes categories and prompts together (one atomic set), prompts typed as above. */
  private async writeCategoriesAndPrompts(
    categories: readonly Category[],
    prompts: readonly StoredPrompt[]
  ): Promise<void> {
    await ensureStorageAvailable();
    await chrome.storage.local.set({
      [STORAGE_KEYS.CATEGORIES]: categories,
      [STORAGE_KEYS.PROMPTS]: prompts
    });
  }

  private async setStorageData(key: NonPromptStorageKey, data: unknown): Promise<void> {
    await ensureStorageAvailable();
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
          type: 'STORAGE_QUOTA_EXCEEDED',
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

  /** Moves the Prompts of one Category to another (already admitted) name, through Admission. */
  private moveCategoryPrompts(prompts: readonly StoredPrompt[], from: string, to: string): StoredPrompt[] {
    const now = Date.now();

    return prompts.map(prompt => {
      if (prompt.category !== from) {
        return prompt;
      }

      const admission = admitEdit(prompt, { category: to }, now);
      if (!admission.ok) {
        throw new AdmissionRefusedError(admission.errors);
      }
      return admission.prompt;
    });
  }

  /** Admission for a Category name: the same rules as a Prompt's category field. */
  private admitCategoryName(name: string): string {
    const admission = admit({ category: name });
    if (!admission.ok) {
      throw new AdmissionRefusedError(admission.errors);
    }
    return admission.text.category ?? name;
  }

  private handleStorageError(error: unknown): StorageError | AdmissionRefusedError {
    // If it's already a StorageError, return it as-is to preserve details
    if (error instanceof StorageError) {
      return error;
    }

    // A refused Admission is not a storage failure: keep its type and refusals for the caller
    if (error instanceof AdmissionRefusedError) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('QUOTA_EXCEEDED')) {
      return new StorageError({
        type: 'STORAGE_QUOTA_EXCEEDED',
        message: 'Storage quota exceeded. Please delete some prompts to free up space.',
        details: error
      });
    }

    if (errorMessage.includes('storage API')) {
      return new StorageError({
        type: 'STORAGE_UNAVAILABLE',
        message: 'Storage API is unavailable. Please try again later.',
        details: error
      });
    }

    if (error instanceof SyntaxError) {
      return new StorageError({
        type: 'DATA_CORRUPTION',
        message: 'Data corruption detected. Some data may need to be recovered.',
        details: error
      });
    }

    return new StorageError({
      type: 'VALIDATION_ERROR',
      message: errorMessage || 'An unknown storage error occurred.',
      details: error
    });
  }

  private validateImportedData(data: unknown): data is StorageData {
    const errors: string[] = [];

    // Basic structure validation
    if (!data || typeof data !== 'object') {
      throw new StorageError({
        type: 'VALIDATION_ERROR',
        message: 'Import data must be a valid JSON object',
        details: { errors: ['Data is not an object'] }
      });
    }

    const obj = data as Record<string, unknown>;

    // Check for required top-level fields
    if (!('prompts' in obj)) {
      errors.push('Missing required field: prompts');
    } else if (!Array.isArray(obj.prompts)) {
      errors.push('Field "prompts" must be an array');
    }

    if (!('categories' in obj)) {
      errors.push('Missing required field: categories');
    } else if (!Array.isArray(obj.categories)) {
      errors.push('Field "categories" must be an array');
    }

    if (!('settings' in obj)) {
      errors.push('Missing required field: settings');
    } else if (typeof obj.settings !== 'object' || obj.settings === null) {
      errors.push('Field "settings" must be an object');
    }

    // If structure is invalid, throw immediately
    if (errors.length > 0) {
      throw new StorageError({
        type: 'VALIDATION_ERROR',
        message: `Invalid import data structure: ${errors.join('; ')}`,
        details: { errors }
      });
    }

    // Validate each prompt
    (obj.prompts as unknown[]).forEach((prompt, index) => {
      const promptErrors = this.validatePrompt(prompt, index);
      errors.push(...promptErrors);
    });

    // Check for duplicate prompt IDs
    const promptIds = new Set<string>();
    const duplicatePromptIds: string[] = [];
    (obj.prompts as Array<{ id?: unknown }>).forEach((p, _index) => {
      if (typeof p.id === 'string') {
        if (promptIds.has(p.id)) {
          duplicatePromptIds.push(p.id);
        }
        promptIds.add(p.id);
      }
    });
    if (duplicatePromptIds.length > 0) {
      errors.push(`Duplicate prompt IDs found: ${duplicatePromptIds.join(', ')}`);
    }

    // Validate each category
    (obj.categories as unknown[]).forEach((category, index) => {
      const categoryErrors = this.validateCategory(category, index);
      errors.push(...categoryErrors);
    });

    // Check for duplicate category names (case-insensitive)
    const categoryNames = new Map<string, string>();
    const duplicateCategoryNames: string[] = [];
    (obj.categories as Array<{ name?: unknown }>).forEach((c, _index) => {
      if (typeof c.name === 'string') {
        const lowerName = c.name.toLowerCase();
        if (categoryNames.has(lowerName)) {
          duplicateCategoryNames.push(c.name);
        }
        categoryNames.set(lowerName, c.name);
      }
    });
    if (duplicateCategoryNames.length > 0) {
      errors.push(`Duplicate category names found: ${duplicateCategoryNames.join(', ')}`);
    }

    // Validate referential integrity (prompts reference valid categories)
    const validCategoryNames = new Set(
      (obj.categories as Array<{ name?: unknown }>)
        .filter(c => typeof c.name === 'string')
        .map(c => c.name as string)
    );
    const invalidReferences: Array<{ promptIndex: number; category: string }> = [];
    (obj.prompts as Array<{ category?: unknown }>).forEach((p, index) => {
      if (typeof p.category === 'string' && !validCategoryNames.has(p.category)) {
        invalidReferences.push({ promptIndex: index, category: p.category });
      }
    });
    if (invalidReferences.length > 0) {
      const refDetails = invalidReferences
        .slice(0, 5)
        .map(r => `prompt[${String(r.promptIndex)}] → "${r.category}"`)
        .join(', ');
      const moreCount = invalidReferences.length > 5 ? ` and ${String(invalidReferences.length - 5)} more` : '';
      errors.push(`Referential integrity violation: ${String(invalidReferences.length)} prompt(s) reference non-existent categories (${refDetails}${moreCount})`);
    }

    // Validate settings
    const settingsErrors = this.validateSettings(obj.settings);
    errors.push(...settingsErrors);

    // If any validation errors occurred, throw with all errors
    if (errors.length > 0) {
      throw new StorageError({
        type: 'VALIDATION_ERROR',
        message: `Import validation failed with ${String(errors.length)} error(s)`,
        details: { errors, errorCount: errors.length }
      });
    }

    return true;
  }

  /**
   * Validates a single prompt object
   * Returns array of error messages (empty if valid)
   * Accepts missing optional fields for backwards compatibility
   */
  private validatePrompt(p: unknown, index: number): string[] {
    const errors: string[] = [];
    const prefix = `prompt[${String(index)}]`;

    if (!p || typeof p !== 'object') {
      return [`${prefix}: Must be an object`];
    }

    const prompt = p as Record<string, unknown>;

    // ID validation
    if (!('id' in prompt)) {
      errors.push(`${prefix}: Missing required field "id"`);
    } else if (typeof prompt.id !== 'string') {
      errors.push(`${prefix}: Field "id" must be a string`);
    } else if (prompt.id.length === 0) {
      errors.push(`${prefix}: Field "id" cannot be empty`);
    }

    // Title validation
    if (!('title' in prompt)) {
      errors.push(`${prefix}: Missing required field "title"`);
    } else if (typeof prompt.title !== 'string') {
      errors.push(`${prefix}: Field "title" must be a string`);
    } else if (prompt.title.length === 0) {
      errors.push(`${prefix}: Field "title" cannot be empty`);
    } else if (prompt.title.length > PROMPT_LIMITS.title) {
      errors.push(`${prefix}: Field "title" exceeds maximum length of ${String(PROMPT_LIMITS.title)} characters (got ${String(prompt.title.length)})`);
    }

    // Content validation
    if (!('content' in prompt)) {
      errors.push(`${prefix}: Missing required field "content"`);
    } else if (typeof prompt.content !== 'string') {
      errors.push(`${prefix}: Field "content" must be a string`);
    } else if (prompt.content.length === 0) {
      errors.push(`${prefix}: Field "content" cannot be empty`);
    } else if (prompt.content.length > PROMPT_LIMITS.content) {
      errors.push(`${prefix}: Field "content" exceeds maximum length of ${PROMPT_LIMITS.content.toLocaleString('en-US')} characters (got ${String(prompt.content.length)})`);
    }

    // Category validation
    if (!('category' in prompt)) {
      errors.push(`${prefix}: Missing required field "category"`);
    } else if (typeof prompt.category !== 'string') {
      errors.push(`${prefix}: Field "category" must be a string`);
    } else if (prompt.category.length === 0) {
      errors.push(`${prefix}: Field "category" cannot be empty`);
    }

    // Timestamp validation (createdAt is required)
    if (!('createdAt' in prompt)) {
      errors.push(`${prefix}: Missing required field "createdAt"`);
    } else if (typeof prompt.createdAt !== 'number') {
      errors.push(`${prefix}: Field "createdAt" must be a number`);
    } else if (!Number.isFinite(prompt.createdAt)) {
      errors.push(`${prefix}: Field "createdAt" must be a finite number`);
    } else if (prompt.createdAt <= 0) {
      errors.push(`${prefix}: Field "createdAt" must be a positive number`);
    } else if (prompt.createdAt > Date.now() + 86400000) {
      // Allow 1 day in the future for clock skew
      errors.push(`${prefix}: Field "createdAt" cannot be more than 1 day in the future`);
    }

    // updatedAt validation (required)
    if (!('updatedAt' in prompt)) {
      errors.push(`${prefix}: Missing required field "updatedAt"`);
    } else if (typeof prompt.updatedAt !== 'number') {
      errors.push(`${prefix}: Field "updatedAt" must be a number`);
    } else if (!Number.isFinite(prompt.updatedAt)) {
      errors.push(`${prefix}: Field "updatedAt" must be a finite number`);
    } else if (typeof prompt.createdAt === 'number' && prompt.updatedAt < prompt.createdAt) {
      errors.push(`${prefix}: Field "updatedAt" cannot be before "createdAt"`);
    }

    // Optional fields validation (accept missing, but validate if present)
    if ('usageCount' in prompt) {
      if (typeof prompt.usageCount !== 'number') {
        errors.push(`${prefix}: Field "usageCount" must be a number if provided`);
      } else if (!Number.isFinite(prompt.usageCount)) {
        errors.push(`${prefix}: Field "usageCount" must be a finite number`);
      } else if (prompt.usageCount < 0) {
        errors.push(`${prefix}: Field "usageCount" cannot be negative`);
      } else if (!Number.isInteger(prompt.usageCount)) {
        errors.push(`${prefix}: Field "usageCount" must be an integer`);
      }
    }

    if ('lastUsedAt' in prompt) {
      if (typeof prompt.lastUsedAt !== 'number') {
        errors.push(`${prefix}: Field "lastUsedAt" must be a number if provided`);
      } else if (!Number.isFinite(prompt.lastUsedAt)) {
        errors.push(`${prefix}: Field "lastUsedAt" must be a finite number`);
      } else if (typeof prompt.createdAt === 'number' && prompt.lastUsedAt < prompt.createdAt) {
        errors.push(`${prefix}: Field "lastUsedAt" cannot be before "createdAt"`);
      }
    }

    return errors;
  }

  /**
   * Validates a single category object
   * Returns array of error messages (empty if valid)
   */
  private validateCategory(c: unknown, index: number): string[] {
    const errors: string[] = [];
    const prefix = `category[${String(index)}]`;

    if (!c || typeof c !== 'object') {
      return [`${prefix}: Must be an object`];
    }

    const category = c as Record<string, unknown>;

    // ID validation
    if (!('id' in category)) {
      errors.push(`${prefix}: Missing required field "id"`);
    } else if (typeof category.id !== 'string') {
      errors.push(`${prefix}: Field "id" must be a string`);
    } else if (category.id.length === 0) {
      errors.push(`${prefix}: Field "id" cannot be empty`);
    }

    // Name validation
    if (!('name' in category)) {
      errors.push(`${prefix}: Missing required field "name"`);
    } else if (typeof category.name !== 'string') {
      errors.push(`${prefix}: Field "name" must be a string`);
    } else if (category.name.length === 0) {
      errors.push(`${prefix}: Field "name" cannot be empty`);
    } else if (category.name.length > 50) {
      errors.push(`${prefix}: Field "name" exceeds maximum length of 50 characters (got ${String(category.name.length)})`);
    }

    // Optional color validation
    if ('color' in category && category.color !== undefined) {
      if (typeof category.color !== 'string') {
        errors.push(`${prefix}: Field "color" must be a string if provided`);
      } else if (category.color.length > 0 && !category.color.match(/^#[0-9A-Fa-f]{6}$/)) {
        errors.push(`${prefix}: Field "color" must be a valid hex color (#RRGGBB format)`);
      }
    }

    return errors;
  }

  /**
   * Validates settings object
   * Returns array of error messages (empty if valid)
   */
  private validateSettings(s: unknown): string[] {
    const errors: string[] = [];
    const prefix = 'settings';

    if (!s || typeof s !== 'object') {
      return [`${prefix}: Must be an object`];
    }

    const settings = s as Record<string, unknown>;

    // Required field validation
    const requiredFields = ['defaultCategory', 'sortOrder', 'sortDirection', 'theme'];
    requiredFields.forEach(field => {
      if (!(field in settings)) {
        errors.push(`${prefix}: Missing required field "${field}"`);
      }
    });

    // defaultCategory validation
    if ('defaultCategory' in settings) {
      if (typeof settings.defaultCategory !== 'string') {
        errors.push(`${prefix}.defaultCategory: Must be a string`);
      }
    }

    // sortOrder validation
    if ('sortOrder' in settings) {
      const validSortOrders = ['createdAt', 'updatedAt', 'title', 'usageCount', 'lastUsedAt'];
      if (typeof settings.sortOrder !== 'string') {
        errors.push(`${prefix}.sortOrder: Must be a string`);
      } else if (!validSortOrders.includes(settings.sortOrder)) {
        errors.push(`${prefix}.sortOrder: Must be one of: ${validSortOrders.join(', ')}`);
      }
    }

    // sortDirection validation
    if ('sortDirection' in settings) {
      const validDirections = ['asc', 'desc'];
      if (typeof settings.sortDirection !== 'string') {
        errors.push(`${prefix}.sortDirection: Must be a string`);
      } else if (!validDirections.includes(settings.sortDirection)) {
        errors.push(`${prefix}.sortDirection: Must be one of: ${validDirections.join(', ')}`);
      }
    }

    // theme validation
    if ('theme' in settings) {
      const validThemes = ['light', 'dark', 'system'];
      if (typeof settings.theme !== 'string') {
        errors.push(`${prefix}.theme: Must be a string`);
      } else if (!validThemes.includes(settings.theme)) {
        errors.push(`${prefix}.theme: Must be one of: ${validThemes.join(', ')}`);
      }
    }

    // Optional interfaceMode validation
    if ('interfaceMode' in settings && settings.interfaceMode !== undefined) {
      const validModes = ['popup', 'sidepanel'];
      if (typeof settings.interfaceMode !== 'string') {
        errors.push(`${prefix}.interfaceMode: Must be a string if provided`);
      } else if (!validModes.includes(settings.interfaceMode)) {
        errors.push(`${prefix}.interfaceMode: Must be one of: ${validModes.join(', ')}`);
      }
    }

    return errors;
  }
}

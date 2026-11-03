import { v4 as uuidv4 } from 'uuid';

import { isValidHexColor } from '../constants/colors';
import {
  type AppError, 
  type Category,
  DEFAULT_CATEGORY,
  DEFAULT_SETTINGS,
  type ErrorType,
  type Prompt,
  type Settings,
  type StorageData
} from '../types';
import { AsyncMutex } from '../utils/asyncMutex';
import { ensureStorageAvailable } from '../utils/chromeStorage';
import {
  checkQuotaAvailability,
  storedSize
} from '../utils/storageQuota';

import {
  AdmissionRefusedError,
  admit,
  admitEdit,
  admitNew,
  admitRestored,
  matchStoredCategory,
  type PromptTextPatch,
  readPrompt,
  readPrompts,
  recordUse,
  repointPrompt,
  type StoredPrompt, 
  scrubStored,
  scrubStoredCategories,
  scrubStoredSettings,
  togglePin
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
    // Maximum bytes the Prompts take in Chrome storage: 8 MB of the 10 MB quota, which leaves 2 MB for the
    // usage history (up to 10,000 events) and the other keys. Admission limits a single Prompt's text.
    MAX_TOTAL_SIZE: 8000000
  } as const;

  // Locks for the Prompts, Categories and settings keys, shared with the other contexts (popup, side
  // panel, service worker) through the Web Locks API, so a read-then-write from one context cannot
  // overwrite a write made in between from another, nor write back after Clear All Data.
  // Lock order: CATEGORIES -> PROMPTS -> SETTINGS.
  private readonly mutex = new AsyncMutex({ scope: 'StorageManager' });

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

        const updatedPrompts = [...existingPrompts, newPrompt];
        this.checkLibraryCap(updatedPrompts);

        // Proactive quota check BEFORE attempting write (Chrome API check)
        await this.checkQuotaBeforeWrite(storedSize(newPrompt));

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
        const sizeDelta = storedSize(updatedPrompt) - storedSize(existingPrompts[promptIndex]);
        existingPrompts[promptIndex] = updatedPrompt;

        // Only check the cap and the quota if size is increasing
        if (sizeDelta > 0) {
          this.checkLibraryCap(existingPrompts);
          await this.checkQuotaBeforeWrite(sizeDelta);
        }

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

  // Pinning is a personal preference, not an edit: it leaves updatedAt untouched.
  // The pin is read under the lock, so rapid toggles never act on a stale value.
  async togglePinned(id: string): Promise<Prompt> {
    return this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
      try {
        const existingPrompts = await this.getPrompts();
        const promptIndex = existingPrompts.findIndex(p => p.id === id);

        if (promptIndex === -1) {
          throw new Error(`Prompt with id ${id} not found`);
        }

        const updatedPrompt = togglePin(existingPrompts[promptIndex]);

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

        const existingCategories = await this.readCategoriesWithDefault();

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
        const existingPrompts = await this.getPrompts();
        const existing = existingPrompts.find(p => p.id === prompt.id);

        // A Backup saved before usage tracking has no usage fields: the Prompt it replaces keeps its
        // own, and the Backup's values win wherever it has them (as `{ ...existing, ...prompt }` did).
        const merged = existing ? { ...existing, ...prompt } : prompt;

        // The Library may spell the Prompt's Category differently (`Work` for `work`): the Prompt takes
        // the stored spelling. The Categories are read raw, because getCategories() can take the
        // CATEGORIES lock to write the default Category, and CATEGORIES is never taken under PROMPTS (lock order).
        const storedCategories = await this.getStorageData<unknown>(this.STORAGE_KEYS.CATEGORIES);
        const incoming = readPrompt(
          typeof merged.category === 'string'
            ? { ...merged, category: matchStoredCategory(merged.category, storedCategories) }
            : merged
        );
        if (!incoming) {
          throw new Error('Cannot import: the Prompt is missing its id, title or content');
        }

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
          const sizeDelta = storedSize(admitted) - storedSize(existingPrompts[existingIndex]);

          existingPrompts[existingIndex] = admitted;
          if (sizeDelta > 0) {
            this.checkLibraryCap(existingPrompts);
            await this.checkQuotaBeforeWrite(sizeDelta);
          }

          await this.writePrompts(existingPrompts);
          return admitted;
        }

        // Add new prompt - check the cap and the quota for its full size
        const updatedPrompts = [...existingPrompts, admitted];
        this.checkLibraryCap(updatedPrompts);
        await this.checkQuotaBeforeWrite(storedSize(admitted));
        await this.writePrompts(updatedPrompts);
        return admitted;
      } catch (error) {
        throw this.handleStorageError(error);
      }
    });
  }

  async importCategory(incoming: Category): Promise<Category> {
    return this.mutex.withLock(this.STORAGE_KEYS.CATEGORIES, async () => {
      try {
        // Admission: the name is admitted like every other Category name. A Category from a Backup
        // may have no id (or not a string one); it is given one, so none is ever stored without. A
        // colour that is not a hex colour, by the same test as importData's, is dropped, not refused.
        const { color, ...rest } = incoming;
        const category: Category = {
          ...rest,
          id: typeof incoming.id === 'string' ? incoming.id : uuidv4(),
          name: this.admitCategoryName(incoming.name),
          ...(typeof color === 'string' && (color === '' || isValidHexColor(color)) && { color })
        };

        const existingCategories = await this.readCategoriesWithDefault();
        const existingIndex = existingCategories.findIndex(c => c.id === category.id);

        if (existingIndex >= 0) {
          // The Backup names a stored Category by id. It never renames the default Category, and
          // never renames a Category into another's name (ignoring case): then the stored name stays
          // and only the other fields (colour) come from the Backup. A rename it does apply moves the
          // Prompts with it, in one atomic write, under the same locks as updateCategory.
          const existing = existingCategories[existingIndex];
          const taken = existingCategories.some(
            (c, index) => index !== existingIndex && c.name.toLowerCase() === category.name.toLowerCase()
          );
          const updatedCategory: Category = {
            ...category,
            name: existing.name === DEFAULT_CATEGORY || taken ? existing.name : category.name
          };
          existingCategories[existingIndex] = updatedCategory;

          if (updatedCategory.name === existing.name) {
            await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, existingCategories);
            return updatedCategory;
          }

          return await this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, async () => {
            const prompts = await this.getPrompts();
            // Re-pointing is not an edit: timestamps and usage stay
            const movedPrompts = prompts.map(prompt =>
              prompt.category === existing.name ? repointPrompt(prompt, updatedCategory.name) : prompt
            );
            await this.writeCategoriesAndPrompts(existingCategories, movedPrompts);
            return updatedCategory;
          });
        } else {
          // Check for duplicate names (on the admitted name) before adding new category
          const duplicateNameIndex = existingCategories.findIndex(
            c => c.name.toLowerCase() === category.name.toLowerCase()
          );

          if (duplicateNameIndex >= 0) {
            // First wins: the stored Category keeps its id and its name (names are unique ignoring
            // case, and the Library's Prompts name the stored spelling), and takes the other fields
            // (colour) from the Backup. importPrompt snaps the Backup's Prompts to the stored spelling.
            const existing = existingCategories[duplicateNameIndex];
            const updatedCategory: Category = { ...category, id: existing.id, name: existing.name };
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

  /**
   * The Library's Categories, the default Category always among them. When the default Category
   * is not stored (a fresh store, or a by-id rename), it is created and written under the
   * CATEGORIES lock, after reading the list again inside it, so the write cannot put back a list
   * read before another context's Category write. Never call it while holding CATEGORIES (the
   * locks are not reentrant): a locked writer reads through readCategoriesWithDefault().
   */
  async getCategories(): Promise<Category[]> {
    try {
      const categories = await this.getStorageData<Category[]>(this.STORAGE_KEYS.CATEGORIES);
      if (categories?.some(c => c.name === DEFAULT_CATEGORY)) {
        return categories;
      }
      return await this.mutex.withLock(this.STORAGE_KEYS.CATEGORIES, () => this.readCategoriesWithDefault());
    } catch (error) {
      throw this.handleStorageError(error);
    }
  }

  /** The stored Categories, writing the default Category first when it is absent. Caller holds CATEGORIES. */
  private async readCategoriesWithDefault(): Promise<Category[]> {
    const categories = (await this.getStorageData<Category[]>(this.STORAGE_KEYS.CATEGORIES)) ?? [];
    if (categories.some(c => c.name === DEFAULT_CATEGORY)) {
      return categories;
    }
    const withDefault: Category[] = [{ id: uuidv4(), name: DEFAULT_CATEGORY }, ...categories];
    await this.setStorageData(this.STORAGE_KEYS.CATEGORIES, withDefault);
    return withDefault;
  }

  async updateCategory(id: string, updates: Partial<Omit<Category, 'id'>>): Promise<Category> {
    // Lock CATEGORIES first (always modified), then PROMPTS if name changes
    return this.mutex.withLock(this.STORAGE_KEYS.CATEGORIES, async () => {
      try {
        const existingCategories = await this.readCategoriesWithDefault();
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
        const existingCategories = await this.readCategoriesWithDefault();
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
   * refuses, shortens or drops a Prompt, including a malformed one or one already over the
   * limits, and never trims Prompt text; it trims the labels that Admission trims (Category
   * names, a Prompt's category, the default Category). The only Categories it drops are later
   * ones whose name becomes the same as an earlier one's once cleaned, and ones whose name
   * becomes empty; every Prompt, and the default Category, that named a dropped Category is
   * re-pointed to the kept one (the default Category for an emptied name) in the same write. It
   * writes nothing when there is nothing to clean, and every key that changed in one atomic
   * write. Safe to run any number of times.
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

  /**
   * Clear All Data: empties chrome.storage under every lock, in the documented order, so a locked
   * write from another context lands either before the clear (and is cleared) or after it (on an
   * empty store), never in the middle of it.
   */
  clearAllData(): Promise<void> {
    return this.mutex.withLock(this.STORAGE_KEYS.CATEGORIES, () =>
      this.mutex.withLock(this.STORAGE_KEYS.PROMPTS, () =>
        this.mutex.withLock(this.STORAGE_KEYS.SETTINGS, async () => {
          try {
            await chrome.storage.local.clear();
          } catch (error) {
            throw this.handleStorageError(error);
          }
        })
      )
    );
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
   * HARD LIMIT: refuse a write that takes the Prompts past MAX_TOTAL_SIZE, in the bytes Chrome will store
   *
   * @param prompts The Prompts as they will be written
   * @throws StorageError if they would pass the cap
   */
  private checkLibraryCap(prompts: StoredPrompt[]): void {
    const totalSize = storedSize(prompts);
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
}

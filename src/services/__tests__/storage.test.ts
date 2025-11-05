import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Prompt, Category, DEFAULT_CATEGORY } from '../../types';
import { StorageManager } from '../storage';

const FIXED_TIME = new Date('2025-01-01T00:00:00Z');

const buildPrompt = (overrides: Partial<Prompt> = {}): Prompt => {
  const timestamp = FIXED_TIME.getTime();
  const createdAt = overrides.createdAt ?? timestamp;
  const updatedAt = overrides.updatedAt ?? createdAt;
  const usageCount = overrides.usageCount ?? 0;
  const lastUsedAt = overrides.lastUsedAt ?? (usageCount > 0 ? updatedAt : createdAt);

  return {
    id: overrides.id ?? 'prompt-id',
    title: overrides.title ?? 'Sample Prompt',
    content: overrides.content ?? 'Sample content',
    category: overrides.category ?? DEFAULT_CATEGORY,
    createdAt,
    updatedAt,
    usageCount,
    lastUsedAt
  };
};
describe('StorageManager', () => {
  let storageManager: StorageManager;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME);
    storageManager = StorageManager.getInstance();

    // Initialize storage with default data using the real chrome.storage API
    await chrome.storage.local.set({
      prompts: [],
      categories: [{ id: 'default', name: DEFAULT_CATEGORY }],
      settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Prompt Operations', () => {
    it('should save a new prompt', async () => {
      const promptData = {
        title: 'Test Prompt',
        content: 'Test content',
        category: DEFAULT_CATEGORY
      };

      const savedPrompt = await storageManager.savePrompt(promptData);

      expect(savedPrompt).toMatchObject(promptData);
      expect(savedPrompt.id).toBeDefined();
      expect(savedPrompt.createdAt).toBeDefined();
      expect(savedPrompt.updatedAt).toBeDefined();
      expect(savedPrompt.usageCount).toBe(0);
      expect(savedPrompt.lastUsedAt).toBe(savedPrompt.createdAt);

      // Verify using chrome.storage API
      const result = await chrome.storage.local.get('prompts');
      const prompts = result.prompts as Prompt[];
      expect(prompts).toContainEqual(savedPrompt);
    });

    it('should get all prompts', async () => {
      const prompt1 = buildPrompt({
        id: '1',
        title: 'Prompt 1',
        content: 'Content 1'
      });
      await chrome.storage.local.set({ prompts: [prompt1] });

      const prompts = await storageManager.getPrompts();

      expect(prompts).toEqual([prompt1]);
    });

    it('should update an existing prompt', async () => {
      const originalPrompt = buildPrompt({
        id: '1',
        title: 'Original Title',
        content: 'Original Content',
        createdAt: FIXED_TIME.getTime() - 2000,
        updatedAt: FIXED_TIME.getTime() - 2000,
        lastUsedAt: FIXED_TIME.getTime() - 2000
      });
      await chrome.storage.local.set({ prompts: [originalPrompt] });

      const updates = { title: 'Updated Title', content: 'Updated Content' };
      const updatedPrompt = await storageManager.updatePrompt('1', updates);

      expect(updatedPrompt.title).toBe('Updated Title');
      expect(updatedPrompt.content).toBe('Updated Content');
      expect(updatedPrompt.updatedAt).toBeGreaterThan(originalPrompt.updatedAt);

      // Verify using chrome.storage API
      const result = await chrome.storage.local.get('prompts');
      const prompts = result.prompts as Prompt[];
      expect(prompts[0]).toEqual(updatedPrompt);
    });

    it('should throw error when updating non-existent prompt', async () => {
      await chrome.storage.local.set({ prompts: [] });

      await expect(storageManager.updatePrompt('nonexistent', { title: 'New Title' }))
        .rejects.toThrow('Prompt with id nonexistent not found');
    });

    it('should delete a prompt', async () => {
      const prompt = buildPrompt({
        id: '1',
        title: 'To Delete',
        content: 'Content'
      });
      await chrome.storage.local.set({ prompts: [prompt] });

      await storageManager.deletePrompt('1');

      // Verify using chrome.storage API
      const result = await chrome.storage.local.get('prompts');
      const prompts = result.prompts as Prompt[];
      expect(prompts).toEqual([]);
    });

    it('should throw error when deleting non-existent prompt', async () => {
      await chrome.storage.local.set({ prompts: [] });

      await expect(storageManager.deletePrompt('nonexistent'))
        .rejects.toThrow('Prompt with id nonexistent not found');
    });

    it('should increment usage count and update lastUsedAt', async () => {
      const initialLastUsed = FIXED_TIME.getTime() - 5000;
      const prompt = buildPrompt({ id: 'usage-test', usageCount: 2, lastUsedAt: initialLastUsed });
      await chrome.storage.local.set({ prompts: [prompt] });

      const updatedPrompt = await storageManager.incrementUsageCount('usage-test');

      expect(updatedPrompt.usageCount).toBe(3);
      expect(updatedPrompt.lastUsedAt).toBeGreaterThanOrEqual(initialLastUsed);

      // Verify using chrome.storage API
      const result = await chrome.storage.local.get('prompts');
      const prompts = result.prompts as Prompt[];
      expect(prompts[0].usageCount).toBe(3);
      expect(prompts[0].lastUsedAt).toBe(updatedPrompt.lastUsedAt);
    });
  });

  describe('Category Operations', () => {
    it('should save a new category', async () => {
      const categoryData = {
        name: 'Test Category',
        color: '#FF0000'
      };

      const savedCategory = await storageManager.saveCategory(categoryData);

      expect(savedCategory).toMatchObject(categoryData);
      expect(savedCategory.id).toBeDefined();

      // Verify using chrome.storage API
      const result = await chrome.storage.local.get('categories');
      const categories = result.categories as Category[];
      expect(categories).toContainEqual(savedCategory);
    });

    it('should prevent duplicate category names', async () => {
      const existingCategory: Category = {
        id: '1',
        name: 'Existing Category'
      };
      await chrome.storage.local.set({ categories: [existingCategory] });

      await expect(storageManager.saveCategory({ name: 'Existing Category' }))
        .rejects.toThrow('Category with name "Existing Category" already exists');
    });

    it('should get all categories with default category', async () => {
      const categories = await storageManager.getCategories();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe(DEFAULT_CATEGORY);
    });

    it('should update a category', async () => {
      const category: Category = {
        id: '1',
        name: 'Original Name',
        color: '#FF0000'
      };
      await chrome.storage.local.set({ categories: [category] });

      const updatedCategory = await storageManager.updateCategory('1', {
        name: 'Updated Name',
        color: '#00FF00'
      });

      expect(updatedCategory.name).toBe('Updated Name');
      expect(updatedCategory.color).toBe('#00FF00');
    });

    it('should delete category and update affected prompts', async () => {
      const categoryToDelete: Category = {
        id: 'cat1',
        name: 'Category To Delete'
      };
      const defaultCategory: Category = {
        id: 'default',
        name: DEFAULT_CATEGORY
      };
      await chrome.storage.local.set({ categories: [defaultCategory, categoryToDelete] });

      const affectedPrompt: Prompt = {
        id: 'prompt1',
        title: 'Affected Prompt',
        content: 'Content',
        category: 'Category To Delete',
        createdAt: FIXED_TIME.getTime(),
        updatedAt: FIXED_TIME.getTime()
      };
      await chrome.storage.local.set({ prompts: [affectedPrompt] });

      await storageManager.deleteCategory('cat1');

      // Verify using chrome.storage API
      const result = await chrome.storage.local.get(['categories', 'prompts']);
      const categories = result.categories as Category[];
      const prompts = result.prompts as Prompt[];
      expect(categories).not.toContainEqual(categoryToDelete);
      expect(prompts[0].category).toBe(DEFAULT_CATEGORY);
    });

    it('should prevent deletion of default category', async () => {
      const defaultCategory: Category = {
        id: 'default',
        name: DEFAULT_CATEGORY
      };
      await chrome.storage.local.set({ categories: [defaultCategory] });

      await expect(storageManager.deleteCategory('default'))
        .rejects.toThrow('Cannot delete the default category');
    });
  });

  describe('Race Condition Prevention', () => {
    it('should handle concurrent prompt saves without corruption', async () => {
      const promptData1 = {
        title: 'Prompt 1',
        content: 'Content 1',
        category: DEFAULT_CATEGORY
      };
      const promptData2 = {
        title: 'Prompt 2',
        content: 'Content 2',
        category: DEFAULT_CATEGORY
      };

      // Simulate concurrent saves
      const [savedPrompt1, savedPrompt2] = await Promise.all([
        storageManager.savePrompt(promptData1),
        storageManager.savePrompt(promptData2)
      ]);

      expect(savedPrompt1.id).not.toBe(savedPrompt2.id);

      // Verify using chrome.storage API
      const result = await chrome.storage.local.get('prompts');
      const prompts = result.prompts as Prompt[];
      expect(prompts).toHaveLength(2);
      expect(prompts).toContainEqual(savedPrompt1);
      expect(prompts).toContainEqual(savedPrompt2);
    });

    it('should handle concurrent updates to different prompts', async () => {
      const prompt1: Prompt = {
        id: '1',
        title: 'Prompt 1',
        content: 'Content 1',
        category: DEFAULT_CATEGORY,
        createdAt: FIXED_TIME.getTime(),
        updatedAt: FIXED_TIME.getTime()
      };
      const prompt2: Prompt = {
        id: '2',
        title: 'Prompt 2',
        content: 'Content 2',
        category: DEFAULT_CATEGORY,
        createdAt: FIXED_TIME.getTime(),
        updatedAt: FIXED_TIME.getTime()
      };
      await chrome.storage.local.set({ prompts: [prompt1, prompt2] });

      const [updated1, updated2] = await Promise.all([
        storageManager.updatePrompt('1', { title: 'Updated 1' }),
        storageManager.updatePrompt('2', { title: 'Updated 2' })
      ]);

      expect(updated1.title).toBe('Updated 1');
      expect(updated2.title).toBe('Updated 2');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage quota exceeded error', async () => {
      vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(
        new Error('QUOTA_EXCEEDED: Storage quota exceeded')
      );

      await expect(storageManager.savePrompt({
        title: 'Test',
        content: 'Test',
        category: DEFAULT_CATEGORY
      })).rejects.toMatchObject({
        type: 'STORAGE_QUOTA_EXCEEDED',
        message: 'Storage quota exceeded. Please delete some prompts to free up space.'
      });
    });

    it('should handle storage API unavailable error', async () => {
      vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(
        new Error('storage API unavailable')
      );

      await expect(storageManager.getPrompts()).rejects.toMatchObject({
        type: 'STORAGE_UNAVAILABLE',
        message: 'Storage API is unavailable. Please try again later.'
      });
    });

    it('should handle data corruption error', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValueOnce({
        prompts: null // Invalid data should return empty array
      });

      const data = await storageManager.getPrompts();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toEqual([]);
    });
  });

  describe('Utility Methods', () => {
    it('should get all data', async () => {
      const allData = await storageManager.getAllData();

      expect(allData).toHaveProperty('prompts');
      expect(allData).toHaveProperty('categories');
      expect(allData).toHaveProperty('settings');
    });

    it('should get storage usage', async () => {
      const usage = await storageManager.getStorageUsage();

      expect(usage).toHaveProperty('used');
      expect(usage).toHaveProperty('total');
      expect(usage.total).toBe(chrome.storage.local.QUOTA_BYTES);
    });

    it('should export data as JSON', async () => {
      const exportedData = await storageManager.exportData();
      const parsedData = JSON.parse(exportedData) as Record<string, unknown>;

      expect(parsedData).toHaveProperty('prompts');
      expect(parsedData).toHaveProperty('categories');
      expect(parsedData).toHaveProperty('settings');
    });

    it('should import valid data', async () => {
      const importData = {
        prompts: [],
        categories: [{ id: '1', name: DEFAULT_CATEGORY }],
        settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
      };

      await storageManager.importData(JSON.stringify(importData));

       
      expect(chrome.storage.local.clear).toHaveBeenCalled();
       
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ prompts: importData.prompts });
    });

    it('should reject invalid import data', async () => {
      const invalidData = JSON.stringify({ invalid: 'data' });

      await expect(storageManager.importData(invalidData))
        .rejects.toThrow('Invalid data format');
    });
  });

  describe('Import Rollback Scenarios', () => {
    it('should rollback to backup if import fails', async () => {
      // Setup: Create initial data
      const timestamp = FIXED_TIME.getTime();
      const initialPrompts: Prompt[] = [{
        id: '1',
        title: 'Original Prompt',
        content: 'Original Content',
        category: DEFAULT_CATEGORY,
        createdAt: timestamp,
        updatedAt: timestamp,
        usageCount: 0,
        lastUsedAt: timestamp
      }];
      await chrome.storage.local.set({ prompts: initialPrompts });

      // Mock: Track calls and fail on the first import write
      let setCallCount = 0;
      const originalSetImpl = vi.mocked(chrome.storage.local.set).getMockImplementation();

      vi.mocked(chrome.storage.local.set).mockImplementation((items: Record<string, unknown>) => {
        setCallCount++;
        // First call is prompts import - make it fail
        if (setCallCount === 1) {
          return Promise.reject(new Error('Quota exceeded'));
        }
        // All other calls (rollback) should succeed using the original implementation
        return originalSetImpl ? originalSetImpl(items) : Promise.resolve();
      });

      const importData = {
        prompts: [{
          id: '2',
          title: 'New Prompt',
          content: 'New Content',
          category: DEFAULT_CATEGORY,
          createdAt: FIXED_TIME.getTime(),
          updatedAt: FIXED_TIME.getTime()
        }],
        categories: [{ id: '1', name: DEFAULT_CATEGORY }],
        settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
      };

      // Verify: Import fails and data is rolled back
      await expect(
        storageManager.importData(JSON.stringify(importData))
      ).rejects.toThrow('Quota exceeded');

      // Verify: Original prompts are restored
      const finalPrompts = await storageManager.getPrompts();
      expect(finalPrompts).toEqual(initialPrompts);
    });

    it('should report partial rollback failures with detailed error', async () => {
      // Setup: Create initial data
      const timestamp = FIXED_TIME.getTime();
      const initialPrompts: Prompt[] = [{
        id: '1',
        title: 'Original Prompt',
        content: 'Original Content',
        category: DEFAULT_CATEGORY,
        createdAt: timestamp,
        updatedAt: timestamp,
        usageCount: 0,
        lastUsedAt: timestamp
      }];
      await chrome.storage.local.set({ prompts: initialPrompts });

      // Track which phase we're in: import or rollback
      let importPhase = true;
      const originalSetImpl = vi.mocked(chrome.storage.local.set).getMockImplementation();

      vi.mocked(chrome.storage.local.set).mockImplementation((items: Record<string, unknown>) => {
        const keys = Object.keys(items);
        const key = keys[0];

        // During import phase, fail categories
        if (importPhase && key === 'categories') {
          importPhase = false; // Switch to rollback phase
          return Promise.reject(new Error('Import quota exceeded'));
        }

        // During rollback phase, fail categories
        if (!importPhase && key === 'categories') {
          return Promise.reject(new Error('Rollback quota exceeded'));
        }

        // All other calls succeed using the original implementation
        return originalSetImpl ? originalSetImpl(items) : Promise.resolve();
      });

      const importData = {
        prompts: [{
          id: '2',
          title: 'New Prompt',
          content: 'New Content',
          category: DEFAULT_CATEGORY,
          createdAt: FIXED_TIME.getTime(),
          updatedAt: FIXED_TIME.getTime()
        }],
        categories: [{ id: '1', name: DEFAULT_CATEGORY }],
        settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
      };

      let capturedError: Error | null = null;

      // Verify: Import fails with detailed rollback error
      await expect(async () => {
        try {
          await storageManager.importData(JSON.stringify(importData));
        } catch (error) {
          capturedError = error as Error;
          throw error;
        }
      }).rejects.toThrow(/rollback partially failed.*1\/3 operations failed/);

      expect(capturedError).toBeInstanceOf(Error);
      // Type assertion: after toBeInstanceOf check, we know it's an Error
      const errorMessage = (capturedError as unknown as Error).message;
      expect(errorMessage).toContain('categories: Rollback quota exceeded');
      expect(errorMessage).toContain('Original error: Import quota exceeded');
    });

    it('should successfully rollback all data when all operations succeed', async () => {
      // Setup: Create complete initial data
      const timestamp = FIXED_TIME.getTime();
      const initialPrompts: Prompt[] = [{
        id: '1',
        title: 'Original Prompt',
        content: 'Original Content',
        category: DEFAULT_CATEGORY,
        createdAt: timestamp,
        updatedAt: timestamp,
        usageCount: 0,
        lastUsedAt: timestamp
      }];
      const initialCategories: Category[] = [
        { id: 'cat1', name: 'Work' },
        { id: 'default', name: DEFAULT_CATEGORY }
      ];
      const initialSettings = { defaultCategory: 'Work', sortOrder: 'createdAt' };

      await chrome.storage.local.set({
        prompts: initialPrompts,
        categories: initialCategories,
        settings: initialSettings
      });

      // Mock: Make import fail but rollback succeed
      let setCallCount = 0;
      const originalSetImpl = vi.mocked(chrome.storage.local.set).getMockImplementation();

      vi.mocked(chrome.storage.local.set).mockImplementation((items: Record<string, unknown>) => {
        setCallCount++;
        // First import write fails
        if (setCallCount === 1) {
          return Promise.reject(new Error('Import failed'));
        }
        // All rollback operations succeed using the original implementation
        return originalSetImpl ? originalSetImpl(items) : Promise.resolve();
      });

      const importData = {
        prompts: [{ id: '2', title: 'New', content: 'New', category: DEFAULT_CATEGORY, createdAt: FIXED_TIME.getTime(), updatedAt: FIXED_TIME.getTime() }],
        categories: [{ id: '1', name: DEFAULT_CATEGORY }],
        settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
      };

      // Verify: Import fails with original error (not rollback error)
      await expect(
        storageManager.importData(JSON.stringify(importData))
      ).rejects.toThrow('Import failed');

      // Verify: All original data is restored
      const result = await chrome.storage.local.get(['prompts', 'categories', 'settings']);
      const prompts = result.prompts as Prompt[];
      const categories = result.categories as Category[];
      const settings = result.settings as Record<string, unknown>;
      expect(prompts).toEqual(initialPrompts);
      expect(categories).toEqual(expect.arrayContaining(initialCategories));
      expect(settings).toEqual(initialSettings);
    });

    it('should attempt all rollback operations even if first one fails', async () => {
      // Setup initial data
      const timestamp = FIXED_TIME.getTime();
      const initialPrompts: Prompt[] = [{
        id: '1',
        title: 'Original',
        content: 'Content',
        category: DEFAULT_CATEGORY,
        createdAt: timestamp,
        updatedAt: timestamp,
        usageCount: 0,
        lastUsedAt: timestamp
      }];
      const initialCategories: Category[] = [{ id: 'cat1', name: 'Work' }];
      const initialSettings = { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' };

      await chrome.storage.local.set({
        prompts: initialPrompts,
        categories: initialCategories,
        settings: initialSettings
      });

      // Track which phase we're in: import or rollback
      let importPhase = true;
      const originalSetImpl = vi.mocked(chrome.storage.local.set).getMockImplementation();

      vi.mocked(chrome.storage.local.set).mockImplementation((items: Record<string, unknown>) => {
        const keys = Object.keys(items);
        const key = keys[0];

        // During import phase, fail categories
        if (importPhase && key === 'categories') {
          importPhase = false; // Switch to rollback phase
          return Promise.reject(new Error('Import failed'));
        }

        // During rollback phase, fail prompts
        if (!importPhase && key === 'prompts') {
          return Promise.reject(new Error('Prompts restore failed'));
        }

        // All other calls succeed using the original implementation
        return originalSetImpl ? originalSetImpl(items) : Promise.resolve();
      });

      const importData = {
        prompts: [],
        categories: [{ id: '1', name: DEFAULT_CATEGORY }],
        settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
      };

      // Verify: Import fails
      await expect(
        storageManager.importData(JSON.stringify(importData))
      ).rejects.toThrow();

      // Verify: Data that could be restored was restored
      const result = await chrome.storage.local.get(['prompts', 'categories', 'settings']);
      const prompts = result.prompts as Prompt[];
      const categories = result.categories as Category[];
      const settings = result.settings as Record<string, unknown>;
      expect(prompts).toEqual(initialPrompts);
      expect(categories).toEqual(expect.arrayContaining(initialCategories));
      expect(settings).toEqual(initialSettings);
    });
  });
});

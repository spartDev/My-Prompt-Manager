import { describe, it, expect, vi, beforeEach } from 'vitest';

import { Prompt, Category, DEFAULT_CATEGORY } from '../../types';
import { StorageManager } from '../storage';

interface MockStorage {
  prompts: Prompt[];
  categories: Category[];
  settings: {
    defaultCategory: string;
    sortOrder: string;
  };
  [key: string]: unknown;
}

describe('StorageManager', () => {
  let storageManager: StorageManager;
  let mockStorage: MockStorage;

  beforeEach(() => {
    storageManager = StorageManager.getInstance();
    mockStorage = {
      prompts: [],
      categories: [{ id: 'default', name: DEFAULT_CATEGORY }],
      settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
    };

    // Mock chrome storage API
     
    vi.mocked(chrome.storage.local.get).mockImplementation((keys) => {
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        keys.forEach(key => {

          result[key] = mockStorage[key] || null;
        });
        return Promise.resolve(result);
      }
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: mockStorage[keys] });
      }
      // Handle null/undefined case - return all data
      return Promise.resolve(mockStorage);
    });

     
    vi.mocked(chrome.storage.local.set).mockImplementation((data) => {
      Object.assign(mockStorage, data);
      return Promise.resolve();
    });

     
    vi.mocked(chrome.storage.local.clear).mockImplementation(() => {
      Object.keys(mockStorage).forEach(key => {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete mockStorage[key];
      });
      return Promise.resolve();
    });

     
    vi.mocked(chrome.storage.local.getBytesInUse).mockImplementation(() => Promise.resolve(1024));
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
      expect(mockStorage.prompts).toContain(savedPrompt);
    });

    it('should get all prompts', async () => {
      const prompt1: Prompt = {
        id: '1',
        title: 'Prompt 1',
        content: 'Content 1',
        category: DEFAULT_CATEGORY,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      mockStorage.prompts = [prompt1];

      const prompts = await storageManager.getPrompts();

      expect(prompts).toEqual([prompt1]);
    });

    it('should update an existing prompt', async () => {
      const originalPrompt: Prompt = {
        id: '1',
        title: 'Original Title',
        content: 'Original Content',
        category: DEFAULT_CATEGORY,
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000
      };
      mockStorage.prompts = [originalPrompt];

      const updates = { title: 'Updated Title', content: 'Updated Content' };
      const updatedPrompt = await storageManager.updatePrompt('1', updates);

      expect(updatedPrompt.title).toBe('Updated Title');
      expect(updatedPrompt.content).toBe('Updated Content');
      expect(updatedPrompt.updatedAt).toBeGreaterThan(originalPrompt.updatedAt);
      expect(mockStorage.prompts[0]).toEqual(updatedPrompt);
    });

    it('should throw error when updating non-existent prompt', async () => {
      mockStorage.prompts = [];

      await expect(storageManager.updatePrompt('nonexistent', { title: 'New Title' }))
        .rejects.toThrow('Prompt with id nonexistent not found');
    });

    it('should delete a prompt', async () => {
      const prompt: Prompt = {
        id: '1',
        title: 'To Delete',
        content: 'Content',
        category: DEFAULT_CATEGORY,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      mockStorage.prompts = [prompt];

      await storageManager.deletePrompt('1');

      expect(mockStorage.prompts).toEqual([]);
    });

    it('should throw error when deleting non-existent prompt', async () => {
      mockStorage.prompts = [];

      await expect(storageManager.deletePrompt('nonexistent'))
        .rejects.toThrow('Prompt with id nonexistent not found');
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
      expect(mockStorage.categories).toContainEqual(savedCategory);
    });

    it('should prevent duplicate category names', async () => {
      const existingCategory: Category = {
        id: '1',
        name: 'Existing Category'
      };
      mockStorage.categories = [existingCategory];

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
      mockStorage.categories = [category];

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
      mockStorage.categories = [defaultCategory, categoryToDelete];

      const affectedPrompt: Prompt = {
        id: 'prompt1',
        title: 'Affected Prompt',
        content: 'Content',
        category: 'Category To Delete',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      mockStorage.prompts = [affectedPrompt];

      await storageManager.deleteCategory('cat1');

      expect(mockStorage.categories).not.toContainEqual(categoryToDelete);
      expect(mockStorage.prompts[0].category).toBe(DEFAULT_CATEGORY);
    });

    it('should prevent deletion of default category', async () => {
      const defaultCategory: Category = {
        id: 'default',
        name: DEFAULT_CATEGORY
      };
      mockStorage.categories = [defaultCategory];

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
      expect(mockStorage.prompts).toHaveLength(2);
      expect(mockStorage.prompts).toContainEqual(savedPrompt1);
      expect(mockStorage.prompts).toContainEqual(savedPrompt2);
    });

    it('should handle concurrent updates to different prompts', async () => {
      const prompt1: Prompt = {
        id: '1',
        title: 'Prompt 1',
        content: 'Content 1',
        category: DEFAULT_CATEGORY,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const prompt2: Prompt = {
        id: '2',
        title: 'Prompt 2',
        content: 'Content 2',
        category: DEFAULT_CATEGORY,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      mockStorage.prompts = [prompt1, prompt2];

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
       
      vi.mocked(chrome.storage.local.set).mockRejectedValue(
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
       
      vi.mocked(chrome.storage.local.get).mockRejectedValue(
        new Error('storage API unavailable')
      );

      await expect(storageManager.getPrompts()).rejects.toMatchObject({
        type: 'STORAGE_UNAVAILABLE',
        message: 'Storage API is unavailable. Please try again later.'
      });
    });

    it('should handle data corruption error', async () => {
       
      vi.mocked(chrome.storage.local.get).mockImplementation(() => Promise.resolve({
        prompts: null // Invalid data should return empty array
      }));

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
      const initialPrompts: Prompt[] = [{
        id: '1',
        title: 'Original Prompt',
        content: 'Original Content',
        category: DEFAULT_CATEGORY,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
      mockStorage.prompts = initialPrompts;

      // Mock: Make the import write fail after clearing
      let callCount = 0;
      vi.mocked(chrome.storage.local.set).mockImplementation((data) => {
        callCount++;
        // First call is clear (removing prompts), second call is the first write attempt
        if (callCount === 2) {
          return Promise.reject(new Error('Quota exceeded'));
        }
        Object.assign(mockStorage, data);
        return Promise.resolve();
      });

      const importData = {
        prompts: [{
          id: '2',
          title: 'New Prompt',
          content: 'New Content',
          category: DEFAULT_CATEGORY,
          createdAt: Date.now(),
          updatedAt: Date.now()
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
      const initialPrompts: Prompt[] = [{
        id: '1',
        title: 'Original Prompt',
        content: 'Original Content',
        category: DEFAULT_CATEGORY,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
      mockStorage.prompts = initialPrompts;

      // Mock: Make import fail AND make rollback partially fail
      let callCount = 0;
      vi.mocked(chrome.storage.local.set).mockImplementation((data) => {
        callCount++;

        // Import phase: second call fails (after clear)
        if (callCount === 2) {
          return Promise.reject(new Error('Import quota exceeded'));
        }

        // Rollback phase: fail the categories restore (4th call)
        // Call order: 1=prompts write, 2=fails, 3=prompts restore, 4=categories restore, 5=settings restore
        if (callCount === 4) {
          return Promise.reject(new Error('Rollback quota exceeded'));
        }

        Object.assign(mockStorage, data);
        return Promise.resolve();
      });

      const importData = {
        prompts: [{
          id: '2',
          title: 'New Prompt',
          content: 'New Content',
          category: DEFAULT_CATEGORY,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        categories: [{ id: '1', name: DEFAULT_CATEGORY }],
        settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
      };

      // Verify: Import fails with detailed rollback error
      await expect(
        storageManager.importData(JSON.stringify(importData))
      ).rejects.toThrow(/rollback partially failed.*1\/3 operations failed/);

      // Verify error message contains specific failure details
      try {
        await storageManager.importData(JSON.stringify(importData));
      } catch (error) {
        expect((error as Error).message).toContain('categories: Rollback quota exceeded');
        expect((error as Error).message).toContain('Original error: Import quota exceeded');
      }
    });

    it('should successfully rollback all data when all operations succeed', async () => {
      // Setup: Create complete initial data
      const initialPrompts: Prompt[] = [{
        id: '1',
        title: 'Original Prompt',
        content: 'Original Content',
        category: DEFAULT_CATEGORY,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }];
      const initialCategories: Category[] = [
        { id: 'cat1', name: 'Work' },
        { id: 'default', name: DEFAULT_CATEGORY }
      ];
      const initialSettings = { defaultCategory: 'Work', sortOrder: 'createdAt' };

      mockStorage.prompts = initialPrompts;
      mockStorage.categories = initialCategories;
      mockStorage.settings = initialSettings;

      // Mock: Make import fail but rollback succeed
      let callCount = 0;
      vi.mocked(chrome.storage.local.set).mockImplementation((data) => {
        callCount++;

        // Import phase: second call fails (after clear)
        if (callCount === 2) {
          return Promise.reject(new Error('Import failed'));
        }

        // All rollback operations succeed
        Object.assign(mockStorage, data);
        return Promise.resolve();
      });

      const importData = {
        prompts: [{ id: '2', title: 'New', content: 'New', category: DEFAULT_CATEGORY, createdAt: Date.now(), updatedAt: Date.now() }],
        categories: [{ id: '1', name: DEFAULT_CATEGORY }],
        settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
      };

      // Verify: Import fails with original error (not rollback error)
      await expect(
        storageManager.importData(JSON.stringify(importData))
      ).rejects.toThrow('Import failed');

      // Verify: All original data is restored
      expect(mockStorage.prompts).toEqual(initialPrompts);
      expect(mockStorage.categories).toEqual(initialCategories);
      expect(mockStorage.settings).toEqual(initialSettings);
    });

    it('should attempt all rollback operations even if first one fails', async () => {
      // Setup initial data
      mockStorage.prompts = [{ id: '1', title: 'Original', content: 'Content', category: DEFAULT_CATEGORY, createdAt: Date.now(), updatedAt: Date.now() }];
      mockStorage.categories = [{ id: 'cat1', name: 'Work' }];
      mockStorage.settings = { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' };

      // Track which restore operations were attempted during rollback phase
      const rollbackAttempts = new Set<string>();
      let isInRollbackPhase = false;

      let callCount = 0;
      vi.mocked(chrome.storage.local.set).mockImplementation((data) => {
        callCount++;

        // Import fails (second call after clear)
        if (callCount === 2) {
          isInRollbackPhase = true;
          return Promise.reject(new Error('Import failed'));
        }

        // Track rollback attempts (after import failure)
        if (isInRollbackPhase && callCount >= 3) {
          const keys = Object.keys(data);
          keys.forEach(key => rollbackAttempts.add(key));

          // Fail the first rollback operation (prompts)
          if (callCount === 3) {
            return Promise.reject(new Error('Prompts restore failed'));
          }
        }

        Object.assign(mockStorage, data);
        return Promise.resolve();
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

      // Verify: ALL three restore operations were attempted (not just the first)
      // With Promise.allSettled, even though prompts failed, categories and settings should still be attempted
      expect(rollbackAttempts.has('prompts')).toBe(true);
      expect(rollbackAttempts.has('categories')).toBe(true);
      expect(rollbackAttempts.has('settings')).toBe(true);
      expect(rollbackAttempts.size).toBe(3);
    });
  });
});
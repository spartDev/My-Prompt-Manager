import { describe, it, expect, vi, beforeEach } from 'vitest';

import { StorageManager } from '../../services/storage';
import { DEFAULT_CATEGORY, VALIDATION_LIMITS, ErrorType } from '../../types';

interface MockStorage {
  prompts: any[];
  categories: any[];
  settings: any;
  [key: string]: unknown;
}

describe('Comprehensive Test Suite', () => {
  let storageManager: StorageManager;
  let mockStorage: MockStorage;

  beforeEach(() => {
    storageManager = StorageManager.getInstance();
    mockStorage = {
      prompts: [],
      categories: [{ id: 'default', name: DEFAULT_CATEGORY }],
      settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
    };

     
    vi.mocked(chrome.storage.local.get).mockImplementation((keys) => {
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        keys.forEach(key => {
           
          result[key] = mockStorage[key] || null;
        });
        return Promise.resolve(result);
      }
       
      return Promise.resolve({ [keys as string]: mockStorage[keys as string] || null });
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

     
    vi.mocked(chrome.storage.local.getBytesInUse).mockResolvedValue(1024);
  });

  describe('Core Storage Operations', () => {
    it('should save and retrieve prompts', async () => {
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

      const prompts = await storageManager.getPrompts();
      expect(prompts).toContain(savedPrompt);
    });

    it('should update prompts correctly', async () => {
      const promptData = {
        title: 'Original Title',
        content: 'Original Content',
        category: DEFAULT_CATEGORY
      };

      const savedPrompt = await storageManager.savePrompt(promptData);
      
      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updates = { title: 'Updated Title' };
      const updatedPrompt = await storageManager.updatePrompt(savedPrompt.id, updates);
      
      expect(updatedPrompt.title).toBe('Updated Title');
      expect(updatedPrompt.content).toBe('Original Content');
      expect(updatedPrompt.updatedAt).toBeGreaterThanOrEqual(savedPrompt.updatedAt);
    });

    it('should delete prompts correctly', async () => {
      const promptData = {
        title: 'To Delete',
        content: 'Content',
        category: DEFAULT_CATEGORY
      };

      const savedPrompt = await storageManager.savePrompt(promptData);
      await storageManager.deletePrompt(savedPrompt.id);
      
      const prompts = await storageManager.getPrompts();
      expect(prompts).not.toContain(savedPrompt);
    });

    it('should handle category operations', async () => {
      const categoryData = {
        name: 'Test Category',
        color: '#FF0000'
      };

      const savedCategory = await storageManager.saveCategory(categoryData);
      expect(savedCategory).toMatchObject(categoryData);
      expect(savedCategory.id).toBeDefined();

      const categories = await storageManager.getCategories();
      expect(categories).toContainEqual(savedCategory);
    });
  });

  describe('Data Integrity and Race Conditions', () => {
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

      const [savedPrompt1, savedPrompt2] = await Promise.all([
        storageManager.savePrompt(promptData1),
        storageManager.savePrompt(promptData2)
      ]);

      expect(savedPrompt1.id).not.toBe(savedPrompt2.id);
      
      const prompts = await storageManager.getPrompts();
      expect(prompts).toHaveLength(2);
      expect(prompts).toContainEqual(savedPrompt1);
      expect(prompts).toContainEqual(savedPrompt2);
    });

    it('should maintain data consistency during category deletion', async () => {
      // Create category
      const categoryData = { name: 'Test Category' };
      const savedCategory = await storageManager.saveCategory(categoryData);

      // Create prompt using that category
      const promptData = {
        title: 'Test Prompt',
        content: 'Test content',
        category: 'Test Category'
      };
      const savedPrompt = await storageManager.savePrompt(promptData);

      // Delete category
      await storageManager.deleteCategory(savedCategory.id);

      // Check that prompt was updated to use default category
      const prompts = await storageManager.getPrompts();
      const updatedPrompt = prompts.find(p => p.id === savedPrompt.id);
      expect(updatedPrompt?.category).toBe(DEFAULT_CATEGORY);

      // Check that category was removed
      const categories = await storageManager.getCategories();
      expect(categories.find(c => c.id === savedCategory.id)).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle storage quota exceeded errors', async () => {
       
      vi.mocked(chrome.storage.local.set).mockRejectedValue(
        new Error('QUOTA_EXCEEDED: Storage quota exceeded')
      );

      const promptData = {
        title: 'Test',
        content: 'Test',
        category: DEFAULT_CATEGORY
      };

      await expect(storageManager.savePrompt(promptData)).rejects.toMatchObject({
        type: ErrorType.STORAGE_QUOTA_EXCEEDED,
        message: 'Storage quota exceeded. Please delete some prompts to free up space.'
      });
    });

    it('should handle storage API unavailable errors', async () => {
       
      vi.mocked(chrome.storage.local.get).mockRejectedValue(
        new Error('storage API unavailable')
      );

      await expect(storageManager.getPrompts()).rejects.toMatchObject({
        type: ErrorType.STORAGE_UNAVAILABLE,
        message: 'Storage API is unavailable. Please try again later.'
      });
    });

    it('should prevent deletion of default category', async () => {
      const categories = await storageManager.getCategories();
      const defaultCategory = categories.find(c => c.name === DEFAULT_CATEGORY);
      
      if (defaultCategory) {
        await expect(storageManager.deleteCategory(defaultCategory.id))
          .rejects.toThrow('Cannot delete the default category');
      }
    });

    it('should handle non-existent prompt updates', async () => {
      await expect(storageManager.updatePrompt('nonexistent', { title: 'New Title' }))
        .rejects.toThrow('Prompt with id nonexistent not found');
    });
  });

  describe('Utility Operations', () => {
    it('should export and import data correctly', async () => {
      // Create some test data
      const promptData = {
        title: 'Export Test',
        content: 'Export content',
        category: DEFAULT_CATEGORY
      };
      await storageManager.savePrompt(promptData);

      // Export data
      const exportedData = await storageManager.exportData();
      const parsedData = JSON.parse(exportedData) as Record<string, unknown>;

      expect(parsedData).toHaveProperty('prompts');
      expect(parsedData).toHaveProperty('categories');
      expect(parsedData).toHaveProperty('settings');
       
      expect(parsedData.prompts).toHaveLength(1);

      // Clear and import
      await storageManager.clearAllData();
      await storageManager.importData(exportedData);

      // Verify import
      const prompts = await storageManager.getPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].title).toBe('Export Test');
    });

    it('should get storage usage information', async () => {
      const usage = await storageManager.getStorageUsage();
      
      expect(usage).toHaveProperty('used');
      expect(usage).toHaveProperty('total');
      expect(typeof usage.used).toBe('number');
      expect(typeof usage.total).toBe('number');
      expect(usage.total).toBe(chrome.storage.local.QUOTA_BYTES);
    });

    it('should get all data in one operation', async () => {
      const allData = await storageManager.getAllData();
      
      expect(allData).toHaveProperty('prompts');
      expect(allData).toHaveProperty('categories');
      expect(allData).toHaveProperty('settings');
      expect(Array.isArray(allData.prompts)).toBe(true);
      expect(Array.isArray(allData.categories)).toBe(true);
      expect(typeof allData.settings).toBe('object');
    });

    it('should reject invalid import data', async () => {
      const invalidData = JSON.stringify({ invalid: 'data' });
      
      await expect(storageManager.importData(invalidData))
        .rejects.toThrow('Invalid data format');
    });
  });

  describe('Validation and Constants', () => {
    it('should have correct validation limits', () => {
      expect(VALIDATION_LIMITS.PROMPT_TITLE_MAX).toBe(100);
      expect(VALIDATION_LIMITS.PROMPT_CONTENT_MAX).toBe(10000);
      expect(VALIDATION_LIMITS.CATEGORY_NAME_MAX).toBe(50);
      expect(VALIDATION_LIMITS.TITLE_GENERATION_LENGTH).toBe(50);
    });

    it('should have correct default values', () => {
      expect(DEFAULT_CATEGORY).toBe('Uncategorized');
    });

    it('should have all error types defined', () => {
      expect(ErrorType.STORAGE_QUOTA_EXCEEDED).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(ErrorType.STORAGE_UNAVAILABLE).toBe('STORAGE_UNAVAILABLE');
      expect(ErrorType.DATA_CORRUPTION).toBe('DATA_CORRUPTION');
      expect(ErrorType.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorType.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(ErrorType.EXTENSION_CONTEXT_LOST).toBe('EXTENSION_CONTEXT_LOST');
    });
  });
});

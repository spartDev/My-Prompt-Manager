import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getMockStorageManager, type StorageManagerMock } from '../../test/mocks';
import { DEFAULT_CATEGORY, VALIDATION_LIMITS } from '../../types';
import { PromptManager } from '../promptManager';

describe('PromptManager - Working Tests', () => {
  let promptManager: PromptManager;
  let storageManagerMock: StorageManagerMock;

  const mockCategories = [
    { id: '1', name: DEFAULT_CATEGORY },
    { id: '2', name: 'Test Category', color: '#FF0000' }
  ];

  const mockPrompts = [
    {
      id: '1',
      title: 'JavaScript Function',
      content: 'Create a JavaScript function that handles user input',
      category: 'Development',
      createdAt: Date.now() - 2000,
      updatedAt: Date.now() - 1000
    },
    {
      id: '2',
      title: 'Python Script',
      content: 'Write a Python script for data processing',
      category: 'Development',
      createdAt: Date.now() - 1000,
      updatedAt: Date.now()
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    storageManagerMock = getMockStorageManager();
    storageManagerMock.getCategories.mockResolvedValue(mockCategories);
    storageManagerMock.getPrompts.mockResolvedValue(mockPrompts);

    promptManager = PromptManager.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PromptManager.getInstance();
      const instance2 = PromptManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Validation Methods', () => {
    it('should validate empty content', () => {
      const error = promptManager.validatePromptData({
        title: 'Valid title',
        content: '',
        category: DEFAULT_CATEGORY
      });

      expect(error).toBeDefined();
      expect(error?.message).toBe('Prompt content cannot be empty');
      expect(error?.type).toBe('VALIDATION_ERROR');
    });

    it('should validate title length', () => {
      const longTitle = 'a'.repeat(VALIDATION_LIMITS.PROMPT_TITLE_MAX + 1);
      const error = promptManager.validatePromptData({
        title: longTitle,
        content: 'Valid content',
        category: DEFAULT_CATEGORY
      });

      expect(error).toBeDefined();
      expect(error?.message).toBe(`Title cannot exceed ${String(VALIDATION_LIMITS.PROMPT_TITLE_MAX)} characters`);
    });

    it('should validate content length', () => {
      const longContent = 'a'.repeat(VALIDATION_LIMITS.PROMPT_CONTENT_MAX + 1);
      const error = promptManager.validatePromptData({
        title: 'Valid title',
        content: longContent,
        category: DEFAULT_CATEGORY
      });

      expect(error).toBeDefined();
      expect(error?.message).toBe(`Content cannot exceed ${String(VALIDATION_LIMITS.PROMPT_CONTENT_MAX)} characters`);
    });

    it('should return null for valid data', () => {
      const error = promptManager.validatePromptData({
        title: 'Valid title',
        content: 'Valid content',
        category: DEFAULT_CATEGORY
      });

      expect(error).toBeNull();
    });

    it('should allow partial data validation', () => {
      const error = promptManager.validatePromptData({
        title: 'Valid title'
        // content and category are optional for updates
      });

      expect(error).toBeNull();
    });
  });

  describe('Title Generation', () => {
    it('should generate title from content', () => {
      const content = 'This is a long piece of content that should be truncated to create a title';
      const title = promptManager.generateTitle(content);

      expect(title.length).toBeLessThanOrEqual(VALIDATION_LIMITS.TITLE_GENERATION_LENGTH + 3); // +3 for "..."
      expect(title).toContain('This is a long piece of content');
    });

    it('should return content as title if short enough', () => {
      const content = 'Short content';
      const title = promptManager.generateTitle(content);

      expect(title).toBe(content);
    });

    it('should return default title for empty content', () => {
      const title1 = promptManager.generateTitle('');
      const title2 = promptManager.generateTitle('   ');

      expect(title1).toBe('Untitled Prompt');
      expect(title2).toBe('Untitled Prompt');
    });

    it('should trim whitespace from content', () => {
      const content = '   This has whitespace   ';
      const title = promptManager.generateTitle(content);

      expect(title).toBe('This has whitespace');
    });
  });

  describe('Search Functionality', () => {
    it('should search prompts by title', async () => {
      const results = await promptManager.searchPrompts('JavaScript');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Function');
    });

    it('should search prompts by content', async () => {
      const results = await promptManager.searchPrompts('data processing');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Python Script');
    });

    it('should perform case-insensitive search', async () => {
      const results = await promptManager.searchPrompts('JAVASCRIPT');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript Function');
    });

    it('should return all prompts for empty query', async () => {
      const results = await promptManager.searchPrompts('');

      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', async () => {
      const results = await promptManager.searchPrompts('nonexistent');

      expect(results).toHaveLength(0);
    });
  });

  describe('Filter Functionality', () => {
    it('should filter prompts by category', async () => {
      const results = await promptManager.filterByCategory('Development');

      expect(results).toHaveLength(2);
      expect(results.every(p => p.category === 'Development')).toBe(true);
    });

    it('should return all prompts when filtering by null category', async () => {
      const results = await promptManager.filterByCategory(null);

      expect(results).toHaveLength(2);
    });
  });

  describe('Prompt Creation', () => {
    it('should validate and prepare prompt data correctly', () => {
      // Test that the createPrompt method validates and prepares data
      const result = promptManager.validatePromptData({
        title: 'Test Title',
        content: 'Test Content',
        category: 'Test Category'
      });

      expect(result).toBeNull(); // Should be valid
    });

    it('should throw error for invalid category', async () => {
      // Mock categories without the requested category
       
      storageManagerMock.getCategories.mockResolvedValue([
        { id: '1', name: DEFAULT_CATEGORY }
      ]);

      await expect(promptManager.createPrompt('Title', 'Content', 'Nonexistent Category'))
        .rejects.toThrow('Category "Nonexistent Category" does not exist');
    });

    it('should throw validation error for invalid data', async () => {
      await expect(promptManager.createPrompt('', ''))
        .rejects.toMatchObject({
          type: 'VALIDATION_ERROR',
          message: 'Prompt content cannot be empty'
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', () => {
      // Test various validation scenarios
      const error1 = promptManager.validatePromptData({
        title: 'a'.repeat(VALIDATION_LIMITS.PROMPT_TITLE_MAX + 1),
        content: 'Valid content'
      });
      expect(error1).toBeDefined();
      expect(error1?.type).toBe('VALIDATION_ERROR');

      const error2 = promptManager.validatePromptData({
        title: 'Valid title',
        content: 'a'.repeat(VALIDATION_LIMITS.PROMPT_CONTENT_MAX + 1)
      });
      expect(error2).toBeDefined();
      expect(error2?.type).toBe('VALIDATION_ERROR');
    });

    it('should throw error when storage fails', async () => {
      storageManagerMock.getPrompts.mockRejectedValue(new Error('Storage error'));

      await expect(promptManager.searchPrompts('test'))
        .rejects.toThrow();
    });
  });

  describe('Advanced Features', () => {
    it('should filter by date range', async () => {
      const startDate = Date.now() - 3000;
      const endDate = Date.now();

      const results = await promptManager.getPromptsByDateRange(startDate, endDate);

      expect(results).toHaveLength(2);
    });

    it('should get prompt statistics', async () => {
      const stats = await promptManager.getPromptStatistics();

      expect(stats).toHaveProperty('totalPrompts');
      expect(stats).toHaveProperty('categoryCounts');
      expect(stats.totalPrompts).toBe(2);
      expect(stats.categoryCounts.Development).toBe(2);
    });
  });
});
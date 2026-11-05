import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getMockStorageManager, type StorageManagerMock } from '../../test/mocks';
import { DEFAULT_CATEGORY, VALIDATION_LIMITS } from '../../types';
import { PROMPT_LIMITS } from '../promptAdmission';
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
      expect(error?.message).toBe('Content is required');
      expect(error?.type).toBe('VALIDATION_ERROR');
    });

    it('should validate title length', () => {
      const longTitle = 'a'.repeat(PROMPT_LIMITS.title + 1);
      const error = promptManager.validatePromptData({
        title: longTitle,
        content: 'Valid content',
        category: DEFAULT_CATEGORY
      });

      expect(error).toBeDefined();
      expect(error?.message).toBe('Title cannot exceed 100 characters');
    });

    it('should validate content length', () => {
      const longContent = 'a'.repeat(PROMPT_LIMITS.content + 1);
      const error = promptManager.validatePromptData({
        title: 'Valid title',
        content: longContent,
        category: DEFAULT_CATEGORY
      });

      expect(error).toBeDefined();
      expect(error?.message).toBe('Content cannot exceed 20,000 characters');
    });

    // Admission is the only judge of Prompt text (ADR-001): Hidden characters are removed and
    // the title and category trimmed before the limits apply, exactly as they will be on save.
    it('accepts a title over the limit only because of Hidden characters or surrounding spaces', () => {
      const error = promptManager.validatePromptData({
        title: `  ${'t'.repeat(PROMPT_LIMITS.title)}\u{200B} `,
        content: 'Valid content',
        category: DEFAULT_CATEGORY
      });

      expect(error).toBeNull();
    });

    it('accepts content over the limit only because of Hidden characters', () => {
      const error = promptManager.validatePromptData({
        content: `${'x'.repeat(PROMPT_LIMITS.content)}\u{FEFF}`
      });

      expect(error).toBeNull();
    });

    it('accepts a category over the limit only because of Hidden characters or surrounding spaces', () => {
      const error = promptManager.validatePromptData({
        category: ` ${'c'.repeat(PROMPT_LIMITS.category)}\u{200B}`
      });

      expect(error).toBeNull();
    });

    it('refuses content that is only Hidden characters as empty', () => {
      const error = promptManager.validatePromptData({ content: '\u{200B}\u{FEFF}' });

      expect(error?.type).toBe('VALIDATION_ERROR');
      expect(error?.message).toBe('Content is required');
    });

    it('reports the first refusal when several fields are refused', () => {
      const error = promptManager.validatePromptData({ title: '', content: '' });

      expect(error?.message).toBe('Title is required');
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

  describe('Category Validation', () => {
    it('accepts a name over the limit only because of Hidden characters or surrounding spaces', () => {
      const error = promptManager.validateCategoryData({
        name: ` ${'c'.repeat(PROMPT_LIMITS.category)}\u{200B} `
      });

      expect(error).toBeNull();
    });

    it("refuses a blank or Hidden-only name as empty, in Admission's words", () => {
      expect(promptManager.validateCategoryData({ name: '   ' })?.message).toBe('Category name is required');
      expect(promptManager.validateCategoryData({ name: '\u{200B}' })?.message).toBe('Category name is required');
    });

    it('refuses a name over the limit', () => {
      const error = promptManager.validateCategoryData({ name: 'c'.repeat(PROMPT_LIMITS.category + 1) });

      expect(error?.type).toBe('VALIDATION_ERROR');
      expect(error?.message).toBe('Category name cannot exceed 50 characters');
    });

    it('still validates the colour', () => {
      expect(promptManager.validateCategoryData({ name: 'Work', color: 'red' })?.message).toBe(
        'Color must be a valid hex color code (e.g., #FF0000)'
      );
      expect(promptManager.validateCategoryData({ name: 'Work', color: '#FF0000' })).toBeNull();
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

    it('should never cut an emoji in half when it straddles the cut', () => {
      // 49 characters, then an emoji (a surrogate pair) across the 50-unit cut, no space to cut at
      const content = `${'a'.repeat(49)}\u{1F600}${'b'.repeat(10)}`;
      const title = promptManager.generateTitle(content);

      expect(title).toBe(`${'a'.repeat(49)}...`);
      // encodeURIComponent throws on a lone surrogate
      expect(() => encodeURIComponent(title)).not.toThrow();
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
          message: 'Content is required'
        });
    });

    it('generates a title when none is given and judges that title, not the empty one', async () => {
      await promptManager.createPrompt('  ', 'Body text', DEFAULT_CATEGORY);

      expect(storageManagerMock.savePrompt).toHaveBeenCalledWith({
        title: 'Body text',
        content: 'Body text',
        category: DEFAULT_CATEGORY
      });
    });

    it('creates a Prompt whose title is over the limit only because of a Hidden character', async () => {
      const title = `${'T'.repeat(50)}\u{200B}${'t'.repeat(50)}`;

      await promptManager.createPrompt(title, 'Body', DEFAULT_CATEGORY);

      expect(storageManagerMock.savePrompt).toHaveBeenCalledWith({ title, content: 'Body', category: DEFAULT_CATEGORY });
    });

    it('edits a Prompt whose new content is over the limit only because of a Hidden character', async () => {
      const content = `${'x'.repeat(PROMPT_LIMITS.content)}\u{200B}`;

      await promptManager.updatePrompt('1', { content });

      expect(storageManagerMock.updatePrompt).toHaveBeenCalledWith('1', { content });
    });

    it('refuses an empty title on edit', async () => {
      await expect(promptManager.updatePrompt('1', { title: '   ' })).rejects.toMatchObject({
        type: 'VALIDATION_ERROR',
        message: 'Title is required'
      });
      expect(storageManagerMock.updatePrompt).not.toHaveBeenCalled();
    });

    it('passes content to storage exactly as written, spaces and line breaks included', async () => {
      await promptManager.createPrompt('Title', '  Rewrite this:\n\n', DEFAULT_CATEGORY);

      expect(storageManagerMock.savePrompt).toHaveBeenCalledWith({
        title: 'Title',
        content: '  Rewrite this:\n\n',
        category: DEFAULT_CATEGORY
      });
    });

    it('passes edited content to storage exactly as written', async () => {
      await promptManager.updatePrompt('1', { content: '  Rewrite this:\n\n' });

      expect(storageManagerMock.updatePrompt).toHaveBeenCalledWith('1', { content: '  Rewrite this:\n\n' });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', () => {
      // Test various validation scenarios
      const error1 = promptManager.validatePromptData({
        title: 'a'.repeat(PROMPT_LIMITS.title + 1),
        content: 'Valid content'
      });
      expect(error1).toBeDefined();
      expect(error1?.type).toBe('VALIDATION_ERROR');

      const error2 = promptManager.validatePromptData({
        title: 'Valid title',
        content: 'a'.repeat(PROMPT_LIMITS.content + 1)
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
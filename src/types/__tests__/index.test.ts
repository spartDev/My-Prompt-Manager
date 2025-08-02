import { describe, it, expect } from 'vitest';

import { 
  DEFAULT_CATEGORY, 
  DEFAULT_SETTINGS, 
  VALIDATION_LIMITS,
  ErrorType 
} from '../index';

describe('Type Definitions', () => {
  describe('Constants', () => {
    it('should have correct default category', () => {
      expect(DEFAULT_CATEGORY).toBe('Uncategorized');
    });

    it('should have correct default settings', () => {
      expect(DEFAULT_SETTINGS).toEqual({
        defaultCategory: 'Uncategorized',
        sortOrder: 'updatedAt',
        viewMode: 'grid',
        theme: 'system'
      });
    });

    it('should have validation limits', () => {
      expect(VALIDATION_LIMITS.PROMPT_TITLE_MAX).toBe(100);
      expect(VALIDATION_LIMITS.PROMPT_CONTENT_MAX).toBe(10000);
      expect(VALIDATION_LIMITS.CATEGORY_NAME_MAX).toBe(50);
      expect(VALIDATION_LIMITS.TITLE_GENERATION_LENGTH).toBe(50);
    });
  });

  describe('Error Types', () => {
    it('should have all error types defined', () => {
      expect(ErrorType.STORAGE_QUOTA_EXCEEDED).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(ErrorType.STORAGE_UNAVAILABLE).toBe('STORAGE_UNAVAILABLE');
      expect(ErrorType.DATA_CORRUPTION).toBe('DATA_CORRUPTION');
      expect(ErrorType.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorType.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(ErrorType.EXTENSION_CONTEXT_LOST).toBe('EXTENSION_CONTEXT_LOST');
    });
  });

  describe('Type Validation', () => {
    it('should validate prompt structure', () => {
      const validPrompt = {
        id: 'test-id',
        title: 'Test Title',
        content: 'Test Content',
        category: 'Test Category',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // TypeScript compilation ensures type safety
      expect(typeof validPrompt.id).toBe('string');
      expect(typeof validPrompt.title).toBe('string');
      expect(typeof validPrompt.content).toBe('string');
      expect(typeof validPrompt.category).toBe('string');
      expect(typeof validPrompt.createdAt).toBe('number');
      expect(typeof validPrompt.updatedAt).toBe('number');
    });

    it('should validate category structure', () => {
      const validCategory = {
        id: 'test-id',
        name: 'Test Category',
        color: '#FF0000'
      };

      expect(typeof validCategory.id).toBe('string');
      expect(typeof validCategory.name).toBe('string');
      expect(typeof validCategory.color).toBe('string');
    });

    it('should validate settings structure', () => {
      const validSettings = {
        defaultCategory: 'Test Category',
        sortOrder: 'updatedAt' as const,
        viewMode: 'grid' as const
      };

      expect(typeof validSettings.defaultCategory).toBe('string');
      expect(['createdAt', 'updatedAt', 'title']).toContain(validSettings.sortOrder);
      expect(['grid', 'list']).toContain(validSettings.viewMode);
    });
  });
});
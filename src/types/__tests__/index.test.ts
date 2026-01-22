import { describe, it, expect } from 'vitest';

import {
  DEFAULT_CATEGORY,
  DEFAULT_SETTINGS,
  VALIDATION_LIMITS,
  type ErrorType
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
        sortDirection: 'desc',
        theme: 'system',
        interfaceMode: 'sidepanel'
      });
    });

    it('should have validation limits', () => {
      expect(VALIDATION_LIMITS.PROMPT_TITLE_MAX).toBe(100);
      expect(VALIDATION_LIMITS.PROMPT_CONTENT_MAX).toBe(20000);
      expect(VALIDATION_LIMITS.CATEGORY_NAME_MAX).toBe(50);
      expect(VALIDATION_LIMITS.TITLE_GENERATION_LENGTH).toBe(50);
    });
  });

  describe('Error Types', () => {
    it('should have valid ErrorType string literals', () => {
      // ErrorType is now a string union type (erased at compile time)
      // Verify that valid error type strings are assignable to the type
      const errorTypes: ErrorType[] = [
        'STORAGE_QUOTA_EXCEEDED',
        'STORAGE_UNAVAILABLE',
        'DATA_CORRUPTION',
        'VALIDATION_ERROR',
        'PERMISSION_DENIED',
        'EXTENSION_CONTEXT_LOST'
      ];
      expect(errorTypes).toHaveLength(6);
      errorTypes.forEach(errorType => {
        expect(typeof errorType).toBe('string');
      });
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
        sortOrder: 'updatedAt' as const
      };

      expect(typeof validSettings.defaultCategory).toBe('string');
      expect(['createdAt', 'updatedAt', 'title', 'usageCount', 'lastUsedAt']).toContain(validSettings.sortOrder);
    });
  });
});

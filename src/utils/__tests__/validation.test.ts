import { describe, it, expect } from 'vitest';

import { Prompt, Category, Settings, StorageData, UsageEvent, CustomSite } from '../../types';
import {
  validatePromptFields,
  isPrompt,
  isCategory,
  isSettings,
  isStorageData,
  isUsageEvent,
  isCustomSite,
  isArrayOf,
} from '../validation';

describe('validatePromptFields', () => {
  it('should pass validation for valid inputs', () => {
    const errors = validatePromptFields('Valid Title', 'Valid Content', {
      component: 'TestComponent',
    });
    expect(errors).toEqual({});
  });

  it('should return error for empty content', () => {
    const errors = validatePromptFields('Title', '', { component: 'TestComponent' });
    expect(errors.content).toBeDefined();
  });

  it('should return error for content exceeding max length', () => {
    const longContent = 'a'.repeat(20001);
    const errors = validatePromptFields('Title', longContent, {
      component: 'TestComponent',
    });
    expect(errors.content).toBeDefined();
  });

  it('should return error for title exceeding max length', () => {
    const longTitle = 'a'.repeat(101);
    const errors = validatePromptFields(longTitle, 'Content', {
      component: 'TestComponent',
    });
    expect(errors.title).toBeDefined();
  });
});

describe('Type Guards', () => {
  describe('isPrompt', () => {
    const validPrompt: Prompt = {
      id: 'test-id',
      title: 'Test Title',
      content: 'Test Content',
      category: 'General',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should return true for valid Prompt objects', () => {
      expect(isPrompt(validPrompt)).toBe(true);
    });

    it('should return true for Prompt with optional fields', () => {
      const promptWithOptionals = {
        ...validPrompt,
        usageCount: 5,
        lastUsedAt: Date.now(),
      };
      expect(isPrompt(promptWithOptionals)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isPrompt(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPrompt(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isPrompt('string')).toBe(false);
      expect(isPrompt(123)).toBe(false);
      expect(isPrompt(true)).toBe(false);
    });

    it('should return false for objects missing required fields', () => {
      expect(isPrompt({ id: 'test' })).toBe(false);
      expect(isPrompt({ id: 'test', title: 'Test' })).toBe(false);
    });

    it('should return false for objects with wrong field types', () => {
      expect(isPrompt({ ...validPrompt, id: 123 })).toBe(false);
      expect(isPrompt({ ...validPrompt, createdAt: 'not-a-number' })).toBe(false);
    });
  });

  describe('isCategory', () => {
    const validCategory: Category = {
      id: 'cat-id',
      name: 'Test Category',
    };

    it('should return true for valid Category objects', () => {
      expect(isCategory(validCategory)).toBe(true);
    });

    it('should return true for Category with optional color', () => {
      expect(isCategory({ ...validCategory, color: '#FF0000' })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCategory(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCategory(undefined)).toBe(false);
    });

    it('should return false for objects missing required fields', () => {
      expect(isCategory({ id: 'test' })).toBe(false);
      expect(isCategory({ name: 'Test' })).toBe(false);
    });

    it('should return false for objects with wrong field types', () => {
      expect(isCategory({ id: 123, name: 'Test' })).toBe(false);
      expect(isCategory({ id: 'test', name: 456 })).toBe(false);
    });

    it('should return false when color is wrong type', () => {
      expect(isCategory({ ...validCategory, color: 123 })).toBe(false);
    });
  });

  describe('isSettings', () => {
    const validSettings: Settings = {
      defaultCategory: 'General',
      sortOrder: 'updatedAt',
      sortDirection: 'desc',
      theme: 'system',
    };

    it('should return true for valid Settings objects', () => {
      expect(isSettings(validSettings)).toBe(true);
    });

    it('should return true for Settings with optional interfaceMode', () => {
      expect(isSettings({ ...validSettings, interfaceMode: 'popup' })).toBe(true);
      expect(isSettings({ ...validSettings, interfaceMode: 'sidepanel' })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isSettings(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isSettings(undefined)).toBe(false);
    });

    it('should return false for invalid sortOrder', () => {
      expect(isSettings({ ...validSettings, sortOrder: 'invalid' })).toBe(false);
    });

    it('should return false for invalid sortDirection', () => {
      expect(isSettings({ ...validSettings, sortDirection: 'invalid' })).toBe(false);
    });

    it('should return false for invalid theme', () => {
      expect(isSettings({ ...validSettings, theme: 'invalid' })).toBe(false);
    });

    it('should return false for invalid interfaceMode', () => {
      expect(isSettings({ ...validSettings, interfaceMode: 'invalid' })).toBe(false);
    });

    it('should validate all valid sortOrder values', () => {
      const sortOrders = ['createdAt', 'updatedAt', 'title', 'usageCount', 'lastUsedAt'] as const;
      for (const sortOrder of sortOrders) {
        expect(isSettings({ ...validSettings, sortOrder })).toBe(true);
      }
    });
  });

  describe('isStorageData', () => {
    const validPrompt: Prompt = {
      id: 'test-id',
      title: 'Test Title',
      content: 'Test Content',
      category: 'General',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const validCategory: Category = {
      id: 'cat-id',
      name: 'Test Category',
    };

    const validSettings: Settings = {
      defaultCategory: 'General',
      sortOrder: 'updatedAt',
      sortDirection: 'desc',
      theme: 'system',
    };

    const validStorageData: StorageData = {
      prompts: [validPrompt],
      categories: [validCategory],
      settings: validSettings,
    };

    it('should return true for valid StorageData', () => {
      expect(isStorageData(validStorageData)).toBe(true);
    });

    it('should return true for empty arrays', () => {
      expect(
        isStorageData({
          prompts: [],
          categories: [],
          settings: validSettings,
        })
      ).toBe(true);
    });

    it('should return false for null', () => {
      expect(isStorageData(null)).toBe(false);
    });

    it('should return false for invalid prompts', () => {
      expect(
        isStorageData({
          prompts: [{ invalid: true }],
          categories: [validCategory],
          settings: validSettings,
        })
      ).toBe(false);
    });

    it('should return false for invalid categories', () => {
      expect(
        isStorageData({
          prompts: [validPrompt],
          categories: [{ invalid: true }],
          settings: validSettings,
        })
      ).toBe(false);
    });

    it('should return false for invalid settings', () => {
      expect(
        isStorageData({
          prompts: [validPrompt],
          categories: [validCategory],
          settings: { invalid: true },
        })
      ).toBe(false);
    });
  });

  describe('isUsageEvent', () => {
    const validUsageEvent: UsageEvent = {
      promptId: 'prompt-123',
      timestamp: Date.now(),
      platform: 'claude',
      categoryId: 'cat-123',
    };

    it('should return true for valid UsageEvent', () => {
      expect(isUsageEvent(validUsageEvent)).toBe(true);
    });

    it('should return true for UsageEvent with null categoryId', () => {
      expect(isUsageEvent({ ...validUsageEvent, categoryId: null })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isUsageEvent(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isUsageEvent(undefined)).toBe(false);
    });

    it('should return false for missing promptId', () => {
      const { promptId: _, ...withoutPromptId } = validUsageEvent;
      expect(isUsageEvent(withoutPromptId)).toBe(false);
    });

    it('should return false for wrong timestamp type', () => {
      expect(isUsageEvent({ ...validUsageEvent, timestamp: 'not-a-number' })).toBe(false);
    });
  });

  describe('isCustomSite', () => {
    const validCustomSite: CustomSite = {
      hostname: 'example.com',
      displayName: 'Example Site',
      enabled: true,
      dateAdded: Date.now(),
    };

    it('should return true for valid CustomSite', () => {
      expect(isCustomSite(validCustomSite)).toBe(true);
    });

    it('should return true for CustomSite with optional fields', () => {
      expect(
        isCustomSite({
          ...validCustomSite,
          icon: 'icon-url',
          positioning: {
            mode: 'custom' as const,
            selector: '.test',
            placement: 'after' as const,
          },
        })
      ).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCustomSite(null)).toBe(false);
    });

    it('should return false for empty hostname', () => {
      expect(isCustomSite({ ...validCustomSite, hostname: '' })).toBe(false);
    });

    it('should return false for empty displayName', () => {
      expect(isCustomSite({ ...validCustomSite, displayName: '' })).toBe(false);
    });

    it('should return false for wrong enabled type', () => {
      expect(isCustomSite({ ...validCustomSite, enabled: 'yes' })).toBe(false);
    });

    it('should return false for wrong dateAdded type', () => {
      expect(isCustomSite({ ...validCustomSite, dateAdded: 'yesterday' })).toBe(false);
    });
  });

  describe('isArrayOf', () => {
    const validPrompt: Prompt = {
      id: 'test-id',
      title: 'Test Title',
      content: 'Test Content',
      category: 'General',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should create a type guard for arrays', () => {
      const isPromptArray = isArrayOf(isPrompt);
      expect(isPromptArray([validPrompt])).toBe(true);
    });

    it('should return true for empty arrays', () => {
      const isPromptArray = isArrayOf(isPrompt);
      expect(isPromptArray([])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      const isPromptArray = isArrayOf(isPrompt);
      expect(isPromptArray('not an array')).toBe(false);
      expect(isPromptArray(null)).toBe(false);
      expect(isPromptArray(undefined)).toBe(false);
      expect(isPromptArray({})).toBe(false);
    });

    it('should return false if any element fails validation', () => {
      const isPromptArray = isArrayOf(isPrompt);
      expect(isPromptArray([validPrompt, { invalid: true }])).toBe(false);
    });

    it('should work with primitive type guards', () => {
      const isStringArray = isArrayOf((v): v is string => typeof v === 'string');
      expect(isStringArray(['a', 'b', 'c'])).toBe(true);
      expect(isStringArray(['a', 123, 'c'])).toBe(false);
    });
  });
});

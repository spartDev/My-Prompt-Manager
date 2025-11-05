import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { Prompt, SortOrder } from '../../types';
import { PromptManager } from '../promptManager';

describe('PromptManager - Sorting', () => {
  const FIXED_TIME = new Date('2025-01-01T00:00:00Z').getTime();

  let manager: PromptManager;
  let mockPrompts: Prompt[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    manager = PromptManager.getInstance();

    // Create test prompts with different timestamps and titles
    mockPrompts = [
      {
        id: '1',
        title: 'Zebra Prompt',
        content: 'Content 1',
        category: 'Work',
        createdAt: FIXED_TIME - 3000, // Oldest creation
        updatedAt: FIXED_TIME, // Newest update
      },
      {
        id: '2',
        title: 'Apple Prompt',
        content: 'Content 2',
        category: 'Personal',
        createdAt: FIXED_TIME - 2000, // Middle creation
        updatedAt: FIXED_TIME - 3000, // Oldest update
      },
      {
        id: '3',
        title: 'Mango Prompt',
        content: 'Content 3',
        category: 'Work',
        createdAt: FIXED_TIME - 1000, // Newest creation
        updatedAt: FIXED_TIME - 2000, // Middle update
      },
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Sort by title', () => {
    it('should sort by title ascending (A→Z)', () => {
      const sorted = manager.sortPrompts(mockPrompts, 'title', 'asc');

      expect(sorted.map(p => p.title)).toEqual([
        'Apple Prompt',
        'Mango Prompt',
        'Zebra Prompt'
      ]);
    });

    it('should sort by title descending (Z→A)', () => {
      const sorted = manager.sortPrompts(mockPrompts, 'title', 'desc');

      expect(sorted.map(p => p.title)).toEqual([
        'Zebra Prompt',
        'Mango Prompt',
        'Apple Prompt'
      ]);
    });

    it('should handle case-insensitive sorting', () => {
      const prompts: Prompt[] = [
        { ...mockPrompts[0], title: 'zebra' },
        { ...mockPrompts[1], title: 'Apple' },
        { ...mockPrompts[2], title: 'MANGO' }
      ];

      const sorted = manager.sortPrompts(prompts, 'title', 'asc');

      expect(sorted.map(p => p.title)).toEqual(['Apple', 'MANGO', 'zebra']);
    });
  });

  describe('Sort by createdAt', () => {
    it('should sort by createdAt ascending (oldest first)', () => {
      const sorted = manager.sortPrompts(mockPrompts, 'createdAt', 'asc');

      expect(sorted.map(p => p.id)).toEqual(['1', '2', '3']);
      expect(sorted.map(p => p.createdAt)).toEqual([FIXED_TIME - 3000, FIXED_TIME - 2000, FIXED_TIME - 1000]);
    });

    it('should sort by createdAt descending (newest first)', () => {
      const sorted = manager.sortPrompts(mockPrompts, 'createdAt', 'desc');

      expect(sorted.map(p => p.id)).toEqual(['3', '2', '1']);
      expect(sorted.map(p => p.createdAt)).toEqual([FIXED_TIME - 1000, FIXED_TIME - 2000, FIXED_TIME - 3000]);
    });
  });

  describe('Sort by updatedAt', () => {
    it('should sort by updatedAt ascending (oldest first)', () => {
      const sorted = manager.sortPrompts(mockPrompts, 'updatedAt', 'asc');

      expect(sorted.map(p => p.id)).toEqual(['2', '3', '1']);
      expect(sorted.map(p => p.updatedAt)).toEqual([FIXED_TIME - 3000, FIXED_TIME - 2000, FIXED_TIME]);
    });

    it('should sort by updatedAt descending (newest first)', () => {
      const sorted = manager.sortPrompts(mockPrompts, 'updatedAt', 'desc');

      expect(sorted.map(p => p.id)).toEqual(['1', '3', '2']);
      expect(sorted.map(p => p.updatedAt)).toEqual([FIXED_TIME, FIXED_TIME - 2000, FIXED_TIME - 3000]);
    });
  });

  describe('Immutability', () => {
    it('should not mutate the original array', () => {
      const original = [...mockPrompts];
      const originalOrder = mockPrompts.map(p => p.id);

      manager.sortPrompts(mockPrompts, 'title', 'asc');

      expect(mockPrompts).toEqual(original);
      expect(mockPrompts.map(p => p.id)).toEqual(originalOrder);
    });

    it('should return a new array instance', () => {
      const sorted = manager.sortPrompts(mockPrompts, 'title', 'asc');

      expect(sorted).not.toBe(mockPrompts);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty array', () => {
      const sorted = manager.sortPrompts([], 'title', 'asc');

      expect(sorted).toEqual([]);
    });

    it('should handle single item array', () => {
      const single = [mockPrompts[0]];
      const sorted = manager.sortPrompts(single, 'title', 'asc');

      expect(sorted).toEqual(single);
    });

    it('should handle prompts with identical titles', () => {
      const prompts: Prompt[] = [
        { ...mockPrompts[0], title: 'Same Title', id: '1' },
        { ...mockPrompts[1], title: 'Same Title', id: '2' },
        { ...mockPrompts[2], title: 'Same Title', id: '3' }
      ];

      const sorted = manager.sortPrompts(prompts, 'title', 'asc');

      // Should maintain stability (order of equal elements)
      expect(sorted.length).toBe(3);
      expect(sorted.every(p => p.title === 'Same Title')).toBe(true);
    });

    it('should handle prompts with identical timestamps', () => {
      const prompts: Prompt[] = [
        { ...mockPrompts[0], createdAt: 1000, updatedAt: 2000 },
        { ...mockPrompts[1], createdAt: 1000, updatedAt: 2000 },
        { ...mockPrompts[2], createdAt: 1000, updatedAt: 2000 }
      ];

      const sorted = manager.sortPrompts(prompts, 'createdAt', 'asc');

      expect(sorted.length).toBe(3);
      expect(sorted.every(p => p.createdAt === 1000)).toBe(true);
    });

    it('should handle special characters in titles', () => {
      const prompts: Prompt[] = [
        { ...mockPrompts[0], title: '!@# Special' },
        { ...mockPrompts[1], title: 'AAA Normal' },
        { ...mockPrompts[2], title: '123 Numbers' }
      ];

      const sorted = manager.sortPrompts(prompts, 'title', 'asc');

      // localeCompare handles special characters correctly
      expect(sorted.length).toBe(3);
    });
  });

  describe('Stability', () => {
    it('should maintain stable sort for equal elements', () => {
      const prompts: Prompt[] = [
        { ...mockPrompts[0], title: 'Same', createdAt: 1000, id: 'first' },
        { ...mockPrompts[1], title: 'Same', createdAt: 1000, id: 'second' },
        { ...mockPrompts[2], title: 'Same', createdAt: 1000, id: 'third' }
      ];

      const sorted = manager.sortPrompts(prompts, 'title', 'asc');

      // JavaScript's sort is stable as of ES2019
      expect(sorted.map(p => p.id)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('Performance', () => {
    it('should handle large arrays efficiently', () => {
      // Create 1000 prompts
      const largeArray: Prompt[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `prompt-${i}`,
        title: `Title ${Math.random().toString(36).substring(7)}`,
        content: 'Content',
        category: 'Test',
        createdAt: Math.floor(Math.random() * 10000),
        updatedAt: Math.floor(Math.random() * 10000)
      }));

      const startTime = performance.now();
      const sorted = manager.sortPrompts(largeArray, 'title', 'asc');
      const endTime = performance.now();

      expect(sorted.length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(50); // Should sort in < 50ms
    });
  });

  describe('TypeScript exhaustiveness check', () => {
    it('should throw error for invalid sort order', () => {
      // This tests the runtime exhaustiveness check
      // TypeScript would catch this at compile time, but we test the runtime behavior
      expect(() => {
        manager.sortPrompts(mockPrompts, 'invalid' as SortOrder, 'asc');
      }).toThrow('Unknown sort order: invalid');
    });
  });

  describe('Real-world scenarios', () => {
    it('should correctly sort "Recently Updated" (default view)', () => {
      // Most common use case: Recently Updated, newest first
      const sorted = manager.sortPrompts(mockPrompts, 'updatedAt', 'desc');

      expect(sorted[0].id).toBe('1'); // updatedAt: FIXED_TIME (newest)
      expect(sorted[1].id).toBe('3'); // updatedAt: FIXED_TIME - 2000
      expect(sorted[2].id).toBe('2'); // updatedAt: FIXED_TIME - 3000 (oldest)
    });

    it('should correctly sort "Recently Created"', () => {
      const sorted = manager.sortPrompts(mockPrompts, 'createdAt', 'desc');

      expect(sorted[0].id).toBe('3'); // createdAt: FIXED_TIME - 1000 (newest)
      expect(sorted[1].id).toBe('2'); // createdAt: FIXED_TIME - 2000
      expect(sorted[2].id).toBe('1'); // createdAt: FIXED_TIME - 3000 (oldest)
    });

    it('should correctly sort "Alphabetical" (A→Z)', () => {
      const sorted = manager.sortPrompts(mockPrompts, 'title', 'asc');

      expect(sorted[0].title).toBe('Apple Prompt');
      expect(sorted[1].title).toBe('Mango Prompt');
      expect(sorted[2].title).toBe('Zebra Prompt');
    });

    it('should toggle sort direction correctly', () => {
      // User clicks "Recently Updated" → desc (default)
      const firstSort = manager.sortPrompts(mockPrompts, 'updatedAt', 'desc');
      expect(firstSort[0].id).toBe('1'); // Newest update

      // User clicks again → asc (toggled)
      const secondSort = manager.sortPrompts(mockPrompts, 'updatedAt', 'asc');
      expect(secondSort[0].id).toBe('2'); // Oldest update
    });
  });

  describe('Integration with filter', () => {
    it('should work correctly after filtering', () => {
      // Filter to only Work category
      const filtered = mockPrompts.filter(p => p.category === 'Work');

      // Then sort by title
      const sorted = manager.sortPrompts(filtered, 'title', 'asc');

      expect(sorted.length).toBe(2);
      expect(sorted[0].title).toBe('Mango Prompt');
      expect(sorted[1].title).toBe('Zebra Prompt');
    });
  });
});

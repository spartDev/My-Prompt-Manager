import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { buildPrompt } from '../../test/builders';
import type { Prompt } from '../../types';
import { usePrompts } from '../usePrompts';

describe('usePrompts', () => {
  // Test data with realistic timestamps
  const now = Date.now();
  const oneDayAgo = now - 86400000;
  const twoDaysAgo = now - 172800000;
  const threeDaysAgo = now - 259200000;

  const mockPrompts: Prompt[] = [
    buildPrompt({
      id: '1',
      title: 'React Hooks Guide',
      content: 'Learn about useState and useEffect',
      category: 'Development',
      createdAt: threeDaysAgo,
      updatedAt: twoDaysAgo,
      usageCount: 5,
      lastUsedAt: oneDayAgo
    }),
    buildPrompt({
      id: '2',
      title: 'TypeScript Tips',
      content: 'Advanced TypeScript patterns',
      category: 'Development',
      createdAt: twoDaysAgo,
      updatedAt: oneDayAgo,
      usageCount: 3,
      lastUsedAt: oneDayAgo
    }),
    buildPrompt({
      id: '3',
      title: 'Meeting Notes',
      content: 'Quarterly planning discussion',
      category: 'Work',
      createdAt: oneDayAgo,
      updatedAt: oneDayAgo,
      usageCount: 1,
      lastUsedAt: oneDayAgo
    })
  ];

  beforeEach(async () => {
    // Initialize storage with default data
    await chrome.storage.local.set({
      prompts: [],
      categories: [{ id: 'default', name: 'General' }],
      settings: {
        defaultCategory: 'General',
        sortOrder: 'updatedAt',
        sortDirection: 'desc',
        theme: 'light'
      }
    });
  });

  describe('Loading', () => {
    it('should load prompts on mount', async () => {
      // Arrange - Seed storage with test data
      await chrome.storage.local.set({ prompts: mockPrompts });

      // Act
      const { result } = renderHook(() => usePrompts());

      // Assert - Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.prompts).toEqual([]);

      // Wait for prompts to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.prompts).toEqual(mockPrompts);
      expect(result.current.error).toBeNull();
    });

    it('should set loading state while fetching', async () => {
      // Arrange - Seed storage
      await chrome.storage.local.set({ prompts: mockPrompts });

      // Act
      const { result } = renderHook(() => usePrompts());

      // Assert - Should be loading
      expect(result.current.loading).toBe(true);
      expect(result.current.prompts).toEqual([]);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.prompts).toEqual(mockPrompts);
    });

    it('should handle load errors gracefully', async () => {
      // Arrange - Simulate storage failure
      const getSpy = vi.spyOn(chrome.storage.local, 'get');
      getSpy.mockRejectedValueOnce(new Error('Failed to load prompts'));

      // Act
      const { result } = renderHook(() => usePrompts());

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.prompts).toEqual([]);

      getSpy.mockRestore();
    });
  });

  describe('CRUD Operations', () => {
    it('should create a new prompt', async () => {
      // Arrange - Seed storage with initial prompts and categories
      await chrome.storage.local.set({
        prompts: mockPrompts,
        categories: [
          { id: 'default', name: 'General' },
          { id: 'dev', name: 'Development' },
          { id: 'work', name: 'Work' },
          { id: 'test', name: 'Test' }
        ]
      });

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.prompts).toHaveLength(3);

      // Act - Create prompt
      await act(async () => {
        await result.current.createPrompt({
          title: 'New Prompt',
          content: 'New content',
          category: 'Test'
        });
      });

      // Assert - Verify through storage
      const data = await chrome.storage.local.get('prompts');
      const prompts = data.prompts as Prompt[];

      expect(prompts).toHaveLength(4);
      expect(prompts.some(p => p.title === 'New Prompt')).toBe(true);
      expect(result.current.prompts).toHaveLength(4);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should update an existing prompt', async () => {
      // Arrange
      await chrome.storage.local.set({
        prompts: mockPrompts,
        categories: [
          { id: 'default', name: 'General' },
          { id: 'dev', name: 'Development' },
          { id: 'work', name: 'Work' }
        ],
        settings: {
          defaultCategory: 'General',
          sortOrder: 'updatedAt',
          sortDirection: 'desc',
          theme: 'light'
        }
      });

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const originalPrompt = result.current.prompts[0];

      // Act - Update prompt
      await act(async () => {
        await result.current.updatePrompt('1', { title: 'Updated Title' });
      });

      // Assert - Verify through storage
      const data = await chrome.storage.local.get('prompts');
      const prompts = data.prompts as Prompt[];
      const updated = prompts.find(p => p.id === '1');

      expect(updated?.title).toBe('Updated Title');
      expect(updated?.updatedAt).toBeGreaterThan(originalPrompt.updatedAt);
      expect(updated?.createdAt).toBe(originalPrompt.createdAt);
      expect(result.current.prompts.find(p => p.id === '1')?.title).toBe('Updated Title');
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should delete a prompt', async () => {
      // Arrange
      await chrome.storage.local.set({ prompts: mockPrompts });

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.prompts).toHaveLength(3);

      // Act - Delete prompt
      await act(async () => {
        await result.current.deletePrompt('2');
      });

      // Assert - Verify through storage
      const data = await chrome.storage.local.get('prompts');
      const prompts = data.prompts as Prompt[];

      expect(prompts).toHaveLength(2);
      expect(prompts.find(p => p.id === '2')).toBeUndefined();
      expect(result.current.prompts).toHaveLength(2);
      expect(result.current.prompts.find(p => p.id === '2')).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should refresh prompts list after operations', async () => {
      // Arrange
      await chrome.storage.local.set({ prompts: mockPrompts });

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.prompts).toHaveLength(3);

      // Modify storage directly to simulate external change
      const updatedPrompts = [...mockPrompts, buildPrompt({ id: '4', title: 'External Prompt' })];
      await chrome.storage.local.set({ prompts: updatedPrompts });

      // Act - Manually refresh
      await act(async () => {
        await result.current.refreshPrompts();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.prompts).toHaveLength(4);
      expect(result.current.prompts.some(p => p.title === 'External Prompt')).toBe(true);
    });

    it('should re-throw errors from create operation', async () => {
      // Arrange
      await chrome.storage.local.set({ prompts: mockPrompts });

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert - Try to create invalid prompt (empty title)
      await act(async () => {
        await expect(
          result.current.createPrompt({
            title: '',
            content: 'Test content',
            category: 'Test'
          })
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });

    it('should re-throw errors from update operation', async () => {
      // Arrange
      await chrome.storage.local.set({ prompts: mockPrompts });

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate storage failure
      const setSpy = vi.spyOn(chrome.storage.local, 'set');
      setSpy.mockRejectedValueOnce(new Error('Update failed'));

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.updatePrompt('1', { title: 'New Title' })
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);

      setSpy.mockRestore();
    });

    it('should re-throw errors from delete operation', async () => {
      // Arrange
      await chrome.storage.local.set({ prompts: mockPrompts });

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate storage failure
      const setSpy = vi.spyOn(chrome.storage.local, 'set');
      setSpy.mockRejectedValueOnce(new Error('Delete failed'));

      // Act & Assert
      await act(async () => {
        await expect(result.current.deletePrompt('1')).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);

      setSpy.mockRestore();
    });
  });

  describe('Search', () => {
    beforeEach(async () => {
      await chrome.storage.local.set({ prompts: mockPrompts });
    });

    it('should filter prompts by search query in title', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      const results = result.current.searchPrompts('React');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('React Hooks Guide');
    });

    it('should filter prompts by search query in content', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      const results = result.current.searchPrompts('TypeScript patterns');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('TypeScript patterns');
    });

    it('should filter prompts by search query in category', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      const results = result.current.searchPrompts('Work');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('Work');
    });

    it('should return all prompts when query is empty', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Empty string
      const resultsEmpty = result.current.searchPrompts('');

      // Assert
      expect(resultsEmpty).toHaveLength(3);
      expect(resultsEmpty).toEqual(mockPrompts);
    });

    it('should return all prompts when query is only whitespace', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Whitespace only
      const resultsWhitespace = result.current.searchPrompts('   ');

      // Assert
      expect(resultsWhitespace).toHaveLength(3);
      expect(resultsWhitespace).toEqual(mockPrompts);
    });

    it('should handle special characters in search query', async () => {
      // Arrange
      const specialPrompts: Prompt[] = [
        buildPrompt({
          id: '5',
          title: 'C++ Guide',
          content: 'Learn C++ basics',
          category: 'Development',
          createdAt: oneDayAgo,
          updatedAt: oneDayAgo,
          usageCount: 0,
          lastUsedAt: oneDayAgo
        })
      ];

      await chrome.storage.local.set({ prompts: specialPrompts });
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      const results = result.current.searchPrompts('C++');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('C++ Guide');
    });

    it('should be case-insensitive', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Different cases
      const resultsLower = result.current.searchPrompts('react');
      const resultsUpper = result.current.searchPrompts('REACT');
      const resultsMixed = result.current.searchPrompts('ReAcT');

      // Assert - All should return the same result
      expect(resultsLower).toEqual(resultsUpper);
      expect(resultsUpper).toEqual(resultsMixed);
      expect(resultsLower).toHaveLength(1);
    });

    it('should return empty array when no matches found', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      const results = result.current.searchPrompts('NonExistentQuery');

      // Assert
      expect(results).toHaveLength(0);
      expect(results).toEqual([]);
    });
  });

  describe('Filtering', () => {
    beforeEach(async () => {
      await chrome.storage.local.set({ prompts: mockPrompts });
    });

    it('should filter prompts by category', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      const results = result.current.filterByCategory('Development');

      // Assert
      expect(results).toHaveLength(2);
      expect(results.every(p => p.category === 'Development')).toBe(true);
    });

    it('should return all prompts when category is null', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      const results = result.current.filterByCategory(null);

      // Assert
      expect(results).toHaveLength(3);
      expect(results).toEqual(mockPrompts);
    });

    it('should return empty array when category has no prompts', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      const results = result.current.filterByCategory('NonExistentCategory');

      // Assert
      expect(results).toHaveLength(0);
      expect(results).toEqual([]);
    });

    it('should handle category filtering with exact match', async () => {
      // Arrange
      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Partial match should not work
      const results = result.current.filterByCategory('Develop');

      // Assert - Should not match 'Development'
      expect(results).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should set error state when operations fail', async () => {
      // Arrange - Simulate storage failure
      const getSpy = vi.spyOn(chrome.storage.local, 'get');
      getSpy.mockRejectedValueOnce(new Error('Failed to load'));

      // Act
      const { result } = renderHook(() => usePrompts());

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.prompts).toEqual([]);

      getSpy.mockRestore();
    });

    it('should clear error state on successful operation', async () => {
      // Arrange - First load fails
      const getSpy = vi.spyOn(chrome.storage.local, 'get');
      getSpy.mockRejectedValueOnce(new Error('Initial load failed'));

      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Act - Refresh with success (restore real implementation)
      getSpy.mockRestore();
      await chrome.storage.local.set({ prompts: mockPrompts });

      await act(async () => {
        await result.current.refreshPrompts();
      });

      // Assert - Error should be cleared
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.prompts).toEqual(mockPrompts);
    });

    it('should maintain error state after failed operation', async () => {
      // Arrange
      await chrome.storage.local.set({ prompts: mockPrompts });

      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Create with error (empty title is invalid)
      await act(async () => {
        try {
          await result.current.createPrompt({
            title: '',
            content: 'Test',
            category: 'Test'
          });
        } catch {
          // Expected to throw
        }
      });

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('State Management', () => {
    it('should maintain prompts state across multiple operations', async () => {
      // Arrange - Add Test category
      await chrome.storage.local.set({
        prompts: mockPrompts,
        categories: [
          { id: 'default', name: 'General' },
          { id: 'dev', name: 'Development' },
          { id: 'work', name: 'Work' },
          { id: 'test', name: 'Test' }
        ]
      });

      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Create a prompt
      await act(async () => {
        await result.current.createPrompt({
          title: 'Fourth Prompt',
          content: 'Fourth content',
          category: 'Test'
        });
      });

      await waitFor(() => {
        expect(result.current.prompts).toHaveLength(4);
      });

      // Act - Delete a prompt
      await act(async () => {
        await result.current.deletePrompt('2');
      });

      // Assert - State should reflect both operations
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify through storage
      const data = await chrome.storage.local.get('prompts');
      const prompts = data.prompts as Prompt[];

      expect(prompts).toHaveLength(3);
      expect(prompts.some(p => p.title === 'Fourth Prompt')).toBe(true);
      expect(prompts.find(p => p.id === '2')).toBeUndefined();
      expect(result.current.prompts).toHaveLength(3);
      expect(result.current.prompts.find(p => p.title === 'Fourth Prompt')).toBeDefined();
      expect(result.current.prompts.find(p => p.id === '2')).toBeUndefined();
    });

    it('should handle concurrent operations correctly', async () => {
      // Arrange - Add Test category
      await chrome.storage.local.set({
        prompts: mockPrompts,
        categories: [
          { id: 'default', name: 'General' },
          { id: 'dev', name: 'Development' },
          { id: 'work', name: 'Work' },
          { id: 'test', name: 'Test' }
        ]
      });

      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Create two prompts concurrently
      await act(async () => {
        await Promise.all([
          result.current.createPrompt({
            title: 'Prompt 4',
            content: 'Content 4',
            category: 'Test'
          }),
          result.current.createPrompt({
            title: 'Prompt 5',
            content: 'Content 5',
            category: 'Test'
          })
        ]);
      });

      // Assert - Both prompts should be added
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify through storage (tests mutex locking)
      const data = await chrome.storage.local.get('prompts');
      const prompts = data.prompts as Prompt[];

      expect(prompts).toHaveLength(5);
      expect(prompts.some(p => p.title === 'Prompt 4')).toBe(true);
      expect(prompts.some(p => p.title === 'Prompt 5')).toBe(true);
      expect(result.current.prompts).toHaveLength(5);
      expect(result.current.prompts.find(p => p.title === 'Prompt 4')).toBeDefined();
      expect(result.current.prompts.find(p => p.title === 'Prompt 5')).toBeDefined();
    });
  });
});

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PromptManager } from '../../services/promptManager';
import { StorageManager } from '../../services/storage';
import type { Prompt, AppError } from '../../types';
import { usePrompts } from '../usePrompts';

// Mock StorageManager
vi.mock('../../services/storage', () => {
  const mockStorageManager = {
    getPrompts: vi.fn(),
    deletePrompt: vi.fn()
  };

  return {
    StorageManager: {
      getInstance: () => mockStorageManager
    }
  };
});

// Mock PromptManager
vi.mock('../../services/promptManager', () => {
  const mockPromptManager = {
    createPrompt: vi.fn(),
    updatePrompt: vi.fn()
  };

  return {
    PromptManager: {
      getInstance: () => mockPromptManager
    }
  };
});

describe('usePrompts', () => {
  const mockStorageManager = StorageManager.getInstance();
  const mockPromptManager = PromptManager.getInstance();

  // Test data
  const mockPrompts: Prompt[] = [
    {
      id: '1',
      title: 'React Hooks Guide',
      content: 'Learn about useState and useEffect',
      category: 'Development',
      createdAt: 1000,
      updatedAt: 1000,
      usageCount: 5,
      lastUsedAt: 1000
    },
    {
      id: '2',
      title: 'TypeScript Tips',
      content: 'Advanced TypeScript patterns',
      category: 'Development',
      createdAt: 2000,
      updatedAt: 2000,
      usageCount: 3,
      lastUsedAt: 2000
    },
    {
      id: '3',
      title: 'Meeting Notes',
      content: 'Quarterly planning discussion',
      category: 'Work',
      createdAt: 3000,
      updatedAt: 3000,
      usageCount: 1,
      lastUsedAt: 3000
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    vi.mocked(mockStorageManager.getPrompts).mockResolvedValue([]);
  });

  describe('Loading', () => {
    it('should load prompts on mount', async () => {
      // Arrange
      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);

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
      expect(mockStorageManager.getPrompts).toHaveBeenCalled();
    });

    it('should set loading state while fetching', async () => {
      // Arrange
      vi.mocked(mockStorageManager.getPrompts).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockPrompts), 100))
      );

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
      // Arrange
      const error: AppError = {
        message: 'Failed to load prompts',
        type: 'storage_error'
      };
      vi.mocked(mockStorageManager.getPrompts).mockRejectedValue(error);

      // Act
      const { result } = renderHook(() => usePrompts());

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.prompts).toEqual([]);
    });
  });

  describe('CRUD Operations', () => {
    it('should create a new prompt', async () => {
      // Arrange
      const newPrompt: Prompt = {
        id: '4',
        title: 'New Prompt',
        content: 'New content',
        category: 'Test',
        createdAt: 4000,
        updatedAt: 4000,
        usageCount: 0,
        lastUsedAt: 4000
      };

      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
      vi.mocked(mockPromptManager.createPrompt).mockResolvedValue(newPrompt);

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Create prompt
      await act(async () => {
        await result.current.createPrompt({
          title: 'New Prompt',
          content: 'New content',
          category: 'Test'
        });
      });

      // Assert
      expect(mockPromptManager.createPrompt).toHaveBeenCalledWith('New Prompt', 'New content', 'Test');
      expect(result.current.prompts).toContainEqual(newPrompt);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should update an existing prompt', async () => {
      // Arrange
      const updatedPrompt: Prompt = {
        ...mockPrompts[0],
        title: 'Updated Title',
        updatedAt: 5000
      };

      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
      vi.mocked(mockPromptManager.updatePrompt).mockResolvedValue(updatedPrompt);

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Update prompt
      await act(async () => {
        await result.current.updatePrompt('1', { title: 'Updated Title' });
      });

      // Assert
      expect(mockPromptManager.updatePrompt).toHaveBeenCalledWith('1', { title: 'Updated Title' });
      expect(result.current.prompts.find(p => p.id === '1')?.title).toBe('Updated Title');
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should delete a prompt', async () => {
      // Arrange
      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
      vi.mocked(mockStorageManager.deletePrompt).mockResolvedValue(undefined);

      const { result} = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.prompts).toHaveLength(3);

      // Act - Delete prompt
      await act(async () => {
        await result.current.deletePrompt('2');
      });

      // Assert
      expect(mockStorageManager.deletePrompt).toHaveBeenCalledWith('2');
      expect(result.current.prompts).toHaveLength(2);
      expect(result.current.prompts.find(p => p.id === '2')).toBeUndefined();
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should refresh prompts list after operations', async () => {
      // Arrange
      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCallCount = vi.mocked(mockStorageManager.getPrompts).mock.calls.length;

      // Act - Manually refresh
      await act(async () => {
        await result.current.refreshPrompts();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockStorageManager.getPrompts).toHaveBeenCalledTimes(initialCallCount + 1);
      expect(result.current.prompts).toEqual(mockPrompts);
    });

    it('should re-throw errors from create operation', async () => {
      // Arrange
      const error: AppError = {
        message: 'Create failed',
        type: 'validation_error'
      };

      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
      vi.mocked(mockPromptManager.createPrompt).mockRejectedValue(error);

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.createPrompt({
            title: 'Test',
            content: 'Test content',
            category: 'Test'
          })
        ).rejects.toEqual(error);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.loading).toBe(false);
    });

    it('should re-throw errors from update operation', async () => {
      // Arrange
      const error: AppError = {
        message: 'Update failed',
        type: 'storage_error'
      };

      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
      vi.mocked(mockPromptManager.updatePrompt).mockRejectedValue(error);

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.updatePrompt('1', { title: 'New Title' })
        ).rejects.toEqual(error);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.loading).toBe(false);
    });

    it('should re-throw errors from delete operation', async () => {
      // Arrange
      const error: AppError = {
        message: 'Delete failed',
        type: 'storage_error'
      };

      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
      vi.mocked(mockStorageManager.deletePrompt).mockRejectedValue(error);

      const { result } = renderHook(() => usePrompts());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(result.current.deletePrompt('1')).rejects.toEqual(error);
      });

      expect(result.current.error).toEqual(error);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Search', () => {
    beforeEach(async () => {
      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
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
        {
          id: '5',
          title: 'C++ Guide',
          content: 'Learn C++ basics',
          category: 'Development',
          createdAt: 5000,
          updatedAt: 5000,
          usageCount: 0,
          lastUsedAt: 5000
        }
      ];

      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(specialPrompts);
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
      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
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
      // Arrange
      const loadError: AppError = {
        message: 'Failed to load',
        type: 'storage_error'
      };
      vi.mocked(mockStorageManager.getPrompts).mockRejectedValue(loadError);

      // Act
      const { result } = renderHook(() => usePrompts());

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(loadError);
      expect(result.current.prompts).toEqual([]);
    });

    it('should clear error state on successful operation', async () => {
      // Arrange - First load fails
      const error: AppError = {
        message: 'Initial load failed',
        type: 'storage_error'
      };
      vi.mocked(mockStorageManager.getPrompts).mockRejectedValueOnce(error);

      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });

      // Act - Refresh with success
      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);

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
      const createError: AppError = {
        message: 'Create failed',
        type: 'validation_error'
      };

      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
      vi.mocked(mockPromptManager.createPrompt).mockRejectedValue(createError);

      const { result } = renderHook(() => usePrompts());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Create with error
      await act(async () => {
        try {
          await result.current.createPrompt({
            title: 'Test',
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

      expect(result.current.error).toEqual(createError);
    });
  });

  describe('State Management', () => {
    it('should maintain prompts state across multiple operations', async () => {
      // Arrange
      const newPrompt: Prompt = {
        id: '4',
        title: 'Fourth Prompt',
        content: 'Fourth content',
        category: 'Test',
        createdAt: 4000,
        updatedAt: 4000,
        usageCount: 0,
        lastUsedAt: 4000
      };

      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
      vi.mocked(mockPromptManager.createPrompt).mockResolvedValue(newPrompt);
      vi.mocked(mockStorageManager.deletePrompt).mockResolvedValue(undefined);

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

      expect(result.current.prompts).toHaveLength(3);
      expect(result.current.prompts.find(p => p.id === '4')).toBeDefined();
      expect(result.current.prompts.find(p => p.id === '2')).toBeUndefined();
    });

    it('should handle concurrent operations correctly', async () => {
      // Arrange
      const prompt1: Prompt = {
        id: '4',
        title: 'Prompt 4',
        content: 'Content 4',
        category: 'Test',
        createdAt: 4000,
        updatedAt: 4000,
        usageCount: 0,
        lastUsedAt: 4000
      };

      const prompt2: Prompt = {
        id: '5',
        title: 'Prompt 5',
        content: 'Content 5',
        category: 'Test',
        createdAt: 5000,
        updatedAt: 5000,
        usageCount: 0,
        lastUsedAt: 5000
      };

      vi.mocked(mockStorageManager.getPrompts).mockResolvedValue(mockPrompts);
      vi.mocked(mockPromptManager.createPrompt)
        .mockResolvedValueOnce(prompt1)
        .mockResolvedValueOnce(prompt2);

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

      expect(result.current.prompts).toHaveLength(5);
      expect(result.current.prompts.find(p => p.id === '4')).toBeDefined();
      expect(result.current.prompts.find(p => p.id === '5')).toBeDefined();
    });
  });
});

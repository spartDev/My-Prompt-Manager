import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { buildCategory } from '../../test/builders';
import type { Category } from '../../types';
import { DEFAULT_CATEGORY } from '../../types';
import { useCategories } from '../useCategories';

describe('useCategories', () => {
  const mockCategories: Category[] = [
    buildCategory({ id: 'cat-1', name: DEFAULT_CATEGORY }),
    buildCategory({ id: 'cat-2', name: 'Development', color: '#3B82F6' }),
    buildCategory({ id: 'cat-3', name: 'Design', color: '#8B5CF6' })
  ];

  beforeEach(async () => {
    // Initialize storage with default data
    await chrome.storage.local.set({
      prompts: [],
      categories: [],
      settings: {
        defaultCategory: DEFAULT_CATEGORY,
        sortOrder: 'updatedAt',
        sortDirection: 'desc',
        theme: 'light'
      }
    });
  });

  describe('Loading', () => {
    it('should load categories on mount', async () => {
      // Arrange - Seed storage with test data
      await chrome.storage.local.set({ categories: mockCategories });

      // Act
      const { result } = renderHook(() => useCategories());

      // Assert - Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.categories).toEqual([]);
      expect(result.current.error).toBeNull();

      // Wait for categories to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.categories).toEqual(mockCategories);
      expect(result.current.error).toBeNull();
    });

    it('should set loading state while fetching', async () => {
      // Arrange - Seed storage
      await chrome.storage.local.set({ categories: mockCategories });

      // Act
      const { result } = renderHook(() => useCategories());

      // Assert - Should be loading
      expect(result.current.loading).toBe(true);
      expect(result.current.categories).toEqual([]);

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.categories).toEqual(mockCategories);
    });

    it('should handle load errors gracefully', async () => {
      // Arrange - Simulate storage failure
      const getSpy = vi.spyOn(chrome.storage.local, 'get');
      getSpy.mockRejectedValueOnce(new Error('Failed to load categories'));

      // Act
      const { result } = renderHook(() => useCategories());

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.categories).toEqual([]);

      getSpy.mockRestore();
    });
  });

  describe('Creating Categories', () => {
    it('should create a new category', async () => {
      // Arrange - Seed storage
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.categories).toHaveLength(3);

      // Act
      await act(async () => {
        await result.current.createCategory({ name: 'Testing', color: '#10B981' });
      });

      // Assert - Verify through storage
      const data = await chrome.storage.local.get('categories');
      const categories = data.categories as Category[];

      expect(categories).toHaveLength(4);
      expect(categories.some(c => c.name === 'Testing')).toBe(true);
      expect(categories.find(c => c.name === 'Testing')?.color).toBe('#10B981');
      expect(result.current.categories).toHaveLength(4);
      expect(result.current.categories.some(c => c.name === 'Testing')).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should validate category name is not empty', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.createCategory({ name: '' })
        ).rejects.toThrow();
      });

      // Verify storage unchanged
      const data = await chrome.storage.local.get('categories');
      expect(data.categories).toEqual(mockCategories);
      expect(result.current.error).toBeTruthy();
    });

    it('should validate category name is unique', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.createCategory({ name: 'Development' })
        ).rejects.toThrow();
      });

      // Verify storage unchanged
      const data = await chrome.storage.local.get('categories');
      expect(data.categories).toEqual(mockCategories);
      expect(result.current.error).toBeTruthy();
    });

    it('should handle creation errors', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate storage failure
      const setSpy = vi.spyOn(chrome.storage.local, 'set');
      setSpy.mockRejectedValueOnce(new Error('Storage quota exceeded'));

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.createCategory({ name: 'New Category' })
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);

      setSpy.mockRestore();
    });

    it('should set loading state during creation', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Start creation (don't await yet)
      act(() => {
        void result.current.createCategory({ name: 'Testing' });
      });

      // Assert - Should be loading during creation
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify category was created
      const data = await chrome.storage.local.get('categories');
      expect((data.categories as Category[]).some(c => c.name === 'Testing')).toBe(true);
    });
  });

  describe('Updating Categories', () => {
    it('should update category name', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      await act(async () => {
        await result.current.updateCategory('cat-2', { name: 'Programming' });
      });

      // Assert - Verify through storage
      const data = await chrome.storage.local.get('categories');
      const categories = data.categories as Category[];
      const updated = categories.find(c => c.id === 'cat-2');

      expect(updated?.name).toBe('Programming');
      expect(result.current.categories.find(c => c.id === 'cat-2')?.name).toBe('Programming');
      expect(result.current.error).toBeNull();
    });

    it('should update category color', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      await act(async () => {
        await result.current.updateCategory('cat-2', { color: '#EF4444' });
      });

      // Assert - Verify through storage
      const data = await chrome.storage.local.get('categories');
      const categories = data.categories as Category[];
      const updated = categories.find(c => c.id === 'cat-2');

      expect(updated?.color).toBe('#EF4444');
      expect(result.current.categories.find(c => c.id === 'cat-2')?.color).toBe('#EF4444');
    });

    it('should validate unique name on update', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert - Try to rename Development to Design (duplicate)
      await act(async () => {
        await expect(
          result.current.updateCategory('cat-2', { name: 'Design' })
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should handle validation errors on update', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.updateCategory('cat-2', { name: '' })
        ).rejects.toThrow();
      });

      // Verify storage unchanged
      const data = await chrome.storage.local.get('categories');
      expect(data.categories).toEqual(mockCategories);
      expect(result.current.error).toBeTruthy();
    });

    it('should handle update errors', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert - Try to update non-existent category
      await act(async () => {
        await expect(
          result.current.updateCategory('invalid-id', { name: 'New Name' })
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should maintain other categories when updating one', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCategoryCount = result.current.categories.length;

      // Act
      await act(async () => {
        await result.current.updateCategory('cat-2', { name: 'Updated' });
      });

      // Assert - Same number of categories
      expect(result.current.categories).toHaveLength(initialCategoryCount);
      expect(result.current.categories.find(c => c.id === 'cat-1')).toEqual(mockCategories[0]);
      expect(result.current.categories.find(c => c.id === 'cat-3')).toEqual(mockCategories[2]);
    });
  });

  describe('Deleting Categories', () => {
    it('should delete a category', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialCount = result.current.categories.length;

      // Act
      await act(async () => {
        await result.current.deleteCategory('cat-2');
      });

      // Assert - Verify through storage
      const data = await chrome.storage.local.get('categories');
      const categories = data.categories as Category[];

      expect(categories).toHaveLength(initialCount - 1);
      expect(categories.find(c => c.id === 'cat-2')).toBeUndefined();
      expect(result.current.categories).toHaveLength(initialCount - 1);
      expect(result.current.categories.find(c => c.id === 'cat-2')).toBeUndefined();
      expect(result.current.error).toBeNull();
    });

    it('should handle deletion errors', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate storage failure
      const setSpy = vi.spyOn(chrome.storage.local, 'set');
      setSpy.mockRejectedValueOnce(new Error('Cannot delete the default category'));

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.deleteCategory('cat-1')
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();

      setSpy.mockRestore();
    });

    it('should handle category not found error', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.deleteCategory('invalid-id')
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();
    });

    it('should maintain remaining categories after deletion', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      await act(async () => {
        await result.current.deleteCategory('cat-2');
      });

      // Assert - Other categories still exist
      expect(result.current.categories.find(c => c.id === 'cat-1')).toEqual(mockCategories[0]);
      expect(result.current.categories.find(c => c.id === 'cat-3')).toEqual(mockCategories[2]);
    });

    it('should set loading state during deletion', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Start deletion (don't await yet)
      act(() => {
        void result.current.deleteCategory('cat-2');
      });

      // Assert - Should be loading during deletion
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify category was deleted
      const data = await chrome.storage.local.get('categories');
      expect((data.categories as Category[]).find(c => c.id === 'cat-2')).toBeUndefined();
    });
  });

  describe('Refresh Categories', () => {
    it('should refresh categories list', async () => {
      // Arrange
      const initialCategories = [mockCategories[0]];
      await chrome.storage.local.set({ categories: initialCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.categories).toEqual(initialCategories);

      // Update storage directly to simulate external change
      await chrome.storage.local.set({ categories: mockCategories });

      // Act
      await act(async () => {
        await result.current.refreshCategories();
      });

      // Assert
      expect(result.current.categories).toEqual(mockCategories);
    });

    it('should handle refresh errors', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate storage failure on refresh
      const getSpy = vi.spyOn(chrome.storage.local, 'get');
      getSpy.mockRejectedValueOnce(new Error('Failed to refresh categories'));

      // Act
      await act(async () => {
        await result.current.refreshCategories();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      getSpy.mockRestore();
    });
  });

  describe('Error State Management', () => {
    it('should clear error state on successful operation after error', async () => {
      // Arrange
      await chrome.storage.local.set({ categories: mockCategories });

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Create with error (empty name)
      await act(async () => {
        await expect(
          result.current.createCategory({ name: '' })
        ).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();

      // Act - Create successfully
      await act(async () => {
        await result.current.createCategory({ name: 'Valid Category' });
      });

      // Assert - Error should be cleared
      expect(result.current.error).toBeNull();
    });

    it('should clear error state at the start of operations', async () => {
      // Arrange - Simulate initial load error
      const getSpy = vi.spyOn(chrome.storage.local, 'get');
      getSpy.mockRejectedValueOnce(new Error('Initial load error'));

      const { result } = renderHook(() => useCategories());

      // Wait for initial load error
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Restore normal storage behavior
      getSpy.mockRestore();
      await chrome.storage.local.set({ categories: mockCategories });

      // Act - Attempt create (will clear error state)
      await act(async () => {
        await result.current.createCategory({ name: 'New Category' });
      });

      // Assert - Error cleared
      expect(result.current.error).toBeNull();
    });
  });
});

import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PromptManager } from '../../services/promptManager';
import { StorageManager } from '../../services/storage';
import { Category, DEFAULT_CATEGORY, ErrorType } from '../../types';
import { useCategories } from '../useCategories';

// Mock StorageManager
vi.mock('../../services/storage', () => {
  const mockStorageManager = {
    getCategories: vi.fn(),
    saveCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn()
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
    validateCategoryData: vi.fn()
  };

  return {
    PromptManager: {
      getInstance: () => mockPromptManager
    }
  };
});

describe('useCategories', () => {
  const mockStorageManager = StorageManager.getInstance();
  const mockPromptManager = PromptManager.getInstance();

  const mockCategories: Category[] = [
    { id: 'cat-1', name: DEFAULT_CATEGORY },
    { id: 'cat-2', name: 'Development', color: '#3B82F6' },
    { id: 'cat-3', name: 'Design', color: '#8B5CF6' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default resolved value
    vi.mocked(mockStorageManager.getCategories).mockResolvedValue(mockCategories);
  });

  describe('Loading', () => {
    it('should load categories on mount', async () => {
      // Arrange
      vi.mocked(mockStorageManager.getCategories).mockResolvedValue(mockCategories);

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
      expect(mockStorageManager.getCategories).toHaveBeenCalledTimes(1);
    });

    it('should set loading state while fetching', async () => {
      // Arrange
      vi.mocked(mockStorageManager.getCategories).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockCategories), 100))
      );

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
      // Arrange
      const loadError = new Error('Failed to load categories');
      vi.mocked(mockStorageManager.getCategories).mockRejectedValue(loadError);

      // Act
      const { result } = renderHook(() => useCategories());

      // Assert - Wait for error state
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(loadError);
      expect(result.current.categories).toEqual([]);
    });
  });

  describe('Creating Categories', () => {
    it('should create a new category', async () => {
      // Arrange
      const newCategory: Category = { id: 'cat-4', name: 'Testing', color: '#10B981' };
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.saveCategory).mockResolvedValue(newCategory);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      await act(async () => {
        await result.current.createCategory({ name: 'Testing', color: '#10B981' });
      });

      // Assert
      expect(mockPromptManager.validateCategoryData).toHaveBeenCalledWith({
        name: 'Testing',
        color: '#10B981'
      });
      expect(mockStorageManager.saveCategory).toHaveBeenCalledWith({
        name: 'Testing',
        color: '#10B981'
      });
      expect(result.current.categories).toContainEqual(newCategory);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should validate category name is not empty', async () => {
      // Arrange
      const validationError = {
        type: ErrorType.VALIDATION_ERROR,
        message: 'Category name cannot be empty'
      };
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(validationError as any);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.createCategory({ name: '' })
        ).rejects.toEqual(validationError);
      });

      expect(mockStorageManager.saveCategory).not.toHaveBeenCalled();
      expect(result.current.error).toEqual(validationError);
    });

    it('should validate category name is unique', async () => {
      // Arrange
      const duplicateError = new Error('Category with name "Development" already exists');
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.saveCategory).mockRejectedValue(duplicateError);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.createCategory({ name: 'Development' })
        ).rejects.toThrow('Category with name "Development" already exists');
      });

      expect(result.current.error).toEqual(duplicateError);
    });

    it('should handle creation errors', async () => {
      // Arrange
      const storageError = new Error('Storage quota exceeded');
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.saveCategory).mockRejectedValue(storageError);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.createCategory({ name: 'New Category' })
        ).rejects.toThrow('Storage quota exceeded');
      });

      expect(result.current.error).toEqual(storageError);
      expect(result.current.loading).toBe(false);
    });

    it('should set loading state during creation', async () => {
      // Arrange
      const newCategory: Category = { id: 'cat-4', name: 'Testing' };
      let resolveCreate: (value: Category) => void;
      const createPromise = new Promise<Category>((resolve) => {
        resolveCreate = resolve;
      });

      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.saveCategory).mockReturnValue(createPromise);

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

      // Complete the creation
      await act(async () => {
        if (resolveCreate) {
          resolveCreate(newCategory);
        }
        await createPromise;
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Updating Categories', () => {
    it('should update category name', async () => {
      // Arrange
      const updatedCategory: Category = { ...mockCategories[1], name: 'Programming' };
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.updateCategory).mockResolvedValue(updatedCategory);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      await act(async () => {
        await result.current.updateCategory('cat-2', { name: 'Programming' });
      });

      // Assert
      expect(mockPromptManager.validateCategoryData).toHaveBeenCalledWith({ name: 'Programming' });
      expect(mockStorageManager.updateCategory).toHaveBeenCalledWith('cat-2', { name: 'Programming' });
      expect(result.current.categories.find(c => c.id === 'cat-2')?.name).toBe('Programming');
      expect(result.current.error).toBeNull();
    });

    it('should update category color', async () => {
      // Arrange
      const updatedCategory: Category = { ...mockCategories[1], color: '#EF4444' };
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.updateCategory).mockResolvedValue(updatedCategory);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      await act(async () => {
        await result.current.updateCategory('cat-2', { color: '#EF4444' });
      });

      // Assert
      expect(mockPromptManager.validateCategoryData).toHaveBeenCalledWith({ color: '#EF4444' });
      expect(mockStorageManager.updateCategory).toHaveBeenCalledWith('cat-2', { color: '#EF4444' });
      expect(result.current.categories.find(c => c.id === 'cat-2')?.color).toBe('#EF4444');
    });

    it('should validate unique name on update', async () => {
      // Arrange
      const duplicateError = new Error('Category with name "Design" already exists');
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.updateCategory).mockRejectedValue(duplicateError);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert - Try to rename Development to Design (duplicate)
      await act(async () => {
        await expect(
          result.current.updateCategory('cat-2', { name: 'Design' })
        ).rejects.toThrow('Category with name "Design" already exists');
      });

      expect(result.current.error).toEqual(duplicateError);
    });

    it('should handle validation errors on update', async () => {
      // Arrange
      const validationError = {
        type: ErrorType.VALIDATION_ERROR,
        message: 'Category name cannot be empty'
      };
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(validationError as any);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.updateCategory('cat-2', { name: '' })
        ).rejects.toEqual(validationError);
      });

      expect(mockStorageManager.updateCategory).not.toHaveBeenCalled();
      expect(result.current.error).toEqual(validationError);
    });

    it('should handle update errors', async () => {
      // Arrange
      const updateError = new Error('Category not found');
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.updateCategory).mockRejectedValue(updateError);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.updateCategory('invalid-id', { name: 'New Name' })
        ).rejects.toThrow('Category not found');
      });

      expect(result.current.error).toEqual(updateError);
    });

    it('should maintain other categories when updating one', async () => {
      // Arrange
      const updatedCategory: Category = { ...mockCategories[1], name: 'Updated' };
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.updateCategory).mockResolvedValue(updatedCategory);

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
      vi.mocked(mockStorageManager.deleteCategory).mockResolvedValue();

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

      // Assert
      expect(mockStorageManager.deleteCategory).toHaveBeenCalledWith('cat-2');
      expect(result.current.categories).toHaveLength(initialCount - 1);
      expect(result.current.categories.find(c => c.id === 'cat-2')).toBeUndefined();
      expect(result.current.error).toBeNull();
    });

    it('should handle deletion errors', async () => {
      // Arrange
      const deleteError = new Error('Cannot delete the default category');
      vi.mocked(mockStorageManager.deleteCategory).mockRejectedValue(deleteError);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.deleteCategory('cat-1')
        ).rejects.toThrow('Cannot delete the default category');
      });

      expect(result.current.error).toEqual(deleteError);
    });

    it('should handle category not found error', async () => {
      // Arrange
      const notFoundError = new Error('Category with id invalid-id not found');
      vi.mocked(mockStorageManager.deleteCategory).mockRejectedValue(notFoundError);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await act(async () => {
        await expect(
          result.current.deleteCategory('invalid-id')
        ).rejects.toThrow('Category with id invalid-id not found');
      });

      expect(result.current.error).toEqual(notFoundError);
    });

    it('should maintain remaining categories after deletion', async () => {
      // Arrange
      vi.mocked(mockStorageManager.deleteCategory).mockResolvedValue();

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
      let resolveDelete: () => void;
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });

      vi.mocked(mockStorageManager.deleteCategory).mockReturnValue(deletePromise);

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

      // Complete the deletion
      await act(async () => {
        if (resolveDelete) {
          resolveDelete();
        }
        await deletePromise;
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Refresh Categories', () => {
    it('should refresh categories list', async () => {
      // Arrange
      const initialCategories = [mockCategories[0]];
      const updatedCategories = [...mockCategories];

      vi.mocked(mockStorageManager.getCategories)
        .mockResolvedValueOnce(initialCategories)
        .mockResolvedValueOnce(updatedCategories);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.categories).toEqual(initialCategories);

      // Act
      await act(async () => {
        await result.current.refreshCategories();
      });

      // Assert
      expect(result.current.categories).toEqual(updatedCategories);
      expect(mockStorageManager.getCategories).toHaveBeenCalledTimes(2);
    });

    it('should handle refresh errors', async () => {
      // Arrange
      const refreshError = new Error('Failed to refresh categories');
      vi.mocked(mockStorageManager.getCategories)
        .mockResolvedValueOnce(mockCategories)
        .mockRejectedValueOnce(refreshError);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      await act(async () => {
        await result.current.refreshCategories();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.error).toEqual(refreshError);
      });
    });
  });

  describe('Error State Management', () => {
    it('should clear error state on successful operation after error', async () => {
      // Arrange
      const validationError = {
        type: ErrorType.VALIDATION_ERROR,
        message: 'Category name cannot be empty'
      };
      const newCategory: Category = { id: 'cat-4', name: 'Valid Category' };

      vi.mocked(mockPromptManager.validateCategoryData)
        .mockReturnValueOnce(validationError as any)
        .mockReturnValueOnce(null);
      vi.mocked(mockStorageManager.saveCategory).mockResolvedValue(newCategory);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - Create with error
      await act(async () => {
        await expect(
          result.current.createCategory({ name: '' })
        ).rejects.toEqual(validationError);
      });

      expect(result.current.error).toEqual(validationError);

      // Act - Create successfully
      await act(async () => {
        await result.current.createCategory({ name: 'Valid Category' });
      });

      // Assert - Error should be cleared
      expect(result.current.error).toBeNull();
    });

    it('should clear error state at the start of operations', async () => {
      // Arrange
      const loadError = new Error('Initial load error');
      const newCategory: Category = { id: 'cat-4', name: 'New Category' };

      vi.mocked(mockStorageManager.getCategories).mockRejectedValueOnce(loadError);
      vi.mocked(mockPromptManager.validateCategoryData).mockReturnValue(null);
      vi.mocked(mockStorageManager.saveCategory).mockResolvedValue(newCategory);

      const { result } = renderHook(() => useCategories());

      // Wait for initial load error
      await waitFor(() => {
        expect(result.current.error).toEqual(loadError);
      });

      // Act - Attempt create (will clear error state)
      vi.mocked(mockStorageManager.getCategories).mockResolvedValue([newCategory]);

      await act(async () => {
        await result.current.createCategory({ name: 'New Category' });
      });

      // Assert - Error cleared
      expect(result.current.error).toBeNull();
    });
  });
});

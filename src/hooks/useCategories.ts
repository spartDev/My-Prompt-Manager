import { useCallback, useEffect, useState } from 'react';

import { PromptManager } from '../services/promptManager';
import { StorageManager } from '../services/storage';
import type { AppError, Category, DeletedCategory } from '../types';
import type { UseCategoriesReturn } from '../types/hooks';

// The services are singletons, read where they are used, so no callback depends on them
export const useCategories = (): UseCategoriesReturn => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);

  const refreshCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allCategories = await StorageManager.getInstance().getCategories();
      setCategories(allCategories);
    } catch (err) {
      setError(err as AppError);
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolves to the Category as stored: its name is the admitted one, so callers select that
  const createCategory = useCallback(async (category: Omit<Category, 'id'>): Promise<Category> => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate category data
      const validationError = PromptManager.getInstance().validateCategoryData(category);
      if (validationError) {
        throw validationError;
      }
      
      const newCategory = await StorageManager.getInstance().saveCategory(category);
      
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } catch (err) {
      setError(err as AppError);
      throw err; // Re-throw for component error handling
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolves to the Category as stored, its name admitted
  const updateCategory = useCallback(async (id: string, updates: Partial<Category>): Promise<Category> => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate category data
      const validationError = PromptManager.getInstance().validateCategoryData(updates);
      if (validationError) {
        throw validationError;
      }
      
      const updatedCategory = await StorageManager.getInstance().updateCategory(id, updates);
      
      setCategories(prev => 
        prev.map(category => category.id === id ? updatedCategory : category)
      );
      return updatedCategory;
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolves to what the deletion changed, which restoreCategory takes to undo it
  const deleteCategory = useCallback(async (id: string): Promise<DeletedCategory> => {
    try {
      setLoading(true);
      setError(null);
      
      const deleted = await StorageManager.getInstance().deleteCategory(id);
      
      setCategories(prev => prev.filter(category => category.id !== id));
      return deleted;
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Undoes a deletion: the Category comes back at its place
  const restoreCategory = useCallback(async (deleted: DeletedCategory): Promise<Category> => {
    try {
      setLoading(true);
      setError(null);

      const restored = await StorageManager.getInstance().restoreCategory(deleted);

      setCategories(prev => {
        const next = prev.filter(category => category.id !== restored.id);
        next.splice(Math.min(deleted.index, next.length), 0, restored);
        return next;
      });
      return restored;
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void refreshCategories();
  }, [refreshCategories]);

  return {
    categories,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    restoreCategory,
    refreshCategories
  };
};
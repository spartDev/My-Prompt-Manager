import { useCallback, useEffect, useState } from 'react';

import { PromptManager } from '../services/promptManager';
import { StorageManager } from '../services/storage';
import type { AppError, Category } from '../types';
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

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
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
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      await StorageManager.getInstance().deleteCategory(id);
      
      setCategories(prev => prev.filter(category => category.id !== id));
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
    refreshCategories
  };
};
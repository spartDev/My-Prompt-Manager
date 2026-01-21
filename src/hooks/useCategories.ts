import { useState, useEffect, useCallback } from 'react';

import { PromptManager } from '../services/promptManager';
import { StorageManager } from '../services/storage';
import { Category, AppError } from '../types';
import { UseCategoriesReturn } from '../types/hooks';

export const useCategories = (): UseCategoriesReturn => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);

  const storageManager = StorageManager.getInstance();
  const promptManager = PromptManager.getInstance();

  const refreshCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allCategories = await storageManager.getCategories();
      setCategories(allCategories);
    } catch (err) {
      setError(err as AppError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Singleton storageManager never changes, omitted to prevent infinite loop

  const createCategory = useCallback(async (category: Omit<Category, 'id'>) => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate category data
      const validationError = promptManager.validateCategoryData(category);
      if (validationError) {
        throw validationError;
      }
      
      const newCategory = await storageManager.saveCategory(category);
      
      setCategories(prev => [...prev, newCategory]);
    } catch (err) {
      setError(err as AppError);
      throw err; // Re-throw for component error handling
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Singletons storageManager/promptManager never change, omitted to prevent infinite loop

  const updateCategory = useCallback(async (id: string, updates: Partial<Category>) => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate category data
      const validationError = promptManager.validateCategoryData(updates);
      if (validationError) {
        throw validationError;
      }
      
      const updatedCategory = await storageManager.updateCategory(id, updates);
      
      setCategories(prev => 
        prev.map(category => category.id === id ? updatedCategory : category)
      );
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Singletons storageManager/promptManager never change, omitted to prevent infinite loop

  const deleteCategory = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      await storageManager.deleteCategory(id);
      
      setCategories(prev => prev.filter(category => category.id !== id));
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Singleton storageManager never changes, omitted to prevent infinite loop

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
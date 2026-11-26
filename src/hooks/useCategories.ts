import { useCallback, useEffect, useState } from 'react';

import { PromptManager } from '../services/promptManager';
import { StorageManager } from '../services/storage';
import type { AppError, Category, DeletedCategory } from '../types';
import type { UseCategoriesReturn } from '../types/hooks';

import { useNewestRead } from './useNewestRead';

// The services are singletons, read where they are used, so no callback depends on them
export const useCategories = (): UseCategoriesReturn => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);
  const readNewest = useNewestRead();

  // Never rejects: resolves to true once the Categories are read, to false when the read failed, its
  // error then in `error` (Try again says which, My-Prompt-Manager-p4y9). Only the newest read counts:
  // one that ends after a newer one has started changes neither the Categories, the error nor
  // `loading`, and resolves to the newer read's outcome (useNewestRead, My-Prompt-Manager-7v5k)
  const refreshCategories = useCallback((): Promise<boolean> => {
    setLoading(true);
    setError(null);
    return readNewest(() => StorageManager.getInstance().getCategories(), (outcome) => {
      if (outcome.ok) {
        setCategories(outcome.value);
      } else {
        setError(outcome.error as AppError);
      }
      setLoading(false);
    });
  }, [readNewest]);

  // A failed create, update, delete or restore is not stored as `error`: App treats that as a failed
  // read and replaces the Library. The rejection reaches the caller, which shows it.
  // Resolves to the Category as stored: its name is the admitted one, so callers select that
  const createCategory = useCallback(async (category: Omit<Category, 'id'>): Promise<Category> => {
    try {
      setLoading(true);

      // Validate category data
      const validationError = PromptManager.getInstance().validateCategoryData(category);
      if (validationError) {
        throw validationError;
      }
      
      const newCategory = await StorageManager.getInstance().saveCategory(category);
      
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolves to the Category as stored, its name admitted
  const updateCategory = useCallback(async (id: string, updates: Partial<Category>): Promise<Category> => {
    try {
      setLoading(true);

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
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolves to what the deletion changed, which restoreCategory takes to undo it
  const deleteCategory = useCallback(async (id: string): Promise<DeletedCategory> => {
    try {
      setLoading(true);

      const deleted = await StorageManager.getInstance().deleteCategory(id);
      
      setCategories(prev => prev.filter(category => category.id !== id));
      return deleted;
    } finally {
      setLoading(false);
    }
  }, []);

  // Undoes a deletion: the Category comes back at its place
  const restoreCategory = useCallback(async (deleted: DeletedCategory): Promise<Category> => {
    try {
      setLoading(true);

      const restored = await StorageManager.getInstance().restoreCategory(deleted);

      setCategories(prev => {
        const next = prev.filter(category => category.id !== restored.id);
        next.splice(Math.min(deleted.index, next.length), 0, restored);
        return next;
      });
      return restored;
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
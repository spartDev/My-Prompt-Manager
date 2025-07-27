import { useState, useEffect, useCallback } from 'react';

import { PromptManager } from '../services/promptManager';
import { StorageManager } from '../services/storage';
import { Prompt, AppError } from '../types';
import { UsePromptsReturn } from '../types/hooks';

export const usePrompts = (): UsePromptsReturn => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);

  const storageManager = StorageManager.getInstance();
  const promptManager = PromptManager.getInstance();

  const refreshPrompts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allPrompts = await storageManager.getPrompts();
      setPrompts(allPrompts);
    } catch (err) {
      setError(err as AppError);
    } finally {
      setLoading(false);
    }
  }, [storageManager]);

  const createPrompt = useCallback(async (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      setError(null);
      
      const newPrompt = await promptManager.createPrompt(
        prompt.title,
        prompt.content,
        prompt.category
      );
      
      setPrompts(prev => [...prev, newPrompt]);
    } catch (err) {
      setError(err as AppError);
      throw err; // Re-throw for component error handling
    } finally {
      setLoading(false);
    }
  }, [promptManager]);

  const updatePrompt = useCallback(async (id: string, updates: Partial<Prompt>) => {
    try {
      setLoading(true);
      setError(null);
      
      const updatedPrompt = await promptManager.updatePrompt(id, updates);
      
      setPrompts(prev => 
        prev.map(prompt => prompt.id === id ? updatedPrompt : prompt)
      );
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [promptManager]);

  const deletePrompt = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      await storageManager.deletePrompt(id);
      
      setPrompts(prev => prev.filter(prompt => prompt.id !== id));
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [storageManager]);

  const searchPrompts = useCallback((query: string): Prompt[] => {
    if (!query.trim()) {
      return prompts;
    }

    const searchTerm = query.toLowerCase().trim();
    return prompts.filter(prompt => 
      prompt.title.toLowerCase().includes(searchTerm) ||
      prompt.content.toLowerCase().includes(searchTerm) ||
      prompt.category.toLowerCase().includes(searchTerm)
    );
  }, [prompts]);

  const filterByCategory = useCallback((category: string | null): Prompt[] => {
    if (!category) {
      return prompts;
    }
    return prompts.filter(prompt => prompt.category === category);
  }, [prompts]);

  // Initial load
  useEffect(() => {
    void refreshPrompts();
  }, [refreshPrompts]);

  return {
    prompts,
    loading,
    error,
    createPrompt,
    updatePrompt,
    deletePrompt,
    searchPrompts,
    filterByCategory,
    refreshPrompts
  };
};
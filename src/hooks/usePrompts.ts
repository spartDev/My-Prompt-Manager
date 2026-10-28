import { useCallback, useEffect, useState } from 'react';

import { PromptManager } from '../services/promptManager';
import { StorageManager } from '../services/storage';
import type { AppError, Prompt } from '../types';
import type { UsePromptsReturn } from '../types/hooks';

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
  }, []); // Singleton storageManager never changes, omitted to prevent infinite loop

  // A failed create, update or delete is not stored as `error`: App treats that as a load
  // failure and replaces the Library. The rejection reaches the caller, which shows it.
  const createPrompt = useCallback(async (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'>) => {
    try {
      setLoading(true);

      const newPrompt = await promptManager.createPrompt(
        prompt.title,
        prompt.content,
        prompt.category
      );

      setPrompts(prev => [...prev, newPrompt]);
    } finally {
      setLoading(false);
    }
  }, []); // Singleton promptManager never changes, omitted to prevent infinite loop

  const updatePrompt = useCallback(async (id: string, updates: Partial<Prompt>) => {
    try {
      setLoading(true);

      const updatedPrompt = await promptManager.updatePrompt(id, updates);

      setPrompts(prev =>
        prev.map(prompt => prompt.id === id ? updatedPrompt : prompt)
      );
    } finally {
      setLoading(false);
    }
  }, []); // Singleton promptManager never changes, omitted to prevent infinite loop

  const deletePrompt = useCallback(async (id: string) => {
    try {
      setLoading(true);

      await storageManager.deletePrompt(id);

      setPrompts(prev => prev.filter(prompt => prompt.id !== id));
    } finally {
      setLoading(false);
    }
  }, []); // Singleton storageManager never changes, omitted to prevent infinite loop

  // No loading state: pinning is instant and must not flash the Library
  // Errors are not stored as `error`: App treats that as a load failure and
  // replaces the Library. The rejection reaches the caller, which shows a toast.
  const togglePin = useCallback(async (id: string) => {
    const updatedPrompt = await storageManager.togglePinned(id);

    setPrompts(prev =>
      prev.map(prompt => prompt.id === id ? updatedPrompt : prompt)
    );
  }, []); // Singleton storageManager never changes, omitted to prevent infinite loop

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
    togglePin,
    searchPrompts,
    filterByCategory,
    refreshPrompts
  };
};

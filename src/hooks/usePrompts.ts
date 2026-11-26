import { useCallback, useEffect, useState } from 'react';

import { PromptManager } from '../services/promptManager';
import { StorageManager } from '../services/storage';
import type { AppError, Prompt } from '../types';
import type { UsePromptsReturn } from '../types/hooks';

import { useNewestRead } from './useNewestRead';

// The services are singletons, read where they are used, so no callback depends on them
export const usePrompts = (): UsePromptsReturn => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);
  const readNewest = useNewestRead();

  // Never rejects: resolves to true once the Prompts are read, to false when the read failed, its
  // error then in `error` (Try again says which, My-Prompt-Manager-p4y9). Only the newest read counts:
  // one that ends after a newer one has started changes neither the Prompts, the error nor `loading`,
  // and resolves to the newer read's outcome (useNewestRead, My-Prompt-Manager-7v5k)
  const refreshPrompts = useCallback((): Promise<boolean> => {
    setLoading(true);
    setError(null);
    return readNewest(() => StorageManager.getInstance().getPrompts(), (outcome) => {
      if (outcome.ok) {
        setPrompts(outcome.value);
      } else {
        setError(outcome.error as AppError);
      }
      setLoading(false);
    });
  }, [readNewest]);

  // A failed create, update or delete is not stored as `error`: App treats that as a load
  // failure and replaces the Library. The rejection reaches the caller, which shows it.
  const createPrompt = useCallback(async (prompt: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt'>) => {
    try {
      setLoading(true);

      const newPrompt = await PromptManager.getInstance().createPrompt(
        prompt.title,
        prompt.content,
        prompt.category
      );

      setPrompts(prev => [...prev, newPrompt]);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePrompt = useCallback(async (id: string, updates: Partial<Prompt>) => {
    try {
      setLoading(true);

      const updatedPrompt = await PromptManager.getInstance().updatePrompt(id, updates);

      setPrompts(prev =>
        prev.map(prompt => prompt.id === id ? updatedPrompt : prompt)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePrompt = useCallback(async (id: string) => {
    try {
      setLoading(true);

      await StorageManager.getInstance().deletePrompt(id);

      setPrompts(prev => prev.filter(prompt => prompt.id !== id));
    } finally {
      setLoading(false);
    }
  }, []);

  // No loading state: pinning is instant and must not flash the Library
  // Errors are not stored as `error`: App treats that as a load failure and
  // replaces the Library. The rejection reaches the caller, which shows a toast.
  const togglePin = useCallback(async (id: string) => {
    const updatedPrompt = await StorageManager.getInstance().togglePinned(id);

    setPrompts(prev =>
      prev.map(prompt => prompt.id === id ? updatedPrompt : prompt)
    );
  }, []);

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

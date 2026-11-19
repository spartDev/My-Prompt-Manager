import { useCallback } from 'react';

import { type AddPacksResult, StorageManager } from '../services/storage';
import type { UseCategoriesReturn, UsePromptsReturn } from '../types/hooks';
import type { PromptPack } from '../welcome/types';

/** The reloads of the Library's state, from usePrompts and useCategories. */
export type LibraryRefresh = Pick<UsePromptsReturn, 'refreshPrompts'> & Pick<UseCategoriesReturn, 'refreshCategories'>;

/**
 * The add the Welcome's last step calls: adds the chosen Packs to the Library (StorageManager.addPacks,
 * all or nothing), then reads the Prompts and the Categories again, so the Library lists them as soon
 * as the add resolves. A refused add rejects to the caller, which shows it, with nothing written and
 * nothing reloaded.
 */
export const useAddPacks = ({ refreshPrompts, refreshCategories }: LibraryRefresh): ((packs: readonly PromptPack[]) => Promise<AddPacksResult>) =>
  useCallback(async (packs: readonly PromptPack[]): Promise<AddPacksResult> => {
    const result = await StorageManager.getInstance().addPacks(packs);
    await Promise.all([refreshPrompts(), refreshCategories()]);
    return result;
  }, [refreshPrompts, refreshCategories]);

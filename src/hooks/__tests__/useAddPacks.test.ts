import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AddPacksResult } from '../../services/storage';
import { DEFAULT_CATEGORY } from '../../types';
import type { PromptPack } from '../../welcome/types';
import { useAddPacks } from '../useAddPacks';
import { useCategories } from '../useCategories';
import { usePrompts } from '../usePrompts';

/** The Packs here are fixtures, not the Packs the Welcome offers. */
const writing: PromptPack = {
  id: 'writing',
  name: 'Writing',
  color: '#9333EA',
  defaultSelected: true,
  prompts: [
    { title: 'Follow-up email', content: 'Write a follow-up email to {{name}} and end with one clear next step.' },
    { title: 'Tighten', content: 'Make this text shorter without losing its meaning:\n\n{{text}}' }
  ]
};

/** The Library as App holds it: the Prompts, the Categories, and the add the Welcome calls. */
const renderLibrary = () =>
  renderHook(() => {
    const prompts = usePrompts();
    const categories = useCategories();
    const addPacks = useAddPacks({
      refreshPrompts: prompts.refreshPrompts,
      refreshCategories: categories.refreshCategories
    });
    return { prompts, categories, addPacks };
  });

describe('useAddPacks', () => {
  it('adds the Packs, and the Library lists their Prompts and Categories as soon as it resolves', async () => {
    const { result } = renderLibrary();
    await waitFor(() => {
      expect(result.current.prompts.loading || result.current.categories.loading).toBe(false);
    });

    let outcome: AddPacksResult | undefined;
    await act(async () => {
      outcome = await result.current.addPacks([writing]);
    });

    expect(outcome).toEqual({ added: 2, skipped: 0, packNames: ['Writing'] });
    expect(result.current.prompts.prompts.map(p => ({ title: p.title, category: p.category }))).toEqual([
      { title: 'Follow-up email', category: 'Writing' },
      { title: 'Tighten', category: 'Writing' }
    ]);
    expect(result.current.categories.categories.map(c => c.name)).toEqual([DEFAULT_CATEGORY, 'Writing']);
    expect(result.current.prompts.error).toBeNull();
  });

  it('rejects a refused add to its caller, the Library unchanged and no load error set', async () => {
    const { result } = renderLibrary();
    await waitFor(() => {
      expect(result.current.prompts.loading || result.current.categories.loading).toBe(false);
    });
    // The Promise form of getBytesInUse: vi.mocked would type its last overload, the callback one
    const getBytesInUse: () => Promise<number> = chrome.storage.local.getBytesInUse;
    vi.mocked(getBytesInUse).mockResolvedValue(chrome.storage.local.QUOTA_BYTES);

    await act(async () => {
      await expect(result.current.addPacks([writing])).rejects.toMatchObject({ type: 'STORAGE_QUOTA_EXCEEDED' });
    });

    expect(result.current.prompts.prompts).toEqual([]);
    expect(result.current.categories.categories.map(c => c.name)).toEqual([DEFAULT_CATEGORY]);
    expect(result.current.prompts.error).toBeNull();
    expect(result.current.categories.error).toBeNull();
  });
});

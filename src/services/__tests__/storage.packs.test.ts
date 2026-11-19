import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPrompt } from '../../test/builders';
import { FakeLockManager, installNavigatorLocks } from '../../test/utils/FakeLockManager';
import { DEFAULT_CATEGORY } from '../../types';
import { PACKS } from '../../welcome/packs';
import type { PromptPack } from '../../welcome/types';
import { AdmissionRefusedError } from '../promptAdmission';
import { StorageManager } from '../storage';

/**
 * Adding Packs, the Welcome's last step (CONTEXT.md, Pack): a route of Admission that fills a new
 * user's Library at once, all or nothing, and adds nothing the Library already has, so the owner
 * can finish the Welcome again and again in Debug mode without duplicating a Prompt.
 *
 * The Packs here are fixtures, not the Packs the Welcome offers.
 */
describe('StorageManager.addPacks', () => {
  const NOW = new Date('2026-11-18T09:00:00Z').getTime();

  const product: PromptPack = {
    id: 'product',
    name: 'Product',
    color: '#2563EB',
    defaultSelected: true,
    prompts: [
      { title: 'User story', content: 'Write a user story for {{feature}} with acceptance criteria.' },
      { title: 'Release note', content: 'Turn these changes into a release note for users:\n\n{{changes}}' },
      { title: 'Interview questions', content: 'List five open questions to ask {{persona}} about {{problem}}.' }
    ]
  };

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

  const packPromptCount = product.prompts.length + writing.prompts.length;

  const stored = async (): Promise<{ prompts: unknown; categories: unknown }> => {
    const { prompts, categories } = await chrome.storage.local.get(['prompts', 'categories']);
    return { prompts, categories };
  };

  const storedPrompts = async (): Promise<{ id: string; title: string; content: string; category: string }[]> =>
    ((await chrome.storage.local.get('prompts')).prompts ?? []) as { id: string; title: string; content: string; category: string }[];

  const storedCategories = async (): Promise<{ id: string; name: string; color?: string }[]> =>
    ((await chrome.storage.local.get('categories')).categories ?? []) as { id: string; name: string; color?: string }[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('on the empty Library of a first install', () => {
    it('adds every Prompt of two Packs, in two new Categories with the Packs\' colors, in one write', async () => {
      const result = await StorageManager.getInstance().addPacks([product, writing]);

      expect(result).toEqual({ added: packPromptCount, skipped: 0, packNames: ['Product', 'Writing'] });
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);

      const categories = await storedCategories();
      expect(categories.map(({ name, color }) => ({ name, color }))).toEqual([
        { name: DEFAULT_CATEGORY, color: undefined },
        { name: 'Product', color: '#2563EB' },
        { name: 'Writing', color: '#9333EA' }
      ]);
      expect(new Set(categories.map(c => c.id)).size).toBe(3);

      const prompts = await storedPrompts();
      expect(prompts.map(({ title, content, category }) => ({ title, content, category }))).toEqual([
        ...product.prompts.map(p => ({ ...p, category: 'Product' })),
        ...writing.prompts.map(p => ({ ...p, category: 'Writing' }))
      ]);
      expect(prompts[0]).toMatchObject({ createdAt: NOW, updatedAt: NOW, usageCount: 0, lastUsedAt: NOW });
      expect(new Set(prompts.map(p => p.id)).size).toBe(packPromptCount);
    });

    it('takes every Pack the Welcome offers: each Prompt admitted as it is written, none skipped, none refused', async () => {
      const result = await StorageManager.getInstance().addPacks(PACKS);

      const offered = PACKS.flatMap(pack => pack.prompts.map(({ title, content }) => ({ title, content, category: pack.name })));
      expect(result).toEqual({ added: offered.length, skipped: 0, packNames: PACKS.map(pack => pack.name) });
      // Verbatim: Admission changes nothing in them
      expect((await storedPrompts()).map(({ title, content, category }) => ({ title, content, category }))).toEqual(offered);
      expect((await storedCategories()).map(({ name, color }) => ({ name, color }))).toEqual([
        { name: DEFAULT_CATEGORY, color: undefined },
        ...PACKS.map(({ name, color }) => ({ name, color }))
      ]);
    });

    it('reads back as the Library: getPrompts and getCategories list what was added', async () => {
      const storage = StorageManager.getInstance();
      await storage.addPacks([product, writing]);

      expect((await storage.getPrompts()).map(p => p.title)).toEqual([
        ...product.prompts.map(p => p.title),
        ...writing.prompts.map(p => p.title)
      ]);
      expect((await storage.getCategories()).map(c => c.name)).toEqual([DEFAULT_CATEGORY, 'Product', 'Writing']);
    });
  });

  describe('a second time, as the owner finishes the Welcome again in Debug mode', () => {
    it('adds nothing, skips every Prompt, and writes nothing', async () => {
      const storage = StorageManager.getInstance();
      await storage.addPacks([product, writing]);
      const before = await stored();
      vi.mocked(chrome.storage.local.set).mockClear();

      const result = await storage.addPacks([product, writing]);

      expect(result).toEqual({ added: 0, skipped: packPromptCount, packNames: [] });
      expect(await stored()).toEqual(before);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('adds only the Pack that was not added before', async () => {
      const storage = StorageManager.getInstance();
      await storage.addPacks([product]);

      const result = await storage.addPacks([product, writing]);

      expect(result).toEqual({ added: writing.prompts.length, skipped: product.prompts.length, packNames: ['Writing'] });
      expect((await storedPrompts()).map(p => p.title)).toEqual([
        ...product.prompts.map(p => p.title),
        ...writing.prompts.map(p => p.title)
      ]);
      expect((await storedCategories()).map(c => c.name)).toEqual([DEFAULT_CATEGORY, 'Product', 'Writing']);
    });
  });

  describe('on a Library that already has Prompts and Categories', () => {
    const existingWriting = { id: 'own-writing', name: 'writing', color: '#0F766E' };

    beforeEach(async () => {
      await chrome.storage.local.set({
        categories: [{ id: 'default', name: DEFAULT_CATEGORY }, existingWriting],
        prompts: [
          // The same content as a Writing Prompt, under another title
          buildPrompt({ id: 'mine-1', title: 'My follow-up', content: writing.prompts[0].content, category: 'writing' }),
          // The same title as a Writing Prompt, with other content
          buildPrompt({ id: 'mine-2', title: 'Tighten', content: 'Cut this to one paragraph.', category: DEFAULT_CATEGORY })
        ]
      });
    });

    it('reuses the Category "writing" for the Pack "Writing", keeping its spelling and color', async () => {
      await StorageManager.getInstance().addPacks([writing]);

      expect(await storedCategories()).toEqual([{ id: 'default', name: DEFAULT_CATEGORY }, existingWriting]);
      const added = (await storedPrompts()).filter(p => !p.id.startsWith('mine-'));
      expect(added.map(p => p.category)).toEqual(['writing']);
    });

    it('skips a Prompt whose content the Library has, and adds one that only shares a title', async () => {
      const result = await StorageManager.getInstance().addPacks([writing]);

      expect(result).toEqual({ added: 1, skipped: 1, packNames: ['Writing'] });
      const prompts = await storedPrompts();
      expect(prompts.filter(p => p.content === writing.prompts[0].content).map(p => p.id)).toEqual(['mine-1']);
      expect(prompts.filter(p => p.title === 'Tighten').map(p => p.content)).toEqual([
        'Cut this to one paragraph.',
        writing.prompts[1].content
      ]);
    });

    it('skips a Prompt whose content differs from the Library\'s only by surrounding spaces', async () => {
      await chrome.storage.local.set({
        prompts: [buildPrompt({ id: 'mine-3', content: `${product.prompts[0].content}\n` })]
      });

      const result = await StorageManager.getInstance().addPacks([product]);

      expect(result).toMatchObject({ added: product.prompts.length - 1, skipped: 1 });
    });

    it('keeps the stored entries it cannot read', async () => {
      const malformedCategory = { color: '#000000' };
      const malformedPrompt = { title: 'No id', content: 'Kept as it is' };
      await chrome.storage.local.set({
        categories: [{ id: 'default', name: DEFAULT_CATEGORY }, malformedCategory],
        prompts: [malformedPrompt]
      });

      await StorageManager.getInstance().addPacks([product]);

      expect(await storedCategories()).toContainEqual(malformedCategory);
      expect(await storedPrompts()).toContainEqual(malformedPrompt);
    });
  });

  describe('Admission', () => {
    it('stores a Pack Prompt with a Hidden character admitted: the character removed, the rest Verbatim', async () => {
      const hidden: PromptPack = {
        ...writing,
        prompts: [{ title: ' Follow\u200B-up ', content: '  Write to {{name}}\u202E and stop.\n' }]
      };

      await StorageManager.getInstance().addPacks([hidden]);

      expect(await storedPrompts()).toEqual([
        expect.objectContaining({ title: 'Follow-up', content: '  Write to {{name}} and stop.\n', category: 'Writing' })
      ]);
    });

    it('admits the Pack name as a Category name: a Hidden character in it does not make a second Category', async () => {
      await chrome.storage.local.set({ categories: [{ id: 'default', name: DEFAULT_CATEGORY }, { id: 'w', name: 'Writing' }] });

      await StorageManager.getInstance().addPacks([{ ...writing, name: 'Wri\u200Bting ' }]);

      expect((await storedCategories()).map(c => c.name)).toEqual([DEFAULT_CATEGORY, 'Writing']);
    });

    it('skips a Prompt of the Packs whose content an earlier Prompt of the Packs has', async () => {
      const echo: PromptPack = { ...product, id: 'echo', name: 'Echo', prompts: [writing.prompts[0]] };

      const result = await StorageManager.getInstance().addPacks([writing, echo]);

      expect(result).toEqual({ added: writing.prompts.length, skipped: 1, packNames: ['Writing'] });
      expect((await storedCategories()).map(c => c.name)).toEqual([DEFAULT_CATEGORY, 'Writing']);
    });

    it('skips a Prompt whose content an earlier Prompt of the same Pack has, keeping the first one\'s title', async () => {
      const repeated: PromptPack = {
        ...writing,
        prompts: [writing.prompts[0], writing.prompts[1], { title: 'Same text, other title', content: writing.prompts[0].content }]
      };

      const result = await StorageManager.getInstance().addPacks([repeated]);

      expect(result).toEqual({ added: 2, skipped: 1, packNames: ['Writing'] });
      expect((await storedPrompts()).map(({ title, content }) => ({ title, content }))).toEqual(writing.prompts.map(({ title, content }) => ({ title, content })));
    });

    it('refuses every Pack when one Prompt is refused, and writes nothing', async () => {
      const refused: PromptPack = { ...product, prompts: [...product.prompts, { title: 'Too long', content: 'x'.repeat(20_001) }] };

      const adding = StorageManager.getInstance().addPacks([writing, refused]);

      await expect(adding).rejects.toBeInstanceOf(AdmissionRefusedError);
      await expect(adding).rejects.toMatchObject({ errors: { content: { reason: 'too_long' } } });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('drops a Pack color that is not a hex color rather than store it', async () => {
      await StorageManager.getInstance().addPacks([{ ...writing, color: 'purple' }]);

      expect(await storedCategories()).toContainEqual({ id: expect.any(String), name: 'Writing' });
    });
  });

  describe('a refusal for space writes nothing and throws the StorageError', () => {
    const library = (count: number, content: string) =>
      Array.from({ length: count }, (_, i) => buildPrompt({ id: `p-${String(i)}`, title: `Prompt ${String(i)}`, content: `${content} ${String(i)}` }));

    const expectNothingWritten = async (adding: Promise<unknown>, before: unknown): Promise<void> => {
      await expect(adding).rejects.toMatchObject({ name: 'StorageError', type: 'STORAGE_QUOTA_EXCEEDED' });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(await stored()).toEqual(before);
    };

    it('when the Prompts would pass the 5,000 Prompt limit', async () => {
      await chrome.storage.local.set({ prompts: library(5000 - packPromptCount + 1, 'Body') });
      const before = await stored();
      vi.mocked(chrome.storage.local.set).mockClear();

      const adding = StorageManager.getInstance().addPacks([product, writing]);

      await expectNothingWritten(adding, before);
      await expect(adding).rejects.toMatchObject({ details: { current: 5000 - packPromptCount + 1, max: 5000 } });
    });

    it('takes Packs that fill the Library up to the 5,000 Prompt limit exactly', async () => {
      await chrome.storage.local.set({ prompts: library(5000 - packPromptCount, 'Body') });

      await expect(StorageManager.getInstance().addPacks([product, writing])).resolves.toMatchObject({ added: packPromptCount });
      expect(await storedPrompts()).toHaveLength(5000);
    });

    it('when the Prompts would pass the 8 MB Library cap', async () => {
      const chinese = '中'.repeat(19_000);
      await chrome.storage.local.set({ prompts: library(139, chinese) });
      const before = await stored();
      vi.mocked(chrome.storage.local.set).mockClear();

      const heavy: PromptPack = { ...writing, prompts: [{ title: 'Heavy', content: chinese }] };
      const adding = StorageManager.getInstance().addPacks([heavy]);

      await expectNothingWritten(adding, before);
      await expect(adding).rejects.toMatchObject({
        message: 'Storage quota exceeded. Please delete old prompts to free up space.',
        details: { max: 8_000_000 }
      });
    });

    it('when Chrome storage has no room left for them', async () => {
      // The Promise form of getBytesInUse: vi.mocked would type its last overload, the callback one
      const getBytesInUse: () => Promise<number> = chrome.storage.local.getBytesInUse;
      vi.mocked(getBytesInUse).mockResolvedValue(chrome.storage.local.QUOTA_BYTES - 100);
      const before = await stored();
      const adding = StorageManager.getInstance().addPacks([product, writing]);

      await expectNothingWritten(adding, before);
      await expect(adding).rejects.toMatchObject({ details: { estimatedSize: expect.any(Number), available: 100 } });
    });
  });

  describe('across contexts', () => {
    let uninstall: () => void;

    /** A StorageManager of its own context: its own memory, the shared storage and the shared locks. */
    const context = (): StorageManager => Reflect.construct(StorageManager, []);

    beforeEach(() => {
      vi.useRealTimers();
      uninstall = installNavigatorLocks(new FakeLockManager());
    });

    afterEach(() => {
      uninstall();
    });

    it('two adds of the same Packs at once, in the popup and the side panel, leave no duplicate', async () => {
      // The first read of the Prompts is slow, so without the locks the second add would read the empty Library too
      const read = vi.mocked(chrome.storage.local.get).getMockImplementation() as unknown as (
        keys: unknown
      ) => Promise<Record<string, unknown>>;
      let slowed = false;
      vi.mocked(chrome.storage.local.get).mockImplementation(async (keys) => {
        const result = await read(keys);
        if (!slowed && String(keys) === 'prompts') {
          slowed = true;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return result;
      });

      const results = await Promise.all([context().addPacks([product, writing]), context().addPacks([product, writing])]);

      expect(results.map(r => r.added).sort()).toEqual([0, packPromptCount]);
      expect(results.map(r => r.skipped).sort()).toEqual([0, packPromptCount]);
      const contents = (await storedPrompts()).map(p => p.content);
      expect(contents).toHaveLength(packPromptCount);
      expect(new Set(contents).size).toBe(packPromptCount);
      expect((await storedCategories()).map(c => c.name)).toEqual([DEFAULT_CATEGORY, 'Product', 'Writing']);
    });

    it('takes the Categories lock, then the Prompts lock', async () => {
      uninstall();
      const locks = new FakeLockManager();
      uninstall = installNavigatorLocks(locks);

      await context().addPacks([product]);

      expect(locks.log.filter(entry => entry.startsWith('acquire'))).toEqual([
        'acquire StorageManager:categories',
        'acquire StorageManager:prompts'
      ]);
    });
  });
});

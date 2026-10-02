import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DEFAULT_CATEGORY } from '../../types';
import { StorageManager } from '../storage';

/**
 * The one-time upgrade pass (ADR-001, "Existing data"): stored Prompts and Categories are
 * cleaned of Hidden characters once, on extension update. It is idempotent and never
 * refuses, deletes, trims or shortens a stored Prompt, including one already over the limits.
 */
describe('StorageManager.upgradeStoredData', () => {
  let storageManager: StorageManager;

  const storedPrompts = async (): Promise<unknown> => (await chrome.storage.local.get('prompts')).prompts;
  const storedCategories = async (): Promise<unknown> => (await chrome.storage.local.get('categories')).categories;

  /** Seeds storage, then forgets the seeding so a test can assert on what the upgrade itself writes. */
  const seed = async (data: Record<string, unknown>): Promise<void> => {
    await chrome.storage.local.set(data);
    vi.mocked(chrome.storage.local.set).mockClear();
  };

  const prompt = (id: string, fields: Record<string, unknown> = {}): Record<string, unknown> => ({
    id,
    title: `Title ${id}`,
    content: `Body ${id}`,
    category: 'Work',
    createdAt: 1,
    updatedAt: 2,
    usageCount: 3,
    lastUsedAt: 4,
    ...fields
  });

  beforeEach(async () => {
    storageManager = StorageManager.getInstance();

    await chrome.storage.local.set({
      prompts: [],
      categories: [
        { id: 'default', name: DEFAULT_CATEGORY },
        { id: 'c1', name: 'Work' }
      ],
      settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
    });
  });

  describe('stored Prompts', () => {
    it('removes Hidden characters from title, content and category, and reports it', async () => {
      await chrome.storage.local.set({
        prompts: [
          prompt('p1', { title: 'Ti\u{200B}tle', content: 'Bo\u{202E}dy\u{0007}', category: 'Wo\u{2060}rk' }),
          prompt('p2')
        ]
      });

      const result = await storageManager.upgradeStoredData();

      expect(result).toEqual({ promptsChanged: true, categoriesChanged: false });
      expect(await storedPrompts()).toEqual([
        prompt('p1', { title: 'Title', content: 'Body', category: 'Work' }),
        prompt('p2')
      ]);
    });

    it('keeps a legacy over-limit Prompt and malformed entries, cleaning only the Hidden characters', async () => {
      const malformed = [null, 'text', { id: 7 }];
      const overLimit = prompt('long', { content: `${'y'.repeat(22_000)}\u{200B}` });
      await seed({ prompts: [...malformed, overLimit] });

      const result = await storageManager.upgradeStoredData();

      expect(result.promptsChanged).toBe(true);
      expect(await storedPrompts()).toEqual([...malformed, prompt('long', { content: 'y'.repeat(22_000) })]);
    });

    it('does not trim, and keeps unknown fields and ordinary invisible characters', async () => {
      const entry = prompt('p1', {
        title: ' \u{200B}Padded title  ',
        content: '\n  Body \u{1F468}\u{200D}\u{1F469}\u{200E}\n\n',
        futureField: { kept: true }
      });
      await seed({ prompts: [entry] });

      await storageManager.upgradeStoredData();

      expect(await storedPrompts()).toEqual([
        { ...entry, title: ' Padded title  ', content: '\n  Body \u{1F468}\u{200D}\u{1F469}\u{200E}\n\n' }
      ]);
    });

    it('writes nothing when there is nothing to clean', async () => {
      await seed({ prompts: [prompt('p1'), null, 'text'] });

      const result = await storageManager.upgradeStoredData();

      expect(result).toEqual({ promptsChanged: false, categoriesChanged: false });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('writes nothing on a second run', async () => {
      await seed({ prompts: [prompt('p1', { title: 'Ti\u{200B}tle' })] });
      await storageManager.upgradeStoredData();
      vi.mocked(chrome.storage.local.set).mockClear();

      const result = await storageManager.upgradeStoredData();

      expect(result).toEqual({ promptsChanged: false, categoriesChanged: false });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('does nothing, and creates nothing, when no Prompts have ever been stored', async () => {
      await chrome.storage.local.clear();
      vi.mocked(chrome.storage.local.set).mockClear();

      const result = await storageManager.upgradeStoredData();

      expect(result).toEqual({ promptsChanged: false, categoriesChanged: false });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('stored Categories', () => {
    it('removes Hidden characters from Category names, and reports it', async () => {
      await seed({
        categories: [
          { id: 'default', name: DEFAULT_CATEGORY },
          { id: 'c1', name: ' Wo\u{200B}rk ', color: '#112233' }
        ]
      });

      const result = await storageManager.upgradeStoredData();

      expect(result).toEqual({ promptsChanged: false, categoriesChanged: true });
      expect(await storedCategories()).toEqual([
        { id: 'default', name: DEFAULT_CATEGORY },
        { id: 'c1', name: ' Work ', color: '#112233' }
      ]);
    });

    it("merges 'Work' and 'Work' + U+200B into one Category, and no Prompt is left without its Category", async () => {
      await seed({
        categories: [
          { id: 'default', name: DEFAULT_CATEGORY },
          { id: 'c1', name: 'Work' },
          { id: 'c2', name: 'Work\u{200B}', color: '#ffffff' }
        ],
        prompts: [prompt('p1', { category: 'Work' }), prompt('p2', { category: 'Work\u{200B}' })]
      });

      await storageManager.upgradeStoredData();

      expect(await storedCategories()).toEqual([
        { id: 'default', name: DEFAULT_CATEGORY },
        { id: 'c1', name: 'Work' }
      ]);
      expect(await storedPrompts()).toEqual([prompt('p1', { category: 'Work' }), prompt('p2', { category: 'Work' })]);
    });

    it('writes nothing, and a second run writes nothing, when the names are already clean', async () => {
      await seed({ categories: [{ id: 'c1', name: 'Wo\u{200B}rk' }] });
      await storageManager.upgradeStoredData();
      vi.mocked(chrome.storage.local.set).mockClear();

      const second = await storageManager.upgradeStoredData();

      expect(second).toEqual({ promptsChanged: false, categoriesChanged: false });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('keeps the default Category and malformed entries as they are', async () => {
      const categories = [{ id: 'default', name: DEFAULT_CATEGORY }, null, 'text', { id: 7 }, { id: 'c9', name: 'Wo\u{200B}rk' }];
      await seed({ categories });

      await storageManager.upgradeStoredData();

      expect(await storedCategories()).toEqual([
        { id: 'default', name: DEFAULT_CATEGORY },
        null,
        'text',
        { id: 7 },
        { id: 'c9', name: 'Work' }
      ]);
    });
  });

  describe('Prompts and Categories together', () => {
    it('writes both keys in one atomic write', async () => {
      await seed({
        categories: [{ id: 'c1', name: 'Wo\u{200B}rk' }],
        prompts: [prompt('p1', { category: 'Wo\u{200B}rk', title: 'Ti\u{200B}tle' })]
      });

      const result = await storageManager.upgradeStoredData();

      expect(result).toEqual({ promptsChanged: true, categoriesChanged: true });
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        prompts: [prompt('p1', { title: 'Title' })],
        categories: [{ id: 'c1', name: 'Work' }]
      });
    });

    it('writes only the key that changed, and leaves settings alone', async () => {
      await seed({ prompts: [prompt('p1', { title: 'Ti\u{200B}tle' })] });
      const settings = (await chrome.storage.local.get('settings')).settings;

      await storageManager.upgradeStoredData();

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ prompts: [prompt('p1', { title: 'Title' })] });
      expect((await chrome.storage.local.get('settings')).settings).toEqual(settings);
    });
  });

  describe('failures and concurrency', () => {
    it('wraps a failed write as a StorageError, through handleStorageError', async () => {
      await seed({ prompts: [prompt('p1', { title: 'Ti\u{200B}tle' })] });
      vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'));

      await expect(storageManager.upgradeStoredData()).rejects.toMatchObject({
        name: 'StorageError',
        type: 'STORAGE_QUOTA_EXCEEDED'
      });
    });

    it('wraps a failed read as a StorageError, through handleStorageError', async () => {
      vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(new SyntaxError('Unexpected token'));

      await expect(storageManager.upgradeStoredData()).rejects.toMatchObject({
        name: 'StorageError',
        type: 'DATA_CORRUPTION'
      });
    });

    it('takes the locks in the same order as updateCategory, so running together cannot deadlock', async () => {
      await seed({
        categories: [
          { id: 'default', name: DEFAULT_CATEGORY },
          { id: 'c1', name: 'Work' },
          { id: 'c2', name: 'Play\u{200B}' }
        ],
        prompts: [prompt('p1', { category: 'Work' }), prompt('p2', { category: 'Play\u{200B}' })]
      });

      await Promise.all([
        storageManager.upgradeStoredData(),
        storageManager.updateCategory('c1', { name: 'Projects' }),
        storageManager.deleteCategory('c2')
      ]);

      expect(await storedCategories()).toEqual([
        { id: 'default', name: DEFAULT_CATEGORY },
        { id: 'c1', name: 'Projects' }
      ]);
      expect(await storedPrompts()).toMatchObject([
        { id: 'p1', category: 'Projects' },
        { id: 'p2', category: DEFAULT_CATEGORY }
      ]);
    });
  });
});

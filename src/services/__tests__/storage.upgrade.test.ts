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
    it('removes Hidden characters and surrounding spaces from Category names, and reports it', async () => {
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
        { id: 'c1', name: 'Work', color: '#112233' }
      ]);
    });

    it.each([
      ['the padded one is first', [' Work', 'Work']],
      ['the padded one is later', ['Work', ' Work']]
    ])("merges ' Work' and 'Work', made the same by trimming, and re-points their Prompts (%s)", async (_case, [first, second]) => {
      await seed({
        categories: [{ id: 'c1', name: first }, { id: 'c2', name: second }],
        prompts: [prompt('p1', { category: first }), prompt('p2', { category: second }), prompt('p3', { category: ' Work ' })]
      });

      await storageManager.upgradeStoredData();

      expect(await storedCategories()).toEqual([{ id: 'c1', name: 'Work' }]);
      expect(await storedPrompts()).toEqual([
        prompt('p1', { category: 'Work' }),
        prompt('p2', { category: 'Work' }),
        prompt('p3', { category: 'Work' })
      ]);
    });

    it('merges a name that becomes empty into the default Category, with its Prompts and the default Category setting, in one write', async () => {
      await seed({
        categories: [{ id: 'default', name: DEFAULT_CATEGORY }, { id: 'c1', name: '\u{200B}' }, { id: 'c2', name: '   ' }],
        prompts: [prompt('p1', { category: '\u{200B}' }), prompt('p2', { category: '   ' }), prompt('p3', { category: '' })],
        settings: { defaultCategory: '\u{200B}', sortOrder: 'updatedAt' }
      });

      await storageManager.upgradeStoredData();

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        prompts: [
          prompt('p1', { category: DEFAULT_CATEGORY }),
          prompt('p2', { category: DEFAULT_CATEGORY }),
          prompt('p3', { category: '' })
        ],
        categories: [{ id: 'default', name: DEFAULT_CATEGORY }],
        settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
      });
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

    it.each([
      ['the later one has the Hidden character', ['Work', 'work\u{200B}'], 'Work'],
      ['the first one has the Hidden character', ['work\u{200B}', 'Work'], 'work']
    ])("re-points the Prompts of a merged Category to the kept one's exact name, whichever is first (%s)", async (_case, [first, second], kept) => {
      await seed({
        categories: [{ id: 'default', name: DEFAULT_CATEGORY }, { id: 'c1', name: first }, { id: 'c2', name: second }],
        prompts: [prompt('p1', { category: first }), prompt('p2', { category: second })]
      });

      await storageManager.upgradeStoredData();

      expect(await storedCategories()).toEqual([{ id: 'default', name: DEFAULT_CATEGORY }, { id: 'c1', name: kept }]);
      // Re-pointing is not an edit: timestamps and usage stay exactly as they were
      expect(await storedPrompts()).toEqual([prompt('p1', { category: kept }), prompt('p2', { category: kept })]);
    });

    it.each([
      ["'work' + U+200B goes to 'work', the case-duplicate that spells it exactly", 'work\u{200B}', 'work'],
      ["'WORK' + U+200B goes to 'Work', the first kept one, as none spells it exactly", 'WORK\u{200B}', 'Work']
    ])("merges a third name into 'Work' and 'work', which are left alone (%s)", async (_case, third, kept) => {
      await seed({
        categories: [{ id: 'c1', name: 'Work' }, { id: 'c2', name: 'work' }, { id: 'c3', name: third }],
        prompts: [prompt('p1', { category: 'Work' }), prompt('p2', { category: 'work' }), prompt('p3', { category: third })]
      });

      await storageManager.upgradeStoredData();

      expect(await storedCategories()).toEqual([{ id: 'c1', name: 'Work' }, { id: 'c2', name: 'work' }]);
      expect(await storedPrompts()).toEqual([
        prompt('p1', { category: 'Work' }),
        prompt('p2', { category: 'work' }),
        prompt('p3', { category: kept })
      ]);
    });

    it('leaves names that were already the same ignoring case exactly as they are, and writes nothing', async () => {
      await seed({
        categories: [{ id: 'c1', name: 'Work' }, { id: 'c2', name: 'work' }],
        prompts: [prompt('p1', { category: 'Work' }), prompt('p2', { category: 'work' })]
      });

      const result = await storageManager.upgradeStoredData();

      expect(result).toEqual({ promptsChanged: false, categoriesChanged: false });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('writes nothing on a second run after a merge', async () => {
      await seed({
        categories: [{ id: 'c1', name: 'Work' }, { id: 'c2', name: 'work\u{200B}' }],
        prompts: [prompt('p1', { category: 'work\u{200B}' })]
      });
      await storageManager.upgradeStoredData();
      vi.mocked(chrome.storage.local.set).mockClear();

      const second = await storageManager.upgradeStoredData();

      expect(second).toEqual({ promptsChanged: false, categoriesChanged: false });
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
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

  describe('the default Category in settings', () => {
    it('cleans it of Hidden characters and re-points it through the same merges, in the same write', async () => {
      await seed({
        categories: [{ id: 'c1', name: 'Work' }, { id: 'c2', name: 'work\u{200B}' }],
        prompts: [prompt('p1', { category: 'Work' })],
        settings: { defaultCategory: 'work\u{200B}', sortOrder: 'updatedAt' }
      });

      await storageManager.upgradeStoredData();

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        categories: [{ id: 'c1', name: 'Work' }],
        settings: { defaultCategory: 'Work', sortOrder: 'updatedAt' }
      });
    });

    it('cleans and trims it even when it names no Category, without refusing it', async () => {
      await seed({ settings: { defaultCategory: ' Ho\u{200B}me ', sortOrder: 'updatedAt' } });

      await storageManager.upgradeStoredData();

      expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        settings: { defaultCategory: 'Home', sortOrder: 'updatedAt' }
      });
    });

    it('writes nothing when it is clean, when it is missing, and when there are no settings at all', async () => {
      for (const settings of [{ defaultCategory: 'Work', sortOrder: 'updatedAt' }, { sortOrder: 'updatedAt' }, undefined]) {
        await chrome.storage.local.remove('settings');
        await seed(settings === undefined ? {} : { settings });

        await storageManager.upgradeStoredData();

        expect(chrome.storage.local.set).not.toHaveBeenCalled();
      }
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

    it('takes the locks in the same order as updateCategory (CATEGORIES, PROMPTS, then SETTINGS), so running together cannot deadlock', async () => {
      await seed({
        categories: [
          { id: 'default', name: DEFAULT_CATEGORY },
          { id: 'c1', name: 'Work' },
          { id: 'c2', name: 'Play\u{200B}' }
        ],
        prompts: [prompt('p1', { category: 'Work' }), prompt('p2', { category: 'Play\u{200B}' })],
        settings: { defaultCategory: 'Play\u{200B}', sortOrder: 'updatedAt' }
      });

      await Promise.all([
        storageManager.upgradeStoredData(),
        storageManager.updateCategory('c1', { name: 'Projects' }),
        storageManager.deleteCategory('c2'),
        storageManager.updateSettings({ sortOrder: 'title' })
      ]);

      expect(await storedCategories()).toEqual([
        { id: 'default', name: DEFAULT_CATEGORY },
        { id: 'c1', name: 'Projects' }
      ]);
      expect(await storedPrompts()).toMatchObject([
        { id: 'p1', category: 'Projects' },
        { id: 'p2', category: DEFAULT_CATEGORY }
      ]);
      expect((await chrome.storage.local.get('settings')).settings).toEqual({ defaultCategory: 'Play', sortOrder: 'title' });
    });

    it('holds the SETTINGS lock while it writes, so a concurrent updateSettings cannot write a stale copy over it', async () => {
      await seed({ settings: { defaultCategory: 'Wo\u{200B}rk', sortOrder: 'updatedAt' } });
      // updateSettings reads first and is slow to write: without the lock, its stale copy would land last
      const readSettings = storageManager.getSettings.bind(storageManager);
      vi.spyOn(storageManager, 'getSettings').mockImplementationOnce(async () => {
        const settings = await readSettings();
        await new Promise((resolve) => setTimeout(resolve, 5));
        return settings;
      });

      await Promise.all([storageManager.updateSettings({ sortOrder: 'title' }), storageManager.upgradeStoredData()]);

      expect((await chrome.storage.local.get('settings')).settings).toEqual({ defaultCategory: 'Work', sortOrder: 'title' });
    });
  });
});

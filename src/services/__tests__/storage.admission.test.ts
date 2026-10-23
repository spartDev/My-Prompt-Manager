import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_CATEGORY } from '../../types';
import { AdmissionRefusedError } from '../promptAdmission';
import { StorageManager } from '../storage';

/**
 * Admission is enforced inside StorageManager's write path (ADR-001): every route that
 * puts Prompt text or a Category name into the Library is admitted the same way.
 */
describe('StorageManager Admission', () => {
  let storageManager: StorageManager;

  const storedPrompts = async (): Promise<unknown> => (await chrome.storage.local.get('prompts')).prompts;
  const storedCategories = async (): Promise<unknown> => (await chrome.storage.local.get('categories')).categories;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    storageManager = StorageManager.getInstance();

    await chrome.storage.local.set({
      prompts: [],
      categories: [{ id: 'default', name: DEFAULT_CATEGORY }],
      settings: { defaultCategory: DEFAULT_CATEGORY, sortOrder: 'updatedAt' }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('savePrompt', () => {
    it('stores the text verbatim, removing only Hidden characters', async () => {
      const saved = await storageManager.savePrompt({
        title: '  Meta\u200Bdata  ',
        content: '  Summarize the metadata: use <example>x</example> tags;\u202E if onboarding = true\n',
        category: DEFAULT_CATEGORY
      });

      expect(saved).toMatchObject({
        title: 'Metadata',
        content: '  Summarize the metadata: use <example>x</example> tags; if onboarding = true\n'
      });
      expect(await storedPrompts()).toEqual([saved]);
    });

    it('refuses text that is over the limits or empty, and leaves storage untouched', async () => {
      const before = await storedPrompts();

      const tooLong = storageManager.savePrompt({ title: 'T', content: 'x'.repeat(20_001), category: DEFAULT_CATEGORY });
      await expect(tooLong).rejects.toBeInstanceOf(AdmissionRefusedError);
      await expect(tooLong).rejects.toMatchObject({ errors: { content: { reason: 'too_long' } } });

      const empty = storageManager.savePrompt({ title: 'T', content: ' \n ', category: DEFAULT_CATEGORY });
      await expect(empty).rejects.toMatchObject({ errors: { content: { reason: 'empty' } } });

      expect(await storedPrompts()).toEqual(before);
    });
  });

  describe('updatePrompt', () => {
    const seed = {
      id: 'p1',
      title: 'Old title',
      content: 'Old body',
      category: DEFAULT_CATEGORY,
      createdAt: 1,
      updatedAt: 1,
      usageCount: 2,
      lastUsedAt: 1
    };

    it('admits the edit: Hidden characters removed, content kept verbatim', async () => {
      await chrome.storage.local.set({ prompts: [seed] });

      const updated = await storageManager.updatePrompt('p1', {
        title: ' New\u200B title ',
        content: '  <context>x</context> metadata: \n'
      });

      expect(updated).toMatchObject({
        id: 'p1',
        title: 'New title',
        content: '  <context>x</context> metadata: \n',
        usageCount: 2,
        updatedAt: Date.now()
      });
      expect(await storedPrompts()).toEqual([updated]);
    });

    it('refuses an invalid edit and leaves storage untouched', async () => {
      await chrome.storage.local.set({ prompts: [seed] });

      await expect(storageManager.updatePrompt('p1', { content: 'x'.repeat(20_001) })).rejects.toMatchObject({
        name: 'AdmissionRefusedError',
        errors: { content: { reason: 'too_long' } }
      });
      await expect(storageManager.updatePrompt('p1', { title: '  ' })).rejects.toMatchObject({
        errors: { title: { reason: 'empty' } }
      });

      expect(await storedPrompts()).toEqual([seed]);
    });

    it('keeps a legacy over-limit Prompt whole and editable in its other fields', async () => {
      // Over the 20,000-character text limit, but under StorageManager's separate byte limit
      const legacy = { ...seed, content: 'y'.repeat(22_000) };
      await chrome.storage.local.set({ prompts: [legacy] });

      const updated = await storageManager.updatePrompt('p1', { title: 'Renamed' });

      expect(updated.title).toBe('Renamed');
      expect(updated.content).toBe('y'.repeat(22_000));
    });
  });

  describe('importPrompt (Backup restore)', () => {
    const backed = {
      id: 'b1',
      title: 'Restored',
      content: 'Body',
      category: DEFAULT_CATEGORY,
      createdAt: 5,
      updatedAt: 6,
      usageCount: 4,
      lastUsedAt: 6
    };

    it('admits a new Prompt, keeping its id, usage and timestamps', async () => {
      const imported = await storageManager.importPrompt({
        ...backed,
        title: ' Restored\u{200B} ',
        content: '  <example>x</example>\n'
      });

      expect(imported).toEqual({ ...backed, content: '  <example>x</example>\n' });
      expect(await storedPrompts()).toEqual([imported]);
    });

    it('keeps the usage and createdAt of the Prompt it replaces when the Backup has none (saved before usage tracking)', async () => {
      await chrome.storage.local.set({
        prompts: [{ ...backed, title: 'Old', createdAt: 1, updatedAt: 2, usageCount: 7, lastUsedAt: 900 }]
      });
      const { usageCount: _count, lastUsedAt: _last, createdAt: _created, ...legacy } = backed;

      const imported = await storageManager.importPrompt({ ...legacy, title: 'New' } as typeof backed);

      expect(imported).toEqual({
        ...backed,
        title: 'New',
        createdAt: 1,
        usageCount: 7,
        lastUsedAt: 900,
        updatedAt: Date.now()
      });
      expect(await storedPrompts()).toEqual([imported]);
    });

    it("takes the Backup's own usage over the stored one when the Backup has it", async () => {
      await chrome.storage.local.set({ prompts: [{ ...backed, title: 'Old', usageCount: 7, lastUsedAt: 900 }] });

      const imported = await storageManager.importPrompt({ ...backed, usageCount: 2, lastUsedAt: 50 });

      expect(imported).toMatchObject({ usageCount: 2, lastUsedAt: 50 });
    });

    it('fills in missing usage with defaults for a Prompt that replaces nothing', async () => {
      const { usageCount: _count, lastUsedAt: _last, ...legacy } = backed;

      const imported = await storageManager.importPrompt(legacy as typeof backed);

      // an unused Prompt was last used when it was created
      expect(imported).toMatchObject({ usageCount: 0, lastUsedAt: 5 });
    });

    it('stamps updatedAt with the current time when it replaces an existing Prompt', async () => {
      await chrome.storage.local.set({ prompts: [{ ...backed, title: 'Old', updatedAt: 1 }] });

      const imported = await storageManager.importPrompt({ ...backed, title: 'New\u{200B}' });

      expect(imported).toEqual({ ...backed, title: 'New', updatedAt: Date.now() });
      expect(await storedPrompts()).toEqual([imported]);
    });

    it('refuses an over-limit Prompt, so the restore can skip and report it', async () => {
      const before = await storedPrompts();

      await expect(storageManager.importPrompt({ ...backed, content: 'x'.repeat(20_001) })).rejects.toBeInstanceOf(
        AdmissionRefusedError
      );

      expect(await storedPrompts()).toEqual(before);
    });

    it('rejects something that is not a Prompt', async () => {
      await expect(storageManager.importPrompt({ title: 'No id' } as never)).rejects.toThrow(/id, title or content/);
    });

    describe('its Category, which the Library may spell differently', () => {
      beforeEach(async () => {
        await chrome.storage.local.set({
          categories: [
            { id: 'default', name: DEFAULT_CATEGORY },
            { id: 'c1', name: 'Work' }
          ]
        });
      });

      it.each([
        ['a different case', 'work'],
        ['a different case once admitted', ' WORK\u{200B} ']
      ])('takes the stored spelling when the Backup names it in %s, without counting as an edit', async (_case, category) => {
        const imported = await storageManager.importPrompt({ ...backed, category });

        expect(imported).toEqual({ ...backed, category: 'Work' });
        expect(await storedPrompts()).toEqual([imported]);
      });

      it.each([
        ['an exact match', 'Work'],
        ['a name no Category has (it never invents one)', 'Play']
      ])('leaves %s as it is', async (_case, category) => {
        expect(await storageManager.importPrompt({ ...backed, category })).toEqual({ ...backed, category });
      });

      it('reads the Categories as stored, without creating the default Category', async () => {
        await chrome.storage.local.set({ categories: [{ id: 'c1', name: 'Work' }] });

        await storageManager.importPrompt({ ...backed, category: 'work' });

        expect(await storedCategories()).toEqual([{ id: 'c1', name: 'Work' }]);
      });
    });
  });

  describe('saveCategory', () => {
    it('admits the name: Hidden characters removed and trimmed', async () => {
      const saved = await storageManager.saveCategory({ name: '  Wor\u{200B}k ', color: '#112233' });

      expect(saved).toMatchObject({ name: 'Work', color: '#112233' });
      expect(await storedCategories()).toContainEqual(saved);
    });

    it('treats names that differ only by a Hidden character or surrounding spaces as the same name', async () => {
      await storageManager.saveCategory({ name: 'Work' });

      await expect(storageManager.saveCategory({ name: 'Work\u{200B}' })).rejects.toThrow(/already exists/);
      await expect(storageManager.saveCategory({ name: ' work ' })).rejects.toThrow(/already exists/);
    });

    it('refuses an empty or over-limit name and leaves storage untouched', async () => {
      const before = await storedCategories();

      await expect(storageManager.saveCategory({ name: '   ' })).rejects.toMatchObject({
        name: 'AdmissionRefusedError',
        errors: { category: { reason: 'empty' } }
      });
      await expect(storageManager.saveCategory({ name: 'x'.repeat(51) })).rejects.toMatchObject({
        errors: { category: { reason: 'too_long' } }
      });

      expect(await storedCategories()).toEqual(before);
    });
  });

  describe('updateCategory (rename and its cascade)', () => {
    const prompt = (id: string, category: string) => ({
      id,
      title: `Title ${id}`,
      content: 'Body',
      category,
      createdAt: 1,
      updatedAt: 1,
      usageCount: 0,
      lastUsedAt: 1
    });

    beforeEach(async () => {
      await chrome.storage.local.set({
        categories: [
          { id: 'default', name: DEFAULT_CATEGORY },
          { id: 'c1', name: 'Work' },
          { id: 'c2', name: 'Play' }
        ],
        prompts: [prompt('p1', 'Work'), prompt('p2', 'Play')]
      });
    });

    it('admits the new name and moves the Prompts of that Category to it', async () => {
      const renamed = await storageManager.updateCategory('c1', { name: ' Pro\u{200B}jects ' });

      expect(renamed).toEqual({ id: 'c1', name: 'Projects' });
      expect(await storedPrompts()).toEqual([
        { ...prompt('p1', 'Projects'), updatedAt: Date.now() },
        prompt('p2', 'Play')
      ]);
    });

    it('compares duplicates on the admitted name', async () => {
      await expect(storageManager.updateCategory('c2', { name: 'Work\u{200B}' })).rejects.toThrow(/already exists/);
    });

    it('refuses an empty or over-limit name and changes nothing', async () => {
      const categories = await storedCategories();
      const prompts = await storedPrompts();

      await expect(storageManager.updateCategory('c1', { name: '  ' })).rejects.toMatchObject({
        name: 'AdmissionRefusedError',
        errors: { category: { reason: 'empty' } }
      });
      await expect(storageManager.updateCategory('c1', { name: 'x'.repeat(51) })).rejects.toMatchObject({
        errors: { category: { reason: 'too_long' } }
      });

      expect(await storedCategories()).toEqual(categories);
      expect(await storedPrompts()).toEqual(prompts);
    });
  });

  describe('importCategory (Backup restore)', () => {
    it('admits the name of a new Category', async () => {
      const imported = await storageManager.importCategory({ id: 'c9', name: ' Re\u{200B}stored ', color: '#abcdef' });

      expect(imported).toEqual({ id: 'c9', name: 'Restored', color: '#abcdef' });
      expect(await storedCategories()).toContainEqual(imported);
    });

    it('matches an existing Category by its admitted name and keeps the existing id', async () => {
      await chrome.storage.local.set({
        categories: [
          { id: 'default', name: DEFAULT_CATEGORY },
          { id: 'c1', name: 'Work' }
        ]
      });

      const imported = await storageManager.importCategory({ id: 'other', name: 'Work\u{200B}' });

      expect(imported).toEqual({ id: 'c1', name: 'Work' });
      expect(await storedCategories()).toEqual([
        { id: 'default', name: DEFAULT_CATEGORY },
        { id: 'c1', name: 'Work' }
      ]);
    });

    it('refuses an empty or over-limit name, so the restore can skip and report it', async () => {
      const before = await storedCategories();

      await expect(storageManager.importCategory({ id: 'c9', name: ' ' })).rejects.toMatchObject({
        name: 'AdmissionRefusedError',
        errors: { category: { reason: 'empty' } }
      });
      await expect(storageManager.importCategory({ id: 'c9', name: 'x'.repeat(51) })).rejects.toMatchObject({
        errors: { category: { reason: 'too_long' } }
      });

      expect(await storedCategories()).toEqual(before);
    });

    describe('a name that matches a stored one ignoring case', () => {
      it.each([
        ['the Backup has the Hidden character', 'Work', 'work\u{200B}'],
        ['the Backup has the other case and the Hidden character', 'work', 'Work\u{200B}'],
        ['the Backup has surrounding spaces', 'Work', ' work ']
      ])('keeps the stored id and name, first wins, and takes the colour from the Backup (%s)', async (_case, stored, incoming) => {
        await chrome.storage.local.set({
          categories: [
            { id: 'default', name: DEFAULT_CATEGORY },
            { id: 'c1', name: stored, color: '#000000' }
          ]
        });

        const imported = await storageManager.importCategory({ id: 'c2', name: incoming, color: '#abcdef' });

        expect(imported).toEqual({ id: 'c1', name: stored, color: '#abcdef' });
        expect(await storedCategories()).toEqual([{ id: 'default', name: DEFAULT_CATEGORY }, imported]);
      });

      it("keeps the stored id and name when only the case differs ('WORK' for 'Work'), so the Library's Prompts keep their Category", async () => {
        const inWork = {
          id: 'p1',
          title: 'Title',
          content: 'Body',
          category: 'Work',
          createdAt: 5,
          updatedAt: 6,
          usageCount: 1,
          lastUsedAt: 6
        };
        await chrome.storage.local.set({
          categories: [
            { id: 'default', name: DEFAULT_CATEGORY },
            { id: 'c1', name: 'Work' }
          ],
          prompts: [inWork]
        });

        expect(await storageManager.importCategory({ id: 'c2', name: 'WORK', color: '#abcdef' })).toEqual({
          id: 'c1',
          name: 'Work',
          color: '#abcdef'
        });
        expect(await storedPrompts()).toEqual([inWork]);
      });
    });

    describe('a Backup that names a stored Category by id', () => {
      const prompt = (id: string, category: string) => ({
        id,
        title: `Title ${id}`,
        content: 'Body',
        category,
        createdAt: 5,
        updatedAt: 6,
        usageCount: 1,
        lastUsedAt: 6
      });

      beforeEach(async () => {
        await chrome.storage.local.set({
          categories: [
            { id: 'default', name: DEFAULT_CATEGORY },
            { id: 'W', name: 'Work', color: '#000000' },
            { id: 'H', name: 'Home' }
          ],
          prompts: [prompt('p1', 'Work'), prompt('p2', 'Home')]
        });
        vi.mocked(chrome.storage.local.set).mockClear();
      });

      it('renames it and moves its Prompts with it, without counting as an edit, in one atomic write', async () => {
        const imported = await storageManager.importCategory({ id: 'W', name: ' Renamed\u{200B} ', color: '#123456' });

        expect(imported).toEqual({ id: 'W', name: 'Renamed', color: '#123456' });
        expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          categories: [{ id: 'default', name: DEFAULT_CATEGORY }, imported, { id: 'H', name: 'Home' }],
          prompts: [prompt('p1', 'Renamed'), prompt('p2', 'Home')]
        });
      });

      it.each([
        ['exactly', 'Work'],
        ['ignoring case', 'WORK']
      ])("never renames it into another Category's name (%s): the stored name stays, the colour comes from the Backup", async (_case, name) => {
        const imported = await storageManager.importCategory({ id: 'H', name, color: '#123456' });

        expect(imported).toEqual({ id: 'H', name: 'Home', color: '#123456' });
        expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          categories: [{ id: 'default', name: DEFAULT_CATEGORY }, { id: 'W', name: 'Work', color: '#000000' }, imported]
        });
        expect(await storedPrompts()).toEqual([prompt('p1', 'Work'), prompt('p2', 'Home')]);
      });

      it('never renames the default Category', async () => {
        const imported = await storageManager.importCategory({ id: 'default', name: 'Everything', color: '#abcdef' });

        expect(imported).toEqual({ id: 'default', name: DEFAULT_CATEGORY, color: '#abcdef' });
        expect(await storedCategories()).toEqual([imported, { id: 'W', name: 'Work', color: '#000000' }, { id: 'H', name: 'Home' }]);
      });

      it('touches no Prompt when the name is the same', async () => {
        const imported = await storageManager.importCategory({ id: 'W', name: 'Work', color: '#abcdef' });

        expect(imported).toEqual({ id: 'W', name: 'Work', color: '#abcdef' });
        expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          categories: [{ id: 'default', name: DEFAULT_CATEGORY }, imported, { id: 'H', name: 'Home' }]
        });
      });
    });

    it('drops a colour that is not a hex colour, and keeps the Category', async () => {
      const styled = await storageManager.importCategory({
        id: 'c9',
        name: 'Styled',
        color: 'red; background-image: url(javascript:alert(1))'
      });

      expect(styled).toEqual({ id: 'c9', name: 'Styled' });
      expect(styled).not.toHaveProperty('color');
      expect(await storedCategories()).toContainEqual({ id: 'c9', name: 'Styled' });

      expect(await storageManager.importCategory({ id: 'c8', name: 'Hex', color: '#ABCDEF' })).toEqual({
        id: 'c8',
        name: 'Hex',
        color: '#ABCDEF'
      });
      expect(await storageManager.importCategory({ id: 'c7', name: 'Blank', color: '' })).toEqual({
        id: 'c7',
        name: 'Blank',
        color: ''
      });
    });

    it('gives a Category from a Backup an id when it has none, so none is ever stored without one', async () => {
      const imported = await storageManager.importCategory({ name: 'Restored' } as never);

      expect(imported.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(await storedCategories()).toContainEqual(imported);

      const numbered = await storageManager.importCategory({ id: 7, name: 'Numbered' } as never);

      expect(typeof numbered.id).toBe('string');
      expect(await storedCategories()).toContainEqual(numbered);
    });
  });

  describe('a whole Backup restored one item at a time, as SettingsView does', () => {
    const prompt = (id: string, category: string) => ({
      id,
      title: `Title ${id}`,
      content: 'Body',
      category,
      createdAt: 5,
      updatedAt: 6,
      usageCount: 1,
      lastUsedAt: 6
    });

    it.each([
      ['the later Category has the Hidden character', ['Work', 'work\u{200B}'], 'Work'],
      ['the first Category has the Hidden character', ['work\u{200B}', 'Work'], 'work']
    ])('ends with one Category and every Prompt naming it (%s)', async (_case, [first, second], kept) => {
      await storageManager.importCategory({ id: 'c1', name: first });
      await storageManager.importCategory({ id: 'c2', name: second });
      await storageManager.importPrompt(prompt('p1', first));
      await storageManager.importPrompt(prompt('p2', second));

      expect(await storedCategories()).toEqual([{ id: 'default', name: DEFAULT_CATEGORY }, { id: 'c1', name: kept }]);
      expect(await storedPrompts()).toEqual([prompt('p1', kept), prompt('p2', kept)]);
    });
  });

  describe('importData (whole-library import, currently unused by the UI)', () => {
    const settings = {
      defaultCategory: DEFAULT_CATEGORY,
      sortOrder: 'updatedAt' as const,
      sortDirection: 'desc' as const,
      theme: 'system' as const
    };
    const aPrompt = {
      id: 'i1',
      title: 'Imported',
      content: 'Body',
      category: DEFAULT_CATEGORY,
      createdAt: 1,
      updatedAt: 2,
      usageCount: 0,
      lastUsedAt: 1
    };
    const payload = (prompts: unknown[], categories: unknown[] = [{ id: 'default', name: DEFAULT_CATEGORY }]): string =>
      JSON.stringify({ prompts, categories, settings });

    it('admits every Prompt and Category before it replaces the Library', async () => {
      await storageManager.importData(
        payload(
          [{ ...aPrompt, title: ' Imported\u{200B} ', content: '  <example>x</example>\n' }],
          [{ id: 'default', name: DEFAULT_CATEGORY }, { id: 'c1', name: ' Wor\u{200B}k ' }]
        )
      );

      expect(await storedPrompts()).toEqual([{ ...aPrompt, content: '  <example>x</example>\n' }]);
      expect(await storedCategories()).toEqual([
        { id: 'default', name: DEFAULT_CATEGORY },
        { id: 'c1', name: 'Work' }
      ]);
    });

    it('refuses the whole import if any Prompt is refused, before anything is cleared', async () => {
      const existing = { ...aPrompt, id: 'keep-me' };
      await chrome.storage.local.set({ prompts: [existing] });

      await expect(
        storageManager.importData(payload([aPrompt, { ...aPrompt, id: 'i2', title: '   ' }]))
      ).rejects.toBeInstanceOf(AdmissionRefusedError);

      expect(await storedPrompts()).toEqual([existing]);
    });

    it.each([
      ['the later Category has the Hidden character', ['Work', 'work\u{200B}'], 'Work'],
      ['the first Category has the Hidden character', ['work\u{200B}', 'Work'], 'work']
    ])('merges Categories that Admission made the same name, first wins, and re-points their Prompts and the default Category (%s)', async (_case, [first, second], kept) => {
      await storageManager.importData(
        JSON.stringify({
          prompts: [{ ...aPrompt, category: first }, { ...aPrompt, id: 'i2', category: second }],
          categories: [
            { id: 'default', name: DEFAULT_CATEGORY },
            { id: 'c1', name: first, color: '#111111' },
            { id: 'c2', name: second, color: '#222222' }
          ],
          settings: { ...settings, defaultCategory: second }
        })
      );

      expect(await storedCategories()).toEqual([
        { id: 'default', name: DEFAULT_CATEGORY },
        { id: 'c1', name: kept, color: '#111111' }
      ]);
      expect(await storedPrompts()).toEqual([{ ...aPrompt, category: kept }, { ...aPrompt, id: 'i2', category: kept }]);
      expect((await chrome.storage.local.get('settings')).settings).toEqual({ ...settings, defaultCategory: kept });
    });

    it('refuses the whole import if any Category is refused, before anything is cleared or merged', async () => {
      await chrome.storage.local.set({ prompts: [{ ...aPrompt, id: 'keep-me' }] });
      const before = await chrome.storage.local.get(['prompts', 'categories', 'settings']);

      await expect(
        storageManager.importData(
          JSON.stringify({
            prompts: [{ ...aPrompt, category: 'Work' }],
            categories: [
              { id: 'default', name: DEFAULT_CATEGORY },
              { id: 'c1', name: 'Work' },
              { id: 'c2', name: 'work\u{200B}' },
              { id: 'c3', name: '   ' }
            ],
            settings
          })
        )
      ).rejects.toBeInstanceOf(AdmissionRefusedError);

      expect(await chrome.storage.local.get(['prompts', 'categories', 'settings'])).toEqual(before);
    });
  });
});

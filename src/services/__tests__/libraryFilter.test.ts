import { describe, expect, it } from 'vitest';

import { buildCategory } from '../../test/builders/buildCategory';
import { buildPrompt } from '../../test/builders/buildPrompt';
import type { LibraryFilter } from '../../types';
import {
  ALL_PROMPTS,
  applyLibraryFilter,
  getFilterableCategories,
  rankMostUsed,
  resolveLibraryFilter
} from '../libraryFilter';

const T = new Date('2025-01-01T00:00:00Z').getTime();

const work = buildCategory({ id: 'cat-work', name: 'Work' });
const personal = buildCategory({ id: 'cat-personal', name: 'Personal' });
const empty = buildCategory({ id: 'cat-empty', name: 'Empty' });

const titles = (prompts: Array<{ title: string }>) => prompts.map(p => p.title);

describe('getFilterableCategories', () => {
  it('keeps only Categories holding a Prompt, in Category order', () => {
    const prompts = [
      buildPrompt({ id: '1', category: 'Personal' }),
      buildPrompt({ id: '2', category: 'Work' })
    ];

    expect(getFilterableCategories([work, empty, personal], prompts)).toEqual([work, personal]);
  });

  it('returns nothing for an empty Library', () => {
    expect(getFilterableCategories([work, personal], [])).toEqual([]);
  });
});

describe('resolveLibraryFilter', () => {
  it('keeps All, Pinned and Most Used as they are', () => {
    const pinned: LibraryFilter = { kind: 'pinned' };
    const mostUsed: LibraryFilter = { kind: 'mostUsed' };

    expect(resolveLibraryFilter(ALL_PROMPTS, [])).toBe(ALL_PROMPTS);
    expect(resolveLibraryFilter(pinned, [])).toBe(pinned);
    expect(resolveLibraryFilter(mostUsed, [])).toBe(mostUsed);
  });

  it('keeps a Category filter while that Category holds a Prompt', () => {
    const filter: LibraryFilter = { kind: 'category', categoryId: work.id };

    expect(resolveLibraryFilter(filter, [work])).toBe(filter);
  });

  it('falls back to All when the Category is gone or holds no Prompt', () => {
    const filter: LibraryFilter = { kind: 'category', categoryId: empty.id };

    expect(resolveLibraryFilter(filter, [work, personal])).toBe(ALL_PROMPTS);
  });
});

describe('rankMostUsed', () => {
  it('keeps only Prompts inserted at least once, most inserted first', () => {
    const prompts = [
      buildPrompt({ id: '1', title: 'Never', usageCount: 0 }),
      buildPrompt({ id: '2', title: 'Twice', usageCount: 2 }),
      buildPrompt({ id: '3', title: 'Ten', usageCount: 10 }),
      buildPrompt({ id: '4', title: 'Once', usageCount: 1 })
    ];

    expect(titles(rankMostUsed(prompts))).toEqual(['Ten', 'Twice', 'Once']);
  });

  it('gives Pinned Prompts no priority', () => {
    const prompts = [
      buildPrompt({ id: '1', title: 'Pinned', usageCount: 1, pinned: true }),
      buildPrompt({ id: '2', title: 'Busy', usageCount: 50 })
    ];

    expect(titles(rankMostUsed(prompts))).toEqual(['Busy', 'Pinned']);
  });

  it('breaks ties with the most recently used first', () => {
    const prompts = [
      buildPrompt({ id: '1', title: 'Older', usageCount: 3, lastUsedAt: T - 5000 }),
      buildPrompt({ id: '2', title: 'Newer', usageCount: 3, lastUsedAt: T - 1000 })
    ];

    expect(titles(rankMostUsed(prompts))).toEqual(['Newer', 'Older']);
  });

  it('treats a missing or broken usage count as never inserted', () => {
    const legacy = { ...buildPrompt({ id: '1', title: 'Legacy' }), usageCount: undefined };
    const broken = buildPrompt({ id: '2', title: 'Broken', usageCount: Number.NaN });

    expect(rankMostUsed([legacy, broken])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const prompts = [
      buildPrompt({ id: '1', title: 'Low', usageCount: 1 }),
      buildPrompt({ id: '2', title: 'High', usageCount: 9 })
    ];

    rankMostUsed(prompts);

    expect(titles(prompts)).toEqual(['Low', 'High']);
  });
});

describe('applyLibraryFilter', () => {
  const prompts = [
    buildPrompt({ id: '1', title: 'Alpha', category: 'Work', updatedAt: T - 3000, usageCount: 4 }),
    buildPrompt({ id: '2', title: 'Bravo', category: 'Personal', updatedAt: T - 2000, pinned: true }),
    buildPrompt({ id: '3', title: 'Charlie', category: 'Work', updatedAt: T - 1000, usageCount: 7 }),
    buildPrompt({ id: '4', title: 'Delta', category: 'Work', updatedAt: T, pinned: true, usageCount: 1 })
  ];
  const categories = [work, personal];

  it('All lists every Prompt in the chosen sort, pinned first', () => {
    expect(titles(applyLibraryFilter(prompts, ALL_PROMPTS, categories, 'updatedAt')))
      .toEqual(['Delta', 'Bravo', 'Charlie', 'Alpha']);
  });

  it('Pinned lists only Pinned Prompts in the chosen sort', () => {
    expect(titles(applyLibraryFilter(prompts, { kind: 'pinned' }, categories, 'title')))
      .toEqual(['Bravo', 'Delta']);
  });

  it('Most Used ranks by use whatever the chosen sort', () => {
    expect(titles(applyLibraryFilter(prompts, { kind: 'mostUsed' }, categories, 'title')))
      .toEqual(['Charlie', 'Alpha', 'Delta']);
  });

  it('a Category lists only its Prompts, pinned first', () => {
    expect(titles(applyLibraryFilter(prompts, { kind: 'category', categoryId: work.id }, categories, 'title')))
      .toEqual(['Delta', 'Alpha', 'Charlie']);
  });

  it('a Category follows its current name, so a renamed Category keeps its Prompts', () => {
    const renamed = { ...work, name: 'Job' };
    const moved = prompts.map(p => (p.category === 'Work' ? { ...p, category: 'Job' } : p));

    expect(titles(applyLibraryFilter(moved, { kind: 'category', categoryId: work.id }, [renamed, personal], 'title')))
      .toEqual(['Delta', 'Alpha', 'Charlie']);
  });

  it('an unknown Category lists nothing', () => {
    expect(applyLibraryFilter(prompts, { kind: 'category', categoryId: 'gone' }, categories, 'title')).toEqual([]);
  });

  it('sorts each order in its natural direction', () => {
    expect(titles(applyLibraryFilter(prompts, { kind: 'category', categoryId: work.id }, categories, 'usageCount')))
      .toEqual(['Delta', 'Charlie', 'Alpha']);
  });
});

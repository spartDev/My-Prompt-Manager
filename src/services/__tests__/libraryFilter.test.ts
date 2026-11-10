import { describe, expect, it, vi } from 'vitest';

import { buildCategory } from '../../test/builders/buildCategory';
import { buildPrompt } from '../../test/builders/buildPrompt';
import type { LibraryFilter, Prompt } from '../../types';
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

  it('ranks a Library of 1000 Prompts with the built-in sort, in at most n log2 n comparisons', () => {
    // Counted, not timed: a duration depends on the machine, a count does not. Two counts, taken
    // while rankMostUsed runs and read before any assertion touches the Prompts:
    // - the calls of the comparator given to Array.prototype.sort;
    // - the reads of usageCount, which a hand-written quadratic loop over the Prompts multiplies.
    // A ranking that sorts cached values with its own loop makes no comparator call, and fails on that
    const SIZE = 1000;
    let seed = 42;
    const next = (max: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed % max;
    };
    let reads = 0;
    const prompts = Array.from({ length: SIZE }, (_, i) =>
      new Proxy(buildPrompt({ id: String(i), usageCount: 1 + next(100), lastUsedAt: T - next(1_000_000) }), {
        get(target, key, receiver) {
          if (key === 'usageCount') {
            reads++;
          }
          return Reflect.get(target, key, receiver) as unknown;
        }
      })
    );

    type Compare = (a: unknown, b: unknown) => number;
    let comparisons = 0;
    const counted = (compare?: Compare): Compare | undefined =>
      compare && ((a, b) => {
        comparisons++;
        return compare(a, b);
      });
    const nativeSort = Array.prototype.sort as (this: unknown[], compare?: Compare) => unknown[];
    const sortSpy = vi.spyOn(Array.prototype, 'sort').mockImplementation(function (this: unknown[], compare?: Compare) {
      return nativeSort.call(this, counted(compare));
    });

    let ranked: Prompt[];
    try {
      ranked = rankMostUsed(prompts);
    } finally {
      sortSpy.mockRestore();
    }
    const comparisonsOfRanking = comparisons;
    const readsOfRanking = reads;

    // n log2 n rounded up: 10 000 comparisons for 1000 Prompts. A quadratic ranking needs about a million
    const comparisonBudget = SIZE * Math.ceil(Math.log2(SIZE));
    expect(comparisonsOfRanking).toBeGreaterThanOrEqual(SIZE - 1);
    expect(comparisonsOfRanking).toBeLessThanOrEqual(comparisonBudget);
    // One read per Prompt to drop the never used, then at most two per comparison
    expect(readsOfRanking).toBeLessThanOrEqual(SIZE + 2 * comparisonBudget);

    expect(ranked).toHaveLength(SIZE);
    expect(ranked.every((prompt, i) => i === 0 || (ranked[i - 1].usageCount ?? 0) >= (prompt.usageCount ?? 0))).toBe(true);
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

  it('Never used lists the Prompts never inserted, in the chosen sort, pinned first', () => {
    expect(titles(applyLibraryFilter(prompts, { kind: 'neverUsed' }, categories, 'title')))
      .toEqual(['Bravo']);
  });

  it('Possible duplicates lists the pairs that still are, in review order', () => {
    const twins = [
      ...prompts,
      buildPrompt({ id: '5', title: 'Echo', content: 'Same words exactly' }),
      buildPrompt({ id: '6', title: 'Echo', content: 'Same words exactly' })
    ];
    const edited = twins.map(p => (p.id === '4' ? { ...p, content: 'Rewritten since the review' } : p));
    const filter: LibraryFilter = { kind: 'duplicates', groups: [['6', '5'], ['1', 'gone'], ['3', '4']] };

    // 1 lost its pair to a deletion, and 4 was edited away from 3: only 6 and 5 remain
    expect(applyLibraryFilter(edited, filter, categories, 'title').map(p => p.id)).toEqual(['6', '5']);
  });

  it('Possible duplicates keeps a searched Prompt whose pair the search does not match', () => {
    const twins = [
      ...prompts,
      buildPrompt({ id: '5', title: 'Echo', content: 'Same words exactly' }),
      buildPrompt({ id: '6', title: 'Foxtrot', content: 'Same words exactly' })
    ];
    const searched = twins.filter(p => p.title === 'Foxtrot');
    const filter: LibraryFilter = { kind: 'duplicates', groups: [['5', '6']] };

    expect(applyLibraryFilter(searched, filter, categories, 'title', twins).map(p => p.id)).toEqual(['6']);
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

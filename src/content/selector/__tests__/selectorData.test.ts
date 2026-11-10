// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { promptsOf, tabsOf, variableCount } from '../selectorData';

import { ids, library, prompt } from './selector.fixtures';

describe('Prompt selector tabs', () => {
  it('lists All, Pinned, Recent, then every Category in its stored order', () => {
    expect(tabsOf(library)).toEqual([
      { key: 'all', label: 'All' },
      { key: 'pinned', label: 'Pinned' },
      { key: 'recent', label: 'Recent' },
      { key: 'category:Work', label: 'Work', color: '#2563EB' },
      { key: 'category:Home', label: 'Home' },
      { key: 'category:Empty', label: 'Empty', color: '#DC2626' }
    ]);
  });

  it('has no limit on the number of Categories', () => {
    const categories = Array.from({ length: 12 }, (_, i) => ({ name: `C${String(i)}` }));

    expect(tabsOf({ prompts: [], categories })).toHaveLength(3 + 12);
  });

  it('gives a tab to a Category a Prompt names but the Library does not hold', () => {
    const tabs = tabsOf({ prompts: [prompt('a', { category: 'Orphan' })], categories: [{ name: 'Work' }] });

    expect(tabs.map((tab) => tab.key)).toEqual(['all', 'pinned', 'recent', 'category:Work', 'category:Orphan']);
  });
});

describe('Prompts of a tab', () => {
  it('All lists every Prompt, Pinned Prompts first, in stored order within each group', () => {
    expect(ids(promptsOf(library, 'all', ''))).toEqual(['p2', 'p5', 'p1', 'p3', 'p4', 'p6', 'p7']);
  });

  it('Pinned lists the Pinned Prompts only', () => {
    expect(ids(promptsOf(library, 'pinned', ''))).toEqual(['p2', 'p5']);
  });

  it('Recent lists the five Prompts inserted most recently, latest first', () => {
    expect(ids(promptsOf(library, 'recent', ''))).toEqual(['p7', 'p6', 'p5', 'p4', 'p3']);
  });

  it('Recent leaves out a Prompt never inserted', () => {
    const never = { prompts: [prompt('a'), prompt('b', { usageCount: 0, lastUsedAt: 99 })], categories: [] };

    expect(promptsOf(never, 'recent', '')).toEqual([]);
  });

  it('a Category lists its Prompts, Pinned first', () => {
    expect(ids(promptsOf(library, 'category:Home', ''))).toEqual(['p2', 'p4']);
    expect(promptsOf(library, 'category:Empty', '')).toEqual([]);
  });

  it('a search looks in the whole Library, whatever the tab, in title, content and Category', () => {
    expect(ids(promptsOf(library, 'pinned', 'weekly'))).toEqual(['p4']);
    expect(ids(promptsOf(library, 'category:Empty', 'DEAR'))).toEqual(['p3']);
    expect(ids(promptsOf(library, 'recent', 'home'))).toEqual(['p2', 'p4']);
    expect(promptsOf(library, 'all', 'no such text')).toEqual([]);
  });

  it('does not change the Library it reads', () => {
    const before = ids(library.prompts);
    promptsOf(library, 'recent', '');

    expect(ids(library.prompts)).toEqual(before);
  });
});

describe('Variables of a Prompt', () => {
  it('counts each distinct Variable once', () => {
    expect(variableCount(library.prompts[2])).toBe(2);
    expect(variableCount(library.prompts[0])).toBe(0);
  });
});

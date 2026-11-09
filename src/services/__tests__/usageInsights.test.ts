import { describe, expect, it } from 'vitest';

import { buildPrompt } from '../../test/builders/buildPrompt';
import type { UsageEvent } from '../../types';
import {
  busiestWeekday,
  countDuplicatePairs,
  countNeverUsed,
  duplicateReviewGroups,
  isNeverUsed,
  rankByUses,
  remainingDuplicates,
  topCategory,
  topPlatform,
  weekdayUsage
} from '../usageInsights';

/** A local date: the weekday of an Insertion is the user's own calendar day */
const at = (year: number, month: number, day: number, hour = 12): number =>
  new Date(year, month - 1, day, hour).getTime();

// 2026-11-02 is a Monday
const MON = at(2026, 11, 2);
const TUE = at(2026, 11, 3);
const WED = at(2026, 11, 4);
const SUN = at(2026, 11, 8);

const event = (promptId: string, timestamp: number, platform = 'claude'): UsageEvent => ({
  promptId,
  timestamp,
  platform,
  categoryId: null
});

describe('weekdayUsage', () => {
  it('counts Insertions per weekday, Monday to Sunday', () => {
    const series = weekdayUsage([event('a', MON), event('a', TUE), event('b', TUE), event('c', SUN)]);

    expect(series.map(d => d.day)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(series.map(d => d.count)).toEqual([1, 2, 0, 0, 0, 0, 1]);
    expect(series[1].name).toBe('Tuesday');
  });

  it('gives seven empty days without usage', () => {
    expect(weekdayUsage([]).map(d => d.count)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('counts an Insertion just before midnight on its own local day', () => {
    const series = weekdayUsage([event('a', at(2026, 11, 2, 23))]);

    expect(series[0].count).toBe(1);
  });
});

describe('busiestWeekday', () => {
  it('is the weekday with the most Insertions', () => {
    const series = weekdayUsage([event('a', WED), event('b', WED), event('c', MON)]);

    expect(busiestWeekday(series)?.name).toBe('Wednesday');
  });

  it('goes to the first day of the week on a tie', () => {
    const series = weekdayUsage([event('a', SUN), event('b', TUE)]);

    expect(busiestWeekday(series)?.day).toBe('Tue');
  });

  it('is none without usage', () => {
    expect(busiestWeekday(weekdayUsage([]))).toBeNull();
  });
});

describe('topPlatform', () => {
  it('is the Platform with the most Insertions, with its count', () => {
    const events = [event('a', MON, 'chatgpt'), event('a', TUE, 'claude'), event('b', WED, 'claude')];

    expect(topPlatform(events)).toEqual({ platform: 'claude', count: 2 });
  });

  it('goes to the most recently used Platform on a tie', () => {
    const events = [event('a', MON, 'claude'), event('b', WED, 'gemini')];

    expect(topPlatform(events)).toEqual({ platform: 'gemini', count: 1 });
  });

  it('is none without usage', () => {
    expect(topPlatform([])).toBeNull();
  });
});

describe('topCategory', () => {
  const prompts = [
    buildPrompt({ id: 'a', category: 'Writing' }),
    buildPrompt({ id: 'b', category: 'Writing' }),
    buildPrompt({ id: 'c', category: 'Code' })
  ];

  it("counts each Insertion in its Prompt's current Category", () => {
    const events = [event('a', MON), event('b', TUE), event('c', WED)];

    expect(topCategory(events, prompts)).toEqual({ name: 'Writing', count: 2 });
  });

  it('leaves out Insertions of a deleted Prompt', () => {
    const events = [event('gone', MON), event('gone', TUE), event('c', WED)];

    expect(topCategory(events, prompts)).toEqual({ name: 'Code', count: 1 });
  });

  it('goes to the most recently used Category on a tie', () => {
    const events = [event('a', MON), event('c', WED)];

    expect(topCategory(events, prompts)).toEqual({ name: 'Code', count: 1 });
  });

  it('is none without usage', () => {
    expect(topCategory([], prompts)).toBeNull();
  });
});

describe('rankByUses', () => {
  const prompts = [
    buildPrompt({ id: 'a', title: 'A' }),
    buildPrompt({ id: 'b', title: 'B' }),
    buildPrompt({ id: 'c', title: 'C' }),
    buildPrompt({ id: 'd', title: 'D' })
  ];

  it('ranks Prompts by Insertions in the period, most first, up to the limit', () => {
    const events = [
      event('b', MON), event('b', TUE), event('b', WED),
      event('a', MON), event('a', TUE),
      event('c', MON),
      event('d', WED)
    ];

    const ranked = rankByUses(events, prompts, 3);

    expect(ranked.map(r => [r.prompt.title, r.count])).toEqual([['B', 3], ['A', 2], ['D', 1]]);
  });

  it('breaks a tie by the most recent Insertion', () => {
    const events = [event('a', MON), event('c', WED)];

    expect(rankByUses(events, prompts, 3).map(r => r.prompt.id)).toEqual(['c', 'a']);
  });

  it('leaves out deleted Prompts and Prompts without Insertions', () => {
    const events = [event('gone', MON), event('a', TUE)];

    expect(rankByUses(events, prompts, 3).map(r => r.prompt.id)).toEqual(['a']);
  });

  it('is empty without usage', () => {
    expect(rankByUses([], prompts, 3)).toEqual([]);
  });
});

describe('Never used', () => {
  it('is a Prompt never inserted, whatever its age', () => {
    expect(isNeverUsed(buildPrompt({ usageCount: 0 }))).toBe(true);
    expect(isNeverUsed(buildPrompt({ usageCount: undefined }))).toBe(true);
    expect(isNeverUsed(buildPrompt({ usageCount: 1 }))).toBe(false);
  });

  it('counts the Never used Prompts of the Library', () => {
    const prompts = [
      buildPrompt({ id: 'a', usageCount: 0 }),
      buildPrompt({ id: 'b', usageCount: 4 }),
      buildPrompt({ id: 'c' })
    ];

    expect(countNeverUsed(prompts)).toBe(2);
  });
});

describe('Duplicate pairs', () => {
  const a = buildPrompt({ id: 'a' });
  const b = buildPrompt({ id: 'b' });
  const c = buildPrompt({ id: 'c' });
  const d = buildPrompt({ id: 'd' });
  const e = buildPrompt({ id: 'e' });

  it('pairs each duplicate with its original: a group of three makes two pairs', () => {
    expect(countDuplicatePairs([{ original: a, duplicates: [b, c] }, { original: d, duplicates: [e] }])).toBe(3);
  });

  it('is zero without duplicates', () => {
    expect(countDuplicatePairs([])).toBe(0);
  });

  it('keeps each group for review, its original before its duplicates', () => {
    expect(duplicateReviewGroups([{ original: a, duplicates: [b, c] }, { original: d, duplicates: [e] }]))
      .toEqual([['a', 'b', 'c'], ['d', 'e']]);
  });
});

describe('remainingDuplicates', () => {
  const same = (x: { content: string }, y: { content: string }) => x.content === y.content;
  const a = buildPrompt({ id: 'a', content: 'one' });
  const b = buildPrompt({ id: 'b', content: 'one' });
  const c = buildPrompt({ id: 'c', content: 'one' });
  const d = buildPrompt({ id: 'd', content: 'two' });
  const e = buildPrompt({ id: 'e', content: 'two' });

  it('lists the Prompts of the groups in review order', () => {
    expect(remainingDuplicates([['a', 'b', 'c'], ['d', 'e']], [e, d, c, b, a], same).map(p => p.id))
      .toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('drops a pair once one of its Prompts is deleted', () => {
    expect(remainingDuplicates([['a', 'b'], ['d', 'e']], [a, d, e], same).map(p => p.id)).toEqual(['d', 'e']);
  });

  it('drops a pair once one of its Prompts is edited away from the other', () => {
    const edited = { ...b, content: 'something else' };
    expect(remainingDuplicates([['a', 'b'], ['d', 'e']], [a, edited, d, e], same).map(p => p.id)).toEqual(['d', 'e']);
  });

  it('hands the group to the next Prompt when its original is edited away', () => {
    const edited = { ...a, content: 'something else' };
    expect(remainingDuplicates([['a', 'b', 'c']], [edited, b, c], same).map(p => p.id)).toEqual(['b', 'c']);
  });

  it('keeps a Prompt paired only with another duplicate, not with the original', () => {
    // a still pairs with b, b with c, but a no longer with c
    const pairs = new Set(['a-b', 'b-a', 'b-c', 'c-b']);
    const paired = (x: { id: string }, y: { id: string }) => pairs.has(`${x.id}-${y.id}`);
    expect(remainingDuplicates([['a', 'b', 'c']], [a, b, c], paired).map(p => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the rest of a group whose original is deleted, the first left becoming its original', () => {
    expect(remainingDuplicates([['a', 'b', 'c']], [b, c], same).map(p => p.id)).toEqual(['b', 'c']);
  });
});

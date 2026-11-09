import { describe, expect, it } from 'vitest';

import { buildPrompt } from '../../test/builders/buildPrompt';
import type { UsageEvent } from '../../types';
import {
  busiestWeekday,
  countDuplicatePairs,
  countNeverUsed,
  duplicateReviewIds,
  isNeverUsed,
  rankByUses,
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

  it('lists every Prompt of a pair for review, each original before its duplicates', () => {
    expect(duplicateReviewIds([{ original: a, duplicates: [b, c] }, { original: d, duplicates: [e] }]))
      .toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

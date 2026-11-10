/**
 * What the Analytics Section shows about the last 30 days of Insertions, and what Tidy up offers to
 * review: pure functions over the usage history and the Library (see CONTEXT.md for Most Used,
 * Never used and Duplicate pair).
 */

import { DEFAULT_CATEGORY_COLOR } from '../constants/colors';
import type { Category, Prompt, UsageEvent } from '../types';

export interface WeekdayUsage {
  /** Short label under the bar: 'Mon' */
  day: string;
  /** Full name for sentences: 'Monday' */
  name: string;
  count: number;
}

export interface RankedPrompt {
  prompt: Prompt;
  count: number;
  lastUsed: number;
}

export interface PlatformUsage {
  platform: string;
  count: number;
}

export interface CategoryUsage {
  name: string;
  count: number;
  /** The Category's own color, else the default Category color */
  color: string;
}

export interface DuplicateGroup {
  original: Prompt;
  duplicates: Prompt[];
}

/** Monday first, whatever the locale, as in the Atelier 1C design */
const WEEKDAYS: ReadonlyArray<{ day: string; name: string }> = [
  { day: 'Mon', name: 'Monday' },
  { day: 'Tue', name: 'Tuesday' },
  { day: 'Wed', name: 'Wednesday' },
  { day: 'Thu', name: 'Thursday' },
  { day: 'Fri', name: 'Friday' },
  { day: 'Sat', name: 'Saturday' },
  { day: 'Sun', name: 'Sunday' }
];

/** Insertions per local weekday, Monday to Sunday */
export function weekdayUsage(events: UsageEvent[]): WeekdayUsage[] {
  const counts = new Array<number>(7).fill(0);
  for (const event of events) {
    // getDay() is 0 for Sunday: shift so Monday is 0
    counts[(new Date(event.timestamp).getDay() + 6) % 7]++;
  }
  return WEEKDAYS.map((weekday, index) => ({ ...weekday, count: counts[index] }));
}

/** The weekday with the most Insertions, the first of the week on a tie; none without usage */
export function busiestWeekday(series: WeekdayUsage[]): WeekdayUsage | null {
  return busiest(series);
}

/**
 * Counts Insertions per key, most first, ties going to the key used most recently; an event without
 * a key is left out.
 */
function rankByKey(events: UsageEvent[], keyOf: (event: UsageEvent) => string | undefined): { key: string; count: number }[] {
  const tally = new Map<string, { count: number; lastUsed: number }>();
  for (const event of events) {
    const key = keyOf(event);
    if (key === undefined) {
      continue;
    }
    const entry = tally.get(key);
    if (entry) {
      entry.count++;
      entry.lastUsed = Math.max(entry.lastUsed, event.timestamp);
    } else {
      tally.set(key, { count: 1, lastUsed: event.timestamp });
    }
  }
  return [...tally.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.lastUsed - a.lastUsed)
    .map(([key, entry]) => ({ key, count: entry.count }));
}

/** The Platforms by Insertions, most first, ties to the one used most recently */
export function platformRanking(events: UsageEvent[]): PlatformUsage[] {
  return rankByKey(events, event => event.platform).map(({ key, count }) => ({ platform: key, count }));
}

/** The Platform with the most Insertions, ties to the one used most recently */
export function topPlatform(events: UsageEvent[]): PlatformUsage | null {
  return platformRanking(events)[0] ?? null;
}

/**
 * The Categories by Insertions, most first, each Insertion counted in its Prompt's current Category;
 * Insertions of a deleted Prompt are left out. Ties go to the one used most recently. Each has its
 * own color; a Category stored without a color, or no longer stored, takes the default Category
 * color, as in the Library.
 */
export function categoryRanking(events: UsageEvent[], prompts: Prompt[], categories: Category[] = []): CategoryUsage[] {
  const categoryOf = new Map(prompts.map(prompt => [prompt.id, prompt.category]));
  const colorOf = new Map(categories.map(category => [category.name, category.color]));
  return rankByKey(events, event => categoryOf.get(event.promptId)).map(({ key, count }) => ({
    name: key,
    count,
    color: colorOf.get(key) || DEFAULT_CATEGORY_COLOR
  }));
}

/** The Category with the most Insertions: the first of categoryRanking */
export function topCategory(events: UsageEvent[], prompts: Prompt[]): { name: string; count: number } | null {
  const top = categoryRanking(events, prompts).at(0);
  return top ? { name: top.name, count: top.count } : null;
}

/** The entry with the highest count, the first on a tie; none when nothing was counted */
export function busiest<T extends { count: number }>(series: readonly T[]): T | null {
  let top: T | null = null;
  for (const entry of series) {
    if (entry.count > (top?.count ?? 0)) {
      top = entry;
    }
  }
  return top;
}

/**
 * The Prompts inserted in the period, by Insertions, most first, ties to the most recent
 * Insertion; deleted Prompts are left out.
 */
export function rankByUses(events: UsageEvent[], prompts: Prompt[], limit: number): RankedPrompt[] {
  const byId = new Map(prompts.map(prompt => [prompt.id, prompt]));
  const tally = new Map<string, RankedPrompt>();
  for (const event of events) {
    const prompt = byId.get(event.promptId);
    if (!prompt) {
      continue;
    }
    const entry = tally.get(prompt.id);
    if (entry) {
      entry.count++;
      entry.lastUsed = Math.max(entry.lastUsed, event.timestamp);
    } else {
      tally.set(prompt.id, { prompt, count: 1, lastUsed: event.timestamp });
    }
  }
  return [...tally.values()]
    .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
    .slice(0, limit);
}

/**
 * The app's Prompts, each with the higher usage of the two copies: the app's copy holds this
 * surface's edits and deletions, while a copy read from storage since may hold Insertions made on a
 * Platform meanwhile.
 */
export function withLatestUsage(prompts: Prompt[], stored: Prompt[]): Prompt[] {
  const storedById = new Map(stored.map(prompt => [prompt.id, prompt]));
  return prompts.map(prompt => {
    const fresh = storedById.get(prompt.id);
    if (!fresh || (fresh.usageCount ?? 0) <= (prompt.usageCount ?? 0)) {
      return prompt;
    }
    return { ...prompt, usageCount: fresh.usageCount, lastUsedAt: fresh.lastUsedAt };
  });
}

/** Never used: never inserted, the complement of Most Used */
export function isNeverUsed(prompt: Prompt): boolean {
  const uses = prompt.usageCount;
  return !(typeof uses === 'number' && Number.isFinite(uses) && uses > 0);
}

export function countNeverUsed(prompts: Prompt[]): number {
  return prompts.filter(isNeverUsed).length;
}

/** Each duplicate makes a pair with its original: a group of three is two pairs */
export function countDuplicatePairs(groups: DuplicateGroup[]): number {
  return groups.reduce((pairs, group) => pairs + group.duplicates.length, 0);
}

/** The groups to review, as ids: each original followed by its duplicates */
export function duplicateReviewGroups(groups: DuplicateGroup[]): string[][] {
  return groups.map(group => [group.original.id, ...group.duplicates.map(prompt => prompt.id)]);
}

/**
 * The Prompts of the reviewed groups that still make Duplicate pairs, in review order. A group is
 * read again against the Library as it is now: a deleted Prompt drops out, and a Prompt stays while
 * it still makes a Duplicate pair with another Prompt of its group, whichever one. A Prompt edited
 * away from all the others leaves, and a group left with no pair is gone.
 */
export function remainingDuplicates(
  groups: string[][],
  prompts: Prompt[],
  isDuplicatePair: (a: Prompt, b: Prompt) => boolean
): Prompt[] {
  const byId = new Map(prompts.map(prompt => [prompt.id, prompt]));
  return groups.flatMap(ids => {
    const members = ids.flatMap(id => byId.get(id) ?? []);
    return members.filter(member =>
      members.some(other => other !== member && isDuplicatePair(member, other))
    );
  });
}

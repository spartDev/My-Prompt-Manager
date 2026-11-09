/**
 * What the Analytics Section shows about the last 30 days of Insertions, and what Tidy up offers to
 * review: pure functions over the usage history and the Library (see CONTEXT.md for Most Used,
 * Never used and Duplicate pair).
 */

import type { Prompt, UsageEvent } from '../types';

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
  let busiest: WeekdayUsage | null = null;
  for (const weekday of series) {
    if (weekday.count > (busiest?.count ?? 0)) {
      busiest = weekday;
    }
  }
  return busiest;
}

/**
 * Counts Insertions per key and returns the key with the most, ties going to the one used most
 * recently; none when no event has a key.
 */
function topByCount(events: UsageEvent[], keyOf: (event: UsageEvent) => string | undefined): { key: string; count: number } | null {
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

  let top: { key: string; count: number; lastUsed: number } | null = null;
  for (const [key, entry] of tally) {
    if (!top || entry.count > top.count || (entry.count === top.count && entry.lastUsed > top.lastUsed)) {
      top = { key, ...entry };
    }
  }
  return top && { key: top.key, count: top.count };
}

/** The Platform with the most Insertions, ties to the one used most recently */
export function topPlatform(events: UsageEvent[]): { platform: string; count: number } | null {
  const top = topByCount(events, event => event.platform);
  return top && { platform: top.key, count: top.count };
}

/**
 * The Category with the most Insertions, each counted in its Prompt's current Category; Insertions
 * of a deleted Prompt are left out. Ties go to the one used most recently.
 */
export function topCategory(events: UsageEvent[], prompts: Prompt[]): { name: string; count: number } | null {
  const categoryOf = new Map(prompts.map(prompt => [prompt.id, prompt.category]));
  const top = topByCount(events, event => categoryOf.get(event.promptId));
  return top && { name: top.key, count: top.count };
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
 * read again against the Library as it is now: a deleted Prompt drops out, the first left is the
 * original and keeps the Prompts still paired with it. An original paired with none, deleted or
 * edited away, hands the group to the next Prompt; Prompts left without a pair are gone.
 */
export function remainingDuplicates(
  groups: string[][],
  prompts: Prompt[],
  isDuplicatePair: (a: Prompt, b: Prompt) => boolean
): Prompt[] {
  const byId = new Map(prompts.map(prompt => [prompt.id, prompt]));
  return groups.flatMap(ids => {
    const kept: Prompt[] = [];
    let members = ids.flatMap(id => byId.get(id) ?? []);
    while (members.length > 1) {
      const [original, ...others] = members;
      const duplicates = others.filter(other => isDuplicatePair(original, other));
      if (duplicates.length > 0) {
        kept.push(original, ...duplicates);
      }
      members = others.filter(other => !duplicates.includes(other));
    }
    return kept;
  });
}

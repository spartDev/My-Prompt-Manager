import type { Prompt } from '../types';

import { calculateSimilarityOptimized } from './SimilarityAlgorithms';

/** How alike a Prompt's text must be to the one being written for the editor to point it out */
export const LOOKALIKE_THRESHOLD = 0.6;

/** Text this short (spaces around it not counted) is too short to look like anything */
export const LOOKALIKE_MIN_LENGTH = 21;

/**
 * The longest text compared character by character (Levenshtein). That comparison costs the product
 * of the two lengths, so whole texts at Admission's limit would freeze typing for seconds: a longer
 * text is compared by the runs of characters the two texts share, in time proportional to their lengths
 */
export const LOOKALIKE_COMPARED_LENGTH = 1000;

/** The length of the runs of characters two long texts are compared by */
const RUN_LENGTH = 4;

export interface Lookalike {
  prompt: Prompt;
  /** 0 to 1 */
  similarity: number;
}

/** How many times each run of RUN_LENGTH characters appears in a text */
const runCounts = (text: string): Map<string, number> => {
  const counts = new Map<string, number>();
  for (let i = 0; i + RUN_LENGTH <= text.length; i++) {
    const run = text.slice(i, i + RUN_LENGTH);
    counts.set(run, (counts.get(run) ?? 0) + 1);
  }
  return counts;
};

/** The share of their runs of characters two texts have in common (Dice), 0 to 1 */
const sharedRuns = (a: string, b: string): number => {
  const countsA = runCounts(a);
  const countsB = runCounts(b);
  let shared = 0;
  for (const [run, count] of countsA) {
    shared += Math.min(count, countsB.get(run) ?? 0);
  }
  const total = Math.max(0, a.length - RUN_LENGTH + 1) + Math.max(0, b.length - RUN_LENGTH + 1);
  return total === 0 ? 0 : (2 * shared) / total;
};

/**
 * How alike two texts are, 0 to 1, or -1 when below LOOKALIKE_THRESHOLD. Two texts can be no more
 * alike than the shorter's length over the longer's, so texts whose lengths differ that much are
 * never compared, and that ratio caps how alike two long texts are found by their shared runs.
 */
export function lookalikeSimilarity(content: string, other: string): number {
  if (content === other) { return 1; }
  const longer = Math.max(content.length, other.length);
  const lengthRatio = longer === 0 ? 1 : Math.min(content.length, other.length) / longer;
  if (lengthRatio < LOOKALIKE_THRESHOLD) { return -1; }
  if (longer <= LOOKALIKE_COMPARED_LENGTH) {
    return calculateSimilarityOptimized(content, other, LOOKALIKE_THRESHOLD);
  }
  // Shared runs overlook where a difference is, not how large it is; the length ratio caps them
  const similarity = Math.min(sharedRuns(content, other), lengthRatio);
  return similarity >= LOOKALIKE_THRESHOLD ? similarity : -1;
}

/**
 * The search for the Prompt of the Library whose text is the most like `content`, one Prompt at a
 * time: each step compares one Prompt, so a caller can spread the search over several tasks and
 * drop it when the text changes. It returns that Prompt when it is at least LOOKALIKE_THRESHOLD
 * alike; null otherwise, and always for text shorter than LOOKALIKE_MIN_LENGTH. The Prompt being
 * edited, `excludeId`, is never compared with itself.
 */
export function* searchLookalike(
  content: string,
  library: readonly Prompt[],
  excludeId?: string
): Generator<void, Lookalike | null, void> {
  if (content.trim().length < LOOKALIKE_MIN_LENGTH) {
    return null;
  }
  let best: Lookalike | null = null;
  for (const prompt of library) {
    if (prompt.id === excludeId) { continue; }
    const similarity = lookalikeSimilarity(content, prompt.content);
    if (similarity >= LOOKALIKE_THRESHOLD && (best === null || similarity > best.similarity)) {
      best = { prompt, similarity };
    }
    yield;
  }
  return best;
}

/** searchLookalike run to its end at once */
export function findLookalike(content: string, library: readonly Prompt[], excludeId?: string): Lookalike | null {
  const search = searchLookalike(content, library, excludeId);
  for (;;) {
    const step = search.next();
    if (step.done) { return step.value; }
  }
}

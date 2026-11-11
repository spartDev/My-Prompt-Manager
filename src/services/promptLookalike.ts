import type { Prompt } from '../types';

import { calculateSimilarityOptimized } from './SimilarityAlgorithms';

/** How alike a Prompt's text must be to the one being written for the editor to point it out */
export const LOOKALIKE_THRESHOLD = 0.6;

/** Text this short (spaces around it not counted) is too short to look like anything */
export const LOOKALIKE_MIN_LENGTH = 21;

/**
 * The most of each text that is compared. The comparison costs the product of the two lengths, so
 * whole texts at Admission's limit would freeze typing for seconds: a longer text is compared on its
 * start and its end, and what that finds is scaled by how far the two lengths differ
 */
export const LOOKALIKE_COMPARED_LENGTH = 1000;

export interface Lookalike {
  prompt: Prompt;
  /** 0 to 1 */
  similarity: number;
}

/** A text short enough to compare whole, or its start and its end */
const sample = (text: string): string =>
  text.length <= LOOKALIKE_COMPARED_LENGTH
    ? text
    : text.slice(0, LOOKALIKE_COMPARED_LENGTH / 2) + text.slice(-LOOKALIKE_COMPARED_LENGTH / 2);

/**
 * How alike two texts are, 0 to 1, or -1 when below LOOKALIKE_THRESHOLD. Two texts can be no more
 * alike than the shorter's length over the longer's, so texts whose lengths differ that much are
 * never compared; a text cut to its start and its end is scaled by that ratio.
 */
export function lookalikeSimilarity(content: string, other: string): number {
  if (content === other) { return 1; }
  const longer = Math.max(content.length, other.length);
  const lengthRatio = longer === 0 ? 1 : Math.min(content.length, other.length) / longer;
  if (lengthRatio < LOOKALIKE_THRESHOLD) { return -1; }
  if (longer <= LOOKALIKE_COMPARED_LENGTH) {
    return calculateSimilarityOptimized(content, other, LOOKALIKE_THRESHOLD);
  }
  const sampled = calculateSimilarityOptimized(sample(content), sample(other), LOOKALIKE_THRESHOLD / lengthRatio);
  return sampled < 0 ? -1 : sampled * lengthRatio;
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

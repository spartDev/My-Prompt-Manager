import type { Prompt } from '../types';

import { calculateSimilarityOptimized } from './SimilarityAlgorithms';

/** How alike a Prompt's text must be to the one being written for the editor to point it out */
export const LOOKALIKE_THRESHOLD = 0.6;

/** Text this short (spaces around it not counted) is too short to look like anything */
export const LOOKALIKE_MIN_LENGTH = 21;

export interface Lookalike {
  prompt: Prompt;
  /** 0 to 1 */
  similarity: number;
}

/**
 * The Prompt of the Library whose text is the most like `content`, when it is at least
 * LOOKALIKE_THRESHOLD alike; null otherwise, and always for text shorter than LOOKALIKE_MIN_LENGTH.
 * The Prompt being edited, `excludeId`, is never compared with itself.
 */
export function findLookalike(content: string, library: readonly Prompt[], excludeId?: string): Lookalike | null {
  if (content.trim().length < LOOKALIKE_MIN_LENGTH) {
    return null;
  }
  let best: Lookalike | null = null;
  for (const prompt of library) {
    if (prompt.id === excludeId) { continue; }
    const similarity = calculateSimilarityOptimized(content, prompt.content, LOOKALIKE_THRESHOLD);
    if (similarity >= LOOKALIKE_THRESHOLD && (best === null || similarity > best.similarity)) {
      best = { prompt, similarity };
    }
  }
  return best;
}

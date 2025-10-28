/**
 * Text highlighting utilities for search functionality
 */

import { TextHighlight } from '../types/hooks';

// Re-export type for convenience
export type { TextHighlight } from '../types/hooks';

/**
 * Find all occurrences of a search term in text and return highlight positions
 *
 * @param text The text to search within
 * @param searchTerm The term to search for (case-insensitive)
 * @returns Array of TextHighlight objects with start/end positions
 *
 * @example
 * ```typescript
 * const highlights = findTextHighlights('Hello World', 'world');
 * // Returns: [{ start: 6, end: 11, text: 'World' }]
 * ```
 */
export function findTextHighlights(text: string, searchTerm: string): TextHighlight[] {
  const highlights: TextHighlight[] = [];
  const lowerText = text.toLowerCase();
  const lowerSearchTerm = searchTerm.toLowerCase();

  let startIndex = 0;
  let index = lowerText.indexOf(lowerSearchTerm, startIndex);

  while (index !== -1) {
    highlights.push({
      start: index,
      end: index + searchTerm.length,
      text: text.substring(index, index + searchTerm.length)
    });

    startIndex = index + searchTerm.length;
    index = lowerText.indexOf(lowerSearchTerm, startIndex);
  }

  return highlights;
}

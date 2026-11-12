/**
 * Text highlighting utilities for search functionality
 */

import type { TextHighlight } from '../types/hooks';

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

/** A text cut around the first match of a search: `match` is empty when nothing is to be marked */
export interface MatchSegments {
  before: string;
  match: string;
  after: string;
}

/**
 * Cuts a text around the first occurrence of a search, ignoring case and the spaces around the
 * search. The three segments put back together are always the text as stored (Verbatim): the search
 * is looked up as plain text, never as a pattern.
 *
 * Nothing is marked when the search is empty, is not in the text, or when lowercasing changes the
 * length of the text (an 'İ' becomes two code units), which would put the match at the wrong place.
 *
 * @example
 * highlightMatch('Follow-up Email', 'email'); // { before: 'Follow-up ', match: 'Email', after: '' }
 */
export function highlightMatch(text: string, query: string): MatchSegments {
  const unmarked: MatchSegments = { before: text, match: '', after: '' };
  const searchTerm = query.trim().toLowerCase();
  if (searchTerm === '') { return unmarked; }

  const lowerText = text.toLowerCase();
  if (lowerText.length !== text.length) { return unmarked; }

  const index = lowerText.indexOf(searchTerm);
  if (index === -1) { return unmarked; }

  const end = index + searchTerm.length;
  return { before: text.slice(0, index), match: text.slice(index, end), after: text.slice(end) };
}

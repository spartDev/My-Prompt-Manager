/**
 * Optimized string similarity algorithms for large text comparison
 * Designed for Chrome extension context with memory constraints
 */

/**
 * Space-optimized Levenshtein distance with early termination
 * Memory: O(min(m,n)) instead of O(m×n)
 * Time: O(m×n) worst case, but terminates early when threshold exceeded
 *
 * @param str1 First string to compare
 * @param str2 Second string to compare
 * @param maxDistance Maximum allowed distance (for early termination)
 * @returns Edit distance or Infinity if exceeds maxDistance
 */
export function levenshteinDistanceOptimized(
  str1: string,
  str2: string,
  maxDistance: number = Infinity
): number {
  // Ensure str1 is the shorter string for space optimization
  if (str1.length > str2.length) {
    [str1, str2] = [str2, str1];
  }

  const m = str1.length;
  const n = str2.length;

  // Early exit: if length difference exceeds threshold
  if (n - m > maxDistance) {
    return Infinity;
  }

  // Empty string cases
  if (m === 0) {return n;}
  if (n === 0) {return m;}

  // Only need two rows instead of full matrix
  let prevRow = new Uint32Array(m + 1);
  let currRow = new Uint32Array(m + 1);

  // Initialize first row
  for (let i = 0; i <= m; i++) {
    prevRow[i] = i;
  }

  // Process each row
  for (let j = 1; j <= n; j++) {
    currRow[0] = j;
    let minInRow = j; // Track minimum value in current row for early termination

    for (let i = 1; i <= m; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

      currRow[i] = Math.min(
        prevRow[i] + 1,      // deletion
        currRow[i - 1] + 1,  // insertion
        prevRow[i - 1] + cost // substitution
      );

      if (currRow[i] < minInRow) {
        minInRow = currRow[i];
      }
    }

    // Early termination: if minimum value in row exceeds threshold, no path can succeed
    if (minInRow > maxDistance) {
      return Infinity;
    }

    // Swap rows
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[m];
}

/**
 * Calculate similarity score using optimized Levenshtein distance
 * Returns value between 0 (completely different) and 1 (identical)
 *
 * @param str1 First string
 * @param str2 Second string
 * @param similarityThreshold Minimum similarity required (0-1)
 * @returns Similarity score or -1 if below threshold
 */
export function calculateSimilarityOptimized(
  str1: string,
  str2: string,
  similarityThreshold: number = 0
): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0; // Both strings are empty
  }

  // Calculate maximum allowed edit distance from threshold
  // similarity = (length - distance) / length
  // distance = length * (1 - similarity)
  const maxDistance = Math.floor(longer.length * (1 - similarityThreshold));

  const editDistance = levenshteinDistanceOptimized(longer, shorter, maxDistance);

  // If distance exceeded threshold, return -1 to signal failure
  if (editDistance === Infinity) {
    return -1;
  }

  return (longer.length - editDistance) / longer.length;
}

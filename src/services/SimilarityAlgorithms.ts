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

/**
 * Jaro-Winkler similarity algorithm
 * Faster than Levenshtein for short strings and strings with common prefixes
 * Time: O(m×n) but with lower constant factor
 * Memory: O(1)
 *
 * @param str1 First string
 * @param str2 Second string
 * @param prefixScale Scaling factor for common prefix (default 0.1)
 * @returns Similarity score between 0 and 1
 */
export function jaroWinklerSimilarity(
  str1: string,
  str2: string,
  prefixScale: number = 0.1
): number {
  if (str1 === str2) {return 1.0;}
  if (str1.length === 0 || str2.length === 0) {return 0.0;}

  // Calculate Jaro similarity first
  const matchDistance = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) {continue;}
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) {return 0.0;}

  // Count transpositions
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (!str1Matches[i]) {continue;}
    while (!str2Matches[k]) {k++;}
    if (str1[i] !== str2[k]) {transpositions++;}
    k++;
  }

  const jaro = (
    matches / str1.length +
    matches / str2.length +
    (matches - transpositions / 2) / matches
  ) / 3;

  // Calculate common prefix (up to 4 characters)
  let prefixLength = 0;
  for (let i = 0; i < Math.min(4, str1.length, str2.length); i++) {
    if (str1[i] === str2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  // Apply Winkler modification
  return jaro + prefixLength * prefixScale * (1 - jaro);
}

/**
 * Cosine similarity using character n-grams
 * Excellent for long texts, very fast, memory efficient
 * Time: O(m + n)
 * Memory: O(alphabet_size × n)
 *
 * @param str1 First string
 * @param str2 Second string
 * @param ngramSize Size of n-grams (default 2 for bigrams)
 * @returns Similarity score between 0 and 1
 */
export function cosineSimilarity(
  str1: string,
  str2: string,
  ngramSize: number = 2
): number {
  if (str1 === str2) {return 1.0;}
  if (str1.length === 0 || str2.length === 0) {return 0.0;}
  if (str1.length < ngramSize || str2.length < ngramSize) {return 0.0;}

  // Generate n-gram frequency maps
  const ngrams1 = generateNgrams(str1, ngramSize);
  const ngrams2 = generateNgrams(str2, ngramSize);

  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  // Calculate magnitude for ngrams1 and dot product
  for (const [ngram, count1] of ngrams1) {
    magnitude1 += count1 * count1;
    const count2 = ngrams2.get(ngram) || 0;
    dotProduct += count1 * count2;
  }

  // Calculate magnitude for ngrams2
  for (const count2 of ngrams2.values()) {
    magnitude2 += count2 * count2;
  }

  // Calculate cosine similarity
  const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Generate n-grams from a string with frequency counts
 */
function generateNgrams(str: string, n: number): Map<string, number> {
  const ngrams = new Map<string, number>();

  for (let i = 0; i <= str.length - n; i++) {
    const ngram = str.substring(i, i + n);
    ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1);
  }

  return ngrams;
}

/**
 * Hash-based similarity for very long strings
 * Uses rolling hash for O(n) comparison
 * Best for texts > 10KB
 *
 * @param str1 First string
 * @param str2 Second string
 * @param chunkSize Size of chunks to hash (default 100)
 * @returns Similarity score between 0 and 1
 */
export function hashBasedSimilarity(
  str1: string,
  str2: string,
  chunkSize: number = 100
): number {
  if (str1 === str2) {return 1.0;}
  if (str1.length === 0 || str2.length === 0) {return 0.0;}

  const hashes1 = generateRollingHashes(str1, chunkSize);
  const hashes2 = generateRollingHashes(str2, chunkSize);

  // Count matching hashes
  let matches = 0;
  for (const hash of hashes1) {
    if (hashes2.has(hash)) {
      matches++;
    }
  }

  // Jaccard similarity
  const union = hashes1.size + hashes2.size - matches;
  return union === 0 ? 0 : matches / union;
}

/**
 * Generate rolling hashes for a string
 */
function generateRollingHashes(str: string, chunkSize: number): Set<number> {
  const hashes = new Set<number>();
  const prime = 31;

  for (let i = 0; i <= str.length - chunkSize; i++) {
    let hash = 0;
    for (let j = 0; j < chunkSize; j++) {
      hash = hash * prime + str.charCodeAt(i + j);
      // Keep hash in 32-bit range
      hash = hash | 0;
    }
    hashes.add(hash);
  }

  return hashes;
}

/**
 * Smart similarity selector that chooses the best algorithm based on input characteristics
 *
 * @param str1 First string
 * @param str2 Second string
 * @param threshold Similarity threshold (0-1)
 * @returns Similarity score or -1 if below threshold
 */
export function smartSimilarity(
  str1: string,
  str2: string,
  threshold: number = 0.9
): number {
  // Exact match check
  if (str1 === str2) {return 1.0;}

  // Quick length-based rejection
  const minLen = Math.min(str1.length, str2.length);
  const maxLen = Math.max(str1.length, str2.length);

  // If length ratio is too different, can't meet threshold
  if (minLen / maxLen < threshold) {
    return -1;
  }

  // Choose algorithm based on string characteristics
  let similarity: number;

  if (maxLen < 100) {
    // Short strings: use Jaro-Winkler (fast, good for typos)
    similarity = jaroWinklerSimilarity(str1, str2);
  } else if (maxLen < 1000) {
    // Medium strings: use optimized Levenshtein (handles threshold internally)
    return calculateSimilarityOptimized(str1, str2, threshold);
  } else if (maxLen < 10000) {
    // Long strings: use cosine similarity with trigrams
    similarity = cosineSimilarity(str1, str2, 3);
  } else {
    // Very long strings: use hash-based similarity
    similarity = hashBasedSimilarity(str1, str2, 200);
  }

  // Apply threshold check for algorithms that don't handle it internally
  return similarity < threshold ? -1 : similarity;
}

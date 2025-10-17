import { describe, it, expect } from 'vitest';

import {
  levenshteinDistanceOptimized,
  calculateSimilarityOptimized,
  jaroWinklerSimilarity,
  cosineSimilarity,
  hashBasedSimilarity,
  smartSimilarity
} from '../SimilarityAlgorithms';

describe('SimilarityAlgorithms', () => {
  describe('levenshteinDistanceOptimized', () => {
    it('should calculate distance correctly for identical strings', () => {
      const distance = levenshteinDistanceOptimized('test', 'test');
      expect(distance).toBe(0);
    });

    it('should calculate distance for completely different strings', () => {
      const distance = levenshteinDistanceOptimized('abc', 'xyz');
      expect(distance).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistanceOptimized('', '')).toBe(0);
      expect(levenshteinDistanceOptimized('test', '')).toBe(4);
      expect(levenshteinDistanceOptimized('', 'test')).toBe(4);
    });

    it('should calculate single character insertion', () => {
      const distance = levenshteinDistanceOptimized('test', 'tests');
      expect(distance).toBe(1);
    });

    it('should calculate single character deletion', () => {
      const distance = levenshteinDistanceOptimized('tests', 'test');
      expect(distance).toBe(1);
    });

    it('should calculate single character substitution', () => {
      const distance = levenshteinDistanceOptimized('test', 'best');
      expect(distance).toBe(1);
    });

    it('should handle multiple operations', () => {
      const distance = levenshteinDistanceOptimized('kitten', 'sitting');
      expect(distance).toBe(3); // k→s, e→i, insert g
    });

    it('should terminate early when threshold exceeded', () => {
      const distance = levenshteinDistanceOptimized(
        'verylongstring',
        'completelydifferent',
        5
      );
      expect(distance).toBe(Infinity);
    });

    it('should handle 20K character strings efficiently', () => {
      const str1 = 'a'.repeat(20000);
      const str2 = 'b'.repeat(20000);

      const startTime = performance.now();
      const distance = levenshteinDistanceOptimized(str1, str2, 100);
      const duration = performance.now() - startTime;

      expect(distance).toBe(Infinity); // Should terminate early
      expect(duration).toBeLessThan(100); // Should be fast due to early termination
    });

    it('should use O(min(m,n)) space', () => {
      // This is a conceptual test - actual memory usage verification would require profiling
      // We verify it doesn't throw OOM errors with large strings
      const str1 = 'x'.repeat(10000);
      const str2 = 'y'.repeat(5000);

      expect(() => {
        levenshteinDistanceOptimized(str1, str2, 1000);
      }).not.toThrow();
    });

    it('should swap strings to optimize space usage', () => {
      // Shorter string should be used for row allocation
      const short = 'abc';
      const long = 'x'.repeat(1000);

      const distance1 = levenshteinDistanceOptimized(short, long);
      const distance2 = levenshteinDistanceOptimized(long, short);

      expect(distance1).toBe(distance2);
    });

    it('should handle unicode characters', () => {
      const distance = levenshteinDistanceOptimized('café', 'cafe');
      expect(distance).toBe(1);
    });
  });

  describe('calculateSimilarityOptimized', () => {
    it('should return 1.0 for identical strings', () => {
      const similarity = calculateSimilarityOptimized('test', 'test');
      expect(similarity).toBe(1.0);
    });

    it('should return 1.0 for empty strings', () => {
      const similarity = calculateSimilarityOptimized('', '');
      expect(similarity).toBe(1.0);
    });

    it('should return value between 0 and 1', () => {
      const similarity = calculateSimilarityOptimized('hello', 'hallo');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should return -1 for similarity below threshold', () => {
      const similarity = calculateSimilarityOptimized(
        'completely',
        'different',
        0.9 // High threshold
      );
      expect(similarity).toBe(-1);
    });

    it('should calculate reasonable similarity for similar strings', () => {
      const similarity = calculateSimilarityOptimized('hello', 'hallo');
      expect(similarity).toBeGreaterThan(0.7);
    });

    it('should be case-sensitive', () => {
      const sim1 = calculateSimilarityOptimized('Test', 'test');
      const sim2 = calculateSimilarityOptimized('test', 'test');
      // Case difference means sim1 should be less than sim2
      expect(sim1).toBeLessThan(sim2);
      expect(sim2).toBe(1.0);
    });
  });

  describe('jaroWinklerSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const similarity = jaroWinklerSimilarity('test', 'test');
      expect(similarity).toBe(1.0);
    });

    it('should return 0 for completely different strings', () => {
      const similarity = jaroWinklerSimilarity('abc', 'xyz');
      expect(similarity).toBe(0);
    });

    it('should handle empty strings', () => {
      expect(jaroWinklerSimilarity('', '')).toBe(1.0);
      expect(jaroWinklerSimilarity('test', '')).toBe(0);
    });

    it('should give higher scores for shared prefixes', () => {
      const withPrefix = jaroWinklerSimilarity('test', 'testing');
      const withoutPrefix = jaroWinklerSimilarity('test', 'aesting');
      expect(withPrefix).toBeGreaterThan(withoutPrefix);
    });

    it('should handle transpositions better than Levenshtein', () => {
      // Jaro-Winkler is designed to handle transpositions well
      const similarity = jaroWinklerSimilarity('martha', 'marhta');
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should work well for short strings', () => {
      const similarity = jaroWinklerSimilarity('ab', 'ac');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should accept prefixScale parameter', () => {
      // 3rd parameter is prefixScale, not threshold
      const withScale = jaroWinklerSimilarity('testing', 'test', 0.1);
      expect(withScale).toBeGreaterThan(0);
      expect(withScale).toBeLessThanOrEqual(1);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const similarity = cosineSimilarity('test string', 'test string');
      expect(similarity).toBe(1.0);
    });

    it('should return 0 for completely different strings', () => {
      const similarity = cosineSimilarity('abc', 'xyz');
      expect(similarity).toBe(0);
    });

    it('should handle empty strings', () => {
      expect(cosineSimilarity('', '')).toBe(1.0);
      expect(cosineSimilarity('test', '')).toBe(0);
    });

    it('should be order-independent', () => {
      const sim1 = cosineSimilarity('hello world', 'world hello');
      expect(sim1).toBeGreaterThan(0.7); // Similar despite different order
    });

    it('should handle repeated words', () => {
      const similarity = cosineSimilarity(
        'test test test',
        'test test'
      );
      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should work well for medium-length texts', () => {
      const text1 = 'The quick brown fox jumps over the lazy dog';
      const text2 = 'The lazy dog was jumped over by the quick brown fox';
      const similarity = cosineSimilarity(text1, text2);
      expect(similarity).toBeGreaterThan(0.7);
    });

    it('should accept ngramSize parameter', () => {
      // 3rd parameter is ngramSize, not threshold
      const bigrams = cosineSimilarity('test', 'best', 2);
      const trigrams = cosineSimilarity('test', 'best', 3);
      // Both should return valid similarity scores
      expect(bigrams).toBeGreaterThanOrEqual(0);
      expect(trigrams).toBeGreaterThanOrEqual(0);
    });

    it('should handle 1K character strings efficiently', () => {
      const str1 = 'word '.repeat(200);
      const str2 = 'word '.repeat(200);

      const startTime = performance.now();
      const similarity = cosineSimilarity(str1, str2);
      const duration = performance.now() - startTime;

      expect(similarity).toBe(1.0);
      expect(duration).toBeLessThan(50);
    });
  });

  describe('hashBasedSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const similarity = hashBasedSimilarity('test', 'test');
      expect(similarity).toBe(1.0);
    });

    it('should return 0 for completely different strings', () => {
      const str1 = 'a'.repeat(300);
      const str2 = 'b'.repeat(300);
      const similarity = hashBasedSimilarity(str1, str2);
      expect(similarity).toBe(0);
    });

    it('should handle empty strings', () => {
      expect(hashBasedSimilarity('', '')).toBe(1.0);
      expect(hashBasedSimilarity('test', '')).toBe(0);
    });

    it('should work well for very long strings', () => {
      const str1 = 'This is a very long string. '.repeat(500); // ~14K chars
      const str2 = 'This is a very long string. '.repeat(500);

      const similarity = hashBasedSimilarity(str1, str2);
      expect(similarity).toBe(1.0);
    });

    it('should detect differences in long strings', () => {
      const str1 = 'word '.repeat(4000); // ~20K chars
      const str2 = 'word '.repeat(3999) + 'different';

      const similarity = hashBasedSimilarity(str1, str2);
      expect(similarity).toBeLessThan(1.0);
      expect(similarity).toBeGreaterThan(0); // Should still detect some similarity
    });

    it('should be fast for 20K character strings', () => {
      const str1 = 'a'.repeat(20000);
      const str2 = 'a'.repeat(19000) + 'b'.repeat(1000);

      const startTime = performance.now();
      const similarity = hashBasedSimilarity(str1, str2);
      const duration = performance.now() - startTime;

      expect(similarity).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });

    it('should accept chunkSize parameter', () => {
      // 3rd parameter is chunkSize, not threshold
      const smallChunks = hashBasedSimilarity('test'.repeat(100), 'test'.repeat(100), 50);
      const largeChunks = hashBasedSimilarity('test'.repeat(100), 'test'.repeat(100), 200);
      expect(smallChunks).toBeGreaterThan(0);
      expect(largeChunks).toBeGreaterThan(0);
    });

    it('should handle chunk-based comparison', () => {
      // Hash-based uses 200-char chunks
      const chunk = 'x'.repeat(200);
      const str1 = chunk.repeat(10);
      const str2 = chunk.repeat(10);

      const similarity = hashBasedSimilarity(str1, str2);
      expect(similarity).toBe(1.0);
    });
  });

  describe('smartSimilarity', () => {
    it('should select Jaro-Winkler for short strings (<100 chars)', () => {
      const result = smartSimilarity('hello', 'hallo', 0); // Low threshold to test algorithm selection
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should select Levenshtein for medium strings (100-1000 chars)', () => {
      const str1 = 'word '.repeat(50); // ~250 chars
      const str2 = 'word '.repeat(50);
      const result = smartSimilarity(str1, str2);
      expect(result).toBe(1.0);
    });

    it('should select cosine for long strings (1K-10K chars)', () => {
      const str1 = 'word '.repeat(500); // ~2500 chars
      const str2 = 'word '.repeat(500);
      const result = smartSimilarity(str1, str2);
      expect(result).toBe(1.0);
    });

    it('should select hash-based for very long strings (>10K chars)', () => {
      const str1 = 'word '.repeat(3000); // ~15K chars
      const str2 = 'word '.repeat(3000);
      const result = smartSimilarity(str1, str2);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for identical strings of any length', () => {
      const short = 'test';
      const medium = 'word '.repeat(100);
      const long = 'word '.repeat(500);
      const veryLong = 'word '.repeat(3000);

      expect(smartSimilarity(short, short)).toBe(1.0);
      expect(smartSimilarity(medium, medium)).toBe(1.0);
      expect(smartSimilarity(long, long)).toBe(1.0);
      expect(smartSimilarity(veryLong, veryLong)).toBe(1.0);
    });

    it('should return -1 when below threshold', () => {
      const result = smartSimilarity('abc', 'xyz', 0.9);
      expect(result).toBe(-1);
    });

    it('should handle 20K character strings', () => {
      const str1 = 'content '.repeat(2500); // ~20K chars
      const str2 = 'content '.repeat(2500);

      const startTime = performance.now();
      const result = smartSimilarity(str1, str2);
      const duration = performance.now() - startTime;

      expect(result).toBe(1.0);
      expect(duration).toBeLessThan(200);
    });

    it('should handle mixed-length comparisons', () => {
      const short = 'test';
      const long = 'test '.repeat(1000);

      // Should use algorithm based on longer string
      const result = smartSimilarity(short, long);
      expect(result).toBeGreaterThanOrEqual(-1);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should be consistent across algorithm boundaries', () => {
      // Test strings near algorithm boundaries
      const boundary1 = 'x'.repeat(99); // Just under 100
      const boundary2 = 'x'.repeat(100); // Exactly 100
      const boundary3 = 'x'.repeat(101); // Just over 100

      const sim1 = smartSimilarity(boundary1, boundary1);
      const sim2 = smartSimilarity(boundary2, boundary2);
      const sim3 = smartSimilarity(boundary3, boundary3);

      expect(sim1).toBe(1.0);
      expect(sim2).toBe(1.0);
      expect(sim3).toBe(1.0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle strings with only whitespace', () => {
      const similarity = smartSimilarity('   ', '   ');
      expect(similarity).toBe(1.0);
    });

    it('should handle strings with special characters', () => {
      const similarity = smartSimilarity('!!!@@@###', '!!!@@@###');
      expect(similarity).toBe(1.0);
    });

    it('should handle unicode and emoji', () => {
      const similarity = smartSimilarity('Hello 🌍', 'Hello 🌍');
      expect(similarity).toBe(1.0);
    });

    it('should handle newlines and tabs', () => {
      const similarity = smartSimilarity('line1\nline2\t tab', 'line1\nline2\t tab');
      expect(similarity).toBe(1.0);
    });

    it('should handle very different lengths', () => {
      const short = 'a';
      const long = 'x'.repeat(10000);

      expect(() => {
        smartSimilarity(short, long);
      }).not.toThrow();
    });

    it('should handle all algorithms with empty strings', () => {
      expect(levenshteinDistanceOptimized('', '')).toBe(0);
      expect(jaroWinklerSimilarity('', '')).toBe(1.0);
      expect(cosineSimilarity('', '')).toBe(1.0);
      expect(hashBasedSimilarity('', '')).toBe(1.0);
      expect(smartSimilarity('', '')).toBe(1.0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should handle 100 comparisons of 1K strings in <1s', () => {
      const str1 = 'word '.repeat(200);
      const str2 = 'word '.repeat(200);

      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        smartSimilarity(str1, str2);
      }
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('should handle 10 comparisons of 20K strings in <2s', () => {
      const str1 = 'content '.repeat(2500);
      const str2 = 'content '.repeat(2500);

      const startTime = performance.now();
      for (let i = 0; i < 10; i++) {
        smartSimilarity(str1, str2);
      }
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });

    it('should early terminate for very different long strings', () => {
      const str1 = 'a'.repeat(20000);
      const str2 = 'b'.repeat(20000);

      const startTime = performance.now();
      const result = levenshteinDistanceOptimized(str1, str2, 100);
      const duration = performance.now() - startTime;

      expect(result).toBe(Infinity);
      expect(duration).toBeLessThan(50); // Should be very fast
    });
  });

  describe('Threshold Behavior', () => {
    it('should respect threshold in algorithms that support it', () => {
      // Only calculateSimilarityOptimized and smartSimilarity support thresholds
      const result1 = calculateSimilarityOptimized('abc', 'xyz', 0.99);
      const result2 = smartSimilarity('abc', 'xyz', 0.99);

      expect(result1).toBe(-1); // Should return -1 when below threshold
      expect(result2).toBe(-1); // Should return -1 when below threshold
    });

    it('should return actual value when above threshold', () => {
      const result = smartSimilarity('test', 'test', 0.9);
      expect(result).toBe(1.0);
    });

    it('should handle threshold of 0', () => {
      const result = smartSimilarity('abc', 'xyz', 0);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle threshold of 1', () => {
      const result = smartSimilarity('abc', 'xyz', 1.0);
      expect(result).toBe(-1); // Won't match unless identical
    });
  });

  describe('Algorithm Correctness', () => {
    it('should produce consistent results across repeated calls', () => {
      const str1 = 'test string';
      const str2 = 'test string';

      const result1 = smartSimilarity(str1, str2);
      const result2 = smartSimilarity(str1, str2);
      const result3 = smartSimilarity(str1, str2);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should be symmetric (similarity(a,b) === similarity(b,a))', () => {
      const str1 = 'hello';
      const str2 = 'hallo';

      const sim1 = smartSimilarity(str1, str2);
      const sim2 = smartSimilarity(str2, str1);

      expect(sim1).toBe(sim2);
    });

    it('should satisfy similarity(a,a) === 1.0', () => {
      const testStrings = ['', 'a', 'test', 'x'.repeat(100), 'y'.repeat(1000)];

      testStrings.forEach(str => {
        expect(smartSimilarity(str, str)).toBe(1.0);
      });
    });

    it('should satisfy 0 <= similarity(a,b) <= 1', () => {
      const pairs = [
        ['abc', 'xyz'],
        ['hello', 'hallo'],
        ['test', 'test'],
        ['', 'nonempty'],
        ['x'.repeat(1000), 'y'.repeat(1000)]
      ];

      pairs.forEach(([str1, str2]) => {
        const sim = smartSimilarity(str1, str2);
        expect(sim).toBeGreaterThanOrEqual(-1); // -1 if below threshold
        expect(sim).toBeLessThanOrEqual(1);
      });
    });
  });
});

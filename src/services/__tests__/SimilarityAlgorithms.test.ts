import { describe, it, expect } from 'vitest';

import {
  levenshteinDistanceOptimized,
  calculateSimilarityOptimized
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
      // CI environments are slower - allow reasonable margin
      const maxDuration = process.env.CI ? 250 : 100;
      expect(duration).toBeLessThan(maxDuration);
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

  describe('Edge Cases', () => {
    it('should handle strings with only whitespace', () => {
      const similarity = calculateSimilarityOptimized('   ', '   ');
      expect(similarity).toBe(1.0);
    });

    it('should handle strings with special characters', () => {
      const similarity = calculateSimilarityOptimized('!!!@@@###', '!!!@@@###');
      expect(similarity).toBe(1.0);
    });

    it('should handle unicode and emoji', () => {
      const similarity = calculateSimilarityOptimized('Hello 🌍', 'Hello 🌍');
      expect(similarity).toBe(1.0);
    });

    it('should handle newlines and tabs', () => {
      const similarity = calculateSimilarityOptimized('line1\nline2\t tab', 'line1\nline2\t tab');
      expect(similarity).toBe(1.0);
    });

    it('should handle very different lengths', () => {
      const short = 'a';
      const long = 'x'.repeat(10000);

      expect(() => {
        calculateSimilarityOptimized(short, long);
      }).not.toThrow();
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistanceOptimized('', '')).toBe(0);
      expect(calculateSimilarityOptimized('', '')).toBe(1.0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should handle 100 comparisons of 1K strings in <1s', () => {
      const str1 = 'word '.repeat(200);
      const str2 = 'word '.repeat(200);

      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        calculateSimilarityOptimized(str1, str2);
      }
      const duration = performance.now() - startTime;

      // CI environments are slower - allow reasonable margin for batch operations
      const maxDuration = process.env.CI ? 6000 : 1000;
      expect(duration).toBeLessThan(maxDuration);
    });

    it('should handle comparisons of 20K strings', { timeout: 30000 }, () => {
      const str1 = 'content '.repeat(2500);
      const str2 = 'content '.repeat(2500);

      // Test just one comparison - verifies it works with large strings
      const startTime = performance.now();
      const result = calculateSimilarityOptimized(str1, str2);
      const duration = performance.now() - startTime;

      expect(result).toBe(1.0);
      // CI environments are slower - extremely heavy computation for full 20K comparison
      const maxDuration = process.env.CI ? 25000 : 5000;
      expect(duration).toBeLessThan(maxDuration); // Single comparison should complete
    });

    it('should early terminate for very different long strings', () => {
      const str1 = 'a'.repeat(20000);
      const str2 = 'b'.repeat(20000);

      const startTime = performance.now();
      const result = levenshteinDistanceOptimized(str1, str2, 100);
      const duration = performance.now() - startTime;

      expect(result).toBe(Infinity);
      // CI environments are slower - allow reasonable margin while still validating optimization
      const maxDuration = process.env.CI ? 200 : 100;
      expect(duration).toBeLessThan(maxDuration);
    });
  });

  describe('Threshold Behavior', () => {
    it('should respect threshold in calculateSimilarityOptimized', () => {
      const result = calculateSimilarityOptimized('abc', 'xyz', 0.99);
      expect(result).toBe(-1); // Should return -1 when below threshold
    });

    it('should return actual value when above threshold', () => {
      const result = calculateSimilarityOptimized('test', 'test', 0.9);
      expect(result).toBe(1.0);
    });

    it('should handle threshold of 0', () => {
      const result = calculateSimilarityOptimized('abc', 'xyz', 0);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle threshold of 1', () => {
      const result = calculateSimilarityOptimized('abc', 'xyz', 1.0);
      expect(result).toBe(-1); // Won't match unless identical
    });
  });

  describe('Algorithm Correctness', () => {
    it('should produce consistent results across repeated calls', () => {
      const str1 = 'test string';
      const str2 = 'test string';

      const result1 = calculateSimilarityOptimized(str1, str2);
      const result2 = calculateSimilarityOptimized(str1, str2);
      const result3 = calculateSimilarityOptimized(str1, str2);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should be symmetric (similarity(a,b) === similarity(b,a))', () => {
      const str1 = 'hello';
      const str2 = 'hallo';

      const sim1 = calculateSimilarityOptimized(str1, str2);
      const sim2 = calculateSimilarityOptimized(str2, str1);

      expect(sim1).toBe(sim2);
    });

    it('should satisfy similarity(a,a) === 1.0', () => {
      const testStrings = ['', 'a', 'test', 'x'.repeat(100), 'y'.repeat(1000)];

      testStrings.forEach(str => {
        expect(calculateSimilarityOptimized(str, str)).toBe(1.0);
      });
    });

    it('should satisfy 0 <= similarity(a,b) <= 1 (or -1 for below threshold)', () => {
      const pairs = [
        ['abc', 'xyz'],
        ['hello', 'hallo'],
        ['test', 'test'],
        ['', 'nonempty'],
        ['x'.repeat(1000), 'y'.repeat(1000)]
      ];

      pairs.forEach(([str1, str2]) => {
        const sim = calculateSimilarityOptimized(str1, str2);
        expect(sim).toBeGreaterThanOrEqual(-1); // -1 if below threshold
        expect(sim).toBeLessThanOrEqual(1);
      });
    });
  });
});

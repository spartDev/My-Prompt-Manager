
import { describe, it, expect } from 'vitest';
import {
  checkQuotaAvailability,
  estimatePromptSize,
  estimatePromptsArraySize,
  calculateMaxPrompts,
  formatBytes,
  getStorageStats,
  QUOTA_THRESHOLDS,
  ESTIMATED_SIZES
} from '../storageQuota';

describe('StorageQuota Utils', () => {
  describe('checkQuotaAvailability', () => {
    const totalQuota = 5 * 1024 * 1024; // 5MB

    it('should allow write when space is ample', () => {
      const currentUsage = 1 * 1024 * 1024; // 1MB
      const estimatedSize = 1000; // 1KB

      const result = checkQuotaAvailability(estimatedSize, currentUsage, totalQuota);

      expect(result.canWrite).toBe(true);
      expect(result.available).toBe(totalQuota - currentUsage);
      expect(result.afterWrite).toBe(currentUsage + estimatedSize);
      expect(result.percentageAfterWrite).toBeLessThan(QUOTA_THRESHOLDS.WARNING * 100);
    });

    it('should deny write when exceeding total quota', () => {
      const currentUsage = 4.99 * 1024 * 1024;
      const estimatedSize = 0.02 * 1024 * 1024; // 20KB

      const result = checkQuotaAvailability(estimatedSize, currentUsage, totalQuota);

      expect(result.canWrite).toBe(false);
      expect(result.reason).toMatch(/Insufficient storage space/);
    });

    it('should deny write when exceeding danger threshold', () => {
      // DANGER threshold is 0.98
      const currentUsage = 0.97 * totalQuota;
      // Add enough to push over 0.98 but stay under 1.0
      const estimatedSize = 0.015 * totalQuota;

      const result = checkQuotaAvailability(estimatedSize, currentUsage, totalQuota);

      expect(result.canWrite).toBe(false);
      expect(result.reason).toMatch(/exceed safety threshold/);
      expect(result.percentageAfterWrite).toBeGreaterThan(QUOTA_THRESHOLDS.DANGER * 100);
    });
  });

  describe('estimatePromptSize', () => {
    it('should calculate size correctly based on constants', () => {
      const title = 'Test';
      const content = 'Content';
      const category = 'Category';

      const size = estimatePromptSize(title, content, category);

      const expectedSize = ESTIMATED_SIZES.PROMPT_BASE +
        (title.length * ESTIMATED_SIZES.PROMPT_PER_CHAR) +
        (content.length * ESTIMATED_SIZES.PROMPT_PER_CHAR) +
        (category.length * ESTIMATED_SIZES.PROMPT_PER_CHAR);

      expect(size).toBe(expectedSize);
    });

    it('should handle empty strings', () => {
      const size = estimatePromptSize('', '', '');
      expect(size).toBe(ESTIMATED_SIZES.PROMPT_BASE);
    });
  });

  describe('estimatePromptsArraySize', () => {
    it('should sum up sizes of all prompts', () => {
      const prompts = [
        { title: 'T1', content: 'C1', category: 'Cat1' },
        { title: 'T2', content: 'C2', category: 'Cat2' }
      ];

      const size = estimatePromptsArraySize(prompts);
      const expectedSize = estimatePromptSize('T1', 'C1', 'Cat1') +
                           estimatePromptSize('T2', 'C2', 'Cat2');

      expect(size).toBe(expectedSize);
    });

    it('should return 0 for empty array', () => {
      expect(estimatePromptsArraySize([])).toBe(0);
    });
  });

  describe('calculateMaxPrompts', () => {
    it('should calculate correct number of prompts', () => {
      const availableBytes = 10000;
      const avgPromptLength = 5000;

      const avgPromptSize =
        ESTIMATED_SIZES.PROMPT_BASE +
        (50 * ESTIMATED_SIZES.PROMPT_PER_CHAR) + // title
        (avgPromptLength * ESTIMATED_SIZES.PROMPT_PER_CHAR) + // content
        (10 * ESTIMATED_SIZES.PROMPT_PER_CHAR); // category

      const expected = Math.floor(availableBytes / avgPromptSize);
      const result = calculateMaxPrompts(availableBytes, avgPromptLength);

      expect(result).toBe(expected);
    });

    it('should return 0 when available bytes is small', () => {
      expect(calculateMaxPrompts(10)).toBe(0);
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500.00 B');
    });

    it('should format KB', () => {
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1536)).toBe('1.50 KB');
    });

    it('should format MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    });

    it('should format GB', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    });
  });

  describe('getStorageStats', () => {
    const total = 1000;

    it('should return safe level', () => {
      const used = 100; // 10%
      const stats = getStorageStats(used, total);

      expect(stats.warningLevel).toBe('safe');
      expect(stats.percentage).toBe(10);
      expect(stats.recommendation).toMatch(/Storage is healthy/);
    });

    it('should return warning level', () => {
      const used = 750; // 75% > SAFE(70%)
      const stats = getStorageStats(used, total);

      expect(stats.warningLevel).toBe('warning');
      expect(stats.percentage).toBe(75);
      expect(stats.recommendation).toMatch(/Storage is getting full/);
    });

    it('should return critical level', () => {
      const used = 900; // 90% > WARNING(85%)
      const stats = getStorageStats(used, total);

      expect(stats.warningLevel).toBe('critical');
      expect(stats.percentage).toBe(90);
      expect(stats.recommendation).toMatch(/Storage is critically low/);
    });

    it('should return danger level', () => {
      const used = 960; // 96% > CRITICAL(95%)
      const stats = getStorageStats(used, total);

      expect(stats.warningLevel).toBe('danger');
      expect(stats.percentage).toBe(96);
      expect(stats.recommendation).toMatch(/Storage is nearly full/);
    });

    it('should calculate estimated prompts remaining', () => {
      const used = 0;
      const stats = getStorageStats(used, total);
      const expected = calculateMaxPrompts(total);
      expect(stats.estimatedPromptsRemaining).toBe(expected);
    });
  });
});


import { describe, expect, it } from 'vitest';

import {
  calculateMaxPrompts,
  checkQuotaAvailability,
  ESTIMATED_SIZES,
  formatBytes,
  getStorageStats,
  QUOTA_THRESHOLDS,
  storedSize
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

  describe('storedSize', () => {
    it('counts one byte per ASCII character of the JSON Chrome stores', () => {
      expect(storedSize('x'.repeat(1000))).toBe(1002);
      expect(storedSize({ title: 'Draft', usageCount: 3 })).toBe('{"title":"Draft","usageCount":3}'.length);
    });

    it('counts the UTF-8 bytes of non-ASCII text, as Chrome measured them', () => {
      expect(storedSize('é'.repeat(1000))).toBe(2002);
      expect(storedSize('😀'.repeat(500))).toBe(2002);
      expect(storedSize('中'.repeat(1000))).toBe(3002);
    });

    it('counts the 6-byte escapes Chrome writes for <, U+2028 and U+2029, and the 2 bytes of \\n and "', () => {
      expect(storedSize('<'.repeat(1000))).toBe(6002);
      expect(storedSize('\u2028\u2029'.repeat(500))).toBe(6002);
      expect(storedSize('\n"'.repeat(500))).toBe(2002);
      expect(storedSize('>&'.repeat(500))).toBe(1002);
    });

    it('counts an integer past 32 bits, such as a timestamp, at the longest form Chrome writes: 5 bytes more', () => {
      expect(storedSize(1_793_212_345_678)).toBe('1.793212345678e+12'.length);
      expect(storedSize({ createdAt: -1_793_212_345_678, usageCount: 2_147_483_647, ratio: 1.5 }))
        .toBe('{"createdAt":-1793212345678,"usageCount":2147483647,"ratio":1.5}'.length + 5);
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

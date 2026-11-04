
import { describe, expect, it } from 'vitest';

import {
  checkQuotaAvailability,
  describeStorageUsage,
  formatBytes,
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

    // The storage warning shows this reason under the sizes of describeStorageUsage: one format for both
    it('gives the sizes in its reason as the storage warning shows them', () => {
      const result = checkQuotaAvailability(1536, totalQuota - 512, totalQuota);

      expect(result.reason).toBe(
        `Insufficient storage space. Need ${describeStorageUsage(1536, totalQuota).used} but only ${describeStorageUsage(512, totalQuota).used} available.`
      );
      expect(result.reason).toBe('Insufficient storage space. Need 1.5 KB but only 512 Bytes available.');
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

  describe('formatBytes', () => {
    it('formats zero and a few bytes in Bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(500)).toBe('500 Bytes');
    });

    it('formats KB, MB and GB with at most two decimals and no trailing zeros', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(19_200)).toBe('18.75 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  // The Settings bar and the storage warning show Chrome's use through this one function, so they agree
  describe('describeStorageUsage', () => {
    const QUOTA = 10_485_760;

    it('gives the bytes in use and the quota as sizes, and the percentage of the quota in use', () => {
      expect(describeStorageUsage(4_404_019, QUOTA)).toEqual({ percentage: 42, used: '4.2 MB', total: '10 MB' });
    });

    it('rounds the percentage to a whole number', () => {
      expect(describeStorageUsage(QUOTA * 0.9748332977294922, QUOTA).percentage).toBe(97);
      expect(describeStorageUsage(QUOTA * 0.004, QUOTA).percentage).toBe(0);
      expect(describeStorageUsage(QUOTA * 0.996, QUOTA).percentage).toBe(100);
    });

    it('formats bytes, kilobytes and gigabytes', () => {
      expect(describeStorageUsage(0, QUOTA).used).toBe('0 Bytes');
      expect(describeStorageUsage(500, QUOTA).used).toBe('500 Bytes');
      expect(describeStorageUsage(1536, QUOTA).used).toBe('1.5 KB');
      expect(describeStorageUsage(1_073_741_824, 2_147_483_648)).toEqual({ percentage: 50, used: '1 GB', total: '2 GB' });
    });
  });
});

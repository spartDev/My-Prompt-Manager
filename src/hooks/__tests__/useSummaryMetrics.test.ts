import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { UsageStats } from '../../types/hooks';
import { useSummaryMetrics } from '../useSummaryMetrics';

// Helper to create mock stats
function createMockStats(overrides: Partial<UsageStats> = {}): UsageStats {
  return {
    totalUses: 100,
    dailyUsage: [{ date: '2024-01-01', count: 10 }],
    platformBreakdown: [
      { platform: 'claude', count: 50, percentage: 62.5 },
      { platform: 'chatgpt', count: 30, percentage: 37.5 },
    ],
    dayOfWeekDistribution: [
      { day: 'Monday', dayIndex: 1, count: 20 },
      { day: 'Tuesday', dayIndex: 2, count: 15 },
      { day: 'Wednesday', dayIndex: 3, count: 10 },
    ],
    timeOfDayDistribution: [{ bucket: 'Afternoon', count: 25 }],
    categoryDistribution: [
      { categoryId: 'cat-1', name: 'Writing', count: 40 },
      { categoryId: 'cat-2', name: 'Coding', count: 35 },
    ],
    topPrompts: [],
    recentPrompts: [],
    forgottenPrompts: [],
    ...overrides,
  };
}

describe('useSummaryMetrics', () => {
  describe('null/undefined stats', () => {
    it('should return default values when stats is null', () => {
      const { result } = renderHook(() => useSummaryMetrics(null));

      expect(result.current).toEqual({
        totalUses: 0,
        topPlatform: null,
        peakDay: null,
        topCategory: null,
      });
    });

    it('should return default values when stats is undefined', () => {
      const { result } = renderHook(() => useSummaryMetrics(undefined));

      expect(result.current).toEqual({
        totalUses: 0,
        topPlatform: null,
        peakDay: null,
        topCategory: null,
      });
    });
  });

  describe('totalUses', () => {
    it('should return totalUses from stats', () => {
      const stats = createMockStats({ totalUses: 250 });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.totalUses).toBe(250);
    });

    it('should return 0 totalUses when stats has no usage', () => {
      const stats = createMockStats({ totalUses: 0 });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.totalUses).toBe(0);
    });
  });

  describe('topPlatform', () => {
    it('should return top platform from platformBreakdown', () => {
      const stats = createMockStats({
        platformBreakdown: [
          { platform: 'claude', count: 50, percentage: 62.5 },
          { platform: 'chatgpt', count: 30, percentage: 37.5 },
        ],
      });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.topPlatform).toEqual({
        name: 'claude',
        count: 50,
      });
    });

    it('should return null when platformBreakdown is empty', () => {
      const stats = createMockStats({ platformBreakdown: [] });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.topPlatform).toBeNull();
    });

    it('should handle single platform in breakdown', () => {
      const stats = createMockStats({
        platformBreakdown: [{ platform: 'perplexity', count: 100, percentage: 100 }],
      });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.topPlatform).toEqual({
        name: 'perplexity',
        count: 100,
      });
    });
  });

  describe('peakDay', () => {
    it('should return day with highest count', () => {
      const stats = createMockStats({
        dayOfWeekDistribution: [
          { day: 'Monday', dayIndex: 1, count: 10 },
          { day: 'Tuesday', dayIndex: 2, count: 30 },
          { day: 'Wednesday', dayIndex: 3, count: 20 },
        ],
      });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.peakDay).toEqual({
        day: 'Tuesday',
        count: 30,
      });
    });

    it('should return null when dayOfWeekDistribution is empty', () => {
      const stats = createMockStats({ dayOfWeekDistribution: [] });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.peakDay).toBeNull();
    });

    it('should return null when all days have 0 count', () => {
      const stats = createMockStats({
        dayOfWeekDistribution: [
          { day: 'Monday', dayIndex: 1, count: 0 },
          { day: 'Tuesday', dayIndex: 2, count: 0 },
        ],
      });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.peakDay).toBeNull();
    });

    it('should handle tied counts (returns first in sorted order)', () => {
      const stats = createMockStats({
        dayOfWeekDistribution: [
          { day: 'Monday', dayIndex: 1, count: 20 },
          { day: 'Tuesday', dayIndex: 2, count: 20 },
          { day: 'Wednesday', dayIndex: 3, count: 10 },
        ],
      });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      // Since we sort descending and both have 20, the order depends on sort stability
      // The first one with count 20 should be returned
      expect(result.current.peakDay?.count).toBe(20);
    });
  });

  describe('topCategory', () => {
    it('should return top category from categoryDistribution', () => {
      const stats = createMockStats({
        categoryDistribution: [
          { categoryId: 'cat-1', name: 'Writing', count: 60 },
          { categoryId: 'cat-2', name: 'Coding', count: 40 },
        ],
      });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.topCategory).toEqual({
        name: 'Writing',
        count: 60,
      });
    });

    it('should return null when categoryDistribution is empty', () => {
      const stats = createMockStats({ categoryDistribution: [] });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.topCategory).toBeNull();
    });

    it('should handle single category', () => {
      const stats = createMockStats({
        categoryDistribution: [{ categoryId: 'cat-1', name: 'General', count: 100 }],
      });
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current.topCategory).toEqual({
        name: 'General',
        count: 100,
      });
    });
  });

  describe('memoization', () => {
    it('should return same object reference for same stats', () => {
      const stats = createMockStats();
      const { result, rerender } = renderHook(() => useSummaryMetrics(stats));

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it('should return new object when stats change', () => {
      const stats1 = createMockStats({ totalUses: 100 });
      const stats2 = createMockStats({ totalUses: 200 });

      const { result, rerender } = renderHook(
        ({ stats }) => useSummaryMetrics(stats),
        { initialProps: { stats: stats1 } }
      );

      const firstResult = result.current;

      rerender({ stats: stats2 });
      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
      expect(firstResult.totalUses).toBe(100);
      expect(secondResult.totalUses).toBe(200);
    });
  });

  describe('return type structure', () => {
    it('should return all expected properties', () => {
      const stats = createMockStats();
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(result.current).toHaveProperty('totalUses');
      expect(result.current).toHaveProperty('topPlatform');
      expect(result.current).toHaveProperty('peakDay');
      expect(result.current).toHaveProperty('topCategory');
    });

    it('should have correct types for all properties', () => {
      const stats = createMockStats();
      const { result } = renderHook(() => useSummaryMetrics(stats));

      expect(typeof result.current.totalUses).toBe('number');
      expect(result.current.topPlatform === null || typeof result.current.topPlatform === 'object').toBe(true);
      expect(result.current.peakDay === null || typeof result.current.peakDay === 'object').toBe(true);
      expect(result.current.topCategory === null || typeof result.current.topCategory === 'object').toBe(true);
    });
  });
});

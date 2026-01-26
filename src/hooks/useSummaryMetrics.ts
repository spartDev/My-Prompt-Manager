import { useMemo } from 'react';

import type { UsageStats } from '../types/hooks';

export interface SummaryMetrics {
  totalUses: number;
  topPlatform: { name: string; count: number } | null;
  peakDay: { day: string; count: number } | null;
  topCategory: { name: string; count: number } | null;
}

/**
 * Compute summary metrics from usage stats
 * Extracts top platform, peak day, and top category from the stats
 * @param stats - Usage statistics from useUsageStats hook (can be null/undefined while loading)
 * @returns Summary metrics object with derived statistics
 */
export function useSummaryMetrics(stats: UsageStats | null | undefined): SummaryMetrics {
  return useMemo(() => {
    if (!stats) {
      return {
        totalUses: 0,
        topPlatform: null,
        peakDay: null,
        topCategory: null
      };
    }

    // Top platform
    const topPlatform = stats.platformBreakdown.length > 0
      ? { name: stats.platformBreakdown[0].platform, count: stats.platformBreakdown[0].count }
      : null;

    // Peak day (day of week with most usage)
    const sortedDays = [...stats.dayOfWeekDistribution].sort((a, b) => b.count - a.count);
    const peakDayData = sortedDays.length > 0 ? sortedDays[0] : null;
    const peakDay = peakDayData && peakDayData.count > 0
      ? { day: peakDayData.day, count: peakDayData.count }
      : null;

    // Top category
    const topCategory = stats.categoryDistribution.length > 0
      ? { name: stats.categoryDistribution[0].name, count: stats.categoryDistribution[0].count }
      : null;

    return {
      totalUses: stats.totalUses,
      topPlatform,
      peakDay,
      topCategory
    };
  }, [stats]);
}

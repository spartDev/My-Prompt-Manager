import { useState, useEffect, useCallback, useMemo } from 'react';

import { StorageManager } from '../services/storage';
import { UsageTracker } from '../services/UsageTracker';
import { UsageEvent, AppError, Prompt, USAGE_RETENTION_DAYS } from '../types';
import {
  UsageStats,
  UseUsageStatsReturn,
  DailyUsage,
  PlatformBreakdown,
  DayOfWeekDistribution,
  TimeOfDayDistribution,
  CategoryDistribution,
  PromptUsageSummary
} from '../types/hooks';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_BUCKETS = ['Night', 'Morning', 'Afternoon', 'Evening'] as const;
const FORGOTTEN_DAYS_THRESHOLD = 14;

/**
 * Get time bucket based on hour of day
 * Morning: 6-12, Afternoon: 12-18, Evening: 18-22, Night: 22-6
 */
function getTimeBucket(hour: number): string {
  if (hour >= 6 && hour < 12) {
    return 'Morning';
  }
  if (hour >= 12 && hour < 18) {
    return 'Afternoon';
  }
  if (hour >= 18 && hour < 22) {
    return 'Evening';
  }
  return 'Night';
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate daily usage for the last 30 days
 */
function calculateDailyUsage(events: UsageEvent[]): DailyUsage[] {
  const dailyMap = new Map<string, number>();

  // Initialize all 30 days with 0 counts
  const now = new Date();
  for (let i = USAGE_RETENTION_DAYS - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dailyMap.set(formatDate(date), 0);
  }

  // Count events per day
  for (const event of events) {
    const dateStr = formatDate(new Date(event.timestamp));
    if (dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + 1);
    }
  }

  // Convert to sorted array
  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Calculate platform breakdown with percentages
 */
function calculatePlatformBreakdown(events: UsageEvent[]): PlatformBreakdown[] {
  const platformCounts = new Map<string, number>();

  for (const event of events) {
    platformCounts.set(event.platform, (platformCounts.get(event.platform) ?? 0) + 1);
  }

  const total = events.length;
  return Array.from(platformCounts.entries())
    .map(([platform, count]) => ({
      platform,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate day of week distribution
 */
function calculateDayOfWeekDistribution(events: UsageEvent[]): DayOfWeekDistribution[] {
  const dayCounts = new Map<number, number>();

  // Initialize all days with 0
  for (let i = 0; i < 7; i++) {
    dayCounts.set(i, 0);
  }

  for (const event of events) {
    const dayIndex = new Date(event.timestamp).getDay();
    dayCounts.set(dayIndex, (dayCounts.get(dayIndex) ?? 0) + 1);
  }

  return Array.from(dayCounts.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayIndex, count]) => ({
      day: DAY_NAMES[dayIndex],
      dayIndex,
      count
    }));
}

/**
 * Calculate time of day distribution
 */
function calculateTimeOfDayDistribution(events: UsageEvent[]): TimeOfDayDistribution[] {
  const bucketCounts = new Map<string, number>();

  // Initialize all buckets with 0
  for (const bucket of TIME_BUCKETS) {
    bucketCounts.set(bucket, 0);
  }

  for (const event of events) {
    const hour = new Date(event.timestamp).getHours();
    const bucket = getTimeBucket(hour);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }

  // Return in logical order: Morning, Afternoon, Evening, Night
  return ['Morning', 'Afternoon', 'Evening', 'Night'].map(bucket => ({
    bucket,
    count: bucketCounts.get(bucket) ?? 0
  }));
}

/**
 * Calculate category distribution
 */
function calculateCategoryDistribution(
  events: UsageEvent[],
  prompts: Prompt[]
): CategoryDistribution[] {
  const categoryCounts = new Map<string | null, number>();

  // Create a map of promptId to category name
  const promptCategories = new Map<string, string>();
  for (const prompt of prompts) {
    promptCategories.set(prompt.id, prompt.category);
  }

  for (const event of events) {
    const categoryName = promptCategories.get(event.promptId) ?? 'Unknown';
    categoryCounts.set(categoryName, (categoryCounts.get(categoryName) ?? 0) + 1);
  }

  return Array.from(categoryCounts.entries())
    .map(([name, count]) => ({
      categoryId: name, // Using name as ID since we have the name
      name: name ?? 'Uncategorized',
      count
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate prompt usage summaries
 */
function calculatePromptSummaries(
  events: UsageEvent[],
  prompts: Prompt[]
): {
  topPrompts: PromptUsageSummary[];
  recentPrompts: PromptUsageSummary[];
  forgottenPrompts: PromptUsageSummary[];
} {
  // Create a map for prompt details
  const promptMap = new Map<string, Prompt>();
  for (const prompt of prompts) {
    promptMap.set(prompt.id, prompt);
  }

  // Aggregate usage by prompt
  const usageByPrompt = new Map<string, { count: number; lastUsed: number }>();
  for (const event of events) {
    const existing = usageByPrompt.get(event.promptId);
    if (existing) {
      existing.count++;
      existing.lastUsed = Math.max(existing.lastUsed, event.timestamp);
    } else {
      usageByPrompt.set(event.promptId, { count: 1, lastUsed: event.timestamp });
    }
  }

  // Build summaries (only for prompts that still exist)
  const summaries: PromptUsageSummary[] = [];
  for (const [promptId, usage] of usageByPrompt.entries()) {
    const prompt = promptMap.get(promptId);
    if (prompt) {
      summaries.push({
        promptId,
        title: prompt.title,
        category: prompt.category,
        count: usage.count,
        lastUsed: usage.lastUsed
      });
    }
  }

  // Top prompts: sorted by count descending
  const topPrompts = [...summaries]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Recent prompts: sorted by lastUsed descending
  const recentPrompts = [...summaries]
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, 10);

  // Forgotten prompts: prompts that exist but haven't been used in FORGOTTEN_DAYS_THRESHOLD days
  const forgottenCutoff = Date.now() - (FORGOTTEN_DAYS_THRESHOLD * 24 * 60 * 60 * 1000);

  // Find all prompts that have been used but not recently
  const usedPromptIds = new Set(usageByPrompt.keys());
  const forgottenFromUsage = summaries
    .filter(s => s.lastUsed < forgottenCutoff)
    .sort((a, b) => a.lastUsed - b.lastUsed);

  // Also include prompts that have never been used (if they exist for a while)
  const neverUsed: PromptUsageSummary[] = [];
  for (const prompt of prompts) {
    if (!usedPromptIds.has(prompt.id) && prompt.createdAt < forgottenCutoff) {
      neverUsed.push({
        promptId: prompt.id,
        title: prompt.title,
        category: prompt.category,
        count: 0,
        lastUsed: prompt.createdAt
      });
    }
  }

  const forgottenPrompts = [...forgottenFromUsage, ...neverUsed]
    .sort((a, b) => a.lastUsed - b.lastUsed)
    .slice(0, 10);

  return { topPrompts, recentPrompts, forgottenPrompts };
}

/**
 * Hook for fetching and aggregating usage analytics
 */
export function useUsageStats(): UseUsageStatsReturn {
  const [history, setHistory] = useState<UsageEvent[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AppError | null>(null);

  const usageTracker = UsageTracker.getInstance();
  const storageManager = StorageManager.getInstance();

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both history and prompts in parallel
      const [usageHistory, allPrompts] = await Promise.all([
        usageTracker.getHistory(),
        storageManager.getPrompts()
      ]);

      setHistory(usageHistory);
      setPrompts(allPrompts);
    } catch (err) {
      setError(err as AppError);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Singletons never change

  const clearHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await usageTracker.clearHistory();
      setHistory([]);
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Singleton never changes

  // Compute stats from history and prompts
  const stats = useMemo((): UsageStats | null => {
    if (loading && history.length === 0) {
      return null;
    }

    const { topPrompts, recentPrompts, forgottenPrompts } = calculatePromptSummaries(history, prompts);

    return {
      totalUses: history.length,
      dailyUsage: calculateDailyUsage(history),
      platformBreakdown: calculatePlatformBreakdown(history),
      dayOfWeekDistribution: calculateDayOfWeekDistribution(history),
      timeOfDayDistribution: calculateTimeOfDayDistribution(history),
      categoryDistribution: calculateCategoryDistribution(history, prompts),
      topPrompts,
      recentPrompts,
      forgottenPrompts
    };
  }, [history, prompts, loading]);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    stats,
    history,
    loading,
    error,
    refresh,
    clearHistory
  };
}

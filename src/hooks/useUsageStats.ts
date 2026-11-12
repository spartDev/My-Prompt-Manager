import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StorageManager } from '../services/storage';
import { UsageTracker } from '../services/UsageTracker';
import { type AppError, type Category, type Prompt, USAGE_RETENTION_DAYS, USAGE_STORAGE_KEY, type UsageEvent } from '../types';
import type {
  DailyUsage,
  TimeOfDayDistribution,
  UsageStats,
  UseUsageStatsReturn
} from '../types/hooks';
import { Logger, toError } from '../utils';

const TIME_BUCKETS = ['Night', 'Morning', 'Afternoon', 'Evening'] as const;

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
 * Format date as YYYY-MM-DD, its local calendar day (like Day of Week and Time of Day)
 */
function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
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
 * Hook for fetching and aggregating usage analytics
 */
export function useUsageStats(): UseUsageStatsReturn {
  const [history, setHistory] = useState<UsageEvent[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AppError | null>(null);

  // Each read or clear takes the next generation; a read commits only if none started after it, so
  // an older read that ends last cannot put back what a newer one, or a clear, replaced
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    try {
      setLoading(true);
      setError(null);

      // Fetch history, prompts and categories in parallel
      const storageManager = StorageManager.getInstance();
      const [usageHistory, allPrompts, allCategories] = await Promise.all([
        UsageTracker.getInstance().getHistory(),
        storageManager.getPrompts(),
        storageManager.getCategories()
      ]);

      if (generation !== generationRef.current) { return; }
      setHistory(usageHistory);
      setPrompts(allPrompts);
      setCategories(allCategories);
    } catch (err) {
      if (generation === generationRef.current) {
        setError(err as AppError);
      }
    } finally {
      // The loading state ends with the latest read; a reload that overtook this one never set it
      setLoading(false);
    }
  }, []); // Singletons never change

  const clearHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await UsageTracker.getInstance().clearHistory();
      generationRef.current++;
      setHistory([]);
    } catch (err) {
      setError(err as AppError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []); // Singleton never changes

  // Compute stats from history and prompts
  const stats = useMemo((): UsageStats | null => {
    if (loading && history.length === 0) {
      return null;
    }

    return {
      totalUses: history.length,
      dailyUsage: calculateDailyUsage(history),
      timeOfDayDistribution: calculateTimeOfDayDistribution(history)
    };
  }, [history, loading]);

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // An Insertion counted while the view stays open (the side panel, beside a Platform) shows at once:
  // the history, the Prompts and the Categories are read again, without the loading state, so nothing
  // flickers
  useEffect(() => {
    // chrome.storage.onChanged may not be available in all contexts (see useTheme)
    const onChangedApi = typeof chrome !== 'undefined' ? chrome.storage.onChanged : undefined;
    if (!onChangedApi) { return; }
    let stale = false;
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'local' || !(USAGE_STORAGE_KEY in changes)) { return; }
      const generation = ++generationRef.current;
      // Everything the first read gives: this reload may overtake it, and it then commits nothing
      const storageManager = StorageManager.getInstance();
      void Promise.all([UsageTracker.getInstance().getHistory(), storageManager.getPrompts(), storageManager.getCategories()])
        .then(([usageHistory, allPrompts, allCategories]) => {
          if (stale || generation !== generationRef.current) { return; }
          setHistory(usageHistory);
          setPrompts(allPrompts);
          setCategories(allCategories);
        })
        .catch((err: unknown) => {
          Logger.error('Failed to reload usage history', toError(err), { component: 'useUsageStats' });
        });
    };
    onChangedApi.addListener(handleStorageChange);
    return () => {
      stale = true;
      onChangedApi.removeListener(handleStorageChange);
    };
  }, []);

  return {
    stats,
    history,
    prompts,
    categories,
    loading,
    error,
    refresh,
    clearHistory
  };
}

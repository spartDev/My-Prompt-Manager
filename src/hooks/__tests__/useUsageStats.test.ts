import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPrompt } from '../../test/builders';
import type { Prompt, UsageEvent } from '../../types';
import { DEFAULT_CATEGORY, USAGE_RETENTION_DAYS, USAGE_STORAGE_KEY } from '../../types';
import { useUsageStats } from '../useUsageStats';

const NOW = Date.now();

/**
 * Helper to build a UsageEvent with defaults
 */
function buildUsageEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    promptId: overrides.promptId ?? 'prompt-1',
    timestamp: overrides.timestamp ?? NOW,
    platform: overrides.platform ?? 'claude',
    categoryId: overrides.categoryId ?? null
  };
}

describe('useUsageStats', () => {
  const mockPrompts: Prompt[] = [
    buildPrompt({ id: 'prompt-1', title: 'Test Prompt 1', category: 'Development' }),
    buildPrompt({ id: 'prompt-2', title: 'Test Prompt 2', category: 'Design' }),
    buildPrompt({ id: 'prompt-3', title: 'Test Prompt 3', category: DEFAULT_CATEGORY })
  ];

  beforeEach(async () => {
    // Initialize storage with default data
    await chrome.storage.local.set({
      prompts: mockPrompts,
      categories: [
        { id: 'cat-1', name: DEFAULT_CATEGORY },
        { id: 'cat-2', name: 'Development' },
        { id: 'cat-3', name: 'Design' }
      ],
      settings: {
        defaultCategory: DEFAULT_CATEGORY,
        sortOrder: 'updatedAt',
        sortDirection: 'desc',
        theme: 'light'
      }
    });

    // Clear usage history
    await chrome.storage.local.remove(USAGE_STORAGE_KEY);
  });

  describe('Loading', () => {
    it('should load usage stats on mount', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1', platform: 'claude' }),
        buildUsageEvent({ promptId: 'prompt-2', platform: 'chatgpt', timestamp: NOW - 1000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).not.toBeNull();
      expect(result.current.stats?.totalUses).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it('should return null stats while loading initially', async () => {
      const { result } = renderHook(() => useUsageStats());

      expect(result.current.loading).toBe(true);
      expect(result.current.stats).toBeNull();
    });

    it('should handle load errors gracefully', async () => {
      const getSpy = vi.spyOn(chrome.storage.local, 'get');
      getSpy.mockRejectedValueOnce(new Error('Failed to load'));

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();

      getSpy.mockRestore();
    });
  });

  describe('Total Uses', () => {
    it('should calculate total uses correctly', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ timestamp: NOW }),
        buildUsageEvent({ timestamp: NOW - 1000 }),
        buildUsageEvent({ timestamp: NOW - 2000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats?.totalUses).toBe(3);
    });

    it('should return 0 for empty history', async () => {
      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats?.totalUses).toBe(0);
    });
  });

  describe('Daily Usage', () => {
    it('should calculate daily usage for 30 days', async () => {
      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats?.dailyUsage).toHaveLength(USAGE_RETENTION_DAYS);
    });

    it('should count events per day correctly', async () => {
      const today = new Date(NOW).toLocaleDateString('en-CA'); // YYYY-MM-DD, local day
      const events: UsageEvent[] = [
        buildUsageEvent({ timestamp: NOW }),
        buildUsageEvent({ timestamp: NOW - 1000 }),
        buildUsageEvent({ timestamp: NOW - 2000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const todayUsage = result.current.stats?.dailyUsage.find(d => d.date === today);
      expect(todayUsage?.count).toBe(3);
    });

    it('should be sorted by date ascending', async () => {
      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const dates = result.current.stats?.dailyUsage.map(d => d.date) ?? [];
      const sortedDates = [...dates].sort();
      expect(dates).toEqual(sortedDates);
    });

    describe('in the local time zone (Europe/Paris)', () => {
      const systemTimeZone = process.env.TZ;

      beforeEach(() => {
        process.env.TZ = 'Europe/Paris';
        vi.useFakeTimers({ toFake: ['Date'] });
      });

      afterEach(() => {
        vi.useRealTimers();
        if (systemTimeZone === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = systemTimeZone;
        }
      });

      const dailyUsageAt = async (now: string, insertions: string[]) => {
        vi.setSystemTime(new Date(now));
        await chrome.storage.local.set({
          [USAGE_STORAGE_KEY]: insertions.map(at => buildUsageEvent({ timestamp: Date.parse(at) }))
        });

        const { result } = renderHook(() => useUsageStats());
        await waitFor(() => {
          expect(result.current.loading).toBe(false);
        });
        return result.current.stats;
      };

      it('counts an insertion at 00:30 on its own day, which ends the period', async () => {
        // 00:30 and 00:45 in Paris are still the day before in UTC
        const stats = await dailyUsageAt('2026-11-02T00:45:00+01:00', ['2026-11-02T00:30:00+01:00']);

        expect(stats?.dailyUsage[USAGE_RETENTION_DAYS - 1]).toEqual({ date: '2026-11-02', count: 1 });
        expect(stats?.dailyUsage.find(d => d.date === '2026-11-01')?.count).toBe(0);
      });

      it('keeps one entry per local day across the change back from summer time', async () => {
        // Paris leaves summer time (UTC+2) for UTC+1 at 03:00 on 25 October 2026
        const stats = await dailyUsageAt('2026-10-26T09:00:00+01:00', [
          '2026-10-25T00:30:00+02:00',
          '2026-10-25T23:30:00+01:00'
        ]);

        const dates = stats?.dailyUsage.map(d => d.date) ?? [];
        expect(dates).toHaveLength(USAGE_RETENTION_DAYS);
        expect(new Set(dates).size).toBe(USAGE_RETENTION_DAYS);
        expect([dates[0], dates[USAGE_RETENTION_DAYS - 1]]).toEqual(['2026-09-27', '2026-10-26']);
        expect(stats?.dailyUsage.find(d => d.date === '2026-10-25')?.count).toBe(2);
        expect(stats?.dailyUsage.find(d => d.date === '2026-10-24')?.count).toBe(0);
      });
    });
  });

  describe('Time of Day Distribution', () => {
    it('should include all 4 time buckets', async () => {
      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const buckets = result.current.stats?.timeOfDayDistribution.map(t => t.bucket);
      expect(buckets).toEqual(['Morning', 'Afternoon', 'Evening', 'Night']);
    });

    it('should categorize times correctly', async () => {
      // Create events at different times of day using today's date
      const today = new Date();
      const makeTodayAt = (hour: number) => {
        const d = new Date(today);
        d.setHours(hour, 0, 0, 0);
        return d.getTime();
      };

      const morning = makeTodayAt(8); // 8 AM
      const afternoon = makeTodayAt(14); // 2 PM
      const evening = makeTodayAt(19); // 7 PM
      const night = makeTodayAt(23); // 11 PM

      const events: UsageEvent[] = [
        buildUsageEvent({ timestamp: morning }),
        buildUsageEvent({ timestamp: afternoon }),
        buildUsageEvent({ timestamp: evening }),
        buildUsageEvent({ timestamp: night })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const distribution = result.current.stats?.timeOfDayDistribution ?? [];
      expect(distribution.find(t => t.bucket === 'Morning')?.count).toBe(1);
      expect(distribution.find(t => t.bucket === 'Afternoon')?.count).toBe(1);
      expect(distribution.find(t => t.bucket === 'Evening')?.count).toBe(1);
      expect(distribution.find(t => t.bucket === 'Night')?.count).toBe(1);
    });
  });

  describe('Clear History', () => {
    it('should clear usage history', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1' }),
        buildUsageEvent({ promptId: 'prompt-2', timestamp: NOW - 1000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats?.totalUses).toBe(2);

      await act(async () => {
        await result.current.clearHistory();
      });

      expect(result.current.history).toEqual([]);
      expect(result.current.stats?.totalUses).toBe(0);
    });

    it('should handle clear errors', async () => {
      const events: UsageEvent[] = [buildUsageEvent()];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock set to fail since clearHistory now uses setHistory([]) instead of remove()
      const setSpy = vi.spyOn(chrome.storage.local, 'set');
      setSpy.mockRejectedValueOnce(new Error('Failed to clear'));

      await act(async () => {
        await expect(result.current.clearHistory()).rejects.toThrow();
      });

      expect(result.current.error).toBeTruthy();

      setSpy.mockRestore();
    });
  });

  describe('Refresh', () => {
    it('should refresh stats when called', async () => {
      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats?.totalUses).toBe(0);

      // Add event directly to storage
      const events: UsageEvent[] = [buildUsageEvent()];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.stats?.totalUses).toBe(1);
    });
  });

  describe('History Access', () => {
    it('should expose raw history events', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1' }),
        buildUsageEvent({ promptId: 'prompt-2', timestamp: NOW - 1000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.history).toHaveLength(2);
    });
  });
});

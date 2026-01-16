import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { buildPrompt } from '../../test/builders';
import type { UsageEvent, Prompt } from '../../types';
import { DEFAULT_CATEGORY, USAGE_STORAGE_KEY, USAGE_RETENTION_DAYS } from '../../types';
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
      const today = new Date(NOW).toISOString().split('T')[0];
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
  });

  describe('Platform Breakdown', () => {
    it('should calculate platform percentages correctly', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ platform: 'claude' }),
        buildUsageEvent({ platform: 'claude', timestamp: NOW - 1000 }),
        buildUsageEvent({ platform: 'chatgpt', timestamp: NOW - 2000 }),
        buildUsageEvent({ platform: 'gemini', timestamp: NOW - 3000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const claude = result.current.stats?.platformBreakdown.find(p => p.platform === 'claude');
      expect(claude?.count).toBe(2);
      expect(claude?.percentage).toBe(50);

      const chatgpt = result.current.stats?.platformBreakdown.find(p => p.platform === 'chatgpt');
      expect(chatgpt?.count).toBe(1);
      expect(chatgpt?.percentage).toBe(25);
    });

    it('should sort platforms by count descending', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ platform: 'chatgpt' }),
        buildUsageEvent({ platform: 'claude', timestamp: NOW - 1000 }),
        buildUsageEvent({ platform: 'claude', timestamp: NOW - 2000 }),
        buildUsageEvent({ platform: 'claude', timestamp: NOW - 3000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const breakdown = result.current.stats?.platformBreakdown ?? [];
      expect(breakdown[0]?.platform).toBe('claude');
      expect(breakdown[1]?.platform).toBe('chatgpt');
    });

    it('should return empty array for no events', async () => {
      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats?.platformBreakdown).toEqual([]);
    });
  });

  describe('Day of Week Distribution', () => {
    it('should include all 7 days', async () => {
      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats?.dayOfWeekDistribution).toHaveLength(7);
    });

    it('should count events per day of week correctly', async () => {
      // Get today's day index and yesterday's
      const todayIndex = new Date(NOW).getDay();
      const yesterdayIndex = new Date(NOW - 86400000).getDay();
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      const events: UsageEvent[] = [
        buildUsageEvent({ timestamp: NOW }), // Today
        buildUsageEvent({ timestamp: NOW - 1000 }), // Today
        buildUsageEvent({ timestamp: NOW - 86400000 }) // Yesterday
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const todayStats = result.current.stats?.dayOfWeekDistribution.find(d => d.day === dayNames[todayIndex]);
      expect(todayStats?.count).toBe(2);

      const yesterdayStats = result.current.stats?.dayOfWeekDistribution.find(d => d.day === dayNames[yesterdayIndex]);
      expect(yesterdayStats?.count).toBe(1);
    });

    it('should be sorted by day index', async () => {
      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const days = result.current.stats?.dayOfWeekDistribution.map(d => d.dayIndex) ?? [];
      expect(days).toEqual([0, 1, 2, 3, 4, 5, 6]);
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

  describe('Category Distribution', () => {
    it('should calculate category counts correctly', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1' }), // Development
        buildUsageEvent({ promptId: 'prompt-1', timestamp: NOW - 1000 }), // Development
        buildUsageEvent({ promptId: 'prompt-2', timestamp: NOW - 2000 }) // Design
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const development = result.current.stats?.categoryDistribution.find(c => c.name === 'Development');
      expect(development?.count).toBe(2);

      const design = result.current.stats?.categoryDistribution.find(c => c.name === 'Design');
      expect(design?.count).toBe(1);
    });

    it('should sort categories by count descending', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1' }),
        buildUsageEvent({ promptId: 'prompt-1', timestamp: NOW - 1000 }),
        buildUsageEvent({ promptId: 'prompt-2', timestamp: NOW - 2000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const categories = result.current.stats?.categoryDistribution ?? [];
      expect(categories[0]?.name).toBe('Development');
      expect(categories[1]?.name).toBe('Design');
    });
  });

  describe('Top Prompts', () => {
    it('should return prompts sorted by usage count', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1' }),
        buildUsageEvent({ promptId: 'prompt-1', timestamp: NOW - 1000 }),
        buildUsageEvent({ promptId: 'prompt-1', timestamp: NOW - 2000 }),
        buildUsageEvent({ promptId: 'prompt-2', timestamp: NOW - 3000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const topPrompts = result.current.stats?.topPrompts ?? [];
      expect(topPrompts[0]?.promptId).toBe('prompt-1');
      expect(topPrompts[0]?.count).toBe(3);
      expect(topPrompts[1]?.promptId).toBe('prompt-2');
      expect(topPrompts[1]?.count).toBe(1);
    });

    it('should limit to 10 prompts', async () => {
      // Create 15 different prompts with usage
      const extraPrompts = Array.from({ length: 15 }, (_, i) =>
        buildPrompt({ id: `extra-${i}`, title: `Extra ${i}` })
      );
      await chrome.storage.local.set({ prompts: [...mockPrompts, ...extraPrompts] });

      const events = extraPrompts.map((p, i) =>
        buildUsageEvent({ promptId: p.id, timestamp: NOW - i * 1000 })
      );
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats?.topPrompts.length).toBeLessThanOrEqual(10);
    });

    it('should include correct prompt details', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1' })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const topPrompt = result.current.stats?.topPrompts[0];
      expect(topPrompt?.title).toBe('Test Prompt 1');
      expect(topPrompt?.category).toBe('Development');
    });
  });

  describe('Recent Prompts', () => {
    it('should return prompts sorted by last used', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-2', timestamp: NOW }), // Most recent
        buildUsageEvent({ promptId: 'prompt-1', timestamp: NOW - 10000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const recentPrompts = result.current.stats?.recentPrompts ?? [];
      expect(recentPrompts[0]?.promptId).toBe('prompt-2');
      expect(recentPrompts[1]?.promptId).toBe('prompt-1');
    });
  });

  describe('Forgotten Prompts', () => {
    it('should identify prompts not used in 14+ days', async () => {
      const fourteenDaysAgo = NOW - (14 * 24 * 60 * 60 * 1000) - 1000;
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1', timestamp: NOW }), // Recent
        buildUsageEvent({ promptId: 'prompt-2', timestamp: fourteenDaysAgo }) // Forgotten
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const forgottenPrompts = result.current.stats?.forgottenPrompts ?? [];
      expect(forgottenPrompts.some(p => p.promptId === 'prompt-2')).toBe(true);
      expect(forgottenPrompts.some(p => p.promptId === 'prompt-1')).toBe(false);
    });

    it('should include prompts never used that are old enough', async () => {
      const oldPrompt = buildPrompt({
        id: 'old-prompt',
        title: 'Old Prompt',
        createdAt: NOW - (15 * 24 * 60 * 60 * 1000) // Created 15 days ago
      });
      await chrome.storage.local.set({ prompts: [...mockPrompts, oldPrompt] });

      const { result } = renderHook(() => useUsageStats());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const forgottenPrompts = result.current.stats?.forgottenPrompts ?? [];
      expect(forgottenPrompts.some(p => p.promptId === 'old-prompt')).toBe(true);
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

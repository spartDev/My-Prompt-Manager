import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { UsageEvent, USAGE_STORAGE_KEY, USAGE_RETENTION_DAYS } from '../../types';
import { UsageTracker } from '../UsageTracker';

const FIXED_TIME = new Date('2025-01-15T12:00:00Z');
const FIXED_TIMESTAMP = FIXED_TIME.getTime();

/**
 * Helper to build a UsageEvent with defaults
 */
function buildUsageEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    promptId: overrides.promptId ?? 'prompt-1',
    timestamp: overrides.timestamp ?? FIXED_TIMESTAMP,
    platform: overrides.platform ?? 'claude',
    categoryId: overrides.categoryId ?? null
  };
}

describe('UsageTracker', () => {
  let usageTracker: UsageTracker;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_TIME);
    usageTracker = UsageTracker.getInstance();

    // Clear storage before each test
    await chrome.storage.local.remove(USAGE_STORAGE_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = UsageTracker.getInstance();
      const instance2 = UsageTracker.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('record', () => {
    it('should record a usage event', async () => {
      await usageTracker.record('prompt-1', 'claude', 'category-1');

      const result = await chrome.storage.local.get(USAGE_STORAGE_KEY);
      const history = result[USAGE_STORAGE_KEY] as UsageEvent[];

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        promptId: 'prompt-1',
        platform: 'claude',
        categoryId: 'category-1'
      });
      expect(history[0].timestamp).toBe(FIXED_TIMESTAMP);
    });

    it('should record event with null categoryId', async () => {
      await usageTracker.record('prompt-1', 'chatgpt', null);

      const history = await usageTracker.getHistory();

      expect(history[0].categoryId).toBeNull();
    });

    it('should append to existing history', async () => {
      // Add initial event
      await usageTracker.record('prompt-1', 'claude', null);

      // Advance time and add another event
      vi.advanceTimersByTime(1000);
      await usageTracker.record('prompt-2', 'chatgpt', 'category-1');

      const history = await usageTracker.getHistory();

      expect(history).toHaveLength(2);
    });

    it('should record events for different platforms', async () => {
      const platforms = ['claude', 'chatgpt', 'gemini', 'perplexity', 'copilot', 'mistral', 'custom'];

      for (const platform of platforms) {
        await usageTracker.record('prompt-1', platform, null);
      }

      const history = await usageTracker.getHistory();

      expect(history).toHaveLength(platforms.length);
      expect(history.map(e => e.platform).sort()).toEqual(platforms.sort());
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no history exists', async () => {
      const history = await usageTracker.getHistory();

      expect(history).toEqual([]);
    });

    it('should return events sorted by timestamp (newest first)', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'old', timestamp: FIXED_TIMESTAMP - 2000 }),
        buildUsageEvent({ promptId: 'middle', timestamp: FIXED_TIMESTAMP - 1000 }),
        buildUsageEvent({ promptId: 'new', timestamp: FIXED_TIMESTAMP })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const history = await usageTracker.getHistory();

      expect(history[0].promptId).toBe('new');
      expect(history[1].promptId).toBe('middle');
      expect(history[2].promptId).toBe('old');
    });

    it('should filter out events older than retention period', async () => {
      const retentionMs = USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'within-retention', timestamp: FIXED_TIMESTAMP - 1000 }),
        buildUsageEvent({ promptId: 'at-boundary', timestamp: FIXED_TIMESTAMP - retentionMs }),
        buildUsageEvent({ promptId: 'expired', timestamp: FIXED_TIMESTAMP - retentionMs - 1 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const history = await usageTracker.getHistory();

      expect(history).toHaveLength(2);
      expect(history.map(e => e.promptId)).not.toContain('expired');
      expect(history.map(e => e.promptId)).toContain('within-retention');
      expect(history.map(e => e.promptId)).toContain('at-boundary');
    });
  });

  describe('clearHistory', () => {
    it('should remove all usage history', async () => {
      // Add some events
      await usageTracker.record('prompt-1', 'claude', null);
      await usageTracker.record('prompt-2', 'chatgpt', null);

      // Clear history
      await usageTracker.clearHistory();

      // Verify storage is cleared
      const result = await chrome.storage.local.get(USAGE_STORAGE_KEY);
      expect(result[USAGE_STORAGE_KEY]).toBeUndefined();

      // Verify getHistory returns empty
      const history = await usageTracker.getHistory();
      expect(history).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should remove expired events from storage', async () => {
      const retentionMs = USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'fresh', timestamp: FIXED_TIMESTAMP }),
        buildUsageEvent({ promptId: 'expired-1', timestamp: FIXED_TIMESTAMP - retentionMs - 1000 }),
        buildUsageEvent({ promptId: 'expired-2', timestamp: FIXED_TIMESTAMP - retentionMs - 2000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      await usageTracker.cleanup();

      const result = await chrome.storage.local.get(USAGE_STORAGE_KEY);
      const history = result[USAGE_STORAGE_KEY] as UsageEvent[];

      expect(history).toHaveLength(1);
      expect(history[0].promptId).toBe('fresh');
    });

    it('should not write to storage if no events were removed', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'fresh-1', timestamp: FIXED_TIMESTAMP }),
        buildUsageEvent({ promptId: 'fresh-2', timestamp: FIXED_TIMESTAMP - 1000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      // Clear the mock call count
      vi.mocked(chrome.storage.local.set).mockClear();

      await usageTracker.cleanup();

      // Should not have called set since no events were removed
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should handle empty history gracefully', async () => {
      await usageTracker.cleanup();

      const history = await usageTracker.getHistory();
      expect(history).toEqual([]);
    });
  });

  describe('getHistoryForPrompt', () => {
    it('should return events for a specific prompt', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1', timestamp: FIXED_TIMESTAMP }),
        buildUsageEvent({ promptId: 'prompt-2', timestamp: FIXED_TIMESTAMP - 1000 }),
        buildUsageEvent({ promptId: 'prompt-1', timestamp: FIXED_TIMESTAMP - 2000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const history = await usageTracker.getHistoryForPrompt('prompt-1');

      expect(history).toHaveLength(2);
      expect(history.every(e => e.promptId === 'prompt-1')).toBe(true);
    });

    it('should return empty array for non-existent prompt', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'prompt-1' })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const history = await usageTracker.getHistoryForPrompt('non-existent');

      expect(history).toEqual([]);
    });
  });

  describe('getHistoryForPlatform', () => {
    it('should return events for a specific platform', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ platform: 'claude', timestamp: FIXED_TIMESTAMP }),
        buildUsageEvent({ platform: 'chatgpt', timestamp: FIXED_TIMESTAMP - 1000 }),
        buildUsageEvent({ platform: 'claude', timestamp: FIXED_TIMESTAMP - 2000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const history = await usageTracker.getHistoryForPlatform('claude');

      expect(history).toHaveLength(2);
      expect(history.every(e => e.platform === 'claude')).toBe(true);
    });
  });

  describe('getTotalUsageCount', () => {
    it('should return total count of events', async () => {
      const events: UsageEvent[] = [
        buildUsageEvent({ timestamp: FIXED_TIMESTAMP }),
        buildUsageEvent({ timestamp: FIXED_TIMESTAMP - 1000 }),
        buildUsageEvent({ timestamp: FIXED_TIMESTAMP - 2000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const count = await usageTracker.getTotalUsageCount();

      expect(count).toBe(3);
    });

    it('should return 0 for empty history', async () => {
      const count = await usageTracker.getTotalUsageCount();

      expect(count).toBe(0);
    });

    it('should exclude expired events from count', async () => {
      const retentionMs = USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const events: UsageEvent[] = [
        buildUsageEvent({ timestamp: FIXED_TIMESTAMP }),
        buildUsageEvent({ timestamp: FIXED_TIMESTAMP - retentionMs - 1000 }) // expired
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const count = await usageTracker.getTotalUsageCount();

      expect(count).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage quota exceeded error', async () => {
      vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(
        new Error('QUOTA_EXCEEDED: Storage quota exceeded')
      );

      await expect(usageTracker.record('prompt-1', 'claude', null))
        .rejects.toMatchObject({
          type: 'STORAGE_QUOTA_EXCEEDED',
          message: expect.stringContaining('Storage quota exceeded')
        });
    });

    it('should handle storage API unavailable error', async () => {
      vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(
        new Error('storage API unavailable')
      );

      await expect(usageTracker.getHistory()).rejects.toMatchObject({
        type: 'STORAGE_UNAVAILABLE',
        message: expect.stringContaining('Storage API is unavailable')
      });
    });

    it('should handle unknown errors gracefully', async () => {
      vi.mocked(chrome.storage.local.get).mockRejectedValueOnce(
        new Error('Some unknown error')
      );

      await expect(usageTracker.getHistory()).rejects.toMatchObject({
        type: 'VALIDATION_ERROR',
        message: 'Some unknown error'
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent record operations', async () => {
      const recordPromises = Array.from({ length: 5 }, (_, i) =>
        usageTracker.record(`prompt-${i}`, 'claude', null)
      );

      await Promise.all(recordPromises);

      const history = await usageTracker.getHistory();

      expect(history).toHaveLength(5);
    });
  });

  describe('Retention Period', () => {
    it('should use 30 days as retention period', () => {
      expect(USAGE_RETENTION_DAYS).toBe(30);
    });

    it('should correctly calculate retention cutoff', async () => {
      const thirtyDaysAgo = FIXED_TIMESTAMP - (30 * 24 * 60 * 60 * 1000);
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'exactly-30-days', timestamp: thirtyDaysAgo }),
        buildUsageEvent({ promptId: '29-days', timestamp: thirtyDaysAgo + 1000 }),
        buildUsageEvent({ promptId: '31-days', timestamp: thirtyDaysAgo - 1000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      const history = await usageTracker.getHistory();

      expect(history.map(e => e.promptId)).toContain('exactly-30-days');
      expect(history.map(e => e.promptId)).toContain('29-days');
      expect(history.map(e => e.promptId)).not.toContain('31-days');
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { UsageEvent, USAGE_STORAGE_KEY, USAGE_RETENTION_DAYS } from '../../types';
import * as Logger from '../../utils/logger';
import { UsageTracker } from '../UsageTracker';

vi.mock('../../utils/logger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

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

    // Clear Logger mocks
    vi.mocked(Logger.info).mockClear();
    vi.mocked(Logger.warn).mockClear();
    vi.mocked(Logger.error).mockClear();
    vi.mocked(Logger.debug).mockClear();
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

      // Verify storage is set to empty array
      const result = await chrome.storage.local.get(USAGE_STORAGE_KEY);
      expect(result[USAGE_STORAGE_KEY]).toEqual([]);

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

    it('should handle concurrent clearHistory and record operations', async () => {
      // Pre-populate storage with some events
      const initialEvents: UsageEvent[] = [
        buildUsageEvent({ promptId: 'initial-1', timestamp: FIXED_TIMESTAMP - 1000 }),
        buildUsageEvent({ promptId: 'initial-2', timestamp: FIXED_TIMESTAMP - 2000 }),
        buildUsageEvent({ promptId: 'initial-3', timestamp: FIXED_TIMESTAMP - 3000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: initialEvents });

      // Launch clearHistory and multiple record calls concurrently
      const promises = [
        usageTracker.clearHistory(),
        usageTracker.record('new-prompt-1', 'claude', null),
        usageTracker.record('new-prompt-2', 'chatgpt', null),
        usageTracker.record('new-prompt-3', 'gemini', null)
      ];

      // All operations should complete without error
      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Final state should be consistent - either:
      // - clearHistory ran last: history is empty
      // - some records ran after clearHistory: history has those new records
      // - clearHistory ran first then all records: history has 3 new records
      const history = await usageTracker.getHistory();

      // History length should be 0, 1, 2, or 3 depending on execution order
      // (clearHistory could run at any point in the serialized queue)
      expect(history.length).toBeGreaterThanOrEqual(0);
      expect(history.length).toBeLessThanOrEqual(3);

      // If there are events, they should only be the new ones (not initial)
      // because clearHistory sets to empty array
      const promptIds = history.map(e => e.promptId);
      expect(promptIds).not.toContain('initial-1');
      expect(promptIds).not.toContain('initial-2');
      expect(promptIds).not.toContain('initial-3');
    });

    it('should handle concurrent clearHistory and cleanup operations', async () => {
      const retentionMs = USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      // Pre-populate storage with mix of expired and fresh events
      const mixedEvents: UsageEvent[] = [
        buildUsageEvent({ promptId: 'fresh-1', timestamp: FIXED_TIMESTAMP }),
        buildUsageEvent({ promptId: 'fresh-2', timestamp: FIXED_TIMESTAMP - 1000 }),
        buildUsageEvent({ promptId: 'expired-1', timestamp: FIXED_TIMESTAMP - retentionMs - 1000 }),
        buildUsageEvent({ promptId: 'expired-2', timestamp: FIXED_TIMESTAMP - retentionMs - 2000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: mixedEvents });

      // Launch clearHistory and cleanup concurrently
      const promises = [
        usageTracker.clearHistory(),
        usageTracker.cleanup()
      ];

      // All operations should complete without error
      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Final state should be consistent:
      // - If clearHistory runs last: history is empty
      // - If cleanup runs last after clearHistory: history is still empty (nothing to clean)
      // - If cleanup runs first: only fresh events remain, then clearHistory empties it
      // - If clearHistory runs first: empty, then cleanup does nothing (no events)
      const history = await usageTracker.getHistory();

      // Either empty (clearHistory won) or contains only fresh events
      // Since mutex serializes, clearHistory will likely run and set to empty,
      // and cleanup either runs before (leaving fresh events that get cleared)
      // or after (nothing to clean from empty array)
      expect(history.length).toBeGreaterThanOrEqual(0);
      expect(history.length).toBeLessThanOrEqual(2); // At most the 2 fresh events

      // If there are any events, they must be fresh (not expired)
      const promptIds = history.map(e => e.promptId);
      expect(promptIds).not.toContain('expired-1');
      expect(promptIds).not.toContain('expired-2');
    });

    it('should handle multiple concurrent clearHistory calls', async () => {
      // Pre-populate storage with events
      const events: UsageEvent[] = [
        buildUsageEvent({ promptId: 'event-1', timestamp: FIXED_TIMESTAMP }),
        buildUsageEvent({ promptId: 'event-2', timestamp: FIXED_TIMESTAMP - 1000 }),
        buildUsageEvent({ promptId: 'event-3', timestamp: FIXED_TIMESTAMP - 2000 }),
        buildUsageEvent({ promptId: 'event-4', timestamp: FIXED_TIMESTAMP - 3000 }),
        buildUsageEvent({ promptId: 'event-5', timestamp: FIXED_TIMESTAMP - 4000 })
      ];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      // Launch multiple clearHistory calls concurrently
      const promises = [
        usageTracker.clearHistory(),
        usageTracker.clearHistory(),
        usageTracker.clearHistory(),
        usageTracker.clearHistory(),
        usageTracker.clearHistory()
      ];

      // All operations should complete without error
      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Final state should be empty - all clearHistory calls set to empty array
      const history = await usageTracker.getHistory();
      expect(history).toEqual([]);
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

  describe('Quota Protection', () => {
    const CLEANUP_THRESHOLD = 9000;
    const MAX_EVENTS = 10000;

    it('should trigger proactive cleanup when reaching threshold', async () => {
      // Pre-populate storage with exactly CLEANUP_THRESHOLD events (all within retention)
      const events: UsageEvent[] = Array.from({ length: CLEANUP_THRESHOLD }, (_, i) =>
        buildUsageEvent({
          promptId: `prompt-${i}`,
          timestamp: FIXED_TIMESTAMP - i * 1000 // All within retention period
        })
      );
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      // Record one more event to trigger proactive cleanup
      await usageTracker.record('new-prompt', 'claude', null);

      // Verify proactive cleanup was logged
      expect(Logger.info).toHaveBeenCalledWith(
        'UsageTracker: Proactive cleanup triggered',
        expect.objectContaining({
          component: 'UsageTracker',
          originalCount: CLEANUP_THRESHOLD,
          threshold: CLEANUP_THRESHOLD
        })
      );

      // Verify history contains events (trimOldEvents keeps all within retention)
      const history = await usageTracker.getHistory();
      // All events were within retention, so trimOldEvents doesn't remove any
      // Plus the new event we just added
      expect(history.length).toBe(CLEANUP_THRESHOLD + 1);
    });

    it('should enforce hard limit by removing oldest events', async () => {
      // Pre-populate storage with MAX_EVENTS events all within retention period
      const events: UsageEvent[] = Array.from({ length: MAX_EVENTS }, (_, i) =>
        buildUsageEvent({
          promptId: `prompt-${i}`,
          // Space events 1 second apart, all within retention
          timestamp: FIXED_TIMESTAMP - i * 1000
        })
      );
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      // Record one more event to trigger hard limit
      await usageTracker.record('new-prompt', 'claude', null);

      // Verify hard limit warning was logged
      expect(Logger.warn).toHaveBeenCalledWith(
        'UsageTracker: Hard limit reached, removed oldest events',
        expect.objectContaining({
          component: 'UsageTracker',
          eventsRemoved: 1,
          maxEvents: MAX_EVENTS
        })
      );

      // Verify total events is now exactly MAX_EVENTS (oldest removed to make room for new)
      const history = await usageTracker.getHistory();
      expect(history.length).toBe(MAX_EVENTS);

      // Verify the oldest event was removed (prompt-9999 had the oldest timestamp)
      const promptIds = history.map(e => e.promptId);
      expect(promptIds).not.toContain('prompt-9999');

      // Verify the new event is present
      expect(promptIds).toContain('new-prompt');
    });

    it('should filter expired events during proactive cleanup via trimOldEvents', async () => {
      const retentionMs = USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

      // Create events where half are expired (outside 30 day retention)
      // Total count exceeds CLEANUP_THRESHOLD to trigger proactive cleanup
      const freshEvents: UsageEvent[] = Array.from({ length: 5000 }, (_, i) =>
        buildUsageEvent({
          promptId: `fresh-${i}`,
          timestamp: FIXED_TIMESTAMP - i * 1000 // Within retention
        })
      );

      const expiredEvents: UsageEvent[] = Array.from({ length: 5000 }, (_, i) =>
        buildUsageEvent({
          promptId: `expired-${i}`,
          // Outside retention period (31+ days ago)
          timestamp: FIXED_TIMESTAMP - retentionMs - (i + 1) * 1000
        })
      );

      // Mix fresh and expired events
      const events = [...freshEvents, ...expiredEvents];
      await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: events });

      // Record one more event to trigger proactive cleanup
      await usageTracker.record('trigger-prompt', 'claude', null);

      // Verify proactive cleanup was triggered
      expect(Logger.info).toHaveBeenCalledWith(
        'UsageTracker: Proactive cleanup triggered',
        expect.objectContaining({
          component: 'UsageTracker',
          originalCount: 10000,
          newCount: 5000 // trimOldEvents removed the 5000 expired events
        })
      );

      // Verify only fresh events remain (plus the new trigger event)
      const history = await usageTracker.getHistory();
      expect(history.length).toBe(5001); // 5000 fresh + 1 new

      // Verify no expired events remain
      const expiredPromptIds = history.filter(e => e.promptId.startsWith('expired-'));
      expect(expiredPromptIds).toHaveLength(0);

      // Verify fresh events are still there
      const freshPromptIds = history.filter(e => e.promptId.startsWith('fresh-'));
      expect(freshPromptIds).toHaveLength(5000);

      // Verify the trigger event is present
      expect(history.map(e => e.promptId)).toContain('trigger-prompt');
    });
  });
});

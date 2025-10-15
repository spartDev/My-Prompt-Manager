import { describe, it, expect, beforeEach } from 'vitest';

import type { AnalyticsEvent } from '../../types/analytics';
import { AnalyticsManager } from '../analyticsManager';
import { StorageManager } from '../storage';

describe('AnalyticsManager', () => {
  let manager: AnalyticsManager;

  beforeEach(() => {
    manager = AnalyticsManager.getInstance();
  });

  it('should be a singleton', () => {
    const instance1 = AnalyticsManager.getInstance();
    const instance2 = AnalyticsManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should track prompt insertion event', async () => {
    const event = await manager.trackInsertion({
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude',
      source: 'browse'
    });

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.promptId).toBe('prompt-123');
  });

  it('should maintain 90-day rolling window', async () => {
    const oldTimestamp = Date.now() - (91 * 24 * 60 * 60 * 1000);

    // Manually insert old event into storage
    const storage = StorageManager.getInstance();
    const oldEvent: AnalyticsEvent = {
      id: 'old-event',
      timestamp: oldTimestamp,
      promptId: 'old-prompt',
      categoryId: 'cat-1',
      platform: 'claude',
      source: 'browse'
    };

    await storage.set({
      analytics: {
        events: [oldEvent],
        achievements: [],
        stats: {
          firstInsertionDate: oldTimestamp,
          totalInsertions: 1,
          currentStreak: 0,
          longestStreak: 0
        }
      }
    });

    // Trigger cleanup by tracking new event
    await manager.trackInsertion({
      promptId: 'new-prompt',
      categoryId: 'cat-2',
      platform: 'chatgpt',
      source: 'search'
    });

    // Verify old event was removed
    const data = await manager.getData();
    expect(data.events.find(e => e.id === 'old-event')).toBeUndefined();
    expect(data.events.length).toBe(1);
    expect(data.events[0].promptId).toBe('new-prompt');
  });

  it('should compute stats correctly', async () => {
    await manager.trackInsertion({
      promptId: 'prompt-1',
      categoryId: 'cat-1',
      platform: 'claude',
      source: 'browse'
    });

    const stats = await manager.getComputedStats();
    expect(stats.totalInsertions).toBe(1);
    expect(stats.currentStreak).toBeGreaterThanOrEqual(0);
  });
});

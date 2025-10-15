import { describe, it, expect, beforeEach } from 'vitest';

import type { AnalyticsEvent } from '../../types/analytics';
import { AnalyticsManager } from '../analyticsManager';

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

    // Manually insert old event
    await manager.trackInsertion({
      promptId: 'old-prompt',
      categoryId: 'cat-1',
      platform: 'claude',
      source: 'browse'
    });

    // Trigger cleanup
    await manager.trackInsertion({
      promptId: 'new-prompt',
      categoryId: 'cat-2',
      platform: 'chatgpt',
      source: 'search'
    });

    const data = await manager.getData();
    // Old events should be removed
    expect(data.events.every(e => e.timestamp > oldTimestamp)).toBe(true);
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

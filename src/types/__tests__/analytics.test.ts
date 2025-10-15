import { describe, it, expect } from 'vitest';

import type { AnalyticsEvent, AnalyticsData, Achievement, AchievementTier } from '../analytics';

describe('Analytics Types', () => {
  it('should allow creating a valid AnalyticsEvent', () => {
    const event: AnalyticsEvent = {
      id: 'evt-123',
      timestamp: Date.now(),
      promptId: 'prompt-456',
      categoryId: 'cat-789',
      platform: 'claude',
      source: 'browse'
    };

    expect(event.id).toBe('evt-123');
    expect(event.platform).toBe('claude');
    expect(event.source).toBe('browse');
  });

  it('should allow creating valid AnalyticsData', () => {
    const data: AnalyticsData = {
      events: [],
      achievements: [],
      stats: {
        firstInsertionDate: Date.now(),
        totalInsertions: 0,
        currentStreak: 0,
        longestStreak: 0
      }
    };

    expect(data.events).toHaveLength(0);
    expect(data.stats.totalInsertions).toBe(0);
  });

  it('should enforce valid achievement tiers', () => {
    const tiers: AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    expect(tiers).toContain('bronze');
    expect(tiers).toContain('platinum');
  });
});

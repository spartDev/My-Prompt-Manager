import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AnalyticsManager } from '../../services/analyticsManager';
import { StorageManager } from '../../services/storage';

describe('Analytics Integration', () => {
  let analyticsManager: AnalyticsManager;
  let storageManager: StorageManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    analyticsManager = AnalyticsManager.getInstance();
    storageManager = StorageManager.getInstance();

    // Clear analytics data before each test
    await storageManager.set({
      analytics: null,
      settings: { analyticsEnabled: true }
    });
  });

  describe('Complete Analytics Flow', () => {
    it('should track first insertion and unlock "Getting Started" achievement', async () => {
      // Track first insertion
      const event = await analyticsManager.trackInsertion({
        promptId: 'prompt-1',
        categoryId: 'category-1',
        platform: 'claude',
        source: 'browse'
      });

      // Verify event was created
      expect(event).toBeDefined();
      expect(event?.id).toBeDefined();
      expect(event?.timestamp).toBeDefined();
      expect(event?.promptId).toBe('prompt-1');
      expect(event?.platform).toBe('claude');

      // Verify data was stored correctly
      const data = await analyticsManager.getData();
      expect(data.events).toHaveLength(1);
      expect(data.events[0].promptId).toBe('prompt-1');

      // Verify stats were updated
      expect(data.stats.totalInsertions).toBe(1);
      expect(data.stats.firstInsertionDate).toBeGreaterThan(0);
      expect(data.stats.currentStreak).toBeGreaterThanOrEqual(0);

      // Verify "Getting Started" achievement was unlocked
      expect(data.achievements).toHaveLength(1);
      expect(data.achievements[0].id).toBe('first_prompt');
      expect(data.achievements[0].name).toBe('Getting Started');
      expect(data.achievements[0].unlockedAt).toBeDefined();
    });

    it('should track 10 insertions and unlock "Prompt Novice" achievement', async () => {
      // Track 10 insertions
      for (let i = 1; i <= 10; i++) {
        await analyticsManager.trackInsertion({
          promptId: `prompt-${i}`,
          categoryId: 'category-1',
          platform: 'claude',
          source: 'browse'
        });
      }

      // Verify all events were tracked
      const data = await analyticsManager.getData();
      expect(data.events).toHaveLength(10);
      expect(data.stats.totalInsertions).toBe(10);

      // Verify both achievements were unlocked
      expect(data.achievements.length).toBeGreaterThanOrEqual(2);

      const achievementIds = data.achievements.map(a => a.id);
      expect(achievementIds).toContain('first_prompt');
      expect(achievementIds).toContain('prompt_10');

      // Verify "Prompt Novice" achievement details
      const promptNovice = data.achievements.find(a => a.id === 'prompt_10');
      expect(promptNovice).toBeDefined();
      expect(promptNovice?.name).toBe('Prompt Novice');
      expect(promptNovice?.unlockedAt).toBeDefined();
      expect(promptNovice?.progress).toBe(10);
    });

    it('should compute stats correctly after multiple insertions', async () => {
      // Track insertions on different platforms
      await analyticsManager.trackInsertion({
        promptId: 'prompt-1',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });
      await analyticsManager.trackInsertion({
        promptId: 'prompt-2',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'search'
      });
      await analyticsManager.trackInsertion({
        promptId: 'prompt-3',
        categoryId: 'cat-2',
        platform: 'chatgpt',
        source: 'favorite'
      });

      // Compute stats
      const stats = await analyticsManager.getComputedStats();

      // Verify total insertions
      expect(stats.totalInsertions).toBe(3);

      // Verify streak is valid
      expect(stats.currentStreak).toBeGreaterThanOrEqual(0);
      expect(stats.longestStreak).toBeGreaterThanOrEqual(stats.currentStreak);

      // Verify platform distribution
      expect(stats.platformDistribution).toHaveLength(2);

      const claudeStats = stats.platformDistribution.find(p => p.platform === 'claude');
      expect(claudeStats).toBeDefined();
      expect(claudeStats?.count).toBe(2);
      expect(claudeStats?.percentage).toBeGreaterThan(0);

      const chatgptStats = stats.platformDistribution.find(p => p.platform === 'chatgpt');
      expect(chatgptStats).toBeDefined();
      expect(chatgptStats?.count).toBe(1);

      // Verify percentages add up to 100
      const totalPercentage = stats.platformDistribution.reduce((sum, p) => sum + p.percentage, 0);
      expect(totalPercentage).toBe(100);
    });

    it('should maintain 90-day rolling window', async () => {
      const now = Date.now();
      const ninetyOneDaysAgo = now - (91 * 24 * 60 * 60 * 1000);
      const eightNineDaysAgo = now - (89 * 24 * 60 * 60 * 1000);

      // Manually insert old event (91 days ago - should be removed)
      await storageManager.set({
        analytics: {
          events: [
            {
              id: 'old-event',
              timestamp: ninetyOneDaysAgo,
              promptId: 'old-prompt',
              categoryId: 'cat-1',
              platform: 'claude',
              source: 'browse' as const
            }
          ],
          achievements: [],
          stats: {
            firstInsertionDate: ninetyOneDaysAgo,
            totalInsertions: 1,
            currentStreak: 0,
            longestStreak: 0
          }
        }
      });

      // Track a recent event (89 days ago - should be kept)
      await storageManager.set({
        analytics: {
          events: [
            {
              id: 'old-event',
              timestamp: ninetyOneDaysAgo,
              promptId: 'old-prompt',
              categoryId: 'cat-1',
              platform: 'claude',
              source: 'browse' as const
            },
            {
              id: 'recent-event',
              timestamp: eightNineDaysAgo,
              promptId: 'recent-prompt',
              categoryId: 'cat-1',
              platform: 'claude',
              source: 'browse' as const
            }
          ],
          achievements: [],
          stats: {
            firstInsertionDate: ninetyOneDaysAgo,
            totalInsertions: 2,
            currentStreak: 0,
            longestStreak: 0
          }
        }
      });

      // Track a new event to trigger cleanup
      await analyticsManager.trackInsertion({
        promptId: 'new-prompt',
        categoryId: 'cat-1',
        platform: 'chatgpt',
        source: 'search'
      });

      // Verify cleanup happened
      const data = await analyticsManager.getData();

      // Old event (91 days) should be removed
      expect(data.events.find(e => e.id === 'old-event')).toBeUndefined();

      // Recent event (89 days) should be kept
      expect(data.events.find(e => e.id === 'recent-event')).toBeDefined();

      // New event should be present
      expect(data.events.find(e => e.promptId === 'new-prompt')).toBeDefined();
    });

    it('should respect analytics enabled setting', async () => {
      // Disable analytics
      await storageManager.set({
        settings: { analyticsEnabled: false }
      });

      // Try to track insertion
      const event = await analyticsManager.trackInsertion({
        promptId: 'prompt-1',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });

      // Event should not be created
      expect(event).toBeNull();

      // Verify no data was stored
      const data = await analyticsManager.getData();
      expect(data.events).toHaveLength(0);
      expect(data.stats.totalInsertions).toBe(0);
      expect(data.achievements).toHaveLength(0);
    });

    it('should handle multiple sequential insertions correctly', async () => {
      // Track multiple insertions (storage manager uses mutex locking for safety)
      const events = [];
      for (let i = 1; i <= 5; i++) {
        const event = await analyticsManager.trackInsertion({
          promptId: `prompt-${i}`,
          categoryId: 'cat-1',
          platform: 'claude',
          source: 'browse'
        });
        events.push(event);
      }

      // Verify all events were created
      expect(events).toHaveLength(5);
      expect(events.every(e => e?.id)).toBe(true);

      // Verify data consistency
      const data = await analyticsManager.getData();
      expect(data.events).toHaveLength(5);
      expect(data.stats.totalInsertions).toBe(5);

      // Verify all events have unique IDs
      const eventIds = data.events.map(e => e.id);
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(5);
    });

    it('should calculate category breakdown correctly', async () => {
      // Set up categories in storage
      await storageManager.set({
        categories: [
          { id: 'cat-work', name: 'Work' },
          { id: 'cat-personal', name: 'Personal' },
          { id: 'cat-dev', name: 'Development' }
        ]
      });

      // Track insertions in different categories
      await analyticsManager.trackInsertion({
        promptId: 'p1',
        categoryId: 'cat-work',
        platform: 'claude',
        source: 'browse'
      });
      await analyticsManager.trackInsertion({
        promptId: 'p2',
        categoryId: 'cat-work',
        platform: 'claude',
        source: 'browse'
      });
      await analyticsManager.trackInsertion({
        promptId: 'p3',
        categoryId: 'cat-personal',
        platform: 'claude',
        source: 'browse'
      });

      // Get computed stats
      const stats = await analyticsManager.getComputedStats();

      // Verify category breakdown
      expect(stats.categoryBreakdown).toHaveLength(2);

      const workCategory = stats.categoryBreakdown.find(c => c.categoryId === 'cat-work');
      expect(workCategory).toBeDefined();
      expect(workCategory?.name).toBe('Work');
      expect(workCategory?.count).toBe(2);

      const personalCategory = stats.categoryBreakdown.find(c => c.categoryId === 'cat-personal');
      expect(personalCategory).toBeDefined();
      expect(personalCategory?.name).toBe('Personal');
      expect(personalCategory?.count).toBe(1);
    });

    it('should track most used prompt correctly', async () => {
      // Set up prompts in storage
      await storageManager.set({
        prompts: [
          { id: 'p1', title: 'Prompt One' },
          { id: 'p2', title: 'Prompt Two' },
          { id: 'p3', title: 'Prompt Three' }
        ]
      });

      // Track insertions with different prompts
      await analyticsManager.trackInsertion({
        promptId: 'p1',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });
      await analyticsManager.trackInsertion({
        promptId: 'p2',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });
      await analyticsManager.trackInsertion({
        promptId: 'p1',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });
      await analyticsManager.trackInsertion({
        promptId: 'p1',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });

      // Get computed stats
      const stats = await analyticsManager.getComputedStats();

      // Verify most used prompt
      expect(stats.mostUsedPrompt).toBeDefined();
      expect(stats.mostUsedPrompt?.id).toBe('p1');
      expect(stats.mostUsedPrompt?.title).toBe('Prompt One');
      expect(stats.mostUsedPrompt?.count).toBe(3);
    });

    it('should handle empty state gracefully', async () => {
      // Clear all data
      await storageManager.set({ analytics: null });

      // Get data and stats
      const data = await analyticsManager.getData();
      const stats = await analyticsManager.getComputedStats();

      // Verify empty state
      expect(data.events).toHaveLength(0);
      expect(data.achievements).toHaveLength(0);
      expect(data.stats.totalInsertions).toBe(0);
      expect(data.stats.currentStreak).toBe(0);
      expect(data.stats.longestStreak).toBe(0);

      expect(stats.totalInsertions).toBe(0);
      expect(stats.mostUsedPrompt).toBeNull();
      expect(stats.mostActivePlatform).toBeNull();
      expect(stats.platformDistribution).toHaveLength(0);
      expect(stats.categoryBreakdown).toHaveLength(0);
    });

    it('should unlock multiple achievements at once when threshold is met', async () => {
      // Track 10 insertions at once to unlock both achievements
      for (let i = 1; i <= 10; i++) {
        await analyticsManager.trackInsertion({
          promptId: `prompt-${i}`,
          categoryId: 'cat-1',
          platform: 'claude',
          source: 'browse'
        });
      }

      const data = await analyticsManager.getData();

      // Both achievements should be unlocked
      const achievementIds = data.achievements.map(a => a.id);
      expect(achievementIds).toContain('first_prompt');
      expect(achievementIds).toContain('prompt_10');

      // All achievements should have unlock timestamps
      expect(data.achievements.every(a => a.unlockedAt && a.unlockedAt > 0)).toBe(true);
    });

    it('should calculate weekly activity correctly', async () => {
      // Track some insertions
      await analyticsManager.trackInsertion({
        promptId: 'p1',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });
      await analyticsManager.trackInsertion({
        promptId: 'p2',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });

      // Get computed stats
      const stats = await analyticsManager.getComputedStats();

      // Verify weekly activity structure
      expect(stats.weeklyActivity).toBeDefined();
      expect(Array.isArray(stats.weeklyActivity)).toBe(true);

      // Should have entries for the last 7 days
      expect(stats.weeklyActivity.length).toBeGreaterThan(0);

      // Each entry should have day and count
      stats.weeklyActivity.forEach(entry => {
        expect(entry).toHaveProperty('day');
        expect(entry).toHaveProperty('count');
        expect(typeof entry.count).toBe('number');
        expect(entry.count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Achievement Unlocking Logic', () => {
    it('should not unlock achievement twice', async () => {
      // Track first insertion
      await analyticsManager.trackInsertion({
        promptId: 'p1',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });

      let data = await analyticsManager.getData();
      expect(data.achievements).toHaveLength(1);
      expect(data.achievements[0].id).toBe('first_prompt');

      // Track more insertions
      await analyticsManager.trackInsertion({
        promptId: 'p2',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });

      data = await analyticsManager.getData();

      // "Getting Started" should still only appear once
      const gettingStartedAchievements = data.achievements.filter(a => a.id === 'first_prompt');
      expect(gettingStartedAchievements).toHaveLength(1);
    });

    it('should unlock discovery achievements based on platform diversity', async () => {
      // Track insertions on 3 different platforms
      await analyticsManager.trackInsertion({
        promptId: 'p1',
        categoryId: 'cat-1',
        platform: 'claude',
        source: 'browse'
      });
      await analyticsManager.trackInsertion({
        promptId: 'p2',
        categoryId: 'cat-1',
        platform: 'chatgpt',
        source: 'browse'
      });
      await analyticsManager.trackInsertion({
        promptId: 'p3',
        categoryId: 'cat-1',
        platform: 'perplexity',
        source: 'browse'
      });

      const data = await analyticsManager.getData();
      const achievementIds = data.achievements.map(a => a.id);

      // "Platform Explorer" should be unlocked
      expect(achievementIds).toContain('multi_platform');

      const platformExplorer = data.achievements.find(a => a.id === 'multi_platform');
      expect(platformExplorer?.name).toBe('Platform Explorer');
    });
  });

  describe('Error Handling', () => {
    it('should handle analytics tracking failure gracefully', async () => {
      // Mock storage failure
      vi.spyOn(storageManager, 'set').mockRejectedValueOnce(new Error('Storage failed'));

      // Should throw error
      await expect(
        analyticsManager.trackInsertion({
          promptId: 'p1',
          categoryId: 'cat-1',
          platform: 'claude',
          source: 'browse'
        })
      ).rejects.toThrow('Storage failed');
    });

    it('should return empty data on storage retrieval failure', async () => {
      // Mock storage get failure
      vi.spyOn(storageManager, 'get').mockRejectedValueOnce(new Error('Storage failed'));

      // Should return empty data instead of throwing
      const data = await analyticsManager.getData();

      expect(data.events).toHaveLength(0);
      expect(data.achievements).toHaveLength(0);
      expect(data.stats.totalInsertions).toBe(0);
    });
  });
});

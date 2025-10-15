import { describe, it, expect } from 'vitest';

import type { Achievement } from '../../types/analytics';
import { ACHIEVEMENT_DEFINITIONS, getAchievementProgress, checkUnlockedAchievements } from '../achievements';

describe('Achievement Definitions', () => {
  it('should have usage milestone achievements', () => {
    const usageAchievements = ACHIEVEMENT_DEFINITIONS.filter(a => a.category === 'usage');
    expect(usageAchievements.length).toBeGreaterThan(0);
    expect(usageAchievements.some(a => a.id === 'first_prompt')).toBe(true);
  });

  it('should have streak achievements', () => {
    const streakAchievements = ACHIEVEMENT_DEFINITIONS.filter(a => a.category === 'streak');
    expect(streakAchievements.length).toBeGreaterThan(0);
    expect(streakAchievements.some(a => a.id === 'streak_3')).toBe(true);
  });

  it('should calculate achievement progress correctly', () => {
    const progress = getAchievementProgress('prompt_10', 5);
    expect(progress).toBe(5);
  });

  it('should cap progress at achievement requirement', () => {
    const progress = getAchievementProgress('prompt_10', 15);
    expect(progress).toBe(10); // Capped at requirement
  });

  it('should return 0 for unknown achievement', () => {
    const progress = getAchievementProgress('unknown_achievement', 100);
    expect(progress).toBe(0);
  });

  it('should identify newly unlocked achievements', () => {
    const current = [];
    const unlocked = checkUnlockedAchievements(current, 10, 3, {
      usedPlatforms: new Set(['claude', 'chatgpt']),
      usedCategories: new Set(['work', 'personal'])
    });
    expect(unlocked.length).toBeGreaterThan(0);
  });

  it('should unlock correct achievements at 10 insertions', () => {
    const unlocked = checkUnlockedAchievements([], 10, 0, {
      usedPlatforms: new Set(),
      usedCategories: new Set()
    });
    expect(unlocked).toHaveLength(2);
    expect(unlocked.map(a => a.id)).toContain('first_prompt');
    expect(unlocked.map(a => a.id)).toContain('prompt_10');
    expect(unlocked.every(a => a.progress === a.requirement)).toBe(true);
    expect(unlocked.every(a => a.unlockedAt)).toBeTruthy();
  });

  it('should not unlock discovery achievements without sufficient context', () => {
    const unlocked = checkUnlockedAchievements([], 100, 0, {
      usedPlatforms: new Set(['claude']), // Only 1 platform, need 3
      usedCategories: new Set(['work', 'personal']) // Only 2 categories, need 5
    });
    const discoveryAchievements = unlocked.filter(a => a.category === 'discovery');
    expect(discoveryAchievements).toHaveLength(0);
  });

  it('should set timestamps and progress values correctly on unlock', () => {
    const beforeTimestamp = Date.now();
    const unlocked = checkUnlockedAchievements([], 50, 7, {
      usedPlatforms: new Set(['claude', 'chatgpt', 'perplexity']),
      usedCategories: new Set(['work', 'personal', 'coding', 'research', 'writing'])
    });
    const afterTimestamp = Date.now();

    expect(unlocked.length).toBeGreaterThan(0);

    // Check all unlocked achievements have proper timestamps
    unlocked.forEach(achievement => {
      expect(achievement.unlockedAt).toBeDefined();
      expect(achievement.unlockedAt).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(achievement.unlockedAt).toBeLessThanOrEqual(afterTimestamp);

      // Progress should equal requirement for unlocked achievements
      expect(achievement.progress).toBe(achievement.requirement);
    });
  });

  it('should handle exactly-at-threshold behavior', () => {
    // Test usage milestone at exact threshold
    const usageUnlocked = checkUnlockedAchievements([], 50, 0, {
      usedPlatforms: new Set(),
      usedCategories: new Set()
    });
    expect(usageUnlocked.map(a => a.id)).toContain('prompt_50');

    // Test streak at exact threshold
    const streakUnlocked = checkUnlockedAchievements([], 0, 7, {
      usedPlatforms: new Set(),
      usedCategories: new Set()
    });
    expect(streakUnlocked.map(a => a.id)).toContain('streak_7');

    // Test discovery at exact threshold
    const discoveryUnlocked = checkUnlockedAchievements([], 0, 0, {
      usedPlatforms: new Set(['claude', 'chatgpt', 'perplexity']), // Exactly 3
      usedCategories: new Set(['work', 'personal', 'coding', 'research', 'writing']) // Exactly 5
    });
    expect(discoveryUnlocked.map(a => a.id)).toContain('multi_platform');
    expect(discoveryUnlocked.map(a => a.id)).toContain('category_master');
  });

  it('should not unlock already-unlocked achievements', () => {
    const alreadyUnlocked: Achievement[] = [
      {
        id: 'first_prompt',
        name: 'Getting Started',
        description: 'Insert your first prompt',
        tier: 'bronze',
        category: 'usage',
        icon: '🎯',
        requirement: 1,
        unlockedAt: Date.now() - 10000,
        progress: 1
      }
    ];

    const unlocked = checkUnlockedAchievements(alreadyUnlocked, 10, 0, {
      usedPlatforms: new Set(),
      usedCategories: new Set()
    });

    // Should unlock prompt_10 but NOT first_prompt
    expect(unlocked.map(a => a.id)).not.toContain('first_prompt');
    expect(unlocked.map(a => a.id)).toContain('prompt_10');
  });
});

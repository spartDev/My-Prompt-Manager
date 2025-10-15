import { describe, it, expect } from 'vitest';

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

  it('should identify newly unlocked achievements', () => {
    const current = [];
    const unlocked = checkUnlockedAchievements(current, 10, 3, {
      usedPlatforms: new Set(['claude', 'chatgpt']),
      usedCategories: new Set(['work', 'personal'])
    });
    expect(unlocked.length).toBeGreaterThan(0);
  });
});

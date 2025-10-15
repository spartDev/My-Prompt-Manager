import type { Achievement, AchievementTier } from '../types/analytics';

export const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
  // Usage Milestones
  {
    id: 'first_prompt',
    name: 'Getting Started',
    description: 'Insert your first prompt',
    tier: 'bronze',
    category: 'usage',
    icon: '🎯',
    requirement: 1
  },
  {
    id: 'prompt_10',
    name: 'Prompt Novice',
    description: 'Insert 10 prompts',
    tier: 'bronze',
    category: 'usage',
    icon: '📝',
    requirement: 10
  },
  {
    id: 'prompt_50',
    name: 'Prompt Enthusiast',
    description: 'Insert 50 prompts',
    tier: 'silver',
    category: 'usage',
    icon: '⚡',
    requirement: 50
  },
  {
    id: 'prompt_100',
    name: 'Prompt Master',
    description: 'Insert 100 prompts',
    tier: 'gold',
    category: 'usage',
    icon: '🏆',
    requirement: 100
  },
  {
    id: 'prompt_500',
    name: 'Prompt Legend',
    description: 'Insert 500 prompts',
    tier: 'platinum',
    category: 'usage',
    icon: '👑',
    requirement: 500
  },

  // Streak Achievements
  {
    id: 'streak_3',
    name: '3-Day Streak',
    description: 'Use prompts for 3 consecutive days',
    tier: 'bronze',
    category: 'streak',
    icon: '🔥',
    requirement: 3
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Use prompts for 7 consecutive days',
    tier: 'silver',
    category: 'streak',
    icon: '💪',
    requirement: 7
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Use prompts for 30 consecutive days',
    tier: 'gold',
    category: 'streak',
    icon: '⭐',
    requirement: 30
  },

  // Discovery Achievements
  {
    id: 'multi_platform',
    name: 'Platform Explorer',
    description: 'Use prompts on 3 different platforms',
    tier: 'silver',
    category: 'discovery',
    icon: '🌐',
    requirement: 3
  },
  {
    id: 'category_master',
    name: 'Organized Mind',
    description: 'Use prompts from 5 different categories',
    tier: 'gold',
    category: 'discovery',
    icon: '🗂️',
    requirement: 5
  }
];

/**
 * Get current progress for an achievement
 */
export function getAchievementProgress(
  achievementId: string,
  currentValue: number
): number {
  return currentValue;
}

/**
 * Check which achievements should be newly unlocked
 */
export function checkUnlockedAchievements(
  currentAchievements: Achievement[],
  totalInsertions: number,
  currentStreak: number,
  context: {
    usedPlatforms: Set<string>;
    usedCategories: Set<string>;
  }
): Achievement[] {
  const unlocked: Achievement[] = [];
  const unlockedIds = new Set(currentAchievements.map(a => a.id));
  const now = Date.now();

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (unlockedIds.has(def.id)) {
      continue;
    }

    let shouldUnlock = false;

    if (def.category === 'usage') {
      shouldUnlock = totalInsertions >= def.requirement;
    } else if (def.category === 'streak') {
      shouldUnlock = currentStreak >= def.requirement;
    } else {
      // Discovery category
      if (def.id === 'multi_platform') {
        shouldUnlock = context.usedPlatforms.size >= def.requirement;
      } else if (def.id === 'category_master') {
        shouldUnlock = context.usedCategories.size >= def.requirement;
      }
    }

    if (shouldUnlock) {
      unlocked.push({
        ...def,
        unlockedAt: now,
        progress: def.requirement
      });
    }
  }

  return unlocked;
}

/**
 * Get tier color for UI display
 */
export function getTierColor(tier: AchievementTier): string {
  const colors: Record<AchievementTier, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2'
  };
  return colors[tier];
}

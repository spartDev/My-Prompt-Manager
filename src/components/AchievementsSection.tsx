import { FC } from 'react';

import { ACHIEVEMENT_DEFINITIONS } from '../constants/achievements';
import type { Achievement } from '../types/analytics';

import { AchievementCard } from './AchievementCard';

interface AchievementsSectionProps {
  unlockedAchievements: Achievement[];
  totalInsertions: number;
  currentStreak: number;
}

export const AchievementsSection: FC<AchievementsSectionProps> = ({
  unlockedAchievements,
  totalInsertions,
  currentStreak
}) => {
  const unlockedIds = new Set(unlockedAchievements.map(a => a.id));

  const allAchievements = ACHIEVEMENT_DEFINITIONS.map(def => {
    const unlocked = unlockedAchievements.find(a => a.id === def.id);
    if (unlocked) {return unlocked;}

    let progress = 0;
    if (def.category === 'usage') {
      progress = Math.min(totalInsertions, def.requirement);
    } else if (def.category === 'streak') {
      progress = Math.min(currentStreak, def.requirement);
    }

    return {
      ...def,
      progress
    };
  });

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-purple-100 dark:border-gray-700 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Achievements ({unlockedAchievements.length} / {ACHIEVEMENT_DEFINITIONS.length})
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {allAchievements.map(achievement => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            locked={!unlockedIds.has(achievement.id)}
          />
        ))}
      </div>
    </div>
  );
};

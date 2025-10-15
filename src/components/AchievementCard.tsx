import { FC } from 'react';

import { getTierColor } from '../constants/achievements';
import type { Achievement } from '../types/analytics';

interface AchievementCardProps {
  achievement: Achievement;
  locked?: boolean;
}

export const AchievementCard: FC<AchievementCardProps> = ({
  achievement,
  locked = false
}) => {
  const tierColor = getTierColor(achievement.tier);
  const progress = achievement.progress || 0;
  const percentage = (progress / achievement.requirement) * 100;

  return (
    <div
      className={`
        bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
        border-2 rounded-xl p-4
        transition-all duration-200
        ${locked ? 'opacity-50 grayscale' : 'hover:shadow-md'}
      `}
      style={{ borderColor: locked ? '#d1d5db' : tierColor }}
    >
      <div className="flex items-start space-x-3">
        <div className="text-3xl">{achievement.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {achievement.name}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {achievement.description}
          </p>

          {locked && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{progress} / {achievement.requirement}</span>
                <span>{Math.round(percentage)}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-300"
                  style={{ width: `${percentage.toString()}%` }}
                />
              </div>
            </div>
          )}

          {!locked && achievement.unlockedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

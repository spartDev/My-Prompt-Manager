import { FC, useEffect, useState } from 'react';

import { AnalyticsManager } from '../services/analyticsManager';
import type { ComputedStats, Achievement } from '../types/analytics';
import { Logger, toError } from '../utils';

import { AchievementsSection } from './AchievementsSection';

interface AnalyticsViewProps {
  onBack: () => void;
}

export const AnalyticsView: FC<AnalyticsViewProps> = ({ onBack }) => {
  const [stats, setStats] = useState<ComputedStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const analyticsManager = AnalyticsManager.getInstance();
      const [computedStats, data] = await Promise.all([
        analyticsManager.getComputedStats(),
        analyticsManager.getData()
      ]);
      setStats(computedStats);
      setAchievements(data.achievements);
      setError(null);
    } catch (err) {
      Logger.error('Failed to load analytics', toError(err), {
        component: 'AnalyticsView'
      });
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading analytics"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <button
          onClick={() => {
            void loadStats();
          }}
          className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats || stats.totalInsertions === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Start Building Your Stats
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Insert prompts on AI platforms to track your usage and unlock achievements!
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Analytics
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your usage insights and achievements
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Stats Overview Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            label="Total Insertions"
            value={stats.totalInsertions.toString()}
            icon="📝"
          />
          <StatCard
            label="Current Streak"
            value={`${stats.currentStreak.toString()} days`}
            icon="🔥"
          />
          <StatCard
            label="Most Used"
            value={stats.mostUsedPrompt?.title || 'N/A'}
            icon="⭐"
            subtitle={stats.mostUsedPrompt ? `${stats.mostUsedPrompt.count.toString()}x` : undefined}
          />
          <StatCard
            label="Top Platform"
            value={stats.mostActivePlatform?.name || 'N/A'}
            icon="🌐"
            subtitle={stats.mostActivePlatform ? `${stats.mostActivePlatform.percentage.toString()}%` : undefined}
          />
        </div>

        {/* Weekly Activity Chart - Placeholder */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-purple-100 dark:border-gray-700 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Weekly Activity
          </h2>
          <div className="h-32 flex items-end justify-between space-x-2">
            {stats.weeklyActivity.length > 0 ? (
              stats.weeklyActivity.map((day) => (
                <div key={day.day} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-gradient-to-t from-purple-600 to-indigo-600 rounded-t-lg"
                    style={{ height: `${Math.max(day.count * 10, 5).toString()}%` }}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {day.day}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center w-full h-full text-sm text-gray-500 dark:text-gray-400">
                No activity data yet
              </div>
            )}
          </div>
        </div>

        {/* Achievements Section */}
        {stats.totalInsertions > 0 && (
          <AchievementsSection
            unlockedAchievements={achievements}
            totalInsertions={stats.totalInsertions}
            currentStreak={stats.currentStreak}
          />
        )}
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  subtitle?: string;
}

const StatCard: FC<StatCardProps> = ({ label, value, icon, subtitle }) => (
  <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-purple-100 dark:border-gray-700 rounded-xl p-4">
    <div className="flex items-start justify-between mb-2">
      <span className="text-2xl">{icon}</span>
    </div>
    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
    <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
      {value}
    </p>
    {subtitle && (
      <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
    )}
  </div>
);

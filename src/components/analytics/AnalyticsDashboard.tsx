import { FC, useState, useMemo, useRef, useEffect } from 'react';

import { useUsageStats } from '../../hooks/useUsageStats';
import { PromptUsageSummary } from '../../types/hooks';

import {
  UsageLineChart,
  PlatformPieChart,
  DayOfWeekChart,
  CategoryBarChart,
  TimeOfDayChart
} from './charts';
import SummaryCard from './SummaryCard';

// Icons as inline SVGs
const UsageIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const PlatformIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const CalendarIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const CategoryIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const BackIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const TrophyIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

type PromptTab = 'most-used' | 'recently-used' | 'forgotten';

export interface AnalyticsDashboardProps {
  /** Callback when user wants to go back */
  onBack?: () => void;
  /** Whether the dashboard is in dark mode */
  isDarkMode?: boolean;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor(diff / (60 * 1000));

  if (days > 0) {
    return `${String(days)}d ago`;
  }
  if (hours > 0) {
    return `${String(hours)}h ago`;
  }
  if (minutes > 0) {
    return `${String(minutes)}m ago`;
  }
  return 'Just now';
}

/**
 * Format platform name for display
 */
function formatPlatformName(name: string): string {
  const platformNames: Record<string, string> = {
    claude: 'Claude',
    chatgpt: 'ChatGPT',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
    copilot: 'Copilot',
    mistral: 'Mistral',
    custom: 'Custom Site'
  };
  return platformNames[name.toLowerCase()] ?? name;
}

/**
 * Full-page analytics dashboard with charts and prompt tables
 */
const AnalyticsDashboard: FC<AnalyticsDashboardProps> = ({
  onBack,
  isDarkMode = false
}) => {
  const { stats, loading, error } = useUsageStats();
  const [activeTab, setActiveTab] = useState<PromptTab>('most-used');

  // Capture current time for relative time calculations
  // eslint-disable-next-line react-hooks/purity -- Date.now() is needed for initial time reference
  const nowRef = useRef<number>(Date.now());

  useEffect(() => {
    nowRef.current = Date.now();
    const interval = setInterval(() => {
      nowRef.current = Date.now();
    }, 60000);
    return () => { clearInterval(interval); };
  }, []);

  // Compute summary metrics
  const summaryMetrics = useMemo(() => {
    if (!stats) {
      return {
        totalUses: 0,
        topPlatform: null as { name: string; count: number } | null,
        peakDay: null as { day: string; count: number } | null,
        topCategory: null as { name: string; count: number } | null
      };
    }

    const topPlatform = stats.platformBreakdown.length > 0
      ? { name: stats.platformBreakdown[0].platform, count: stats.platformBreakdown[0].count }
      : null;

    const sortedDays = [...stats.dayOfWeekDistribution].sort((a, b) => b.count - a.count);
    const peakDayData = sortedDays.length > 0 ? sortedDays[0] : null;
    const peakDay = peakDayData && peakDayData.count > 0
      ? { day: peakDayData.day, count: peakDayData.count }
      : null;

    const topCategory = stats.categoryDistribution.length > 0
      ? { name: stats.categoryDistribution[0].name, count: stats.categoryDistribution[0].count }
      : null;

    return {
      totalUses: stats.totalUses,
      topPlatform,
      peakDay,
      topCategory
    };
  }, [stats]);

  // Get prompts for active tab
  const activePrompts = useMemo((): PromptUsageSummary[] => {
    if (!stats) { return []; }
    switch (activeTab) {
      case 'most-used':
        return stats.topPrompts;
      case 'recently-used':
        return stats.recentPrompts;
      case 'forgotten':
        return stats.forgottenPrompts;
    }
  }, [stats, activeTab]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-6" role="alert">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Unable to load analytics</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{error.message}</p>
      </div>
    );
  }

  const hasData = stats && stats.totalUses > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors focus-interactive"
                  aria-label="Go back"
                >
                  <BackIcon className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <UsageIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Analytics Dashboard
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Last 30 days of usage
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        {!hasData && !loading ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center" role="region" aria-label="Empty analytics">
            <div className="w-24 h-24 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-6">
              <UsageIcon className="w-12 h-12 text-purple-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No usage data yet</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
              Start using your prompts on AI platforms to see your analytics here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Summary Cards Row */}
            <section aria-label="Usage summary">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Summary
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                  label="Total Uses"
                  value={summaryMetrics.totalUses}
                  subtitle="prompts inserted"
                  icon={<UsageIcon className="w-full h-full" />}
                  loading={loading}
                />
                <SummaryCard
                  label="Top Platform"
                  value={summaryMetrics.topPlatform ? formatPlatformName(summaryMetrics.topPlatform.name) : '-'}
                  subtitle={summaryMetrics.topPlatform ? `${String(summaryMetrics.topPlatform.count)} uses` : 'No data'}
                  icon={<PlatformIcon className="w-full h-full" />}
                  loading={loading}
                />
                <SummaryCard
                  label="Peak Day"
                  value={summaryMetrics.peakDay?.day ?? '-'}
                  subtitle={summaryMetrics.peakDay ? `${String(summaryMetrics.peakDay.count)} uses` : 'No data'}
                  icon={<CalendarIcon className="w-full h-full" />}
                  loading={loading}
                />
                <SummaryCard
                  label="Top Category"
                  value={summaryMetrics.topCategory?.name ?? '-'}
                  subtitle={summaryMetrics.topCategory ? `${String(summaryMetrics.topCategory.count)} uses` : 'No data'}
                  icon={<CategoryIcon className="w-full h-full" />}
                  loading={loading}
                />
              </div>
            </section>

            {/* Usage Trend Line Chart */}
            <section aria-label="Usage trend">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Usage Trend
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-100 dark:border-gray-700">
                {loading ? (
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-[250px]" />
                ) : (
                  <UsageLineChart
                    data={stats?.dailyUsage ?? []}
                    height={250}
                    isDarkMode={isDarkMode}
                  />
                )}
              </div>
            </section>

            {/* 2x2 Chart Grid */}
            <section aria-label="Usage breakdown">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Breakdown
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Platform Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-100 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Platforms
                  </h3>
                  {loading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-[200px]" />
                  ) : (
                    <PlatformPieChart
                      data={stats?.platformBreakdown ?? []}
                      height={200}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </div>

                {/* Day of Week */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-100 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Day of Week
                  </h3>
                  {loading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-[200px]" />
                  ) : (
                    <DayOfWeekChart
                      data={stats?.dayOfWeekDistribution ?? []}
                      height={200}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </div>

                {/* Category Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-100 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Categories
                  </h3>
                  {loading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-[200px]" />
                  ) : (
                    <CategoryBarChart
                      data={stats?.categoryDistribution ?? []}
                      height={200}
                      maxCategories={6}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </div>

                {/* Time of Day */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-purple-100 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Time of Day
                  </h3>
                  {loading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-[200px]" />
                  ) : (
                    <TimeOfDayChart
                      data={stats?.timeOfDayDistribution ?? []}
                      height={200}
                      isDarkMode={isDarkMode}
                    />
                  )}
                </div>
              </div>
            </section>

            {/* Prompt Tables with Tabs */}
            <section aria-label="Prompt usage details">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                Prompts
              </h2>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-purple-100 dark:border-gray-700 overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-purple-100 dark:border-gray-700">
                  <nav className="flex -mb-px" aria-label="Prompt tabs">
                    <button
                      onClick={() => { setActiveTab('most-used'); }}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'most-used'
                          ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      aria-selected={activeTab === 'most-used'}
                      role="tab"
                    >
                      Most Used
                    </button>
                    <button
                      onClick={() => { setActiveTab('recently-used'); }}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'recently-used'
                          ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      aria-selected={activeTab === 'recently-used'}
                      role="tab"
                    >
                      Recently Used
                    </button>
                    <button
                      onClick={() => { setActiveTab('forgotten'); }}
                      className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'forgotten'
                          ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      aria-selected={activeTab === 'forgotten'}
                      role="tab"
                    >
                      Forgotten
                    </button>
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="p-4" role="tabpanel">
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="animate-pulse bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4" />
                        </div>
                      ))}
                    </div>
                  ) : activePrompts.length > 0 ? (
                    <ul className="space-y-2">
                      {activePrompts.map((prompt, index) => (
                        <li
                          key={prompt.promptId}
                          className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              activeTab === 'most-used' && index === 0
                                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                                : activeTab === 'most-used' && index === 1
                                ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                                : activeTab === 'most-used' && index === 2
                                ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
                                : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                            }`}>
                              {activeTab === 'most-used' && index < 3 ? (
                                <TrophyIcon className="w-4 h-4" />
                              ) : (
                                <span className="text-xs font-bold">{index + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {prompt.title}
                              </h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                  {prompt.count} {prompt.count === 1 ? 'use' : 'uses'}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatRelativeTime(prompt.lastUsed, nowRef.current)}
                                </span>
                                {prompt.category && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full">
                                    {prompt.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {activeTab === 'forgotten'
                          ? 'No forgotten prompts - you are using all your prompts!'
                          : 'No prompts to display'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default AnalyticsDashboard;

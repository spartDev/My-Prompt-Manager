import { FC, useMemo, useRef, useEffect, useState } from 'react';

import { useUsageStats } from '../../hooks/useUsageStats';
import { PromptUsageSummary } from '../../types/hooks';
import { formatPlatformName } from '../../utils';
import ViewHeader from '../ViewHeader';

import SummaryCard from './SummaryCard';

/**
 * Format relative time for display
 * @param timestamp - Unix timestamp in milliseconds
 * @param now - Current time in milliseconds (passed to keep function pure)
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

const TrophyIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const TrashIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export interface AnalyticsTabProps {
  /** Callback when user wants to expand to full dashboard */
  onExpandDashboard?: () => void;
  /** Callback when user wants to go back to previous view */
  onBack?: () => void;
  /** Current context (popup or sidepanel) */
  context?: 'popup' | 'sidepanel';
}

const AnalyticsTab: FC<AnalyticsTabProps> = ({
  onExpandDashboard,
  onBack,
  context = 'sidepanel'
}) => {
  const { stats, loading, error, clearHistory } = useUsageStats();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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

    // Top platform
    const topPlatform = stats.platformBreakdown.length > 0
      ? { name: stats.platformBreakdown[0].platform, count: stats.platformBreakdown[0].count }
      : null;

    // Peak day (day of week with most usage)
    const sortedDays = [...stats.dayOfWeekDistribution].sort((a, b) => b.count - a.count);
    const peakDayData = sortedDays.length > 0 ? sortedDays[0] : null;
    const peakDay = peakDayData && peakDayData.count > 0
      ? { day: peakDayData.day, count: peakDayData.count }
      : null;

    // Top category
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

  // Capture current time once on mount for relative time calculations
  const nowRef = useRef<number>(Date.now());

  // Set initial time and update periodically (every minute) for accurate relative times
  useEffect(() => {
    nowRef.current = Date.now();
    const interval = setInterval(() => {
      nowRef.current = Date.now();
    }, 60000);
    return () => { clearInterval(interval); };
  }, []);

  // Handle clear history with confirmation
  const handleClearHistory = async (): Promise<void> => {
    setIsClearing(true);
    try {
      await clearHistory();
      setShowClearConfirm(false);
    } catch {
      // Error is handled by the hook
    } finally {
      setIsClearing(false);
    }
  };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6" role="alert">
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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 relative">
      {/* Header */}
      <ViewHeader
        icon="analytics"
        title="Analytics"
        subtitle="Last 30 days of usage"
        onBack={onBack}
        context={context}
      />

      {/* Content */}
      <main className="flex-1 overflow-auto custom-scrollbar p-4 pb-16">
        {!hasData && !loading ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-6" role="region" aria-label="Empty analytics">
            <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
              <UsageIcon className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">No usage data yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Start using your prompts on AI platforms to see your analytics here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards - 2x2 Grid */}
            <section aria-label="Usage summary">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
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

            {/* Top Prompts List */}
            <section aria-label="Top prompts">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Top Prompts
                </h3>
                {stats && stats.topPrompts.length > 5 && onExpandDashboard && (
                  <button
                    onClick={onExpandDashboard}
                    className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                  >
                    View all
                  </button>
                )}
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse bg-white/70 dark:bg-gray-800/70 rounded-xl p-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                    </div>
                  ))}
                </div>
              ) : stats && stats.topPrompts.length > 0 ? (
                <ul className="space-y-2">
                  {stats.topPrompts.slice(0, 5).map((prompt: PromptUsageSummary, index: number) => (
                    <li
                      key={prompt.promptId}
                      className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-3 border border-purple-100 dark:border-gray-700 hover:bg-white/90 dark:hover:bg-gray-800/90 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          index === 0
                            ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                            : index === 1
                            ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                            : index === 2
                            ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {index < 3 ? (
                            <TrophyIcon className="w-3.5 h-3.5" />
                          ) : (
                            <span className="text-xs font-bold">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {prompt.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                              {prompt.count} {prompt.count === 1 ? 'use' : 'uses'}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {formatRelativeTime(prompt.lastUsed, nowRef.current)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl p-4 border border-purple-100 dark:border-gray-700 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No prompts used yet
                  </p>
                </div>
              )}
            </section>

            {/* Clear History Action */}
            {hasData && (
              <div className="text-center pt-2">
                <button
                  onClick={() => { setShowClearConfirm(true); }}
                  className="text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <TrashIcon className="w-4 h-4" />
                  Clear history
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button for View Full Dashboard */}
      {hasData && onExpandDashboard && context === 'sidepanel' && (
        <button
          onClick={onExpandDashboard}
          className="absolute bottom-4 right-4 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg hover:shadow-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 focus-primary"
          aria-label="View full analytics dashboard"
        >
          View Full Dashboard
        </button>
      )}

      {/* Clear History Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="presentation"
        >
          {/* Backdrop - closes modal on click */}
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-default"
            onClick={() => { setShowClearConfirm(false); }}
            aria-label="Close modal"
            tabIndex={-1}
          />
          <div
            className="relative bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-history-title"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center shrink-0">
                <TrashIcon className="w-5 h-5 text-red-500" />
              </div>
              <h3 id="clear-history-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Clear Usage History?
              </h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This will permanently delete all your usage analytics data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowClearConfirm(false); }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus-interactive"
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleClearHistory(); }}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors focus-interactive disabled:opacity-50"
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Clear History'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;

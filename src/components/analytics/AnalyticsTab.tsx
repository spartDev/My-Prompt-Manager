import { type FC, useState } from 'react';

import { useNow } from '../../hooks/useNow';
import { useSummaryMetrics } from '../../hooks/useSummaryMetrics';
import { useUsageStats } from '../../hooks/useUsageStats';
import type { PromptUsageSummary } from '../../types/hooks';
import { formatPlatformName, formatRelativeTime } from '../../utils';
import {
  CalendarIcon,
  CategoryIcon,
  PlatformIcon,
  TrashIcon, 
  TrophyIcon,
  UsageIcon
} from '../icons/UIIcons';
import ViewHeader from '../ViewHeader';

import { REFRESH_INTERVAL_MS } from './constants';
import SummaryCard from './SummaryCard';

export interface AnalyticsTabProps {
  /** Callback when user wants to expand to full dashboard */
  onExpandDashboard?: () => void;
  /** Current context (popup or sidepanel) */
  context?: 'popup' | 'sidepanel';
}

const AnalyticsTab: FC<AnalyticsTabProps> = ({
  onExpandDashboard,
  context = 'sidepanel'
}) => {
  const { stats, loading, error, clearHistory } = useUsageStats();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Compute summary metrics using shared hook
  const summaryMetrics = useSummaryMetrics(stats);

  // Current time for relative time calculations - updates every minute to trigger re-renders
  const now = useNow(REFRESH_INTERVAL_MS);

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
        <div className="w-16 h-16 bg-danger-subtle text-danger rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-primary mb-2">Unable to load analytics</h3>
        <p className="text-sm text-secondary text-center">{error.message}</p>
      </div>
    );
  }

  const hasData = stats && stats.totalUses > 0;

  return (
    <div className="h-full flex flex-col bg-app relative">
      {/* Header */}
      <ViewHeader
        icon="analytics"
        title="Analytics"
        subtitle="Last 30 days of usage"
        context={context}
      >
        {context === 'sidepanel' && (
          <ViewHeader.Actions>
            {hasData && onExpandDashboard && (
              <button
                onClick={onExpandDashboard}
                className="px-3 py-2 text-sm font-semibold text-on-accent bg-accent hover:bg-accent-hover rounded-lg shadow-sm transition-colors focus-primary"
                aria-label="View full analytics dashboard"
              >
                Full Dashboard
              </button>
            )}
            <ViewHeader.CloseButton onClick={() => { window.close(); }} context="sidepanel" />
          </ViewHeader.Actions>
        )}
      </ViewHeader>

      {/* Content */}
      <main className="flex-1 overflow-auto custom-scrollbar p-4" data-scroll-container>
        {!hasData && !loading ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-6" role="region" aria-label="Empty analytics">
            <div data-testid="empty-analytics-icon" className="w-20 h-20 bg-accent-subtle text-accent rounded-full flex items-center justify-center mb-4">
              <UsageIcon className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-primary mb-2">No usage data yet</h3>
            <p className="text-sm text-tertiary max-w-xs">
              Start using your prompts on AI platforms to see your analytics here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards - 2x2 Grid */}
            <section aria-label="Usage summary">
              <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider mb-3">
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
                <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider">
                  Top Prompts
                </h3>
                {stats && stats.topPrompts.length > 5 && onExpandDashboard && (
                  <button
                    onClick={onExpandDashboard}
                    className="text-xs font-medium text-accent hover:text-accent-strong transition-colors"
                  >
                    View all
                  </button>
                )}
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse bg-card rounded-xl p-3 border border-default">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  ))}
                </div>
              ) : stats && stats.topPrompts.length > 0 ? (
                <ul className="space-y-2">
                  {stats.topPrompts.slice(0, 5).map((prompt: PromptUsageSummary, index: number) => (
                    <li
                      key={prompt.promptId}
                      className="bg-card rounded-xl p-3 border border-default"
                    >
                      <div className="flex items-start gap-3">
                        <div data-testid="rank-badge" className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                          index === 0
                            ? 'bg-medal-gold text-on-accent'
                            : index === 1
                            ? 'bg-medal-silver text-on-accent'
                            : index === 2
                            ? 'bg-medal-bronze text-on-accent'
                            : 'bg-subtle text-tertiary'
                        }`}>
                          {index < 3 ? (
                            <TrophyIcon className="w-3.5 h-3.5" />
                          ) : (
                            <span className="text-xs font-bold">{index + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-primary truncate">
                            {prompt.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-accent font-medium">
                              {prompt.count} {prompt.count === 1 ? 'use' : 'uses'}
                            </span>
                            <span className="text-xs text-tertiary">
                              {formatRelativeTime(prompt.lastUsed, now)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bg-card rounded-xl p-4 border border-default text-center">
                  <p className="text-sm text-tertiary">
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
                  className="text-sm font-medium text-danger hover:bg-danger-subtle px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 focus-danger"
                >
                  <TrashIcon className="w-4 h-4" />
                  Clear history
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Clear History Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop backdrop-blur-sm"
          role="presentation"
        >
          {/* Backdrop - closes modal on click */}
          <div
            className="absolute inset-0"
            onClick={() => { setShowClearConfirm(false); }}
            aria-hidden="true"
            data-testid="modal-backdrop"
          />
          <div
            className="relative z-10 bg-card rounded-xl p-6 max-w-sm mx-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-history-title"
          >
            <div className="flex items-center gap-3 mb-4">
              <div data-testid="clear-history-icon" className="w-10 h-10 bg-danger-subtle text-danger rounded-full flex items-center justify-center shrink-0">
                <TrashIcon className="w-5 h-5" />
              </div>
              <h3 id="clear-history-title" className="text-lg font-bold text-primary">
                Clear Usage History?
              </h3>
            </div>
            <p className="text-sm text-secondary mb-6">
              This will permanently delete all your usage analytics data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowClearConfirm(false); }}
                className="flex-1 px-4 py-2 text-sm font-semibold text-secondary bg-card hover:bg-muted border border-strong rounded-xl transition-colors focus-secondary"
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleClearHistory(); }}
                className="flex-1 px-4 py-2 text-sm font-semibold text-on-accent bg-danger hover:bg-danger-hover rounded-xl shadow-sm transition-colors focus-danger disabled:opacity-50"
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

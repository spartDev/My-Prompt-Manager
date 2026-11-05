import { type FC, useCallback, useRef, useState } from 'react';

import { useNow } from '../../hooks/useNow';
import { useSummaryMetrics } from '../../hooks/useSummaryMetrics';
import { useUsageStats } from '../../hooks/useUsageStats';
import type { PromptUsageSummary } from '../../types/hooks';
import { formatPlatformName, formatRelativeTime } from '../../utils';
import ErrorBoundary from '../ErrorBoundary';
import {
  BackIcon,
  CalendarIcon,
  CategoryIcon,
  PlatformIcon,
  TrophyIcon, 
  UsageIcon
} from '../icons/UIIcons';

import {
  CategoryBarChart,
  DayOfWeekChart,
  PlatformPieChart,
  TimeOfDayChart, 
  UsageLineChart
} from './charts';
import { CHART_HEIGHT, MAX_CATEGORIES_DISPLAY, REFRESH_INTERVAL_MS } from './constants';
import SummaryCard from './SummaryCard';

/** Fallback UI for chart rendering errors */
const ChartErrorFallback: FC<{ height: number }> = ({ height }) => (
  <div
    className="flex items-center justify-center bg-raised rounded-xl"
    style={{ height }}
    role="alert"
    aria-label="Chart unavailable"
  >
    <div className="text-center">
      <svg
        className="w-8 h-8 text-faint mx-auto mb-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      <p className="text-sm text-tertiary">Chart unavailable</p>
    </div>
  </div>
);

const PROMPT_TABS = {
  MOST_USED: 'most-used',
  RECENTLY_USED: 'recently-used',
  FORGOTTEN: 'forgotten',
} as const;

type PromptTab = typeof PROMPT_TABS[keyof typeof PROMPT_TABS];

const TAB_LABELS: Record<PromptTab, string> = {
  [PROMPT_TABS.MOST_USED]: 'Most Used',
  [PROMPT_TABS.RECENTLY_USED]: 'Recently Used',
  [PROMPT_TABS.FORGOTTEN]: 'Forgotten',
};

export interface AnalyticsDashboardProps {
  /** Callback when user wants to go back */
  onBack?: () => void;
}

/**
 * Full-page analytics dashboard with charts and prompt tables
 */
const AnalyticsDashboard: FC<AnalyticsDashboardProps> = ({
  onBack
}) => {
  const { stats, loading, error } = useUsageStats();
  const [activeTab, setActiveTab] = useState<PromptTab>(PROMPT_TABS.MOST_USED);
  const tabRefs = useRef<Map<PromptTab, HTMLButtonElement>>(new Map());

  // Current time for relative time calculations - updates every minute to trigger re-renders
  const now = useNow(REFRESH_INTERVAL_MS);

  // Compute summary metrics using shared hook
  const summaryMetrics = useSummaryMetrics(stats);

  // Get prompts for a specific tab
  const getPromptsForTab = useCallback((tab: PromptTab): PromptUsageSummary[] => {
    if (!stats) { return []; }
    switch (tab) {
      case PROMPT_TABS.MOST_USED:
        return stats.topPrompts;
      case PROMPT_TABS.RECENTLY_USED:
        return stats.recentPrompts;
      case PROMPT_TABS.FORGOTTEN:
        return stats.forgottenPrompts;
    }
  }, [stats]);

  // Memoized tab click handler to avoid creating new function references on each render
  const handleTabClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const tab = e.currentTarget.dataset.tab as PromptTab;
    setActiveTab(tab);
  }, []);

  // Keyboard navigation for tabs (Arrow keys, Home, End)
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabs = Object.values(PROMPT_TABS);
    const currentIndex = tabs.indexOf(activeTab);
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case 'ArrowRight':
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    setActiveTab(tabs[newIndex]);
    // Focus the new tab button using ref
    tabRefs.current.get(tabs[newIndex])?.focus();
  }, [activeTab]);

  if (error) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center p-6" role="alert">
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
    <div className="h-screen flex flex-col bg-app section-scroll-scope">
      {/* Header: seamless, its line shows once the content scrolls under it */}
      <header className="shrink-0 bg-app border-b border-transparent scroll-edge-top">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 text-secondary hover:text-primary hover:bg-muted rounded-xl transition-colors focus-interactive"
                  aria-label="Go back"
                >
                  <BackIcon className="w-5 h-5" />
                </button>
              )}
              <div className="flex items-center space-x-3">
                <div data-testid="dashboard-icon" className="w-10 h-10 bg-accent-subtle text-accent rounded-xl flex items-center justify-center">
                  <UsageIcon className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">
                    Analytics Dashboard
                  </h1>
                  <p className="text-sm text-tertiary">
                    Last 30 days of usage
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto custom-scrollbar px-4 sm:px-6 lg:px-8 py-6" data-scroll-container>
        {!hasData && !loading ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center" role="region" aria-label="Empty analytics">
            <div data-testid="empty-analytics-icon" className="w-24 h-24 bg-accent-subtle text-accent rounded-full flex items-center justify-center mb-6">
              <UsageIcon className="w-12 h-12" />
            </div>
            <h2 className="text-xl font-bold text-primary mb-2">No usage data yet</h2>
            <p className="text-sm text-tertiary max-w-md">
              Start using your prompts on AI platforms to see your analytics here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Summary Cards Row */}
            <section aria-label="Usage summary">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4">
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
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4">
                Usage Trend
              </h2>
              <div className="bg-card rounded-xl p-4 border border-default">
                {loading ? (
                  <div className="animate-pulse bg-muted rounded-xl" style={{ height: CHART_HEIGHT.MEDIUM }} />
                ) : (
                  <ErrorBoundary fallback={<ChartErrorFallback height={CHART_HEIGHT.MEDIUM} />}>
                    <UsageLineChart
                      data={stats?.dailyUsage ?? []}
                      height={CHART_HEIGHT.MEDIUM}
                    />
                  </ErrorBoundary>
                )}
              </div>
            </section>

            {/* 2x2 Chart Grid */}
            <section aria-label="Usage breakdown">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4">
                Breakdown
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Platform Distribution */}
                <div className="bg-card rounded-xl p-4 border border-default">
                  <h3 className="text-sm font-medium text-primary mb-3">
                    Platforms
                  </h3>
                  {loading ? (
                    <div className="animate-pulse bg-muted rounded-xl" style={{ height: CHART_HEIGHT.SMALL }} />
                  ) : (
                    <ErrorBoundary fallback={<ChartErrorFallback height={CHART_HEIGHT.SMALL} />}>
                      <PlatformPieChart
                        data={stats?.platformBreakdown ?? []}
                        height={CHART_HEIGHT.SMALL}
                      />
                    </ErrorBoundary>
                  )}
                </div>

                {/* Day of Week */}
                <div className="bg-card rounded-xl p-4 border border-default">
                  <h3 className="text-sm font-medium text-primary mb-3">
                    Day of Week
                  </h3>
                  {loading ? (
                    <div className="animate-pulse bg-muted rounded-xl" style={{ height: CHART_HEIGHT.SMALL }} />
                  ) : (
                    <ErrorBoundary fallback={<ChartErrorFallback height={CHART_HEIGHT.SMALL} />}>
                      <DayOfWeekChart
                        data={stats?.dayOfWeekDistribution ?? []}
                        height={CHART_HEIGHT.SMALL}
                      />
                    </ErrorBoundary>
                  )}
                </div>

                {/* Category Distribution */}
                <div className="bg-card rounded-xl p-4 border border-default">
                  <h3 className="text-sm font-medium text-primary mb-3">
                    Categories
                  </h3>
                  {loading ? (
                    <div className="animate-pulse bg-muted rounded-xl" style={{ height: CHART_HEIGHT.SMALL }} />
                  ) : (
                    <ErrorBoundary fallback={<ChartErrorFallback height={CHART_HEIGHT.SMALL} />}>
                      <CategoryBarChart
                        data={stats?.categoryDistribution ?? []}
                        height={CHART_HEIGHT.SMALL}
                        maxCategories={MAX_CATEGORIES_DISPLAY}
                      />
                    </ErrorBoundary>
                  )}
                </div>

                {/* Time of Day */}
                <div className="bg-card rounded-xl p-4 border border-default">
                  <h3 className="text-sm font-medium text-primary mb-3">
                    Time of Day
                  </h3>
                  {loading ? (
                    <div className="animate-pulse bg-muted rounded-xl" style={{ height: CHART_HEIGHT.SMALL }} />
                  ) : (
                    <ErrorBoundary fallback={<ChartErrorFallback height={CHART_HEIGHT.SMALL} />}>
                      <TimeOfDayChart
                        data={stats?.timeOfDayDistribution ?? []}
                        height={CHART_HEIGHT.SMALL}
                      />
                    </ErrorBoundary>
                  )}
                </div>
              </div>
            </section>

            {/* Prompt Tables with Tabs */}
            <section aria-label="Prompt usage details">
              <h2 className="text-sm font-semibold text-tertiary uppercase tracking-wider mb-4">
                Prompts
              </h2>
              <div className="bg-card rounded-xl border border-default overflow-hidden">
                {/* Tabs */}
                <div className="border-b border-divider p-2">
                  <div className="flex gap-1" role="tablist" aria-label="Prompt tabs">
                    {Object.values(PROMPT_TABS).map((tab) => (
                      <button
                        key={tab}
                        ref={(el) => {
                          if (el) {
                            tabRefs.current.set(tab, el);
                          }
                        }}
                        id={`tab-${tab}`}
                        data-tab={tab}
                        onClick={handleTabClick}
                        onKeyDown={handleTabKeyDown}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors focus-interactive ${
                          activeTab === tab
                            ? 'bg-accent-selected text-accent-strong font-semibold'
                            : 'text-tertiary font-medium hover:bg-muted hover:text-primary'
                        }`}
                        aria-selected={activeTab === tab}
                        aria-controls={`tabpanel-${tab}`}
                        tabIndex={activeTab === tab ? 0 : -1}
                        role="tab"
                      >
                        {TAB_LABELS[tab]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content - render all panels, hide inactive for valid aria-controls */}
                {Object.values(PROMPT_TABS).map((tab) => {
                  const isActive = activeTab === tab;
                  const tabPrompts = getPromptsForTab(tab);
                  return (
                    <div
                      key={tab}
                      id={`tabpanel-${tab}`}
                      className="p-4"
                      role="tabpanel"
                      aria-labelledby={`tab-${tab}`}
                      hidden={!isActive}
                    >
                      {loading ? (
                        <div className="space-y-3">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="animate-pulse bg-raised rounded-xl p-4">
                              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                              <div className="h-3 bg-muted rounded w-1/4" />
                            </div>
                          ))}
                        </div>
                      ) : tabPrompts.length > 0 ? (
                        <ul className="space-y-2">
                          {tabPrompts.map((prompt, index) => (
                            <li
                              key={prompt.promptId}
                              className="bg-raised rounded-xl p-4"
                            >
                              <div className="flex items-start gap-4">
                                <div data-testid="rank-badge" className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  tab === PROMPT_TABS.MOST_USED && index === 0
                                    ? 'bg-medal-gold text-on-accent'
                                    : tab === PROMPT_TABS.MOST_USED && index === 1
                                    ? 'bg-medal-silver text-on-accent'
                                    : tab === PROMPT_TABS.MOST_USED && index === 2
                                    ? 'bg-medal-bronze text-on-accent'
                                    : 'bg-subtle text-tertiary'
                                }`}>
                                  {tab === PROMPT_TABS.MOST_USED && index < 3 ? (
                                    <TrophyIcon className="w-4 h-4" />
                                  ) : (
                                    <span className="text-xs font-bold">{index + 1}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-primary truncate">
                                    {prompt.title}
                                  </h4>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs text-accent font-medium">
                                      {prompt.count} {prompt.count === 1 ? 'use' : 'uses'}
                                    </span>
                                    <span className="text-xs text-tertiary">
                                      {formatRelativeTime(prompt.lastUsed, now)}
                                    </span>
                                    {prompt.category && (
                                      <span className="text-xs px-2 py-0.5 bg-subtle text-secondary rounded-full">
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
                          <p className="text-sm text-tertiary">
                            {tab === PROMPT_TABS.FORGOTTEN
                              ? 'No forgotten prompts - you are using all your prompts!'
                              : 'No prompts to display'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default AnalyticsDashboard;

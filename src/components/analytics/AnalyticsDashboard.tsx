import { type FC, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDuplicateGroups } from '../../hooks/useDuplicateGroups';
import { useNow } from '../../hooks/useNow';
import { useUsageStats } from '../../hooks/useUsageStats';
import { type ReviewFilter, requestLibraryReview } from '../../services/libraryReview';
import {
  busiest,
  categoryRanking,
  countDuplicatePairs,
  countNeverUsed,
  duplicateReviewGroups,
  platformRanking,
  type RankedPrompt,
  rankByUses,
  weekdayUsage
} from '../../services/usageInsights';
import { MOTION } from '../../theme/motion';
import { formatPlatformName, formatRelativeTime, Logger, toError } from '../../utils';
import { ensureStorageAvailable } from '../../utils/chromeStorage';
import ErrorBoundary from '../ErrorBoundary';
import { BackIcon } from '../icons/UIIcons';
import SectionHeader from '../SectionHeader';

import { DailyUseChart, TimeOfDayChart } from './charts';
import { CHART_HEIGHT, MOST_USED_ROWS_FULL, RANKED_ROWS, REFRESH_INTERVAL_MS } from './constants';
import MostUsedCard from './MostUsedCard';
import RankedRows from './RankedRows';
import StatCard from './StatCard';
import StatsHero from './StatsHero';
import TidyUpCard from './TidyUpCard';

/** The page's side gutter: the content keeps to a 1100px column on a wide screen, the header with it */
const GUTTER = 'px-4 sm:px-6 lg:px-[max(2rem,calc(50vw-550px))]';

/** Shown in place of a chart that failed to draw */
const ChartErrorFallback: FC = () => (
  <div
    className="flex items-center justify-center rounded-xl bg-subtle"
    style={{ height: CHART_HEIGHT }}
    role="alert"
  >
    <p className="text-sm text-tertiary">Chart unavailable</p>
  </div>
);

/** A chart in a card of the tab's style: its title, a line that says what the chart shows, the chart */
const ChartCard: FC<{ id: string; title: string; subtitle: string; delayIndex: number; children: ReactNode }> = ({
  id,
  title,
  subtitle,
  delayIndex,
  children
}) => (
  <section
    aria-labelledby={`${id}-title`}
    data-testid={id}
    className="mt-2.5 p-3.5 rounded-group bg-card border border-default animate-card-rise min-w-0"
    style={{ animationDelay: `${String(MOTION.cardDelay + delayIndex * MOTION.cardStagger)}ms` }}
  >
    <h2 id={`${id}-title`} className="text-sm font-extrabold text-primary">{title}</h2>
    <p className="text-xs text-secondary">{subtitle}</p>
    <div className="mt-2">
      <ErrorBoundary fallback={<ChartErrorFallback />}>{children}</ErrorBoundary>
    </div>
  </section>
);

export interface AnalyticsDashboardProps {
  /** Callback when user wants to go back */
  onBack?: () => void;
}

/**
 * The full-page Analytics view, opened from the Analytics tab: the tab's design (Atelier 1C) at the
 * width of a page. The hero, Top platform and Top category, Most used and Tidy up as in the tab, then
 * the Platforms, the Categories, Daily use and Time of day.
 */
const AnalyticsDashboard: FC<AnalyticsDashboardProps> = ({ onBack }) => {
  const { stats, history, prompts, categories, loading, error } = useUsageStats();
  const duplicateGroups = useDuplicateGroups(loading ? null : prompts);
  // Current time for "2 days ago": updates every minute
  const now = useNow(REFRESH_INTERVAL_MS);

  const weekdays = useMemo(() => weekdayUsage(history), [history]);
  const platforms = useMemo(() => platformRanking(history), [history]);
  const rankedCategories = useMemo(() => categoryRanking(history, prompts, categories), [history, prompts, categories]);
  const allRanked = useMemo(() => rankByUses(history, prompts, Number.POSITIVE_INFINITY), [history, prompts]);
  const neverUsed = useMemo(() => countNeverUsed(prompts), [prompts]);
  const busiestTime = useMemo(() => busiest(stats?.timeOfDayDistribution ?? []), [stats]);
  const activeDays = useMemo(() => (stats?.dailyUsage ?? []).filter(day => day.count > 0).length, [stats]);

  const rowMeta = useCallback(
    ({ prompt, lastUsed }: RankedPrompt) => `${prompt.category} · ${formatRelativeTime(lastUsed, now)}`,
    [now]
  );

  // Review opens the side panel of this window. Chrome wants the window's id within the click, so
  // it is read once, ahead of it
  const windowIdRef = useRef<number | null>(null);
  const [reviewFailed, setReviewFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // In a tab that has just opened, the chrome API may not be there yet: wait for it, as the usage
    // history does, and never fail the page for a window id only Review needs
    ensureStorageAvailable()
      .then(() => (chrome.tabs as Partial<typeof chrome.tabs> | undefined)?.getCurrent?.())
      .then(tab => { if (!cancelled) { windowIdRef.current = tab?.windowId ?? null; } })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  const review = useCallback((filter: ReviewFilter) => {
    const windowId = windowIdRef.current;
    if (windowId === null) {
      setReviewFailed(true);
      return;
    }
    setReviewFailed(false);
    requestLibraryReview(filter, windowId).catch((err: unknown) => {
      Logger.error('Could not open a review in the side panel', toError(err), {
        component: 'AnalyticsDashboard'
      });
      setReviewFailed(true);
    });
  }, []);

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

  const hasData = history.length > 0;
  const topPlatform = platforms.at(0);
  const topCategory = rankedCategories.at(0);

  return (
    <div className="h-screen flex flex-col bg-app section-scroll-scope">
      {/* Section header, as in the Analytics tab: the period counted is the Eyebrow */}
      <SectionHeader
        title="Analytics"
        eyebrow="Last 30 days"
        className={GUTTER}
        leading={onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 text-secondary hover:text-primary hover:bg-muted rounded-lg transition-colors focus-interactive"
            aria-label="Go back"
          >
            <BackIcon className="w-5 h-5" />
          </button>
        )}
      />

      <main className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-8 ${GUTTER}`} data-scroll-container>
        {loading && !stats ? (
          <div className="mt-3.5 h-[220px] rounded-hero bg-muted animate-pulse" role="status" aria-label="Loading analytics" />
        ) : (
          <>
            <StatsHero total={history.length} weekdays={weekdays} wide />

            {/* From lg up, Most used at the left of Top platform, Top category and Tidy up; under it, the tab's order */}
            <div className="grid grid-cols-1 gap-x-2.5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_1fr] lg:items-start">
              {hasData && (
                <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:col-start-2 lg:row-start-1">
                  <StatCard label="Top platform" name={topPlatform ? formatPlatformName(topPlatform.platform) : '-'} count={topPlatform?.count ?? 0} delayIndex={0} />
                  <StatCard label="Top category" name={topCategory?.name ?? '-'} count={topCategory?.count ?? 0} delayIndex={1} />
                </div>
              )}

              {allRanked.length > 0 && (
                <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:row-span-2">
                  <MostUsedCard
                    ranked={allRanked.slice(0, MOST_USED_ROWS_FULL)}
                    usedCount={allRanked.length}
                    meta={rowMeta}
                    readOnly
                  />
                </div>
              )}

              <div className="min-w-0 lg:col-start-2">
                <TidyUpCard
                  neverUsed={neverUsed}
                  duplicatePairs={duplicateGroups ? countDuplicatePairs(duplicateGroups) : null}
                  onReviewNeverUsed={() => { review({ kind: 'neverUsed' }); }}
                  onReviewDuplicates={() => {
                    if (duplicateGroups) {
                      review({ kind: 'duplicates', groups: duplicateReviewGroups(duplicateGroups) });
                    }
                  }}
                />
                {reviewFailed && (
                  <p role="alert" className="mt-2 px-1 text-xs font-medium text-danger">
                    The review could not be opened in the side panel. Open My Prompt Manager and review from Analytics.
                  </p>
                )}
              </div>
            </div>

            {hasData && (
              <div className="grid grid-cols-1 gap-x-2.5 md:grid-cols-2 md:items-start">
                {platforms.length > 0 && (
                  <RankedRows
                    title="Platforms"
                    delayIndex={2}
                    rows={platforms.slice(0, RANKED_ROWS).map(entry => ({
                      key: entry.platform,
                      label: formatPlatformName(entry.platform),
                      count: entry.count
                    }))}
                  />
                )}
                {rankedCategories.length > 0 && (
                  <RankedRows
                    title="Categories"
                    delayIndex={3}
                    rows={rankedCategories.slice(0, RANKED_ROWS).map(entry => ({
                      key: entry.name,
                      label: entry.name,
                      count: entry.count,
                      dotColor: entry.color
                    }))}
                  />
                )}
                <ChartCard
                  id="daily-use"
                  title="Daily use"
                  subtitle={`Used on ${String(activeDays)} of the last ${String(stats?.dailyUsage.length ?? 0)} days.`}
                  delayIndex={4}
                >
                  <DailyUseChart data={stats?.dailyUsage ?? []} />
                </ChartCard>
                <ChartCard
                  id="time-of-day"
                  title="Time of day"
                  subtitle={busiestTime ? `${busiestTime.bucket} is your busiest time.` : 'No Prompts used yet.'}
                  delayIndex={5}
                >
                  <TimeOfDayChart data={stats?.timeOfDayDistribution ?? []} />
                </ChartCard>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AnalyticsDashboard;

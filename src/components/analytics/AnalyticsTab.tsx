import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useDuplicateGroups } from '../../hooks/useDuplicateGroups';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useUsageStats } from '../../hooks/useUsageStats';
import {
  countDuplicatePairs,
  countNeverUsed,
  duplicateReviewGroups,
  rankByUses,
  topCategory,
  topPlatform,
  weekdayUsage,
  withLatestUsage
} from '../../services/usageInsights';
import { MOTION } from '../../theme/motion';
import type { LibraryFilter, Prompt } from '../../types';
import { formatPlatformName } from '../../utils';
import { TrashIcon } from '../icons/UIIcons';
import SectionHeader from '../SectionHeader';
import ViewHeader from '../ViewHeader';

import MostUsedCard from './MostUsedCard';
import StatsHero from './StatsHero';
import TidyUpCard from './TidyUpCard';

/** Rows of the Most used card, as in the Atelier 1C design */
const MOST_USED_ROWS = 3;

const StatCard: FC<{ label: string; name: string; count: number; delayIndex: number }> = ({ label, name, count, delayIndex }) => (
  <div
    className="p-3.5 rounded-group bg-card border border-default animate-card-rise min-w-0"
    style={{ animationDelay: `${String(MOTION.cardDelay + delayIndex * MOTION.cardStagger)}ms` }}
  >
    <h2 className="text-xs font-semibold text-tertiary">{label}</h2>
    <p className="mt-1 text-[19px] font-extrabold tracking-[-0.02em] text-primary truncate" title={name}>{name}</p>
    <p className="text-xs text-secondary">{String(count)} {count === 1 ? 'use' : 'uses'}</p>
  </div>
);

export interface AnalyticsTabProps {
  /** Callback when user wants to expand to full dashboard */
  onExpandDashboard?: () => void;
  /** Current context (popup or sidepanel) */
  context?: 'popup' | 'sidepanel';
  /** The Library's Prompts, kept current by the app; the ones loaded with the history otherwise */
  prompts?: Prompt[];
  /** Opens a Prompt of Most used in the editor */
  onEditPrompt?: (prompt: Prompt) => void;
  /** Opens the Library on the Prompts Tidy up offers to review */
  onReviewPrompts?: (filter: LibraryFilter) => void;
  /** Take the keyboard (the Prompt opened from Most used has gone), then call onFocusTaken */
  takeFocus?: boolean;
  onFocusTaken?: () => void;
}

const AnalyticsTab: FC<AnalyticsTabProps> = ({
  onExpandDashboard,
  context = 'sidepanel',
  prompts: livePrompts,
  onEditPrompt,
  onReviewPrompts,
  takeFocus = false,
  onFocusTaken
}) => {
  const { stats, history, prompts: loadedPrompts, loading, error, clearHistory } = useUsageStats();
  // The app's Prompts, with the usage stored since (Insertions on a Platform while it was open)
  const prompts = useMemo(
    () => (livePrompts ? withLatestUsage(livePrompts, loadedPrompts) : loadedPrompts),
    [livePrompts, loadedPrompts]
  );
  const duplicateGroups = useDuplicateGroups(loading ? null : prompts);

  const weekdays = useMemo(() => weekdayUsage(history), [history]);
  const platform = useMemo(() => topPlatform(history), [history]);
  const category = useMemo(() => topCategory(history, prompts), [history, prompts]);
  const allRanked = useMemo(() => rankByUses(history, prompts, Number.POSITIVE_INFINITY), [history, prompts]);
  const ranked = allRanked.slice(0, MOST_USED_ROWS);
  const usedCount = allRanked.length;
  const neverUsed = useMemo(() => countNeverUsed(prompts), [prompts]);

  // The first Most used row left gets the keyboard, or the content when none is
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!takeFocus || loading) { return; }
    const main = mainRef.current;
    const row = main?.querySelector<HTMLElement>('section[aria-labelledby="most-used-title"] li button');
    (row ?? main)?.focus();
    onFocusTaken?.();
  }, [takeFocus, loading, onFocusTaken]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const clearDialogRef = useRef<HTMLDivElement>(null);
  const clearCancelRef = useRef<HTMLButtonElement>(null);
  const closeClearConfirm = useCallback(() => {
    if (!isClearing) {setShowClearConfirm(false);}
  }, [isClearing]);
  useModalFocus({
    isOpen: showClearConfirm,
    onClose: closeClearConfirm,
    containerRef: clearDialogRef,
    initialFocusRef: clearCancelRef
  });

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

  const hasData = history.length > 0;

  return (
    <div className="h-full flex flex-col bg-app relative">
      {/* Section header: the period counted is the Eyebrow */}
      <SectionHeader title="Analytics" eyebrow="Last 30 days">
        {context === 'sidepanel' && (
          <>
            {hasData && onExpandDashboard && (
              <button
                onClick={onExpandDashboard}
                className="h-9 px-4 text-sm font-bold text-on-accent bg-accent hover:bg-accent-hover rounded-full shadow-sm transition-colors focus-primary"
                aria-label="View full analytics dashboard"
              >
                Full Dashboard
              </button>
            )}
            <ViewHeader.CloseButton onClick={() => { window.close(); }} context="sidepanel" />
          </>
        )}
      </SectionHeader>

      {/* Content (Atelier 1C): the hero, Top platform and Top category, Most used, Tidy up */}
      <main
        ref={mainRef}
        tabIndex={-1}
        aria-label="Analytics"
        className="flex-1 overflow-auto custom-scrollbar px-4 pb-[18px] outline-none"
        data-scroll-container
      >
        {loading && !stats ? (
          <div className="mt-3.5 h-[220px] rounded-hero bg-muted animate-pulse" role="status" aria-label="Loading analytics" />
        ) : (
          <>
            <StatsHero total={history.length} weekdays={weekdays} />

            {hasData && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <StatCard label="Top platform" name={platform ? formatPlatformName(platform.platform) : '-'} count={platform?.count ?? 0} delayIndex={0} />
                <StatCard label="Top category" name={category?.name ?? '-'} count={category?.count ?? 0} delayIndex={1} />
              </div>
            )}

            {ranked.length > 0 && (
              <MostUsedCard
                ranked={ranked}
                usedCount={usedCount}
                onOpenPrompt={onEditPrompt}
                onViewAll={onExpandDashboard}
              />
            )}

            <TidyUpCard
              neverUsed={neverUsed}
              duplicatePairs={duplicateGroups ? countDuplicatePairs(duplicateGroups) : null}
              onReviewNeverUsed={() => { onReviewPrompts?.({ kind: 'neverUsed' }); }}
              onReviewDuplicates={() => {
                if (duplicateGroups) {
                  onReviewPrompts?.({ kind: 'duplicates', groups: duplicateReviewGroups(duplicateGroups) });
                }
              }}
            />

            {hasData && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => { setShowClearConfirm(true); }}
                  className="text-[12.5px] font-semibold text-tertiary hover:text-danger px-2 py-1 rounded-md transition-colors focus-danger"
                >
                  Clear history
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Clear History Confirmation Modal: on the body, like the other dialogs, out of reach of the
          Section's slide and fade */}
      {showClearConfirm && createPortal(
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
            ref={clearDialogRef}
            tabIndex={-1}
            className="relative z-10 bg-card rounded-xl p-6 max-w-sm mx-4 shadow-2xl focus:outline-none"
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
                ref={clearCancelRef}
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default AnalyticsTab;

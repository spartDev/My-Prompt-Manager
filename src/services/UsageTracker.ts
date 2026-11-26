import {
  type AppError, 
  type ErrorType,
  type PlatformType,
  USAGE_RETENTION_DAYS,
  USAGE_STORAGE_KEY,
  type UsageEvent
} from '../types';
import { ensureStorageAvailable } from '../utils/chromeStorage';
import * as Logger from '../utils/logger';
import { withUsageHistoryLock } from './usageHistoryLock';

class UsageTrackerError extends Error implements AppError {
  public type: ErrorType;
  public details?: unknown;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = 'UsageTrackerError';
    this.type = appError.type;
    this.details = appError.details;
  }
}

/**
 * Whether a stored entry is an insertion of the retention period, which starts at `cutoff`. An
 * entry with no numeric time, or no entry at all, is outside it: readers skip it, writers remove it.
 */
function isRetained(entry: unknown, cutoff: number): entry is UsageEvent {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }
  const { timestamp } = entry as { timestamp?: unknown };
  return typeof timestamp === 'number' && timestamp >= cutoff;
}

/**
 * UsageTracker - Singleton service for tracking prompt usage analytics
 *
 * Records usage events when prompts are inserted into AI platforms.
 * Keeps the insertions of the retention period (USAGE_RETENTION_DAYS) and no older ones: each
 * insertion removes the older ones (record), and the service worker removes them at every browser
 * startup and on an extension update (cleanup).
 * All data stays local in Chrome storage.
 */
export class UsageTracker {
  private static instance: UsageTracker | undefined;

  // Storage quota protection limit, within the retention period
  // At ~100 bytes per event, 10,000 events = ~1MB (leaving plenty of buffer)
  private static readonly MAX_EVENTS = 10000;

  private constructor() {}

  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  /**
   * Record a prompt usage event
   * @param promptId - The ID of the prompt that was used
   * @param platform - The platform where the prompt was inserted
   * @param categoryId - The category ID of the prompt (null if uncategorized)
   */
  record(promptId: string, platform: PlatformType, categoryId: string | null): Promise<void> {
    return withUsageHistoryLock(async () => {
      try {
        const event: UsageEvent = {
          promptId,
          timestamp: Date.now(),
          platform,
          categoryId
        };

        // Each insertion removes the entries older than the retention period, and the malformed ones
        let history = this.retained(await this.getRawHistory());

        // Hard limit: if at max within the retention period, remove the oldest events to make room
        if (history.length >= UsageTracker.MAX_EVENTS) {
          const eventsToRemove = history.length - UsageTracker.MAX_EVENTS + 1;
          // Sort by timestamp ascending (oldest first) and remove oldest
          history.sort((a, b) => a.timestamp - b.timestamp);
          history = history.slice(eventsToRemove);
          Logger.warn('UsageTracker: Hard limit reached, removed oldest events', {
            component: 'UsageTracker',
            eventsRemoved: eventsToRemove,
            maxEvents: UsageTracker.MAX_EVENTS
          });
        }

        history.push(event);

        await this.setHistory(history);
      } catch (error) {
        throw this.handleError(error);
      }
    });
  }

  /** The entries of the retention period, in their stored order */
  private retained(history: readonly unknown[]): UsageEvent[] {
    const cutoffTime = this.getRetentionCutoff();
    return history.filter((entry): entry is UsageEvent => isRetained(entry, cutoffTime));
  }

  /**
   * Get all usage events within the retention period (30 days)
   * @returns Array of usage events, sorted by timestamp (newest first)
   */
  async getHistory(): Promise<UsageEvent[]> {
    try {
      const history = await this.getRawHistory();

      return this.retained(history).sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get raw history from storage without filtering: every stored entry, as stored. A value that is
   * not a list, which no Release writes, reads as an empty history.
   */
  private async getRawHistory(): Promise<unknown[]> {
    await ensureStorageAvailable();
    const result = await chrome.storage.local.get([USAGE_STORAGE_KEY]);
    const history: unknown = result[USAGE_STORAGE_KEY];
    return Array.isArray(history) ? history : [];
  }

  /**
   * Clear all usage history
   */
  clearHistory(): Promise<void> {
    return withUsageHistoryLock(async () => {
      try {
        await this.setHistory([]);
      } catch (error) {
        throw this.handleError(error);
      }
    });
  }

  /**
   * Remove the entries older than the retention period (30 days), and the malformed ones. The
   * service worker calls it at every browser startup and on an extension update.
   * @returns How many entries it removed; it writes only when that is more than none
   */
  cleanup(): Promise<number> {
    return withUsageHistoryLock(async () => {
      try {
        const history = await this.getRawHistory();
        const kept = this.retained(history);
        const removed = history.length - kept.length;

        if (removed > 0) {
          await this.setHistory(kept);
        }
        return removed;
      } catch (error) {
        throw this.handleError(error);
      }
    });
  }

  /**
   * Get usage events for a specific prompt
   * @param promptId - The prompt ID to filter by
   */
  async getHistoryForPrompt(promptId: string): Promise<UsageEvent[]> {
    const history = await this.getHistory();
    return history.filter(event => event.promptId === promptId);
  }

  /**
   * Get usage events for a specific platform
   * @param platform - The platform to filter by
   */
  async getHistoryForPlatform(platform: string): Promise<UsageEvent[]> {
    const history = await this.getHistory();
    return history.filter(event => event.platform === platform);
  }

  /**
   * Get the total count of usage events in the retention period
   */
  async getTotalUsageCount(): Promise<number> {
    const history = await this.getHistory();
    return history.length;
  }

  /**
   * Calculate the cutoff timestamp for retention (30 days ago)
   */
  private getRetentionCutoff(): number {
    return Date.now() - (USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Save usage history to storage
   */
  private async setHistory(history: UsageEvent[]): Promise<void> {
    await ensureStorageAvailable();
    await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: history });
  }

  private handleError(error: unknown): UsageTrackerError {
    if (error instanceof UsageTrackerError) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('QUOTA_EXCEEDED')) {
      return new UsageTrackerError({
        type: 'STORAGE_QUOTA_EXCEEDED',
        message: 'Storage quota exceeded. Usage history may need to be cleared.',
        details: error
      });
    }

    if (errorMessage.includes('storage API')) {
      return new UsageTrackerError({
        type: 'STORAGE_UNAVAILABLE',
        message: 'Storage API is unavailable. Please try again later.',
        details: error
      });
    }

    return new UsageTrackerError({
      type: 'VALIDATION_ERROR',
      message: errorMessage || 'An unknown error occurred in UsageTracker.',
      details: error
    });
  }
}

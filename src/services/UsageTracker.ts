import {
  UsageEvent,
  USAGE_RETENTION_DAYS,
  USAGE_STORAGE_KEY,
  ErrorType,
  AppError
} from '../types';
import * as Logger from '../utils/logger';

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
 * UsageTracker - Singleton service for tracking prompt usage analytics
 *
 * Records usage events when prompts are inserted into AI platforms.
 * Maintains a 30-day rolling window of usage history.
 * All data stays local in Chrome storage.
 */
export class UsageTracker {
  private static instance: UsageTracker | undefined;

  // Mutex for preventing concurrent storage operations
  private operationLock: Promise<unknown> | null = null;

  // Storage quota protection limits
  // At ~100 bytes per event, 10,000 events = ~1MB (leaving plenty of buffer)
  private static readonly MAX_EVENTS = 10000;
  // Cleanup threshold: when we hit this, trim to keep newest events within retention period
  private static readonly CLEANUP_THRESHOLD = 9000;

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
  async record(promptId: string, platform: string, categoryId: string | null): Promise<void> {
    return this.withLock(async () => {
      try {
        const event: UsageEvent = {
          promptId,
          timestamp: Date.now(),
          platform,
          categoryId
        };

        let history = await this.getRawHistory();

        // Quota protection: trim old events if approaching limit
        if (history.length >= UsageTracker.CLEANUP_THRESHOLD) {
          const originalLength = history.length;
          history = this.trimOldEvents(history);
          Logger.info('UsageTracker: Proactive cleanup triggered', {
            component: 'UsageTracker',
            originalCount: originalLength,
            newCount: history.length,
            threshold: UsageTracker.CLEANUP_THRESHOLD
          });
        }

        // Hard limit: if still at max, remove oldest events to make room
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

  /**
   * Trim old events that are outside the retention period
   * Used for proactive cleanup to prevent storage quota issues
   */
  private trimOldEvents(history: UsageEvent[]): UsageEvent[] {
    const cutoffTime = this.getRetentionCutoff();
    return history.filter(event => event.timestamp >= cutoffTime);
  }

  /**
   * Get all usage events within the retention period (30 days)
   * @returns Array of usage events, sorted by timestamp (newest first)
   */
  async getHistory(): Promise<UsageEvent[]> {
    try {
      const history = await this.getRawHistory();

      // Filter to only include events within retention period
      const cutoffTime = this.getRetentionCutoff();
      return history
        .filter(event => event.timestamp >= cutoffTime)
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Wait for chrome.storage.local to be available
   * In some contexts (e.g., analytics.html in a new tab), the chrome API
   * may not be immediately available when the page first loads
   */
  private async ensureStorageAvailable(): Promise<void> {
    const maxAttempts = 50;
    const delayMs = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new UsageTrackerError({
      type: ErrorType.STORAGE_UNAVAILABLE,
      message: 'Chrome storage API is not available. Please ensure you are running within a Chrome extension context.',
      details: { maxAttempts, delayMs }
    });
  }

  /**
   * Get raw history from storage without filtering
   * Used internally for operations that need all events
   */
  private async getRawHistory(): Promise<UsageEvent[]> {
    await this.ensureStorageAvailable();
    const result = await chrome.storage.local.get([USAGE_STORAGE_KEY]);
    const history = result[USAGE_STORAGE_KEY] as UsageEvent[] | undefined;
    return history ?? [];
  }

  /**
   * Clear all usage history
   */
  async clearHistory(): Promise<void> {
    return this.withLock(async () => {
      try {
        await this.setHistory([]);
      } catch (error) {
        throw this.handleError(error);
      }
    });
  }

  /**
   * Remove events older than the retention period (30 days)
   * Should be called on extension initialization
   */
  async cleanup(): Promise<void> {
    return this.withLock(async () => {
      try {
        const history = await this.getRawHistory();

        const cutoffTime = this.getRetentionCutoff();
        const filteredHistory = history.filter(event => event.timestamp >= cutoffTime);

        // Only write if we actually removed events
        if (filteredHistory.length !== history.length) {
          await this.setHistory(filteredHistory);
        }
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
    await this.ensureStorageAvailable();
    await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: history });
  }

  /**
   * Mutex implementation for preventing race conditions using queue-based approach
   */
  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    // Create a promise that will resolve when this operation gets to run
    let resolveQueue: (() => void) | undefined;
    const queuePromise = new Promise<void>(resolve => {
      resolveQueue = resolve;
    });

    // Chain this operation after the existing lock (or resolve immediately if none)
    const chainedPromise = this.operationLock
      ? this.operationLock.then(() => {}, () => {}) // Wait for previous, ignore its result/error
      : Promise.resolve();

    // Set our queue promise as the new lock BEFORE awaiting the chain
    this.operationLock = queuePromise;

    // Wait for our turn (previous operation to complete)
    await chainedPromise;

    // Now we have exclusive access - execute the operation
    try {
      const result = await operation();
      return result;
    } finally {
      // Signal that we're done (release the lock for next operation)
      if (resolveQueue) {
        resolveQueue();
      }

      // Clean up if we're still the current lock holder
      if (this.operationLock === queuePromise) {
        this.operationLock = null;
      }
    }
  }

  private handleError(error: unknown): UsageTrackerError {
    if (error instanceof UsageTrackerError) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('QUOTA_EXCEEDED')) {
      return new UsageTrackerError({
        type: ErrorType.STORAGE_QUOTA_EXCEEDED,
        message: 'Storage quota exceeded. Usage history may need to be cleared.',
        details: error
      });
    }

    if (errorMessage.includes('storage API')) {
      return new UsageTrackerError({
        type: ErrorType.STORAGE_UNAVAILABLE,
        message: 'Storage API is unavailable. Please try again later.',
        details: error
      });
    }

    return new UsageTrackerError({
      type: ErrorType.VALIDATION_ERROR,
      message: errorMessage || 'An unknown error occurred in UsageTracker.',
      details: error
    });
  }
}

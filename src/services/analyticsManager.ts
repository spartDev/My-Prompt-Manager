import { v4 as uuidv4 } from 'uuid';

import { checkUnlockedAchievements } from '../constants/achievements';
import type {
  AnalyticsEvent,
  AnalyticsData,
  ComputedStats,
  InsertionSource,
  Achievement
} from '../types/analytics';
import { Logger, toError } from '../utils';

import { StorageManager } from './storage';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export class AnalyticsManager {
  private static instance: AnalyticsManager | null = null;

  private constructor() {
    Logger.debug('AnalyticsManager initialized', {
      component: 'AnalyticsManager'
    });
  }

  public static getInstance(): AnalyticsManager {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager();
    }
    return AnalyticsManager.instance;
  }

  /**
   * Track a prompt insertion event
   */
  public async trackInsertion(params: {
    promptId: string;
    categoryId: string;
    platform: string;
    source: InsertionSource;
  }): Promise<AnalyticsEvent | null> {
    try {
      // Check if analytics is enabled
      const storage = StorageManager.getInstance();
      const data = await storage.get(['settings']);
      const settings = (data.settings ?? {}) as { analyticsEnabled?: boolean };
      const analyticsEnabled = settings.analyticsEnabled ?? true; // Default to enabled

      if (!analyticsEnabled) {
        Logger.debug('Analytics tracking skipped (disabled in settings)', {
          component: 'AnalyticsManager'
        });
        return null;
      }

      const event: AnalyticsEvent = {
        id: uuidv4(),
        timestamp: Date.now(),
        promptId: params.promptId,
        categoryId: params.categoryId,
        platform: params.platform,
        source: params.source
      };

      await this.addEvent(event);

      Logger.debug('Analytics event tracked', {
        component: 'AnalyticsManager',
        eventId: event.id,
        platform: params.platform
      });

      return event;
    } catch (error) {
      Logger.error('Failed to track analytics event', toError(error), {
        component: 'AnalyticsManager',
        operation: 'trackInsertion'
      });
      throw error;
    }
  }

  /**
   * Get analytics data
   */
  public async getData(): Promise<AnalyticsData> {
    try {
      const storage = StorageManager.getInstance();
      const data = await storage.get(['analytics']);

      if (!data.analytics) {
        return this.getEmptyData();
      }

      return data.analytics as AnalyticsData;
    } catch (error) {
      Logger.error('Failed to get analytics data', toError(error), {
        component: 'AnalyticsManager'
      });
      return this.getEmptyData();
    }
  }

  /**
   * Get computed statistics for display
   */
  public async getComputedStats(): Promise<ComputedStats> {
    try {
      const data = await this.getData();
      const { events, stats } = data;

      // Calculate weekly activity (last 7 days)
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const weeklyEvents = events.filter(e => e.timestamp >= sevenDaysAgo);

      const weeklyActivity = this.calculateWeeklyActivity(weeklyEvents);
      const platformDistribution = this.calculatePlatformDistribution(events);
      const categoryBreakdown = await this.calculateCategoryBreakdown(events);
      const mostUsedPrompt = await this.findMostUsedPrompt(events);
      const mostActivePlatform = this.findMostActivePlatform(platformDistribution);

      return {
        totalInsertions: stats.totalInsertions,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        mostUsedPrompt,
        mostActivePlatform,
        weeklyActivity,
        platformDistribution,
        categoryBreakdown
      };
    } catch (error) {
      Logger.error('Failed to compute stats', toError(error), {
        component: 'AnalyticsManager'
      });
      throw error;
    }
  }

  /**
   * Add event and perform cleanup
   */
  private async addEvent(event: AnalyticsEvent): Promise<void> {
    const storage = StorageManager.getInstance();
    const data = await this.getData();

    const cutoffDate = Date.now() - NINETY_DAYS_MS;
    data.events = data.events.filter(e => e.timestamp > cutoffDate);
    data.events.push(event);

    // Update stats
    data.stats.totalInsertions += 1;
    if (data.stats.firstInsertionDate === 0) {
      data.stats.firstInsertionDate = event.timestamp;
    }

    // Update streak
    data.stats.currentStreak = this.calculateCurrentStreak(data.events);
    data.stats.longestStreak = Math.max(
      data.stats.longestStreak,
      data.stats.currentStreak
    );

    // Check for new achievements
    const newAchievements = this.checkAchievements(data);
    for (const achievement of newAchievements) {
      data.achievements.push(achievement);
    }

    await storage.set({ analytics: data });
  }

  /**
   * Calculate current streak
   */
  private calculateCurrentStreak(events: AnalyticsEvent[]): number {
    if (events.length === 0) {return 0;}

    const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);
    const uniqueDays = new Set<string>();

    for (const event of sortedEvents) {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      uniqueDays.add(date);
    }

    const daysArray = Array.from(uniqueDays).sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    const checkDate = new Date(today);

    for (const day of daysArray) {
      const expectedDate = checkDate.toISOString().split('T')[0];
      if (day === expectedDate) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Calculate weekly activity
   */
  private calculateWeeklyActivity(events: AnalyticsEvent[]): { day: string; count: number }[] {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Map<string, number>();

    // Initialize with last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const day = days[date.getDay()];
      counts.set(day, 0);
    }

    // Count events per day
    for (const event of events) {
      const date = new Date(event.timestamp);
      const day = days[date.getDay()];
      counts.set(day, (counts.get(day) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([day, count]) => ({ day, count }));
  }

  /**
   * Calculate platform distribution
   */
  private calculatePlatformDistribution(
    events: AnalyticsEvent[]
  ): { platform: string; count: number; percentage: number }[] {
    const counts = new Map<string, number>();

    for (const event of events) {
      counts.set(event.platform, (counts.get(event.platform) || 0) + 1);
    }

    const total = events.length || 1;
    return Array.from(counts.entries())
      .map(([platform, count]) => ({
        platform,
        count,
        percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate category breakdown
   */
  private async calculateCategoryBreakdown(
    events: AnalyticsEvent[]
  ): Promise<{ categoryId: string; name: string; count: number }[]> {
    const storage = StorageManager.getInstance();
    const { categories = [] } = await storage.get(['categories']);
    const categoryMap = new Map(
      (categories as Array<{ id: string; name: string }>).map((c) => [c.id, c.name])
    );

    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.categoryId, (counts.get(event.categoryId) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([categoryId, count]) => ({
        categoryId,
        name: categoryMap.get(categoryId) || 'Unknown',
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Find most used prompt
   */
  private async findMostUsedPrompt(
    events: AnalyticsEvent[]
  ): Promise<{ id: string; title: string; count: number } | null> {
    if (events.length === 0) {return null;}

    const storage = StorageManager.getInstance();
    const { prompts = [] } = await storage.get(['prompts']);
    const promptMap = new Map(
      (prompts as Array<{ id: string; title?: string }>).map((p) => [p.id, p.title || 'Untitled'])
    );

    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.promptId, (counts.get(event.promptId) || 0) + 1);
    }

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {return null;}

    const [id, count] = sorted[0];
    return {
      id,
      title: promptMap.get(id) || 'Untitled',
      count
    };
  }

  /**
   * Find most active platform
   */
  private findMostActivePlatform(
    distribution: { platform: string; count: number; percentage: number }[]
  ): { name: string; count: number; percentage: number } | null {
    if (distribution.length === 0) {return null;}
    const top = distribution[0];
    return { name: top.platform, count: top.count, percentage: top.percentage };
  }

  /**
   * Check for newly unlocked achievements
   */
  private checkAchievements(data: AnalyticsData): Achievement[] {
    const usedPlatforms = new Set(data.events.map(e => e.platform));
    const usedCategories = new Set(data.events.map(e => e.categoryId));

    const newAchievements = checkUnlockedAchievements(
      data.achievements,
      data.stats.totalInsertions,
      data.stats.currentStreak,
      { usedPlatforms, usedCategories }
    );

    return newAchievements;
  }

  /**
   * Get empty analytics data
   */
  private getEmptyData(): AnalyticsData {
    return {
      events: [],
      achievements: [],
      stats: {
        firstInsertionDate: 0,
        totalInsertions: 0,
        currentStreak: 0,
        longestStreak: 0
      }
    };
  }
}

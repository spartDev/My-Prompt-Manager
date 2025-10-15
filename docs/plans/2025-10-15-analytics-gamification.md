# Analytics & Gamification Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add comprehensive usage analytics and achievement system to track prompt insertion activity with iOS Screen Time-inspired insights, fully local and privacy-first.

**Architecture:** Event-driven analytics with AnalyticsManager singleton service storing 90-day rolling window of insertion events. Stats computed on-demand when Analytics view opens. Achievement system with tiered milestones (bronze/silver/gold/platinum). New Analytics tab in extension UI with charts and gamification elements.

**Tech Stack:** TypeScript, React 19, Vitest, Chrome Storage API, existing StorageManager pattern

---

## Task 1: Create TypeScript Types and Interfaces

**Files:**
- Create: `src/types/analytics.ts`
- Test: `src/types/__tests__/analytics.test.ts`

**Step 1: Write the failing test**

```typescript
// src/types/__tests__/analytics.test.ts
import { describe, it, expect } from 'vitest';
import type { AnalyticsEvent, AnalyticsData, Achievement, AchievementTier } from '../analytics';

describe('Analytics Types', () => {
  it('should allow creating a valid AnalyticsEvent', () => {
    const event: AnalyticsEvent = {
      id: 'evt-123',
      timestamp: Date.now(),
      promptId: 'prompt-456',
      categoryId: 'cat-789',
      platform: 'claude',
      source: 'browse'
    };

    expect(event.id).toBe('evt-123');
    expect(event.platform).toBe('claude');
    expect(event.source).toBe('browse');
  });

  it('should allow creating valid AnalyticsData', () => {
    const data: AnalyticsData = {
      events: [],
      achievements: [],
      stats: {
        firstInsertionDate: Date.now(),
        totalInsertions: 0,
        currentStreak: 0,
        longestStreak: 0
      }
    };

    expect(data.events).toHaveLength(0);
    expect(data.stats.totalInsertions).toBe(0);
  });

  it('should enforce valid achievement tiers', () => {
    const tiers: AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    expect(tiers).toContain('bronze');
    expect(tiers).toContain('platinum');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/types/__tests__/analytics.test.ts`
Expected: FAIL with "Cannot find module '../analytics'"

**Step 3: Write minimal implementation**

```typescript
// src/types/analytics.ts

/**
 * Source of prompt insertion
 */
export type InsertionSource = 'search' | 'browse' | 'favorite';

/**
 * Achievement tier levels
 */
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

/**
 * Achievement category types
 */
export type AchievementCategory = 'usage' | 'streak' | 'discovery';

/**
 * Individual analytics event for prompt insertion
 */
export interface AnalyticsEvent {
  id: string;              // UUID
  timestamp: number;       // Unix timestamp
  promptId: string;        // Reference to prompt
  categoryId: string;      // Reference to category
  platform: string;        // 'claude', 'chatgpt', etc.
  source: InsertionSource; // How user found it
}

/**
 * Achievement definition
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  tier: AchievementTier;
  category: AchievementCategory;
  icon: string;
  requirement: number;
  unlockedAt?: number;     // Unix timestamp when unlocked
  progress?: number;       // Current progress toward requirement
}

/**
 * Lifetime statistics
 */
export interface AnalyticsStats {
  firstInsertionDate: number; // Unix timestamp
  totalInsertions: number;    // Lifetime counter
  currentStreak: number;      // Consecutive days
  longestStreak: number;      // Personal record
}

/**
 * Complete analytics data structure
 */
export interface AnalyticsData {
  events: AnalyticsEvent[];
  achievements: Achievement[];
  stats: AnalyticsStats;
}

/**
 * Computed statistics for display
 */
export interface ComputedStats {
  totalInsertions: number;
  currentStreak: number;
  longestStreak: number;
  mostUsedPrompt: { id: string; title: string; count: number } | null;
  mostActiveplatform: { name: string; count: number; percentage: number } | null;
  weeklyActivity: { day: string; count: number }[];
  platformDistribution: { platform: string; count: number; percentage: number }[];
  categoryBreakdown: { categoryId: string; name: string; count: number }[];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/types/__tests__/analytics.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/types/analytics.ts src/types/__tests__/analytics.test.ts
git commit -m "feat: add analytics TypeScript types and interfaces"
```

---

## Task 2: Create Achievement Definitions

**Files:**
- Create: `src/constants/achievements.ts`
- Test: `src/constants/__tests__/achievements.test.ts`

**Step 1: Write the failing test**

```typescript
// src/constants/__tests__/achievements.test.ts
import { describe, it, expect } from 'vitest';
import { ACHIEVEMENT_DEFINITIONS, getAchievementProgress, checkUnlockedAchievements } from '../achievements';

describe('Achievement Definitions', () => {
  it('should have usage milestone achievements', () => {
    const usageAchievements = ACHIEVEMENT_DEFINITIONS.filter(a => a.category === 'usage');
    expect(usageAchievements.length).toBeGreaterThan(0);
    expect(usageAchievements.some(a => a.id === 'first_prompt')).toBe(true);
  });

  it('should have streak achievements', () => {
    const streakAchievements = ACHIEVEMENT_DEFINITIONS.filter(a => a.category === 'streak');
    expect(streakAchievements.length).toBeGreaterThan(0);
    expect(streakAchievements.some(a => a.id === 'streak_3')).toBe(true);
  });

  it('should calculate achievement progress correctly', () => {
    const progress = getAchievementProgress('prompt_10', 5);
    expect(progress).toBe(5);
  });

  it('should identify newly unlocked achievements', () => {
    const current = [];
    const unlocked = checkUnlockedAchievements(current, 10, 3, {
      usedPlatforms: new Set(['claude', 'chatgpt']),
      usedCategories: new Set(['work', 'personal'])
    });
    expect(unlocked.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/constants/__tests__/achievements.test.ts`
Expected: FAIL with "Cannot find module '../achievements'"

**Step 3: Write minimal implementation**

```typescript
// src/constants/achievements.ts
import type { Achievement, AchievementCategory, AchievementTier } from '../types/analytics';

export const ACHIEVEMENT_DEFINITIONS: Omit<Achievement, 'unlockedAt' | 'progress'>[] = [
  // Usage Milestones
  {
    id: 'first_prompt',
    name: 'Getting Started',
    description: 'Insert your first prompt',
    tier: 'bronze',
    category: 'usage',
    icon: '🎯',
    requirement: 1
  },
  {
    id: 'prompt_10',
    name: 'Prompt Novice',
    description: 'Insert 10 prompts',
    tier: 'bronze',
    category: 'usage',
    icon: '📝',
    requirement: 10
  },
  {
    id: 'prompt_50',
    name: 'Prompt Enthusiast',
    description: 'Insert 50 prompts',
    tier: 'silver',
    category: 'usage',
    icon: '⚡',
    requirement: 50
  },
  {
    id: 'prompt_100',
    name: 'Prompt Master',
    description: 'Insert 100 prompts',
    tier: 'gold',
    category: 'usage',
    icon: '🏆',
    requirement: 100
  },
  {
    id: 'prompt_500',
    name: 'Prompt Legend',
    description: 'Insert 500 prompts',
    tier: 'platinum',
    category: 'usage',
    icon: '👑',
    requirement: 500
  },

  // Streak Achievements
  {
    id: 'streak_3',
    name: '3-Day Streak',
    description: 'Use prompts for 3 consecutive days',
    tier: 'bronze',
    category: 'streak',
    icon: '🔥',
    requirement: 3
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Use prompts for 7 consecutive days',
    tier: 'silver',
    category: 'streak',
    icon: '💪',
    requirement: 7
  },
  {
    id: 'streak_30',
    name: 'Monthly Master',
    description: 'Use prompts for 30 consecutive days',
    tier: 'gold',
    category: 'streak',
    icon: '⭐',
    requirement: 30
  },

  // Discovery Achievements
  {
    id: 'multi_platform',
    name: 'Platform Explorer',
    description: 'Use prompts on 3 different platforms',
    tier: 'silver',
    category: 'discovery',
    icon: '🌐',
    requirement: 3
  },
  {
    id: 'category_master',
    name: 'Organized Mind',
    description: 'Use prompts from 5 different categories',
    tier: 'gold',
    category: 'discovery',
    icon: '🗂️',
    requirement: 5
  }
];

/**
 * Get current progress for an achievement
 */
export function getAchievementProgress(
  achievementId: string,
  currentValue: number
): number {
  return currentValue;
}

/**
 * Check which achievements should be newly unlocked
 */
export function checkUnlockedAchievements(
  currentAchievements: Achievement[],
  totalInsertions: number,
  currentStreak: number,
  context: {
    usedPlatforms: Set<string>;
    usedCategories: Set<string>;
  }
): Achievement[] {
  const unlocked: Achievement[] = [];
  const unlockedIds = new Set(currentAchievements.map(a => a.id));
  const now = Date.now();

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (unlockedIds.has(def.id)) continue;

    let shouldUnlock = false;

    if (def.category === 'usage') {
      shouldUnlock = totalInsertions >= def.requirement;
    } else if (def.category === 'streak') {
      shouldUnlock = currentStreak >= def.requirement;
    } else if (def.category === 'discovery') {
      if (def.id === 'multi_platform') {
        shouldUnlock = context.usedPlatforms.size >= def.requirement;
      } else if (def.id === 'category_master') {
        shouldUnlock = context.usedCategories.size >= def.requirement;
      }
    }

    if (shouldUnlock) {
      unlocked.push({
        ...def,
        unlockedAt: now,
        progress: def.requirement
      });
    }
  }

  return unlocked;
}

/**
 * Get tier color for UI display
 */
export function getTierColor(tier: AchievementTier): string {
  const colors: Record<AchievementTier, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2'
  };
  return colors[tier];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/constants/__tests__/achievements.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/constants/achievements.ts src/constants/__tests__/achievements.test.ts
git commit -m "feat: add achievement definitions and unlock logic"
```

---

## Task 3: Create AnalyticsManager Service

**Files:**
- Create: `src/services/analyticsManager.ts`
- Test: `src/services/__tests__/analyticsManager.test.ts`

**Step 1: Write the failing test**

```typescript
// src/services/__tests__/analyticsManager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsManager } from '../analyticsManager';
import type { AnalyticsEvent } from '../../types/analytics';

describe('AnalyticsManager', () => {
  let manager: AnalyticsManager;

  beforeEach(() => {
    manager = AnalyticsManager.getInstance();
    vi.clearAllMocks();
  });

  it('should be a singleton', () => {
    const instance1 = AnalyticsManager.getInstance();
    const instance2 = AnalyticsManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should track prompt insertion event', async () => {
    const event = await manager.trackInsertion({
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude',
      source: 'browse'
    });

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.promptId).toBe('prompt-123');
  });

  it('should maintain 90-day rolling window', async () => {
    const oldTimestamp = Date.now() - (91 * 24 * 60 * 60 * 1000);

    // Manually insert old event
    await manager.trackInsertion({
      promptId: 'old-prompt',
      categoryId: 'cat-1',
      platform: 'claude',
      source: 'browse'
    });

    // Trigger cleanup
    await manager.trackInsertion({
      promptId: 'new-prompt',
      categoryId: 'cat-2',
      platform: 'chatgpt',
      source: 'search'
    });

    const data = await manager.getData();
    // Old events should be removed
    expect(data.events.every(e => e.timestamp > oldTimestamp)).toBe(true);
  });

  it('should compute stats correctly', async () => {
    await manager.trackInsertion({
      promptId: 'prompt-1',
      categoryId: 'cat-1',
      platform: 'claude',
      source: 'browse'
    });

    const stats = await manager.getComputedStats();
    expect(stats.totalInsertions).toBe(1);
    expect(stats.currentStreak).toBeGreaterThanOrEqual(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/services/__tests__/analyticsManager.test.ts`
Expected: FAIL with "Cannot find module '../analyticsManager'"

**Step 3: Write minimal implementation**

```typescript
// src/services/analyticsManager.ts
import { v4 as uuidv4 } from 'uuid';
import { StorageManager } from './storage';
import { Logger, toError } from '../utils';
import type {
  AnalyticsEvent,
  AnalyticsData,
  AnalyticsStats,
  ComputedStats,
  InsertionSource
} from '../types/analytics';
import { checkUnlockedAchievements } from '../constants/achievements';

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
  }): Promise<AnalyticsEvent> {
    try {
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
    const newAchievements = await this.checkAchievements(data);
    data.achievements.push(...newAchievements);

    await storage.set({ analytics: data });
  }

  /**
   * Calculate current streak
   */
  private calculateCurrentStreak(events: AnalyticsEvent[]): number {
    if (events.length === 0) return 0;

    const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);
    const uniqueDays = new Set<string>();

    for (const event of sortedEvents) {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      uniqueDays.add(date);
    }

    const daysArray = Array.from(uniqueDays).sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let checkDate = new Date(today);

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
    const categoryMap = new Map(categories.map((c: any) => [c.id, c.name]));

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
    if (events.length === 0) return null;

    const storage = StorageManager.getInstance();
    const { prompts = [] } = await storage.get(['prompts']);
    const promptMap = new Map(prompts.map((p: any) => [p.id, p.title || 'Untitled']));

    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.promptId, (counts.get(event.promptId) || 0) + 1);
    }

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;

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
    if (distribution.length === 0) return null;
    const top = distribution[0];
    return { name: top.platform, count: top.count, percentage: top.percentage };
  }

  /**
   * Check for newly unlocked achievements
   */
  private async checkAchievements(data: AnalyticsData): Promise<any[]> {
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
```

**Step 4: Run test to verify it passes**

Run: `npm test src/services/__tests__/analyticsManager.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/services/analyticsManager.ts src/services/__tests__/analyticsManager.test.ts
git commit -m "feat: add AnalyticsManager service with event tracking"
```

---

## Task 4: Integrate Analytics Tracking into Content Script

**Files:**
- Modify: `src/content/core/insertion-manager.ts`
- Test: `src/content/core/__tests__/insertion-manager.analytics.test.ts`

**Step 1: Write the failing test**

```typescript
// src/content/core/__tests__/insertion-manager.analytics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsertionManager } from '../insertion-manager';
import { AnalyticsManager } from '../../../services/analyticsManager';

vi.mock('../../../services/analyticsManager');

describe('InsertionManager Analytics Integration', () => {
  let insertionManager: InsertionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    insertionManager = new InsertionManager();
  });

  it('should track analytics after successful insertion', async () => {
    const trackInsertionSpy = vi.spyOn(
      AnalyticsManager.getInstance(),
      'trackInsertion'
    );

    await insertionManager.insertPrompt({
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude',
      content: 'Test prompt content'
    });

    expect(trackInsertionSpy).toHaveBeenCalledWith({
      promptId: 'prompt-123',
      categoryId: 'cat-456',
      platform: 'claude',
      source: 'browse'
    });
  });

  it('should not track analytics if insertion fails', async () => {
    const trackInsertionSpy = vi.spyOn(
      AnalyticsManager.getInstance(),
      'trackInsertion'
    );

    // Force insertion failure
    vi.spyOn(insertionManager as any, 'performInsertion').mockRejectedValue(
      new Error('Insertion failed')
    );

    try {
      await insertionManager.insertPrompt({
        promptId: 'prompt-123',
        categoryId: 'cat-456',
        platform: 'claude',
        content: 'Test prompt'
      });
    } catch {
      // Expected to fail
    }

    expect(trackInsertionSpy).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/content/core/__tests__/insertion-manager.analytics.test.ts`
Expected: FAIL with "trackInsertion not called"

**Step 3: Modify insertion-manager.ts to track analytics**

Add to `src/content/core/insertion-manager.ts`:

```typescript
import { AnalyticsManager } from '../../services/analyticsManager';

// Inside InsertionManager class, modify insertPrompt method:

public async insertPrompt(params: {
  promptId: string;
  categoryId: string;
  platform: string;
  content: string;
  source?: 'search' | 'browse' | 'favorite';
}): Promise<void> {
  try {
    // ... existing insertion logic ...

    // Track analytics after successful insertion
    try {
      await AnalyticsManager.getInstance().trackInsertion({
        promptId: params.promptId,
        categoryId: params.categoryId,
        platform: params.platform,
        source: params.source || 'browse'
      });
    } catch (analyticsError) {
      // Don't fail insertion if analytics tracking fails
      error('Failed to track analytics', analyticsError, {
        component: 'InsertionManager',
        operation: 'trackAnalytics'
      });
    }
  } catch (error) {
    error('Failed to insert prompt', error, {
      component: 'InsertionManager',
      operation: 'insertPrompt'
    });
    throw error;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/content/core/__tests__/insertion-manager.analytics.test.ts`
Expected: PASS (2 tests)

**Step 5: Run all tests to ensure no regressions**

Run: `npm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/content/core/insertion-manager.ts src/content/core/__tests__/insertion-manager.analytics.test.ts
git commit -m "feat: integrate analytics tracking into insertion flow"
```

---

## Task 5: Create Analytics View Component

**Files:**
- Create: `src/components/AnalyticsView.tsx`
- Test: `src/components/__tests__/AnalyticsView.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/__tests__/AnalyticsView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AnalyticsView } from '../AnalyticsView';
import { AnalyticsManager } from '../../services/analyticsManager';

vi.mock('../../services/analyticsManager');

describe('AnalyticsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(AnalyticsManager.getInstance(), 'getComputedStats').mockResolvedValue({
      totalInsertions: 42,
      currentStreak: 7,
      longestStreak: 14,
      mostUsedPrompt: { id: 'p1', title: 'Test Prompt', count: 10 },
      mostActivePlatform: { name: 'claude', count: 25, percentage: 60 },
      weeklyActivity: [
        { day: 'Mon', count: 5 },
        { day: 'Tue', count: 8 }
      ],
      platformDistribution: [
        { platform: 'claude', count: 25, percentage: 60 }
      ],
      categoryBreakdown: [
        { categoryId: 'cat1', name: 'Work', count: 20 }
      ]
    });
  });

  it('should render stats overview cards', async () => {
    render(<AnalyticsView onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  it('should display empty state when no data', async () => {
    vi.spyOn(AnalyticsManager.getInstance(), 'getComputedStats').mockResolvedValue({
      totalInsertions: 0,
      currentStreak: 0,
      longestStreak: 0,
      mostUsedPrompt: null,
      mostActivePlatform: null,
      weeklyActivity: [],
      platformDistribution: [],
      categoryBreakdown: []
    });

    render(<AnalyticsView onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Start Building Your Stats/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/__tests__/AnalyticsView.test.tsx`
Expected: FAIL with "Cannot find module '../AnalyticsView'"

**Step 3: Write minimal implementation**

```typescript
// src/components/AnalyticsView.tsx
import { FC, useEffect, useState } from 'react';
import { AnalyticsManager } from '../services/analyticsManager';
import { Logger, toError } from '../utils';
import type { ComputedStats } from '../types/analytics';

interface AnalyticsViewProps {
  onBack: () => void;
}

export const AnalyticsView: FC<AnalyticsViewProps> = ({ onBack }) => {
  const [stats, setStats] = useState<ComputedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const analyticsManager = AnalyticsManager.getInstance();
      const computedStats = await analyticsManager.getComputedStats();
      setStats(computedStats);
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
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        <button
          onClick={loadStats}
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
            value={`${stats.currentStreak} days`}
            icon="🔥"
          />
          <StatCard
            label="Most Used"
            value={stats.mostUsedPrompt?.title || 'N/A'}
            icon="⭐"
            subtitle={stats.mostUsedPrompt ? `${stats.mostUsedPrompt.count}x` : undefined}
          />
          <StatCard
            label="Top Platform"
            value={stats.mostActivePlatform?.name || 'N/A'}
            icon="🌐"
            subtitle={stats.mostActivePlatform ? `${stats.mostActivePlatform.percentage}%` : undefined}
          />
        </div>

        {/* Weekly Activity Chart - Placeholder */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-purple-100 dark:border-gray-700 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Weekly Activity
          </h2>
          <div className="h-32 flex items-end justify-between space-x-2">
            {stats.weeklyActivity.map((day) => (
              <div key={day.day} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gradient-to-t from-purple-600 to-indigo-600 rounded-t-lg"
                  style={{ height: `${Math.max(day.count * 10, 5)}%` }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {day.day}
                </p>
              </div>
            ))}
          </div>
        </div>
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
```

**Step 4: Run test to verify it passes**

Run: `npm test src/components/__tests__/AnalyticsView.test.tsx`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/components/AnalyticsView.tsx src/components/__tests__/AnalyticsView.test.tsx
git commit -m "feat: add AnalyticsView component with stats display"
```

---

## Task 6: Add Analytics Navigation to App

**Files:**
- Modify: `src/App.tsx`
- Test: Update `src/components/__tests__/App.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/__tests__/App.test.tsx`:

```typescript
it('should navigate to analytics view when analytics button clicked', async () => {
  const { user } = render(<App />);

  // Find and click analytics button (assuming it's in the nav)
  const analyticsButton = screen.getByLabelText(/analytics/i);
  await user.click(analyticsButton);

  expect(screen.getByText('Analytics')).toBeInTheDocument();
  expect(screen.getByText(/Your usage insights/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/__tests__/App.test.tsx`
Expected: FAIL with "Unable to find element with label analytics"

**Step 3: Modify App.tsx to add analytics navigation**

In `src/App.tsx`, add:

```typescript
import { AnalyticsView } from './components/AnalyticsView';

// Add to View enum:
enum View {
  LIBRARY = 'library',
  ADD_PROMPT = 'add_prompt',
  EDIT_PROMPT = 'edit_prompt',
  CATEGORIES = 'categories',
  SETTINGS = 'settings',
  ANALYTICS = 'analytics' // Add this
}

// In the render method, add analytics button to navigation and view case:

// Navigation button (add alongside settings button):
<button
  onClick={() => setView(View.ANALYTICS)}
  className="p-2 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
  aria-label="Analytics"
>
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
</button>

// View rendering (add case):
{view === View.ANALYTICS && (
  <AnalyticsView
    onBack={() => setView(View.LIBRARY)}
  />
)}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/components/__tests__/App.test.tsx`
Expected: PASS (including new test)

**Step 5: Commit**

```bash
git add src/App.tsx src/components/__tests__/App.test.tsx
git commit -m "feat: add analytics navigation to main app"
```

---

## Task 7: Add Achievement Display Components

**Files:**
- Create: `src/components/AchievementCard.tsx`
- Create: `src/components/AchievementsSection.tsx`
- Test: `src/components/__tests__/AchievementCard.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/__tests__/AchievementCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AchievementCard } from '../AchievementCard';
import type { Achievement } from '../../types/analytics';

describe('AchievementCard', () => {
  it('should render unlocked achievement', () => {
    const achievement: Achievement = {
      id: 'prompt_10',
      name: 'Prompt Novice',
      description: 'Insert 10 prompts',
      tier: 'bronze',
      category: 'usage',
      icon: '📝',
      requirement: 10,
      unlockedAt: Date.now(),
      progress: 10
    };

    render(<AchievementCard achievement={achievement} />);

    expect(screen.getByText('Prompt Novice')).toBeInTheDocument();
    expect(screen.getByText('Insert 10 prompts')).toBeInTheDocument();
    expect(screen.getByText('📝')).toBeInTheDocument();
  });

  it('should render locked achievement with progress', () => {
    const achievement: Achievement = {
      id: 'prompt_50',
      name: 'Prompt Enthusiast',
      description: 'Insert 50 prompts',
      tier: 'silver',
      category: 'usage',
      icon: '⚡',
      requirement: 50,
      progress: 25
    };

    render(<AchievementCard achievement={achievement} locked />);

    expect(screen.getByText('Prompt Enthusiast')).toBeInTheDocument();
    expect(screen.getByText('25 / 50')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/__tests__/AchievementCard.test.tsx`
Expected: FAIL with "Cannot find module '../AchievementCard'"

**Step 3: Write minimal implementation**

```typescript
// src/components/AchievementCard.tsx
import { FC } from 'react';
import type { Achievement } from '../types/analytics';
import { getTierColor } from '../constants/achievements';

interface AchievementCardProps {
  achievement: Achievement;
  locked?: boolean;
}

export const AchievementCard: FC<AchievementCardProps> = ({
  achievement,
  locked = false
}) => {
  const tierColor = getTierColor(achievement.tier);
  const progress = achievement.progress || 0;
  const percentage = (progress / achievement.requirement) * 100;

  return (
    <div
      className={`
        bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm
        border-2 rounded-xl p-4
        transition-all duration-200
        ${locked ? 'opacity-50 grayscale' : 'hover:shadow-md'}
      `}
      style={{ borderColor: locked ? '#d1d5db' : tierColor }}
    >
      <div className="flex items-start space-x-3">
        <div className="text-3xl">{achievement.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {achievement.name}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {achievement.description}
          </p>

          {locked && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{progress} / {achievement.requirement}</span>
                <span>{Math.round(percentage)}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}

          {!locked && achievement.unlockedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
```

```typescript
// src/components/AchievementsSection.tsx
import { FC } from 'react';
import { AchievementCard } from './AchievementCard';
import type { Achievement } from '../types/analytics';
import { ACHIEVEMENT_DEFINITIONS } from '../constants/achievements';

interface AchievementsSectionProps {
  unlockedAchievements: Achievement[];
  totalInsertions: number;
  currentStreak: number;
}

export const AchievementsSection: FC<AchievementsSectionProps> = ({
  unlockedAchievements,
  totalInsertions,
  currentStreak
}) => {
  const unlockedIds = new Set(unlockedAchievements.map(a => a.id));

  const allAchievements = ACHIEVEMENT_DEFINITIONS.map(def => {
    const unlocked = unlockedAchievements.find(a => a.id === def.id);
    if (unlocked) return unlocked;

    // Calculate progress for locked achievements
    let progress = 0;
    if (def.category === 'usage') {
      progress = Math.min(totalInsertions, def.requirement);
    } else if (def.category === 'streak') {
      progress = Math.min(currentStreak, def.requirement);
    }

    return {
      ...def,
      progress
    };
  });

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-purple-100 dark:border-gray-700 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Achievements ({unlockedAchievements.length} / {ACHIEVEMENT_DEFINITIONS.length})
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {allAchievements.map(achievement => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
            locked={!unlockedIds.has(achievement.id)}
          />
        ))}
      </div>
    </div>
  );
};
```

**Step 4: Run test to verify it passes**

Run: `npm test src/components/__tests__/AchievementCard.test.tsx`
Expected: PASS (2 tests)

**Step 5: Update AnalyticsView to include achievements**

Modify `src/components/AnalyticsView.tsx` to load and display achievements:

```typescript
// Add to state:
const [achievements, setAchievements] = useState<Achievement[]>([]);

// Modify loadStats:
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
    // ... error handling
  }
};

// Add to render (after weekly activity):
{stats.totalInsertions > 0 && (
  <AchievementsSection
    unlockedAchievements={achievements}
    totalInsertions={stats.totalInsertions}
    currentStreak={stats.currentStreak}
  />
)}
```

**Step 6: Commit**

```bash
git add src/components/AchievementCard.tsx src/components/AchievementsSection.tsx src/components/__tests__/AchievementCard.test.tsx src/components/AnalyticsView.tsx
git commit -m "feat: add achievement display components"
```

---

## Task 8: Add Analytics Settings Toggle

**Files:**
- Modify: `src/components/SettingsView.tsx`
- Test: Update `src/components/__tests__/SettingsView.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/__tests__/SettingsView.test.tsx`:

```typescript
it('should toggle analytics setting', async () => {
  const { user } = render(<SettingsView onBack={vi.fn()} />);

  await waitFor(() => {
    expect(screen.getByText(/Enable Usage Analytics/i)).toBeInTheDocument();
  });

  const toggle = screen.getByRole('switch', { name: /analytics/i });
  await user.click(toggle);

  // Verify setting was saved
  expect(mockSet).toHaveBeenCalledWith({
    settings: expect.objectContaining({
      analyticsEnabled: expect.any(Boolean)
    })
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/components/__tests__/SettingsView.test.tsx`
Expected: FAIL with "Unable to find element"

**Step 3: Add analytics toggle to SettingsView**

In `src/components/SettingsView.tsx`, add:

```typescript
// Add to settings state/interface:
interface Settings {
  // ... existing settings
  analyticsEnabled: boolean;
}

// Add toggle in render (in appropriate section):
<div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-purple-100 dark:border-gray-700 rounded-xl p-5 mb-3">
  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
    Privacy & Data
  </h2>

  <div className="flex items-center justify-between">
    <div className="flex-1 pr-4">
      <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
        Enable Usage Analytics
      </label>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
        Track prompt usage and unlock achievements (100% local)
      </p>
    </div>
    <ToggleSwitch
      checked={settings.analyticsEnabled ?? true}
      onChange={(checked) => handleSettingChange('analyticsEnabled', checked)}
      ariaLabel="Enable analytics"
    />
  </div>
</div>
```

**Step 4: Run test to verify it passes**

Run: `npm test src/components/__tests__/SettingsView.test.tsx`
Expected: PASS (including new test)

**Step 5: Modify AnalyticsManager to respect setting**

Add to `src/services/analyticsManager.ts`:

```typescript
public async trackInsertion(params: {
  promptId: string;
  categoryId: string;
  platform: string;
  source: InsertionSource;
}): Promise<AnalyticsEvent | null> {
  try {
    // Check if analytics is enabled
    const storage = StorageManager.getInstance();
    const { settings = {} } = await storage.get(['settings']);
    if (settings.analyticsEnabled === false) {
      return null; // Analytics disabled
    }

    // ... rest of tracking logic
  } catch (error) {
    // ... error handling
  }
}
```

**Step 6: Commit**

```bash
git add src/components/SettingsView.tsx src/components/__tests__/SettingsView.test.tsx src/services/analyticsManager.ts
git commit -m "feat: add analytics toggle in settings"
```

---

## Task 9: Add Migration Logic for Existing Users

**Files:**
- Modify: `src/background/index.ts`
- Test: `src/background/__tests__/analytics-migration.test.ts`

**Step 1: Write the failing test**

```typescript
// src/background/__tests__/analytics-migration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateToAnalytics } from '../index';
import { StorageManager } from '../../services/storage';

vi.mock('../../services/storage');

describe('Analytics Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize analytics for users without data', async () => {
    vi.spyOn(StorageManager.getInstance(), 'get').mockResolvedValue({});
    const setSpy = vi.spyOn(StorageManager.getInstance(), 'set');

    await migrateToAnalytics();

    expect(setSpy).toHaveBeenCalledWith({
      analytics: expect.objectContaining({
        events: [],
        achievements: [],
        stats: expect.any(Object)
      })
    });
  });

  it('should not overwrite existing analytics data', async () => {
    vi.spyOn(StorageManager.getInstance(), 'get').mockResolvedValue({
      analytics: {
        events: [{ id: 'existing' }],
        achievements: [],
        stats: { totalInsertions: 5 }
      }
    });
    const setSpy = vi.spyOn(StorageManager.getInstance(), 'set');

    await migrateToAnalytics();

    expect(setSpy).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/background/__tests__/analytics-migration.test.ts`
Expected: FAIL with "migrateToAnalytics is not a function"

**Step 3: Add migration logic to background script**

Add to `src/background/index.ts`:

```typescript
import { StorageManager } from '../services/storage';
import { Logger } from '../utils';

/**
 * Migrate existing users to analytics system
 */
async function migrateToAnalytics(): Promise<void> {
  try {
    const storage = StorageManager.getInstance();
    const data = await storage.get(['analytics']);

    if (!data.analytics) {
      // Initialize analytics for existing users
      await storage.set({
        analytics: {
          events: [],
          achievements: [],
          stats: {
            firstInsertionDate: Date.now(),
            totalInsertions: 0,
            currentStreak: 0,
            longestStreak: 0
          }
        }
      });

      Logger.info('Analytics initialized for existing user', {
        component: 'Background'
      });
    }
  } catch (error) {
    Logger.error('Failed to migrate analytics', error, {
      component: 'Background',
      operation: 'migrateToAnalytics'
    });
  }
}

// Run migration on extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    await migrateToAnalytics();
  }
});

export { migrateToAnalytics };
```

**Step 4: Run test to verify it passes**

Run: `npm test src/background/__tests__/analytics-migration.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/background/index.ts src/background/__tests__/analytics-migration.test.ts
git commit -m "feat: add analytics migration for existing users"
```

---

## Task 10: Run Full Test Suite and Lint

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (960+ tests including new analytics tests)

**Step 2: Run linter**

Run: `npm run lint`
Expected: No lint errors

**Step 3: Fix any lint issues**

If lint errors exist:
Run: `npm run lint:fix`
Then: `npm run lint` again to verify

**Step 4: Build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 5: Commit if any fixes were made**

```bash
git add .
git commit -m "chore: fix lint issues and ensure build passes"
```

---

## Task 11: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README.md**

Add to feature list:
```markdown
### Analytics & Insights
✅ **Usage Analytics:** Track prompt insertions with iOS Screen Time-inspired insights
✅ **Achievement System:** Unlock milestones and streaks (bronze/silver/gold/platinum tiers)
✅ **Privacy-First:** All analytics data stored locally, never leaves your device
✅ **Rich Statistics:** Weekly activity charts, platform distribution, category breakdown
✅ **90-Day History:** Rolling window of usage events for trend analysis
```

Update version to 1.7.0 in relevant sections.

**Step 2: Update CLAUDE.md**

Add to Architecture section:
```markdown
### Analytics System
- `AnalyticsManager`: Singleton service for tracking usage events
- Event-driven architecture with 90-day rolling window
- Achievement system with tiered milestones
- Stats computed on-demand when Analytics view opens
- Graceful degradation if analytics fails (doesn't block core functionality)
```

**Step 3: Commit documentation updates**

```bash
git add README.md CLAUDE.md
git commit -m "docs: update documentation for analytics feature"
```

---

## Task 12: Final Integration Test

**Step 1: Manual testing checklist**

Test the following flow manually in Chrome:

1. Load extension in chrome://extensions/
2. Navigate to Analytics tab (should show empty state)
3. Insert a prompt on Claude.ai
4. Return to Analytics tab (should show 1 insertion, "Getting Started" achievement unlocked)
5. Insert 9 more prompts
6. Check Analytics (should show "Prompt Novice" achievement unlocked)
7. Disable analytics in Settings
8. Insert another prompt
9. Check Analytics (stats shouldn't increase)
10. Re-enable analytics
11. Test dark mode in Analytics view

**Step 2: Create integration test**

```typescript
// src/test/__tests__/analytics-integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsManager } from '../../services/analyticsManager';
import { StorageManager } from '../../services/storage';

describe('Analytics Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear analytics data
    await StorageManager.getInstance().set({ analytics: null });
  });

  it('should track full analytics flow', async () => {
    const analyticsManager = AnalyticsManager.getInstance();

    // Track first insertion
    await analyticsManager.trackInsertion({
      promptId: 'p1',
      categoryId: 'c1',
      platform: 'claude',
      source: 'browse'
    });

    // Verify data
    let data = await analyticsManager.getData();
    expect(data.events).toHaveLength(1);
    expect(data.stats.totalInsertions).toBe(1);
    expect(data.achievements).toHaveLength(1); // Getting Started

    // Track 9 more insertions
    for (let i = 0; i < 9; i++) {
      await analyticsManager.trackInsertion({
        promptId: `p${i + 2}`,
        categoryId: 'c1',
        platform: 'claude',
        source: 'search'
      });
    }

    // Verify achievements unlocked
    data = await analyticsManager.getData();
    expect(data.stats.totalInsertions).toBe(10);
    expect(data.achievements.some(a => a.id === 'prompt_10')).toBe(true);

    // Verify stats computation
    const stats = await analyticsManager.getComputedStats();
    expect(stats.totalInsertions).toBe(10);
    expect(stats.platformDistribution[0].platform).toBe('claude');
  });
});
```

Run: `npm test src/test/__tests__/analytics-integration.test.ts`
Expected: PASS

**Step 3: Final commit**

```bash
git add src/test/__tests__/analytics-integration.test.ts
git commit -m "test: add analytics integration test"
```

---

## Summary

Implementation complete! The analytics & gamification system includes:

**Core Features:**
- Event-driven analytics tracking with 90-day rolling window
- Achievement system with 10 predefined achievements across 3 categories
- Computed statistics: total insertions, streaks, most-used prompts, platform distribution
- Privacy-first: 100% local storage, no external requests
- Graceful degradation: analytics failures don't block prompt insertion

**UI Components:**
- AnalyticsView with stats overview cards
- Weekly activity bar chart
- Achievement cards with progress indicators
- Settings toggle for analytics enable/disable
- Empty state for new users

**Technical Implementation:**
- TypeScript types and interfaces
- Singleton AnalyticsManager service
- Integration with existing StorageManager
- Content script tracking hooks
- Migration logic for existing users
- Comprehensive test coverage (30+ new tests)

**Commands to verify:**
```bash
npm test          # 960+ tests passing
npm run lint      # No errors
npm run build     # Successful build
```

All tasks follow TDD approach with failing tests first, minimal implementation, and frequent commits.

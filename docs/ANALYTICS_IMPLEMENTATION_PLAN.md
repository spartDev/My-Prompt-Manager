# Analytics & Gamification Implementation Plan

**Feature:** Prompt Usage Statistics & Gamification (iOS Screen Time Style)
**Target Version:** 1.6.0
**Estimated Timeline:** 7-10 days
**Last Updated:** 2025-10-11

---

## Table of Contents

- [Overview](#overview)
- [Goals & Success Metrics](#goals--success-metrics)
- [Architecture Design](#architecture-design)
- [Data Models](#data-models)
- [Implementation Phases](#implementation-phases)
- [Technical Specifications](#technical-specifications)
- [UI/UX Design](#uiux-design)
- [Testing Strategy](#testing-strategy)
- [Privacy & Security](#privacy--security)
- [Performance Considerations](#performance-considerations)
- [Migration Strategy](#migration-strategy)
- [Future Enhancements](#future-enhancements)

---

## Overview

### Feature Description

Add comprehensive usage analytics to track prompt insertion activity, similar to iOS Screen Time. Provide users with actionable insights about their prompt library usage patterns while maintaining the extension's privacy-first approach.

### Key Features

- **Daily/Weekly/Monthly Statistics**: Track prompt usage over time
- **Platform Breakdown**: See which AI platforms you use most
- **Top Prompts**: Identify your most-used prompts
- **Streak Tracking**: Gamification through consecutive usage days
- **Achievement Badges**: Unlock milestones and accomplishments
- **Usage Trends**: Visualize patterns with charts and graphs

### Design Principles

1. **Privacy First**: All data stays local, no external transmission
2. **Performance**: Minimal impact on extension responsiveness
3. **Progressive Enhancement**: Works with existing data, no breaking changes
4. **Actionable Insights**: Data that helps users optimize their libraries
5. **Visual Consistency**: Follow existing design guidelines

---

## Goals & Success Metrics

### Primary Goals

1. **Increase User Engagement**: Users check stats 2-3x per week
2. **Improve Prompt Library Efficiency**: Users identify and archive 10-15% unused prompts
3. **Drive Retention**: Streak feature encourages daily usage
4. **Differentiate Product**: Unique feature vs. competitors

### Success Metrics

- **Adoption Rate**: 60%+ of users view Stats tab within first week
- **Engagement**: Average 3 stat views per user per week
- **Retention**: 20% increase in 7-day retention rate
- **Quality**: 0 critical bugs, <5% storage quota increase

---

## Architecture Design

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                  Chrome Extension                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  Content Script  │────────>│ AnalyticsManager │     │
│  │  (Insertion)     │  Track  │   (Singleton)    │     │
│  └──────────────────┘         └─────────┬────────┘     │
│                                          │              │
│                                          │              │
│  ┌──────────────────┐         ┌─────────▼────────┐     │
│  │   StatsView      │<────────│  StorageManager  │     │
│  │  (React UI)      │  Query  │   (Singleton)    │     │
│  └──────────────────┘         └──────────────────┘     │
│                                          │              │
│                                          ▼              │
│                            ┌────────────────────────┐   │
│                            │ Chrome Storage (Local) │   │
│                            └────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User inserts prompt
    ↓
PlatformInsertionManager.insertContent()
    ↓
AnalyticsManager.recordUsage(promptId, platform, timestamp)
    ↓
StorageManager.updateAnalytics()
    ↓
Chrome Storage Local
    ↓
StatsView component (React)
    ↓
Display charts, badges, insights
```

---

## Data Models

### Core Data Structures

#### 1. UsageEvent
```typescript
/**
 * Represents a single prompt insertion event
 */
interface UsageEvent {
  id: string;              // Unique event ID (UUID)
  promptId: string;        // Reference to Prompt.id
  platform: PlatformId;    // 'claude' | 'chatgpt' | 'gemini' | 'mistral' | 'perplexity' | 'custom'
  timestamp: number;       // Unix timestamp (ms)
  categoryId?: string;     // Denormalized for quick queries
}
```

#### 2. DailyStats
```typescript
/**
 * Aggregated statistics for a single day
 */
interface DailyStats {
  date: string;                        // ISO date: 'YYYY-MM-DD'
  totalInsertions: number;             // Total events count
  uniquePromptsUsed: string[];         // Array of unique prompt IDs
  platformBreakdown: Record<PlatformId, number>; // Platform usage counts
  categoryBreakdown: Record<string, number>;     // Category usage counts
  topPrompts: Array<{                  // Top 5 prompts for this day
    promptId: string;
    count: number;
  }>;
}
```

#### 3. PromptUsageMetadata
```typescript
/**
 * Cached usage statistics per prompt (for performance)
 */
interface PromptUsageMetadata {
  promptId: string;
  totalUses: number;                   // All-time usage count
  lastUsedAt: number;                  // Last insertion timestamp
  firstUsedAt: number;                 // First insertion timestamp
  platformBreakdown: Record<PlatformId, number>; // Per-platform usage
  usageByDay: Record<string, number>;  // Last 30 days: {'2025-10-11': 5, ...}
}
```

#### 4. UserStats
```typescript
/**
 * Overall user statistics and achievements
 */
interface UserStats {
  totalInsertions: number;             // All-time insertion count
  currentStreak: number;               // Consecutive days with ≥1 insertion
  longestStreak: number;               // Best streak ever
  lastActivityDate: string;            // ISO date of last insertion
  achievements: Achievement[];         // Unlocked achievements
  startDate: string;                   // First usage date
}
```

#### 5. Achievement
```typescript
/**
 * Gamification badges and milestones
 */
interface Achievement {
  id: AchievementId;
  unlockedAt: number;                  // Timestamp when earned
  tier?: number;                       // For tiered achievements (e.g., Bronze, Silver, Gold)
}

type AchievementId =
  | 'first_prompt'           // Used your first prompt
  | 'streak_7'               // 7-day streak
  | 'streak_30'              // 30-day streak
  | 'streak_100'             // 100-day streak
  | 'power_user_100'         // 100 total insertions
  | 'power_user_500'         // 500 total insertions
  | 'power_user_1000'        // 1000 total insertions
  | 'librarian_50'           // 50+ prompts in library
  | 'librarian_100'          // 100+ prompts
  | 'multi_platform'         // Used on all 5 platforms
  | 'category_master'        // Used prompts from 10+ categories
  | 'efficiency_pro';        // 50+ insertions in a week
```

#### 6. AnalyticsData (Storage Schema)
```typescript
/**
 * Complete analytics data structure stored in Chrome storage
 */
interface AnalyticsData {
  version: number;                     // Schema version (starts at 1)
  userStats: UserStats;
  dailyStats: Record<string, DailyStats>; // Last 30 days
  promptMetadata: Record<string, PromptUsageMetadata>; // All prompts
  recentEvents: UsageEvent[];          // Last 100 events for detailed views
}
```

### Storage Keys

```typescript
const STORAGE_KEYS = {
  ANALYTICS: 'analytics',              // AnalyticsData
  PROMPTS: 'prompts',                  // Existing prompts array
  CATEGORIES: 'categories',            // Existing categories
  SETTINGS: 'settings'                 // Existing settings
} as const;
```

---

## Implementation Phases

### Phase 1: Backend Infrastructure (Days 1-3)

#### Day 1: Data Layer
- [ ] **Task 1.1**: Create `src/types/analytics.ts` with all TypeScript interfaces
- [ ] **Task 1.2**: Create `src/services/analyticsManager.ts` (AnalyticsManager class)
- [ ] **Task 1.3**: Implement core methods:
  - `recordUsage(promptId, platform, timestamp)`
  - `getDailyStats(date)`
  - `getWeeklyStats()`
  - `getMonthlyStats()`
  - `calculateStreak()`
- [ ] **Task 1.4**: Add storage migration logic for existing users
- [ ] **Task 1.5**: Write unit tests for AnalyticsManager

**Files to Create/Modify:**
```
src/types/analytics.ts              (NEW - 150 lines)
src/services/analyticsManager.ts    (NEW - 400 lines)
src/services/__tests__/analyticsManager.test.ts (NEW - 200 lines)
```

#### Day 2: Integration with Content Scripts
- [ ] **Task 2.1**: Modify `src/content/core/insertion-manager.ts`
  - Add `recordUsage()` call after successful insertion
  - Pass promptId from selector to insertion manager
- [ ] **Task 2.2**: Update `src/content/core/injector.ts`
  - Pass promptId when user selects prompt
- [ ] **Task 2.3**: Add error handling for analytics failures (non-blocking)
- [ ] **Task 2.4**: Test on all 5 platforms (Claude, ChatGPT, Gemini, Mistral, Perplexity)

**Files to Modify:**
```
src/content/core/insertion-manager.ts  (±30 lines)
src/content/core/injector.ts           (±20 lines)
src/content/__tests__/insertion-manager.test.ts (±50 lines)
```

#### Day 3: Achievement System
- [ ] **Task 3.1**: Create `src/services/achievementEngine.ts`
- [ ] **Task 3.2**: Implement achievement checking logic
  - Check on every usage event
  - Unlock achievements atomically
- [ ] **Task 3.3**: Design achievement notification system
- [ ] **Task 3.4**: Write tests for achievement engine

**Files to Create:**
```
src/services/achievementEngine.ts              (NEW - 250 lines)
src/services/__tests__/achievementEngine.test.ts (NEW - 150 lines)
src/constants/achievements.ts                  (NEW - 100 lines)
```

---

### Phase 2: Frontend UI (Days 4-6)

#### Day 4: Stats Tab & Layout
- [ ] **Task 4.1**: Create `src/components/StatsView.tsx` (main container)
- [ ] **Task 4.2**: Add "Stats" tab to `src/App.tsx`
- [ ] **Task 4.3**: Create layout with sections:
  - Hero stats cards (Today, Week, Streak)
  - Weekly chart area
  - Top prompts list
  - Platform breakdown
- [ ] **Task 4.4**: Add loading states and error boundaries

**Files to Create/Modify:**
```
src/components/StatsView.tsx           (NEW - 300 lines)
src/App.tsx                            (±20 lines)
src/components/__tests__/StatsView.test.tsx (NEW - 150 lines)
```

#### Day 5: Stats Components
- [ ] **Task 5.1**: Create `src/components/stats/StatCard.tsx`
  - Display metric with change indicator
  - Support trend icons (up/down)
- [ ] **Task 5.2**: Create `src/components/stats/WeeklyChart.tsx`
  - Simple bar chart (last 7 days)
  - Interactive tooltips
- [ ] **Task 5.3**: Create `src/components/stats/TopPromptsList.tsx`
  - Top 5 most-used prompts
  - Show usage count and category
- [ ] **Task 5.4**: Create `src/components/stats/PlatformBreakdown.tsx`
  - Horizontal bar chart or donut chart
  - Platform icons with percentages

**Files to Create:**
```
src/components/stats/StatCard.tsx          (NEW - 100 lines)
src/components/stats/WeeklyChart.tsx       (NEW - 200 lines)
src/components/stats/TopPromptsList.tsx    (NEW - 150 lines)
src/components/stats/PlatformBreakdown.tsx (NEW - 180 lines)
```

#### Day 6: Achievements & Gamification UI
- [ ] **Task 6.1**: Create `src/components/stats/AchievementGrid.tsx`
  - Display unlocked and locked achievements
  - Progress bars for tiered achievements
- [ ] **Task 6.2**: Create `src/components/stats/StreakDisplay.tsx`
  - Visual streak counter with fire emoji
  - Motivational message
- [ ] **Task 6.3**: Create achievement toast notification
  - Trigger on unlock
  - Dismissible with animation
- [ ] **Task 6.4**: Add "Export Stats" and "Clear All Stats" buttons

**Files to Create:**
```
src/components/stats/AchievementGrid.tsx   (NEW - 250 lines)
src/components/stats/StreakDisplay.tsx     (NEW - 120 lines)
src/components/stats/AchievementToast.tsx  (NEW - 100 lines)
src/components/icons/AchievementIcons.tsx  (NEW - 150 lines)
```

---

### Phase 3: Polish & Testing (Days 7-8)

#### Day 7: Data Visualization & Polish
- [ ] **Task 7.1**: Refine chart components
  - Add responsive sizing
  - Improve color schemes (use design guidelines)
  - Add animations (transitions)
- [ ] **Task 7.2**: Create custom hook `src/hooks/useAnalytics.ts`
  - Encapsulate analytics data fetching
  - Handle loading and error states
- [ ] **Task 7.3**: Add empty states for new users
- [ ] **Task 7.4**: Implement export functionality (JSON/CSV)

**Files to Create/Modify:**
```
src/hooks/useAnalytics.ts                   (NEW - 150 lines)
src/hooks/__tests__/useAnalytics.test.ts    (NEW - 100 lines)
src/utils/analyticsExport.ts                (NEW - 100 lines)
```

#### Day 8: Comprehensive Testing
- [ ] **Task 8.1**: Write integration tests
  - Test full flow: insertion → storage → display
- [ ] **Task 8.2**: Test achievement unlocking
  - Verify all achievement triggers
  - Test notification display
- [ ] **Task 8.3**: Test data migration
  - Simulate upgrade from v1.5.0 → v1.6.0
- [ ] **Task 8.4**: Performance testing
  - Test with 1000+ events
  - Measure storage impact
  - Verify UI responsiveness
- [ ] **Task 8.5**: Manual QA on all platforms

**Test Files:**
```
src/test/integration/analytics.integration.test.ts (NEW - 200 lines)
src/test/performance/analytics.perf.test.ts        (NEW - 100 lines)
```

---

### Phase 4: Documentation & Release (Days 9-10)

#### Day 9: Documentation
- [ ] **Task 9.1**: Update `README.md`
  - Add analytics feature to features list
  - Update screenshots
- [ ] **Task 9.2**: Create `docs/ANALYTICS.md`
  - User guide for stats tab
  - Achievement reference
  - Privacy explanation
- [ ] **Task 9.3**: Update `ARCHITECTURE.md`
  - Add AnalyticsManager to system diagram
  - Document data flow
- [ ] **Task 9.4**: Update `CHANGELOG.md`

**Files to Create/Modify:**
```
README.md                  (±30 lines)
docs/ANALYTICS.md          (NEW - 200 lines)
docs/ARCHITECTURE.md       (±50 lines)
CHANGELOG.md               (±20 lines)
```

#### Day 10: Release Preparation
- [ ] **Task 10.1**: Update version to 1.6.0
  - `package.json`
  - `manifest.json`
- [ ] **Task 10.2**: Run full test suite
  - `npm test` (all 518+ tests + new tests)
  - `npm run lint`
- [ ] **Task 10.3**: Build and test production bundle
  - `npm run build`
  - Load in Chrome and verify
- [ ] **Task 10.4**: Create release package
  - `npm run package`
  - Test .zip file

---

## Technical Specifications

### AnalyticsManager Service

#### Core Methods

```typescript
export class AnalyticsManager {
  private static instance: AnalyticsManager | null = null;
  private storage: StorageManager;
  private operationQueue: Promise<void> = Promise.resolve();

  private constructor() {
    this.storage = StorageManager.getInstance();
  }

  static getInstance(): AnalyticsManager {
    if (!this.instance) {
      this.instance = new AnalyticsManager();
    }
    return this.instance;
  }

  /**
   * Record a prompt insertion event
   * @param promptId - ID of inserted prompt
   * @param platform - AI platform where inserted
   * @param timestamp - Optional timestamp (defaults to Date.now())
   */
  async recordUsage(
    promptId: string,
    platform: PlatformId,
    timestamp: number = Date.now()
  ): Promise<void> {
    return this._executeWithLock(async () => {
      const analytics = await this._getAnalytics();
      const event: UsageEvent = {
        id: crypto.randomUUID(),
        promptId,
        platform,
        timestamp
      };

      // Update recent events (keep last 100)
      analytics.recentEvents.unshift(event);
      if (analytics.recentEvents.length > 100) {
        analytics.recentEvents = analytics.recentEvents.slice(0, 100);
      }

      // Update daily stats
      const dateKey = this._formatDate(timestamp);
      await this._updateDailyStats(analytics, dateKey, event);

      // Update prompt metadata
      await this._updatePromptMetadata(analytics, event);

      // Update user stats
      await this._updateUserStats(analytics, dateKey);

      // Check achievements
      await this._checkAchievements(analytics);

      // Save to storage
      await this.storage.setAnalytics(analytics);
    });
  }

  /**
   * Get statistics for a specific date
   */
  async getDailyStats(date: string): Promise<DailyStats | null> {
    const analytics = await this._getAnalytics();
    return analytics.dailyStats[date] || null;
  }

  /**
   * Get aggregated stats for the last 7 days
   */
  async getWeeklyStats(): Promise<WeeklyStats> {
    const analytics = await this._getAnalytics();
    const today = new Date();
    const weekData: DailyStats[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = this._formatDate(date.getTime());
      const dayStats = analytics.dailyStats[dateKey];

      if (dayStats) {
        weekData.push(dayStats);
      } else {
        // Fill in missing days with zero data
        weekData.push(this._createEmptyDayStats(dateKey));
      }
    }

    return this._aggregateWeeklyStats(weekData);
  }

  /**
   * Get top N most-used prompts
   */
  async getTopPrompts(limit: number = 5): Promise<TopPrompt[]> {
    const analytics = await this._getAnalytics();
    const promptMetadata = Object.values(analytics.promptMetadata);

    // Sort by total uses
    const sorted = promptMetadata.sort((a, b) => b.totalUses - a.totalUses);

    // Get prompt details
    const prompts = await this.storage.getPrompts();
    const topPrompts: TopPrompt[] = [];

    for (let i = 0; i < Math.min(limit, sorted.length); i++) {
      const metadata = sorted[i];
      const prompt = prompts.find(p => p.id === metadata.promptId);

      if (prompt) {
        topPrompts.push({
          prompt,
          usageCount: metadata.totalUses,
          lastUsedAt: metadata.lastUsedAt,
          platforms: Object.keys(metadata.platformBreakdown) as PlatformId[]
        });
      }
    }

    return topPrompts;
  }

  /**
   * Calculate current usage streak
   */
  async calculateStreak(): Promise<number> {
    const analytics = await this._getAnalytics();
    return analytics.userStats.currentStreak;
  }

  /**
   * Get all user stats including achievements
   */
  async getUserStats(): Promise<UserStats> {
    const analytics = await this._getAnalytics();
    return analytics.userStats;
  }

  /**
   * Export all analytics data as JSON
   */
  async exportData(): Promise<string> {
    const analytics = await this._getAnalytics();
    return JSON.stringify(analytics, null, 2);
  }

  /**
   * Clear all analytics data (requires confirmation)
   */
  async clearAllData(): Promise<void> {
    await this.storage.setAnalytics(this._createEmptyAnalytics());
  }

  // Private helper methods...
  private async _executeWithLock<T>(operation: () => Promise<T>): Promise<T> {
    const previousOperation = this.operationQueue;
    let resolver: () => void;
    this.operationQueue = new Promise(resolve => { resolver = resolve; });

    await previousOperation;
    try {
      return await operation();
    } finally {
      resolver!();
    }
  }

  private async _getAnalytics(): Promise<AnalyticsData> {
    const data = await this.storage.getAnalytics();
    if (!data) {
      return this._createEmptyAnalytics();
    }
    return data;
  }

  private _createEmptyAnalytics(): AnalyticsData {
    return {
      version: 1,
      userStats: {
        totalInsertions: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: '',
        achievements: [],
        startDate: this._formatDate(Date.now())
      },
      dailyStats: {},
      promptMetadata: {},
      recentEvents: []
    };
  }

  private _formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
  }

  private async _updateDailyStats(
    analytics: AnalyticsData,
    dateKey: string,
    event: UsageEvent
  ): Promise<void> {
    if (!analytics.dailyStats[dateKey]) {
      analytics.dailyStats[dateKey] = {
        date: dateKey,
        totalInsertions: 0,
        uniquePromptsUsed: [],
        platformBreakdown: {},
        categoryBreakdown: {},
        topPrompts: []
      };
    }

    const dayStats = analytics.dailyStats[dateKey];
    dayStats.totalInsertions++;

    // Track unique prompts
    if (!dayStats.uniquePromptsUsed.includes(event.promptId)) {
      dayStats.uniquePromptsUsed.push(event.promptId);
    }

    // Update platform breakdown
    dayStats.platformBreakdown[event.platform] =
      (dayStats.platformBreakdown[event.platform] || 0) + 1;

    // Cleanup old data (keep last 30 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffKey = this._formatDate(cutoffDate.getTime());

    Object.keys(analytics.dailyStats).forEach(key => {
      if (key < cutoffKey) {
        delete analytics.dailyStats[key];
      }
    });
  }

  private async _updatePromptMetadata(
    analytics: AnalyticsData,
    event: UsageEvent
  ): Promise<void> {
    if (!analytics.promptMetadata[event.promptId]) {
      analytics.promptMetadata[event.promptId] = {
        promptId: event.promptId,
        totalUses: 0,
        lastUsedAt: 0,
        firstUsedAt: event.timestamp,
        platformBreakdown: {},
        usageByDay: {}
      };
    }

    const metadata = analytics.promptMetadata[event.promptId];
    metadata.totalUses++;
    metadata.lastUsedAt = event.timestamp;

    // Update platform breakdown
    metadata.platformBreakdown[event.platform] =
      (metadata.platformBreakdown[event.platform] || 0) + 1;

    // Update daily usage
    const dateKey = this._formatDate(event.timestamp);
    metadata.usageByDay[dateKey] = (metadata.usageByDay[dateKey] || 0) + 1;
  }

  private async _updateUserStats(
    analytics: AnalyticsData,
    dateKey: string
  ): Promise<void> {
    analytics.userStats.totalInsertions++;
    analytics.userStats.lastActivityDate = dateKey;

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = this._formatDate(yesterday.getTime());

    if (analytics.userStats.lastActivityDate === yesterdayKey) {
      // Streak continues
      analytics.userStats.currentStreak++;
    } else if (analytics.userStats.lastActivityDate !== dateKey) {
      // Streak broken (not today and not yesterday)
      analytics.userStats.currentStreak = 1;
    }

    // Update longest streak
    if (analytics.userStats.currentStreak > analytics.userStats.longestStreak) {
      analytics.userStats.longestStreak = analytics.userStats.currentStreak;
    }
  }

  private async _checkAchievements(analytics: AnalyticsData): Promise<void> {
    // Check and unlock achievements
    // This will be implemented in AchievementEngine
  }
}
```

### StorageManager Extensions

Add analytics methods to `src/services/storage.ts`:

```typescript
// Add to StorageManager class

async getAnalytics(): Promise<AnalyticsData | null> {
  return this.executeWithLock(async () => {
    const data = await this.chrome.storage.local.get('analytics');
    return data.analytics || null;
  });
}

async setAnalytics(analytics: AnalyticsData): Promise<void> {
  return this.executeWithLock(async () => {
    await this.chrome.storage.local.set({ analytics });
  });
}
```

---

## UI/UX Design

### StatsView Component Layout

```tsx
// src/components/StatsView.tsx
import { FC, useMemo } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { StatCard } from './stats/StatCard';
import { WeeklyChart } from './stats/WeeklyChart';
import { TopPromptsList } from './stats/TopPromptsList';
import { PlatformBreakdown } from './stats/PlatformBreakdown';
import { StreakDisplay } from './stats/StreakDisplay';
import { AchievementGrid } from './stats/AchievementGrid';

const StatsView: FC = () => {
  const {
    userStats,
    weeklyStats,
    topPrompts,
    platformStats,
    loading,
    error
  } = useAnalytics();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="shrink-0 p-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xs border-b border-purple-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-linear-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" /* Chart icon */ />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Usage Statistics
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track your prompt library activity
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Streak Display */}
        <StreakDisplay
          currentStreak={userStats.currentStreak}
          longestStreak={userStats.longestStreak}
        />

        {/* Hero Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            title="Today"
            value={weeklyStats.todayCount}
            change={weeklyStats.todayVsYesterday}
            trend={weeklyStats.todayVsYesterday > 0 ? 'up' : 'down'}
          />
          <StatCard
            title="This Week"
            value={weeklyStats.totalThisWeek}
            subtitle={`${weeklyStats.uniquePromptsThisWeek} unique prompts`}
          />
          <StatCard
            title="All Time"
            value={userStats.totalInsertions}
            subtitle="Total insertions"
          />
        </div>

        {/* Weekly Chart */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xs border border-purple-100 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Last 7 Days Activity
          </h3>
          <WeeklyChart data={weeklyStats.dailyData} />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Prompts */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xs border border-purple-100 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Most Used Prompts
            </h3>
            <TopPromptsList prompts={topPrompts} />
          </div>

          {/* Platform Breakdown */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xs border border-purple-100 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Platform Usage
            </h3>
            <PlatformBreakdown stats={platformStats} />
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xs border border-purple-100 dark:border-gray-700 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Achievements
          </h3>
          <AchievementGrid achievements={userStats.achievements} />
        </div>

        {/* Export/Clear Actions */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-700/60 backdrop-blur-xs border border-purple-200 dark:border-gray-600 rounded-xl hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all duration-200 focus-secondary"
          >
            Export Stats
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-white/60 dark:bg-gray-700/60 backdrop-blur-xs border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 focus-danger"
          >
            Clear All Stats
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsView;
```

### Visual Design Examples

#### Streak Display
```tsx
<div className="bg-linear-to-r from-orange-500 to-red-500 rounded-xl p-5 shadow-lg">
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-4">
      <span className="text-6xl">🔥</span>
      <div>
        <div className="flex items-baseline space-x-2">
          <span className="text-4xl font-bold text-white">{currentStreak}</span>
          <span className="text-lg text-white/80">days</span>
        </div>
        <p className="text-white/90 text-sm mt-1">Current Streak</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-white/80 text-xs">Best Streak</p>
      <p className="text-white text-2xl font-bold">{longestStreak} days</p>
    </div>
  </div>
  {currentStreak >= 7 && (
    <p className="text-white/90 text-sm mt-3">
      🎉 Amazing! Keep the momentum going!
    </p>
  )}
</div>
```

#### Stat Card
```tsx
<div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xs border border-purple-100 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-all duration-200">
  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
    {title}
  </p>
  <div className="mt-2 flex items-baseline">
    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
      {value}
    </p>
    {change !== undefined && (
      <span className={`ml-2 text-sm font-medium ${
        trend === 'up'
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-600 dark:text-red-400'
      }`}>
        {trend === 'up' ? '↑' : '↓'} {Math.abs(change)}
      </span>
    )}
  </div>
  {subtitle && (
    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
      {subtitle}
    </p>
  )}
</div>
```

#### Achievement Badge
```tsx
<div className={`
  relative group
  bg-white/70 dark:bg-gray-800/70 backdrop-blur-xs
  border-2 rounded-xl p-4
  transition-all duration-200
  ${unlocked
    ? 'border-purple-300 dark:border-purple-600 hover:shadow-lg'
    : 'border-gray-200 dark:border-gray-700 opacity-50'
  }
`}>
  <div className="flex flex-col items-center text-center">
    <span className={`text-4xl mb-2 ${unlocked ? '' : 'grayscale'}`}>
      {icon}
    </span>
    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
      {name}
    </h4>
    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
      {description}
    </p>
    {unlocked && unlockedAt && (
      <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
        Unlocked {formatDate(unlockedAt)}
      </p>
    )}
  </div>
</div>
```

---

## Testing Strategy

### Unit Tests

**Target Coverage: 80%+ for new code**

#### Test Suites

1. **AnalyticsManager Tests** (`src/services/__tests__/analyticsManager.test.ts`)
```typescript
describe('AnalyticsManager', () => {
  describe('recordUsage', () => {
    it('should create new usage event', async () => { });
    it('should update daily stats', async () => { });
    it('should update prompt metadata', async () => { });
    it('should increment user stats', async () => { });
    it('should handle concurrent calls with mutex', async () => { });
  });

  describe('calculateStreak', () => {
    it('should start streak at 1 on first usage', async () => { });
    it('should increment streak on consecutive days', async () => { });
    it('should reset streak after gap', async () => { });
    it('should handle same-day multiple uses', async () => { });
  });

  describe('getTopPrompts', () => {
    it('should return top 5 by usage count', async () => { });
    it('should handle empty data', async () => { });
    it('should include platform breakdown', async () => { });
  });

  // 20+ tests total
});
```

2. **AchievementEngine Tests** (`src/services/__tests__/achievementEngine.test.ts`)
```typescript
describe('AchievementEngine', () => {
  describe('checkAchievements', () => {
    it('should unlock first_prompt achievement', async () => { });
    it('should unlock streak achievements at correct thresholds', async () => { });
    it('should not re-unlock existing achievements', async () => { });
    it('should unlock power_user tiers progressively', async () => { });
  });

  // 15+ tests total
});
```

3. **Component Tests**
```typescript
describe('StatsView', () => {
  it('should render loading state', () => { });
  it('should display user stats correctly', () => { });
  it('should handle export action', () => { });
  it('should handle clear action with confirmation', () => { });
});

describe('WeeklyChart', () => {
  it('should render bars for each day', () => { });
  it('should show tooltips on hover', () => { });
  it('should handle empty data', () => { });
});

// 30+ component tests total
```

### Integration Tests

```typescript
// src/test/integration/analytics.integration.test.ts
describe('Analytics Integration', () => {
  it('should track usage from content script to storage', async () => {
    // Simulate prompt insertion
    await insertionManager.insertContent(element, content, promptId);

    // Verify analytics recorded
    const stats = await analyticsManager.getUserStats();
    expect(stats.totalInsertions).toBe(1);
  });

  it('should unlock achievement after threshold', async () => {
    // Record 100 usages
    for (let i = 0; i < 100; i++) {
      await analyticsManager.recordUsage('prompt1', 'claude');
    }

    const stats = await analyticsManager.getUserStats();
    const powerUser = stats.achievements.find(a => a.id === 'power_user_100');
    expect(powerUser).toBeDefined();
  });

  // 10+ integration tests
});
```

### Manual QA Checklist

- [ ] **Stats Tab Loads**: Verify tab appears and loads data
- [ ] **Real-time Updates**: Insert prompt, verify stats increment immediately
- [ ] **Streak Calculation**: Test across day boundaries
- [ ] **Achievement Unlocking**: Trigger each achievement type
- [ ] **Export Functionality**: Download JSON/CSV, verify contents
- [ ] **Clear Stats**: Confirm deletion with warning
- [ ] **Dark Mode**: All charts and badges render correctly
- [ ] **Empty States**: New user sees helpful empty state
- [ ] **Performance**: Smooth with 1000+ events
- [ ] **Cross-Platform**: Test on all 5 AI platforms

---

## Privacy & Security

### Privacy Guarantees

1. **Local-Only Storage**: All analytics data in `chrome.storage.local`
2. **No External Transmission**: Zero network requests for analytics
3. **User Control**: Export and delete functionality
4. **Transparent UI**: Clear explanation of what's tracked

### Privacy Notice UI

Add to Settings or Stats tab:

```tsx
<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
  <div className="flex items-start">
    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" /* Info icon */ />
    <div className="ml-3">
      <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
        Privacy First
      </h4>
      <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
        All usage statistics are stored locally on your device.
        No data is transmitted to external servers or shared with third parties.
      </p>
      <div className="mt-3 flex space-x-3">
        <button onClick={handleExport} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Export My Data
        </button>
        <button onClick={handleClear} className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline">
          Delete All Stats
        </button>
      </div>
    </div>
  </div>
</div>
```

### Security Considerations

1. **Input Validation**: Validate all promptId and platform values
2. **Storage Quota**: Monitor and warn at 80% usage
3. **Error Handling**: Non-blocking failures (analytics doesn't break core functionality)
4. **Sanitization**: DOMPurify for any user-facing display of prompt titles

---

## Performance Considerations

### Storage Impact

**Current Storage (v1.5.0):**
- 100 prompts: ~5KB
- 20 categories: ~1KB
- Settings: ~2KB
- **Total: ~8KB**

**New Analytics Data (v1.6.0):**
- 30 days of daily stats: ~10KB
- 100 prompt metadata: ~5KB
- 100 recent events: ~3KB
- User stats + achievements: ~1KB
- **Analytics Total: ~19KB**

**Combined Total: ~27KB** (0.27% of 10MB quota)

### Optimization Strategies

1. **Data Pruning**
   - Keep detailed stats for last 30 days only
   - Aggregate older data into monthly summaries
   - Limit recent events to last 100

2. **Lazy Loading**
   - Don't load analytics data on popup open
   - Load only when Stats tab is clicked
   - Cache in memory during session

3. **Debouncing**
   - Batch rapid insertions (e.g., testing) into single update
   - Update UI every 500ms instead of instantly

4. **Indexed Queries**
   - Pre-calculate top prompts on write (not on read)
   - Cache streak calculation until next day

### Performance Targets

- **Recording Usage**: <10ms (non-blocking)
- **Loading Stats Tab**: <200ms
- **Chart Rendering**: <100ms
- **Achievement Check**: <5ms
- **Export Data**: <500ms

---

## Migration Strategy

### Version 1.5.0 → 1.6.0 Migration

**Challenge**: Existing users have no analytics data, newly installed users start fresh.

**Solution**: Initialize analytics on first use of v1.6.0

```typescript
// src/services/analyticsManager.ts
private async _initializeAnalytics(): Promise<void> {
  const existing = await this.storage.getAnalytics();

  if (!existing) {
    // First time initialization
    const analytics: AnalyticsData = {
      version: 1,
      userStats: {
        totalInsertions: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: '',
        achievements: [],
        startDate: this._formatDate(Date.now())
      },
      dailyStats: {},
      promptMetadata: {},
      recentEvents: []
    };

    await this.storage.setAnalytics(analytics);

    Logger.info('Analytics initialized for new user', {
      component: 'AnalyticsManager',
      version: analytics.version
    });
  } else if (existing.version < 1) {
    // Handle future schema migrations
    await this._migrateAnalytics(existing);
  }
}
```

### Backward Compatibility

- **No Breaking Changes**: Extension works identically for users who never open Stats tab
- **Graceful Degradation**: If analytics fails, prompt insertion still works
- **Opt-out**: Users can clear stats and never use the feature

---

## Future Enhancements (v1.7+)

### Advanced Analytics

1. **Time-of-Day Analysis**
   - Heatmap showing most productive hours
   - "You use prompts most between 2-4 PM"

2. **Category Insights**
   - Most-used categories
   - Underutilized categories (suggest archiving)

3. **Efficiency Metrics**
   - Average characters saved per prompt
   - Time saved estimate (based on typing speed)

4. **Trend Detection**
   - "Your usage increased 30% this month"
   - "You're using Claude more often lately"

### Gamification Enhancements

1. **Challenges**
   - "Use 20 different prompts this week"
   - "Try prompts on all 5 platforms"

2. **Leaderboard** (Optional, Opt-in)
   - Anonymous comparison with other users
   - Requires backend service (future consideration)

3. **Custom Goals**
   - User-defined usage targets
   - Progress tracking and notifications

4. **Sharing**
   - Export stats as shareable image
   - "I saved 10 hours this month with My Prompt Manager!"

### Advanced Visualizations

1. **Monthly Calendar Heatmap** (GitHub-style)
2. **Category Sunburst Chart**
3. **Platform Usage Timeline**
4. **Prompt Evolution Graph** (shows which prompts replaced others)

---

## Risk Mitigation

### Potential Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Storage quota exceeded | High | Low | Monitor usage, cleanup old data, warn user |
| Performance degradation | Medium | Low | Optimize queries, lazy loading, debouncing |
| Analytics breaks core feature | High | Very Low | Non-blocking errors, comprehensive testing |
| User privacy concerns | Medium | Low | Transparent UI, local-only, easy deletion |
| Inaccurate streak calculation | Low | Medium | Thorough testing, timezone handling |

### Rollback Plan

If critical issues arise post-release:

1. **Quick Fix**: Disable analytics recording via feature flag
2. **Data Integrity**: Export user analytics before fix
3. **Patch Release**: v1.6.1 with bug fixes
4. **Communication**: Update Chrome Web Store listing with known issues

---

## Success Criteria

### Definition of Done

- [ ] All 6 tasks in Phase 1-4 completed
- [ ] 80%+ test coverage for new code
- [ ] All 518+ existing tests still passing
- [ ] Manual QA checklist 100% complete
- [ ] Documentation updated (README, ARCHITECTURE, new ANALYTICS.md)
- [ ] No ESLint errors or warnings
- [ ] Production build size <5% increase
- [ ] Load tested with 1000+ events

### Launch Checklist

- [ ] Version bumped to 1.6.0
- [ ] CHANGELOG.md updated
- [ ] Chrome Web Store listing updated with new feature
- [ ] Screenshots updated to show Stats tab
- [ ] Privacy policy reviewed (no changes needed)
- [ ] Release notes drafted
- [ ] Package created: `prompt-library-extension-v1.6.0.zip`

---

## Timeline Summary

| Phase | Days | Key Deliverables |
|-------|------|------------------|
| **Phase 1: Backend** | 3 | AnalyticsManager, tracking integration, achievements |
| **Phase 2: Frontend** | 3 | StatsView, charts, components |
| **Phase 3: Polish** | 2 | Testing, visualization, export |
| **Phase 4: Release** | 2 | Documentation, QA, packaging |
| **Total** | **10 days** | Feature-complete v1.6.0 |

**Accelerated Timeline (MVP):** 7 days by reducing achievement system complexity

---

## Appendix

### A. Storage Schema Example

```json
{
  "analytics": {
    "version": 1,
    "userStats": {
      "totalInsertions": 247,
      "currentStreak": 5,
      "longestStreak": 12,
      "lastActivityDate": "2025-10-11",
      "achievements": [
        { "id": "first_prompt", "unlockedAt": 1696118400000 },
        { "id": "streak_7", "unlockedAt": 1697328000000 },
        { "id": "power_user_100", "unlockedAt": 1697846400000 }
      ],
      "startDate": "2025-09-01"
    },
    "dailyStats": {
      "2025-10-11": {
        "date": "2025-10-11",
        "totalInsertions": 12,
        "uniquePromptsUsed": ["p1", "p2", "p5"],
        "platformBreakdown": {
          "claude": 7,
          "chatgpt": 5
        },
        "categoryBreakdown": {
          "coding": 8,
          "writing": 4
        },
        "topPrompts": [
          { "promptId": "p1", "count": 5 },
          { "promptId": "p2", "count": 3 }
        ]
      }
    },
    "promptMetadata": {
      "p1": {
        "promptId": "p1",
        "totalUses": 47,
        "lastUsedAt": 1697846400000,
        "firstUsedAt": 1696118400000,
        "platformBreakdown": {
          "claude": 30,
          "chatgpt": 17
        },
        "usageByDay": {
          "2025-10-11": 5,
          "2025-10-10": 3
        }
      }
    },
    "recentEvents": [
      {
        "id": "evt-123",
        "promptId": "p1",
        "platform": "claude",
        "timestamp": 1697846400000
      }
    ]
  }
}
```

### B. Achievement Reference

| ID | Name | Description | Unlock Criteria |
|----|------|-------------|-----------------|
| `first_prompt` | 🎯 First Steps | Used your first prompt | 1 insertion |
| `streak_7` | 🔥 Week Warrior | 7-day streak | 7 consecutive days |
| `streak_30` | 🔥 Month Master | 30-day streak | 30 consecutive days |
| `streak_100` | 🔥 Century Club | 100-day streak | 100 consecutive days |
| `power_user_100` | ⚡ Power User (Bronze) | 100 total insertions | 100 total |
| `power_user_500` | ⚡ Power User (Silver) | 500 total insertions | 500 total |
| `power_user_1000` | ⚡ Power User (Gold) | 1000 total insertions | 1000 total |
| `librarian_50` | 📚 Librarian (Bronze) | 50+ prompts in library | 50 prompts |
| `librarian_100` | 📚 Librarian (Silver) | 100+ prompts in library | 100 prompts |
| `multi_platform` | 🌍 Multi-Platform User | Used on all 5 platforms | All platforms used |
| `efficiency_pro` | 🏆 Efficiency Pro | 50+ insertions in a week | 50 weekly |

### C. Chart Libraries Evaluation

**Decision: Build Custom Charts (Recommended)**

**Rationale:**
- Tailwind CSS + SVG provides full control
- No additional dependencies (keeps bundle small)
- Easier to match design guidelines
- Better dark mode integration

**Alternative:** If custom proves too complex
- **Recharts** (React-friendly, 20KB gzipped)
- **Chart.js** (Popular, but vanilla JS integration needed)

---

**End of Implementation Plan**

**Next Steps:**
1. Review and approve this plan
2. Create GitHub issue for v1.6.0 milestone
3. Begin Phase 1 implementation
4. Schedule daily standup check-ins

**Questions? Concerns?** Please discuss before starting implementation.

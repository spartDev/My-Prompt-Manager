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
  mostActivePlatform: { name: string; count: number; percentage: number } | null;
  weeklyActivity: { day: string; count: number }[];
  platformDistribution: { platform: string; count: number; percentage: number }[];
  categoryBreakdown: { categoryId: string; name: string; count: number }[];
}

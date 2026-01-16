import type { Category, Prompt, Settings } from '../../../src/types';
import { DEFAULT_CATEGORY, DEFAULT_SETTINGS, USAGE_STORAGE_KEY } from '../../../src/types';
import type { ExtensionStorage } from '../fixtures/extension';

// Usage Event types for E2E tests
export interface UsageEvent {
  promptId: string;
  timestamp: number;
  platform: string;
  categoryId: string | null;
}

type UsageEventOverrides = Partial<UsageEvent>;

type CreateUsageHistoryOptions = {
  /**
   * Start timestamp for generating events (defaults to 30 days ago)
   */
  startTimestamp?: number;
  /**
   * End timestamp for generating events (defaults to now)
   */
  endTimestamp?: number;
  /**
   * List of prompt IDs to randomly select from
   */
  promptIds?: string[];
  /**
   * List of platforms to randomly select from
   */
  platforms?: string[];
  /**
   * List of category IDs to randomly select from (null for uncategorized)
   */
  categoryIds?: (string | null)[];
};

type SeedOptions = {
  prompts?: Prompt[];
  categories?: Category[];
  settings?: Partial<Settings>;
  interfaceMode?: Settings['interfaceMode'];
};

export const createPromptSeed = (overrides: Partial<Prompt>): Prompt => {
  const now = Date.now();
  const createdAt = overrides.createdAt ?? now;
  const updatedAt = overrides.updatedAt ?? createdAt;
  const usageCount = overrides.usageCount ?? 0;

  // Match normalizePrompt logic: lastUsedAt depends on usageCount
  // If usageCount === 0: lastUsedAt defaults to createdAt
  // If usageCount > 0: lastUsedAt defaults to updatedAt
  const defaultLastUsedAt = usageCount > 0 ? updatedAt : createdAt;

  return {
    id: overrides.id ?? `prompt-${Math.random().toString(36).slice(2, 10)}`,
    title: overrides.title ?? 'Sample Prompt',
    content: overrides.content ?? 'Sample prompt content',
    category: overrides.category ?? DEFAULT_CATEGORY,
    createdAt,
    updatedAt,
    usageCount,
    lastUsedAt: overrides.lastUsedAt ?? defaultLastUsedAt,
  };
};

export const createCategorySeed = (overrides: Partial<Category>): Category => ({
  id: overrides.id ?? `category-${Math.random().toString(36).slice(2, 10)}`,
  name: overrides.name ?? DEFAULT_CATEGORY,
  color: overrides.color,
});

const ensureDefaultCategory = (categories: Category[]): Category[] => {
  const hasDefault = categories.some((category) => category.name === DEFAULT_CATEGORY);
  return hasDefault
    ? categories
    : [
        {
          id: 'default-category',
          name: DEFAULT_CATEGORY,
        },
        ...categories,
      ];
};

export const seedLibrary = async (
  storage: ExtensionStorage,
  options: SeedOptions = {}
): Promise<void> => {
  const categories = ensureDefaultCategory(options.categories ?? []);
  const prompts = options.prompts ?? [];
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    interfaceMode: 'popup',
    ...options.settings,
  };

  await storage.seed({
    prompts,
    categories,
    settings,
    interfaceMode: options.interfaceMode ?? settings.interfaceMode,
  });
};

// Default platforms supported by the extension
const DEFAULT_PLATFORMS = ['claude', 'chatgpt', 'gemini', 'perplexity', 'copilot', 'mistral'];

/**
 * Create a single usage event with optional overrides
 */
export const createUsageEventSeed = (overrides: UsageEventOverrides = {}): UsageEvent => {
  return {
    promptId: overrides.promptId ?? `prompt-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: overrides.timestamp ?? Date.now(),
    platform: overrides.platform ?? DEFAULT_PLATFORMS[Math.floor(Math.random() * DEFAULT_PLATFORMS.length)],
    categoryId: overrides.categoryId !== undefined ? overrides.categoryId : null,
  };
};

/**
 * Create multiple usage events distributed across a time range
 */
export const createUsageHistory = (
  count: number,
  options: CreateUsageHistoryOptions = {}
): UsageEvent[] => {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const startTimestamp = options.startTimestamp ?? thirtyDaysAgo;
  const endTimestamp = options.endTimestamp ?? now;
  const promptIds = options.promptIds ?? [`prompt-${Math.random().toString(36).slice(2, 10)}`];
  const platforms = options.platforms ?? DEFAULT_PLATFORMS;
  const categoryIds = options.categoryIds ?? [null];

  const events: UsageEvent[] = [];
  const timeRange = endTimestamp - startTimestamp;

  for (let i = 0; i < count; i++) {
    // Distribute events across the time range
    const timestamp = startTimestamp + Math.floor(Math.random() * timeRange);

    events.push({
      promptId: promptIds[Math.floor(Math.random() * promptIds.length)],
      timestamp,
      platform: platforms[Math.floor(Math.random() * platforms.length)],
      categoryId: categoryIds[Math.floor(Math.random() * categoryIds.length)],
    });
  }

  // Sort by timestamp (newest first) to match getHistory() behavior
  return events.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Seed usage history into Chrome storage
 */
export const seedUsageHistory = async (
  storage: ExtensionStorage,
  events: UsageEvent[]
): Promise<void> => {
  await storage.seed({ [USAGE_STORAGE_KEY]: events });
};

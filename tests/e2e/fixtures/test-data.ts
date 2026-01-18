/**
 * Standardized test data fixtures for E2E tests
 *
 * This module provides reusable test data sets that can be used across
 * multiple test files to ensure consistency and reduce duplication.
 */

import { DEFAULT_SETTINGS, UsageEvent } from '../../../src/types';
import { createPromptSeed, createCategorySeed } from '../utils/storage';

/**
 * Helper to create a usage event with defaults
 */
export const createUsageEventSeed = (overrides: Partial<UsageEvent>): UsageEvent => ({
  promptId: overrides.promptId ?? `prompt-${Math.random().toString(36).slice(2, 10)}`,
  timestamp: overrides.timestamp ?? Date.now(),
  platform: overrides.platform ?? 'claude',
  categoryId: overrides.categoryId ?? null,
});

/**
 * Standard color palette for categories
 */
export const CATEGORY_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
] as const;

/**
 * Standard category fixtures organized by use case
 */
export const CATEGORY_FIXTURES = {
  /**
   * Empty - no custom categories
   */
  EMPTY: [],

  /**
   * Basic set for simple testing scenarios
   */
  BASIC: [
    createCategorySeed({ name: 'Work', color: CATEGORY_COLORS[0] }),
    createCategorySeed({ name: 'Personal', color: CATEGORY_COLORS[1] }),
  ],

  /**
   * Comprehensive set for complex testing scenarios
   */
  COMPREHENSIVE: [
    createCategorySeed({ name: 'Work', color: CATEGORY_COLORS[0] }),
    createCategorySeed({ name: 'Personal', color: CATEGORY_COLORS[1] }),
    createCategorySeed({ name: 'Development', color: CATEGORY_COLORS[2] }),
    createCategorySeed({ name: 'Marketing', color: CATEGORY_COLORS[3] }),
    createCategorySeed({ name: 'Research', color: CATEGORY_COLORS[4] }),
  ],

  /**
   * Single custom category for focused testing
   */
  SINGLE_CUSTOM: [
    createCategorySeed({ name: 'Custom Category', color: CATEGORY_COLORS[5] }),
  ],

  /**
   * Categories for testing edge cases
   */
  EDGE_CASES: [
    createCategorySeed({ name: 'Very Long Category Name That Tests UI Limits', color: CATEGORY_COLORS[0] }),
    createCategorySeed({ name: 'A', color: CATEGORY_COLORS[1] }), // Single character
    createCategorySeed({ name: '123 Numbers', color: CATEGORY_COLORS[2] }),
    createCategorySeed({ name: 'Special!@#$%^&*()Characters', color: CATEGORY_COLORS[3] }),
  ],
} as const;

/**
 * Standard prompt fixtures organized by use case
 */
export const PROMPT_FIXTURES = {
  /**
   * Empty - no prompts
   */
  EMPTY: [],

  /**
   * Single prompt for minimal testing
   */
  SINGLE: [
    createPromptSeed({
      title: 'Test Prompt',
      content: 'This is a test prompt for basic scenarios',
      category: 'Uncategorized',
    }),
  ],

  /**
   * Basic set for simple workflows
   */
  BASIC_SET: [
    createPromptSeed({
      title: 'Email Summary',
      content: 'Summarize the key points from this email in bullet format',
      category: 'Work',
    }),
    createPromptSeed({
      title: 'Creative Writing Helper',
      content: 'Help me start a creative writing piece about...',
      category: 'Personal',
    }),
  ],

  /**
   * Power user data set for comprehensive testing
   */
  POWER_USER: [
    // Work category prompts (5)
    createPromptSeed({
      title: 'Meeting Summary Template',
      content: 'Please provide a structured summary of this meeting including key decisions, action items, and next steps.',
      category: 'Work',
    }),
    createPromptSeed({
      title: 'Project Status Update',
      content: 'Create a project status update including progress, blockers, and timeline adjustments.',
      category: 'Work',
    }),
    createPromptSeed({
      title: 'Performance Review Notes',
      content: 'Help me organize thoughts for performance review discussions.',
      category: 'Work',
    }),
    createPromptSeed({
      title: 'Client Proposal Draft',
      content: 'Draft a professional proposal outline for client presentation.',
      category: 'Work',
    }),
    createPromptSeed({
      title: 'Team Communication',
      content: 'Improve team communication and collaboration strategies.',
      category: 'Work',
    }),

    // Development category prompts (3)
    createPromptSeed({
      title: 'Code Review Checklist',
      content: 'Provide a comprehensive code review checklist for this pull request.',
      category: 'Development',
    }),
    createPromptSeed({
      title: 'API Documentation',
      content: 'Generate documentation for this API endpoint including examples.',
      category: 'Development',
    }),
    createPromptSeed({
      title: 'Database Query Optimizer',
      content: 'Help optimize this database query for better performance.',
      category: 'Development',
    }),

    // Marketing category prompts (2)
    createPromptSeed({
      title: 'Campaign Analysis',
      content: 'Analyze the performance of this marketing campaign and suggest improvements.',
      category: 'Marketing',
    }),
    createPromptSeed({
      title: 'Social Media Content',
      content: 'Create engaging social media content for our brand voice.',
      category: 'Marketing',
    }),

    // Research category prompts (4)
    createPromptSeed({
      title: 'Literature Review Helper',
      content: 'Help organize and synthesize findings from multiple research papers.',
      category: 'Research',
    }),
    createPromptSeed({
      title: 'Data Analysis Summary',
      content: 'Summarize key insights from this dataset analysis.',
      category: 'Research',
    }),
    createPromptSeed({
      title: 'Research Methodology',
      content: 'Suggest appropriate research methodologies for this study.',
      category: 'Research',
    }),
    createPromptSeed({
      title: 'Citation Generator',
      content: 'Generate proper citations for these research sources.',
      category: 'Research',
    }),

    // Personal category prompts (3)
    createPromptSeed({
      title: 'Travel Planning',
      content: 'Help plan a detailed itinerary for my upcoming trip.',
      category: 'Personal',
    }),
    createPromptSeed({
      title: 'Recipe Suggestions',
      content: 'Suggest healthy recipes based on available ingredients.',
      category: 'Personal',
    }),
    createPromptSeed({
      title: 'Book Recommendations',
      content: 'Recommend books based on my reading preferences and mood.',
      category: 'Personal',
    }),
  ],

  /**
   * Search-focused test data for testing search and filter functionality
   */
  SEARCH_TEST_SET: [
    createPromptSeed({
      title: 'JavaScript Debug Helper',
      content: 'Help me debug this JavaScript code and find the issue.',
      category: 'Development',
    }),
    createPromptSeed({
      title: 'Python Code Review',
      content: 'Review this Python function for improvements and best practices.',
      category: 'Development',
    }),
    createPromptSeed({
      title: 'React Component Design',
      content: 'Design a reusable React component with proper TypeScript types.',
      category: 'Development',
    }),
    createPromptSeed({
      title: 'Database Query Optimization',
      content: 'Optimize this SQL query for better performance.',
      category: 'Development',
    }),
    createPromptSeed({
      title: 'API Error Handling',
      content: 'Implement robust error handling for this API endpoint.',
      category: 'Development',
    }),
    createPromptSeed({
      title: 'Code Documentation',
      content: 'Generate comprehensive documentation for this codebase.',
      category: 'Development',
    }),
  ],

  /**
   * Edge case prompts for testing UI limits and validation
   */
  EDGE_CASES: [
    createPromptSeed({
      title: 'Very Long Title That Tests The UI Layout And Text Wrapping Behavior In Various Screen Sizes',
      content: 'Short content',
      category: 'Uncategorized',
    }),
    createPromptSeed({
      title: 'A',
      content: 'Single character title with normal content that explains the purpose of this test prompt.',
      category: 'Uncategorized',
    }),
    createPromptSeed({
      title: 'Empty Content Test',
      content: '',
      category: 'Uncategorized',
    }),
    createPromptSeed({
      title: 'Special Characters: !@#$%^&*()',
      content: 'Testing special characters in titles and content: áéíóú ñ ç 中文 日本語 العربية',
      category: 'Uncategorized',
    }),
    createPromptSeed({
      title: 'Very Long Content Test',
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(50),
      category: 'Uncategorized',
    }),
  ],
} as const;

/**
 * Complete scenario fixtures that combine prompts, categories, and settings
 */
export const SCENARIO_FIXTURES = {
  /**
   * New user with no data - for onboarding tests
   */
  NEW_USER: {
    prompts: PROMPT_FIXTURES.EMPTY,
    categories: CATEGORY_FIXTURES.EMPTY,
    settings: {
      ...DEFAULT_SETTINGS,
      interfaceMode: 'sidepanel' as const,
    },
  },

  /**
   * Basic user with minimal data - for simple workflow tests
   */
  BASIC_USER: {
    prompts: PROMPT_FIXTURES.BASIC_SET,
    categories: CATEGORY_FIXTURES.BASIC,
    settings: {
      ...DEFAULT_SETTINGS,
      interfaceMode: 'sidepanel' as const,
    },
  },

  /**
   * Power user with comprehensive data - for complex workflow tests
   */
  POWER_USER: {
    prompts: PROMPT_FIXTURES.POWER_USER,
    categories: CATEGORY_FIXTURES.COMPREHENSIVE,
    settings: {
      ...DEFAULT_SETTINGS,
      interfaceMode: 'sidepanel' as const,
    },
  },

  /**
   * Search-focused scenario for testing search and filter functionality
   */
  SEARCH_FOCUSED: {
    prompts: PROMPT_FIXTURES.SEARCH_TEST_SET,
    categories: CATEGORY_FIXTURES.BASIC,
    settings: {
      ...DEFAULT_SETTINGS,
      interfaceMode: 'sidepanel' as const,
    },
  },

  /**
   * Edge case scenario for testing UI limits and validation
   */
  EDGE_CASES: {
    prompts: PROMPT_FIXTURES.EDGE_CASES,
    categories: CATEGORY_FIXTURES.EDGE_CASES,
    settings: {
      ...DEFAULT_SETTINGS,
      interfaceMode: 'popup' as const, // Test popup mode
    },
  },

  /**
   * Category management focused scenario
   */
  CATEGORY_MANAGEMENT: {
    prompts: PROMPT_FIXTURES.SINGLE,
    categories: CATEGORY_FIXTURES.COMPREHENSIVE,
    settings: {
      ...DEFAULT_SETTINGS,
      interfaceMode: 'sidepanel' as const,
    },
  },

  /**
   * Settings and configuration testing scenario
   */
  SETTINGS_TESTING: {
    prompts: PROMPT_FIXTURES.BASIC_SET,
    categories: CATEGORY_FIXTURES.BASIC,
    settings: {
      ...DEFAULT_SETTINGS,
      interfaceMode: 'popup' as const,
      theme: 'dark' as const,
    },
  },
} as const;

/**
 * Helper functions for creating custom test data
 */
export const testDataHelpers = {
  /**
   * Create a category with random color
   */
  createRandomCategory: (name: string) =>
    createCategorySeed({
      name,
      color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
    }),

  /**
   * Create multiple prompts for a specific category
   */
  createPromptsForCategory: (category: string, count: number) =>
    Array.from({ length: count }, (_, i) =>
      createPromptSeed({
        title: `${category} Prompt ${String(i + 1)}`,
        content: `This is test prompt ${String(i + 1)} for the ${category} category.`,
        category,
      })
    ),

  /**
   * Create a scenario with specific counts
   */
  createCountBasedScenario: (promptCount: number, categoryCount: number) => {
    const categories = Array.from({ length: categoryCount }, (_, i) =>
      testDataHelpers.createRandomCategory(`Category ${String(i + 1)}`)
    );

    const prompts = Array.from({ length: promptCount }, (_, i) => {
      const randomCategory = categories[i % categories.length];
      return createPromptSeed({
        title: `Test Prompt ${String(i + 1)}`,
        content: `Content for test prompt ${String(i + 1)}`,
        category: randomCategory.name,
      });
    });

    return {
      prompts,
      categories,
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'sidepanel' as const,
      },
    };
  },

  /**
   * Merge multiple prompt sets
   */
  mergePromptSets: (...sets: typeof PROMPT_FIXTURES[keyof typeof PROMPT_FIXTURES][]) =>
    sets.flat(),

  /**
   * Merge multiple category sets
   */
  mergeCategorySets: (...sets: typeof CATEGORY_FIXTURES[keyof typeof CATEGORY_FIXTURES][]) =>
    sets.flat(),
};

/**
 * Analytics fixtures for testing usage analytics scenarios
 */
export const ANALYTICS_FIXTURES = {
  /**
   * Empty - no usage history
   */
  EMPTY: {
    prompts: PROMPT_FIXTURES.EMPTY,
    categories: CATEGORY_FIXTURES.EMPTY,
    usageHistory: [] as UsageEvent[],
  },

  /**
   * Single usage event - minimal analytics data
   */
  SINGLE_USAGE: {
    prompts: PROMPT_FIXTURES.SINGLE,
    categories: CATEGORY_FIXTURES.EMPTY,
    usageHistory: [
      createUsageEventSeed({
        promptId: 'single-prompt-id',
        timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago
        platform: 'claude',
        categoryId: null,
      }),
    ],
  },

  /**
   * Varied usage - different prompts, platforms, categories, and time distribution
   */
  VARIED_USAGE: {
    prompts: [
      createPromptSeed({
        id: 'prompt-work-1',
        title: 'Work Email Template',
        content: 'Draft a professional email...',
        category: 'Work',
      }),
      createPromptSeed({
        id: 'prompt-dev-1',
        title: 'Code Review Helper',
        content: 'Review this code for bugs...',
        category: 'Development',
      }),
      createPromptSeed({
        id: 'prompt-personal-1',
        title: 'Recipe Finder',
        content: 'Find healthy recipes...',
        category: 'Personal',
      }),
      createPromptSeed({
        id: 'prompt-work-2',
        title: 'Meeting Notes',
        content: 'Summarize meeting notes...',
        category: 'Work',
      }),
    ],
    categories: CATEGORY_FIXTURES.COMPREHENSIVE,
    usageHistory: (() => {
      const now = Date.now();
      const DAY = 24 * 60 * 60 * 1000;
      const HOUR = 60 * 60 * 1000;

      return [
        // Work prompt used multiple times on different days
        createUsageEventSeed({
          promptId: 'prompt-work-1',
          timestamp: now - 1 * DAY - 9 * HOUR, // Yesterday morning
          platform: 'claude',
          categoryId: 'work-cat-id',
        }),
        createUsageEventSeed({
          promptId: 'prompt-work-1',
          timestamp: now - 2 * DAY - 14 * HOUR, // 2 days ago afternoon
          platform: 'chatgpt',
          categoryId: 'work-cat-id',
        }),
        createUsageEventSeed({
          promptId: 'prompt-work-1',
          timestamp: now - 5 * DAY - 10 * HOUR, // 5 days ago morning
          platform: 'claude',
          categoryId: 'work-cat-id',
        }),

        // Dev prompt used a few times
        createUsageEventSeed({
          promptId: 'prompt-dev-1',
          timestamp: now - 3 * DAY - 15 * HOUR, // 3 days ago afternoon
          platform: 'gemini',
          categoryId: 'dev-cat-id',
        }),
        createUsageEventSeed({
          promptId: 'prompt-dev-1',
          timestamp: now - 7 * DAY - 20 * HOUR, // 7 days ago evening
          platform: 'claude',
          categoryId: 'dev-cat-id',
        }),

        // Personal prompt rarely used
        createUsageEventSeed({
          promptId: 'prompt-personal-1',
          timestamp: now - 10 * DAY - 12 * HOUR, // 10 days ago midday
          platform: 'perplexity',
          categoryId: 'personal-cat-id',
        }),

        // Recent uses
        createUsageEventSeed({
          promptId: 'prompt-work-2',
          timestamp: now - 2 * HOUR, // 2 hours ago
          platform: 'claude',
          categoryId: 'work-cat-id',
        }),
        createUsageEventSeed({
          promptId: 'prompt-work-1',
          timestamp: now - 30 * 60 * 1000, // 30 minutes ago
          platform: 'chatgpt',
          categoryId: 'work-cat-id',
        }),
      ];
    })(),
  },

  /**
   * Multi-platform usage - tests platform distribution charts
   */
  MULTI_PLATFORM: {
    prompts: [
      createPromptSeed({
        id: 'mp-prompt-1',
        title: 'Multi-Platform Prompt 1',
        content: 'A prompt used across multiple platforms',
        category: 'Work',
      }),
      createPromptSeed({
        id: 'mp-prompt-2',
        title: 'Multi-Platform Prompt 2',
        content: 'Another cross-platform prompt',
        category: 'Development',
      }),
    ],
    categories: CATEGORY_FIXTURES.BASIC,
    usageHistory: (() => {
      const now = Date.now();
      const DAY = 24 * 60 * 60 * 1000;
      const HOUR = 60 * 60 * 1000;

      const platforms = ['claude', 'chatgpt', 'gemini', 'perplexity', 'copilot', 'mistral', 'custom'];
      const events: UsageEvent[] = [];

      // Create usage events spread across all platforms
      platforms.forEach((platform, index) => {
        // Claude gets the most usage
        const usageCount = platform === 'claude' ? 5 : platform === 'chatgpt' ? 3 : 1;

        for (let i = 0; i < usageCount; i++) {
          events.push(
            createUsageEventSeed({
              promptId: i % 2 === 0 ? 'mp-prompt-1' : 'mp-prompt-2',
              timestamp: now - (index + i) * DAY - (index * 2) * HOUR,
              platform,
              categoryId: i % 2 === 0 ? 'work-cat-id' : 'dev-cat-id',
            })
          );
        }
      });

      return events;
    })(),
  },
} as const;

/**
 * Create an analytics scenario with prompts, categories, and usage history
 * @param scenario - The analytics fixture scenario name
 * @returns Object containing prompts, categories, usageHistory, and settings
 */
export const createAnalyticsScenario = (
  scenario: keyof typeof ANALYTICS_FIXTURES
): {
  prompts: ReturnType<typeof createPromptSeed>[];
  categories: ReturnType<typeof createCategorySeed>[];
  usageHistory: UsageEvent[];
  settings: typeof DEFAULT_SETTINGS & { interfaceMode: 'sidepanel' };
} => {
  const fixture = ANALYTICS_FIXTURES[scenario];

  return {
    prompts: [...fixture.prompts],
    categories: [...fixture.categories],
    usageHistory: [...fixture.usageHistory],
    settings: {
      ...DEFAULT_SETTINGS,
      interfaceMode: 'sidepanel' as const,
    },
  };
};

// Type exports for TypeScript support
export type TestScenario = typeof SCENARIO_FIXTURES[keyof typeof SCENARIO_FIXTURES];
export type PromptFixture = typeof PROMPT_FIXTURES[keyof typeof PROMPT_FIXTURES];
export type CategoryFixture = typeof CATEGORY_FIXTURES[keyof typeof CATEGORY_FIXTURES];
export type AnalyticsFixture = typeof ANALYTICS_FIXTURES[keyof typeof ANALYTICS_FIXTURES];
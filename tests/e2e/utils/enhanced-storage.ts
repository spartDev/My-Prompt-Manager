/**
 * Enhanced storage utilities for E2E tests
 *
 * This module extends the basic storage utilities with scenario-based seeding
 * and advanced data management features for more sophisticated testing.
 */

import type { Prompt, Category, Settings } from '../../../src/types';
import type { ExtensionStorage } from '../fixtures/extension';
import {
  SCENARIO_FIXTURES,
  PROMPT_FIXTURES,
  CATEGORY_FIXTURES,
  CATEGORY_COLORS,
  testDataHelpers,
  type TestScenario
} from '../fixtures/test-data';

import { seedLibrary, createPromptSeed, createCategorySeed } from './storage';


/**
 * Enhanced test data manager with scenario-based seeding
 */
export class TestDataManager {
  constructor(private storage: ExtensionStorage) {}

  /**
   * Seed storage with a predefined scenario
   */
  async seedScenario(scenarioName: keyof typeof SCENARIO_FIXTURES): Promise<void> {
    const scenario = SCENARIO_FIXTURES[scenarioName];
    await seedLibrary(this.storage, scenario);
  }

  /**
   * Seed storage with predefined fixture sets
   */
  async seedWithPresets(options: {
    promptSet?: keyof typeof PROMPT_FIXTURES;
    categorySet?: keyof typeof CATEGORY_FIXTURES;
    settings?: Partial<Settings>;
    interfaceMode?: Settings['interfaceMode'];
  }): Promise<void> {
    const prompts = options.promptSet ? PROMPT_FIXTURES[options.promptSet] : [];
    const categories = options.categorySet ? CATEGORY_FIXTURES[options.categorySet] : [];

    await seedLibrary(this.storage, {
      prompts,
      categories,
      settings: options.settings,
      interfaceMode: options.interfaceMode,
    });
  }

  /**
   * Seed storage with specific counts of generated data
   */
  async seedWithCount(promptCount: number, categoryCount: number): Promise<void> {
    const scenario = testDataHelpers.createCountBasedScenario(promptCount, categoryCount);
    await seedLibrary(this.storage, scenario);
  }

  /**
   * Seed storage for category management testing
   */
  async seedForCategoryTesting(): Promise<void> {
    await this.seedScenario('CATEGORY_MANAGEMENT');
  }

  /**
   * Seed storage for search functionality testing
   */
  async seedForSearchTesting(): Promise<void> {
    await this.seedScenario('SEARCH_FOCUSED');
  }

  /**
   * Seed storage for power user workflow testing
   */
  async seedForPowerUserTesting(): Promise<void> {
    await this.seedScenario('POWER_USER');
  }

  /**
   * Seed storage for new user onboarding testing
   */
  async seedForNewUserTesting(): Promise<void> {
    await this.seedScenario('NEW_USER');
  }

  /**
   * Seed storage for edge case testing
   */
  async seedForEdgeCaseTesting(): Promise<void> {
    await this.seedScenario('EDGE_CASES');
  }

  /**
   * Add additional prompts to existing data
   */
  async addPrompts(prompts: Prompt[]): Promise<void> {
    const existingPrompts = await this.storage.getPrompts();
    const allPrompts = [...existingPrompts, ...prompts];
    await this.storage.seedPrompts(allPrompts);
  }

  /**
   * Add additional categories to existing data
   */
  async addCategories(categories: Category[]): Promise<void> {
    const existingCategories = await this.storage.getCategories();
    const allCategories = [...existingCategories, ...categories];
    await this.storage.seedCategories(allCategories);
  }

  /**
   * Create a realistic bulk testing scenario
   */
  async seedBulkTestingScenario(options: {
    promptsPerCategory?: number;
    categoryCount?: number;
  } = {}): Promise<void> {
    const promptsPerCategory = options.promptsPerCategory ?? 5;
    const categoryCount = options.categoryCount ?? 4;

    const categories = Array.from({ length: categoryCount }, (_, i) =>
      createCategorySeed({
        name: `Bulk Category ${String(i + 1)}`,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      })
    );

    const prompts = categories.flatMap((category) =>
      testDataHelpers.createPromptsForCategory(category.name, promptsPerCategory)
    );

    await seedLibrary(this.storage, {
      prompts,
      categories,
      settings: {
        interfaceMode: 'sidepanel',
      },
    });
  }

  /**
   * Seed data for testing category consolidation workflows
   */
  async seedForCategoryConsolidation(): Promise<void> {
    // Create categories with specific prompts for consolidation testing
    const categories = [
      createCategorySeed({ name: 'Work', color: CATEGORY_COLORS[0] }),
      createCategorySeed({ name: 'Professional', color: CATEGORY_COLORS[1] }),
      createCategorySeed({ name: 'Marketing', color: CATEGORY_COLORS[2] }),
      createCategorySeed({ name: 'Development', color: CATEGORY_COLORS[3] }),
    ];

    const prompts = [
      // Work category prompts that will be moved to Professional
      ...testDataHelpers.createPromptsForCategory('Work', 5),

      // Marketing prompts that will be consolidated
      createPromptSeed({
        title: 'Campaign Analysis',
        content: 'Analyze marketing campaign performance',
        category: 'Marketing',
      }),
      createPromptSeed({
        title: 'Social Media Strategy',
        content: 'Develop social media content strategy',
        category: 'Marketing',
      }),

      // Development prompts for moving
      createPromptSeed({
        title: 'Code Review Checklist',
        content: 'Review code for best practices',
        category: 'Development',
      }),
      createPromptSeed({
        title: 'API Documentation',
        content: 'Generate API documentation',
        category: 'Development',
      }),
      createPromptSeed({
        title: 'Database Query Optimizer',
        content: 'Optimize database queries',
        category: 'Development',
      }),
    ];

    await seedLibrary(this.storage, {
      prompts,
      categories,
      settings: { interfaceMode: 'sidepanel' },
    });
  }

  /**
   * Verify storage contents match expected data
   */
  async verifyStorageContents(expected: {
    promptCount?: number;
    categoryCount?: number;
    hasCategory?: string;
    hasPrompt?: string;
  }): Promise<void> {
    const prompts = await this.storage.getPrompts();
    const categories = await this.storage.getCategories();

    if (expected.promptCount !== undefined) {
      if (prompts.length !== expected.promptCount) {
        throw new Error(`Expected ${String(expected.promptCount)} prompts, got ${String(prompts.length)}`);
      }
    }

    if (expected.categoryCount !== undefined) {
      if (categories.length !== expected.categoryCount) {
        throw new Error(`Expected ${String(expected.categoryCount)} categories, got ${String(categories.length)}`);
      }
    }

    if (expected.hasCategory) {
      const categoryExists = categories.some(c => c.name === expected.hasCategory);
      if (!categoryExists) {
        throw new Error(`Expected category "${expected.hasCategory}" not found`);
      }
    }

    if (expected.hasPrompt) {
      const promptExists = prompts.some(p => p.title === expected.hasPrompt);
      if (!promptExists) {
        throw new Error(`Expected prompt "${expected.hasPrompt}" not found`);
      }
    }
  }

  /**
   * Get current storage statistics
   */
  async getStorageStats(): Promise<{
    promptCount: number;
    categoryCount: number;
    promptsByCategory: Record<string, number>;
  }> {
    const prompts = await this.storage.getPrompts();
    const categories = await this.storage.getCategories();

    const promptsByCategory = prompts.reduce<Record<string, number>>((acc, prompt) => {
      acc[prompt.category] = (acc[prompt.category] || 0) + 1;
      return acc;
    }, {});

    return {
      promptCount: prompts.length,
      categoryCount: categories.length,
      promptsByCategory,
    };
  }
}

/**
 * Scenario runner for executing predefined test scenarios
 */
export class ScenarioRunner {
  constructor(private storage: ExtensionStorage) {}

  private testDataManager = new TestDataManager(this.storage);

  /**
   * Run a specific test scenario and return cleanup function
   */
  async runScenario(scenarioName: keyof typeof SCENARIO_FIXTURES): Promise<{
    scenario: TestScenario;
    cleanup: () => Promise<void>;
  }> {
    const scenario = SCENARIO_FIXTURES[scenarioName];
    await this.testDataManager.seedScenario(scenarioName);

    return {
      scenario,
      cleanup: async () => {
        await this.storage.reset();
      },
    };
  }

  /**
   * Run multiple scenarios in sequence
   */
  async runScenarios(
    scenarioNames: (keyof typeof SCENARIO_FIXTURES)[],
    testFn: (scenarioName: string, scenario: TestScenario) => Promise<void>
  ): Promise<void> {
    for (const scenarioName of scenarioNames) {
      const { scenario, cleanup } = await this.runScenario(scenarioName);

      try {
        await testFn(scenarioName, scenario);
      } finally {
        await cleanup();
      }
    }
  }

  /**
   * Get available scenarios
   */
  getAvailableScenarios(): string[] {
    return Object.keys(SCENARIO_FIXTURES);
  }
}

/**
 * Data validation utilities for testing
 */
export class DataValidator {
  constructor(private storage: ExtensionStorage) {}

  /**
   * Validate that storage contains expected data structure
   */
  async validateDataStructure(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      const prompts = await this.storage.getPrompts();
      const categories = await this.storage.getCategories();
      const settings = await this.storage.getSettings();

      // Validate prompts structure
      for (const prompt of prompts) {
        if (!prompt.id || !prompt.title || !prompt.content) {
          errors.push(`Invalid prompt structure: ${JSON.stringify(prompt)}`);
        }
        if (typeof prompt.createdAt !== 'number' || typeof prompt.updatedAt !== 'number') {
          errors.push(`Invalid prompt timestamps: ${prompt.title}`);
        }
      }

      // Validate categories structure
      for (const category of categories) {
        if (!category.id || !category.name) {
          errors.push(`Invalid category structure: ${JSON.stringify(category)}`);
        }
      }

      // Validate settings structure
      if (settings && typeof settings.interfaceMode !== 'string') {
        errors.push('Invalid settings structure');
      }

    } catch (error) {
      errors.push(`Storage validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate data consistency (e.g., prompt categories exist)
   */
  async validateDataConsistency(): Promise<{
    isConsistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const prompts = await this.storage.getPrompts();
      const categories = await this.storage.getCategories();

      const categoryNames = new Set(categories.map(c => c.name));
      categoryNames.add('Uncategorized'); // Default category always exists

      // Check if all prompt categories exist
      for (const prompt of prompts) {
        if (!categoryNames.has(prompt.category)) {
          issues.push(`Prompt "${prompt.title}" references non-existent category "${prompt.category}"`);
        }
      }

    } catch (error) {
      issues.push(`Consistency validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isConsistent: issues.length === 0,
      issues,
    };
  }
}

/**
 * Factory functions for common test scenarios
 */
export const scenarioFactory = {
  /**
   * Create a test data manager instance
   */
  createTestDataManager: (storage: ExtensionStorage) => new TestDataManager(storage),

  /**
   * Create a scenario runner instance
   */
  createScenarioRunner: (storage: ExtensionStorage) => new ScenarioRunner(storage),

  /**
   * Create a data validator instance
   */
  createDataValidator: (storage: ExtensionStorage) => new DataValidator(storage),
};
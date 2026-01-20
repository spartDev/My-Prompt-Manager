import {
  Prompt,
  VALIDATION_LIMITS,
  DEFAULT_CATEGORY,
  ErrorType,
  AppError,
  SortOrder,
  SortDirection
} from '../types';
import { HighlightedPrompt } from '../types/hooks';
import { findTextHighlights } from '../utils/textHighlight';

import { getSearchIndex } from './SearchIndex';
import { calculateSimilarityOptimized } from './SimilarityAlgorithms';
import { StorageManager } from './storage';

class PromptManagerError extends Error implements AppError {
  public type: ErrorType;
  public details?: unknown;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = 'PromptManagerError';
    this.type = appError.type;
    this.details = appError.details;
  }
}

export class PromptManager {
  private static instance: PromptManager | undefined;
  private storageManager: StorageManager;

  private constructor() {
    this.storageManager = StorageManager.getInstance();
  }

  static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  // Prompt creation and management
  async createPrompt(title: string, content: string, category: string = DEFAULT_CATEGORY): Promise<Prompt> {
    try {
      // Validate input
      const validationError = this.validatePromptData({ title, content, category });
      if (validationError) {
        throw validationError;
      }

      // Generate title if empty
      const finalTitle = title.trim() || this.generateTitle(content);

      // Ensure category exists
      const categories = await this.storageManager.getCategories();
      if (!categories.some(c => c.name === category)) {
        throw new Error(`Category "${category}" does not exist`);
      }

      const promptData = {
        title: finalTitle,
        content: content.trim(),
        category
      };

      return await this.storageManager.savePrompt(promptData);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updatePrompt(id: string, updates: { title?: string; content?: string; category?: string }): Promise<Prompt> {
    try {
      // Validate updates
      const validationError = this.validatePromptData(updates);
      if (validationError) {
        throw validationError;
      }

      // If updating category, ensure it exists
      if (updates.category) {
        const categories = await this.storageManager.getCategories();
        if (!categories.some(c => c.name === updates.category)) {
          throw new Error(`Category "${updates.category}" does not exist`);
        }
      }

      // Clean up data - only include fields that were actually provided
      const cleanUpdates: { title?: string; content?: string; category?: string } = {};
      if (updates.title !== undefined) {
        cleanUpdates.title = updates.title.trim();
      }
      if (updates.content !== undefined) {
        cleanUpdates.content = updates.content.trim();
      }
      if (updates.category !== undefined) {
        cleanUpdates.category = updates.category;
      }

      return await this.storageManager.updatePrompt(id, cleanUpdates);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Search functionality
  async searchPrompts(query: string, categoryFilter?: string): Promise<Prompt[]> {
    try {
      // Empty query returns all prompts
      if (!query.trim()) {
        const prompts = await this.storageManager.getPrompts();
        return categoryFilter
          ? prompts.filter(p => p.category === categoryFilter)
          : prompts;
      }

      // Get all prompts and build/update index
      const allPrompts = await this.storageManager.getPrompts();
      const searchIndex = getSearchIndex();

      // Rebuild index if needed (first search or prompts changed)
      if (searchIndex.needsRebuild(allPrompts)) {
        searchIndex.buildIndex(allPrompts);
      }

      // Use indexed search for fast O(t + k) performance
      const searchResults = searchIndex.search(query, {
        maxResults: 1000,
        minRelevance: 0.1,
        categoryFilter
      });

      // Return prompts ordered by relevance
      return searchResults.map(result => result.prompt);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async searchPromptsWithHighlights(query: string): Promise<HighlightedPrompt[]> {
    try {
      const searchResults = await this.searchPrompts(query);

      if (!query.trim()) {
        return searchResults.map(prompt => ({
          ...prompt,
          titleHighlights: [],
          contentHighlights: []
        }));
      }

      const searchTerm = query.toLowerCase().trim();

      return searchResults.map(prompt => ({
        ...prompt,
        titleHighlights: findTextHighlights(prompt.title, searchTerm),
        contentHighlights: findTextHighlights(prompt.content, searchTerm)
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Sorts prompts based on specified order and direction
   * @param prompts - Array of prompts to sort
   * @param order - Sort field (title, createdAt, or updatedAt)
   * @param direction - Sort direction (asc or desc)
   * @returns Sorted array of prompts (new array, does not mutate input)
   */
  sortPrompts(
    prompts: Prompt[],
    order: SortOrder,
    direction: SortDirection
  ): Prompt[] {
    // Create new array to avoid mutating input
    const sorted = [...prompts];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (order) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'createdAt':
          comparison = a.createdAt - b.createdAt;
          break;
        case 'updatedAt':
          comparison = a.updatedAt - b.updatedAt;
          break;
        case 'usageCount': {
          const usageA = typeof a.usageCount === 'number' && Number.isFinite(a.usageCount) ? a.usageCount : 0;
          const usageB = typeof b.usageCount === 'number' && Number.isFinite(b.usageCount) ? b.usageCount : 0;
          comparison = usageA - usageB;
          break;
        }
        case 'lastUsedAt': {
          const lastUsedA = typeof a.lastUsedAt === 'number' && Number.isFinite(a.lastUsedAt) ? a.lastUsedAt : a.createdAt;
          const lastUsedB = typeof b.lastUsedAt === 'number' && Number.isFinite(b.lastUsedAt) ? b.lastUsedAt : b.createdAt;
          comparison = lastUsedA - lastUsedB;
          break;
        }
        default: {
          // Exhaustiveness check - TypeScript will error if a new SortOrder is added
          // without handling it in the switch statement
          const _exhaustiveCheck: never = order;
          throw new PromptManagerError({
            type: ErrorType.VALIDATION_ERROR,
            message: `Unknown sort order: ${String(_exhaustiveCheck)}`
          });
        }
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  // Filtering functionality
  async filterByCategory(category: string | null): Promise<Prompt[]> {
    try {
      const allPrompts = await this.storageManager.getPrompts();
      
      if (!category) {
        return allPrompts;
      }

      return allPrompts.filter(prompt => prompt.category === category);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPromptsByDateRange(startDate: number, endDate: number): Promise<Prompt[]> {
    try {
      const allPrompts = await this.storageManager.getPrompts();
      
      return allPrompts.filter(prompt => 
        prompt.createdAt >= startDate && prompt.createdAt <= endDate
      );
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Sorting functionality
  async getSortedPrompts(sortBy: SortOrder, order: SortDirection = 'desc'): Promise<Prompt[]> {
    try {
      const allPrompts = await this.storageManager.getPrompts();

      return this.sortPrompts(allPrompts, sortBy, order);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Title generation
  generateTitle(content: string): string {
    if (!content || !content.trim()) {
      return 'Untitled Prompt';
    }

    const cleanContent = content.trim().replace(/\s+/g, ' ');
    
    if (cleanContent.length <= VALIDATION_LIMITS.TITLE_GENERATION_LENGTH) {
      return cleanContent;
    }

    // Find the best place to cut off
    const truncated = cleanContent.substring(0, VALIDATION_LIMITS.TITLE_GENERATION_LENGTH);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > VALIDATION_LIMITS.TITLE_GENERATION_LENGTH * 0.7) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }

  // Validation
  validatePromptData(data: { title?: string; content?: string; category?: string }): PromptManagerError | null {
    const { title, content, category } = data;

    if (title !== undefined) {
      if (title.length > VALIDATION_LIMITS.PROMPT_TITLE_MAX) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: `Title cannot exceed ${String(VALIDATION_LIMITS.PROMPT_TITLE_MAX)} characters`
        });
      }
    }

    if (content !== undefined) {
      if (!content.trim()) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Prompt content cannot be empty'
        });
      }

      if (content.length > VALIDATION_LIMITS.PROMPT_CONTENT_MAX) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: `Content cannot exceed ${String(VALIDATION_LIMITS.PROMPT_CONTENT_MAX)} characters`
        });
      }
    }

    if (category !== undefined) {
      if (category.length > VALIDATION_LIMITS.CATEGORY_NAME_MAX) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: `Category name cannot exceed ${String(VALIDATION_LIMITS.CATEGORY_NAME_MAX)} characters`
        });
      }
    }

    return null;
  }

  validateCategoryData(data: { name?: string; color?: string }): PromptManagerError | null {
    const { name, color } = data;

    if (name !== undefined) {
      if (!name.trim()) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Category name cannot be empty'
        });
      }

      if (name.length > VALIDATION_LIMITS.CATEGORY_NAME_MAX) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: `Category name cannot exceed ${String(VALIDATION_LIMITS.CATEGORY_NAME_MAX)} characters`
        });
      }
    }

    if (color !== undefined && color) {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;
      if (!hexColorRegex.test(color)) {
        return new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: 'Color must be a valid hex color code (e.g., #FF0000)'
        });
      }
    }

    return null;
  }

  // Statistics and analytics
  async getPromptStatistics(): Promise<{
    totalPrompts: number;
    categoryCounts: Record<string, number>;
    averageContentLength: number;
    recentActivity: { date: string; count: number }[];
  }> {
    try {
      const allPrompts = await this.storageManager.getPrompts();
      
      const categoryCounts: Record<string, number> = {};
      let totalContentLength = 0;
      
      allPrompts.forEach(prompt => {
        categoryCounts[prompt.category] = (categoryCounts[prompt.category] || 0) + 1;
        totalContentLength += prompt.content.length;
      });

      // Calculate recent activity (last 7 days)
      const now = Date.now();
      const recentActivity: { date: string; count: number }[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now - (i * 24 * 60 * 60 * 1000));
        // Use local time consistently for both dateString and filtering
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${String(year)}-${month}-${day}`;

        // Create separate Date objects for start/end to avoid mutation issues
        const dayStart = new Date(year, date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
        const dayEnd = new Date(year, date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();

        const count = allPrompts.filter(prompt =>
          prompt.createdAt >= dayStart && prompt.createdAt <= dayEnd
        ).length;

        recentActivity.push({ date: dateString, count });
      }

      return {
        totalPrompts: allPrompts.length,
        categoryCounts,
        averageContentLength: allPrompts.length > 0 ? Math.round(totalContentLength / allPrompts.length) : 0,
        recentActivity
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Duplicate detection constants
  private static readonly DUPLICATE_DETECTION_DEFAULTS = {
    MAX_PROMPTS_AUTO: 1000,
    TIMEOUT_MS: 10000,
    YIELD_INTERVAL_MS: 50,
    HASH_BUCKET_SIZE: 100
  } as const;

  /**
   * Finds groups of similar/duplicate prompts using content similarity analysis.
   *
   * @param options - Configuration options for duplicate detection
   * @param options.timeoutMs - Maximum execution time in milliseconds (default: 10000)
   * @param options.maxPrompts - Maximum prompts to process without explicit opt-in (default: 1000)
   * @param options.allowLargeDatasets - Set to true to bypass maxPrompts limit
   * @param options.yieldIntervalMs - How often to yield to UI thread (default: 50ms)
   * @param options.onProgress - Progress callback for UI updates.
   *   **Note:** Progress values are normalized to reach 100%. Due to the length-bucket
   *   optimization that skips impossible comparisons, the `current` and `total` values
   *   may not reflect actual comparisons performed. Use the `progress` percentage for
   *   UI display rather than computing it from `current/total`.
   * @returns Array of duplicate groups, each containing an original prompt and its duplicates
   */
  async findDuplicatePrompts(options?: {
    timeoutMs?: number;
    maxPrompts?: number;
    allowLargeDatasets?: boolean;
    yieldIntervalMs?: number;
    /**
     * Progress callback. Values are normalized to ensure progress reaches 100%.
     * Due to length-bucket optimization, `current` and `total` may not reflect
     * actual comparison counts. Use `progress` percentage for UI display.
     */
    onProgress?: (progress: number, current: number, total: number) => void;
  }): Promise<{ original: Prompt; duplicates: Prompt[] }[]> {
    const {
      timeoutMs = PromptManager.DUPLICATE_DETECTION_DEFAULTS.TIMEOUT_MS,
      maxPrompts = PromptManager.DUPLICATE_DETECTION_DEFAULTS.MAX_PROMPTS_AUTO,
      allowLargeDatasets = false,
      yieldIntervalMs = PromptManager.DUPLICATE_DETECTION_DEFAULTS.YIELD_INTERVAL_MS,
      onProgress
    } = options || {};

    try {
      const allPrompts = await this.storageManager.getPrompts();

      // Safeguard: Check prompt count before starting O(n²) operation
      if (allPrompts.length > maxPrompts && !allowLargeDatasets) {
        throw new PromptManagerError({
          type: ErrorType.VALIDATION_ERROR,
          message: `Duplicate detection limited to ${String(maxPrompts)} prompts. You have ${String(allPrompts.length)} prompts. Set allowLargeDatasets: true to process larger collections.`,
          details: {
            promptCount: allPrompts.length,
            maxPrompts,
            estimatedComparisons: (allPrompts.length * (allPrompts.length - 1)) / 2
          }
        });
      }

      // Group prompts by content length bucket for faster filtering
      const lengthBuckets = this.groupByLengthBucket(allPrompts);

      const duplicateGroups: { original: Prompt; duplicates: Prompt[] }[] = [];
      const processedIds = new Set<string>();

      const startTime = performance.now();
      let lastYieldTime = startTime;
      const totalComparisons = (allPrompts.length * (allPrompts.length - 1)) / 2;
      let completedComparisons = 0;

      for (let i = 0; i < allPrompts.length; i++) {
        const currentTime = performance.now();

        // Check timeout every outer loop iteration
        if (currentTime - startTime > timeoutMs) {
          throw new PromptManagerError({
            type: ErrorType.VALIDATION_ERROR,
            message: `Duplicate detection timed out after ${String(timeoutMs)}ms. Try with fewer prompts or increase timeout.`,
            details: {
              processedPrompts: i,
              totalPrompts: allPrompts.length,
              foundDuplicates: duplicateGroups.length
            }
          });
        }

        // Yield to UI to keep it responsive
        if (currentTime - lastYieldTime > yieldIntervalMs) {
          await this.yieldToUI();
          lastYieldTime = performance.now();
        }

        const prompt = allPrompts[i];

        if (processedIds.has(prompt.id)) {
          continue;
        }

        const duplicates: Prompt[] = [];

        // Get candidates from same and adjacent length buckets (within 10% length)
        // Only returns prompts with index > i to ensure each pair is compared exactly once
        const candidates = this.getCandidatesFromBuckets(prompt, i, lengthBuckets, processedIds);

        // Compare only with candidates (filtered by length bucket)
        // Note: candidates are guaranteed to have index > i, so other !== prompt
        for (const other of candidates) {
          if (this.areSimilarPrompts(prompt, other)) {
            duplicates.push(other);
          }

          completedComparisons++;

          // Report progress every 100 comparisons
          if (onProgress && completedComparisons % 100 === 0) {
            const progress = Math.min((completedComparisons / totalComparisons) * 100, 99);
            onProgress(progress, completedComparisons, totalComparisons);
          }
        }

        // Account for skipped comparisons in progress
        const skippedComparisons = (allPrompts.length - i - 1) - candidates.length;
        completedComparisons += skippedComparisons;

        if (duplicates.length > 0) {
          duplicateGroups.push({ original: prompt, duplicates });
          processedIds.add(prompt.id);
          duplicates.forEach(dup => processedIds.add(dup.id));
        }
      }

      // Report 100% completion
      if (onProgress) {
        onProgress(100, totalComparisons, totalComparisons);
      }

      return duplicateGroups;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Group prompts by content length for O(n²) optimization
  // Stores index alongside prompt to enable forward-only comparisons
  private groupByLengthBucket(prompts: Prompt[]): Map<number, { prompt: Prompt; index: number }[]> {
    const buckets = new Map<number, { prompt: Prompt; index: number }[]>();
    const bucketSize = PromptManager.DUPLICATE_DETECTION_DEFAULTS.HASH_BUCKET_SIZE;

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      const bucket = Math.floor(prompt.content.length / bucketSize);
      const existing = buckets.get(bucket) || [];
      existing.push({ prompt, index: i });
      buckets.set(bucket, existing);
    }

    return buckets;
  }

  // Get candidate prompts from length buckets within similarity range
  // Only returns prompts with index > currentIndex to avoid double comparisons
  private getCandidatesFromBuckets(
    prompt: Prompt,
    currentIndex: number,
    buckets: Map<number, { prompt: Prompt; index: number }[]>,
    processedIds: Set<string>
  ): Prompt[] {
    const bucketSize = PromptManager.DUPLICATE_DETECTION_DEFAULTS.HASH_BUCKET_SIZE;
    const len = prompt.content.length;
    const promptBucket = Math.floor(len / bucketSize);

    // For 90% similarity threshold, content lengths must be within ~11% of each other.
    // Valid candidate range: [0.9 * len, len / 0.9] = [0.9 * len, ~1.11 * len]
    // The spread is ~0.21 * len, so we need to check ceil(0.11 * len / bucketSize) buckets
    // on each side. For small prompts (< 900 chars) this is 1; for longer prompts it scales.
    //
    // Note: We considered making HASH_BUCKET_SIZE adaptive (e.g., based on average prompt
    // length), but dynamic bucket range is simpler and avoids recomputing buckets. The fixed
    // 100-char bucket size provides good granularity for typical prompts while the adaptive
    // range handles edge cases with longer content.
    const bucketsToCheck = Math.max(1, Math.ceil((len * 0.11) / bucketSize));
    const candidates: Prompt[] = [];

    for (let b = promptBucket - bucketsToCheck; b <= promptBucket + bucketsToCheck; b++) {
      const bucketed = buckets.get(b);
      if (bucketed) {
        for (const entry of bucketed) {
          // Only compare forward (index > currentIndex) to avoid double comparisons
          // Also skip already-processed prompts (duplicates found in earlier iterations)
          if (entry.index > currentIndex && !processedIds.has(entry.prompt.id)) {
            candidates.push(entry.prompt);
          }
        }
      }
    }

    return candidates;
  }

  // Yield to UI event loop to prevent blocking
  private yieldToUI(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  // Private helper methods
  private areSimilarPrompts(prompt1: Prompt, prompt2: Prompt): boolean {
    // Quick length-based rejection (saves expensive similarity calculations)
    // If content lengths differ by more than 10%, can't be 90% similar
    const len1 = prompt1.content.length;
    const len2 = prompt2.content.length;
    const minLen = Math.min(len1, len2);
    const maxLen = Math.max(len1, len2);

    if (minLen / maxLen < 0.9) {
      return false;
    }

    // Check for exact content match (fast)
    if (prompt1.content.trim() === prompt2.content.trim()) {
      return true;
    }

    // Use optimized Levenshtein similarity algorithm
    const titleSimilarity = calculateSimilarityOptimized(prompt1.title, prompt2.title, 0.8);

    // Early exit if titles are too different (saves expensive content comparison)
    if (titleSimilarity < 0.8) {
      return false;
    }

    const contentSimilarity = calculateSimilarityOptimized(prompt1.content, prompt2.content, 0.9);

    // calculateSimilarityOptimized returns -1 if below threshold, otherwise returns score
    return contentSimilarity >= 0.9;
  }

  private handleError(error: unknown): PromptManagerError {
    // If it's already a PromptManagerError or StorageError, re-throw it
    if (error instanceof PromptManagerError || (error instanceof Error && 'type' in error)) {
      return error as PromptManagerError;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return new PromptManagerError({
      type: ErrorType.VALIDATION_ERROR,
      message: errorMessage || 'An unknown error occurred in PromptManager',
      details: error
    });
  }
}

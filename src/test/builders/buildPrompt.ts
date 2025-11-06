import type { Prompt } from '../../types';
import { DEFAULT_CATEGORY } from '../../types';

/**
 * Test builder for creating Prompt objects with sensible defaults
 *
 * Eliminates duplication of prompt creation logic across test files.
 * All timestamps default to a fixed time for deterministic tests.
 *
 * @param overrides - Partial prompt properties to override defaults
 * @returns Complete Prompt object with all required fields
 *
 * @example
 * ```typescript
 * // Minimal prompt with defaults
 * const prompt = buildPrompt();
 *
 * // Custom title and content
 * const prompt = buildPrompt({
 *   title: 'Test Prompt',
 *   content: 'Test content'
 * });
 *
 * // With usage tracking
 * const prompt = buildPrompt({
 *   usageCount: 5,
 *   lastUsedAt: Date.now()
 * });
 * ```
 */
export function buildPrompt(overrides: Partial<Prompt> = {}): Prompt {
  const FIXED_TIME = new Date('2025-01-01T00:00:00Z');
  const timestamp = FIXED_TIME.getTime();
  const createdAt = overrides.createdAt ?? timestamp;
  const updatedAt = overrides.updatedAt ?? createdAt;
  const usageCount = overrides.usageCount ?? 0;
  const lastUsedAt = overrides.lastUsedAt ?? (usageCount > 0 ? updatedAt : createdAt);

  return {
    id: overrides.id ?? 'prompt-id',
    title: overrides.title ?? 'Sample Prompt',
    content: overrides.content ?? 'Sample content',
    category: overrides.category ?? DEFAULT_CATEGORY,
    createdAt,
    updatedAt,
    usageCount,
    lastUsedAt
  };
}

import type { Category } from '../../types';
import { DEFAULT_CATEGORY } from '../../types';

/**
 * Test builder for creating Category objects with sensible defaults
 *
 * Eliminates duplication of category creation logic across test files.
 *
 * @param overrides - Partial category properties to override defaults
 * @returns Complete Category object with all required fields
 *
 * @example
 * ```typescript
 * // Default category
 * const category = buildCategory();
 *
 * // Custom category
 * const category = buildCategory({
 *   id: 'work',
 *   name: 'Work',
 *   color: '#FF0000'
 * });
 *
 * // Without color
 * const category = buildCategory({
 *   name: 'Personal'
 * });
 * ```
 */
export function buildCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: overrides.id ?? 'category-id',
    name: overrides.name ?? DEFAULT_CATEGORY,
    color: overrides.color
  };
}

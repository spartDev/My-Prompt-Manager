/**
 * Test Builders
 *
 * Reusable builder functions for creating test data objects.
 * These builders eliminate duplication and provide consistent defaults across tests.
 *
 * ## Available Builders
 *
 * - `buildPrompt()` - Create Prompt objects with sensible defaults
 * - `buildCategory()` - Create Category objects with sensible defaults
 *
 * ## Usage
 *
 * ```typescript
 * import { buildPrompt, buildCategory } from '@test/builders';
 *
 * // In your test
 * const prompt = buildPrompt({
 *   title: 'Custom Title',
 *   content: 'Custom Content'
 * });
 *
 * const category = buildCategory({
 *   name: 'Work',
 *   color: '#FF0000'
 * });
 * ```
 */

export { buildPrompt } from './buildPrompt';
export { buildCategory } from './buildCategory';

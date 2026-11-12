import { DEFAULT_CATEGORY } from '../constants';
import type { Category, Prompt, UsageEvent } from '../types';

/** The Library holds no Prompt */
export const isLibraryEmpty = (prompts: readonly Prompt[]): boolean => prompts.length === 0;

/**
 * The user has no Category of their own: every Library has the Default Category, which is never
 * deleted, so it does not count. No Category at all means they are not read yet, which is not empty:
 * the empty state must not show while the Section loads.
 */
export const isCategoriesEmpty = (categories: readonly Category[]): boolean =>
  categories.length > 0 && categories.every(category => category.name === DEFAULT_CATEGORY);

/**
 * No Insertion in the period Analytics counts. `history` is that period's Insertions, so a Library
 * with Prompts that were never inserted, or not lately, is empty here too.
 */
export const isStatsEmpty = (history: readonly UsageEvent[]): boolean => history.length === 0;

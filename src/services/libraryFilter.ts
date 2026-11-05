/**
 * Library filter: the one choice that narrows which Prompts the Library lists
 * (All, the Pinned Prompts, Most Used, or a single Category — see CONTEXT.md).
 */

import { NATURAL_SORT_DIRECTION } from '../constants';
import type { Category, LibraryFilter, Prompt, SortOrder } from '../types';

import { PromptManager } from './promptManager';

export const ALL_PROMPTS: LibraryFilter = { kind: 'all' };

const finiteOr = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Categories that hold at least one Prompt, in the order of the Categories section */
export function getFilterableCategories(categories: Category[], prompts: Prompt[]): Category[] {
  const usedNames = new Set(prompts.map(prompt => prompt.category));
  return categories.filter(category => usedNames.has(category.name));
}

/** The filter to apply: the chosen one, or All once its Category is gone or holds no Prompt */
export function resolveLibraryFilter(filter: LibraryFilter, filterableCategories: Category[]): LibraryFilter {
  if (filter.kind !== 'category') {
    return filter;
  }
  return filterableCategories.some(category => category.id === filter.categoryId) ? filter : ALL_PROMPTS;
}

/**
 * Most Used: the Prompts inserted at least once, by all-time insertions, most first.
 * Ties go to the most recently used. Pinned Prompts get no priority here.
 */
export function rankMostUsed(prompts: Prompt[]): Prompt[] {
  return prompts
    .filter(prompt => finiteOr(prompt.usageCount, 0) > 0)
    .sort((a, b) =>
      finiteOr(b.usageCount, 0) - finiteOr(a.usageCount, 0) ||
      finiteOr(b.lastUsedAt, b.createdAt) - finiteOr(a.lastUsedAt, a.createdAt)
    );
}

/** The Prompts the Library lists for a filter, in display order */
export function applyLibraryFilter(
  prompts: Prompt[],
  filter: LibraryFilter,
  categories: Category[],
  sortOrder: SortOrder
): Prompt[] {
  const sort = (list: Prompt[]) =>
    PromptManager.getInstance().sortPrompts(list, sortOrder, NATURAL_SORT_DIRECTION[sortOrder]);

  switch (filter.kind) {
    case 'all':
      return sort(prompts);
    case 'pinned':
      return sort(prompts.filter(prompt => prompt.pinned === true));
    case 'mostUsed':
      return rankMostUsed(prompts);
    case 'category': {
      const category = categories.find(c => c.id === filter.categoryId);
      return category ? sort(prompts.filter(prompt => prompt.category === category.name)) : [];
    }
  }
}

/**
 * What the Prompt selector lists: its tabs and the Prompts of each. Pure, no DOM.
 *
 * Tabs, in order: All, Pinned, Recent, then every Category of the Library. A search looks in the
 * whole Library, whatever the tab.
 */

import { extractVariables } from '../../utils/promptVariables';
import type { Prompt } from '../types/index';

export type TabKey = 'all' | 'pinned' | 'recent' | `category:${string}`;

/** A Category as the selector needs it: its name and, when it has a valid one, its color. */
export interface SelectorCategory {
  name: string;
  color?: string;
}

export interface SelectorTab {
  key: TabKey;
  label: string;
  /** The Category's color; absent for All, Pinned and Recent, whose dots are tokens. */
  color?: string;
}

/** What the selector reads when it opens. */
export interface SelectorLibrary {
  prompts: readonly Prompt[];
  categories: readonly SelectorCategory[];
}

/** How many Prompts Recent lists. */
export const RECENT_COUNT = 5;

export const categoryTabKey = (name: string): TabKey => `category:${name}`;

/**
 * Stable partition: Pinned Prompts first, keeping the stored order within each group.
 * The selector deliberately ignores the Library sort setting.
 */
export const pinnedFirst = (prompts: readonly Prompt[]): Prompt[] => [
  ...prompts.filter((prompt) => prompt.pinned === true),
  ...prompts.filter((prompt) => prompt.pinned !== true)
];

/**
 * The tabs: All, Pinned, Recent, then every Category in its stored order. A Category that a
 * Prompt names but the Library does not hold still gets its tab, after the others.
 */
export const tabsOf = (library: SelectorLibrary): SelectorTab[] => {
  const categories: SelectorCategory[] = [...library.categories];
  const known = new Set(categories.map((category) => category.name));
  for (const prompt of library.prompts) {
    if (!known.has(prompt.category)) {
      known.add(prompt.category);
      categories.push({ name: prompt.category });
    }
  }

  return [
    { key: 'all', label: 'All' },
    { key: 'pinned', label: 'Pinned' },
    { key: 'recent', label: 'Recent' },
    ...categories.map((category) => ({
      key: categoryTabKey(category.name),
      label: category.name,
      ...(category.color === undefined ? {} : { color: category.color })
    }))
  ];
};

/** The five Prompts inserted most recently, latest first; a Prompt never inserted is not Recent. */
const recentOf = (prompts: readonly Prompt[]): Prompt[] =>
  prompts
    .filter((prompt) => (prompt.usageCount ?? 0) > 0)
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, RECENT_COUNT);

const matches = (prompt: Prompt, query: string): boolean => {
  const needle = query.toLowerCase();
  return (
    prompt.title.toLowerCase().includes(needle) ||
    prompt.content.toLowerCase().includes(needle) ||
    prompt.category.toLowerCase().includes(needle)
  );
};

/**
 * The Prompts the list shows: those of `tab`, or, while `query` is not empty, every Prompt of the
 * Library that matches it in its title, content or Category name.
 */
export const promptsOf = (library: SelectorLibrary, tab: TabKey, query: string): Prompt[] => {
  if (query !== '') {
    return pinnedFirst(library.prompts).filter((prompt) => matches(prompt, query));
  }
  if (tab === 'all') {
    return pinnedFirst(library.prompts);
  }
  if (tab === 'pinned') {
    return library.prompts.filter((prompt) => prompt.pinned === true);
  }
  if (tab === 'recent') {
    return recentOf(library.prompts);
  }
  const category = tab.slice('category:'.length);
  return pinnedFirst(library.prompts).filter((prompt) => prompt.category === category);
};

/** How many distinct Variables a Prompt has. */
export const variableCount = (prompt: Prompt): number => extractVariables(prompt.content).length;

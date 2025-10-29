import type { Category, Prompt, Settings } from '../../../src/types';
import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import type { ExtensionStorage } from '../fixtures/extension';

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

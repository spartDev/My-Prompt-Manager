import type { Prompt } from '../../types/index';
import type { SelectorLibrary } from '../selectorData';

export const prompt = (id: string, over: Partial<Prompt> = {}): Prompt => ({
  id,
  title: `Title ${id}`,
  content: `Content ${id}`,
  category: 'Work',
  createdAt: 1,
  updatedAt: 1,
  ...over
});

/**
 * Seven Prompts over two Categories and a third, empty one:
 * - p2 and p5 are pinned;
 * - p1, p3, p4, p5, p6, p7 were inserted (p7 latest, then p6, p5, p4, p3, p1);
 * - p3 has two Variables, one of them twice.
 */
export const library: SelectorLibrary = {
  prompts: [
    prompt('p1', { usageCount: 1, lastUsedAt: 10 }),
    prompt('p2', { pinned: true, category: 'Home' }),
    prompt('p3', { content: 'Dear {{name}}, about {{topic}}. Bye {{name}}', usageCount: 2, lastUsedAt: 30 }),
    prompt('p4', { title: 'Weekly report', usageCount: 1, lastUsedAt: 40, category: 'Home' }),
    prompt('p5', { pinned: true, usageCount: 3, lastUsedAt: 50 }),
    prompt('p6', { usageCount: 1, lastUsedAt: 60 }),
    prompt('p7', { usageCount: 1, lastUsedAt: 70 })
  ],
  categories: [{ name: 'Work', color: '#2563EB' }, { name: 'Home' }, { name: 'Empty', color: '#DC2626' }]
};

export const ids = (prompts: readonly Prompt[]): string[] => prompts.map((p) => p.id);

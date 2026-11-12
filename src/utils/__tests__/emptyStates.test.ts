import { describe, expect, it } from 'vitest';

import { buildCategory, buildPrompt } from '../../test/builders';
import { DEFAULT_CATEGORY, type UsageEvent } from '../../types';
import { isCategoriesEmpty, isLibraryEmpty, isStatsEmpty } from '../emptyStates';

const insertion = (promptId: string): UsageEvent => ({ promptId, timestamp: 1, platform: 'claude', categoryId: null });

describe('isLibraryEmpty', () => {
  it('is true for a Library with no Prompt', () => {
    expect(isLibraryEmpty([])).toBe(true);
  });

  it('is false as soon as the Library holds a Prompt', () => {
    expect(isLibraryEmpty([buildPrompt()])).toBe(false);
  });

  it('is true again once the last Prompt is deleted', () => {
    const prompts = [buildPrompt({ id: 'last' })];
    expect(isLibraryEmpty(prompts.filter(prompt => prompt.id !== 'last'))).toBe(true);
  });
});

describe('isCategoriesEmpty', () => {
  const defaultCategory = buildCategory({ id: 'default', name: DEFAULT_CATEGORY });

  it('is true when the Default Category is the only one', () => {
    expect(isCategoriesEmpty([defaultCategory])).toBe(true);
  });

  it('is false before the Categories are read, when not even the Default Category is there', () => {
    expect(isCategoriesEmpty([])).toBe(false);
  });

  it('is false as soon as the user has a Category of their own', () => {
    expect(isCategoriesEmpty([defaultCategory, buildCategory({ id: 'work', name: 'Work' })])).toBe(false);
  });

  it('is true again once the last Category of the user is deleted', () => {
    const categories = [defaultCategory, buildCategory({ id: 'work', name: 'Work' })];
    expect(isCategoriesEmpty(categories.filter(category => category.id !== 'work'))).toBe(true);
  });
});

describe('isStatsEmpty', () => {
  it('is true when the period has no Insertion', () => {
    expect(isStatsEmpty([])).toBe(true);
  });

  it('is false as soon as the period has an Insertion', () => {
    expect(isStatsEmpty([insertion('a')])).toBe(false);
  });

  it('is true again once the history is cleared', () => {
    const history = [insertion('a')];
    history.length = 0;
    expect(isStatsEmpty(history)).toBe(true);
  });

  it('does not look at the Prompts: a Library with Prompts never inserted is empty here', () => {
    const prompts = [buildPrompt()];
    expect(isLibraryEmpty(prompts)).toBe(false);
    expect(isStatsEmpty([])).toBe(true);
  });
});

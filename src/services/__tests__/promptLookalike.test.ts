import { describe, expect, it } from 'vitest';

import type { Prompt } from '../../types';
import { findLookalike } from '../promptLookalike';

const libraryPrompt = (id: string, title: string, content: string): Prompt => ({
  id,
  title,
  content,
  category: 'Uncategorized',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000
});

// 40 characters; changing n of them leaves (40 - n) / 40 alike
const EXISTING = 'Summarize this article in three bullets.';
const withChanges = (n: number): string => 'x'.repeat(n) + EXISTING.slice(n);

describe('findLookalike', () => {
  it('finds a Prompt of the Library at least 60% like the content, with how alike it is', () => {
    const existing = libraryPrompt('a', 'Summarize', EXISTING);

    expect(findLookalike(withChanges(16), [existing])).toEqual({ prompt: existing, similarity: 0.6 });
  });

  it('finds nothing below 60%', () => {
    expect(findLookalike(withChanges(17), [libraryPrompt('a', 'Summarize', EXISTING)])).toBeNull();
  });

  it('finds nothing for content of 20 characters or less, spaces around it not counted', () => {
    const short = 'Translate to French.'; // 20 characters

    expect(findLookalike(`  ${short}\n`, [libraryPrompt('a', 'Translate', short)])).toBeNull();
    expect(findLookalike(`${short}!`, [libraryPrompt('a', 'Translate', `${short}!`)])).not.toBeNull();
  });

  it('never compares the Prompt being edited with itself', () => {
    const edited = libraryPrompt('edited', 'Summarize', EXISTING);
    const other = libraryPrompt('other', 'Summarize again', withChanges(10));

    expect(findLookalike(EXISTING, [edited, other], 'edited')).toEqual({ prompt: other, similarity: 0.75 });
    expect(findLookalike(EXISTING, [edited], 'edited')).toBeNull();
  });

  it('finds the most alike Prompt when several are', () => {
    const far = libraryPrompt('far', 'Far', withChanges(12));
    const near = libraryPrompt('near', 'Near', withChanges(2));

    expect(findLookalike(EXISTING, [far, near])?.prompt).toBe(near);
  });
});

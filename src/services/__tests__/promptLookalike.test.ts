import { describe, expect, it, vi } from 'vitest';
import type { Prompt } from '../../types';
import { PROMPT_LIMITS } from '../promptAdmission';
import { findLookalike, LOOKALIKE_COMPARED_LENGTH } from '../promptLookalike';
import { calculateSimilarityOptimized } from '../SimilarityAlgorithms';

// The real comparison, watched: the work it is given is what keeps typing smooth
vi.mock('../SimilarityAlgorithms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../SimilarityAlgorithms')>();
  return { ...actual, calculateSimilarityOptimized: vi.fn(actual.calculateSimilarityOptimized) };
});

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

  describe('at the longest text Admission takes', () => {
    const longest = 'Draft a careful reply. '.repeat(PROMPT_LIMITS.content).slice(0, PROMPT_LIMITS.content);

    it('finds an identical Prompt 100% alike', () => {
      const same = libraryPrompt('same', 'Same', longest);

      expect(findLookalike(longest, [same])).toEqual({ prompt: same, similarity: 1 });
    });

    it('does not take two long texts that start alike but end differently for alike', () => {
      const sameStart = `${longest.slice(0, PROMPT_LIMITS.content / 2)}${'Another ending entirely. '.repeat(PROMPT_LIMITS.content).slice(0, PROMPT_LIMITS.content / 2)}`;

      expect(findLookalike(longest, [libraryPrompt('a', 'Same start', sameStart)])).toBeNull();
    });

    it('finds a Prompt that is a long text with more appended, without counting the length difference twice', () => {
      // 1,000 of 1,400 characters alike: 71%
      const existing = libraryPrompt('a', 'Shorter', 'a'.repeat(1000));

      expect(findLookalike(`${'a'.repeat(1000)}${'b'.repeat(400)}`, [existing])?.prompt).toBe(existing);
    });

    it('finds a long Prompt with text appended or put in front, as alike as the whole texts are', () => {
      const existing = libraryPrompt('a', 'Long', 'a'.repeat(10_000));

      // 10,000 of 10,500 characters alike: 95%
      for (const text of [`${'a'.repeat(10_000)}${'b'.repeat(500)}`, `${'b'.repeat(500)}${'a'.repeat(10_000)}`]) {
        const found = findLookalike(text, [existing]);
        expect(found?.prompt).toBe(existing);
        expect(found?.similarity).toBeCloseTo(10_000 / 10_500, 2);
      }
    });

    it('points out a long Prompt whose paragraphs are the same in another order: the user has written it before', () => {
      const first = 'Context: the customer wrote about a late delivery. '.repeat(40);
      const second = 'Answer: apologize, give the new date, offer a refund. '.repeat(40);

      expect(findLookalike(`${second}${first}`, [libraryPrompt('a', 'Reply', `${first}${second}`)])?.similarity).toBeGreaterThan(0.9);
    });

    it('does not take a long text for alike a much shorter Prompt it starts with', () => {
      expect(findLookalike(longest, [libraryPrompt('a', 'Start only', longest.slice(0, 2000))])).toBeNull();
    });

    it('never compares texts over 1,000 characters character by character, the comparison whose cost is the product of their lengths', () => {
      vi.mocked(calculateSimilarityOptimized).mockClear();
      const library = Array.from({ length: 20 }, (_, i) => libraryPrompt(`p${String(i)}`, `P${String(i)}`, `${String(i)}${longest}`.slice(0, PROMPT_LIMITS.content)));

      expect(findLookalike(`${longest.slice(1)}!`, library)).not.toBeNull();

      const compared = vi.mocked(calculateSimilarityOptimized).mock.calls.flatMap(([a, b]) => [a.length, b.length]);
      expect(compared.every(length => length <= LOOKALIKE_COMPARED_LENGTH)).toBe(true);
    });
  });
});

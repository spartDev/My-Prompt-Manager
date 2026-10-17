import { describe, it, expect } from 'vitest';

import { cutWithoutSplittingPairs } from '../truncate';

const EMOJI = '\u{1F600}'; // two UTF-16 code units: a surrogate pair

describe('cutWithoutSplittingPairs', () => {
  it('returns text that fits unchanged', () => {
    expect(cutWithoutSplittingPairs('short', 100)).toBe('short');
    expect(cutWithoutSplittingPairs('', 100)).toBe('');
  });

  it('cuts plain text at the limit', () => {
    expect(cutWithoutSplittingPairs('a'.repeat(150), 100)).toBe('a'.repeat(100));
  });

  it('keeps text of exactly the limit whole', () => {
    expect(cutWithoutSplittingPairs('a'.repeat(100), 100)).toBe('a'.repeat(100));
  });

  it('leaves out a pair that straddles the limit, whole', () => {
    const text = `${'a'.repeat(99)}${EMOJI}bbb`;

    expect(cutWithoutSplittingPairs(text, 100)).toBe('a'.repeat(99));
  });

  it('keeps a pair that ends exactly at the limit', () => {
    const text = `${'a'.repeat(98)}${EMOJI}bbb`;

    expect(cutWithoutSplittingPairs(text, 100)).toBe(`${'a'.repeat(98)}${EMOJI}`);
  });

  it('keeps a pair that is the last thing in the text', () => {
    const text = `${'a'.repeat(98)}${EMOJI}`;

    expect(cutWithoutSplittingPairs(text, 100)).toBe(text);
  });

  it('leaves a lone surrogate that was already in the text as it was', () => {
    const lone = String.fromCharCode(0xd83d);
    const text = `${'a'.repeat(99)}${lone}bbb`;

    expect(cutWithoutSplittingPairs(text, 100)).toBe(`${'a'.repeat(99)}${lone}`);
  });

  it('never returns a broken pair, wherever the cut falls', () => {
    const text = EMOJI.repeat(40);

    for (let max = 0; max <= 60; max += 1) {
      const cut = cutWithoutSplittingPairs(text, max);

      // encodeURIComponent throws on a lone surrogate
      expect(() => encodeURIComponent(cut)).not.toThrow();
      expect(cut.length).toBeLessThanOrEqual(max);
    }
  });

  it('returns an empty string for a limit of zero', () => {
    expect(cutWithoutSplittingPairs('abc', 0)).toBe('');
  });
});

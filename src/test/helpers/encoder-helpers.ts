import { expect } from 'vitest';

import { encode, decode } from '../../services/promptEncoder';
import type { Prompt } from '../../types';

/**
 * Test helper for verifying round-trip encoding/decoding of prompts
 *
 * Reduces duplication in promptEncoder tests by extracting the common pattern
 * of encoding a prompt, decoding it, and verifying all fields match.
 *
 * @param prompt - Prompt object to test encoding/decoding
 *
 * @example
 * ```typescript
 * import { testEncoderRoundtrip } from '@test/helpers';
 * import { buildPrompt } from '@test/builders';
 *
 * it('should handle special characters', () => {
 *   const prompt = buildPrompt({
 *     title: 'Test with "quotes"',
 *     content: 'Content with <html>'
 *   });
 *   testEncoderRoundtrip(prompt);
 * });
 * ```
 */
export function testEncoderRoundtrip(prompt: Prompt): void {
  const encoded = encode(prompt);
  const decoded = decode(encoded);

  expect(decoded.title).toBe(prompt.title);
  expect(decoded.content).toBe(prompt.content);
  expect(decoded.category).toBe(prompt.category);
}

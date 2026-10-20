/**
 * Test Helpers
 *
 * Reusable test helper functions that encapsulate common testing patterns.
 * These helpers eliminate duplication and make tests more readable.
 *
 * ## Available Helpers
 *
 * ### Encoder Helpers
 * - `testEncoderRoundtrip()` - Test round-trip encoding/decoding of prompts
 *
 * ### Theme Helpers
 * - `setupThemeTest()` - Setup theme hook with mocked storage
 * - `testThemeToggle()` - Test theme toggle from one value to another
 *
 * ### Hostile Text Helpers
 * - `HOSTILE_TEXTS` - Hostile-looking strings (markup, handlers, URLs) that must stay plain text
 * - `expectNoMarkupIn()` - Assert nothing under an element was made from Prompt text
 *
 * ## Usage
 *
 * ```typescript
 * import { testEncoderRoundtrip, setupThemeTest } from '@test/helpers';
 * import { buildPrompt } from '@test/builders';
 *
 * // Encoder test
 * it('should encode unicode', () => {
 *   const prompt = buildPrompt({ title: '中文标题' });
 *   testEncoderRoundtrip(prompt);
 * });
 *
 * // Theme test
 * it('should load theme from storage', async () => {
 *   const { result } = await setupThemeTest('dark');
 *   expect(result.current.theme).toBe('dark');
 * });
 * ```
 */

export { testEncoderRoundtrip } from './encoder-helpers';
export { setupThemeTest, testThemeToggle } from './theme-helpers';
export { HOSTILE_TEXTS, expectNoMarkupIn } from './hostile-text';

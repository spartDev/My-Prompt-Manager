/**
 * E2E: the cleanup of `npm run live:check` in a real browser, on the Lexical stand-ins of
 * Perplexity and copilot.cloud.microsoft (a real lexical editor, as on the live sites). Its unit
 * tests drive a fake page; only a browser shows what Select All then Backspace leaves in the
 * editor itself (My-Prompt-Manager-mew: the hand-written Lexical imitation deleted one character).
 */

import { expect, test } from '@playwright/test';

import { afterCase, CASE_FIELDS } from '../../../scripts/live-check';
import { SUPPORTED_PLATFORMS } from '../../../src/config/platforms';
import { type EditorFixture, PLATFORM_FIELD, routePlatform } from '../fixtures/platform-pages';

const LEXICAL_STAND_INS: readonly { id: 'perplexity' | 'm365copilot'; fixture: EditorFixture }[] = [
  { id: 'perplexity', fixture: 'perplexity-editor' },
  { id: 'm365copilot', fixture: 'm365copilot-editor' }
];

const NOT_OURS = '; field holds text the case did not type, left as it was: check for a draft';

for (const { id, fixture } of LEXICAL_STAND_INS) {
  test.describe(`live:check cleanup on the ${fixture} stand-in`, () => {
    test.beforeEach(async ({ context, page }) => {
      await page.goto(await routePlatform(context, fixture), { waitUntil: 'domcontentloaded' });
      await page.locator(PLATFORM_FIELD[fixture]).click();
    });

    for (const [caseId, text] of [['slash-inside', 'Hi there'], ['icon-steady', 'Hello world']] as const) {
      test(`empties the field after ${caseId} typed ${JSON.stringify(text)}`, async ({ page }) => {
        const field = page.locator(PLATFORM_FIELD[fixture]);
        await page.keyboard.type(text);
        await expect.poll(() => field.textContent()).toBe(text);

        const note = await afterCase(page, SUPPORTED_PLATFORMS[id], { typed: true, owned: CASE_FIELDS[caseId].typed });

        expect(note).toBe('');
        expect(await field.textContent()).toBe('');
      });
    }

    test('leaves a field holding a draft as it was, and says so', async ({ page }) => {
      const field = page.locator(PLATFORM_FIELD[fixture]);
      await page.keyboard.type('Mon brouillon Hi there');
      await expect.poll(() => field.textContent()).toBe('Mon brouillon Hi there');
      const draft = await field.innerHTML();

      const note = await afterCase(page, SUPPORTED_PLATFORMS[id], { typed: true, owned: CASE_FIELDS['slash-inside'].typed });

      expect(note).toBe(NOT_OURS);
      // Exact, not toHaveText: a string there normalizes whitespace, so a doubled space would pass
      expect(await field.textContent()).toBe('Mon brouillon Hi there');
      expect(await field.innerHTML()).toBe(draft);
    });
  });
}

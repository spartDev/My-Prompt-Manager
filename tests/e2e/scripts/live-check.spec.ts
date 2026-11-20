/**
 * E2E: the cleanup of `npm run live:check` in a real browser, on the Lexical stand-ins of
 * Perplexity and Microsoft 365 Copilot (a real lexical editor, as on the live sites). Its unit
 * tests drive a fake page; only a browser shows what Select All then Backspace leaves in the
 * editor itself (My-Prompt-Manager-mew: the hand-written Lexical imitation deleted one character).
 */

import { expect, test } from '@playwright/test';

import { afterCase, bypassServiceWorkers, CASE_FIELDS } from '../../../scripts/live-check';
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

/**
 * A profile signed in to chat.mistral.ai holds Mistral's service worker, which answers a navigation
 * before the context's routes see it: --stand-in then got Mistral's own page, with no field
 * (My-Prompt-Manager-h6o). The worker here answers every navigation, as that one may.
 */
const MISTRAL_WORKER = /* js */ `
  self.addEventListener('install', () => { self.skipWaiting(); });
  self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });
  self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
      event.respondWith(new Response('<!DOCTYPE html><title>Le Chat</title><p>From the worker</p>', { headers: { 'content-type': 'text/html' } }));
    }
  });`;

test.describe('live:check --stand-in past a service worker the profile holds', () => {
  test('opens the Mistral stand-in, not the page the worker serves', async ({ context }) => {
    const url = await routePlatform(context, 'mistral-editor');
    // Registered last, so it takes the worker's script before the stand-in's route aborts it
    await context.route('https://chat.mistral.ai/sw.js', (route) => route.fulfill({ contentType: 'text/javascript', body: MISTRAL_WORKER }));
    const install = await context.newPage();
    await install.goto(url, { waitUntil: 'domcontentloaded' });
    await install.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    // The worker answers a navigation now
    await install.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(install.getByText('From the worker')).toBeVisible();
    await install.close();

    const page = await context.newPage();
    await bypassServiceWorkers(context, page);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await expect(page.locator(PLATFORM_FIELD['mistral-editor'])).toBeVisible();
  });
});

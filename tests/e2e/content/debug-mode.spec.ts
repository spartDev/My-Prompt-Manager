/**
 * E2E: who turns Debug mode on, on a Platform, in the release build the suite loads
 * (My-Prompt-Manager-j3i6).
 *
 * A page owns its localStorage. Up to this ticket the content script read one key of it,
 * `prompt-library-debug`, so the page (or any script running in it) could turn Debug mode on and
 * make the extension write its debug, info and warning messages, each with the page's address, to
 * the console. In a release build, only the Settings switch, kept in the extension's own storage,
 * turns it on.
 *
 * The content script writes those messages in Debug mode only, so they are the proof: none for a
 * page that sets the flag, some once the Settings switch is on.
 */

import type { ConsoleMessage, Page } from '@playwright/test';

import { defaultSiteSettings, SITE_SETTINGS_KEY } from '../../../src/services/siteSettings';
import { expect, test } from '../fixtures/extension';
import { openPlatform, promptsButton } from '../fixtures/platform-pages';
import { seedLibrary } from '../utils/storage';

/** The prefix of every message of the content script's logger (src/content/utils/logger.ts) */
const LOGGER_PREFIX = '[PromptLibrary]';

/** What the content script writes in Debug mode only: its messages that are not errors */
const isDebugModeMessage = (message: ConsoleMessage): boolean =>
  message.text().startsWith(LOGGER_PREFIX) && message.type() !== 'error';

/**
 * Writes a line to the console from the page, and waits until Playwright has received it. The page
 * and the content script share the page's one console, whose messages reach Playwright in the order
 * they were written, so every message written before this line has arrived once it is back.
 */
async function drainConsole(page: Page): Promise<void> {
  const line = `mpm-e2e-console-drained-${Date.now()}`;
  const received = page.waitForEvent('console', (message) => message.text() === line);
  await page.evaluate((text) => {
    console.log(text);
  }, line);
  await received;
}

test.describe('Debug mode on a Platform, in a release build', () => {
  test("a page that sets prompt-library-debug in its own localStorage does not turn it on", async ({ context, storage }) => {
    await seedLibrary(storage, { prompts: [] });
    const page = await openPlatform(context, 'claude');
    await expect(promptsButton(page)).toHaveCount(1);

    // The page's own script, in the page's world, as any site can run
    await page.evaluate(() => {
      localStorage.setItem('prompt-library-debug', 'true');
    });
    const written: string[] = [];
    page.on('console', (message) => {
      if (isDebugModeMessage(message)) {written.push(`${message.type()}: ${message.text()}`);}
    });
    // The content script starts again, from its first message, with the flag already set
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(promptsButton(page)).toHaveCount(1);
    await drainConsole(page);

    expect(written).toEqual([]);
  });

  test('the Settings switch, in the extension\'s own storage, turns it on', async ({ context, storage }) => {
    await seedLibrary(storage, { prompts: [] });
    await storage.seed({ [SITE_SETTINGS_KEY]: { ...defaultSiteSettings(), debugMode: true } });

    const firstDebugMessage = context.waitForEvent('console', isDebugModeMessage);
    const page = await openPlatform(context, 'claude');
    await expect(promptsButton(page)).toHaveCount(1);

    // The logger's third argument is its record, which carries the page's address: the message
    // comes from the content script on this Platform page, in Debug mode
    const message = await firstDebugMessage;
    expect(message.page()).toBe(page);
    const record = (await message.args()[2]?.jsonValue()) as { level?: string; url?: string } | undefined;
    expect(record?.url).toBe('https://claude.ai/');
    expect(['DEBUG', 'INFO', 'WARN']).toContain(record?.level);
  });
});

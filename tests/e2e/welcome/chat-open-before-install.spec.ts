/**
 * E2E: a chat open before the install answers // without a reload (My-Prompt-Manager-ojz.19, AC5).
 *
 * The Welcome tells a new user to type // in their AI chat. Chrome runs a manifest's content scripts
 * only in pages loaded after the extension, so a chat tab the user had open while installing would
 * have no Prompts button and no // until reloaded; at a first install the service worker gives the
 * content script to each open tab of a Platform that is on, as it does at an update.
 *
 * The other specs load the extension with --load-extension, which installs it before any tab exists.
 * This one opens the Claude stand-in first, then installs the extension into the running browser over
 * CDP (`Extensions.loadUnpacked`, which Chromium offers with --enable-unsafe-extension-debugging on
 * the pipe Playwright drives it through): Chrome fires `onInstalled` with reason 'install', as for an
 * install from the Chrome Web Store. A mark set in the page before the install shows it never reloaded.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { chromium, expect, test } from '@playwright/test';

import { createStorageController, DEFAULT_EXTENSION_PATH, waitForBackgroundTarget, waitForFirstInstallRecords } from '../fixtures/extension';
import { expectSelectorOpen, listedTitles, PLATFORM_FIELD, promptsButton, routePlatform } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

type MarkedWindow = typeof globalThis & { openBeforeInstall?: boolean };

const PROMPT = createPromptSeed({ id: 'follow-up', title: 'Follow-up email', content: 'Write a follow-up email to {{name}}.' });

test('AC5: a Platform tab open before the install gets the content script at the install: // opens the Prompt selector there, with no reload', async () => {
  test.slow();
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpm-install-after-tab-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: Boolean(process.env.CI),
    // Playwright turns extensions off by default: this browser starts with none, and gets one below
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check'],
    timeout: process.env.CI ? 120_000 : 30_000
  });
  try {
    expect(context.serviceWorkers().filter((worker) => worker.url().startsWith('chrome-extension://'))).toHaveLength(0);

    // The chat, open before the install
    const url = await routePlatform(context, 'claude');
    const chat = context.pages()[0] ?? (await context.newPage());
    await chat.goto(url, { waitUntil: 'domcontentloaded' });
    await chat.evaluate(() => {
      (globalThis as MarkedWindow).openBeforeInstall = true;
    });
    await expect(chat.locator(PLATFORM_FIELD.claude)).toBeVisible();
    await expect(promptsButton(chat)).toHaveCount(0);

    // The install, into the running browser
    const browser = context.browser();
    if (!browser) {
      throw new Error('The persistent context has no browser to open a CDP session on');
    }
    const cdp = await browser.newBrowserCDPSession();
    const { id } = (await cdp.send('Extensions.loadUnpacked', { path: DEFAULT_EXTENSION_PATH })) as { id: string };
    await cdp.detach();
    expect(id).toMatch(/^[a-p]{32}$/);
    const storage = createStorageController(await waitForBackgroundTarget(context));
    // What 'install' writes: a first install happened
    await waitForFirstInstallRecords(storage);
    // A Prompt in the Library, as after "Add N prompts"
    await seedLibrary(storage, { prompts: [PROMPT] });

    // In the tab open before: the Prompts button, and // opens the Prompt selector with the Prompt
    await expect(promptsButton(chat)).toHaveCount(1, { timeout: 30_000 });
    await chat.locator(PLATFORM_FIELD.claude).click();
    await chat.keyboard.type('//');
    await expectSelectorOpen(chat);
    await expect.poll(() => listedTitles(chat)).toEqual([PROMPT.title]);
    // The same page all along: never reloaded
    expect(await chat.evaluate(() => (globalThis as MarkedWindow).openBeforeInstall)).toBe(true);
  } finally {
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  }
});

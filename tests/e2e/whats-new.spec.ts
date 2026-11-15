/**
 * E2E: when What's new shows, in the real extension (My-Prompt-Manager-d1g.10)
 *
 * The extension runs as built, at the version of its manifest (1.9.0), with the What's new record
 * (`whatsNew`) and Debug mode (`promptLibrarySettings.debugMode`) seeded in storage. Each opening of
 * the popup is a new page, as when the user closes the popup and opens it again.
 *
 * What the build cannot reach: the registry has Release notes for 2.0.0 only, and 1.9.0 has none, so
 * in normal mode the sheet never shows here. The update that shows it, its close and the reopen that
 * does not show it again are proven against the same storage module by the integration tests:
 * src/components/__tests__/App.whatsNew.test.tsx ("marks the Release seen before the exit ends",
 * "closed with Got it, is not shown at the next opening of the popup") and
 * src/hooks/__tests__/useWhatsNew.test.ts ("does not come back after closing, even after a restart").
 * Here: the normal cases the build reaches (an update to a Release without notes, a first install)
 * show nothing and write nothing, and Debug mode shows the newest notes at every opening and leaves
 * the record as it was.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { BrowserContext, Page, Worker } from '@playwright/test';

import { SITE_SETTINGS_KEY } from '../../src/services/siteSettings';
import { WHATS_NEW_KEY } from '../../src/whatsNew/storage';
import { type ExtensionStorage, expect, test } from './fixtures/extension';
import { createPromptSeed, seedLibrary } from './utils/storage';

const WHATS_NEW = /what.s new/i;

/** The installed Release: the manifest version, 1.9.0 */
const INSTALLED = (JSON.parse(readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf-8')) as { version: string }).version;

/** Time for the popup to read storage and decide, once the Library shows, before "not shown" is asserted */
const DECISION_SETTLE_MS = 750;

const seedPopup = async (storage: ExtensionStorage, extra: Record<string, unknown>): Promise<void> => {
  await seedLibrary(storage, { prompts: [createPromptSeed({ id: 'p1', title: 'Draft email', content: 'Hello' })] });
  await storage.seed(extra);
};

/** One opening of the popup, in its own page; the caller closes it, as the user closes the popup */
const openPopup = async (context: BrowserContext, extensionId: string): Promise<Page> => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 400, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  return page;
};

/** The Library shows, and What's new does not rise over it once the decision had time to land */
const expectLibraryWithoutWhatsNew = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('prompt-card').filter({ hasText: 'Draft email' })).toBeVisible();
  await page.waitForTimeout(DECISION_SETTLE_MS);
  await expect(page.getByRole('dialog', { name: WHATS_NEW })).toHaveCount(0);
};

const storedRecord = async (storage: ExtensionStorage): Promise<unknown> =>
  (await storage.get<Record<string, unknown>>(WHATS_NEW_KEY))[WHATS_NEW_KEY];

test.describe("What's new in the real extension", () => {
  test(`update case: an update from 1.8.0 to ${INSTALLED}, a Release without notes, shows nothing and writes no Last seen Release`, async ({ context, storage, extensionId }) => {
    await seedPopup(storage, { [WHATS_NEW_KEY]: { installedVersion: '1.8.0' } });

    for (let opening = 0; opening < 2; opening++) {
      const popup = await openPopup(context, extensionId);
      await expectLibraryWithoutWhatsNew(popup);
      await popup.close();
    }

    expect(await storedRecord(storage)).toEqual({ installedVersion: '1.8.0' });
  });

  test('reopen after a close: with the installed Release as the Last seen Release, nothing shows and the record stays', async ({ context, storage, extensionId }) => {
    const record = { installedVersion: '1.8.0', lastSeenVersion: INSTALLED };
    await seedPopup(storage, { [WHATS_NEW_KEY]: record });

    const popup = await openPopup(context, extensionId);
    await expectLibraryWithoutWhatsNew(popup);
    await popup.close();

    expect(await storedRecord(storage)).toEqual(record);
  });

  test('first install: the service worker records the installed Release, and the popup shows nothing', async ({ context, extensionId }) => {
    // No storage fixture here: storage is as the first install left it, nothing seeded or cleared
    const worker = context.serviceWorkers().find((candidate) => candidate.url().startsWith(`chrome-extension://${extensionId}/`));
    expect(worker).toBeDefined();
    const readRecord = (): Promise<unknown> =>
      (worker as Worker).evaluate(async (key) => (await chrome.storage.local.get(key))[key], WHATS_NEW_KEY);
    await expect.poll(readRecord).toEqual({ installedVersion: INSTALLED });

    const popup = await openPopup(context, extensionId);
    await expect(popup.getByRole('heading', { name: /my prompt manager/i })).toBeVisible();
    await popup.waitForTimeout(DECISION_SETTLE_MS);
    await expect(popup.getByRole('dialog', { name: WHATS_NEW })).toHaveCount(0);
    await popup.close();

    expect(await readRecord()).toEqual({ installedVersion: INSTALLED });
  });

  test("Debug mode: What's new shows at each of two openings, closing leaves the record as it was, and Debug mode off gives the normal decision back", async ({ context, storage, extensionId }) => {
    // A first install, which normal mode never shows: Debug mode shows it anyway
    const record = { installedVersion: INSTALLED };
    await seedPopup(storage, { [WHATS_NEW_KEY]: record, [SITE_SETTINGS_KEY]: { enabledSites: [], customSites: [], debugMode: true } });

    // Each opening closes What's new another way: Got it, then Escape
    for (const close of ['Got it', 'Escape'] as const) {
      const popup = await openPopup(context, extensionId);
      const sheet = popup.getByRole('dialog', { name: WHATS_NEW });
      await expect(sheet).toBeVisible();
      // 1.9.0 has no notes: Debug mode shows those of the newest Release that has some
      await expect(sheet.getByText('New in 2.0.0', { exact: true })).toBeVisible();
      await expect(sheet.getByRole('button', { name: 'Got it' })).toBeFocused();

      if (close === 'Got it') {
        await sheet.getByRole('button', { name: 'Got it' }).click();
      } else {
        await popup.keyboard.press('Escape');
      }
      await expect(sheet).toHaveCount(0);
      await expect(popup.getByTestId('prompt-card').filter({ hasText: 'Draft email' })).toBeVisible();
      await popup.close();

      expect(await storedRecord(storage)).toEqual(record);
    }

    // Debug mode off: a first install shows nothing, as before the Debug session
    await storage.seed({ [SITE_SETTINGS_KEY]: { enabledSites: [], customSites: [], debugMode: false } });
    const popup = await openPopup(context, extensionId);
    await expectLibraryWithoutWhatsNew(popup);
    await popup.close();

    expect(await storedRecord(storage)).toEqual(record);
  });
});

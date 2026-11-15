/**
 * E2E: when What's new shows, in the real extension (My-Prompt-Manager-d1g.10)
 *
 * The extension runs as built, with the What's new record (`whatsNew`) and Debug mode
 * (`promptLibrarySettings.debugMode`) seeded in storage. Each opening of the popup is a new page, as
 * when the user closes the popup and opens it again.
 *
 * Two builds. dist/ is at the repository's manifest version (1.9.0), which has no Release notes:
 * there an update to it and a first install show nothing, and Debug mode shows the newest notes at
 * every opening and leaves the record as it was. The registry has Release notes for 2.0.0 only, so
 * the update that shows What's new runs on dist-e2e-whats-new/, the same build with its manifest
 * version set to 2.0.0 (fixtures/whats-new-build.ts): the sheet shows, a close writes the Last seen
 * Release, and the next opening shows nothing; a first install of 2.0.0 shows nothing.
 *
 * On 1.9.0 the "nothing shows" checks hold for any record, since that Release has no notes: there they
 * only prove the record is left as it was. The rules themselves are proven on 2.0.0 and by the hook
 * and App tests (src/hooks/__tests__/useWhatsNew.test.ts, src/components/__tests__/App.whatsNew.test.tsx).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { BrowserContext, Page, Worker } from '@playwright/test';

import { SITE_SETTINGS_KEY } from '../../src/services/siteSettings';
import { WHATS_NEW_KEY } from '../../src/whatsNew/storage';
import { createStorageController, type ExtensionStorage, expect, test } from './fixtures/extension';
import { WHATS_NEW_UPDATE_EXTENSION_PATH, WHATS_NEW_UPDATE_VERSION } from './fixtures/whats-new-build';
import { createPromptSeed, seedLibrary } from './utils/storage';

const WHATS_NEW = /what.s new/i;

/** The installed Release of dist/: the repository's manifest version, 1.9.0 */
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

/**
 * The storage of a build as its first install left it: Chrome installs the copy when it loads it,
 * and the service worker records `installedVersion` = the build's version. Nothing is cleared or seeded
 */
const storageOfFirstInstall = async (context: BrowserContext, extensionId: string, version: string): Promise<ExtensionStorage> => {
  const worker = context.serviceWorkers().find((candidate) => candidate.url().startsWith(`chrome-extension://${extensionId}/`));
  if (worker === undefined) {
    throw new Error(`The service worker of the ${version} build is not running`);
  }
  const storage = createStorageController(worker);
  await expect.poll(async () => storedRecord(storage)).toEqual({ installedVersion: version });
  return storage;
};

/**
 * The storage of a build, emptied once its service worker has recorded the first install.
 * Waiting for that write first means it cannot land over the seed of the test: the seed is the last write
 */
const storageAfterInstall = async (context: BrowserContext, extensionId: string, version: string): Promise<ExtensionStorage> => {
  const storage = await storageOfFirstInstall(context, extensionId, version);
  await storage.reset();
  return storage;
};

test.describe("What's new in the real extension", () => {
  test(`update case: an update from 1.8.0 to ${INSTALLED}, a Release without notes, shows nothing and writes no Last seen Release`, async ({ context, extensionId }) => {
    const storage = await storageAfterInstall(context, extensionId, INSTALLED);
    await seedPopup(storage, { [WHATS_NEW_KEY]: { installedVersion: '1.8.0' } });

    for (let opening = 0; opening < 2; opening++) {
      const popup = await openPopup(context, extensionId);
      await expectLibraryWithoutWhatsNew(popup);
      await popup.close();
    }

    expect(await storedRecord(storage)).toEqual({ installedVersion: '1.8.0' });
  });

  test('reopen after a close: with the installed Release as the Last seen Release, nothing shows and the record stays', async ({ context, extensionId }) => {
    const storage = await storageAfterInstall(context, extensionId, INSTALLED);
    const record = { installedVersion: '1.8.0', lastSeenVersion: INSTALLED };
    await seedPopup(storage, { [WHATS_NEW_KEY]: record });

    const popup = await openPopup(context, extensionId);
    await expectLibraryWithoutWhatsNew(popup);
    await popup.close();

    expect(await storedRecord(storage)).toEqual(record);
  });

  test('first install: the service worker records the installed Release', async ({ context, extensionId }) => {
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

  test("Debug mode: What's new shows at each of two openings, closing leaves the record as it was, and Debug mode off gives the normal decision back", async ({ context, extensionId }) => {
    const storage = await storageAfterInstall(context, extensionId, INSTALLED);
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

test.describe(`What's new after the update to ${WHATS_NEW_UPDATE_VERSION}, a Release that has Release notes`, () => {
  test.use({ extensionPath: WHATS_NEW_UPDATE_EXTENSION_PATH });

  test('first install: a Release that has Release notes shows nothing, and the record stays as the service worker wrote it', async ({ context, extensionId }) => {
    // No storage fixture and no seed: storage is as the first install of 2.0.0 left it
    const storage = await storageOfFirstInstall(context, extensionId, WHATS_NEW_UPDATE_VERSION);

    const popup = await openPopup(context, extensionId);
    await expect(popup.getByRole('heading', { name: /my prompt manager/i })).toBeVisible();
    await popup.waitForTimeout(DECISION_SETTLE_MS);
    await expect(popup.getByRole('dialog', { name: WHATS_NEW })).toHaveCount(0);
    await popup.close();

    expect(await storedRecord(storage)).toEqual({ installedVersion: WHATS_NEW_UPDATE_VERSION });
  });

  /** An update from 1.9.0: installed then, never closed What's new since */
  const UPDATED_FROM_1_9 = { installedVersion: '1.9.0' };

  test('update case: the sheet shows, Got it writes the Last seen Release, and the next opening shows nothing', async ({ context, extensionId }) => {
    const storage = await storageAfterInstall(context, extensionId, WHATS_NEW_UPDATE_VERSION);
    await seedPopup(storage, { [WHATS_NEW_KEY]: UPDATED_FROM_1_9 });

    const first = await openPopup(context, extensionId);
    const sheet = first.getByRole('dialog', { name: WHATS_NEW });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(`New in ${WHATS_NEW_UPDATE_VERSION}`, { exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Got it' })).toBeFocused();
    // Not written while the sheet shows: only a close marks the Release seen
    expect(await storedRecord(storage)).toEqual(UPDATED_FROM_1_9);

    await sheet.getByRole('button', { name: 'Got it' }).click();
    await expect(sheet).toHaveCount(0);
    await expect.poll(async () => storedRecord(storage)).toEqual({ ...UPDATED_FROM_1_9, lastSeenVersion: WHATS_NEW_UPDATE_VERSION });
    await first.close();

    const second = await openPopup(context, extensionId);
    await expectLibraryWithoutWhatsNew(second);
    await second.close();

    expect(await storedRecord(storage)).toEqual({ ...UPDATED_FROM_1_9, lastSeenVersion: WHATS_NEW_UPDATE_VERSION });
  });

  test('update case, closed without an action: the popup closed while the sheet shows, the next opening shows it again', async ({ context, extensionId }) => {
    const storage = await storageAfterInstall(context, extensionId, WHATS_NEW_UPDATE_VERSION);
    await seedPopup(storage, { [WHATS_NEW_KEY]: UPDATED_FROM_1_9 });

    const first = await openPopup(context, extensionId);
    await expect(first.getByRole('dialog', { name: WHATS_NEW })).toBeVisible();
    await first.close();
    expect(await storedRecord(storage)).toEqual(UPDATED_FROM_1_9);

    const second = await openPopup(context, extensionId);
    await expect(second.getByRole('dialog', { name: WHATS_NEW })).toBeVisible();
    await second.close();
  });

  for (const close of ['Escape', 'the backdrop'] as const) {
    test(`update case: a close by ${close} writes the Last seen Release too, and the next opening shows nothing`, async ({ context, extensionId }) => {
      const storage = await storageAfterInstall(context, extensionId, WHATS_NEW_UPDATE_VERSION);
      await seedPopup(storage, { [WHATS_NEW_KEY]: UPDATED_FROM_1_9 });

      const first = await openPopup(context, extensionId);
      const sheet = first.getByRole('dialog', { name: WHATS_NEW });
      await expect(sheet).toBeVisible();
      if (close === 'Escape') {
        await first.keyboard.press('Escape');
      } else {
        // The backdrop shows above the sheet only: its top-left corner
        await first.getByTestId('whats-new-backdrop').click({ position: { x: 8, y: 8 } });
      }
      await expect(sheet).toHaveCount(0);
      await expect.poll(async () => storedRecord(storage)).toEqual({ ...UPDATED_FROM_1_9, lastSeenVersion: WHATS_NEW_UPDATE_VERSION });
      await first.close();

      const second = await openPopup(context, extensionId);
      await expectLibraryWithoutWhatsNew(second);
      await second.close();
    });
  }
});

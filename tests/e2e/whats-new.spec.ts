/**
 * E2E: when What's new shows, in the real extension (My-Prompt-Manager-d1g.10)
 *
 * The extension runs as built, with the What's new record (`whatsNew`), the Welcome record
 * (`welcome`) and Debug mode (`promptLibrarySettings.debugMode`) seeded in storage. Each opening of
 * the popup is a new page, as when the user closes the popup and opens it again. The launch decision
 * (src/launch/decide.ts, My-Prompt-Manager-ojz.2) puts the Welcome before What's new: a first install
 * opens on the Welcome, never What's new, and Debug mode shows the Welcome at every opening, from
 * its first step, and writes nothing (My-Prompt-Manager-ojz.4). What's new follows the Welcome in
 * Debug mode once it is finished in that opening: proven by the hook and App tests until the
 * Welcome has the controls that finish it (My-Prompt-Manager-ojz.7, .9; e2e My-Prompt-Manager-ojz.12).
 *
 * Three builds. dist/ is at the repository's manifest version: there a first install opens on the
 * Welcome, and a Last seen Release equal to that version, or Debug mode switched off again, leaves the
 * Library alone. The registry has Release notes for some Releases only, so the cases that need one or
 * the other run on copies of the build at a fixed version (fixtures/whats-new-build.ts), whatever the
 * manifest's version:
 *
 * - dist-e2e-whats-new/ at 2.0.0, which has Release notes: the sheet shows, a close writes the Last
 *   seen Release, and the next opening shows nothing; a first install of 2.0.0 shows the Welcome, not
 *   What's new;
 * - dist-e2e-without-notes/ at 1.9.0, which has none: an update to it shows nothing. That check holds
 *   for any record, since the Release has no notes: there it only proves the record is left as it was.
 *
 * The rules themselves are proven on 2.0.0 and by the hook and App tests
 * (src/launch/__tests__/decide.test.ts, src/hooks/__tests__/useLaunchScreen.test.ts,
 * src/components/__tests__/App.whatsNew.test.tsx).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { BrowserContext, Page } from '@playwright/test';

import { SITE_SETTINGS_KEY } from '../../src/services/siteSettings';
import { WELCOME_KEY } from '../../src/welcome/storage';
import { WHATS_NEW_KEY } from '../../src/whatsNew/storage';
import { createStorageController, type ExtensionStorage, expect, test, waitForFirstInstallRecords } from './fixtures/extension';
import {
  RELEASE_WITHOUT_NOTES,
  RELEASE_WITHOUT_NOTES_EXTENSION_PATH,
  WHATS_NEW_UPDATE_EXTENSION_PATH,
  WHATS_NEW_UPDATE_VERSION
} from './fixtures/whats-new-build';
import { createPromptSeed, seedLibrary } from './utils/storage';

const WHATS_NEW = /what.s new/i;

/** The installed Release of dist/: the repository's manifest version */
const INSTALLED = (JSON.parse(readFileSync(path.resolve(process.cwd(), 'manifest.json'), 'utf-8')) as { version: string }).version;

/** Time for the popup to read storage and decide, once the Library shows, before "not shown" is asserted */
const DECISION_SETTLE_MS = 750;

/** The store of an existing user: a Library, the Welcome done (as every update marks it), and `extra` */
const seedPopup = async (storage: ExtensionStorage, extra: Record<string, unknown>): Promise<void> => {
  await seedLibrary(storage, { prompts: [createPromptSeed({ id: 'p1', title: 'Draft email', content: 'Hello' })] });
  await storage.seed({ [WELCOME_KEY]: { status: 'done' }, ...extra });
};

/** The Welcome, and nothing of the Library nor What's new once the decision had time to land */
const expectWelcomeWithoutWhatsNew = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('welcome')).toBeVisible();
  await page.waitForTimeout(DECISION_SETTLE_MS);
  await expect(page.getByRole('dialog', { name: WHATS_NEW })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /my prompt manager/i })).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
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

/** Every key of storage but the Library's (the Prompts and the Categories), each as bytes, in key order */
const storageButTheLibrary = async (storage: ExtensionStorage): Promise<ReadonlyArray<readonly [string, string]>> => {
  const all = await storage.get<Record<string, unknown>>();
  return Object.keys(all)
    .filter((key) => key !== 'prompts' && key !== 'categories')
    .sort()
    .map((key) => [key, JSON.stringify(all[key])] as const);
};

const storedRecord = async (storage: ExtensionStorage): Promise<unknown> =>
  (await storage.get<Record<string, unknown>>(WHATS_NEW_KEY))[WHATS_NEW_KEY];

/**
 * The storage of a build as its first install left it: Chrome installs the copy when it loads it,
 * and the service worker records `installedVersion` = the build's version, and the Welcome as
 * pending. Nothing is cleared or seeded
 */
const storageOfFirstInstall = async (context: BrowserContext, extensionId: string, version: string): Promise<ExtensionStorage> => {
  const worker = context.serviceWorkers().find((candidate) => candidate.url().startsWith(`chrome-extension://${extensionId}/`));
  if (worker === undefined) {
    throw new Error(`The service worker of the ${version} build is not running`);
  }
  const storage = createStorageController(worker);
  await expect.poll(async () => storedRecord(storage)).toEqual({ installedVersion: version });
  await waitForFirstInstallRecords(storage);
  return storage;
};

/**
 * The storage of a build, emptied once its service worker has recorded the first install.
 * Waiting for those writes first means none can land over the seed of the test: the seed is the last write
 */
const storageAfterInstall = async (context: BrowserContext, extensionId: string, version: string): Promise<ExtensionStorage> => {
  const storage = await storageOfFirstInstall(context, extensionId, version);
  await storage.reset();
  return storage;
};

test.describe(`What's new after an update to ${RELEASE_WITHOUT_NOTES}, a Release without notes`, () => {
  test.use({ extensionPath: RELEASE_WITHOUT_NOTES_EXTENSION_PATH });

  test(`update case: an update from 1.8.0 to ${RELEASE_WITHOUT_NOTES} shows nothing and writes no Last seen Release`, async ({ context, extensionId }) => {
    const storage = await storageAfterInstall(context, extensionId, RELEASE_WITHOUT_NOTES);
    await seedPopup(storage, { [WHATS_NEW_KEY]: { installedVersion: '1.8.0' } });

    for (let opening = 0; opening < 2; opening++) {
      const popup = await openPopup(context, extensionId);
      await expectLibraryWithoutWhatsNew(popup);
      await popup.close();
    }

    expect(await storedRecord(storage)).toEqual({ installedVersion: '1.8.0' });
  });
});

test.describe("What's new in the real extension", () => {
  test('reopen after a close: with the installed Release as the Last seen Release, nothing shows and the record stays', async ({ context, extensionId }) => {
    const storage = await storageAfterInstall(context, extensionId, INSTALLED);
    const record = { installedVersion: '1.8.0', lastSeenVersion: INSTALLED };
    await seedPopup(storage, { [WHATS_NEW_KEY]: record });

    const popup = await openPopup(context, extensionId);
    await expectLibraryWithoutWhatsNew(popup);
    await popup.close();

    expect(await storedRecord(storage)).toEqual(record);
  });

  test("first install: the service worker records the installed Release, and the popup opens on the Welcome, not What's new", async ({ context, extensionId }) => {
    // No storage fixture here: storage is as the first install left it, nothing seeded or cleared
    const storage = await storageOfFirstInstall(context, extensionId, INSTALLED);

    const popup = await openPopup(context, extensionId);
    await expectWelcomeWithoutWhatsNew(popup);
    await expect(popup.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '0');
    await popup.close();

    expect(await storedRecord(storage)).toEqual({ installedVersion: INSTALLED });
  });

  test("Debug mode: the Welcome from its first step at each of two openings over an existing user's Library, the records left as they were, and Debug mode off gives the normal decision back", async ({ context, extensionId }) => {
    const storage = await storageAfterInstall(context, extensionId, INSTALLED);
    const record = { installedVersion: '1.8.0', lastSeenVersion: INSTALLED };
    await seedPopup(storage, { [WHATS_NEW_KEY]: record, [SITE_SETTINGS_KEY]: { enabledSites: [], customSites: [], debugMode: true } });

    for (let opening = 0; opening < 2; opening++) {
      const popup = await openPopup(context, extensionId);
      await expectWelcomeWithoutWhatsNew(popup);
      await expect(popup.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '0');
      await popup.close();

      expect(await storedRecord(storage)).toEqual(record);
      expect((await storage.get<Record<string, unknown>>(WELCOME_KEY))[WELCOME_KEY]).toEqual({ status: 'done' });
    }

    // Debug mode off: the Library, as before the Debug session
    await storage.seed({ [SITE_SETTINGS_KEY]: { enabledSites: [], customSites: [], debugMode: false } });
    const popup = await openPopup(context, extensionId);
    await expectLibraryWithoutWhatsNew(popup);
    await expect(popup.getByTestId('welcome')).toHaveCount(0);
    await popup.close();

    expect(await storedRecord(storage)).toEqual(record);
  });
});

test.describe(`What's new after the update to ${WHATS_NEW_UPDATE_VERSION}, a Release that has Release notes`, () => {
  test.use({ extensionPath: WHATS_NEW_UPDATE_EXTENSION_PATH });

  test("first install: a Release that has Release notes opens on the Welcome, never What's new, and the record stays as the service worker wrote it", async ({ context, extensionId }) => {
    // No storage fixture and no seed: storage is as the first install of 2.0.0 left it
    const storage = await storageOfFirstInstall(context, extensionId, WHATS_NEW_UPDATE_VERSION);

    const popup = await openPopup(context, extensionId);
    await expectWelcomeWithoutWhatsNew(popup);
    await popup.close();

    expect(await storedRecord(storage)).toEqual({ installedVersion: WHATS_NEW_UPDATE_VERSION });
  });

  /** An update from 1.9.0: installed then, never closed What's new since */
  const UPDATED_FROM_1_9 = { installedVersion: '1.9.0' };

  test('keyboard: Tab from Got it reaches the scrolling body, which draws a solid focus ring', async ({ context, extensionId }) => {
    const storage = await storageAfterInstall(context, extensionId, WHATS_NEW_UPDATE_VERSION);
    await seedPopup(storage, { [WHATS_NEW_KEY]: UPDATED_FROM_1_9 });

    const popup = await openPopup(context, extensionId);
    const sheet = popup.getByRole('dialog', { name: WHATS_NEW });
    await expect(sheet.getByRole('button', { name: 'Got it' })).toBeFocused();

    await popup.keyboard.press('Tab');

    const body = sheet.getByRole('region', { name: 'Release notes' });
    await expect(body).toBeFocused();
    const outline = await body.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(outline.style).toBe('solid');
    expect(outline.width).toBeGreaterThan(0);
    await popup.close();
  });

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

  /** Site settings as the Settings switch stores them, Debug mode off then on */
  const SITE_SETTINGS = { enabledSites: [], customSites: [], debugMode: false };

  const DEBUG_SESSIONS = [
    {
      name: "an existing user whose What's new is still to show",
      seed: (storage: ExtensionStorage) => seedPopup(storage, { [WHATS_NEW_KEY]: UPDATED_FROM_1_9, [SITE_SETTINGS_KEY]: SITE_SETTINGS }),
      before: "What's new",
      expectBefore: async (page: Page) => {
        await expect(page.getByRole('dialog', { name: WHATS_NEW })).toBeVisible();
        await expect(page.getByTestId('welcome')).toHaveCount(0);
      }
    },
    {
      name: 'a new user who closed the Welcome at its last step, a Pack selected',
      seed: (storage: ExtensionStorage) =>
        storage.seed({
          [WELCOME_KEY]: { status: 'pending', step: 2, packs: ['writing'] },
          [WHATS_NEW_KEY]: { installedVersion: WHATS_NEW_UPDATE_VERSION },
          [SITE_SETTINGS_KEY]: SITE_SETTINGS
        }),
      before: 'the Welcome at its last step',
      expectBefore: async (page: Page) => {
        await expectWelcomeWithoutWhatsNew(page);
        await expect(page.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '2');
      }
    }
  ] as const;

  for (const session of DEBUG_SESSIONS) {
    test(`Debug mode, ${session.name}: the Welcome from its first step at each of three openings, never What's new over it, every key but the Library's as it was; Debug mode off: ${session.before} again`, async ({ context, extensionId }) => {
      const storage = await storageAfterInstall(context, extensionId, WHATS_NEW_UPDATE_VERSION);
      await session.seed(storage);
      const before = await storageButTheLibrary(storage);

      await storage.seed({ [SITE_SETTINGS_KEY]: { ...SITE_SETTINGS, debugMode: true } });
      for (let opening = 0; opening < 3; opening++) {
        const popup = await openPopup(context, extensionId);
        await expectWelcomeWithoutWhatsNew(popup);
        await expect(popup.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '0');
        await popup.close();
      }
      await storage.seed({ [SITE_SETTINGS_KEY]: SITE_SETTINGS });

      expect(await storageButTheLibrary(storage)).toEqual(before);
      const popup = await openPopup(context, extensionId);
      await session.expectBefore(popup);
      await popup.close();
    });
  }

  for (const close of ['Escape', 'the backdrop'] as const) {
    test(`update case: a close by ${close} writes the Last seen Release too, and the next opening shows nothing`, async ({ context, extensionId }) => {
      const storage = await storageAfterInstall(context, extensionId, WHATS_NEW_UPDATE_VERSION);
      await seedPopup(storage, { [WHATS_NEW_KEY]: UPDATED_FROM_1_9 });

      const first = await openPopup(context, extensionId);
      const sheet = first.getByRole('dialog', { name: WHATS_NEW });
      await expect(sheet).toBeVisible();
      // The sheet listens to the keyboard once it has given Got it the focus: the Library mounts in the
      // same commit as the sheet (the launch decision), so it can be painted a moment before that
      await expect(sheet.getByRole('button', { name: 'Got it' })).toBeFocused();
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

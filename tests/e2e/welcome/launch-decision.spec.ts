/**
 * E2E: what the popup opens on, decided once by the launch decision (My-Prompt-Manager-ojz.2), over
 * the exact stores the service worker leaves after a relaunch and after a real update.
 *
 * The first install itself (the Welcome, never What's new) is in tests/e2e/whats-new.spec.ts; the
 * twelve scenarios are My-Prompt-Manager-ojz.12's.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { BrowserContext, Page } from '@playwright/test';

import { WELCOME_KEY } from '../../../src/welcome/storage';
import { WHATS_NEW_KEY } from '../../../src/whatsNew/storage';
import {
  createStorageController,
  type ExtensionStorage,
  expect,
  launchExtensionContext,
  test,
  waitForBackgroundTarget,
  waitForFirstInstallRecords
} from '../fixtures/extension';
import { copyBuildAt, updateExtensionInPlace } from '../fixtures/extension-update';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const WHATS_NEW = /what.s new/i;

/** Time for a screen that should not come to show up, once the Library shows */
const DECISION_SETTLE_MS = 750;

/** A Library as a user of 1.9.0 has it */
const LIBRARY = [
  createPromptSeed({ id: 'p1', title: 'Draft email', content: 'Write a follow-up email to {{name}}.' }),
  createPromptSeed({ id: 'p2', title: 'Summarize', content: 'Summarize this in three bullets.' })
];

const recordOf = async (storage: ExtensionStorage, key: string): Promise<unknown> =>
  (await storage.get<Record<string, unknown>>(key))[key];

const storageOf = async (context: BrowserContext): Promise<{ storage: ExtensionStorage; extensionId: string }> => {
  const background = await waitForBackgroundTarget(context);
  return { storage: createStorageController(background), extensionId: new URL(background.url()).host };
};

/**
 * A browser on a profile and an extension folder of its own, removed when the test ends; removed at
 * once when the copy or the launch fails, since the test then has no install to dispose of
 */
const ownInstall = async (version: string) => {
  const folders: string[] = [];
  const removeFolders = async (): Promise<void> => {
    await Promise.all(folders.map((folder) => fs.rm(folder, { recursive: true, force: true })));
  };
  let profile: string;
  let extensionPath: string;
  let context: BrowserContext;
  try {
    profile = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-launch-profile-'));
    folders.push(profile);
    extensionPath = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-launch-extension-'));
    folders.push(extensionPath);
    copyBuildAt(extensionPath, version);
    context = await launchExtensionContext(profile, extensionPath);
  } catch (error) {
    await removeFolders();
    throw error;
  }

  return {
    extensionPath,
    get context(): BrowserContext {
      return context;
    },
    /** Closes the browser and launches it again on the same profile, as a restart of Chrome */
    restart: async (): Promise<void> => {
      await context.close();
      context = await launchExtensionContext(profile, extensionPath);
    },
    /** Closes the browser, then removes both folders, even when the close fails */
    dispose: async (): Promise<void> => {
      try {
        await context.close();
      } finally {
        await removeFolders();
      }
    }
  };
};

const openPopup = async (context: BrowserContext, extensionId: string): Promise<Page> => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 400, height: 500 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  return page;
};

test.describe('The launch decision in the real extension', () => {
  test('a relaunch over a Library with no Welcome record: the service worker writes pending, the popup opens on the Library, not the Welcome, and records it done, so an emptied Library never brings it back', async () => {
    test.slow();
    const install = await ownInstall('1.9.0');
    try {
      const { storage } = await storageOf(install.context);
      await waitForFirstInstallRecords(storage);
      await storage.reset();
      await seedLibrary(storage, { prompts: LIBRARY });

      // Chromium installs the command-line extension afresh at each launch: 'install' fires, store kept,
      // and finds no Welcome record, so it writes pending over a Library
      await install.restart();
      const relaunched = await storageOf(install.context);
      await expect.poll(async () => recordOf(relaunched.storage, WELCOME_KEY)).toEqual({ status: 'pending', step: 0 });

      const popup = await openPopup(install.context, relaunched.extensionId);
      await expect(popup.getByTestId('prompt-card').filter({ hasText: 'Draft email' })).toBeVisible();
      await popup.waitForTimeout(DECISION_SETTLE_MS);
      await expect(popup.getByTestId('welcome')).toHaveCount(0);
      await expect(popup.getByRole('dialog', { name: WHATS_NEW })).toHaveCount(0);
      // Pending over a Library with Prompts is a Welcome finished: the opening records it done
      await expect.poll(async () => recordOf(relaunched.storage, WELCOME_KEY)).toEqual({ status: 'done' });
      await popup.close();

      // The user deletes every Prompt: the next opening shows the empty Library, never the Welcome
      await relaunched.storage.seed({ prompts: [] });
      const emptied = await openPopup(install.context, relaunched.extensionId);
      await expect(emptied.getByRole('heading', { name: /my prompt manager/i })).toBeVisible();
      await emptied.waitForTimeout(DECISION_SETTLE_MS);
      await expect(emptied.getByTestId('welcome')).toHaveCount(0);
      await emptied.close();
    } finally {
      await install.dispose();
    }
  });

  test('a real update of an existing user from 1.9.0 to 2.0.0, a Release with notes: the Library and What\'s new, never the Welcome', async () => {
    test.slow();
    const install = await ownInstall('1.9.0');
    try {
      const { storage, extensionId } = await storageOf(install.context);
      // The exact store of a 1.9.0 user: a Library, no What's new record, no Welcome record
      await waitForFirstInstallRecords(storage);
      await storage.reset();
      await seedLibrary(storage, { prompts: LIBRARY });

      const worker = await updateExtensionInPlace(install.context, extensionId, install.extensionPath, '2.0.0');
      const updated = createStorageController(worker);
      await expect.poll(async () => recordOf(updated, WELCOME_KEY)).toEqual({ status: 'done' });

      const popup = await openPopup(install.context, extensionId);
      const sheet = popup.getByRole('dialog', { name: WHATS_NEW });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText('New in 2.0.0', { exact: true })).toBeVisible();
      await expect(popup.getByTestId('welcome')).toHaveCount(0);

      await sheet.getByRole('button', { name: 'Got it' }).click();
      await expect(sheet).toHaveCount(0);
      await expect(popup.getByTestId('prompt-card').filter({ hasText: 'Draft email' })).toBeVisible();
      await expect.poll(async () => recordOf(updated, WHATS_NEW_KEY)).toEqual({ installedVersion: '1.9.0', lastSeenVersion: '2.0.0' });
      await popup.close();

      // The next opening: the Library alone
      const next = await openPopup(install.context, extensionId);
      await expect(next.getByTestId('prompt-card').filter({ hasText: 'Draft email' })).toBeVisible();
      await next.waitForTimeout(DECISION_SETTLE_MS);
      await expect(next.getByTestId('welcome')).toHaveCount(0);
      await expect(next.getByRole('dialog', { name: WHATS_NEW })).toHaveCount(0);
      await next.close();
    } finally {
      await install.dispose();
    }
  });
});

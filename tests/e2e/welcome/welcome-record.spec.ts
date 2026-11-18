/**
 * E2E: the Welcome record the service worker writes, in the real extension (My-Prompt-Manager-ojz.1)
 *
 * Record level only: what storage holds after a first install, an update and a restart. What the
 * popup shows for each record is the launch decision's (My-Prompt-Manager-ojz.2) and the scenario
 * tests' (My-Prompt-Manager-ojz.12).
 *
 * The update is a real one: a build at a higher version copied over the loaded folder, then the
 * Reload of chrome://extensions, which fires `onInstalled` 'update' with the previous version
 * (fixtures/extension-update.ts). A relaunch fires 'install' again instead, store kept.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { BrowserContext } from '@playwright/test';

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

/** The Release before the Welcome: its users have a Library and no Welcome record */
const PREVIOUS = '1.9.0';
/** The Release that brings the Welcome */
const UPDATED = '2.0.0';

/** Time for a write that should not happen to land, once the event's other write has landed */
const SETTLE_MS = 500;

/** Lets a write that should not happen land before the record is read */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

const recordOf = async (storage: ExtensionStorage, key: string): Promise<unknown> =>
  (await storage.get<Record<string, unknown>>(key))[key];

/** The storage of the extension, read through its running service worker */
const storageOf = async (context: BrowserContext): Promise<{ storage: ExtensionStorage; extensionId: string }> => {
  const background = await waitForBackgroundTarget(context);
  return { storage: createStorageController(background), extensionId: new URL(background.url()).host };
};

/**
 * A browser on a profile and an extension folder of its own, so the test can restart it and update
 * the extension in place. Removed, browser closed, when the test ends.
 */
const ownInstall = async (version: string) => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-welcome-profile-'));
  const extensionPath = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-welcome-extension-'));
  copyBuildAt(extensionPath, version);
  let context = await launchExtensionContext(profile, extensionPath);

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
    dispose: async (): Promise<void> => {
      await context.close();
      await fs.rm(profile, { recursive: true, force: true });
      await fs.rm(extensionPath, { recursive: true, force: true });
    }
  };
};

/** A Library as a user of 1.9.0 has it */
const LIBRARY = [
  createPromptSeed({ id: 'p1', title: 'Draft email', content: 'Write a follow-up email to {{name}}.' }),
  createPromptSeed({ id: 'p2', title: 'Summarize', content: 'Summarize this in three bullets.' })
];

test.describe('The Welcome record in the real extension', () => {
  test('first install: the service worker records the Welcome as pending at the first step', async ({ context }) => {
    // No storage fixture: storage is as the first install left it, nothing seeded or cleared
    const { storage } = await storageOf(context);

    await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'pending', step: 0 });
  });

  test(`update of an existing user: a real update from ${PREVIOUS} marks the Welcome done and keeps the Library`, async () => {
    test.slow();
    const install = await ownInstall(PREVIOUS);
    try {
      const { storage, extensionId } = await storageOf(install.context);
      // The exact store of a 1.9.0 user: a Library, no What's new record, no Welcome record
      await waitForFirstInstallRecords(storage);
      await storage.reset();
      await seedLibrary(storage, { prompts: LIBRARY });

      const worker = await updateExtensionInPlace(install.context, extensionId, install.extensionPath, UPDATED);
      const updated = createStorageController(worker);

      // onInstalled fired 'update' with the previous version: the What's new record has it as the Release of install
      await expect.poll(async () => recordOf(updated, WHATS_NEW_KEY)).toEqual({ installedVersion: PREVIOUS });
      await expect.poll(async () => recordOf(updated, WELCOME_KEY)).toEqual({ status: 'done' });
      expect((await updated.getPrompts()).map((prompt) => prompt.title)).toEqual(['Draft email', 'Summarize']);
    } finally {
      await install.dispose();
    }
  });

  test('restart then update of a user who finished the Welcome: the restart and the update both keep it done', async () => {
    test.slow();
    const install = await ownInstall(PREVIOUS);
    try {
      const { storage } = await storageOf(install.context);
      await waitForFirstInstallRecords(storage);
      await storage.reset();
      // The Welcome finished. No What's new record: the service worker's next write of it shows when an event has run
      await seedLibrary(storage, { prompts: LIBRARY });
      await storage.seed({ [WELCOME_KEY]: { status: 'done' } });

      // Restart: Chromium installs the command-line extension afresh, so onInstalled fires 'install', store kept
      await install.restart();
      const restarted = await storageOf(install.context);
      await expect.poll(async () => recordOf(restarted.storage, WHATS_NEW_KEY)).toEqual({ installedVersion: PREVIOUS });
      await settle();
      expect(await recordOf(restarted.storage, WELCOME_KEY)).toEqual({ status: 'done' });

      // Update: onInstalled fires 'update' from PREVIOUS
      await restarted.storage.seed({ [WHATS_NEW_KEY]: {} });
      const worker = await updateExtensionInPlace(install.context, restarted.extensionId, install.extensionPath, UPDATED);
      const updated = createStorageController(worker);
      await expect.poll(async () => recordOf(updated, WHATS_NEW_KEY)).toEqual({ installedVersion: PREVIOUS });
      await settle();
      expect(await recordOf(updated, WELCOME_KEY)).toEqual({ status: 'done' });
      expect((await updated.getPrompts()).map((prompt) => prompt.title)).toEqual(['Draft email', 'Summarize']);
    } finally {
      await install.dispose();
    }
  });
});

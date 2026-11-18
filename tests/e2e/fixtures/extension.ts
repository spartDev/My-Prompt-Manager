import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { BrowserContext, Page, Worker } from '@playwright/test';
import { test as base, chromium } from '@playwright/test';

import type { Category, Prompt, Settings } from '../../../src/types';
import { parseWelcomeRecord, WELCOME_KEY } from '../../../src/welcome/storage';
import { parseWhatsNewRecord, WHATS_NEW_KEY } from '../../../src/whatsNew/storage';

/** The extension Chromium loads: the build in dist/, unless a spec sets another with test.use({ extensionPath }) */
export const DEFAULT_EXTENSION_PATH = path.resolve(process.cwd(), 'dist');

type ExtensionOptions = {
  extensionPath: string;
};

type ExtensionFixtures = {
  context: BrowserContext;
  page: Page;
  extensionId: string;
  storage: ExtensionStorage;
};

type BackgroundTarget = Page | Worker;

export type ExtensionStorage = {
  reset: () => Promise<void>;
  seed: (data: Record<string, unknown>) => Promise<void>;
  seedPrompts: (prompts: Prompt[]) => Promise<void>;
  seedCategories: (categories: Category[]) => Promise<void>;
  seedSettings: (settings: Settings) => Promise<void>;
  get: <T = Record<string, unknown>>(keys?: string | string[]) => Promise<T>;
  getPrompts: () => Promise<Prompt[]>;
  getCategories: () => Promise<Category[]>;
  getSettings: () => Promise<Settings | undefined>;
};

export const waitForBackgroundTarget = async (context: BrowserContext): Promise<BackgroundTarget> => {
  // Extended timeout for CI environments
  const deadline = Date.now() + (process.env.CI ? 120_000 : 30_000);
  const isCI = process.env.CI;

  const findWorker = (): Worker | undefined =>
    context
      .serviceWorkers()
      .find((worker) => worker.url().startsWith('chrome-extension://'));

  const findBackgroundPage = (): Page | undefined =>
    context
      .backgroundPages()
      .find((page) => page.url().startsWith('chrome-extension://'));

  // In CI, we need to be more patient and try different approaches
  if (isCI) {
    // Wait for the extension to fully load first
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('[CI] Waiting for extension background target...');
  }

  let attemptCount = 0;
  while (Date.now() < deadline) {
    attemptCount++;

    // Log progress in CI for debugging
    if (isCI && attemptCount % 10 === 0) {

      console.log(`[CI] Background target search attempt ${String(attemptCount)}...`);
    }

    const worker = findWorker();
    if (worker) {
      if (isCI) {

        console.log(`[CI] Found service worker after ${String(attemptCount)} attempts`);
      }
      return worker;
    }

    const backgroundPage = findBackgroundPage();
    if (backgroundPage) {
      if (isCI) {

        console.log(`[CI] Found background page after ${String(attemptCount)} attempts`);
      }
      return backgroundPage;
    }

    try {
      const awaitedWorker = await context.waitForEvent('serviceworker', {
        timeout: isCI ? 5_000 : 1_000,
        predicate: (candidate) => candidate.url().startsWith('chrome-extension://'),
      });
      if (awaitedWorker) {
        if (isCI) {

          console.log(`[CI] Service worker event triggered after ${String(attemptCount)} attempts`);
        }
        return awaitedWorker;
      }
    } catch (error) {
      // Log errors in CI for debugging
      if (isCI && attemptCount % 20 === 0) {

        console.log(`[CI] Service worker wait failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // In CI, add a longer delay between attempts
    await new Promise(resolve => setTimeout(resolve, isCI ? 750 : 100));
  }

  // Final attempts before giving up
  const fallbackWorker = findWorker();
  if (fallbackWorker) {
    if (isCI) {

      console.log('[CI] Found service worker in final attempt');
    }
    return fallbackWorker;
  }

  const fallbackPage = findBackgroundPage();
  if (fallbackPage) {
    if (isCI) {

      console.log('[CI] Found background page in final attempt');
    }
    return fallbackPage;
  }

  // More detailed error message for debugging
  const serviceWorkers = context.serviceWorkers();
  const backgroundPages = context.backgroundPages();
  const allPages = context.pages();

  console.error('[CI] Extension loading debug info:', {
    serviceWorkerCount: serviceWorkers.length,
    serviceWorkerUrls: serviceWorkers.map(w => w.url()),
    backgroundPageCount: backgroundPages.length,
    backgroundPageUrls: backgroundPages.map(p => p.url()),
    allPageCount: allPages.length,
    allPageUrls: allPages.map(p => p.url()),
    attemptCount,
    timeoutDuration: isCI ? '120s' : '30s'
  });

  throw new Error(
    `Extension background target not found after ${isCI ? '120' : '30'}s (${String(attemptCount)} attempts). ` +
    `Found ${String(serviceWorkers.length)} service workers: [${serviceWorkers.map(w => w.url()).join(', ')}], ` +
    `Found ${String(backgroundPages.length)} background pages: [${backgroundPages.map(p => p.url()).join(', ')}], ` +
    `All pages: [${allPages.map(p => p.url()).join(', ')}]`
  );
};

/** Reads and writes `chrome.storage.local` through the extension's background; the `storage` fixture is one, cleared before and after the test */
export const createStorageController = (target: BackgroundTarget): ExtensionStorage => {
  const wrapChromeCall = <T, Arg>(fn: (arg: Arg) => Promise<T>, arg: Arg): Promise<T> => {
    // Page and Worker share this evaluate signature, but TypeScript cannot call it on their union, and
    // Playwright types the function's argument as Unboxed<Arg>, which a generic Arg cannot be shown to match
    return (target as Worker).evaluate(fn as (arg: unknown) => Promise<T>, arg);
  };

  const normalizeErrors = async <T>(promise: Promise<T>): Promise<T> => {
    try {
      return await promise;
    } catch (error) {
      if (typeof error === 'string') {
        throw new Error(error);
      }
      throw error;
    }
  };

  const ensureStorageReady = async () => {
    // Increase attempts and delay for CI environments
    const maxAttempts = process.env.CI ? 50 : 20;
    const delay = process.env.CI ? 200 : 100;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const ready = await normalizeErrors(
        wrapChromeCall(
          () => Promise.resolve(Boolean(typeof chrome !== 'undefined' && chrome.storage?.local)),
          null
        )
      );

      if (ready) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    throw new Error(`Timed out waiting for chrome.storage.local after ${String(maxAttempts)} attempts (${String((maxAttempts * delay) / 1000)}s)`);
  };

  const clearStorage = async () => {
    await ensureStorageReady();
    await normalizeErrors(
      wrapChromeCall(
        () =>
          new Promise<void>((resolve, reject) => {
            chrome.storage.local.clear(() => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError?.message) {
                reject(new Error(runtimeError.message));
                return;
              }
              resolve();
            });
          }),
        null
      )
    );
  };

  const seedData = async (data: Record<string, unknown>) => {
    await ensureStorageReady();
    await normalizeErrors(
      wrapChromeCall(
        (payload) =>
          new Promise<void>((resolve, reject) => {
            chrome.storage.local.set(payload, () => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError?.message) {
                reject(new Error(runtimeError.message));
                return;
              }
              resolve();
            });
          }),
        data
      )
    );
  };

  const getData = async <T = Record<string, unknown>>(keys?: string | string[]) => {
    await ensureStorageReady();
    return normalizeErrors(
      wrapChromeCall(
        (requestedKeys) =>
          new Promise<T>((resolve, reject) => {
            chrome.storage.local.get(requestedKeys ?? null, (result) => {
              const runtimeError = chrome.runtime?.lastError;
              if (runtimeError?.message) {
                reject(new Error(runtimeError.message));
                return;
              }
              resolve(result as T);
            });
          }),
        keys ?? null
      )
    );
  };

  const getSingle = async <T>(key: string): Promise<T | undefined> => {
    const result = (await getData<Record<string, T>>(key)) ?? ({} as Record<string, T>);
    return result[key];
  };

  return {
    reset: clearStorage,
    seed: seedData,
    get: getData,
    seedPrompts: async (prompts: Prompt[]) => { await seedData({ prompts }); },
    seedCategories: async (categories: Category[]) => { await seedData({ categories }); },
    seedSettings: async (settings: Settings) => { await seedData({ settings }); },
    getPrompts: async () => (await getSingle<Prompt[]>('prompts')) ?? [],
    getCategories: async () => (await getSingle<Category[]>('categories')) ?? [],
    getSettings: async () => await getSingle<Settings>('settings'),
  };
};

/**
 * Launches Chromium on the profile in `userDataDir` with the extension of `extensionPath` loaded,
 * its start-up tab closed. The `context` fixture launches it on a fresh profile; a test that
 * restarts the browser closes its context and launches again on the same profile.
 *
 * Chromium installs an extension loaded with --load-extension afresh at every launch: each launch
 * fires `onInstalled` with reason 'install', never 'update', and keeps `chrome.storage.local`.
 * A real update is `updateExtensionInPlace` of fixtures/extension-update.ts.
 */
export const launchExtensionContext = async (userDataDir: string, extensionPath: string): Promise<BrowserContext> => {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: process.env.CI ? true : false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      // Essential args for CI stability and extension loading
      ...(process.env.CI ? [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-default-apps',
        '--disable-extensions-file-access-check',
        '--disable-dev-shm-usage', // Prevents CI memory issues
        '--disable-gpu', // Prevents GPU-related crashes in CI
        '--no-sandbox', // Required for many CI environments
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-ipc-flooding-protection',
      ] : []),
    ],
    // Increase timeouts for CI environments
    timeout: process.env.CI ? 120_000 : 30_000,
  });

  for (const page of context.pages()) {
    await page.close();
  }
  return context;
};

/** Whether the store holds what the service worker writes at a first install */
const hasFirstInstallRecords = (stored: Record<string, unknown>): boolean =>
  parseWhatsNewRecord(stored[WHATS_NEW_KEY]).installedVersion !== undefined &&
  parseWelcomeRecord(stored[WELCOME_KEY])?.status === 'pending';

/**
 * Waits until the service worker has written what a first install writes: the Release of install
 * (`whatsNew`) and the Welcome as pending (`welcome`). Every test starts on a fresh profile, a first
 * install, and those writes run on their own once the extension loads: a reset made before them
 * would see one land after it, over the test's seed, and a Welcome record no spec seeded would
 * cover the popup.
 */
export const waitForFirstInstallRecords = async (storage: ExtensionStorage): Promise<void> => {
  const deadline = Date.now() + (process.env.CI ? 60_000 : 15_000);
  let stored: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    stored = await storage.get([WHATS_NEW_KEY, WELCOME_KEY]);
    if (hasFirstInstallRecords(stored)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`The service worker did not record the first install; storage holds ${JSON.stringify(stored)}`);
};

export const test = base.extend<ExtensionOptions & ExtensionFixtures>({
  extensionPath: [DEFAULT_EXTENSION_PATH, { option: true }],

  context: async ({ extensionPath }, use) => {
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-claude-ext-'));
    const context = await launchExtensionContext(userDataDir, extensionPath);

    try {
      await use(context);
    } finally {
      await context.close();
      await fs.rm(userDataDir, { recursive: true, force: true });
    }
  },

  storage: async ({ context }, use) => {
    const background = await waitForBackgroundTarget(context);
    const controller = createStorageController(background);

    // Every test starts on a first install: reset only once its records are written, or one lands after the reset
    await waitForFirstInstallRecords(controller);
    await controller.reset();

    try {
      await use(controller);
    } finally {
      await controller.reset();
    }
  },

  extensionId: async ({ context }, use) => {
    const background = await waitForBackgroundTarget(context);
    const extensionId = new URL(background.url()).host;
    await use(extensionId);
  },

  // Starts on about:blank: the extension app must not run before the test seeds storage,
  // otherwise its first reads (e.g. getCategories() writing [Uncategorized]) race the seed.
  // Tests navigate themselves (page.goto(...) / navigateToContext).
  page: async ({ context, storage }, use) => {
    void storage;
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

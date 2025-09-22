/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-argument, react-hooks/rules-of-hooks, no-empty-pattern */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { BrowserContext, Page, Worker } from '@playwright/test';
import { chromium, test as base } from '@playwright/test';

import type { Prompt, Category, Settings } from '../../../src/types';

const extensionPath = path.resolve(process.cwd(), 'dist');

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

const waitForBackgroundTarget = async (context: BrowserContext): Promise<BackgroundTarget> => {
  const deadline = Date.now() + 30_000;

  const findWorker = (): Worker | undefined =>
    context
      .serviceWorkers()
      .find((worker) => worker.url().startsWith('chrome-extension://'));

  const findBackgroundPage = (): Page | undefined =>
    context
      .backgroundPages()
      .find((page) => page.url().startsWith('chrome-extension://'));

  while (Date.now() < deadline) {
    const worker = findWorker();
    if (worker) {
      return worker;
    }

    try {
      const awaitedWorker = await context.waitForEvent('serviceworker', {
        timeout: 1_000,
        predicate: (candidate) => candidate.url().startsWith('chrome-extension://'),
      });
      if (awaitedWorker) {
        return awaitedWorker;
      }
    } catch {
      // Continue polling until deadline
    }

    const backgroundPage = findBackgroundPage();
    if (backgroundPage) {
      return backgroundPage;
    }
  }

  const fallbackWorker = findWorker();
  if (fallbackWorker) {
    return fallbackWorker;
  }

  const fallbackPage = findBackgroundPage();
  if (fallbackPage) {
    return fallbackPage;
  }

  throw new Error('Extension background target not found');
};

const createStorageController = (target: BackgroundTarget): ExtensionStorage => {
  const wrapChromeCall = <T, Arg>(fn: (arg: Arg) => Promise<T>, arg: Arg): Promise<T> => {
    return target.evaluate(fn, arg);
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
    const maxAttempts = 20;
    const delay = 100;

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

    throw new Error('Timed out waiting for chrome.storage.local');
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

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-claude-ext-'));

    const headless = process.env.CI ? true : false;
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    for (const page of context.pages()) {
      await page.close();
    }

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

  page: async ({ context, extensionId, storage }, use) => {
    void storage;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

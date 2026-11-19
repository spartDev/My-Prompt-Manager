/**
 * E2E: the twelve acceptance scenarios of the Welcome, on the built extension (My-Prompt-Manager-ojz.12).
 *
 * One test per scenario, named "S<n> <scenario>" after the table of the epic (My-Prompt-Manager-ojz,
 * DESIGN): replay this file to see each one hold. Each runs end to end in its own words, even where
 * another spec of tests/e2e/welcome/ already proves a piece of it. Real events wherever Chromium
 * allows them:
 *
 * - a first install is a fresh profile with nothing seeded: the service worker writes its records on
 *   onInstalled 'install', and the test only waits for them;
 * - a restart of Chrome is the browser closed and launched again on the same profile;
 * - an update is a build at a higher version copied over the loaded folder, then the Reload of
 *   chrome://extensions, which fires onInstalled 'update' with the previous version
 *   (fixtures/extension-update.ts). A relaunch fires 'install' again, store kept (docs/TESTING.md);
 *   the tests of updates read which event fired from an observer of onInstalled added to their
 *   copies of the build (fixtures/oninstalled-probe.ts), besides the records the extension writes;
 * - Debug mode is switched on and off through the Settings switch, never seeded;
 * - a click is a Playwright click on the control, a close is the page closed (a click outside the
 *   popup) or the Welcome's own close button, a copy is read back from the clipboard.
 *
 * What Chromium does not allow: Playwright cannot click the toolbar icon, and the popup that
 * chrome.action.openPopup() opens is not a page it can drive. So "the popup" and "the side panel" are
 * their pages, src/popup.html at 400 x 500 and src/sidepanel.html at 360 x 720, each opening a new
 * page in a tab, as the e2e suite opens them everywhere.
 *
 * Builds: a new user installs the Release that brings the Welcome, 2.0.0, which has Release notes,
 * so What's new could show there and must not (dist-e2e-whats-new, fixtures/whats-new-build.ts). The
 * Debug scenarios run on dist/ at 1.9.0, a Release without notes, for an existing user updated from
 * 1.8.0 who never closed a What's new: a Debug session that wrote the Last seen Release would show
 * there. The tests of updates, S5, S7 and the two beside them (S7 with no Prompt, and a Welcome left
 * pending through an update, My-Prompt-Manager-ojz.18), run on copies of the build of their own
 * (`ownInstall`).
 *
 * S11 and S12 time the journey with the reading model of the epic's measurement plan, the words on
 * each screen read at 238 words a minute (Brysbaert 2019) plus 1.1 s of pointing and 0.2 s of click
 * per action (Keystroke-Level Model, Card, Moran & Newell), added to the machine time measured;
 * every value is logged and written to test-results/welcome/. The formal measure is
 * My-Prompt-Manager-ojz.13's.
 *
 * The last describe takes every way out of the Welcome that could end on an empty Library (Packs, no
 * Pack, Skip then no Pack, a refused add) to a Library with Prompts or an open editor (AC4).
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { BrowserContext, Locator, Page, Worker } from '@playwright/test';

import { parseSiteSettings, SITE_SETTINGS_KEY } from '../../../src/services/siteSettings';
import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { decideWhatsNew, isFirstInstall } from '../../../src/whatsNew/decide';
import { RELEASE_NOTES } from '../../../src/whatsNew/releaseNotes';
import { parseWhatsNewRecord, WHATS_NEW_KEY } from '../../../src/whatsNew/storage';
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
import { type OnInstalledEvent, onInstalledEvents } from '../fixtures/oninstalled-probe';
import { WHATS_NEW_UPDATE_EXTENSION_PATH, WHATS_NEW_UPDATE_VERSION } from '../fixtures/whats-new-build';
import { clickToClose } from '../utils/closingClick';
import { createPromptSeed, seedLibrary } from '../utils/storage';
import { emptyFiller, fillStorage } from '../utils/storageFiller';
import { typingDemoMs, watchWelcomeMotion } from '../utils/welcomeMotion';
import { PLATFORMS_CAPTION } from '../utils/welcomePlatforms';
import { promptWorkflows } from '../utils/workflows';

const OUTPUT_DIR = 'test-results/welcome';

/** The Release that brings the Welcome; the Release notes registry has notes for it */
const NEW_RELEASE = WHATS_NEW_UPDATE_VERSION;

/** The Release of dist/, the repository's manifest version: no Release notes */
const BUILT_RELEASE = '1.9.0';

/** Time for a screen that should not come to show up, once what shows instead is in view */
const SETTLE_MS = 750;

/** How long after the click that brings step 2 the S6 popup is closed: sooner than a person closes it */
const S6_CLOSE_AFTER_MS = 100;

const SURFACES = {
  popup: { file: 'popup', width: 400, height: 500 },
  sidepanel: { file: 'sidepanel', width: 360, height: 720 }
} as const;

type Surface = keyof typeof SURFACES;

/** The title of each step, as the user reads it */
const STEP_TITLES = ['Your best prompts, one tap away', 'Leave blanks, fill them later', 'Start with a pack'] as const;
/** Step 1's text: "here", on the popup and the side panel alike (My-Prompt-Manager-ojz.19) */
const STEP_1_TEXT = 'Save the prompts you reuse and find them in a second, here or right inside your AI chat.';

const DEFAULT_PACKS = PACKS.filter((pack) => pack.defaultSelected);
const promptsOf = (packs: typeof PACKS): number => packs.reduce((count, pack) => count + pack.prompts.length, 0);
const DEFAULT_COUNT = promptsOf(DEFAULT_PACKS);
const PACK_CONTENTS = new Set(PACKS.flatMap((pack) => pack.prompts.map((prompt) => prompt.content)));
const PACK_NAMES = new Set(PACKS.map((pack) => pack.name.toLowerCase()));
/** The second line of the Notification after an exit with Packs: the next step, in the AI chat (My-Prompt-Manager-ojz.19) */
const IN_THE_CHAT = 'Open your AI chat and type //';

// --- The reading model of the measurement plan (My-Prompt-Manager-ojz, description) ---

/** Silent reading of English non-fiction, words a minute (Brysbaert 2019) */
const READING_WPM = 238;
/** Keystroke-Level Model: pointing at a control (P), then pressing and releasing the mouse button (BB) */
const KLM_POINT_MS = 1100;
const KLM_CLICK_MS = 200;
const KLM_ACTION_MS = KLM_POINT_MS + KLM_CLICK_MS;

/** The journey targets of the spec */
const JOURNEY_TARGET_MS = 45_000;
const FIRST_COPY_TARGET_MS = 60_000;
const MAX_ACTIONS_TO_READY_LIBRARY = 2;
const MAX_CLICKS_TO_COPY_AFTER_WELCOME = 2;

const readingMs = (words: number): number => (words / READING_WPM) * 60_000;

// --- Locators ---

const welcome = (page: Page): Locator => page.getByTestId('welcome');
const primary = (page: Page): Locator => page.getByTestId('welcome-primary');
const cards = (page: Page): Locator => page.getByTestId('prompt-card');
const whatsNew = (page: Page): Locator => page.getByRole('dialog', { name: /what.s new/i });
const libraryHeading = (page: Page): Locator => page.getByRole('heading', { level: 1, name: 'My Prompt Manager', exact: true });
const packToggles = (page: Page): Locator => page.getByRole('group', { name: 'Packs' }).getByRole('button');
const packToggle = (page: Page, name: string): Locator => packToggles(page).filter({ hasText: name });
const notification = (page: Page): Locator => page.getByTestId('toast');
const editor = (page: Page): Locator => page.getByTestId('editor-sheet');
const debugSwitch = (page: Page): Locator => page.getByRole('switch', { name: 'Debug mode' });

// --- Openings ---

/** One opening of the popup or the side panel, in a page of its own; the caller closes it, as the user closes the popup */
const openExtension = async (context: BrowserContext, extensionId: string, surface: Surface = 'popup'): Promise<Page> => {
  const { file, width, height } = SURFACES[surface];
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
  return page;
};

/** The Welcome at `step` (0 for its first): its dot current, its title, Back from the second step on */
const expectWelcomeAt = async (page: Page, step: 0 | 1 | 2): Promise<void> => {
  await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
  await expect(page.getByRole('button', { name: `Step ${String(step + 1)} of 3` })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { level: 1, name: STEP_TITLES[step] })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(step === 0 ? 0 : 1);
  await expect(primary(page)).toBeEnabled();
};

/** The Welcome alone: no Library, no tab bar, and no What's new once the decision had time to land */
const expectWelcomeAlone = async (page: Page): Promise<void> => {
  await expect(welcome(page)).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);
  await expect(whatsNew(page)).toHaveCount(0);
  await expect(libraryHeading(page)).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
};

/** The Library with `count` Prompts (an empty Library for 0), and neither the Welcome nor What's new once the decision had time to land */
const expectLibraryAlone = async (page: Page, count: number): Promise<void> => {
  await expect(libraryHeading(page)).toBeVisible();
  if (count === 0) {
    await expect(page.getByRole('heading', { name: 'Your library is empty' })).toBeVisible();
  } else {
    await expect(cards(page)).toHaveCount(count);
  }
  await page.waitForTimeout(SETTLE_MS);
  await expect(welcome(page)).toHaveCount(0);
  await expect(whatsNew(page)).toHaveCount(0);
};

/** Skip, then the primary button with the Packs selected by default: the shortest way to a ready Library */
const finishWithDefaultPacks = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Skip' }).click();
  await expectWelcomeAt(page, 2);
  await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);
  await primary(page).click();
  await expect(welcome(page)).toHaveCount(0);
};

/** Turns every selected Pack off, so the primary button reads Start empty */
const unselectEveryPack = async (page: Page): Promise<void> => {
  for (const pack of await packToggles(page).all()) {
    if ((await pack.getAttribute('aria-pressed')) === 'true') {
      await pack.click();
      await expect(pack).toHaveAttribute('aria-pressed', 'false');
    }
  }
  await expect(primary(page)).toHaveText('Start empty');
};

// --- Storage ---

const recordOf = async (storage: ExtensionStorage, key: string): Promise<unknown> => (await storage.get<Record<string, unknown>>(key))[key];

/** The storage of the extension, read through its running service worker */
const storageOf = async (context: BrowserContext): Promise<{ storage: ExtensionStorage; extensionId: string; worker: Worker }> => {
  // The background of a Manifest V3 extension is its service worker, as the storage fixture casts it
  const worker = (await waitForBackgroundTarget(context)) as Worker;
  return { storage: createStorageController(worker), extensionId: new URL(worker.url()).host, worker };
};

/** The storage as the first install left it: the records of onInstalled 'install' waited for, nothing seeded or cleared */
const firstInstallStorage = async (context: BrowserContext): Promise<ExtensionStorage> => {
  const { storage } = await storageOf(context);
  await waitForFirstInstallRecords(storage);
  return storage;
};

/**
 * A browser on a profile and an extension folder of its own, the build copied there at `version` with
 * the onInstalled observer, so the test can restart the browser and update the extension in place.
 * Removed, browser closed, when the test ends; removed at once when the copy or the launch fails,
 * since the test then has no install to dispose of.
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
    profile = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-scenario-profile-'));
    folders.push(profile);
    extensionPath = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-scenario-extension-'));
    folders.push(extensionPath);
    copyBuildAt(extensionPath, version, { onInstalledProbe: true });
    context = await launchExtensionContext(profile, extensionPath);
  } catch (error) {
    await removeFolders();
    throw error;
  }

  return {
    get context(): BrowserContext {
      return context;
    },
    /** Closes the browser and launches it again on the same profile, as a restart of Chrome */
    restart: async (): Promise<void> => {
      await context.close();
      context = await launchExtensionContext(profile, extensionPath);
    },
    /** A real update to `next`: onInstalled fires 'update'. Resolves with the new service worker */
    update: async (extensionId: string, next: string): Promise<Worker> =>
      updateExtensionInPlace(context, extensionId, extensionPath, next, { onInstalledProbe: true }),
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

/** The last onInstalled event the observer recorded, once the worker running now has recorded one; logged with all of them */
const lastOnInstalled = async (worker: Worker, what: string): Promise<OnInstalledEvent> => {
  const running = await worker.evaluate(() => chrome.runtime.getManifest().version);
  const events = await onInstalledEvents(worker, (event) => event.version === running);
  const last = events[events.length - 1];
  console.log(`[welcome scenarios] ${what}: onInstalled ${JSON.stringify(last)} (all since start: ${JSON.stringify(events)})`);
  test.info().annotations.push({ type: `onInstalled, ${what}`, description: JSON.stringify(last) });
  return last;
};

/** Turns Debug mode on or off with the Settings switch, from the Library, and waits for it to be stored */
const switchDebugMode = async (page: Page, storage: ExtensionStorage, on: boolean): Promise<void> => {
  await page.getByTestId('tab-settings').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings', exact: true })).toBeVisible();
  await expect(debugSwitch(page)).toHaveAttribute('aria-checked', String(!on));
  await debugSwitch(page).click();
  await expect(debugSwitch(page)).toHaveAttribute('aria-checked', String(on));
  await expect.poll(async () => parseSiteSettings(await recordOf(storage, SITE_SETTINGS_KEY)).debugMode).toBe(on);
};

/** Every key of storage, each as the bytes of its JSON, in key order */
const snapshot = async (storage: ExtensionStorage): Promise<Record<string, string>> => {
  const all = await storage.get<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(all).sort().map((key) => [key, JSON.stringify(all[key])]));
};

/** The store of an existing user, updated from 1.8.0 to this Release: a Library of their own, the Welcome done, no What's new closed yet */
const OWN_PROMPTS = [
  createPromptSeed({ id: 'own-1', title: 'Draft email', content: 'Write a follow-up email to {{name}}.' }),
  createPromptSeed({ id: 'own-2', title: 'Summarize', content: 'Summarize this in three bullets.' })
];
const seedExistingUser = async (storage: ExtensionStorage): Promise<void> => {
  await seedLibrary(storage, { prompts: OWN_PROMPTS });
  // What a real update from 1.8.0 writes (S7 proves it from 1.9.0): the Welcome done, the Release it came from
  await storage.seed({ [WELCOME_KEY]: { status: 'done' }, [WHATS_NEW_KEY]: { installedVersion: '1.8.0' } });
};

// --- The reading model in the page ---

/** The words a reader sees in `container`: text that is visible and not clipped to a pixel, as screen-reader-only text is */
const visibleWords = (container: Locator): Promise<number> =>
  container.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let words = 0;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent === null || !parent.checkVisibility({ visibilityProperty: true, opacityProperty: false })) {
        continue;
      }
      const box = parent.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) {
        continue;
      }
      words += (node.textContent ?? '').split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
    }
    return words;
  });

/** A screen of a timed journey: what the reader reads there, and the action that leaves it */
interface JourneyStep {
  readonly screen: string;
  readonly words: number;
  readonly readingMs: number;
  /** Time the reader spends on the screen besides reading, e.g. watching the typing demo */
  readonly watchingMs: number;
  readonly action: string | null;
  /** Time the extension took to answer the action that brought this screen, or to open */
  readonly machineMs: number;
}

/** The journey's total by the reading model: reading and watching, KLM per action, and the machine time measured */
const journeyTotal = (steps: readonly JourneyStep[]) => {
  const reading = steps.reduce((sum, step) => sum + step.readingMs, 0);
  const watching = steps.reduce((sum, step) => sum + step.watchingMs, 0);
  const actions = steps.filter((step) => step.action !== null).length;
  const klm = actions * KLM_ACTION_MS;
  const machine = steps.reduce((sum, step) => sum + step.machineMs, 0);
  return { readingMs: reading, watchingMs: watching, actions, klmMs: klm, machineMs: machine, totalMs: reading + watching + klm + machine };
};

/** Writes a report to test-results/welcome/ and attaches it to the test */
const report = async (name: string, values: Record<string, unknown>): Promise<void> => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, `${name}.json`), `${JSON.stringify(values, null, 2)}\n`);
  await test.info().attach(name, { body: JSON.stringify(values, null, 2), contentType: 'application/json' });
};

/** Milliseconds `run` takes, by the test's clock */
const timed = async (run: () => Promise<void>): Promise<number> => {
  const start = performance.now();
  await run();
  return performance.now() - start;
};

/** Notes, in the page, when the Library's Section and the editor were first in the document, and whether the empty Library showed */
const watchTheExit = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const seen: { libraryAt?: number; editorAt?: number; emptySeen?: boolean } = {};
    (globalThis as unknown as { welcomeExit: typeof seen }).welcomeExit = seen;
    new MutationObserver(() => {
      const now = performance.now();
      if (seen.libraryAt === undefined && document.querySelector('[data-testid="section"]')) {
        seen.libraryAt = now;
      }
      if (seen.editorAt === undefined && document.querySelector('[data-testid="editor-sheet"]')) {
        seen.editorAt = now;
      }
      seen.emptySeen ||= (document.body?.textContent ?? '').includes('Your library is empty');
    }).observe(document, { childList: true, subtree: true });
  });
};

const exitSeen = (page: Page): Promise<{ libraryAt?: number; editorAt?: number; emptySeen?: boolean }> =>
  page.evaluate(() => (globalThis as unknown as { welcomeExit: { libraryAt?: number; editorAt?: number; emptySeen?: boolean } }).welcomeExit);

/** The way out of an empty Library is the editor of a new Prompt: the Library, then the editor open on an empty title */
const expectLibraryThenEditor = async (page: Page, exit: string): Promise<void> => {
  await expect(editor(page)).toBeVisible();
  await expect(editor(page).getByRole('heading', { name: 'New prompt' })).toBeVisible();
  await expect(editor(page).getByLabel(/title/i)).toHaveValue('');
  const { libraryAt, editorAt, emptySeen } = await exitSeen(page);
  expect(libraryAt, 'the Library showed').toBeDefined();
  expect(editorAt, 'the editor opened').toBeDefined();
  expect(editorAt ?? 0, 'the editor opened after the Library').toBeGreaterThan(libraryAt ?? Infinity);
  expect(emptySeen, 'the empty Library showed under the editor').toBe(true);
  const delay = (editorAt ?? 0) - (libraryAt ?? 0);
  test.info().annotations.push({ type: 'exit', description: `${exit}: the Library, then the editor ${delay.toFixed(0)}ms later` });
  console.log(`[welcome scenarios] exit ${exit}: the Library, then the editor of a new Prompt ${delay.toFixed(0)}ms later`);
};

/** A way out that ends on the Library with Prompts: logged with its count */
const noteLibraryExit = (exit: string, count: number): void => {
  test.info().annotations.push({ type: 'exit', description: `${exit}: the Library with ${String(count)} Prompts` });
  console.log(`[welcome scenarios] exit ${exit}: the Library with ${String(count)} Prompts`);
};

// =====================================================================================================

test.describe('A new user, from the first install of the Release that brings the Welcome', () => {
  test.use({ extensionPath: WHATS_NEW_UPDATE_EXTENSION_PATH });

  test('S1 I install the extension and open it: I see the Welcome, step 1', async ({ context, extensionId }) => {
    const storage = await firstInstallStorage(context);
    // All a first install leaves: the Welcome pending at its first step, the Release of install
    expect(await storage.get()).toEqual({ [WELCOME_KEY]: { status: 'pending', step: 0 }, [WHATS_NEW_KEY]: { installedVersion: NEW_RELEASE } });

    const popup = await openExtension(context, extensionId);
    await expectWelcomeAt(popup, 0);
    await expect(welcome(popup).getByText(STEP_1_TEXT, { exact: true })).toBeVisible();
    await expect(primary(popup)).toHaveText('Next');
    await expectWelcomeAlone(popup);
    await expect(cards(popup)).toHaveCount(0);
    await popup.close();

    // The side panel, where the toolbar icon opens the extension by default: the same Welcome, whose
    // "here" fits it as well as the popup (My-Prompt-Manager-ojz.19)
    const sidePanel = await openExtension(context, extensionId, 'sidepanel');
    await expectWelcomeAt(sidePanel, 0);
    await expect(welcome(sidePanel).getByText(STEP_1_TEXT, { exact: true })).toBeVisible();
    await expectWelcomeAlone(sidePanel);
    await sidePanel.close();

    expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'pending', step: 0 });
  });

  test('S2 I go to the end choosing Packs: I see the Library with their Prompts, and a Notification that confirms it', async ({ context, extensionId }) => {
    const storage = await firstInstallStorage(context);
    const popup = await openExtension(context, extensionId);
    await expectWelcomeAt(popup, 0);
    await primary(popup).click();
    await expectWelcomeAt(popup, 1);
    await primary(popup).click();
    await expectWelcomeAt(popup, 2);

    // The Packs selected by default, and one more chosen
    for (const pack of PACKS) {
      await expect(packToggle(popup, pack.name)).toHaveAttribute('aria-pressed', String(pack.defaultSelected));
    }
    await packToggle(popup, 'Engineering').click();
    await expect(packToggle(popup, 'Engineering')).toHaveAttribute('aria-pressed', 'true');
    const chosen = PACKS.filter((pack) => pack.defaultSelected || pack.id === 'engineering');
    const count = promptsOf(chosen);
    // Under the Packs, what to do in the chat, before the Platforms (My-Prompt-Manager-ojz.19)
    // The caption holds no character a RegExp reads as a pattern
    await expect(popup.getByTestId('welcome-platforms')).toHaveText(new RegExp(`^${PLATFORMS_CAPTION}`));
    await expect(popup.getByRole('list', { name: PLATFORMS_CAPTION })).toBeVisible();
    await expect(primary(popup)).toHaveText(`Add ${String(count)} prompts`);
    await primary(popup).click();

    // The Library with exactly those Prompts, and the Notification of how many, with the next step in the chat
    await expect(welcome(popup)).toHaveCount(0);
    await expect(cards(popup)).toHaveCount(count);
    expect((await cards(popup).getByRole('heading').allTextContents()).sort()).toEqual(chosen.flatMap((pack) => pack.prompts.map((prompt) => prompt.title)).sort());
    await expect(notification(popup)).toHaveAttribute('data-type', 'success');
    await expect(notification(popup).getByText(`${String(count)} prompts added`, { exact: true })).toBeVisible();
    await expect(notification(popup).getByText(IN_THE_CHAT, { exact: true })).toBeVisible();
    await expect(popup.getByRole('radio', { name: /^All/ })).toHaveAttribute('aria-checked', 'true');
    await popup.waitForTimeout(SETTLE_MS);
    await expect(whatsNew(popup)).toHaveCount(0);

    // Stored in their Packs' Categories; the Welcome finished, its Release seen
    const stored = await storage.getPrompts();
    expect(stored.map(({ title, content, category }) => ({ title, content, category }))).toEqual(
      chosen.flatMap((pack) => pack.prompts.map(({ title, content }) => ({ title, content, category: pack.name })))
    );
    expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    expect(await recordOf(storage, WHATS_NEW_KEY)).toEqual({ installedVersion: NEW_RELEASE, lastSeenVersion: NEW_RELEASE });
    noteLibraryExit('Packs (S2)', count);
    await popup.close();
  });

  test('S3 I go to the end choosing no Pack: I see the Library, then the editor of a new Prompt opens', async ({ context, extensionId }) => {
    const storage = await firstInstallStorage(context);
    const page = await context.newPage();
    await watchTheExit(page);
    await page.setViewportSize({ width: SURFACES.popup.width, height: SURFACES.popup.height });
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await expectWelcomeAt(page, 0);
    await primary(page).click();
    await expectWelcomeAt(page, 1);
    await primary(page).click();
    await expectWelcomeAt(page, 2);

    await unselectEveryPack(page);
    await primary(page).click();

    await expectLibraryThenEditor(page, 'no Pack (S3)');
    await expect(welcome(page)).toHaveCount(0);
    await expect(whatsNew(page)).toHaveCount(0);
    expect(await storage.getPrompts()).toEqual([]);
    expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    await page.close();
  });

  // Finished with no Pack, the editor closed unsaved: the Library is empty, so only the stored end of
  // the Welcome keeps it from coming back (a pending record over Prompts would count as finished)
  test("S4 I close and reopen the extension after finishing: I see the Library, no Welcome, no What's new", async ({ context, extensionId }) => {
    const storage = await firstInstallStorage(context);
    const first = await openExtension(context, extensionId);
    await expectWelcomeAt(first, 0);
    await primary(first).click();
    await primary(first).click();
    await expectWelcomeAt(first, 2);
    await unselectEveryPack(first);
    await primary(first).click();
    await expect(editor(first)).toBeVisible();
    await editor(first).getByRole('button', { name: 'Cancel' }).click();
    await expect(editor(first)).toHaveCount(0);
    await expectLibraryAlone(first, 0);
    await first.close();

    // Three openings, on both surfaces: the empty Library each time, never the Welcome nor What's new
    for (const surface of ['popup', 'sidepanel', 'popup'] as const) {
      const again = await openExtension(context, extensionId, surface);
      await expectLibraryAlone(again, 0);
      await again.close();
    }

    expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    expect(await recordOf(storage, WHATS_NEW_KEY)).toEqual({ installedVersion: NEW_RELEASE, lastSeenVersion: NEW_RELEASE });
  });

  test('S6 I close the popup at step 2, then reopen it: I see the Welcome at step 2', async ({ context, extensionId }) => {
    const storage = await firstInstallStorage(context);

    // Closed by a click outside the popup, 100ms after the click that brings step 2
    const first = await openExtension(context, extensionId);
    await expectWelcomeAt(first, 0);
    await primary(first).click();
    await first.waitForTimeout(S6_CLOSE_AFTER_MS);
    await first.close();

    const second = await openExtension(context, extensionId);
    await expectWelcomeAt(second, 1);
    await expectWelcomeAlone(second);
    expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'pending', step: 1 });

    // Closed by the Welcome's own close button, after going back to step 1 and on to step 2 again
    await second.getByRole('button', { name: 'Back' }).click();
    await expectWelcomeAt(second, 0);
    await primary(second).click();
    await expectWelcomeAt(second, 1);
    await second.waitForTimeout(S6_CLOSE_AFTER_MS);
    await clickToClose(second, second.getByRole('button', { name: 'Close', exact: true }));

    for (const surface of ['popup', 'sidepanel'] as const) {
      const again = await openExtension(context, extensionId, surface);
      await expectWelcomeAt(again, 1);
      await again.close();
    }
    expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'pending', step: 1 });
  });
});

// =====================================================================================================

test.describe('A restart of Chrome and updates, each a real event of Chromium', () => {
  /** The Releases of S5: the registry has Release notes for 2.0.0 only, so the user installs this build at a lower version */
  const S5_INSTALLED = '1.9.1';
  const S5_WITHOUT_NOTES = '1.9.2';
  const S5_WITH_NOTES = NEW_RELEASE;

  test("S5 I restart Chrome, then update the extension: no Welcome; What's new only if the new Release has Release notes", async () => {
    test.slow();
    const install = await ownInstall(S5_INSTALLED);
    try {
      const installed = await storageOf(install.context);
      expect(await lastOnInstalled(installed.worker, 'first install')).toEqual({ reason: 'install', previousVersion: null, version: S5_INSTALLED });
      await waitForFirstInstallRecords(installed.storage);

      // The new user finishes the Welcome with the Packs selected by default
      const popup = await openExtension(install.context, installed.extensionId);
      await expectWelcomeAt(popup, 0);
      await finishWithDefaultPacks(popup);
      await expect(cards(popup)).toHaveCount(DEFAULT_COUNT);
      // Closed once the end of the Welcome is stored, as a person closes it. A close in the same
      // milliseconds as the cards (one run in 45) lost the Last seen Release: the page went before
      // its write. Nothing shows it: with no Last seen Release, a first install still has no What's
      // new, and an update still has one, as with 1.9.1 recorded
      const finished = { [WELCOME_KEY]: { status: 'done' }, [WHATS_NEW_KEY]: { installedVersion: S5_INSTALLED, lastSeenVersion: S5_INSTALLED } };
      await expect.poll(async () => installed.storage.get([WELCOME_KEY, WHATS_NEW_KEY])).toEqual(finished);
      await popup.close();

      // Restart: Chromium installs the command-line extension afresh, 'install' again, store kept
      await install.restart();
      const restarted = await storageOf(install.context);
      expect(await lastOnInstalled(restarted.worker, 'restart')).toEqual({ reason: 'install', previousVersion: null, version: S5_INSTALLED });
      const afterRestart = await openExtension(install.context, restarted.extensionId);
      await expectLibraryAlone(afterRestart, DEFAULT_COUNT);
      await afterRestart.close();
      expect(await restarted.storage.get([WELCOME_KEY, WHATS_NEW_KEY])).toEqual(finished);

      // An update to a Release without notes: 'update' from the Release installed; nothing over the Library
      const quiet = await install.update(restarted.extensionId, S5_WITHOUT_NOTES);
      expect(await lastOnInstalled(quiet, `update to ${S5_WITHOUT_NOTES}`)).toEqual({ reason: 'update', previousVersion: S5_INSTALLED, version: S5_WITHOUT_NOTES });
      const quietStorage = createStorageController(quiet);
      const afterQuietUpdate = await openExtension(install.context, restarted.extensionId);
      await expectLibraryAlone(afterQuietUpdate, DEFAULT_COUNT);
      await afterQuietUpdate.close();
      // An 'install' would have written the new Release as the Release of install
      expect(await quietStorage.get([WELCOME_KEY, WHATS_NEW_KEY])).toEqual(finished);

      // An update to a Release with notes: What's new over the Library, never the Welcome
      const loud = await install.update(restarted.extensionId, S5_WITH_NOTES);
      expect(await lastOnInstalled(loud, `update to ${S5_WITH_NOTES}`)).toEqual({ reason: 'update', previousVersion: S5_WITHOUT_NOTES, version: S5_WITH_NOTES });
      const loudStorage = createStorageController(loud);
      const afterLoudUpdate = await openExtension(install.context, restarted.extensionId);
      const sheet = whatsNew(afterLoudUpdate);
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText(`New in ${S5_WITH_NOTES}`, { exact: true })).toBeVisible();
      await expect(welcome(afterLoudUpdate)).toHaveCount(0);
      await sheet.getByRole('button', { name: 'Got it' }).click();
      await expect(sheet).toHaveCount(0);
      await expect(cards(afterLoudUpdate)).toHaveCount(DEFAULT_COUNT);
      await expect.poll(async () => recordOf(loudStorage, WHATS_NEW_KEY)).toEqual({ installedVersion: S5_INSTALLED, lastSeenVersion: S5_WITH_NOTES });
      await afterLoudUpdate.close();

      const next = await openExtension(install.context, restarted.extensionId);
      await expectLibraryAlone(next, DEFAULT_COUNT);
      await next.close();
      expect(await recordOf(loudStorage, WELCOME_KEY)).toEqual({ status: 'done' });
    } finally {
      await install.dispose();
    }
  });

  test('S7 I start from an earlier Release with Prompts, and update: I see my Library, never the Welcome', async () => {
    test.slow();
    const install = await ownInstall(BUILT_RELEASE);
    try {
      const before = await storageOf(install.context);
      await waitForFirstInstallRecords(before.storage);
      // The exact store of a 1.9.0 user: a Library, no Welcome record, no What's new record
      await before.storage.reset();
      await seedLibrary(before.storage, { prompts: OWN_PROMPTS });
      const library = await before.storage.getPrompts();
      expect(Object.keys(await before.storage.get()).sort()).toEqual(['categories', 'interfaceMode', 'prompts', 'settings']);

      const worker = await install.update(before.extensionId, NEW_RELEASE);
      expect(await lastOnInstalled(worker, `update to ${NEW_RELEASE}`)).toEqual({ reason: 'update', previousVersion: BUILT_RELEASE, version: NEW_RELEASE });
      const storage = createStorageController(worker);
      // Written by 'update' only: the Release it came from (an 'install' writes the new one), the Welcome done
      await expect.poll(async () => recordOf(storage, WHATS_NEW_KEY)).toEqual({ installedVersion: BUILT_RELEASE });
      await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
      expect(await storage.getPrompts()).toEqual(library);

      // The first opening: What's new of the Release over my Library, never the Welcome
      const popup = await openExtension(install.context, before.extensionId);
      const sheet = whatsNew(popup);
      await expect(sheet).toBeVisible();
      await expect(welcome(popup)).toHaveCount(0);
      await sheet.getByRole('button', { name: 'Got it' }).click();
      await expect(sheet).toHaveCount(0);
      await expectLibraryAlone(popup, OWN_PROMPTS.length);
      expect((await cards(popup).getByRole('heading').allTextContents()).sort()).toEqual(OWN_PROMPTS.map((prompt) => prompt.title).sort());
      await popup.close();

      for (const surface of ['sidepanel', 'popup'] as const) {
        const again = await openExtension(install.context, before.extensionId, surface);
        await expectLibraryAlone(again, OWN_PROMPTS.length);
        await again.close();
      }

      // Even with every Prompt deleted, never the Welcome
      const emptying = await openExtension(install.context, before.extensionId);
      await expect(cards(emptying)).toHaveCount(OWN_PROMPTS.length);
      for (const prompt of OWN_PROMPTS) {
        await promptWorkflows.delete(emptying, prompt.title);
      }
      await expect(cards(emptying)).toHaveCount(0);
      // The card leaves at the click; the popup closes once the deletions are stored
      await expect.poll(async () => (await storage.getPrompts()).length).toBe(0);
      await emptying.close();
      const empty = await openExtension(install.context, before.extensionId);
      await expectLibraryAlone(empty, 0);
      await empty.close();
      expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    } finally {
      await install.dispose();
    }
  });

  // S7 again, from a Library with no Prompt: no Prompt stands for a finished Welcome there, so a
  // pending record written by the update would show the Welcome at the first opening
  test('S7 I start from an earlier Release with no Prompt, and update: I see my empty Library, never the Welcome', async () => {
    test.slow();
    const install = await ownInstall(BUILT_RELEASE);
    try {
      const before = await storageOf(install.context);
      await waitForFirstInstallRecords(before.storage);
      // The exact store of a 1.9.0 user who has no Prompt: an empty Library, no Welcome record, no What's new record
      await before.storage.reset();
      await seedLibrary(before.storage, { prompts: [] });
      expect(Object.keys(await before.storage.get()).sort()).toEqual(['categories', 'interfaceMode', 'prompts', 'settings']);
      expect(await before.storage.getPrompts()).toEqual([]);

      const worker = await install.update(before.extensionId, NEW_RELEASE);
      expect(await lastOnInstalled(worker, `update to ${NEW_RELEASE}, no Prompt`)).toEqual({ reason: 'update', previousVersion: BUILT_RELEASE, version: NEW_RELEASE });
      const storage = createStorageController(worker);
      await expect.poll(async () => recordOf(storage, WHATS_NEW_KEY)).toEqual({ installedVersion: BUILT_RELEASE });
      await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });

      // The first opening: What's new of the Release, as for every user who updates to it (S5), over
      // the empty Library; never the Welcome
      const popup = await openExtension(install.context, before.extensionId);
      const sheet = whatsNew(popup);
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText(`New in ${NEW_RELEASE}`, { exact: true })).toBeVisible();
      await expect(welcome(popup)).toHaveCount(0);
      await sheet.getByRole('button', { name: 'Got it' }).click();
      await expect(sheet).toHaveCount(0);
      await expectLibraryAlone(popup, 0);
      await expect.poll(async () => recordOf(storage, WHATS_NEW_KEY)).toEqual({ installedVersion: BUILT_RELEASE, lastSeenVersion: NEW_RELEASE });
      await popup.close();

      for (const surface of ['sidepanel', 'popup'] as const) {
        const again = await openExtension(install.context, before.extensionId, surface);
        await expectLibraryAlone(again, 0);
        await again.close();
      }
      expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
      expect(await storage.getPrompts()).toEqual([]);
    } finally {
      await install.dispose();
    }
  });

  /** The Release the user of the pending case installs: lower than the Release with notes, and without notes of its own */
  const PENDING_INSTALLED = '1.9.1';

  // Decision Q2: a Welcome left unfinished stays pending through an update. The one case where What's
  // new's own rule says yes to a new user: an update, to a Release with notes, never seen
  test("Pending through an update: the Welcome resumes, What's new never follows", async () => {
    test.slow();
    const install = await ownInstall(PENDING_INSTALLED);
    try {
      const installed = await storageOf(install.context);
      expect(await lastOnInstalled(installed.worker, 'first install')).toEqual({ reason: 'install', previousVersion: null, version: PENDING_INSTALLED });
      await waitForFirstInstallRecords(installed.storage);

      // A new user opens the extension, goes on to step 2 and closes it there
      const first = await openExtension(install.context, installed.extensionId);
      await expectWelcomeAt(first, 0);
      await expectWelcomeAlone(first);
      await primary(first).click();
      await expectWelcomeAt(first, 1);
      const pending = { [WELCOME_KEY]: { status: 'pending', step: 1 }, [WHATS_NEW_KEY]: { installedVersion: PENDING_INSTALLED } };
      // Closed once the step is stored: a close in the milliseconds of its write is S6's matter
      await expect.poll(async () => installed.storage.get([WELCOME_KEY, WHATS_NEW_KEY])).toEqual(pending);
      await first.close();

      // A real update to the Release with notes: 'update' from the Release installed, the Welcome still pending
      const worker = await install.update(installed.extensionId, NEW_RELEASE);
      expect(await lastOnInstalled(worker, `update to ${NEW_RELEASE}, the Welcome pending`)).toEqual({
        reason: 'update',
        previousVersion: PENDING_INSTALLED,
        version: NEW_RELEASE
      });
      const storage = createStorageController(worker);
      expect(await storage.get([WELCOME_KEY, WHATS_NEW_KEY])).toEqual(pending);
      expect(await storage.getPrompts()).toEqual([]);
      // What's new's own rule would show the Release's notes at this opening: so the Welcome alone keeps them away
      const record = parseWhatsNewRecord(await recordOf(storage, WHATS_NEW_KEY));
      const notes = decideWhatsNew({
        currentVersion: NEW_RELEASE,
        lastSeenVersion: record.lastSeenVersion,
        releaseNotes: RELEASE_NOTES,
        isFirstInstall: isFirstInstall(record.installedVersion, NEW_RELEASE),
        debugMode: false
      });
      expect(notes?.version, "What's new by its own rule").toBe(NEW_RELEASE);

      // Reopened: the Welcome at step 2, and no What's new at step 2 nor at step 3
      const resumed = await openExtension(install.context, installed.extensionId);
      await expectWelcomeAt(resumed, 1);
      await expectWelcomeAlone(resumed);
      await primary(resumed).click();
      await expectWelcomeAt(resumed, 2);
      await expectWelcomeAlone(resumed);
      await expect(primary(resumed)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);

      // Finished: the Library with the Packs' Prompts, and no What's new in this opening
      await primary(resumed).click();
      await expect(welcome(resumed)).toHaveCount(0);
      await expect(notification(resumed).getByText(`${String(DEFAULT_COUNT)} prompts added`, { exact: true })).toBeVisible();
      await expectLibraryAlone(resumed, DEFAULT_COUNT);
      // Closed once the end of the Welcome is stored, both its records, as a person closes it: the
      // Welcome done and the installed Release marked seen (S5 polls the same pair, for the same reason)
      const finished = {
        [WELCOME_KEY]: { status: 'done' },
        [WHATS_NEW_KEY]: { installedVersion: PENDING_INSTALLED, lastSeenVersion: NEW_RELEASE }
      };
      await expect.poll(async () => storage.get([WELCOME_KEY, WHATS_NEW_KEY])).toEqual(finished);
      await resumed.close();

      // The next openings: the Library alone, in the popup and in the side panel
      for (const surface of ['popup', 'sidepanel'] as const) {
        const again = await openExtension(install.context, installed.extensionId, surface);
        await expectLibraryAlone(again, DEFAULT_COUNT);
        await again.close();
      }
      // The finish marked the installed Release seen: that, not the Welcome, keeps What's new away from now on
      expect(await storage.get([WELCOME_KEY, WHATS_NEW_KEY])).toEqual(finished);
    } finally {
      await install.dispose();
    }
  });
});

// =====================================================================================================

test.describe('Debug mode, switched in Settings', () => {
  test('S8 I turn Debug mode on and open the extension three times: I see the Welcome each time, from step 1', async ({ context, extensionId }) => {
    const storage = await firstInstallStorage(context);
    // A new user finishes the Welcome, then turns Debug mode on in Settings
    const popup = await openExtension(context, extensionId);
    await finishWithDefaultPacks(popup);
    await expect(cards(popup)).toHaveCount(DEFAULT_COUNT);
    const records = { [WELCOME_KEY]: { status: 'done' }, [WHATS_NEW_KEY]: { installedVersion: BUILT_RELEASE, lastSeenVersion: BUILT_RELEASE } };
    await expect.poll(async () => storage.get([WELCOME_KEY, WHATS_NEW_KEY])).toEqual(records);
    await switchDebugMode(popup, storage, true);
    await popup.close();

    // Opening 1: step 1, then on to step 2 before closing
    const first = await openExtension(context, extensionId);
    await expectWelcomeAt(first, 0);
    await expectWelcomeAlone(first);
    await primary(first).click();
    await expectWelcomeAt(first, 1);
    await first.close();

    // Opening 2: step 1 again, not step 2; on to step 3, a Pack unselected, before closing
    const second = await openExtension(context, extensionId);
    await expectWelcomeAt(second, 0);
    await expectWelcomeAlone(second);
    await second.getByRole('button', { name: 'Skip' }).click();
    await expectWelcomeAt(second, 2);
    await packToggle(second, 'Writing').click();
    await expect(packToggle(second, 'Writing')).toHaveAttribute('aria-pressed', 'false');
    await second.close();

    // Opening 3, in the side panel: step 1 again, and at step 3 the Packs selected by default again
    const third = await openExtension(context, extensionId, 'sidepanel');
    await expectWelcomeAt(third, 0);
    await expectWelcomeAlone(third);
    await third.getByRole('button', { name: 'Skip' }).click();
    await expectWelcomeAt(third, 2);
    for (const pack of PACKS) {
      await expect(packToggle(third, pack.name)).toHaveAttribute('aria-pressed', String(pack.defaultSelected));
    }
    await third.close();

    // The records as the finish left them: the Welcome still done, the Last seen Release unchanged,
    // the Library as it was. This cannot show that a Debug opening writes no step: storage refuses a
    // step over a done record. S10 shows a What's new closed in Debug mode leaves the Last seen
    // Release; src/launch/__tests__/write.test.ts, that the launch writer writes nothing in Debug mode
    expect(await storage.get([WELCOME_KEY, WHATS_NEW_KEY])).toEqual(records);
    expect(await storage.getPrompts()).toHaveLength(DEFAULT_COUNT);
  });

  test('S9 In Debug mode, I finish the Welcome with the same Packs twice: no Prompt twice in my Library', async ({ context, extensionId, storage }) => {
    await seedExistingUser(storage);
    const library = await openExtension(context, extensionId);
    await expectLibraryAlone(library, OWN_PROMPTS.length);
    await switchDebugMode(library, storage, true);
    await library.close();

    const expected = [
      { message: `${String(DEFAULT_COUNT)} prompts added`, sub: IN_THE_CHAT },
      { message: 'Your library is ready', sub: IN_THE_CHAT }
    ];
    for (const [round, notice] of expected.entries()) {
      const popup = await openExtension(context, extensionId);
      await expectWelcomeAt(popup, 0);
      await finishWithDefaultPacks(popup);
      await expect(notification(popup).getByText(notice.message, { exact: true })).toBeVisible();
      await expect(notification(popup).getByText(notice.sub, { exact: true })).toBeVisible();
      // Debug mode brings What's new after the Welcome; closed, the Library
      await expect(whatsNew(popup)).toBeVisible();
      await whatsNew(popup).getByRole('button', { name: 'Got it' }).click();
      await expect(whatsNew(popup)).toHaveCount(0);
      await expect(cards(popup), `finish ${String(round + 1)}`).toHaveCount(OWN_PROMPTS.length + DEFAULT_COUNT);
      await popup.close();
    }

    const prompts = await storage.getPrompts();
    const contents = prompts.map((prompt) => prompt.content);
    expect(prompts).toHaveLength(OWN_PROMPTS.length + DEFAULT_COUNT);
    expect(new Set(contents).size, 'no two Prompts with the same content').toBe(contents.length);
    const names = (await storage.getCategories()).map((category) => category.name.toLowerCase());
    expect(new Set(names).size, 'no two Categories with the same name').toBe(names.length);
    for (const pack of DEFAULT_PACKS) {
      expect(names.filter((name) => name === pack.name.toLowerCase()), pack.name).toHaveLength(1);
    }
  });

  test('S10 I turn Debug mode off: the behavior from before my tests, identical', async ({ context, extensionId, storage }) => {
    await seedExistingUser(storage);
    // Before: the Library alone
    const before = await openExtension(context, extensionId);
    await expectLibraryAlone(before, OWN_PROMPTS.length);
    const snapshotBefore = await snapshot(storage);
    await switchDebugMode(before, storage, true);
    await before.close();

    // Three Debug openings: steps moved, a Pack unselected, then a finish with Packs and a What's new close
    const first = await openExtension(context, extensionId);
    await expectWelcomeAt(first, 0);
    await primary(first).click();
    await primary(first).click();
    await expectWelcomeAt(first, 2);
    await first.close();
    const second = await openExtension(context, extensionId, 'sidepanel');
    await expectWelcomeAt(second, 0);
    await second.getByRole('button', { name: 'Skip' }).click();
    await packToggle(second, 'Product').click();
    await expect(packToggle(second, 'Product')).toHaveAttribute('aria-pressed', 'false');
    await second.close();
    const third = await openExtension(context, extensionId);
    await expectWelcomeAt(third, 0);
    await finishWithDefaultPacks(third);
    await expect(whatsNew(third)).toBeVisible();
    await whatsNew(third).getByRole('button', { name: 'Got it' }).click();
    await expect(whatsNew(third)).toHaveCount(0);
    await expect(cards(third)).toHaveCount(OWN_PROMPTS.length + DEFAULT_COUNT);
    await switchDebugMode(third, storage, false);
    await third.close();
    const snapshotAfter = await snapshot(storage);

    // Every key as it was, the Library's Packs set aside (decision Q1: they stay), and the Site
    // settings compared as what they stand for: the switch stores them, defaults included
    const { prompts: promptsBefore, categories: categoriesBefore, [SITE_SETTINGS_KEY]: siteBefore, ...restBefore } = snapshotBefore;
    const { prompts: promptsAfter, categories: categoriesAfter, [SITE_SETTINGS_KEY]: siteAfter, ...restAfter } = snapshotAfter;
    await report('S10-snapshots', { before: snapshotBefore, after: snapshotAfter });
    expect(restAfter).toEqual(restBefore);
    const parsed = (json: string | undefined) => parseSiteSettings(json === undefined ? undefined : JSON.parse(json));
    expect(parsed(siteAfter)).toEqual(parsed(siteBefore));
    const ownEntries = (json: string | undefined, isPacks: (entry: { content?: string; name?: string }) => boolean) =>
      (JSON.parse(json ?? '[]') as Array<{ content?: string; name?: string }>).filter((entry) => !isPacks(entry)).map((entry) => JSON.stringify(entry));
    const isPackPrompt = (entry: { content?: string }) => PACK_CONTENTS.has(entry.content ?? '');
    const isPackCategory = (entry: { name?: string }) => PACK_NAMES.has((entry.name ?? '').toLowerCase());
    expect(ownEntries(promptsAfter, isPackPrompt)).toEqual(ownEntries(promptsBefore, isPackPrompt));
    expect(ownEntries(categoriesAfter, isPackCategory)).toEqual(ownEntries(categoriesBefore, isPackCategory));
    console.log(`[welcome scenarios] S10: keys identical ${JSON.stringify(Object.keys(restBefore))}; own Prompts and Categories identical; the Site settings before ${String(siteBefore)}, after ${String(siteAfter)}`);

    // After: the Library alone, as before, with the Packs added in Debug mode
    const after = await openExtension(context, extensionId);
    await expectLibraryAlone(after, OWN_PROMPTS.length + DEFAULT_COUNT);
    await after.close();
  });
});

// =====================================================================================================

test.describe('The journey, timed with the reading model', () => {
  test.use({ extensionPath: WHATS_NEW_UPDATE_EXTENSION_PATH });

  test(`S11 I time the whole journey reading each screen: under ${String(JOURNEY_TARGET_MS / 1000)}s`, async ({ context, extensionId }) => {
    await firstInstallStorage(context);
    const page = await context.newPage();
    await watchWelcomeMotion(page);
    await page.setViewportSize({ width: SURFACES.popup.width, height: SURFACES.popup.height });
    const steps: JourneyStep[] = [];

    const openMs = await timed(async () => {
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expectWelcomeAt(page, 0);
    });
    const screen1 = await visibleWords(welcome(page));
    steps.push({ screen: 'step 1', words: screen1, readingMs: readingMs(screen1), watchingMs: 0, action: 'Next', machineMs: openMs });

    const toStep2 = await timed(async () => {
      await primary(page).click();
      await expectWelcomeAt(page, 1);
    });
    // The typing demo watched to its end (typed twice, then held, My-Prompt-Manager-ojz.20); the words
    // counted with the blank filled
    const demo = await typingDemoMs(page);
    await expect(page.getByTestId('welcome-blank')).toHaveText('Claire, Head of Sales');
    const screen2 = await visibleWords(welcome(page));
    steps.push({ screen: 'step 2', words: screen2, readingMs: readingMs(screen2), watchingMs: demo, action: 'Next', machineMs: toStep2 });

    const toStep3 = await timed(async () => {
      await primary(page).click();
      await expectWelcomeAt(page, 2);
    });
    const screen3 = await visibleWords(welcome(page));
    await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);
    steps.push({ screen: 'step 3', words: screen3, readingMs: readingMs(screen3), watchingMs: 0, action: `Add ${String(DEFAULT_COUNT)} prompts`, machineMs: toStep3 });

    const toLibrary = await timed(async () => {
      await primary(page).click();
      await expect(cards(page)).toHaveCount(DEFAULT_COUNT);
      await expect(notification(page).getByText(`${String(DEFAULT_COUNT)} prompts added`, { exact: true })).toBeVisible();
    });
    const notice = await visibleWords(notification(page));
    steps.push({ screen: 'the Library and its Notification', words: notice, readingMs: readingMs(notice), watchingMs: 0, action: null, machineMs: toLibrary });

    const total = journeyTotal(steps);
    const journey = { model: { wpm: READING_WPM, klmActionMs: KLM_ACTION_MS }, steps, ...total, targetMs: JOURNEY_TARGET_MS };
    await report('S11-journey', journey);
    console.log(`[welcome scenarios] S11 journey: ${JSON.stringify(journey)}`);
    test.info().annotations.push({ type: 'S11 journey', description: `${(total.totalMs / 1000).toFixed(1)}s (reading ${(total.readingMs / 1000).toFixed(1)}s, demo ${(total.watchingMs / 1000).toFixed(1)}s, ${String(total.actions)} actions ${(total.klmMs / 1000).toFixed(1)}s, machine ${(total.machineMs / 1000).toFixed(1)}s)` });

    expect(total.totalMs).toBeLessThan(JOURNEY_TARGET_MS);
    await page.close();
  });

  test(`S12 I leave the Welcome with a Pack and copy a Prompt: ${String(MAX_CLICKS_TO_COPY_AFTER_WELCOME)} clicks, under ${String(FIRST_COPY_TARGET_MS / 1000)}s from the first opening`, async ({ context, extensionId }) => {
    await firstInstallStorage(context);
    // CDP takes a chrome-extension:// origin for an opaque one: granted to every origin of this test's own browser
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const before = await context.newPage();
    await before.goto(`chrome-extension://${extensionId}/src/analytics.html`);
    await before.evaluate(() => navigator.clipboard.writeText('-'));
    await before.close();

    const page = await context.newPage();
    await page.setViewportSize({ width: SURFACES.popup.width, height: SURFACES.popup.height });
    const steps: JourneyStep[] = [];
    let clicks = 0;
    const click = async (target: Locator): Promise<void> => {
      clicks++;
      await target.click();
    };

    const openMs = await timed(async () => {
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expectWelcomeAt(page, 0);
    });
    const screen1 = await visibleWords(welcome(page));
    steps.push({ screen: 'step 1', words: screen1, readingMs: readingMs(screen1), watchingMs: 0, action: 'Skip', machineMs: openMs });

    const toStep3 = await timed(async () => {
      await click(page.getByRole('button', { name: 'Skip' }));
      await expectWelcomeAt(page, 2);
    });
    const screen3 = await visibleWords(welcome(page));
    steps.push({ screen: 'step 3', words: screen3, readingMs: readingMs(screen3), watchingMs: 0, action: `Add ${String(DEFAULT_COUNT)} prompts`, machineMs: toStep3 });

    const toLibrary = await timed(async () => {
      await click(primary(page));
      await expect(welcome(page)).toHaveCount(0);
      await expect(cards(page)).toHaveCount(DEFAULT_COUNT);
    });
    const clicksToReadyLibrary = clicks;
    const card = cards(page).first();
    const title = (await card.getByRole('heading').textContent()) ?? '';
    const content = PACKS.flatMap((pack) => pack.prompts).find((prompt) => prompt.title === title)?.content;
    expect(content, `the first card, ${title}, is a Prompt of the Packs`).toBeDefined();
    // The reader reads the Notification and the first card, then copies it
    const libraryWords = (await visibleWords(notification(page))) + (await visibleWords(card));
    steps.push({ screen: 'the Library: the Notification and the first card', words: libraryWords, readingMs: readingMs(libraryWords), watchingMs: 0, action: 'Copy', machineMs: toLibrary });

    const toClipboard = await timed(async () => {
      await click(card.getByRole('button', { name: `Copy content of ${title} to clipboard` }));
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()), { intervals: [5] }).toBe(content);
    });
    steps.push({ screen: 'the clipboard holds the Prompt', words: 0, readingMs: 0, watchingMs: 0, action: null, machineMs: toClipboard });
    const clicksAfterWelcome = clicks - clicksToReadyLibrary;

    const total = journeyTotal(steps);
    const firstCopy = {
      model: { wpm: READING_WPM, klmActionMs: KLM_ACTION_MS },
      steps,
      ...total,
      clicks,
      clicksToReadyLibrary,
      clicksAfterWelcome,
      copied: title,
      targetMs: FIRST_COPY_TARGET_MS
    };
    await report('S12-first-copy', firstCopy);
    console.log(`[welcome scenarios] S12 first copy: ${JSON.stringify(firstCopy)}`);
    test.info().annotations.push({
      type: 'S12 first copy',
      description: `${(total.totalMs / 1000).toFixed(1)}s; ${String(clicksToReadyLibrary)} clicks to a ready Library, ${String(clicksAfterWelcome)} to copy after the Welcome`
    });

    expect(clicksToReadyLibrary).toBeLessThanOrEqual(MAX_ACTIONS_TO_READY_LIBRARY);
    expect(clicksAfterWelcome).toBeLessThanOrEqual(MAX_CLICKS_TO_COPY_AFTER_WELCOME);
    expect(total.totalMs).toBeLessThan(FIRST_COPY_TARGET_MS);
    await page.close();
  });
});

// =====================================================================================================

test.describe('Every way out of the Welcome ends on a Library with Prompts or an open editor', () => {
  test.use({ extensionPath: WHATS_NEW_UPDATE_EXTENSION_PATH });

  // Packs: S2. No Pack: S3.

  test('Skip then no Pack: the Library, then the editor of a new Prompt', async ({ context, extensionId }) => {
    const storage = await firstInstallStorage(context);
    const page = await context.newPage();
    await watchTheExit(page);
    await page.setViewportSize({ width: SURFACES.popup.width, height: SURFACES.popup.height });
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await expectWelcomeAt(page, 0);
    await page.getByRole('button', { name: 'Skip' }).click();
    await expectWelcomeAt(page, 2);
    await unselectEveryPack(page);
    await primary(page).click();

    await expectLibraryThenEditor(page, 'Skip then no Pack');
    expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    await page.close();
  });

  /** Opens the Welcome of the first install at its last step, the Packs selected by default */
  const atLastStep = async (context: BrowserContext, extensionId: string): Promise<Page> => {
    const page = await context.newPage();
    await watchTheExit(page);
    await page.setViewportSize({ width: SURFACES.popup.width, height: SURFACES.popup.height });
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await page.getByRole('button', { name: 'Skip' }).click();
    await expectWelcomeAt(page, 2);
    await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);
    return page;
  };

  /**
   * The refused add: the Welcome still at its last step with a failure Notification, nothing stored,
   * no Prompt and no Category of a Pack (the default Category the Library writes on its first read is
   * none of the Packs')
   */
  const expectRefusedAdd = async (page: Page, storage: ExtensionStorage): Promise<void> => {
    await expect(notification(page)).toHaveAttribute('data-type', 'error');
    await expect(notification(page).getByText("Couldn't add the prompts", { exact: true })).toBeVisible();
    await expect(notification(page).getByRole('button', { name: 'Try again' })).toBeVisible();
    await expectWelcomeAt(page, 2);
    await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);
    expect(await storage.getPrompts()).toEqual([]);
    const packCategories = (await storage.getCategories()).filter((category) => PACK_NAMES.has(category.name.toLowerCase()));
    expect(packCategories, 'the Categories of the Packs, after the refusal').toEqual([]);
    expect(await recordOf(storage, WELCOME_KEY)).toEqual({ status: 'pending', step: 2 });
  };

  test('a refused add: the Welcome stays at step 3 with a failure Notification, nothing recorded; the retry adds the Packs', async ({ context, extensionId }) => {
    const { worker, storage } = await storageOf(context);
    await waitForFirstInstallRecords(storage);
    const page = await atLastStep(context, extensionId);

    const share = await fillStorage(worker);
    console.log(`[welcome scenarios] refused add: storage ${(share * 100).toFixed(2)}% full before the click`);
    await primary(page).click();
    await expectRefusedAdd(page, storage);

    // Room again, the same button: the Packs are added and the Welcome finished
    await emptyFiller(worker);
    await primary(page).click();
    await expect(welcome(page)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(DEFAULT_COUNT);
    await expect(notification(page).getByText(`${String(DEFAULT_COUNT)} prompts added`, { exact: true })).toBeVisible();
    expect(await storage.getPrompts()).toHaveLength(DEFAULT_COUNT);
    await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    noteLibraryExit('a refused add, then the retry', DEFAULT_COUNT);
    await page.close();
  });

  test("a refused add, then Try again in the failure Notification: the same Packs added, once each", async ({ context, extensionId }) => {
    const { worker, storage } = await storageOf(context);
    await waitForFirstInstallRecords(storage);
    const page = await atLastStep(context, extensionId);

    await fillStorage(worker);
    await primary(page).click();
    await expectRefusedAdd(page, storage);

    await emptyFiller(worker);
    await notification(page).getByRole('button', { name: 'Try again' }).click();
    await expect(welcome(page)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(DEFAULT_COUNT);
    await expect(notification(page).getByText(`${String(DEFAULT_COUNT)} prompts added`, { exact: true })).toBeVisible();
    const contents = (await storage.getPrompts()).map((prompt) => prompt.content);
    expect(contents).toHaveLength(DEFAULT_COUNT);
    expect(new Set(contents).size).toBe(DEFAULT_COUNT);
    expect(contents.every((content) => PACK_CONTENTS.has(content))).toBe(true);
    await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    noteLibraryExit('a refused add, then Try again', DEFAULT_COUNT);
    await page.close();
  });

  test("a refused add, then Start empty from the step: the Packs unselected, the Library, then the editor of a new Prompt", async ({ context, extensionId }) => {
    const { worker, storage } = await storageOf(context);
    await waitForFirstInstallRecords(storage);
    const page = await atLastStep(context, extensionId);

    await fillStorage(worker);
    await primary(page).click();
    await expectRefusedAdd(page, storage);

    // Storage still full: the end of the Welcome is a few bytes, and fits
    await unselectEveryPack(page);
    // A Pack toggled hides the failure: its Try again was about the Packs refused (My-Prompt-Manager-5lf)
    await expect(notification(page)).toHaveCount(0);
    await primary(page).click();
    await expectLibraryThenEditor(page, 'a refused add, then Start empty');
    await expect(welcome(page)).toHaveCount(0);
    await expect(notification(page)).toHaveCount(0);
    await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    expect(await storage.getPrompts()).toEqual([]);
    await page.close();
  });
});

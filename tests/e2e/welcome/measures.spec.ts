/**
 * MEASURES: the numeric targets of the Welcome, each measured on the built extension by a tool
 * (My-Prompt-Manager-ojz.13; targets in My-Prompt-Manager-ojz, DESIGN "Les objectifs chiffrés").
 *
 * On demand only, so CI stays fast: every test is skipped unless MEASURE=1. Run the file alone, one
 * worker, headless, no retries, on a machine as idle as can be; every timed sample records the load
 * average next to it:
 *
 *   MEASURE=1 CI=1 npx playwright test tests/e2e/welcome/measures.spec.ts --workers=1 --retries=0
 *
 * - MEASURE_OUT: the JSON report (default test-results/welcome/measures.json). Each test writes its
 *   own section and keeps the others, so one section can be measured again alone (--grep).
 * - MEASURE_BASE_DIST: a build of main at this branch's merge base, for the existing user's "before";
 *   without it, that test measures this build alone.
 *
 * What each test measures:
 * - Display (target 5, under 200 ms after the popup opens): a probe notes in every animation frame
 *   the first frame where the primary button is hit-testable (elementFromPoint at its center returns
 *   it, whatever its opacity), where the Welcome's opacity is above 0, and where it is 1 (fully
 *   opaque: what "displayed" means), with the primary's own opacity through its ancestors and
 *   first-contentful-paint when Chromium reports it. Three series:
 *   - from navigation start, the page opened in a tab (the measurement plan's measure): ten openings
 *     in one browser, popup (400 x 500) and side panel (360 x 720), the first of them cold;
 *   - the same, each opening the first of a browser of its own right after the install, ten each;
 *   - from the user's open request, on the real surfaces, ten first openings each: the action popup
 *     opened by chrome.action.openPopup() (a script cannot click the toolbar icon), its action not
 *     pinned (Chromium's default after an install: the action is reached from the Extensions menu,
 *     and Chromium pops it out onto the toolbar before it opens the popup) and pinned (the icon a user
 *     clicks on the toolbar); and the side panel by chrome.sidePanel.open() on a click. Playwright
 *     cannot attach to either, so an extension page reaches it with chrome.extension.getViews and runs
 *     the probe in it. This adds what the browser takes before the surface's navigation starts, which
 *     no code of the extension can shorten. A new user's action opens the side panel: the popup is the
 *     action's only in popup mode.
 * - Journey (target 1, under 45 s reading each screen) and first copy through a Pack (target 3,
 *   under 60 s): the reading model of the epic's measurement plan. The words a reader sees on each
 *   screen, counted from the text the built extension renders, read at 238 words a minute (Brysbaert
 *   2019); step 2's typing demo watched to its end (typed twice, then held), as the page plays it; 1.1 s of pointing
 *   and 0.2 s of click per action (Keystroke-Level Model, Card, Moran & Newell); plus the machine
 *   time, measured. The copy is read back from the clipboard. Five runs each, from the store a first
 *   install leaves.
 * - Actions and clicks (targets 2 and 4): counted by `act`, the one helper every click of a run goes
 *   through.
 * - An existing user's Library: from navigation start to the first card's copy button hit-testable,
 *   this build and the merge base's, the same store, ten openings each, interleaved.
 * - Colors: the colors the built extension draws for the Welcome's lowest contrast pairs, light and
 *   dark, and their ratio by the app's getContrastRatio, the function scripts/contrast.ts prints.
 *
 * Targets 6 to 9 are counts of failures: they are measured by running the tests that would see one
 * (scenarios.spec.ts, launch-decision.spec.ts, welcome-a11y.spec.ts), as My-Prompt-Manager-ojz.13's
 * notes say.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { BrowserContext, Locator, Page, Worker } from '@playwright/test';

import { getContrastRatio } from '../../../src/constants/colors';
import { MOTION } from '../../../src/theme/motion';
import { DEFAULT_SETTINGS } from '../../../src/types';
import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { WHATS_NEW_KEY } from '../../../src/whatsNew/storage';
import {
  createStorageController,
  DEFAULT_EXTENSION_PATH,
  type ExtensionStorage,
  expect,
  launchExtensionContext,
  test,
  waitForBackgroundTarget,
  waitForFirstInstallRecords
} from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';
import { typingDemoMs, watchWelcomeMotion } from '../utils/welcomeMotion';

const MEASURE = process.env.MEASURE === '1';
const REPORT_PATH = process.env.MEASURE_OUT ?? 'test-results/welcome/measures.json';
const BASE_DIST = process.env.MEASURE_BASE_DIST;

// biome-ignore lint/suspicious/noSkippedTests: the measures run on demand only, MEASURE=1, so CI stays fast
test.skip(!MEASURE, 'The measures run on demand: MEASURE=1 (see the header of this file)');
test.describe.configure({ mode: 'default' });

/** Openings per display series and per build of the existing user's Library */
const OPENINGS = 10;
/** Runs of each timed journey */
const JOURNEY_RUNS = 5;

const SURFACES = {
  popup: { file: 'popup', width: 400, height: 500 },
  sidepanel: { file: 'sidepanel', width: 360, height: 720 }
} as const;

type Surface = keyof typeof SURFACES;

const STEP_TITLES = ['Your best prompts, one tap away', 'Leave blanks, fill them later', 'Start with a pack'] as const;

const DEFAULT_PACKS = PACKS.filter((pack) => pack.defaultSelected);
const DEFAULT_COUNT = DEFAULT_PACKS.reduce((count, pack) => count + pack.prompts.length, 0);
const PACK_PROMPTS = PACKS.flatMap((pack) => pack.prompts);

/** What the clipboard holds before a run: no Prompt has it, so the read sees that run's copy */
const CLIPBOARD_BEFORE = '-';

// --- The targets (My-Prompt-Manager-ojz, DESIGN) ---

const TARGETS = {
  journeyMs: 45_000,
  actionsToReadyLibrary: 2,
  firstCopyMs: 60_000,
  clicksToCopyAfterWelcome: 2,
  displayMs: 200
} as const;

// --- The reading model of the measurement plan (My-Prompt-Manager-ojz, description) ---

/** Silent reading of English non-fiction, words a minute (Brysbaert 2019) */
const READING_WPM = 238;
/** Keystroke-Level Model: pointing at a control (P), then pressing and releasing the mouse button (BB) */
const KLM_POINT_MS = 1100;
const KLM_CLICK_MS = 200;
const KLM_ACTION_MS = KLM_POINT_MS + KLM_CLICK_MS;

const readingMs = (words: number): number => (words / READING_WPM) * 60_000;

// --- The report ---

type Stats = { n: number; median: number; min: number; max: number };

const round = (value: number): number => Math.round(value * 10) / 10;

const stats = (values: readonly number[]): Stats => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return { n: sorted.length, median: round(median), min: round(sorted[0]), max: round(sorted[sorted.length - 1]) };
};

/** The stats of the values noted, or null if none was */
const statsOfNoted = (values: readonly (number | null)[]): Stats | null => {
  const noted = values.filter((value): value is number => value !== null);
  return noted.length === 0 ? null : stats(noted);
};

/** The load average of the machine, over 1, 5 and 15 minutes */
const load = (): number[] => os.loadavg().map((value) => Math.round(value * 100) / 100);

const machine = () => {
  const cpus = os.cpus();
  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    // Not a git checkout: the report says so
  }
  return {
    cpu: cpus[0]?.model ?? 'unknown',
    cores: cpus.length,
    memoryGiB: Math.round(os.totalmem() / 2 ** 30),
    os: `${os.type()} ${os.release()}`,
    node: process.version,
    headless: Boolean(process.env.CI),
    commit
  };
};

/** Writes `section` into the JSON report, keeping the sections other tests wrote, and attaches it to the test */
const writeSection = async (section: string, value: Record<string, unknown>): Promise<void> => {
  let report: Record<string, unknown> = {};
  try {
    report = JSON.parse(await fs.readFile(REPORT_PATH, 'utf8')) as Record<string, unknown>;
  } catch {
    // No report yet: this section starts it
  }
  report.machine = machine();
  report[section] = { measuredAt: new Date().toISOString(), ...value };
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  await test.info().attach(section, { body: JSON.stringify(value, null, 2), contentType: 'application/json' });
};

const note = (type: string, description: string): void => {
  test.info().annotations.push({ type, description });
  console.log(`[measures] ${type}: ${description}`);
};

// --- The extension ---

/** The store as the first install left it: the Welcome pending at its first step, over an empty Library */
const installedStore = async (context: BrowserContext): Promise<{ storage: ExtensionStorage; installed: Record<string, unknown> }> => {
  const storage = createStorageController(await waitForBackgroundTarget(context));
  await waitForFirstInstallRecords(storage);
  const installed = await storage.get<Record<string, unknown>>([WELCOME_KEY, WHATS_NEW_KEY]);
  return { storage, installed };
};

/** Back to the store a first install leaves, nothing else in it */
const reinstall = async (storage: ExtensionStorage, installed: Record<string, unknown>): Promise<void> => {
  await storage.reset();
  await storage.seed(installed);
};

/** A new page at the size of `surface`, light, with motion: the user's default */
const openPage = async (context: BrowserContext, surface: Surface): Promise<Page> => {
  const page = await context.newPage();
  await page.setViewportSize({ width: SURFACES[surface].width, height: SURFACES[surface].height });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  return page;
};

const surfaceUrl = (extensionId: string, surface: Surface): string => `chrome-extension://${extensionId}/src/${SURFACES[surface].file}.html`;

/** Puts CLIPBOARD_BEFORE in the clipboard, from a page of the extension that is not timed */
const resetClipboard = async (context: BrowserContext, extensionId: string): Promise<void> => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
  await page.evaluate((text) => navigator.clipboard.writeText(text), CLIPBOARD_BEFORE);
  await page.close();
};

const welcome = (page: Page): Locator => page.getByTestId('welcome');
const primary = (page: Page): Locator => page.getByTestId('welcome-primary');
const cards = (page: Page): Locator => page.getByTestId('prompt-card');
const notification = (page: Page): Locator => page.getByTestId('toast');
const whatsNew = (page: Page): Locator => page.getByRole('dialog', { name: /what.s new/i });

/** The Welcome at `step`, its title in view */
const atStep = async (page: Page, step: 0 | 1 | 2): Promise<void> => {
  await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
  await expect(page.getByRole('heading', { level: 1, name: STEP_TITLES[step] })).toBeVisible();
};

// --- Display ---

type DisplaySample = {
  welcomeAttached: number;
  primaryHitTestable: number;
  /** The Welcome's opacity in the frame where the primary first was hit-testable */
  opacityAtHitTestable: number;
  firstVisible: number;
  opaque: number;
  /** The primary's opacity, multiplied through its ancestors, at 1 */
  primaryOpaque: number;
  /** When Chromium reports it: not under every set of flags (none under CI's, as the Welcome fades in) */
  firstContentfulPaint: number | null;
};

type DisplayWindow = typeof globalThis & { welcomeDisplay: { [K in keyof DisplaySample]: number | null } };

/**
 * Notes, from the document's start and in every animation frame, the times of DisplaySample; read
 * with `displayTimes` once all are noted. performance.now() counts from navigation start
 */
const probeDisplay = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const times: DisplayWindow['welcomeDisplay'] = {
      welcomeAttached: null,
      primaryHitTestable: null,
      opacityAtHitTestable: null,
      firstVisible: null,
      opaque: null,
      primaryOpaque: null,
      firstContentfulPaint: null
    };
    (globalThis as DisplayWindow).welcomeDisplay = times;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          times.firstContentfulPaint = entry.startTime;
        }
      }
    }).observe({ type: 'paint', buffered: true });
    const opacityThrough = (element: Element): number => {
      let opacity = 1;
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
      }
      return opacity;
    };
    const tick = (): void => {
      const now = performance.now();
      const main = document.querySelector('[data-testid="welcome"]');
      const button = document.querySelector('[data-testid="welcome-primary"]');
      const opacity = main ? Number(getComputedStyle(main).opacity) : 0;
      if (main && times.welcomeAttached === null) {
        times.welcomeAttached = now;
      }
      if (button && times.primaryHitTestable === null) {
        const box = button.getBoundingClientRect();
        const hit = box.width > 0 && box.height > 0 ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
        if (hit && button.contains(hit)) {
          times.primaryHitTestable = now;
          times.opacityAtHitTestable = opacity;
        }
      }
      if (main && times.firstVisible === null && opacity > 0) {
        times.firstVisible = now;
      }
      if (main && times.opaque === null && opacity === 1) {
        times.opaque = now;
      }
      if (button && times.primaryOpaque === null && opacityThrough(button) === 1) {
        times.primaryOpaque = now;
      }
      if (times.primaryHitTestable === null || times.firstVisible === null || times.opaque === null || times.primaryOpaque === null) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
};

/** The probe's times once every one is noted; if one never comes, the error names it */
const displayTimes = async (page: Page): Promise<DisplaySample> => {
  const read = () => page.evaluate(() => (globalThis as DisplayWindow).welcomeDisplay);
  const missing = async (): Promise<string[]> =>
    Object.entries(await read())
      .filter(([key, value]) => value === null && key !== 'firstContentfulPaint')
      .map(([key]) => key);
  await expect.poll(missing, { message: 'display times never noted', timeout: 10_000 }).toEqual([]);
  return (await read()) as DisplaySample;
};

/** One opening of `surface` on a pending Welcome, timed by the display probe */
const timeOneOpening = async (context: BrowserContext, extensionId: string, surface: Surface): Promise<DisplaySample> => {
  const page = await openPage(context, surface);
  await probeDisplay(page);
  await page.goto(surfaceUrl(extensionId, surface));
  const sample = await displayTimes(page);
  await atStep(page, 0);
  await page.close();
  return sample;
};

/** `sample` with each number rounded to a tenth */
const rounded = <T extends object>(sample: T): T =>
  Object.fromEntries(Object.entries(sample).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value])) as T;

type Timed<T> = T & { load: number[] };

const summarizeDisplay = (runs: readonly Timed<DisplaySample>[]) => ({
  primaryHitTestable: stats(runs.map((run) => run.primaryHitTestable)),
  firstVisible: stats(runs.map((run) => run.firstVisible)),
  opaque: stats(runs.map((run) => run.opaque)),
  primaryOpaque: stats(runs.map((run) => run.primaryOpaque)),
  welcomeAttached: stats(runs.map((run) => run.welcomeAttached)),
  firstContentfulPaint: statsOfNoted(runs.map((run) => run.firstContentfulPaint)),
  load1m: stats(runs.map((run) => run.load[0])),
  /** The first opening of the series, the coldest */
  firstOpening: rounded(runs[0]),
  runs: runs.map(rounded)
});

const displayLine = (summary: ReturnType<typeof summarizeDisplay>): string =>
  `median of ${String(summary.opaque.n)}: hit-testable ${String(summary.primaryHitTestable.median)}ms, first visible ${String(summary.firstVisible.median)}ms, opaque ${String(summary.opaque.median)}ms (${String(summary.opaque.min)}-${String(summary.opaque.max)}), primary opaque ${String(summary.primaryOpaque.median)}ms; first opening opaque ${String(summary.firstOpening.opaque)}ms; load 1m ${String(summary.load1m.min)}-${String(summary.load1m.max)}`;

// --- Display on the real surfaces, from the user's open request ---

type ViewTimes = { found: number; welcomeAttached: number | null; primaryHitTestable: number | null; firstVisible: number | null; opaque: number | null };

type ObserverWindow = typeof globalThis & {
  surfaceView: { timeOrigin: number; times: ViewTimes; viewport: number[] } | null;
  surfaceRequestedAt: number | null;
  surfaceOpenError: string | null;
};

/**
 * In `observer`, an extension page in a tab: watches for the view of the extension at `pathname` (the
 * real popup or side panel, which Playwright cannot attach to) with chrome.extension.getViews, and as
 * soon as it exists runs in it the display probe's frame loop, on the view's own clock
 */
const watchForView = (observer: Page, pathname: string): Promise<void> =>
  observer.evaluate((path) => {
    const watch = globalThis as ObserverWindow;
    watch.surfaceView = null;
    watch.surfaceRequestedAt = null;
    watch.surfaceOpenError = null;
    const look = (): void => {
      const view = chrome.extension.getViews().find((candidate) => candidate.location.pathname === path);
      if (view === undefined) {
        setTimeout(look, 0);
        return;
      }
      const times: ViewTimes = { found: view.performance.now(), welcomeAttached: null, primaryHitTestable: null, firstVisible: null, opaque: null };
      watch.surfaceView = { timeOrigin: view.performance.timeOrigin, times, viewport: [] };
      const tick = (): void => {
        const now = view.performance.now();
        const main = view.document.querySelector('[data-testid="welcome"]');
        const button = view.document.querySelector('[data-testid="welcome-primary"]');
        const opacity = main ? Number(view.getComputedStyle(main).opacity) : 0;
        if (main && times.welcomeAttached === null) {
          times.welcomeAttached = now;
        }
        if (button && times.primaryHitTestable === null) {
          const box = button.getBoundingClientRect();
          const hit = box.width > 0 && box.height > 0 ? view.document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
          if (hit && button.contains(hit)) {
            times.primaryHitTestable = now;
          }
        }
        if (main && times.firstVisible === null && opacity > 0) {
          times.firstVisible = now;
        }
        if (main && times.opaque === null && opacity === 1) {
          times.opaque = now;
          if (watch.surfaceView) {
            watch.surfaceView.viewport = [view.innerWidth, view.innerHeight];
          }
        }
        if (times.primaryHitTestable === null || times.firstVisible === null || times.opaque === null) {
          view.requestAnimationFrame(tick);
        }
      };
      view.requestAnimationFrame(tick);
    };
    look();
  }, pathname);

type RealSample = {
  /** From the open request to the surface's navigation start: the browser's own time, before any code of the extension runs */
  navigationStart: number;
  /** From the open request */
  welcomeAttached: number;
  primaryHitTestable: number;
  firstVisible: number;
  opaque: number;
  /** From the surface's navigation start, as the other display series count */
  opaqueFromNavigationStart: number;
  viewport: number[];
};

/** The id Chromium gives the unpacked extension at `extensionPath`: the first 32 hex digits of the SHA-256 of its absolute path, each written a to p */
const unpackedExtensionId = async (extensionPath: string): Promise<string> => {
  const hex = createHash('sha256')
    .update(await fs.realpath(extensionPath))
    .digest('hex')
    .slice(0, 32);
  return [...hex].map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16))).join('');
};

/**
 * The first opening of the real `surface` in a browser of its own right after the install, timed from
 * the user's open request: for the popup, chrome.action.openPopup() (a script cannot click the toolbar
 * icon), the interface mode set to popup first as the action opens the side panel by default, the
 * action pinned on the toolbar when `pinned` (written in the profile's preferences before Chromium
 * starts, and checked); for the side panel, chrome.sidePanel.open() in the click handler of a button,
 * clicked by Playwright (a real user gesture, which that call requires). Both requests are noted in
 * the observer page, in the extension's process, on the same clock as the view's timeOrigin
 */
const timeRealSurface = async (surface: Surface, pinned = false): Promise<RealSample> => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-measures-real-'));
  if (pinned) {
    await fs.mkdir(path.join(profile, 'Default'), { recursive: true });
    await fs.writeFile(path.join(profile, 'Default', 'Preferences'), JSON.stringify({ extensions: { pinned_extensions: [await unpackedExtensionId(DEFAULT_EXTENSION_PATH)] } }));
  }
  const context = await launchExtensionContext(profile, DEFAULT_EXTENSION_PATH);
  try {
    const worker = (await waitForBackgroundTarget(context)) as Worker;
    const storage = createStorageController(worker);
    await waitForFirstInstallRecords(storage);
    const extensionId = new URL(worker.url()).host;
    expect(await worker.evaluate(async () => (await chrome.action.getUserSettings()).isOnToolbar), `the action ${pinned ? 'pinned' : 'not pinned'} on the toolbar`).toBe(pinned);
    if (surface === 'popup') {
      await storage.seed({ interfaceMode: 'popup' });
      await expect.poll(() => worker.evaluate(() => chrome.action.getPopup({}))).toMatch(/src\/popup\.html$/);
    }
    const observer = await context.newPage();
    await observer.goto(`chrome-extension://${extensionId}/src/analytics.html`);
    await observer.bringToFront();
    await watchForView(observer, `/src/${SURFACES[surface].file}.html`);
    if (surface === 'popup') {
      await observer.evaluate(async () => {
        const watch = globalThis as ObserverWindow;
        watch.surfaceRequestedAt = performance.timeOrigin + performance.now();
        await chrome.action.openPopup();
      });
    } else {
      const windowId = await observer.evaluate(async () => (await chrome.windows.getCurrent()).id);
      await observer.evaluate((id) => {
        const button = document.createElement('button');
        button.id = 'measures-open-side-panel';
        button.textContent = 'Open the side panel';
        button.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:2147483647;width:240px;height:64px';
        button.addEventListener('click', () => {
          const watch = globalThis as ObserverWindow;
          watch.surfaceRequestedAt = performance.timeOrigin + performance.now();
          chrome.sidePanel.open({ windowId: id ?? chrome.windows.WINDOW_ID_CURRENT }).catch((error: unknown) => {
            watch.surfaceOpenError = String(error);
          });
        });
        document.body.append(button);
      }, windowId);
      await observer.locator('#measures-open-side-panel').click();
    }
    const handle = await observer.waitForFunction(() => {
      const { surfaceView, surfaceRequestedAt, surfaceOpenError } = globalThis as ObserverWindow;
      const done = surfaceOpenError !== null || (surfaceView !== null && surfaceView.times.opaque !== null);
      return done ? { surfaceView, surfaceRequestedAt, surfaceOpenError } : null;
    });
    const { surfaceView, surfaceRequestedAt, surfaceOpenError } = (await handle.jsonValue()) as Pick<ObserverWindow, 'surfaceView' | 'surfaceRequestedAt' | 'surfaceOpenError'>;
    expect(surfaceOpenError, `the ${surface} opened`).toBeNull();
    if (surfaceView === null || surfaceRequestedAt === null) {
      throw new Error(`No ${surface} to time`);
    }
    const { timeOrigin, times, viewport } = surfaceView;
    const fromRequest = (at: number | null): number => timeOrigin + (at ?? Number.NaN) - surfaceRequestedAt;
    return {
      navigationStart: timeOrigin - surfaceRequestedAt,
      welcomeAttached: fromRequest(times.welcomeAttached),
      primaryHitTestable: fromRequest(times.primaryHitTestable),
      firstVisible: fromRequest(times.firstVisible),
      opaque: fromRequest(times.opaque),
      opaqueFromNavigationStart: times.opaque ?? Number.NaN,
      viewport
    };
  } finally {
    await context.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
};

const summarizeReal = (runs: readonly Timed<RealSample>[]) => ({
  navigationStart: stats(runs.map((run) => run.navigationStart)),
  primaryHitTestable: stats(runs.map((run) => run.primaryHitTestable)),
  firstVisible: stats(runs.map((run) => run.firstVisible)),
  opaque: stats(runs.map((run) => run.opaque)),
  opaqueFromNavigationStart: stats(runs.map((run) => run.opaqueFromNavigationStart)),
  load1m: stats(runs.map((run) => run.load[0])),
  runs: runs.map(rounded)
});

// --- The reading model in the page ---

/** The text a reader sees in `container`: visible text, not clipped to a pixel as screen-reader-only text is */
const visibleText = (container: Locator): Promise<string> =>
  container.evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const words: string[] = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent === null || !parent.checkVisibility({ visibilityProperty: true, opacityProperty: false })) {
        continue;
      }
      const box = parent.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) {
        continue;
      }
      words.push(...(node.textContent ?? '').split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)));
    }
    return words.join(' ');
  });

/** A screen of a timed run: what the reader reads there, and the action that leaves it */
interface Screen {
  readonly screen: string;
  readonly text: string;
  readonly words: number;
  readonly readingMs: number;
  /** Time the reader spends on the screen besides reading: watching the typing demo */
  readonly watchingMs: number;
  readonly action: string | null;
  /** Time the extension took to open, or to answer the action that brought this screen, by the test's clock */
  readonly machineMs: number;
}

const screenOf = (screen: string, text: string, action: string | null, machineMs: number, watchingMs = 0): Screen => {
  const words = text === '' ? 0 : text.split(' ').length;
  return { screen, text, words, readingMs: round(readingMs(words)), watchingMs: round(watchingMs), action, machineMs: round(machineMs) };
};

/** The total of `screens` by the reading model: reading and watching, KLM per action, and the machine time measured */
const totalOf = (screens: readonly Screen[]) => {
  const reading = screens.reduce((sum, screen) => sum + screen.readingMs, 0);
  const watching = screens.reduce((sum, screen) => sum + screen.watchingMs, 0);
  const actions = screens.filter((screen) => screen.action !== null).length;
  const klm = actions * KLM_ACTION_MS;
  const machineTime = screens.reduce((sum, screen) => sum + screen.machineMs, 0);
  return {
    words: screens.reduce((sum, screen) => sum + screen.words, 0),
    readingMs: round(reading),
    watchingMs: round(watching),
    actions,
    klmMs: klm,
    machineMs: round(machineTime),
    totalMs: round(reading + watching + klm + machineTime)
  };
};

/** Milliseconds `run` takes, by the test's clock */
const timed = async (run: () => Promise<void>): Promise<number> => {
  const start = performance.now();
  await run();
  return performance.now() - start;
};

/** Every click of a timed run goes through `act`, which keeps the list the actions and clicks are counted from */
const actionCounter = () => {
  const actions: string[] = [];
  return {
    actions,
    act: async (name: string, target: Locator): Promise<void> => {
      actions.push(name);
      await target.click();
    }
  };
};

/** The copy button of a card, its Prompt's title and content; done once the clipboard holds the content */
const firstCard = async (page: Page) => {
  const card = cards(page).first();
  const title = (await card.getByRole('heading').textContent()) ?? '';
  const content = PACK_PROMPTS.find((prompt) => prompt.title === title)?.content;
  expect(content, `the first card, ${title}, is a Prompt of the Packs`).toBeDefined();
  return { card, title, content: content ?? '', copy: card.getByRole('button', { name: `Copy content of ${title} to clipboard` }) };
};

type CopyWindow = typeof globalThis & { copyProbe: { clickedAt: number | null; copiedAt: number | null } };

/** Notes in the page when the last click landed and when a copy reached the clipboard: the extension's own time for a copy */
const probeCopy = async (page: Page): Promise<void> => {
  await page.addInitScript((before: string) => {
    const probe: CopyWindow['copyProbe'] = { clickedAt: null, copiedAt: null };
    (globalThis as CopyWindow).copyProbe = probe;
    document.addEventListener(
      'click',
      () => {
        probe.clickedAt = performance.now();
      },
      true
    );
    const clipboard = navigator.clipboard;
    const write = clipboard.writeText.bind(clipboard);
    clipboard.writeText = async (data: string): Promise<void> => {
      await write(data);
      if (data !== before) {
        probe.copiedAt = performance.now();
      }
    };
  }, CLIPBOARD_BEFORE);
};

/**
 * Copies the first card with `act` and waits for the clipboard, read back, to hold its Prompt. Timed
 * by the test's clock (the click with Playwright's checks that the button can take it, and the reads
 * of the clipboard) and in the page, from the click to the copy landing: the extension's own time
 */
const copyFirstCard = async (page: Page, act: (name: string, target: Locator) => Promise<void>, first: Awaited<ReturnType<typeof firstCard>>) => {
  let clickCallMs = 0;
  const testClockMs = await timed(async () => {
    clickCallMs = await timed(() => act('Copy', first.copy));
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()), { intervals: [5] }).toBe(first.content);
  });
  const { clickedAt, copiedAt } = await page.evaluate(() => (globalThis as CopyWindow).copyProbe);
  expect(copiedAt, 'the copy landed in the page').not.toBeNull();
  return { testClockMs: round(testClockMs), clickCallMs: round(clickCallMs), inPageMs: round((copiedAt ?? Number.NaN) - (clickedAt ?? Number.NaN)) };
};

/**
 * The whole journey, every screen read (target 1): step 1, Next, step 2 read and its typing demo
 * watched to its end, Next, step 3, Add N prompts, the Library and its Notification. Then the reader
 * reads the first card and copies it: the first copy by the longest way (a check on target 3)
 */
const journeyRun = async (context: BrowserContext, extensionId: string) => {
  const { actions, act } = actionCounter();
  const page = await openPage(context, 'popup');
  await probeCopy(page);
  await watchWelcomeMotion(page);
  const loadAtStart = load();
  const screens: Screen[] = [];

  const open = await timed(async () => {
    await page.goto(surfaceUrl(extensionId, 'popup'));
    await atStep(page, 0);
  });
  screens.push(screenOf('step 1', await visibleText(welcome(page)), 'Next', open));

  const toStep2 = await timed(async () => {
    await act('Next', primary(page));
    await atStep(page, 1);
  });
  const demo = await typingDemoMs(page);
  // The words counted with the blank filled, as the reader sees the sentence whole
  await expect(page.getByTestId('welcome-blank')).toHaveText('Claire, Head of Sales');
  screens.push(screenOf('step 2', await visibleText(welcome(page)), 'Next', toStep2, demo));

  const toStep3 = await timed(async () => {
    await act('Next', primary(page));
    await atStep(page, 2);
  });
  await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_COUNT)} prompts`);
  screens.push(screenOf('step 3', await visibleText(welcome(page)), `Add ${String(DEFAULT_COUNT)} prompts`, toStep3));

  const toLibrary = await timed(async () => {
    await act(`Add ${String(DEFAULT_COUNT)} prompts`, primary(page));
    await expect(welcome(page)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(DEFAULT_COUNT);
    await expect(notification(page).getByText(`${String(DEFAULT_COUNT)} prompts added`, { exact: true })).toBeVisible();
  });
  const actionsToReadyLibrary = actions.length;
  const journeyScreens = [...screens, screenOf('the Library: the Notification', await visibleText(notification(page)), null, toLibrary)];

  // The first copy after reading every screen: the Notification and the first card read, then Copy
  const first = await firstCard(page);
  screens.push(screenOf('the Library: the Notification and the first card', `${await visibleText(notification(page))} ${await visibleText(first.card)}`, 'Copy', toLibrary));
  const copy = await copyFirstCard(page, act, first);
  screens.push(screenOf('the clipboard holds the Prompt', '', null, copy.testClockMs));
  await page.close();

  return {
    load: loadAtStart,
    typingDemoMs: round(demo),
    actionNames: [...actions],
    actionsToReadyLibrary,
    journey: { screens: journeyScreens, ...totalOf(journeyScreens) },
    copyAfterEveryScreen: { screens, ...totalOf(screens), copied: first.title, copy }
  };
};

/**
 * The first copy through a Pack by the shortest way (targets 2, 3 and 4): step 1 read, Skip, step 3
 * read, Add N prompts, the Library's Notification and first card read, Copy; the clipboard read back
 */
const firstCopyRun = async (context: BrowserContext, extensionId: string) => {
  const { actions, act } = actionCounter();
  const page = await openPage(context, 'popup');
  await probeCopy(page);
  const loadAtStart = load();
  const screens: Screen[] = [];
  const wallStart = performance.now();

  const open = await timed(async () => {
    await page.goto(surfaceUrl(extensionId, 'popup'));
    await atStep(page, 0);
  });
  screens.push(screenOf('step 1', await visibleText(welcome(page)), 'Skip', open));

  const toStep3 = await timed(async () => {
    await act('Skip', page.getByRole('button', { name: 'Skip' }));
    await atStep(page, 2);
  });
  screens.push(screenOf('step 3', await visibleText(welcome(page)), `Add ${String(DEFAULT_COUNT)} prompts`, toStep3));

  const toLibrary = await timed(async () => {
    await act(`Add ${String(DEFAULT_COUNT)} prompts`, primary(page));
    await expect(welcome(page)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(DEFAULT_COUNT);
  });
  const actionsToReadyLibrary = actions.length;
  const first = await firstCard(page);
  screens.push(screenOf('the Library: the Notification and the first card', `${await visibleText(notification(page))} ${await visibleText(first.card)}`, 'Copy', toLibrary));

  const copy = await copyFirstCard(page, act, first);
  screens.push(screenOf('the clipboard holds the Prompt', '', null, copy.testClockMs));
  const wallMs = performance.now() - wallStart;
  await page.close();

  return {
    load: loadAtStart,
    actionNames: [...actions],
    actionsToReadyLibrary,
    clicksAfterWelcome: actions.length - actionsToReadyLibrary,
    copied: first.title,
    copy,
    /** The script's own time from the opening to the clipboard holding the Prompt, reading nothing */
    wallMs: round(wallMs),
    screens,
    ...totalOf(screens)
  };
};

// --- An existing user's Library ---

type LibrarySample = { cardAttached: number; copyHitTestable: number; copyOpaque: number; firstContentfulPaint: number | null };

type LibraryWindow = typeof globalThis & { libraryDisplay: { [K in keyof LibrarySample]: number | null } };

/** Notes, from the document's start and in every animation frame, when the first card is in the page and its copy button hit-testable and opaque */
const probeLibrary = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const times: LibraryWindow['libraryDisplay'] = { cardAttached: null, copyHitTestable: null, copyOpaque: null, firstContentfulPaint: null };
    (globalThis as LibraryWindow).libraryDisplay = times;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          times.firstContentfulPaint = entry.startTime;
        }
      }
    }).observe({ type: 'paint', buffered: true });
    const opacityThrough = (element: Element): number => {
      let opacity = 1;
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
      }
      return opacity;
    };
    const tick = (): void => {
      const now = performance.now();
      const card = document.querySelector('[data-testid="prompt-card"]');
      const copy = card?.querySelector('button[aria-label^="Copy content of"]') ?? null;
      if (card && times.cardAttached === null) {
        times.cardAttached = now;
      }
      if (copy && times.copyHitTestable === null) {
        const box = copy.getBoundingClientRect();
        const hit = box.width > 0 && box.height > 0 ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
        if (hit && copy.contains(hit)) {
          times.copyHitTestable = now;
        }
      }
      if (copy && times.copyOpaque === null && opacityThrough(copy) === 1) {
        times.copyOpaque = now;
      }
      if (times.copyHitTestable === null || times.copyOpaque === null) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
};

const LIBRARY_PROMPTS = 20;

/** An existing user's store, the same for both builds: a Library of their own, the Welcome done, this Release's notes seen */
const seedExistingUser = async (storage: ExtensionStorage, version: string): Promise<void> => {
  await storage.reset();
  await seedLibrary(storage, {
    prompts: Array.from({ length: LIBRARY_PROMPTS }, (_, index) =>
      createPromptSeed({
        id: `own-${String(index + 1)}`,
        title: `Own prompt ${String(index + 1)}`,
        content: `Write a follow-up email to {{name}} about point ${String(index + 1)}, and end with one clear next step.`
      })
    )
  });
  await storage.seed({ [WELCOME_KEY]: { status: 'done' }, [WHATS_NEW_KEY]: { installedVersion: version, lastSeenVersion: version } });
};

/** The Release of the extension loaded in `context`, read from its service worker */
const versionOf = async (context: BrowserContext): Promise<string> => {
  // The background of a Manifest V3 extension is its service worker, as the storage fixture casts it
  const worker = (await waitForBackgroundTarget(context)) as Worker;
  return worker.evaluate(() => chrome.runtime.getManifest().version);
};

/**
 * A browser of its own on `extensionPath`, once its install wrote the Release of install. The merge
 * base has no Welcome record to wait for, and that write is its only one at install
 */
const ownBrowser = async (extensionPath: string) => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-measures-profile-'));
  const context = await launchExtensionContext(profile, extensionPath);
  const worker = await waitForBackgroundTarget(context);
  const storage = createStorageController(worker);
  await expect.poll(async () => Object.keys(await storage.get([WHATS_NEW_KEY])).length, { timeout: 30_000 }).toBe(1);
  return {
    context,
    storage,
    extensionId: new URL(worker.url()).host,
    dispose: async (): Promise<void> => {
      await context.close();
      await fs.rm(profile, { recursive: true, force: true });
    }
  };
};

/** One opening of the popup on the existing user's Library, timed by the Library probe; the Library alone checked after the timing */
const timeLibraryOpening = async (context: BrowserContext, extensionId: string): Promise<LibrarySample> => {
  const page = await openPage(context, 'popup');
  await probeLibrary(page);
  await page.goto(surfaceUrl(extensionId, 'popup'));
  const handle = await page.waitForFunction(() => {
    const times = (globalThis as LibraryWindow).libraryDisplay;
    return times.cardAttached !== null && times.copyHitTestable !== null && times.copyOpaque !== null ? times : null;
  });
  const sample = (await handle.jsonValue()) as LibrarySample;
  await expect(cards(page)).toHaveCount(LIBRARY_PROMPTS);
  await expect(welcome(page)).toHaveCount(0);
  await expect(whatsNew(page)).toHaveCount(0);
  await page.close();
  return sample;
};

// --- Colors ---

/**
 * `css` as the page draws it over `backdrop` (#RRGGBB), read back from a pixel of a canvas, so any color
 * the page computes (rgb, oklab, a color-mix with alpha…) comes out as the #RRGGBB on screen
 */
const drawnOver = (page: Page, css: string, backdrop?: string): Promise<string> =>
  page.evaluate(
    ({ color, under }) => {
      if (!CSS.supports('color', color)) {
        throw new Error(`Not a color: ${color}`);
      }
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (context === null) {
        throw new Error('No 2d canvas');
      }
      if (under !== null) {
        context.fillStyle = under;
        context.fillRect(0, 0, 1, 1);
      }
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
      if (alpha !== 255) {
        throw new Error(`${color} is translucent: give the color it is drawn over`);
      }
      return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    },
    { color: css, under: backdrop ?? null }
  );

type ColorPair = { pair: string; kind: 'text' | 'non-text'; min: number; fg: string; bg: string; ratio: number };

const pairOf = (pair: string, kind: ColorPair['kind'], fg: string, bg: string): ColorPair => ({
  pair,
  kind,
  min: kind === 'text' ? 4.5 : 3,
  fg,
  bg,
  ratio: Math.round(getContrastRatio(fg, bg) * 100) / 100
});

/** Computed style properties of the first element `selector` matches */
const styleOf = (page: Page, selector: string, properties: readonly string[]): Promise<Record<string, string>> =>
  page.evaluate(
    ({ selector: query, properties: names }) => {
      const element = document.querySelector(query);
      if (element === null) {
        throw new Error(`Nothing matches ${query}`);
      }
      const style = getComputedStyle(element);
      return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
    },
    { selector, properties }
  );

/** Resolves once every finite animation and transition of the page has ended (scroll-driven ones never end): colors as they finally are */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });

const DOTS = '[role="group"][aria-label="Steps"] button';

/** The Welcome's lowest contrast pairs (My-Prompt-Manager-ojz.11), read from the colors the page draws */
const welcomeColorPairs = async (page: Page): Promise<ColorPair[]> => {
  const pairs: ColorPair[] = [];
  await animationsDone(page);
  const frame = await drawnOver(page, (await styleOf(page, '[data-testid="welcome"]', ['background-color']))['background-color']);
  const title = await drawnOver(page, (await styleOf(page, 'h1', ['color'])).color, frame);
  const text = await drawnOver(page, (await styleOf(page, '[data-testid="welcome-step"] p', ['color'])).color, frame);
  const active = await drawnOver(page, (await styleOf(page, `${DOTS}[aria-current="step"] > span`, ['background-color']))['background-color'], frame);
  const inactive = await drawnOver(page, (await styleOf(page, `${DOTS}:not([aria-current]) > span`, ['background-color']))['background-color'], frame);
  const button = await styleOf(page, '[data-testid="welcome-primary"]', ['background-color', 'color']);
  const buttonFill = await drawnOver(page, button['background-color'], frame);
  pairs.push(
    pairOf('step title on the frame', 'text', title, frame),
    pairOf('step text on the frame', 'text', text, frame),
    pairOf('primary label on the primary', 'text', await drawnOver(page, button.color, buttonFill), buttonFill),
    pairOf('primary on the frame', 'non-text', buttonFill, frame),
    pairOf('active dot on the frame', 'non-text', active, frame),
    pairOf('inactive dot on the frame', 'non-text', inactive, frame)
  );

  // The focus outline, the keyboard on the primary
  for (let press = 0; press < 12; press++) {
    if (await primary(page).evaluate((element) => element === document.activeElement)) {
      break;
    }
    await page.keyboard.press('Tab');
  }
  await expect(primary(page)).toBeFocused();
  const outline = await styleOf(page, '[data-testid="welcome-primary"]', ['outline-color', 'outline-style']);
  expect(outline['outline-style']).not.toBe('none');
  pairs.push(pairOf('focus outline on the frame', 'non-text', await drawnOver(page, outline['outline-color'], frame), frame));

  // The primary hovered: a transient state, given for the record (.11 found it under 3:1 in dark)
  await primary(page).hover();
  await animationsDone(page);
  const hovered = await drawnOver(page, (await styleOf(page, '[data-testid="welcome-primary"]', ['background-color']))['background-color'], frame);
  pairs.push(pairOf('primary hovered on the frame (transient)', 'non-text', hovered, frame));
  await page.mouse.move(0, 0);

  await primary(page).click();
  await atStep(page, 1);
  await animationsDone(page);
  const backStyle = await page.getByRole('button', { name: 'Back' }).evaluate((element) => {
    const style = getComputedStyle(element);
    return { border: style.borderTopColor, color: style.color };
  });
  pairs.push(
    pairOf('Back border on the frame', 'non-text', await drawnOver(page, backStyle.border, frame), frame),
    pairOf('Back label on the frame', 'text', await drawnOver(page, backStyle.color, frame), frame)
  );

  await primary(page).click();
  await atStep(page, 2);
  await animationsDone(page);
  const packs = await page.getByRole('group', { name: 'Packs' }).evaluate((group) =>
    [...group.querySelectorAll('button')].map((pack) => {
      const style = getComputedStyle(pack);
      return { name: pack.textContent ?? '', pressed: pack.getAttribute('aria-pressed') === 'true', border: style.borderTopColor, fill: style.backgroundColor, color: style.color };
    })
  );
  const unselected = packs.find((pack) => !pack.pressed);
  expect(unselected, 'a Pack not selected by default').toBeDefined();
  if (unselected) {
    const card = await drawnOver(page, unselected.fill, frame);
    const border = await drawnOver(page, unselected.border, card);
    pairs.push(
      pairOf('unselected Pack border on the frame', 'non-text', border, frame),
      pairOf('unselected Pack border on its card', 'non-text', border, card)
    );
  }
  for (const pack of packs.filter((candidate) => candidate.pressed)) {
    const tint = await drawnOver(page, pack.fill, frame);
    const name = pack.name.replace(/\d.*$/, '').trim();
    pairs.push(
      pairOf(`selected ${name}: border on the frame`, 'non-text', await drawnOver(page, pack.border, tint), frame),
      pairOf(`selected ${name}: text on its tint`, 'text', await drawnOver(page, pack.color, tint), tint)
    );
  }
  return pairs;
};

// =====================================================================================================

test.describe('Measures of the Welcome on the built extension (MEASURE=1)', () => {
  test(`display, target 5 (under ${String(TARGETS.displayMs)}ms): ${String(OPENINGS)} openings of the popup and of the side panel in one browser, from navigation start`, async ({ context, extensionId }) => {
    test.setTimeout(5 * 60_000);
    const { storage } = await installedStore(context);
    const userAgent = await (async () => {
      const page = await context.newPage();
      const agent = await page.evaluate(() => navigator.userAgent);
      await page.close();
      return agent;
    })();

    const series: Record<string, ReturnType<typeof summarizeDisplay>> = {};
    for (const surface of ['popup', 'sidepanel'] as const) {
      const runs: Timed<DisplaySample>[] = [];
      for (let opening = 0; opening < OPENINGS; opening++) {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
        const loadNow = load();
        runs.push({ ...(await timeOneOpening(context, extensionId, surface)), load: loadNow });
      }
      series[surface] = summarizeDisplay(runs);
      note(`display ${surface}`, displayLine(series[surface]));
    }

    await writeSection('display', {
      tool: 'Playwright on the built extension; an init script notes performance.now() (from navigation start) in each requestAnimationFrame; elementFromPoint for hit-testable; getComputedStyle opacity',
      fadeMs: MOTION.welcomeIn,
      userAgent,
      viewport: { popup: SURFACES.popup, sidepanel: SURFACES.sidepanel },
      ...series
    });

    // A measure, not a gate on the machine: the target shows as a soft failure, the report written first
    const popup = series.popup;
    expect.soft(popup.opaque.median, 'popup: the Welcome fully opaque, median').toBeLessThan(TARGETS.displayMs);
    for (const run of popup.runs) {
      expect(run.primaryHitTestable).toBeLessThanOrEqual(run.opaque);
    }
  });

  test(`display, target 5: the first opening of the popup and of the side panel in ${String(OPENINGS)} browsers each, right after the install, from navigation start`, async () => {
    test.setTimeout(10 * 60_000);
    const series: Record<string, ReturnType<typeof summarizeDisplay>> = {};
    for (const surface of ['popup', 'sidepanel'] as const) {
      const runs: Timed<DisplaySample>[] = [];
      for (let browser = 0; browser < OPENINGS; browser++) {
        const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'playwright-measures-cold-'));
        const context = await launchExtensionContext(profile, DEFAULT_EXTENSION_PATH);
        try {
          const worker = await waitForBackgroundTarget(context);
          await waitForFirstInstallRecords(createStorageController(worker));
          const loadNow = load();
          runs.push({ ...(await timeOneOpening(context, new URL(worker.url()).host, surface)), load: loadNow });
        } finally {
          await context.close();
          await fs.rm(profile, { recursive: true, force: true });
        }
      }
      series[surface] = summarizeDisplay(runs);
      note(`display ${surface}, first opening after install`, displayLine(series[surface]));
    }
    await writeSection('displayFirstOpening', {
      tool: 'the display probe, each opening the first of a fresh browser and profile, after the install records',
      popup: series.popup,
      sidepanel: series.sidepanel
    });
    expect.soft(series.popup.opaque.median, 'popup, first opening: the Welcome fully opaque, median').toBeLessThan(TARGETS.displayMs);
  });

  test(`display, target 5, on the real surfaces from the user's open request: the action popup, its action not pinned and pinned, and the side panel, the first opening of ${String(OPENINGS)} browsers each`, async () => {
    test.setTimeout(15 * 60_000);
    const series: Record<string, ReturnType<typeof summarizeReal>> = {};
    const variants = [
      { name: 'popup', surface: 'popup', pinned: false },
      { name: 'popupPinned', surface: 'popup', pinned: true },
      { name: 'sidepanel', surface: 'sidepanel', pinned: false }
    ] as const;
    for (const { name, surface, pinned } of variants) {
      const runs: Timed<RealSample>[] = [];
      for (let browser = 0; browser < OPENINGS; browser++) {
        const loadNow = load();
        runs.push({ ...(await timeRealSurface(surface, pinned)), load: loadNow });
      }
      series[name] = summarizeReal(runs);
      const summary = series[name];
      note(
        `display ${name}, real, from the open request`,
        `median of ${String(summary.opaque.n)}: navigation start ${String(summary.navigationStart.median)}ms, hit-testable ${String(summary.primaryHitTestable.median)}ms, first visible ${String(summary.firstVisible.median)}ms, opaque ${String(summary.opaque.median)}ms (${String(summary.opaque.min)}-${String(summary.opaque.max)}); opaque from navigation start ${String(summary.opaqueFromNavigationStart.median)}ms; load 1m ${String(summary.load1m.min)}-${String(summary.load1m.max)}`
      );
    }
    await writeSection('displayRealSurfaces', {
      tool: 'Playwright; the real popup opened by chrome.action.openPopup(), its action not pinned (popup) and pinned on the toolbar (popupPinned), and the real side panel by chrome.sidePanel.open() on a click; an extension page reaches each with chrome.extension.getViews and runs the display probe in it; times from the open request, on the extension process clock',
      popup: series.popup,
      popupPinned: series.popupPinned,
      sidepanel: series.sidepanel
    });
    expect.soft(series.popup.opaque.median, 'the real popup, its action not pinned: the Welcome fully opaque from the open request, median').toBeLessThan(TARGETS.displayMs);
    expect.soft(series.popupPinned.opaque.median, 'the real popup, its action pinned: the Welcome fully opaque from the open request, median').toBeLessThan(TARGETS.displayMs);
    expect.soft(series.sidepanel.opaque.median, 'the real side panel: the Welcome fully opaque from the click, median').toBeLessThan(TARGETS.displayMs);
  });

  test(`journey, targets 1 and 3: every screen read, ${String(JOURNEY_RUNS)} runs, by the reading model`, async ({ context, extensionId }) => {
    test.setTimeout(5 * 60_000);
    const { storage, installed } = await installedStore(context);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const runs: Awaited<ReturnType<typeof journeyRun>>[] = [];
    for (let run = 0; run < JOURNEY_RUNS; run++) {
      await reinstall(storage, installed);
      await resetClipboard(context, extensionId);
      runs.push(await journeyRun(context, extensionId));
    }

    const journey = {
      totalMs: stats(runs.map((run) => run.journey.totalMs)),
      machineMs: stats(runs.map((run) => run.journey.machineMs)),
      typingDemoMs: stats(runs.map((run) => run.typingDemoMs)),
      words: runs[0].journey.screens.map((screen) => ({ screen: screen.screen, words: screen.words, text: screen.text })),
      readingMs: runs[0].journey.readingMs,
      klmMs: runs[0].journey.klmMs,
      actionNames: runs[0].actionNames.slice(0, runs[0].actionsToReadyLibrary),
      load1m: stats(runs.map((run) => run.load[0]))
    };
    const copyAfterEveryScreen = {
      totalMs: stats(runs.map((run) => run.copyAfterEveryScreen.totalMs)),
      machineMs: stats(runs.map((run) => run.copyAfterEveryScreen.machineMs)),
      actionNames: runs[0].actionNames
    };
    note('journey', `median ${String(journey.totalMs.median)}ms (${String(journey.totalMs.min)}-${String(journey.totalMs.max)}): words ${journey.words.map((screen) => screen.words).join(' + ')}, reading ${String(journey.readingMs)}ms, demo median ${String(journey.typingDemoMs.median)}ms, KLM ${String(journey.klmMs)}ms, machine median ${String(journey.machineMs.median)}ms; load 1m ${String(journey.load1m.min)}-${String(journey.load1m.max)}`);
    note('first copy after every screen', `median ${String(copyAfterEveryScreen.totalMs.median)}ms`);
    await writeSection('journey', {
      tool: 'Playwright on the built extension, the reading model: rendered words at 238 wpm, the typing demo watched to its end, KLM 1.3 s per action, machine time by the test clock',
      model: { wpm: READING_WPM, klmPointMs: KLM_POINT_MS, klmClickMs: KLM_CLICK_MS },
      targetMs: TARGETS.journeyMs,
      ...journey,
      copyAfterEveryScreen,
      runs
    });
    expect.soft(journey.totalMs.median, 'the whole journey, every screen read, median').toBeLessThan(TARGETS.journeyMs);
  });

  test(`first copy through a Pack, targets 2, 3 and 4: Skip, Add, Copy, ${String(JOURNEY_RUNS)} runs, by the reading model`, async ({ context, extensionId }) => {
    test.setTimeout(5 * 60_000);
    const { storage, installed } = await installedStore(context);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const runs: Awaited<ReturnType<typeof firstCopyRun>>[] = [];
    for (let run = 0; run < JOURNEY_RUNS; run++) {
      await reinstall(storage, installed);
      await resetClipboard(context, extensionId);
      runs.push(await firstCopyRun(context, extensionId));
    }

    const firstCopy = {
      totalMs: stats(runs.map((run) => run.totalMs)),
      machineMs: stats(runs.map((run) => run.machineMs)),
      wallMs: stats(runs.map((run) => run.wallMs)),
      words: runs[0].screens.map((screen) => ({ screen: screen.screen, words: screen.words, text: screen.text })),
      readingMs: runs[0].readingMs,
      klmMs: runs[0].klmMs,
      copyTestClockMs: stats(runs.map((run) => run.copy.testClockMs)),
      copyClickCallMs: stats(runs.map((run) => run.copy.clickCallMs)),
      copyInPageMs: stats(runs.map((run) => run.copy.inPageMs)),
      actionNames: runs[0].actionNames,
      actionsToReadyLibrary: Math.max(...runs.map((run) => run.actionsToReadyLibrary)),
      clicksAfterWelcome: Math.max(...runs.map((run) => run.clicksAfterWelcome)),
      load1m: stats(runs.map((run) => run.load[0]))
    };
    note('first copy', `median ${String(firstCopy.totalMs.median)}ms (${String(firstCopy.totalMs.min)}-${String(firstCopy.totalMs.max)}), ${String(firstCopy.actionsToReadyLibrary)} actions to a ready Library, ${String(firstCopy.clicksAfterWelcome)} click to copy after the Welcome; machine median ${String(firstCopy.machineMs.median)}ms; load 1m ${String(firstCopy.load1m.min)}-${String(firstCopy.load1m.max)}`);
    await writeSection('firstCopy', {
      tool: 'Playwright on the built extension, the reading model; actions counted by the test helper act; the copy read back from the clipboard',
      model: { wpm: READING_WPM, klmPointMs: KLM_POINT_MS, klmClickMs: KLM_CLICK_MS },
      targets: { firstCopyMs: TARGETS.firstCopyMs, actionsToReadyLibrary: TARGETS.actionsToReadyLibrary, clicksToCopyAfterWelcome: TARGETS.clicksToCopyAfterWelcome },
      ...firstCopy,
      runs
    });
    expect.soft(firstCopy.totalMs.median, 'the first copy through a Pack, median').toBeLessThan(TARGETS.firstCopyMs);
    expect.soft(firstCopy.actionsToReadyLibrary, 'actions from the opening to a ready Library').toBeLessThanOrEqual(TARGETS.actionsToReadyLibrary);
    expect.soft(firstCopy.clicksAfterWelcome, 'clicks to copy after the Welcome').toBeLessThanOrEqual(TARGETS.clicksToCopyAfterWelcome);
  });

  test(`an existing user's Library: the first copy button hit-testable, this build and the merge base's, ${String(OPENINGS)} openings each`, async ({ context, extensionId }) => {
    test.setTimeout(5 * 60_000);
    const after = { context, extensionId, storage: (await installedStore(context)).storage };
    const before = BASE_DIST === undefined ? null : await ownBrowser(BASE_DIST);
    try {
      const builds = before === null ? [{ name: 'after', ...after }] : [{ name: 'before', ...before }, { name: 'after', ...after }];
      const versions: Record<string, string> = {};
      for (const build of builds) {
        versions[build.name] = await versionOf(build.context);
        await seedExistingUser(build.storage, versions[build.name]);
      }
      const samples: Record<string, Timed<LibrarySample>[]> = { before: [], after: [] };
      for (let opening = 0; opening < OPENINGS; opening++) {
        // Interleaved, the order swapped at each opening, so a change in the machine's load falls on both
        const order = opening % 2 === 0 ? builds : [...builds].reverse();
        for (const build of order) {
          const loadNow = load();
          samples[build.name].push({ ...(await timeLibraryOpening(build.context, build.extensionId)), load: loadNow });
        }
      }
      const summarize = (runs: readonly Timed<LibrarySample>[]) =>
        runs.length === 0
          ? null
          : {
              copyHitTestable: stats(runs.map((run) => run.copyHitTestable)),
              copyOpaque: stats(runs.map((run) => run.copyOpaque)),
              cardAttached: stats(runs.map((run) => run.cardAttached)),
              firstContentfulPaint: statsOfNoted(runs.map((run) => run.firstContentfulPaint)),
              load1m: stats(runs.map((run) => run.load[0])),
              firstOpening: rounded(runs[0]),
              runs: runs.map(rounded)
            };
      const result = { before: summarize(samples.before), after: summarize(samples.after) };
      for (const [name, value] of Object.entries(result)) {
        if (value !== null) {
          note(`existing user ${name}`, `copy button hit-testable median ${String(value.copyHitTestable.median)}ms (${String(value.copyHitTestable.min)}-${String(value.copyHitTestable.max)}), opaque median ${String(value.copyOpaque.median)}ms, card in the page median ${String(value.cardAttached.median)}ms; load 1m ${String(value.load1m.min)}-${String(value.load1m.max)}`);
        }
      }
      await writeSection('existingUser', {
        tool: 'Playwright, an init script notes performance.now() (from navigation start) in each requestAnimationFrame: the first card in the page, its copy button hit-testable (elementFromPoint) and opaque',
        store: `${String(LIBRARY_PROMPTS)} Prompts, the Welcome done, this Release's notes seen; the same store for both builds`,
        beforeDist: BASE_DIST ?? null,
        afterDist: DEFAULT_EXTENSION_PATH,
        ...result,
        versions,
        differenceOfMediansMs: result.before === null || result.after === null ? null : round(result.after.copyHitTestable.median - result.before.copyHitTestable.median)
      });
    } finally {
      await before?.dispose();
    }
  });

  test('colors: the lowest contrast pairs of the Welcome as the built extension draws them, light and dark', async ({ page, storage, extensionId }) => {
    test.setTimeout(3 * 60_000);
    const themes: Record<string, { pairs: ColorPair[]; lowest: ColorPair | null; under: ColorPair[] }> = {};
    for (const theme of ['light', 'dark'] as const) {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 }, settings: { ...DEFAULT_SETTINGS, theme } });
      await page.setViewportSize({ width: SURFACES.popup.width, height: SURFACES.popup.height });
      await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: theme });
      await page.goto(surfaceUrl(extensionId, 'popup'));
      if (theme === 'dark') {
        await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      } else {
        await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
      }
      await atStep(page, 0);
      const pairs = await welcomeColorPairs(page);
      const required = pairs.filter((pair) => !pair.pair.includes('(transient)'));
      const lowest = required.reduce<ColorPair | null>((low, pair) => (low === null || pair.ratio < low.ratio ? pair : low), null);
      themes[theme] = { pairs, lowest, under: pairs.filter((pair) => pair.ratio < pair.min) };
      note(`colors ${theme}`, `lowest ${lowest === null ? '?' : `${lowest.pair} ${lowest.fg} on ${lowest.bg} ${String(lowest.ratio)}:1`}; under threshold: ${themes[theme].under.map((pair) => `${pair.pair} ${String(pair.ratio)}:1`).join(', ') || 'none'}`);
    }
    await writeSection('colors', {
      tool: 'Playwright getComputedStyle on the built extension (popup 400 x 500), each color as drawn over what is behind it; ratio by getContrastRatio of src/constants/colors.ts, the function scripts/contrast.ts prints',
      ...themes
    });
  });
});

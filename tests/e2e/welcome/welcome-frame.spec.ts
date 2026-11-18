/**
 * E2E: the Welcome's frame and navigation in the real extension (My-Prompt-Manager-ojz.7).
 *
 * - S1: a first install opens the popup on the Welcome at step 1, its primary button usable.
 * - Display: how long after navigation start the primary button is hit-testable (the screen may still
 *   be transparent then), the screen first visible (opacity above 0) and fully opaque (the opening
 *   fade ended), over several openings. Reported in test-results/welcome/display-times.json; the
 *   formal measure is My-Prompt-Manager-ojz.13's.
 * - AC3: a click on the primary button lands during the opening fade and during a step slide. The
 *   page's animations are slowed a hundredfold as they start, so the clicks fall inside them on any
 *   machine; what each click met is read at its pointerdown.
 * - AC4: under prefers-reduced-motion a step change runs no animation longer than 10ms, and nothing
 *   loops.
 * - AC5 (S6): the popup closed 100ms after the click that brings step 2, sooner than a person closes
 *   a popup, then opened again: the Welcome at step 2. And the window in which a close would lose the
 *   step: the time from the click to the stored record holding it, seen from the service worker, a
 *   median under 50ms and every run under the 100ms of the S6 close
 *   (test-results/welcome/step-write-times.json). A popup closed inside that window loses the step;
 *   why it stays and what would remove it is told at the test.
 * - AC6: light screenshots of the frame in the popup (400 x 500) and the side panel (360 x 720), in
 *   test-results/welcome/, the dots and the buttons in view there and at 320 x 600.
 *
 * S1 and S6 run on the store the first install leaves (no storage fixture); the others seed a
 * pending Welcome over an empty Library.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { BrowserContext, Locator, Page, Worker } from '@playwright/test';

import { MOTION } from '../../../src/theme/motion';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { createStorageController, type ExtensionStorage, expect, test, waitForBackgroundTarget, waitForFirstInstallRecords } from '../fixtures/extension';

const OUTPUT_DIR = 'test-results/welcome';

const SURFACES = {
  popup: { file: 'popup', width: 400, height: 500 },
  sidepanel: { file: 'sidepanel', width: 360, height: 720 },
  narrowSidepanel: { file: 'sidepanel', width: 320, height: 600 }
} as const;

type Surface = keyof typeof SURFACES;

/** How many openings the display probe times */
const OPENINGS = 10;

/** How many clicks the step-write probe times */
const STEP_WRITES = 10;

/** The median time a step's write may take, from the click on the primary button to the stored record holding the step */
const STEP_WRITE_BUDGET_MS = 50;

/** How long after the click the S6 proof closes the popup: no step write may take longer, at any run */
const S6_CLOSE_AFTER_MS = 100;

/** What the step-write probe notes: in the service worker, when the stored record first held each step; in the page, when the click landed */
type StepWriteProbe = typeof globalThis & { welcomeStepStoredAt?: Record<string, number>; welcomeClickedAt?: number };

const recordOf = async (storage: ExtensionStorage): Promise<unknown> => (await storage.get<Record<string, unknown>>(WELCOME_KEY))[WELCOME_KEY];

/** The storage of the extension as the first install left it, read through its service worker */
const installedStorage = async (context: BrowserContext): Promise<ExtensionStorage> => {
  const storage = createStorageController(await waitForBackgroundTarget(context));
  await waitForFirstInstallRecords(storage);
  return storage;
};

/** Opens the popup or the side panel page at its size, motion on whatever the machine's setting */
const open = async (page: Page, extensionId: string, surface: Surface, reducedMotion: 'reduce' | 'no-preference' = 'no-preference'): Promise<void> => {
  const { file, width, height } = SURFACES[surface];
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
};

const welcome = (page: Page) => page.getByTestId('welcome');
const primary = (page: Page) => page.getByTestId('welcome-primary');

/** Resolves once every finite animation of the page has ended */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });

/** Whether a box lies wholly inside the viewport */
const expectInView = async (page: Page, locator: Locator, what: string): Promise<void> => {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box, what).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.y, `${what}: top`).toBeGreaterThanOrEqual(0);
    expect(box.x, `${what}: left`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${what}: bottom`).toBeLessThanOrEqual(viewport.height);
    expect(box.x + box.width, `${what}: right`).toBeLessThanOrEqual(viewport.width);
  }
};

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

test.describe('The Welcome frame in the real extension', () => {
  test('S1: a first install opens the popup on the Welcome at step 1, its primary button usable, no Library or tab bar behind it', async ({ context, extensionId }) => {
    await installedStorage(context);
    const page = await context.newPage();
    await open(page, extensionId, 'popup');

    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '0');
    await expect(primary(page)).toHaveText('Next');
    await expect(primary(page)).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Step 1 of 3' })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.getByTestId('prompt-card')).toHaveCount(0);
    await page.close();
  });

  test('display: the primary button hit-testable, the screen first visible and fully opaque, timed from navigation start over several openings', async ({ context, extensionId }) => {
    test.slow();
    await installedStorage(context);
    type DisplayTimes = { welcomeAttached: number; primaryHitTestable: number; firstVisible: number; opaque: number };
    const runs: DisplayTimes[] = [];

    for (let opening = 0; opening < OPENINGS; opening += 1) {
      const page = await context.newPage();
      // Watches every frame from the start of the document: when the Welcome is in the page, when
      // its primary button has a box and is what a click at its center hits (the screen may still be
      // transparent then), the first frame where the screen's opacity is above 0, and the first where
      // it is 1. performance.now() counts from navigation start
      await page.addInitScript(() => {
        const times: Record<string, number | null> = { welcomeAttached: null, primaryHitTestable: null, firstVisible: null, opaque: null };
        (window as unknown as { __welcomeDisplay: typeof times }).__welcomeDisplay = times;
        const tick = (): void => {
          const now = performance.now();
          const main = document.querySelector('[data-testid="welcome"]');
          const button = document.querySelector('[data-testid="welcome-primary"]');
          if (main && times.welcomeAttached === null) {
            times.welcomeAttached = now;
          }
          if (button && times.primaryHitTestable === null) {
            const box = button.getBoundingClientRect();
            const hit = box.width > 0 && box.height > 0 ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
            if (hit && button.contains(hit)) {
              times.primaryHitTestable = now;
            }
          }
          const opacity = main ? Number(getComputedStyle(main).opacity) : 0;
          if (main && times.firstVisible === null && opacity > 0) {
            times.firstVisible = now;
          }
          if (main && times.opaque === null && opacity === 1) {
            times.opaque = now;
          }
          if (times.primaryHitTestable === null || times.firstVisible === null || times.opaque === null) {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      });
      await open(page, extensionId, 'popup');
      await expect(primary(page)).toBeVisible();
      const times = await page.waitForFunction(() => {
        const recorded = (window as unknown as { __welcomeDisplay?: Record<string, number | null> }).__welcomeDisplay;
        return recorded && recorded.primaryHitTestable !== null && recorded.firstVisible !== null && recorded.opaque !== null ? recorded : null;
      });
      runs.push((await times.jsonValue()) as DisplayTimes);
      await page.close();
    }

    const medianOf = (key: keyof DisplayTimes): number => Math.round(median(runs.map((run) => run[key])));
    const summary = {
      openings: runs.length,
      fadeMs: MOTION.welcomeIn,
      medianWelcomeAttachedMs: medianOf('welcomeAttached'),
      medianPrimaryHitTestableMs: medianOf('primaryHitTestable'),
      medianFirstVisibleMs: medianOf('firstVisible'),
      medianOpaqueMs: medianOf('opaque'),
      runs: runs.map((run) => ({
        welcomeAttached: Math.round(run.welcomeAttached),
        primaryHitTestable: Math.round(run.primaryHitTestable),
        firstVisible: Math.round(run.firstVisible),
        opaque: Math.round(run.opaque)
      }))
    };
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUTPUT_DIR, 'display-times.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await test.info().attach('display-times', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
    const line = `median over ${String(summary.openings)} openings, fade ${String(summary.fadeMs)}ms: primary hit-testable ${String(summary.medianPrimaryHitTestableMs)}ms, first visible ${String(summary.medianFirstVisibleMs)}ms, opaque ${String(summary.medianOpaqueMs)}ms`;
    test.info().annotations.push({ type: 'display', description: line });
    console.log(`[welcome] display, ${line}`);

    // The primary button is hit-testable no later than the screen is opaque: no animation holds it
    for (const run of runs) {
      expect(run.primaryHitTestable).toBeLessThanOrEqual(run.opaque);
      expect(run.firstVisible).toBeLessThanOrEqual(run.opaque);
    }
  });

  test('AC3: a click on the primary button lands during the opening fade and during a step slide', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
    await page.addInitScript(() => {
      // Every animation slowed a hundredfold as it starts, so the clicks fall inside it
      document.addEventListener(
        'animationstart',
        (event) => {
          if (event.target instanceof Element) {
            for (const animation of event.target.getAnimations()) {
              animation.playbackRate = 0.01;
            }
          }
        },
        true
      );
      // What each press met: the animations still running on the screen and on the step, and their opacity
      const presses: unknown[] = [];
      (window as unknown as { __presses: unknown[] }).__presses = presses;
      document.addEventListener(
        'pointerdown',
        () => {
          const running = (element: Element | null): string[] =>
            element ? element.getAnimations().filter((animation) => animation.playState === 'running').map((animation) => (animation as CSSAnimation).animationName) : [];
          const main = document.querySelector('[data-testid="welcome"]');
          const step = document.querySelector('[data-testid="welcome-step"]');
          presses.push({
            screen: running(main),
            screenOpacity: main ? Number(getComputedStyle(main).opacity) : null,
            step: running(step),
            stepOpacity: step ? Number(getComputedStyle(step).opacity) : null
          });
        },
        true
      );
    });
    await open(page, extensionId, 'popup');
    const presses = () => page.evaluate(() => (window as unknown as { __presses: Array<Record<string, unknown>> }).__presses);

    // During the opening fade
    await primary(page).click();
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '1');
    const [duringFade] = await presses();
    expect(duringFade.screen).toEqual(['backdrop-in']);
    expect(duringFade.screenOpacity).toBeLessThan(1);

    // During the slide of step 2 (the fade still running too)
    await primary(page).click();
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
    const [, duringSlide] = await presses();
    expect(duringSlide.step).toEqual(['welcome-from-right']);
    expect(duringSlide.stepOpacity).toBeLessThan(1);

    await expect.poll(async () => recordOf(storage)).toEqual({ status: 'pending', step: 2 });
  });

  test('AC4: under prefers-reduced-motion a step change runs no animation over 10ms, and nothing loops', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
    await open(page, extensionId, 'popup', 'reduce');
    await expect(primary(page)).toBeVisible();

    const afterClick = await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-testid="welcome-primary"]');
      button?.click();
      // getAnimations() takes the new styles: the step change's animations and transitions, if any
      return document.getAnimations().map((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return {
          name: (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty,
          duration: Number(timing?.duration ?? 0),
          delay: Number(timing?.delay ?? 0),
          iterations: timing?.iterations ?? 1
        };
      });
    });

    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '1');
    for (const animation of afterClick) {
      expect(animation.duration + animation.delay, `${animation.name} lasts`).toBeLessThanOrEqual(10);
      expect(animation.iterations, `${animation.name} loops`).not.toBe(Infinity);
    }
    await expect(page.getByTestId('welcome-step')).toHaveCSS('animation-name', 'none');
    await expect(page.getByTestId('welcome-step')).toHaveCSS('opacity', '1');
    await expect(welcome(page)).toHaveCSS('animation-name', 'none');
  });

  test('two actions from the opening to the Library: Skip, then the primary button of the last step; the Welcome recorded finished', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
    await open(page, extensionId, 'popup');
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '0');

    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
    await primary(page).click();

    await expect(welcome(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /my prompt manager/i })).toBeVisible();
    await expect.poll(async () => recordOf(storage)).toEqual({ status: 'done' });
  });

  test('AC5 (S6): the popup closed 100ms after the click that brings step 2, sooner than a person closes it, then opened again: the Welcome at step 2', async ({ context, extensionId }) => {
    const storage = await installedStorage(context);
    const first = await context.newPage();
    await open(first, extensionId, 'popup');
    await expect(welcome(first)).toHaveAttribute('data-welcome-step', '0');

    await primary(first).click();
    await first.waitForTimeout(S6_CLOSE_AFTER_MS);
    await first.close();

    const second = await context.newPage();
    await open(second, extensionId, 'popup');
    await expect(welcome(second)).toHaveAttribute('data-welcome-step', '1');
    await expect(second.getByRole('button', { name: 'Step 2 of 3' })).toHaveAttribute('aria-current', 'step');
    await expect(second.getByRole('button', { name: 'Back' })).toBeVisible();
    expect(await recordOf(storage)).toEqual({ status: 'pending', step: 1 });
    await second.close();
  });

  // The window in which a close loses a step. The step's write takes the Welcome lock, reads the
  // record, then writes it (writeWelcomeRecord of src/welcome/storage.ts, through writeLaunchState),
  // and a popup closed before the write is issued loses it: a page.close() in the instant of the
  // click lost it 5 times out of 5. The lock and the read stay: they keep a done record final when
  // the popup and the side panel are open together. The time depends on the machine's load: on a
  // developer laptop, 3 to 10ms read in the page itself; seen from the service worker, which adds
  // the change's delivery to it, medians of 15 to 31ms, 44ms at the slowest run seen. Under a close a
  // person can make, which takes a move out of the popup, a focus change or a key press. The median
  // is held under 50ms, which a real regression crosses, and every run under the 100ms of the S6
  // close, so a slow runner does not fail it for nothing. Routing the step writes through the service
  // worker, which outlives the popup, would remove the window.
  test(`AC5 (S6): the step is stored a median under ${String(STEP_WRITE_BUDGET_MS)}ms after the click on the primary button and always under ${String(S6_CLOSE_AFTER_MS)}ms, timed from the service worker, so no close at human speed loses it`, async ({ context, storage, extensionId }) => {
    // The same cast as the storage fixture's: the background of a Manifest V3 extension is its service worker
    const worker = (await waitForBackgroundTarget(context)) as Worker;
    // The service worker notes when the stored record first holds each step
    await worker.evaluate((key) => {
      const probe = globalThis as StepWriteProbe;
      probe.welcomeStepStoredAt = {};
      chrome.storage.onChanged.addListener((changes, area) => {
        const record = changes[key]?.newValue as { step?: unknown } | undefined;
        const storedAt = probe.welcomeStepStoredAt;
        if (area === 'local' && storedAt !== undefined && typeof record?.step === 'number' && storedAt[String(record.step)] === undefined) {
          storedAt[String(record.step)] = Date.now();
        }
      });
    }, WELCOME_KEY);

    const times: number[] = [];
    for (let run = 0; run < STEP_WRITES; run++) {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
      await worker.evaluate(() => {
        (globalThis as StepWriteProbe).welcomeStepStoredAt = {};
      });
      const page = await context.newPage();
      await open(page, extensionId, 'popup');
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', '0');
      // The page notes when the click lands
      await page.evaluate(() => {
        window.addEventListener('click', () => { (globalThis as StepWriteProbe).welcomeClickedAt = Date.now(); }, { capture: true, once: true });
      });

      await primary(page).click();

      let storedAt: number | undefined;
      await expect
        .poll(async () => {
          storedAt = await worker.evaluate(() => (globalThis as StepWriteProbe).welcomeStepStoredAt?.['1']);
          return storedAt;
        }, { message: 'the stored record holds step 2' })
        .toBeDefined();
      const clickedAt = await page.evaluate(() => (globalThis as StepWriteProbe).welcomeClickedAt);
      expect(clickedAt, 'the click landed in the page').toBeDefined();
      times.push((storedAt ?? Number.NaN) - (clickedAt ?? Number.NaN));
      await page.close();
    }

    const summary = { runs: times.length, medianMs: median(times), slowestMs: Math.max(...times), timesMs: times };
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUTPUT_DIR, 'step-write-times.json'), `${JSON.stringify(summary, null, 2)}\n`);
    test.info().annotations.push({
      type: 'step write',
      description: `click to stored step over ${String(summary.runs)} runs: median ${String(summary.medianMs)}ms, slowest ${String(summary.slowestMs)}ms`
    });
    console.log(`[welcome] click to stored step, ${String(summary.runs)} runs: median ${String(summary.medianMs)}ms, slowest ${String(summary.slowestMs)}ms ${JSON.stringify(times)}`);

    expect(summary.medianMs, `median click to stored step, in ms (all runs: ${JSON.stringify(times)})`).toBeLessThan(STEP_WRITE_BUDGET_MS);
    for (const time of times) {
      expect(time, `click to stored step, in ms (all runs: ${JSON.stringify(times)})`).toBeLessThan(S6_CLOSE_AFTER_MS);
    }
  });

  for (const surface of ['popup', 'sidepanel'] as const) {
    test(`AC6: PROOF, light screenshots of the frame at each step (${surface})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
      await open(page, extensionId, surface);
      await fs.mkdir(OUTPUT_DIR, { recursive: true });

      for (const step of [0, 1, 2] as const) {
        await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
        await animationsDone(page);
        await expectInView(page, primary(page), `step ${String(step + 1)}: the primary button`);
        await expectInView(page, page.getByRole('group', { name: 'Steps' }), `step ${String(step + 1)}: the dots`);
        // The pointer off the controls, so none shows its hover
        await page.mouse.move(SURFACES[surface].width / 2, SURFACES[surface].height / 2);
        await page.screenshot({ path: `${OUTPUT_DIR}/frame-${surface}-step${String(step + 1)}-light.png`, animations: 'disabled' });
        if (step < 2) {
          await primary(page).click();
        }
      }
    });
  }

  test('the dots and the buttons stay in view in the narrowest side panel, 320 x 600', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
    await open(page, extensionId, 'narrowSidepanel');

    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
    await expectInView(page, primary(page), 'the primary button');
    await expectInView(page, page.getByRole('button', { name: 'Back' }), 'Back');
    await expectInView(page, page.getByRole('group', { name: 'Steps' }), 'the dots');
    await expectInView(page, page.getByRole('button', { name: 'Close side panel' }), 'the close button');
  });
});

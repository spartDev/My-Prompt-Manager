/**
 * E2E: leaving the Welcome for a ready Library, in the real extension (My-Prompt-Manager-ojz.9).
 *
 * - S2, AC1: Skip, then "Add 9 prompts": the Library lists the Prompts of the Packs selected on All,
 *   with the Notification "9 prompts added" and "Open your AI chat and type //" as its sub
 *   (My-Prompt-Manager-ojz.19); neither the Library's loading state nor its empty state ever shows
 *   on the way; the Prompts stored in their Packs' Categories and the Welcome recorded finished.
 * - The exit Notification read whole (My-Prompt-Manager-ojz.19): in the popup 400 x 500 and the side
 *   panel 400 x 600, 360 x 600 and 320 x 500, light and dark, "Open your AI chat and type //" on a line
 *   of its own under the message, neither cut, the pill in its room, over none of the controls, the
 *   side panel's close button included, above the search field, off the first card's Copy, which has
 *   the keyboard; centered in the popup, and in the side panel unless it must give way to the close
 *   button (My-Prompt-Manager-h1dh); "Your library is ready" (a Debug replay over Packs already in) as
 *   well. Screenshots in WELCOME_EXIT_SCREENSHOTS (test-results/welcome-exit when unset).
 * - The side panel's close button free all along the exit Notification (My-Prompt-Manager-h1dh): at
 *   320 x 600 and 360 x 600, light and dark, every pixel of the button's box is hit tested on every
 *   frame the Notification is in the document, and none reaches the pill; each reaches the button
 *   whenever it does with no Notification. A one-line Notification shown next stays centered. A click
 *   on each corner, each edge and the centre of the button, while the Notification shows, reaches the
 *   button's close and never the pill, the pointer resting there never holds its time, and a real
 *   click on the corner the pill used to cover closes the side panel.
 * - The exit Notification stays 6 s (My-Prompt-Manager-syj): its 9 words take about 2.3 s to read and
 *   its `//` comes last. In the popup 400 x 500 and the side panel 320 x 600, light and dark, it is
 *   first drawn within 1 s of the click on "Add 9 prompts", still drawn 5.5 s after it, without a break
 *   in between (visible, opaque, within the viewport, read on every frame), and removed by 7 s, by the
 *   page's own clock (the click's event time), never hovered nor focused on the way; in every frame it
 *   shows, it is off the first card, whose Copy keeps the keyboard. "Your library is ready" (the Debug
 *   replay) stays as long. Screenshots and measures in WELCOME_EXIT_SCREENSHOTS too.
 * - S3, AC2: no Pack, "Start empty": the empty Library, then the editor on a new Prompt about 250ms
 *   later, both times read in the page as they are first seen. The exact 250ms is proven with fake
 *   timers in src/hooks/__tests__/useWelcomeExit.test.ts.
 * - S12, AC5: from the store a first install leaves, the popup opened, Skip, "Add 9 prompts", then
 *   one click on a card's copy button: the clipboard holds that Prompt's content, read back from
 *   the clipboard. The clicks are counted and the time from opening the popup to the clipboard
 *   holding the content is measured, the script going as fast as the page lets it (a floor: the
 *   reading model is My-Prompt-Manager-ojz.13's), over several runs, in
 *   test-results/welcome/first-copy-times.json.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { BrowserContext, Locator, Page } from '@playwright/test';

import { defaultSiteSettings, SITE_SETTINGS_KEY } from '../../../src/services/siteSettings';
import { DEFAULT_SETTINGS } from '../../../src/types';
import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { WHATS_NEW_KEY } from '../../../src/whatsNew/storage';
import { createStorageController, type ExtensionStorage, expect, test, waitForBackgroundTarget, waitForFirstInstallRecords } from '../fixtures/extension';

const OUTPUT_DIR = 'test-results/welcome';

/** How many runs the first-copy probe times */
const COPY_RUNS = 5;

/** The first copy must come within this of the first opening (the spec's target) */
const FIRST_COPY_TARGET_MS = 60_000;

/** What the clipboard holds before each run: no Prompt has it, so the read sees that run's copy */
const CLIPBOARD_BEFORE = '-';

const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected);
const DEFAULT_PROMPTS = DEFAULTS.flatMap((pack) => pack.prompts);
const ADDED = `${String(DEFAULT_PROMPTS.length)} prompts added`;
/** The Notification's second line after the Packs: the next step, in the AI chat (My-Prompt-Manager-ojz.19) */
const IN_THE_CHAT = 'Open your AI chat and type //';

/** What the page notes, from its first script on: when each part of the way out was first in the document */
interface ExitProbe {
  libraryAt?: number;
  editorAt?: number;
  loadingSeen?: boolean;
  emptySeen?: boolean;
  /** When the Library's empty state was first in the document */
  emptyAt?: number;
  copiedAt?: number;
}

type ProbeWindow = typeof globalThis & { welcomeExitProbe: ExitProbe };

/**
 * Notes, in the page, the first time the Library (its Section), the editor, the Library's loading
 * state and its empty state are in the document, and when a copy to the clipboard has landed
 */
const probeTheExit = async (page: Page): Promise<void> => {
  await page.addInitScript((before: string) => {
    const probe: ExitProbe = {};
    (globalThis as ProbeWindow).welcomeExitProbe = probe;
    const look = (records: readonly MutationRecord[]): void => {
      const now = performance.now();
      if (probe.libraryAt === undefined && document.querySelector('[data-testid="section"]')) {
        probe.libraryAt = now;
      }
      if (probe.editorAt === undefined && document.querySelector('[data-testid="editor-sheet"]')) {
        probe.editorAt = now;
      }
      // Each node added, even one gone again by now
      for (const node of records.flatMap((record) => [...record.addedNodes])) {
        const text = node.textContent ?? '';
        probe.loadingSeen ||= text.includes('Loading your prompts');
        probe.emptySeen ||= text.includes('Your library is empty');
        if (probe.emptySeen && probe.emptyAt === undefined) {
          probe.emptyAt = now;
        }
      }
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
    // The clipboard itself is read back by the test; this only notes when the copy landed
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

const probeOf = (page: Page): Promise<ExitProbe> => page.evaluate(() => (globalThis as ProbeWindow).welcomeExitProbe);

const openPopup = async (page: Page, extensionId: string): Promise<void> => {
  await page.setViewportSize({ width: 400, height: 500 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
};

const welcome = (page: Page) => page.getByTestId('welcome');
const primary = (page: Page) => page.getByTestId('welcome-primary');
const cards = (page: Page) => page.getByTestId('prompt-card');

/**
 * Where the exit Notification is checked whole: the popup, and the side panel wide enough for it to
 * stay centered, at its usual width and at its narrowest
 */
const EXIT_SURFACES = [
  { file: 'popup', width: 400, height: 500 },
  { file: 'sidepanel', width: 400, height: 600 },
  { file: 'sidepanel', width: 360, height: 600 },
  { file: 'sidepanel', width: 320, height: 500 }
] as const;

const EXIT_SCREENSHOTS_DIR = process.env.WELCOME_EXIT_SCREENSHOTS ?? 'test-results/welcome-exit';

/** The room a Notification leaves on each side of the screen (ToastContainer) */
const NOTIFICATION_EDGE = 16;

/** The Library's close button, which only the side panel has (ViewHeader's CloseButton), not the Welcome's */
const LIBRARY_CLOSE = '[data-testid="close-modal"][aria-label="Close side panel"]';

/**
 * In the side panel, the room the exit Notification keeps from the Library's close button
 * (My-Prompt-Manager-h1dh): centered while it can be, moved left by what it must, never nearer the left
 * edge than NOTIFICATION_EDGE
 */
const CLOSE_CLEARANCE = 8;

const firstCardCopy = (page: Page) => cards(page).first().getByRole('button', { name: /^Copy content of / });

const expectTheme = async (page: Page, theme: 'light' | 'dark'): Promise<void> => {
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  } else {
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  }
};

/** From wherever the Welcome opens to its last step, the default Packs selected */
const toAddPrompts = async (page: Page): Promise<void> => {
  await expect(welcome(page)).toBeVisible();
  for (let step = 0; step < 2 && (await primary(page).textContent()) === 'Next'; step++) {
    await primary(page).click();
  }
  await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_PROMPTS.length)} prompts`);
};

/** Resolves once every finite animation of the page has ended: the pill's entrance, the cards' rise */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface TextLine extends Box {
  scrollWidth: number;
  clientWidth: number;
  lineHeight: number;
}

interface ExitNotificationLayout {
  pill: Box;
  message: TextLine;
  sub: TextLine;
  /** The first card's Copy and the search field (its rounded box), read where they rest */
  copy: Box;
  search: Box;
  /** The Library's close button, in the side panel; none in the popup */
  close: Box | null;
  /** The controls outside the Notification whose box meets the pill's */
  covered: (Box & { name: string })[];
}

const boxOf = (box: { x: number; y: number; width: number; height: number } | null, what: string): Box => {
  if (!box) {
    throw new Error(`${what} has no box`);
  }
  return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height, width: box.width, height: box.height };
};

const overlaps = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The exit Notification as it rests over the Library, hovered so it keeps its time while it is read:
 * its pill, its two lines, and the controls it would cover
 */
const exitNotificationLayout = async (page: Page, message: string): Promise<ExitNotificationLayout> => {
  const notification = page.getByTestId('toast');
  await expect(notification.getByText(message, { exact: true })).toBeVisible();
  // The whole second line, so a shorter one cannot pass the measures for it
  await expect(notification.getByTestId('toast-sub')).toHaveText(IN_THE_CHAT);
  await notification.hover();
  await animationsDone(page);
  await notification.hover();
  const inPage = await notification.evaluate((pill) => {
    const rect = (element: Element) => {
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
      return { left, top, right, bottom, width, height };
    };
    const line = (testId: string) => {
      const element = pill.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!element) {
        throw new Error(`No ${testId}`);
      }
      return { ...rect(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight) };
    };
    const box = rect(pill);
    const covered = [...document.querySelectorAll('button, input, select, textarea, a[href], [role="radio"], [role="tab"], [tabindex]:not([tabindex="-1"])')]
      .filter((control) => !pill.contains(control))
      .filter((control) => {
        const r = control.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.left < box.right && box.left < r.right && r.top < box.bottom && box.top < r.bottom;
      })
      .map((control) => ({ ...rect(control), name: control.getAttribute('aria-label') ?? control.textContent?.trim() ?? control.tagName }));
    return { pill: box, message: line('toast-message'), sub: line('toast-sub'), covered };
  });
  const close = page.locator(LIBRARY_CLOSE);
  return {
    ...inPage,
    copy: boxOf(await firstCardCopy(page).boundingBox(), 'the first Copy'),
    search: boxOf(await page.getByRole('searchbox', { name: 'Search prompts' }).locator('..').boundingBox(), 'the search field'),
    close: (await close.count()) > 0 ? boxOf(await close.boundingBox(), 'the close button') : null
  };
};

/**
 * Where the pill's left edge must be: centered on the screen; in the side panel, moved left from there
 * by what keeps it CLOSE_CLEARANCE clear of the close button, never nearer the left edge than
 * NOTIFICATION_EDGE (My-Prompt-Manager-h1dh)
 */
const expectedPillLeft = (pill: Box, width: number, close: Box | null): number => {
  const centered = (width - pill.width) / 2;
  return close === null ? centered : Math.max(NOTIFICATION_EDGE, Math.min(centered, close.left - CLOSE_CLEARANCE - pill.width));
};

/** The screenshot and the measures of a Notification, kept before they are judged, so a failure keeps them too */
const keepEvidence = async (page: Page, name: string, layout: ExitNotificationLayout): Promise<void> => {
  test.info().annotations.push({ type: 'exit Notification (px)', description: JSON.stringify(layout) });
  await fs.mkdir(EXIT_SCREENSHOTS_DIR, { recursive: true });
  await fs.writeFile(path.join(EXIT_SCREENSHOTS_DIR, `${name}.json`), `${JSON.stringify(layout, null, 2)}\n`);
  await page.screenshot({ path: path.join(EXIT_SCREENSHOTS_DIR, `${name}.png`) });
};

/** Both lines whole, each on one line, the second under the first, the pill in its room on the screen */
const expectWhole = (layout: ExitNotificationLayout, width: number): void => {
  const { pill, message, sub } = layout;
  expect(sub.scrollWidth, 'the second line, not cut').toBeLessThanOrEqual(sub.clientWidth);
  expect(sub.height, 'the second line, on one line').toBeLessThan(sub.lineHeight * 1.5);
  expect(sub.top, 'the second line, under the message').toBeGreaterThanOrEqual(message.bottom - 0.5);
  expect(message.scrollWidth, 'the message, not cut').toBeLessThanOrEqual(message.clientWidth);
  expect(message.height, 'the message, on one line').toBeLessThan(message.lineHeight * 1.5);
  expect(pill.left, 'the pill, in its room').toBeGreaterThanOrEqual(NOTIFICATION_EDGE - 0.5);
  expect(pill.right, 'the pill, in its room').toBeLessThanOrEqual(width - NOTIFICATION_EDGE + 0.5);
};

/**
 * How long the exit Notification stays on screen (My-Prompt-Manager-syj), from the click: still there
 * at STILL_THERE_MS, gone by GONE_BY_MS. Its own time is 6 s from when it shows (useWelcomeExit), about
 * 60 ms after the click; the second of room covers an add that takes longer and a timer that a loaded
 * machine runs late. A confirmation's 2.7 s would fail the first bound, a timer that never ends the second
 */
const STILL_THERE_MS = 5_500;
const GONE_BY_MS = 7_000;

/**
 * The exit Notification is first drawn within this of the click: it shows within about 60 ms of it and
 * is opaque 170 ms into its entrance. The rest is room for a loaded machine, the same second as
 * GONE_BY_MS gives. With STILL_THERE_MS and no break in between, it is drawn for 4.5 s at least: one
 * first drawn in the last second of its six would pass the bounds above alone
 */
const DRAWN_BY_MS = 1_000;

/** Where the exit Notification's time and place are checked: the popup, and the side panel at its narrowest */
const TIME_SURFACES = [
  { file: 'popup', width: 400, height: 500 },
  { file: 'sidepanel', width: 320, height: 600 }
] as const;

/**
 * What the page notes about the exit Notification, on its own clock (performance.now): when the click
 * on the primary button happened (its event time), when the pill with `message` was put in the document
 * and when it left it, anything that stopped its time, and where it stood against the first card in
 * every frame it showed
 */
interface ExitTimeline {
  clickAt?: number;
  shownAt?: number;
  goneAt?: number;
  /** Pills with the message put in the document: one, from the add to its end, never replaced */
  shown: number;
  /** The pointer or the focus on the pill (mouseenter, focusin): either stops its time (ToastContainer) */
  held: string[];
  /** Frames sampled while it showed */
  frames: number;
  /**
   * The first and the last frame where the pill was drawn: visible (checkVisibility, opacity and
   * visibility included), fully opaque through its ancestors (its entrance ended), and a box of its own
   * inside the viewport. In the document is not enough: a pill made transparent or moved away still is
   */
  firstDrawnAt?: number;
  lastDrawnAt?: number;
  /** Frames, after the first drawn one, where the pill was in the document but not drawn */
  undrawn: number;
  /** Frames where the pill met the first card, or that card's Copy */
  overCard: number;
  overCopy: number;
  /** Frames where the first card's Copy had the keyboard, and frames it had lost it after having it */
  copyFocused: number;
  copyLost: number;
  /** The least room, over every frame, between the pill's bottom and the first card's top */
  minGapToCard: number | null;
  /** The pill, the first card and its Copy, as the last frame saw them */
  last?: { pill: Box; card: Box | null; copy: Box | null };
}

type TimelineWindow = typeof globalThis & { exitTimeline: ExitTimeline };

/**
 * Starts noting the exit Notification's ExitTimeline, before the click: the click on the primary
 * button, the pill with `message` as it is put in the document and as it leaves, any hover or focus on
 * it, and on each animation frame while it shows, its box against the first card's and that card's Copy
 */
const watchTheExitNotification = (page: Page, message: string): Promise<void> =>
  page.evaluate((watched) => {
    const timeline: ExitTimeline = { shown: 0, held: [], frames: 0, undrawn: 0, overCard: 0, overCopy: 0, copyFocused: 0, copyLost: 0, minGapToCard: null };
    (globalThis as TimelineWindow).exitTimeline = timeline;
    const box = (element: Element): Box => {
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
      return { left, top, right, bottom, width, height };
    };
    const meet = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    // Drawn: visible as Chrome sees it, opaque through every ancestor, a box of its own within the viewport
    const drawn = (element: HTMLElement, at: Box): boolean => {
      if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) {
        return false;
      }
      for (let node: Element | null = element; node !== null; node = node.parentElement) {
        if (Number.parseFloat(getComputedStyle(node).opacity) < 1) {
          return false;
        }
      }
      return at.width > 0 && at.height > 0 && at.left >= 0 && at.top >= 0 && at.right <= innerWidth && at.bottom <= innerHeight;
    };

    document.addEventListener('click', (event) => {
      const primaryButton = document.querySelector('[data-testid="welcome-primary"]');
      if (timeline.clickAt === undefined && event.target instanceof Node && primaryButton?.contains(event.target)) {
        timeline.clickAt = event.timeStamp;
      }
    }, { capture: true });

    let pill: HTMLElement | null = null;
    const sample = (): void => {
      if (!pill?.isConnected) {
        return;
      }
      const pillBox = box(pill);
      const card = document.querySelector('[data-testid="prompt-card"]');
      const copy = card?.querySelector('button[aria-label^="Copy content of "]') ?? null;
      const cardBox = card ? box(card) : null;
      const copyBox = copy ? box(copy) : null;
      timeline.frames++;
      if (drawn(pill, pillBox)) {
        const now = performance.now();
        timeline.firstDrawnAt ??= now;
        timeline.lastDrawnAt = now;
      } else if (timeline.firstDrawnAt !== undefined) {
        timeline.undrawn++;
      }
      if (cardBox) {
        timeline.overCard += meet(pillBox, cardBox) ? 1 : 0;
        const gap = cardBox.top - pillBox.bottom;
        timeline.minGapToCard = timeline.minGapToCard === null ? gap : Math.min(timeline.minGapToCard, gap);
      }
      if (copyBox) {
        timeline.overCopy += meet(pillBox, copyBox) ? 1 : 0;
      }
      if (copy !== null && document.activeElement === copy) {
        timeline.copyFocused++;
      } else if (timeline.copyFocused > 0) {
        timeline.copyLost++;
      }
      timeline.last = { pill: pillBox, card: cardBox, copy: copyBox };
      requestAnimationFrame(sample);
    };

    new MutationObserver(() => {
      const now = performance.now();
      if (pill?.isConnected === false && timeline.goneAt === undefined) {
        timeline.goneAt = now;
      }
      const found = document.querySelector<HTMLElement>('[data-testid="toast"]');
      if (found && found !== pill && (found.textContent ?? '').includes(watched)) {
        timeline.shown++;
        if (pill === null) {
          timeline.shownAt = now;
          found.addEventListener('mouseenter', () => { timeline.held.push(`mouseenter at ${(performance.now() - (timeline.clickAt ?? 0)).toFixed(0)}ms`); });
          found.addEventListener('focusin', () => { timeline.held.push(`focusin at ${(performance.now() - (timeline.clickAt ?? 0)).toFixed(0)}ms`); });
          pill = found;
          requestAnimationFrame(sample);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }, message);

const timelineOf = (page: Page): Promise<ExitTimeline> => page.evaluate(() => (globalThis as TimelineWindow).exitTimeline);

/** Waits until `ms` have passed since the click, by the page's clock */
const untilAfterClick = (page: Page, ms: number): Promise<unknown> =>
  page.waitForFunction((after) => {
    const { clickAt } = (globalThis as TimelineWindow).exitTimeline;
    return clickAt !== undefined && performance.now() >= clickAt + after;
  }, ms);

/**
 * Clicks the primary button of the last step and follows the exit Notification `message` to its end:
 * a screenshot once it rests (its entrance and the cards' rise ended), another 5.5 s after the click,
 * then the timeline once the pill has left the document, kept with the screenshots before it is judged
 */
const followTheExitNotification = async (page: Page, message: string, name: string): Promise<ExitTimeline> => {
  await watchTheExitNotification(page, message);
  await primary(page).click();
  await expect(page.getByTestId('toast').getByText(message, { exact: true })).toBeVisible();
  await animationsDone(page);
  await fs.mkdir(EXIT_SCREENSHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(EXIT_SCREENSHOTS_DIR, `${name}-at-rest.png`) });
  await untilAfterClick(page, STILL_THERE_MS);
  const lateShotAt = await page.evaluate(() => performance.now() - ((globalThis as TimelineWindow).exitTimeline.clickAt ?? 0));
  await page.screenshot({ path: path.join(EXIT_SCREENSHOTS_DIR, `${name}-at-5.5s.png`) });
  await expect.poll(async () => (await timelineOf(page)).goneAt, { timeout: GONE_BY_MS * 2 }).toBeDefined();
  const timeline = await timelineOf(page);
  const report = {
    ...timeline,
    shownAfterClickMs: (timeline.shownAt ?? Number.NaN) - (timeline.clickAt ?? Number.NaN),
    goneAfterClickMs: (timeline.goneAt ?? Number.NaN) - (timeline.clickAt ?? Number.NaN),
    onScreenMs: (timeline.goneAt ?? Number.NaN) - (timeline.shownAt ?? Number.NaN),
    firstDrawnAfterClickMs: (timeline.firstDrawnAt ?? Number.NaN) - (timeline.clickAt ?? Number.NaN),
    lastDrawnAfterClickMs: (timeline.lastDrawnAt ?? Number.NaN) - (timeline.clickAt ?? Number.NaN),
    lateShotAfterClickMs: lateShotAt
  };
  test.info().annotations.push({ type: 'exit Notification time (ms) and place (px)', description: JSON.stringify(report) });
  await fs.writeFile(path.join(EXIT_SCREENSHOTS_DIR, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`);
  return timeline;
};

/**
 * First drawn by DRAWN_BY_MS after the click, still drawn STILL_THERE_MS after it, and without a break
 * from the end of its entrance on; removed from the document by GONE_BY_MS; one pill all along, its
 * time never stopped
 */
const expectSixSeconds = async (page: Page, timeline: ExitTimeline): Promise<void> => {
  expect(timeline.held, 'nothing hovered or focused the Notification, which would stop its time').toEqual([]);
  expect(timeline.shown, 'one Notification, from the add to its end').toBe(1);
  const { clickAt = Number.NaN, firstDrawnAt = Number.NaN, lastDrawnAt = Number.NaN, goneAt = Number.NaN } = timeline;
  expect(firstDrawnAt - clickAt, `first drawn on screen within ${String(DRAWN_BY_MS)}ms of the click`).toBeLessThanOrEqual(DRAWN_BY_MS);
  expect(lastDrawnAt - clickAt, `still drawn on screen ${String(STILL_THERE_MS)}ms after the click`).toBeGreaterThanOrEqual(STILL_THERE_MS);
  expect(timeline.undrawn, 'frames where it was in the document but not drawn, once drawn').toBe(0);
  expect(goneAt - clickAt, `gone by ${String(GONE_BY_MS)}ms after the click`).toBeLessThanOrEqual(GONE_BY_MS);
  await expect(page.getByTestId('toast')).toHaveCount(0);
};

/** Where the side panel's close button is checked free all along the exit Notification (My-Prompt-Manager-h1dh) */
const CLOSE_SURFACES = [
  { width: 320, height: 600 },
  { width: 360, height: 600 }
] as const;

/** A pixel of the close button's box, hit tested at its centre */
interface Pixel {
  x: number;
  y: number;
}

/** Hit tests every pixel of the close button's box: how many reach the button, how many the pill */
interface CloseButtonHits {
  box: Box;
  pixels: number;
  onButton: number;
  underPill: Pixel[];
}

/**
 * What the page notes about the side panel's close button while the exit Notification `message` is in
 * the document, on each animation frame from the one it is put in to the one it leaves, its entrance
 * included: CloseButtonHits of the button's box, and anything that held the pill's time
 */
interface CloseButtonWatch {
  shownAt?: number;
  goneAt?: number;
  /** Frames sampled while the pill was in the document, and those of them with no close button */
  frames: number;
  framesWithoutButton: number;
  /** The fewest pixels that reached the button in one frame */
  minOnButton: number | null;
  /** Frames where a pixel of the button's box reached the pill, and the first such pixels */
  framesUnderPill: number;
  underPill: (Pixel & { frame: number })[];
  /** The pointer or the focus on the pill (mouseenter, focusin): either stops its time */
  held: string[];
  /** The pill's box at its farthest right, over every frame */
  pillRightmost: number | null;
  last?: CloseButtonHits & { pill: Box };
}

type CloseWatchWindow = typeof globalThis & {
  closeButtonWatch: CloseButtonWatch;
  /** CloseButtonHits as the page stands, or null with no close button */
  closeButtonHits: () => CloseButtonHits | null;
};

/**
 * Starts noting the CloseButtonWatch of the exit Notification `message`, before the click on the
 * primary button. Each pixel of the close button's box is hit tested at its centre with
 * elementFromPoint, which reads the page as drawn: the pill's transform during its entrance, and the
 * rounded corners of both, are those Chrome hit tests a click with
 */
const watchTheCloseButton = (page: Page, message: string): Promise<void> =>
  page.evaluate(({ watched, selector }) => {
    const watch: CloseButtonWatch = { frames: 0, framesWithoutButton: 0, minOnButton: null, framesUnderPill: 0, underPill: [], held: [], pillRightmost: null };
    const box = (element: Element): Box => {
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
      return { left, top, right, bottom, width, height };
    };
    let pill: HTMLElement | null = null;
    const hits = (): CloseButtonHits | null => {
      const button = document.querySelector(selector);
      if (!button) {
        return null;
      }
      const at = box(button);
      const result: CloseButtonHits = { box: at, pixels: 0, onButton: 0, underPill: [] };
      for (let row = Math.floor(at.top); row < at.bottom; row++) {
        for (let column = Math.floor(at.left); column < at.right; column++) {
          const x = column + 0.5;
          const y = row + 0.5;
          if (x < at.left || x >= at.right || y < at.top || y >= at.bottom) {
            continue;
          }
          result.pixels++;
          const hit = document.elementFromPoint(x, y);
          if (hit !== null && button.contains(hit)) {
            result.onButton++;
          } else if (hit !== null && pill?.contains(hit) === true) {
            result.underPill.push({ x, y });
          }
        }
      }
      return result;
    };
    (globalThis as CloseWatchWindow).closeButtonWatch = watch;
    (globalThis as CloseWatchWindow).closeButtonHits = hits;

    const sample = (): void => {
      if (!pill?.isConnected) {
        return;
      }
      watch.frames++;
      const frame = hits();
      if (frame === null) {
        watch.framesWithoutButton++;
      } else {
        watch.minOnButton = watch.minOnButton === null ? frame.onButton : Math.min(watch.minOnButton, frame.onButton);
        if (frame.underPill.length > 0) {
          watch.framesUnderPill++;
          watch.underPill.push(...frame.underPill.slice(0, Math.max(0, 20 - watch.underPill.length)).map((pixel) => ({ ...pixel, frame: watch.frames })));
        }
        const pillBox = box(pill);
        watch.pillRightmost = Math.max(watch.pillRightmost ?? pillBox.right, pillBox.right);
        watch.last = { ...frame, pill: pillBox };
      }
      requestAnimationFrame(sample);
    };

    new MutationObserver(() => {
      if (pill?.isConnected === false && watch.goneAt === undefined) {
        watch.goneAt = performance.now();
      }
      const found = document.querySelector<HTMLElement>('[data-testid="toast"]');
      if (pill === null && found && (found.textContent ?? '').includes(watched)) {
        watch.shownAt = performance.now();
        found.addEventListener('mouseenter', () => { watch.held.push('mouseenter'); });
        found.addEventListener('focusin', () => { watch.held.push('focusin'); });
        pill = found;
        // The frame it is put in, then every frame until it leaves
        sample();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }, { watched: message, selector: LIBRARY_CLOSE });

const closeButtonWatchOf = (page: Page): Promise<CloseButtonWatch> => page.evaluate(() => (globalThis as CloseWatchWindow).closeButtonWatch);

/**
 * Each call of `window.close()`, from the page's first script on: where the click that made it was,
 * and whether the exit Notification was in the document then
 */
interface CloseProbe {
  calls: (Pixel & { toastShown: boolean })[];
  /** Whether a call closes the page; until it does, each is only noted, so one test can click many points */
  allow: boolean;
}

type CloseProbeWindow = typeof globalThis & { closeProbe: CloseProbe };

const probeTheClose = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const probe: CloseProbe = { calls: [], allow: false };
    (globalThis as CloseProbeWindow).closeProbe = probe;
    // The click being dispatched, read by the close it calls
    let click: Pixel = { x: Number.NaN, y: Number.NaN };
    document.addEventListener('click', (event) => { click = { x: event.clientX, y: event.clientY }; }, { capture: true });
    const close = window.close.bind(window);
    window.close = () => {
      probe.calls.push({ ...click, toastShown: document.querySelector('[data-testid="toast"]') !== null });
      if (probe.allow) {
        close();
      }
    };
  });
};

const closeCallsOf = async (page: Page): Promise<CloseProbe['calls']> => page.evaluate(() => (globalThis as CloseProbeWindow).closeProbe.calls);

const recordOf = async (storage: ExtensionStorage, key: string): Promise<unknown> => (await storage.get<Record<string, unknown>>(key))[key];

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

test.describe('Leaving the Welcome in the real extension', () => {
  test('S2, AC1: Skip, then Add 9 prompts: the Library lists them on All with "9 prompts added" and "Open your AI chat and type //", no loading or empty state on the way, the Welcome recorded finished', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
    await probeTheExit(page);
    await openPopup(page, extensionId);
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '0');

    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_PROMPTS.length)} prompts`);
    await primary(page).click();

    await expect(welcome(page)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(DEFAULT_PROMPTS.length);
    const titles = await cards(page).getByRole('heading').allTextContents();
    expect(titles.sort()).toEqual(DEFAULT_PROMPTS.map((prompt) => prompt.title).sort());
    const notification = page.getByTestId('toast');
    await expect(notification).toHaveAttribute('data-type', 'success');
    await expect(notification.getByText(ADDED, { exact: true })).toBeVisible();
    await expect(notification.getByText(IN_THE_CHAT, { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^All/ })).toHaveAttribute('aria-checked', 'true');
    expect(await probeOf(page)).toMatchObject({ loadingSeen: false, emptySeen: false });

    const prompts = await storage.getPrompts();
    expect(prompts.map(({ title, content, category }) => ({ title, content, category }))).toEqual(
      DEFAULTS.flatMap((pack) => pack.prompts.map(({ title, content }) => ({ title, content, category: pack.name })))
    );
    const categories = await storage.getCategories();
    for (const pack of DEFAULTS) {
      expect(categories).toContainEqual(expect.objectContaining({ name: pack.name, color: pack.color }));
    }
    await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    await expect(page.getByRole('dialog', { name: /what.s new/i })).toHaveCount(0);
  });

  // My-Prompt-Manager-ojz.19: the second line says what to do in the chat, so its "//" must show
  // wherever the Library opens, the 320px side panel, the default surface, included. The exit
  // Notification is read whole (Toast.whole): the pill grows, its second line on a line of its own
  // under the message, never cut; any other Notification of the Library stays one line. It must not
  // cover what the user needs right after the exit: the first card's Copy, which has the keyboard,
  // the search field, the add button and the filters
  for (const { file, width, height } of EXIT_SURFACES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`the exit Notification shows whole, "${IN_THE_CHAT}" on a line of its own, over nothing the user needs next (${file} ${String(width)} x ${String(height)}, ${theme})`, async ({ page, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await page.setViewportSize({ width, height });
        await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
        await expectTheme(page, theme);
        await primary(page).click();

        const layout = await exitNotificationLayout(page, ADDED);
        await keepEvidence(page, `exit-notification-${file}-${String(width)}x${String(height)}-${theme}`, layout);
        expectWhole(layout, width);
        // The first card's Copy has the keyboard, and the Notification is over none of the controls,
        // the side panel's close button included (My-Prompt-Manager-h1dh)
        await expect(firstCardCopy(page)).toBeFocused();
        expect(layout.covered.map(({ name }) => name), 'controls under the Notification').toEqual([]);
        expect(layout.pill.bottom, 'the Notification above the search field').toBeLessThanOrEqual(layout.search.top);
        expect(overlaps(layout.pill, layout.copy), 'the Notification over the first Copy').toBe(false);
        // Centered in the popup, which has no close button; in the side panel, unless it must give way to it
        expect(layout.close === null, 'no close button in the popup, one in the side panel').toBe(file === 'popup');
        expect(layout.pill.left, 'the pill, centered unless it gives way to the close button').toBeCloseTo(expectedPillLeft(layout.pill, width, layout.close), 0);
      });
    }

    // "Your library is ready", the owner's Debug replay over Packs already in: the longer message, the same second line
    test(`the exit Notification when every Prompt was already in: "Your library is ready" and "${IN_THE_CHAT}" whole (${file} ${String(width)} x ${String(height)})`, async ({ page, storage, extensionId }) => {
      await storage.seed({
        [WELCOME_KEY]: { status: 'pending', step: 2 },
        [SITE_SETTINGS_KEY]: { ...defaultSiteSettings(), debugMode: true }
      });
      await page.setViewportSize({ width, height });
      await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
      await toAddPrompts(page);
      await primary(page).click();
      await expect(page.getByTestId('toast').getByText(ADDED, { exact: true })).toBeVisible();

      // Debug mode replays the Welcome at each opening: the same Packs again, all in already
      await page.reload();
      await toAddPrompts(page);
      await primary(page).click();

      const layout = await exitNotificationLayout(page, 'Your library is ready');
      await keepEvidence(page, `exit-notification-ready-${file}-${String(width)}x${String(height)}-light`, layout);
      expectWhole(layout, width);
      expect(await storage.getPrompts()).toHaveLength(DEFAULT_PROMPTS.length);
    });
  }

  // My-Prompt-Manager-syj: the exit Notification says what to do next, "//" last; 2.7 s, a
  // confirmation's time, was gone before it was read. It stays 6 s, and as long as it shows it must
  // stay off the first card, whose Copy has the keyboard so that one Enter copies
  for (const { file, width, height } of TIME_SURFACES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`the exit Notification stays 6 s: on screen ${String(STILL_THERE_MS / 1000)} s after the click, gone by ${String(GONE_BY_MS / 1000)} s, never over the first card, whose Copy has the keyboard (${file} ${String(width)} x ${String(height)}, ${theme})`, async ({ page, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await page.setViewportSize({ width, height });
        await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
        await expectTheme(page, theme);
        await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_PROMPTS.length)} prompts`);

        const timeline = await followTheExitNotification(page, ADDED, `exit-notification-6s-${file}-${String(width)}x${String(height)}-${theme}`);

        await expectSixSeconds(page, timeline);
        // In every frame it showed: off the first card and its Copy, which had the keyboard and kept it
        expect(timeline.frames, 'frames sampled while it showed').toBeGreaterThan(0);
        expect(timeline.overCard, 'frames where the Notification met the first card').toBe(0);
        expect(timeline.overCopy, 'frames where the Notification met the first Copy').toBe(0);
        expect(timeline.copyFocused, 'frames where the first Copy had the keyboard').toBeGreaterThan(0);
        expect(timeline.copyLost, 'frames where the first Copy had lost the keyboard').toBe(0);
        expect(timeline.minGapToCard ?? Number.NaN, 'room between the Notification and the first card').toBeGreaterThan(0);
        await expect(firstCardCopy(page)).toBeFocused();
      });
    }
  }

  // My-Prompt-Manager-h1dh: in a 320px side panel the exit Notification, two lines high, covered the
  // top-left corner of the Library's close button. A pointer resting there held the Notification's
  // time, and a click there was lost. It keeps clear of the button now, every frame of its six seconds
  for (const { width, height } of CLOSE_SURFACES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`the side panel's close button stays free all along the exit Notification: no pixel of it under the pill in any frame, and a one-line Notification next stays centered (sidepanel ${String(width)} x ${String(height)}, ${theme})`, async ({ page, context, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.setViewportSize({ width, height });
        await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
        await expectTheme(page, theme);
        await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_PROMPTS.length)} prompts`);

        await watchTheCloseButton(page, ADDED);
        await primary(page).click();
        await expect(page.getByTestId('toast').getByText(ADDED, { exact: true })).toBeVisible();
        await animationsDone(page);
        await fs.mkdir(EXIT_SCREENSHOTS_DIR, { recursive: true });
        await page.screenshot({ path: path.join(EXIT_SCREENSHOTS_DIR, `close-button-free-sidepanel-${String(width)}x${String(height)}-${theme}.png`) });
        await expect.poll(async () => (await closeButtonWatchOf(page)).goneAt, { timeout: GONE_BY_MS * 2 }).toBeDefined();

        // With no Notification, the pixels of the box that reach the button: all but its rounded corners
        const rest = await page.evaluate(() => (globalThis as CloseWatchWindow).closeButtonHits());
        const watch = await closeButtonWatchOf(page);
        const report = { ...watch, rest, onScreenMs: (watch.goneAt ?? Number.NaN) - (watch.shownAt ?? Number.NaN) };
        test.info().annotations.push({ type: 'close button under the exit Notification (px)', description: JSON.stringify(report) });
        await fs.writeFile(path.join(EXIT_SCREENSHOTS_DIR, `close-button-free-sidepanel-${String(width)}x${String(height)}-${theme}.json`), `${JSON.stringify(report, null, 2)}\n`);

        expect(watch.held, 'nothing hovered or focused the Notification').toEqual([]);
        expect(watch.frames, 'frames sampled while the Notification was in the document').toBeGreaterThan(0);
        expect(watch.framesWithoutButton, 'frames with no close button').toBe(0);
        expect(rest, 'the close button, with no Notification').not.toBeNull();
        expect(rest?.underPill ?? [], 'pixels under a pill with no Notification').toEqual([]);
        expect(rest?.onButton ?? 0, 'the button reached at all but its rounded corners').toBeGreaterThan((rest?.pixels ?? Number.NaN) * 0.9);
        expect(watch.underPill, 'pixels of the close button under the Notification').toEqual([]);
        expect(watch.framesUnderPill, 'frames where a pixel of the close button was under the Notification').toBe(0);
        expect(watch.minOnButton, 'the fewest pixels reaching the button in a frame, against none shown').toBe(rest?.onButton);

        // No other Notification moves: a one-line one, the copy of the first card, stays centered
        await firstCardCopy(page).click();
        const copied = page.getByTestId('toast');
        await expect(copied.getByText('Prompt copied', { exact: true })).toBeVisible();
        await animationsDone(page);
        const oneLine = boxOf(await copied.boundingBox(), 'the one-line Notification');
        test.info().annotations.push({ type: 'one-line Notification (px)', description: JSON.stringify(oneLine) });
        await fs.writeFile(path.join(EXIT_SCREENSHOTS_DIR, `close-button-free-sidepanel-${String(width)}x${String(height)}-${theme}.json`), `${JSON.stringify({ ...report, oneLine }, null, 2)}\n`);
        expect(oneLine.height, 'one line high').toBe(40);
        expect(oneLine.left, 'the one-line Notification, centered').toBeCloseTo(width - oneLine.right, 0);
      });
    }

    test(`a click anywhere on the side panel's close button while the exit Notification shows closes the side panel, and the pointer resting on it never holds the Notification (sidepanel ${String(width)} x ${String(height)})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
      await probeTheClose(page);
      await page.setViewportSize({ width, height });
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
      await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_PROMPTS.length)} prompts`);

      await watchTheCloseButton(page, ADDED);
      await primary(page).click();
      const notification = page.getByTestId('toast');
      await expect(notification.getByText(ADDED, { exact: true })).toBeVisible();
      await animationsDone(page);

      // Its corners (3px in, inside their rounding), the middle of its edges (1px in) and its centre
      const close = boxOf(await page.locator(LIBRARY_CLOSE).boundingBox(), 'the close button');
      const middle = { x: (close.left + close.right) / 2, y: (close.top + close.bottom) / 2 };
      const points = [
        { name: 'top left', x: close.left + 3, y: close.top + 3 },
        { name: 'top', x: middle.x, y: close.top + 1 },
        { name: 'top right', x: close.right - 3, y: close.top + 3 },
        { name: 'left', x: close.left + 1, y: middle.y },
        { name: 'centre', ...middle },
        { name: 'right', x: close.right - 1, y: middle.y },
        { name: 'bottom left', x: close.left + 3, y: close.bottom - 3 },
        { name: 'bottom', x: middle.x, y: close.bottom - 1 },
        { name: 'bottom right', x: close.right - 3, y: close.bottom - 3 }
      ];
      for (const point of points) {
        await page.mouse.click(point.x, point.y);
      }
      // The pointer rests on the corner the pill used to cover
      await page.mouse.move(points[0].x, points[0].y);
      const calls = await closeCallsOf(page);
      const { held } = await closeButtonWatchOf(page);
      // A click's clientX and clientY may be rounded to whole pixels
      const closedBy = (point: Pixel) => calls.some((call) => Math.abs(call.x - point.x) < 1 && Math.abs(call.y - point.y) < 1);
      const missed = points.filter((point) => !closedBy(point)).map(({ name }) => name);
      test.info().annotations.push({ type: 'clicks on the close button', description: JSON.stringify({ close, points, missed, calls, held }) });

      expect(missed, 'clicks that did not reach the close button').toEqual([]);
      expect(calls.map(({ toastShown }) => toastShown), 'each click while the Notification showed').toEqual(points.map(() => true));
      expect(held, 'the pointer on the close button held the Notification').toEqual([]);

      // And for real, on that corner, while the Notification still shows: the side panel closes
      await expect(notification.getByText(ADDED, { exact: true })).toBeVisible();
      await page.evaluate(() => { (globalThis as CloseProbeWindow).closeProbe.allow = true; });
      const closed = page.waitForEvent('close');
      // The page may go before Chromium answers the mouse-up (tests/e2e/utils/closingClick.ts): the close is the proof
      await page.mouse.click(points[0].x, points[0].y).catch(() => undefined);
      await closed;
      expect(page.isClosed(), 'the side panel closed').toBe(true);
    });
  }

  test('the exit Notification of a Debug replay, "Your library is ready", stays 6 s as well (popup 400 x 500)', async ({ page, storage, extensionId }) => {
    await storage.seed({
      [WELCOME_KEY]: { status: 'pending', step: 2 },
      [SITE_SETTINGS_KEY]: { ...defaultSiteSettings(), debugMode: true }
    });
    await openPopup(page, extensionId);
    await toAddPrompts(page);
    await primary(page).click();
    await expect(page.getByTestId('toast').getByText(ADDED, { exact: true })).toBeVisible();

    // Debug mode replays the Welcome at each opening: the same Packs again, all in already
    await page.reload();
    await toAddPrompts(page);
    const timeline = await followTheExitNotification(page, 'Your library is ready', 'exit-notification-6s-ready-popup-400x500-light');

    await expectSixSeconds(page, timeline);
    expect(await storage.getPrompts()).toHaveLength(DEFAULT_PROMPTS.length);
  });

  test('S3, AC2: no Pack, Start empty: the empty Library, then the editor on a new Prompt about 250ms later', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2, packs: [] } });
    await probeTheExit(page);
    await openPopup(page, extensionId);
    await expect(primary(page)).toHaveText('Start empty');

    await primary(page).click();

    const editor = page.getByTestId('editor-sheet');
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel(/title/i)).toHaveValue('');
    const { libraryAt, editorAt, emptySeen, emptyAt } = await probeOf(page);
    expect(emptySeen, 'the empty Library showed').toBe(true);
    expect(libraryAt).toBeDefined();
    expect(editorAt).toBeDefined();
    expect(emptyAt).toBeDefined();
    const delay = (editorAt ?? 0) - (libraryAt ?? 0);
    const emptyBeforeEditor = (editorAt ?? 0) - (emptyAt ?? 0);
    test.info().annotations.push({ type: 'Library to editor (ms)', description: delay.toFixed(1) });
    test.info().annotations.push({ type: 'empty Library before the editor (ms)', description: emptyBeforeEditor.toFixed(1) });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUTPUT_DIR, 'start-empty-editor-delay.json'), `${JSON.stringify({ libraryAt, emptyAt, editorAt, delay, emptyBeforeEditor }, null, 2)}\n`);
    // The empty Library is what the user sees first, then the editor opens over it
    expect(emptyAt ?? Number.NaN, 'the empty Library showed before the editor').toBeLessThan(editorAt ?? Number.NaN);
    // The timer starts at the click, a little before the Library is in the document; a loaded machine may run it late
    expect(delay).toBeGreaterThanOrEqual(200);
    expect(delay).toBeLessThan(1_000);

    await expect.poll(async () => recordOf(storage, WELCOME_KEY)).toEqual({ status: 'done' });
    expect(await storage.getPrompts()).toEqual([]);
  });

  test(`S12, AC5: from a first install, Skip, Add 9 prompts, then one click on a card's copy button puts that Prompt's content in the clipboard, under ${String(FIRST_COPY_TARGET_MS / 1000)}s, over ${String(COPY_RUNS)} runs`, async ({ context, extensionId }) => {
    test.slow();
    const storage = createStorageController(await waitForBackgroundTarget(context));
    // The store a first install leaves: the Welcome pending at its first step, over an empty Library
    await waitForFirstInstallRecords(storage);
    const installed = await storage.get<Record<string, unknown>>([WELCOME_KEY, WHATS_NEW_KEY]);
    // CDP takes a chrome-extension:// origin for an opaque one: granted to every origin of this test's own browser
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await clearClipboard(context, extensionId);

    const runs: { clicks: number; clicksAfterWelcome: number; wallMs: number; pageMs: number; title: string }[] = [];
    for (let run = 0; run < COPY_RUNS; run++) {
      if (run > 0) {
        // The same first install again: nothing else in storage
        await storage.reset();
        await storage.seed(installed);
      }
      const page = await context.newPage();
      await probeTheExit(page);
      runs.push(await firstCopy(page, extensionId));
      await page.close();
      await clearClipboard(context, extensionId);
    }

    const wall = runs.map((run) => run.wallMs);
    const inPage = runs.map((run) => run.pageMs);
    const report = {
      runs,
      clicks: runs[0]?.clicks,
      clicksAfterWelcome: runs[0]?.clicksAfterWelcome,
      wallMs: { median: median(wall), max: Math.max(...wall) },
      pageMs: { median: median(inPage), max: Math.max(...inPage) }
    };
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUTPUT_DIR, 'first-copy-times.json'), `${JSON.stringify(report, null, 2)}\n`);
    test.info().annotations.push({ type: 'first copy', description: JSON.stringify({ clicks: report.clicks, wallMs: report.wallMs, pageMs: report.pageMs }) });

    for (const run of runs) {
      // Skip, the primary button, the copy button: two after the Welcome's last step, one after the Welcome
      expect(run.clicks).toBe(3);
      expect(run.clicksAfterWelcome).toBe(1);
      expect(run.wallMs).toBeLessThan(FIRST_COPY_TARGET_MS);
    }
  });
});

/** Puts CLIPBOARD_BEFORE in the clipboard, from a page of the extension that is not timed */
const clearClipboard = async (context: BrowserContext, extensionId: string): Promise<void> => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
  await page.evaluate((text) => navigator.clipboard.writeText(text), CLIPBOARD_BEFORE);
  await page.close();
};

/**
 * One run of the first copy: the popup opened on the Welcome, Skip, the primary button, then the copy
 * button of the Library's first card, each click counted; done once the clipboard holds that card's
 * Prompt. Timed from just before the popup opens (wall clock, up to the clipboard read back) and from
 * the popup's navigation start to the copy landing (in the page)
 */
const firstCopy = async (
  page: Page,
  extensionId: string
): Promise<{ clicks: number; clicksAfterWelcome: number; wallMs: number; pageMs: number; title: string }> => {
  let clicks = 0;
  const click = async (target: Locator): Promise<void> => {
    clicks++;
    await target.click();
  };

  const startedAt = Date.now();
  await openPopup(page, extensionId);
  await click(page.getByRole('button', { name: 'Skip' }));
  await click(primary(page));
  await expect(welcome(page)).toHaveCount(0);
  const clicksInWelcome = clicks;

  const card = cards(page).first();
  const title = (await card.getByRole('heading').textContent()) ?? '';
  await click(card.getByRole('button', { name: /^Copy content of / }));
  const content = PACKS.flatMap((pack) => pack.prompts).find((prompt) => prompt.title === title)?.content;
  expect(content, `the first card, ${title}, is a Prompt of the Packs`).toBeDefined();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()), { intervals: [5] }).toBe(content);
  const wallMs = Date.now() - startedAt;

  const { copiedAt } = await probeOf(page);
  expect(copiedAt).toBeDefined();
  return { clicks, clicksAfterWelcome: clicks - clicksInWelcome, wallMs, pageMs: copiedAt ?? Number.NaN, title };
};

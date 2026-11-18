/**
 * The Welcome's motion as the page plays it (My-Prompt-Manager-ojz.20): when each step is shown, when
 * step 2's typing demo starts and when it holds the name for good, read by an observer the page runs
 * from its first script, on the page's own clock (performance.now()).
 *
 * WCAG 2.2.2 (Pause, Stop, Hide, Level A): what moves by itself beside the text ends within 5s.
 */
import type { Page } from '@playwright/test';

/** What the observer has seen so far */
export interface WelcomeMotionSeen {
  /** When each step (0 to 2) was last shown */
  stepShownAt: Record<string, number>;
  /** When the typing demo now on screen was mounted, and when it held the name for good */
  demoStartAt?: number;
  demoDoneAt?: number;
}

/** An animation the page runs, its times relative to the step's display */
export interface RunningAnimation {
  name: string;
  target: string;
  playState: string;
  /** 'document' for an animation that runs on time, 'scroll' for one the user's scroll drives */
  timeline: 'document' | 'scroll' | 'other';
  /** When it ends, in ms from the step's display: Infinity for a loop */
  endsAt: number;
}

const read = (page: Page): Promise<WelcomeMotionSeen> =>
  page.evaluate(() => (globalThis as unknown as { welcomeMotion: WelcomeMotionSeen }).welcomeMotion);

/** Starts the observer: call before the page opens the Welcome */
export const watchWelcomeMotion = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const seen: WelcomeMotionSeen = { stepShownAt: {} };
    (globalThis as unknown as { welcomeMotion: WelcomeMotionSeen }).welcomeMotion = seen;
    let step: string | null = null;
    let demo: Element | null = null;
    new MutationObserver(() => {
      const now = performance.now();
      const shown = document.querySelector('[data-testid="welcome"]')?.getAttribute('data-welcome-step') ?? null;
      if (shown !== null && shown !== step) {
        seen.stepShownAt[shown] = now;
      }
      step = shown;
      const current = document.querySelector('[data-welcome-demo]');
      if (current !== demo) {
        demo = current;
        seen.demoStartAt = current === null ? undefined : now;
        seen.demoDoneAt = undefined;
      }
      if (current?.getAttribute('data-welcome-demo') === 'done' && seen.demoDoneAt === undefined) {
        seen.demoDoneAt = now;
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-welcome-step', 'data-welcome-demo'] });
  });
};

/** Waits for step `step` (0 to 2) to have been shown; returns when, on the page's clock */
export const stepShownAt = async (page: Page, step: number): Promise<number> => {
  await page.waitForFunction((s) => (globalThis as unknown as { welcomeMotion?: WelcomeMotionSeen }).welcomeMotion?.stepShownAt[String(s)] !== undefined, step);
  return (await read(page)).stepShownAt[String(step)] ?? Number.NaN;
};

/**
 * Step 2's typing demo watched to its end, as the page plays it: from its mount (the step shown, the
 * blank empty) to the name held for good with a still caret. Waits up to 15s for that end
 */
export const typingDemoMs = async (page: Page): Promise<number> => {
  await page.waitForFunction(() => (globalThis as unknown as { welcomeMotion?: WelcomeMotionSeen }).welcomeMotion?.demoDoneAt !== undefined, undefined, { timeout: 15_000 });
  const { demoStartAt, demoDoneAt } = await read(page);
  return (demoDoneAt ?? Number.NaN) - (demoStartAt ?? Number.NaN);
};

/**
 * Every animation of the document now, its end relative to `from` on the page's clock. Waits up to
 * a second for each one that runs on time to have started (a new one has no start time until its
 * first frame). A scroll-driven one is not waited for: while its scroller has nothing to scroll, its
 * timeline is inactive and it never becomes ready
 */
export const animationsFrom = (page: Page, from: number): Promise<RunningAnimation[]> =>
  page.evaluate(
    async (origin) => {
      const started = Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.timeline instanceof DocumentTimeline)
          .map((animation) => animation.ready.catch(() => undefined))
      );
      await Promise.race([started, new Promise((resolve) => { setTimeout(resolve, 1000); })]);
      return document.getAnimations().map((animation) => {
        const timing = animation.effect?.getComputedTiming();
        const target = (animation.effect as KeyframeEffect | null)?.target;
        const timeline = animation.timeline instanceof DocumentTimeline ? 'document' : animation.timeline && 'source' in animation.timeline ? 'scroll' : 'other';
        const start = typeof animation.startTime === 'number' ? animation.startTime : Number.NaN;
        const end = typeof timing?.endTime === 'number' ? timing.endTime : Number.NaN;
        return {
          name: (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty ?? 'script',
          target: target instanceof Element ? `${target.tagName.toLowerCase()}${target.getAttribute('data-testid') ? `[data-testid=${target.getAttribute('data-testid') ?? ''}]` : ''}${[...target.attributes].filter((attribute) => attribute.name.startsWith('data-welcome')).map((attribute) => `[${attribute.name}${attribute.value ? `=${attribute.value}` : ''}]`).join('')}` : '',
          playState: animation.playState,
          timeline,
          endsAt: timeline === 'document' ? start + end - origin : Number.NaN
        };
      });
    },
    from
  );

/**
 * E2E: motion on the Welcome stops by itself, on the built extension (My-Prompt-Manager-ojz.20;
 * WCAG 2.2.2 Pause, Stop, Hide, Level A, which axe cannot see).
 *
 * - AC4: on steps 1, 2 and 3, 5s after the step is shown, document.getAnimations() holds no running
 *   animation that runs on time, and step 2 holds its whole sentence, the name typed, with a still
 *   caret. In the popup (400 x 500) and in a side panel (320 x 600). Each step's display is read on
 *   the page's own clock by an observer that runs from its first script
 *   (tests/e2e/utils/welcomeMotion.ts); the check runs on that clock too, 5000ms later. Logged: when
 *   each step's last animation ends, and when the typing demo holds the name for good, from the
 *   step's display.
 *   Step 3's Packs grid has four scroll-driven animations (popup.css, ojz.10: the edges' fades and
 *   lines). Chromium reports them as 'running' for as long as the grid is on screen, but the user's
 *   scroll drives them, not time: they move only while the user scrolls, which WCAG 2.2.2 leaves out
 *   (motion that starts by itself). The check reads them apart, and proves the split hides nothing:
 *   they are exactly these four, each on a ScrollTimeline, and none of them moves over 500ms with no
 *   input.
 * - AC5, reduced motion: the static rendering: step 2's whole name at once with no caret, nothing
 *   floating on step 1, no animation running on any step. The blank is read from its first rendering
 *   by an observer that runs from the page's first script: the whole name is the first and only text
 *   it holds, and no caret is ever in the page.
 */
import type { Page } from '@playwright/test';

import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';
import { animationsFrom, stepShownAt, typingDemoMs, watchWelcomeMotion } from '../utils/welcomeMotion';

/** WCAG 2.2.2: what moves by itself beside the text ends within this of the step's display */
const LIMIT_MS = 5000;
const NAME = 'Claire, Head of Sales';

const SURFACES = {
  popup: { file: 'popup', width: 400, height: 500 },
  sidepanel: { file: 'sidepanel', width: 320, height: 600 }
} as const;

/** Step 3's scroll-driven animations: the edges of the Packs grid, moved by its scroll alone */
const SCROLL_LINKED = ['welcome-packs-fade-bottom', 'welcome-packs-fade-top', 'welcome-packs-line-bottom', 'welcome-packs-line-top'];

const welcome = (page: Page) => page.getByTestId('welcome');
const primary = (page: Page) => page.getByTestId('welcome-primary');

/** What step 2's blank held, each text once in the order shown, and whether a caret was ever in the page */
interface BlankSeen {
  texts: string[];
  caret: boolean;
}

/**
 * Notes every text of step 2's blank and any caret, from the page's first script on: call before the
 * page opens the Welcome. Each change of the page is read before the frame that draws it
 */
const watchBlank = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const seen: BlankSeen = { texts: [], caret: false };
    (globalThis as unknown as { blankSeen: BlankSeen }).blankSeen = seen;
    new MutationObserver(() => {
      const blank = document.querySelector('[data-testid="welcome-blank"]');
      const text = blank?.textContent;
      if (typeof text === 'string' && text !== seen.texts[seen.texts.length - 1]) {
        seen.texts.push(text);
      }
      if (document.querySelector('[data-welcome-caret]')) {
        seen.caret = true;
      }
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
};

const blankSeen = (page: Page): Promise<BlankSeen> => page.evaluate(() => (globalThis as unknown as { blankSeen: BlankSeen }).blankSeen);

/** What runs on the page `LIMIT_MS` after `shownAt`, read on the page's clock at that moment */
const fiveSecondsAfter = (page: Page, shownAt: number) =>
  page.evaluate(
    async ({ from, limit }) => {
      // A timer can fire a fraction of a millisecond before performance.now() reaches its time: wait
      // again until the page's clock has passed the limit
      while (performance.now() - from < limit) {
        await new Promise((resolve) => {
          setTimeout(resolve, Math.max(1, from + limit - performance.now()));
        });
      }
      const at = performance.now() - from;
      // The brief's check as written: every animation whose playState is 'running'
      const runningNow = document.getAnimations().filter((animation) => animation.playState === 'running');
      const positionOf = (animation: Animation) => `${String(animation.currentTime)} ${String(animation.effect?.getComputedTiming().progress)}`;
      const before = runningNow.map(positionOf);
      // Held still? The same animations read again 500ms later, with no input meanwhile
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
      const running = runningNow.map((animation, index) => ({
        name: (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty ?? 'script',
        timeline: animation.timeline?.constructor.name ?? 'none',
        moved: positionOf(animation) !== before[index]
      }));
      const blank = document.querySelector('[data-testid="welcome-blank"]');
      const caret = blank?.querySelector('[data-welcome-caret]');
      return {
        at,
        running,
        blank: blank?.textContent ?? null,
        demo: document.querySelector('[data-welcome-demo]')?.getAttribute('data-welcome-demo') ?? null,
        caret:
          caret instanceof HTMLElement
            ? { animations: caret.getAnimations().length, className: caret.className, opacity: getComputedStyle(caret).opacity, width: caret.getBoundingClientRect().width }
            : null
      };
    },
    { from: shownAt, limit: LIMIT_MS }
  );

test.describe('Motion on the Welcome stops by itself', () => {
  for (const surface of ['popup', 'sidepanel'] as const) {
    const { file, width, height } = SURFACES[surface];

    test(`AC4: 5s after each step shows, nothing moves by itself, and step 2 holds the whole sentence with a still caret (${surface} ${String(width)} x ${String(height)})`, async ({ page, storage, extensionId }) => {
      test.setTimeout(90_000);
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
      await watchWelcomeMotion(page);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width, height });
      await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);

      for (const step of [0, 1, 2] as const) {
        await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
        const shownAt = await stepShownAt(page, step);
        // What plays on the step, read as it plays: when the last of it ends
        const playing = await animationsFrom(page, shownAt);
        const timed = playing.filter((animation) => animation.timeline === 'document');
        const lastEnd = Math.max(0, ...timed.map((animation) => animation.endsAt));

        const after = await fiveSecondsAfter(page, shownAt);
        const demoMs = step === 1 ? await typingDemoMs(page) : null;
        const line = {
          step: step + 1,
          surface: `${surface} ${String(width)}x${String(height)}`,
          lastAnimationEndsMs: Math.round(lastEnd),
          animations: timed.map((animation) => `${animation.name} ${animation.target} ends ${String(Math.round(animation.endsAt))}ms`),
          scrollDriven: playing.filter((animation) => animation.timeline !== 'document').map((animation) => `${animation.name} (${animation.playState})`),
          typingDemoEndsMs: demoMs === null ? undefined : Math.round(demoMs),
          checkedAtMs: Math.round(after.at),
          runningAt5s: after.running
        };
        console.log(`[welcome motion] ${JSON.stringify(line)}`);
        test.info().annotations.push({
          type: `step ${String(step + 1)}`,
          description: `last animation ends ${String(line.lastAnimationEndsMs)}ms${demoMs === null ? '' : `, typing holds at ${String(line.typingDemoEndsMs)}ms`}; at ${String(line.checkedAtMs)}ms running: ${JSON.stringify(after.running)}`
        });

        expect(after.at).toBeGreaterThanOrEqual(LIMIT_MS);
        // Nothing loops, and nothing timed runs past the limit
        expect(timed.every((animation) => Number.isFinite(animation.endsAt))).toBe(true);
        expect(lastEnd).toBeLessThanOrEqual(LIMIT_MS);
        const onTime = after.running.filter((animation) => animation.timeline === 'DocumentTimeline');
        const byScroll = after.running.filter((animation) => animation.timeline !== 'DocumentTimeline');
        expect(onTime, `running on time ${String(Math.round(after.at))}ms after step ${String(step + 1)} showed`).toEqual([]);
        // What the split leaves out: step 3's four edges of the Packs grid, on its scroll, held still
        expect(byScroll.map((animation) => animation.name).sort()).toEqual(step === 2 ? SCROLL_LINKED : []);
        for (const animation of byScroll) {
          expect(animation.timeline, animation.name).toBe('ScrollTimeline');
          expect(animation.moved, `${animation.name} moved with no input`).toBe(false);
        }

        if (step === 1) {
          // The whole sentence, the name typed, the caret after it still: there, opaque, unanimated
          expect(demoMs).not.toBeNull();
          expect(demoMs ?? Infinity).toBeLessThanOrEqual(LIMIT_MS);
          expect(after.blank).toBe(NAME);
          expect(after.demo).toBe('done');
          expect(after.caret).not.toBeNull();
          expect(after.caret?.animations).toBe(0);
          expect(after.caret?.className).not.toContain('animate-');
          expect(after.caret?.opacity).toBe('1');
          expect(after.caret?.width).toBeGreaterThan(0);
          // The sentence on screen (not its unseen twin that holds the card's height, nor the screen reader's) whole
          const shown = page.locator('[data-welcome-demo] p:not(.invisible):not(.sr-only)');
          await expect(shown).toHaveText(`Write a follow-up email to ${NAME} and end with one clear next step.`);
          await expect(shown).toBeVisible();
        }

        if (step < 2) {
          await primary(page).click();
        }
      }
    });
  }

  test('AC5: under reduced motion, the static rendering: the whole name at once with no caret, nothing floating, no animation running on any step', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
    await watchBlank(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 400, height: 500 });
    await page.goto(`chrome-extension://${extensionId}/src/popup.html`);

    for (const step of [0, 1, 2] as const) {
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
      if (step === 0) {
        for (const card of await page.locator('[data-welcome-card]').all()) {
          await expect(card).toHaveCSS('animation-name', 'none');
        }
      }
      if (step === 1) {
        await expect(page.getByTestId('welcome-blank')).toHaveText(NAME);
        await expect(page.locator('[data-welcome-caret]')).toHaveCount(0);
        await expect(page.locator('[data-welcome-demo]')).toHaveAttribute('data-welcome-demo', 'done');
      }
      // Within a few frames of the step, nothing runs that lasts (the frame's own 1ms transitions done)
      await page.evaluate(() => new Promise((resolve) => { setTimeout(resolve, 100); }));
      if (step === 1) {
        // From the blank's first rendering on, as the page drew it: the whole name and never a caret
        const seen = await blankSeen(page);
        expect(seen.texts[0], 'the first text of the blank').toBe(NAME);
        expect(seen.texts, 'every text the blank held').toEqual([NAME]);
        expect(seen.caret, 'a caret, at any moment').toBe(false);
      }
      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === 'running' && animation.timeline instanceof DocumentTimeline)
          .map((animation) => (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty)
      );
      expect(running, `step ${String(step + 1)} under reduced motion`).toEqual([]);
      if (step < 2) {
        await primary(page).click();
      }
    }
  });
});

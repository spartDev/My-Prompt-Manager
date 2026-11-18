/**
 * E2E: the Welcome's proof screenshots, to set beside the Atelier 1C mockup (My-Prompt-Manager-ojz.14).
 *
 * Renders the three steps in light and dark, in the popup (400 x 500) and in a side panel as wide and
 * high as the mockup's side format (400 x 860), and in the popup the Library the Welcome leaves for
 * with its Notification, after "Add 9 prompts" (the Packs selected by default, Product and Writing).
 * Each test starts from a pending Welcome over an empty Library, the store of a first install, and
 * goes from step to step by pointer clicks on the primary button, as a person does.
 *
 * The images are made to be compared with the mockup, so each is taken at a fixed moment:
 * - motion is left on (the look most users get), and every animation (the opening fade, the slide
 *   of a step, the dot, the Back pop, the Notification's entrance, the floating cards of step 1 and
 *   the caret's blink, which all end within 5s, My-Prompt-Manager-ojz.20) has ended, so the cards
 *   stand at rest and the caret shows;
 * - step 2 is taken while its blank holds the whole name, "Claire, Head of Sales", as the mockup
 *   shows it: once the demo holds it for good, at once; before, the test waits for the letter that
 *   completes it, shoots, and shoots again if the blank changed meanwhile;
 * - the pointer rests where it lights nothing up; on the Library it rests on the Notification's text,
 *   which has no hover look and keeps the Notification on screen until the screenshot is taken;
 * - no keyboard focus is shown: every move is a pointer click, so no control draws its focus ring.
 *
 * Files: <screen>-<surface>-<theme>.png, screen step1, step2, step3 or exit, surface popup or
 * sidepanel, in WELCOME_VISUAL_DIR (test-results/welcome-visual when unset; Playwright empties
 * test-results at each run, so give a folder of your own to keep them). docs/TESTING.md says how they
 * are set beside the mockup and published with scripts/pr-assets.sh.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';

const OUTPUT_DIR = process.env.WELCOME_VISUAL_DIR ?? 'test-results/welcome-visual';

/** The popup, and a side panel of the mockup's side format */
const SURFACES = {
  popup: { file: 'popup', width: 400, height: 500 },
  sidepanel: { file: 'sidepanel', width: 400, height: 860 }
} as const;

type Surface = keyof typeof SURFACES;
type Theme = 'light' | 'dark';

const STEP_TITLES = ['Your best prompts, one tap away', 'Leave blanks, fill them later', 'Start with a pack'] as const;

/** The name step 2 types into its blank */
const BLANK_NAME = 'Claire, Head of Sales';

/** How many typings of the demo the test waits for a screenshot the blank did not change during */
const BLANK_ATTEMPTS = 5;

const DEFAULT_PACKS = PACKS.filter((pack) => pack.defaultSelected);
const DEFAULT_PROMPTS = DEFAULT_PACKS.reduce((count, pack) => count + pack.prompts.length, 0);

const welcome = (page: Page) => page.getByTestId('welcome');
const primary = (page: Page) => page.getByTestId('welcome-primary');

const fileOf = (screen: string, surface: Surface, theme: Theme): string => path.join(OUTPUT_DIR, `${screen}-${surface}-${theme}.png`);

/**
 * Resolves once every finite animation of the page has ended, the endless ones left out, and two
 * frames have been drawn since: a layer scaled by an animation is drawn again at its final size
 */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
    for (let frame = 0; frame < 2; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });

/** The pointer off every control, on the header's middle, so nothing shows its hover */
const restPointer = async (page: Page, surface: Surface): Promise<void> => {
  await page.mouse.move(SURFACES[surface].width / 2, 4);
};

const shoot = (page: Page, file: string): Promise<Buffer> => page.screenshot({ path: file, animations: 'disabled' });

/**
 * Takes step 2 while its blank holds the whole name. Once the demo holds it for good (it types it
 * twice, then stays), at once; before that, waits for the letter that completes it (the name then
 * stays about 1.2 s, or for good), shoots, and checks the blank did not change during the screenshot.
 * Tries again at the next typing if it did.
 */
const shootWholeBlank = async (page: Page, file: string): Promise<void> => {
  if ((await page.locator('[data-welcome-demo]').getAttribute('data-welcome-demo')) === 'done') {
    await expect(page.getByTestId('welcome-blank')).toHaveText(BLANK_NAME);
    await shoot(page, file);
    return;
  }
  for (let attempt = 1; attempt <= BLANK_ATTEMPTS; attempt++) {
    await page.evaluate(
      (name) =>
        new Promise<void>((resolve) => {
          const blank = document.querySelector('[data-testid="welcome-blank"]');
          const flags = window as unknown as { blankChanged?: boolean };
          if (!blank) {
            flags.blankChanged = true;
            resolve();
            return;
          }
          let complete = false;
          const observer = new MutationObserver(() => {
            if (!complete && blank.textContent === name) {
              // The name just completed: from now on, any change of the blank spoils the screenshot
              complete = true;
              flags.blankChanged = false;
              resolve();
            } else if (complete) {
              flags.blankChanged = true;
              observer.disconnect();
            }
          });
          observer.observe(blank, { childList: true, characterData: true, subtree: true });
        }),
      BLANK_NAME
    );
    await shoot(page, file);
    const changed = await page.evaluate(() => (window as unknown as { blankChanged?: boolean }).blankChanged);
    if (changed === false) {
      await expect(page.getByTestId('welcome-blank')).toHaveText(BLANK_NAME);
      return;
    }
    test.info().annotations.push({ type: 'step 2', description: `attempt ${String(attempt)}: the blank changed during the screenshot, taken again` });
  }
  throw new Error(`Step 2: no screenshot with the whole name in ${String(BLANK_ATTEMPTS)} typings of the demo`);
};

const open = async (page: Page, extensionId: string, surface: Surface, theme: Theme): Promise<void> => {
  const { file, width, height } = SURFACES[surface];
  // The motion is part of the look: whatever the machine's own setting
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  } else {
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  }
};

test.describe('The Welcome beside its mockup: proof screenshots', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const surface of ['popup', 'sidepanel'] as const) {
      const { width, height } = SURFACES[surface];
      const withExit = surface === 'popup';

      test(`PROOF, ${theme}, ${surface} ${String(width)} x ${String(height)}: the three steps${withExit ? ', then the Library at the exit with its Notification' : ''}`, async ({ page, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        await open(page, extensionId, surface, theme);

        for (const step of [0, 1, 2] as const) {
          await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
          await expect(page.getByRole('heading', { level: 1, name: STEP_TITLES[step] })).toBeVisible();
          await animationsDone(page);
          await restPointer(page, surface);
          const file = fileOf(`step${String(step + 1)}`, surface, theme);
          if (step === 1) {
            await shootWholeBlank(page, file);
          } else {
            await shoot(page, file);
          }
          if (step < 2) {
            await primary(page).click();
          }
        }

        if (!withExit) {
          return;
        }

        // The Packs selected by default, as a new user who only reads and goes on
        await expect(primary(page)).toHaveText(`Add ${String(DEFAULT_PROMPTS)} prompts`);
        await primary(page).click();

        await expect(welcome(page)).toHaveCount(0);
        await expect(page.getByTestId('prompt-card')).toHaveCount(DEFAULT_PROMPTS);
        const notification = page.getByTestId('toast');
        await expect(notification).toContainText(`${String(DEFAULT_PROMPTS)} prompts added`);
        await expect(notification).toContainText('Open your AI chat and type //');
        // Hovered, the Notification keeps its time; its text has no hover look
        await page.getByTestId('toast-text').hover();
        await animationsDone(page);
        await shoot(page, fileOf('exit', surface, theme));
        await expect(notification).toBeVisible();
      });
    }
  }
});

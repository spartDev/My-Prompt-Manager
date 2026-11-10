/**
 * E2E: the Prompt selector stays open when the page scrolls or the window resizes (My-Prompt-Manager-sqi)
 *
 * The selector repositions itself on scroll and resize. Repositioning measured it by adding it to the
 * page and taking it out again, so an open selector vanished at the first scroll: with a Prompt with
 * Variables, its fill-in form went with it. Also captures light/dark screenshots as visual proof
 * (test-results/prompt-selector-scroll/).
 */

import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/extension';
import { openPlatform, openPromptSelector, promptRow, promptSelector } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/prompt-selector-scroll';

/** Lets the selector's repositioning run: it waits for the next frame after a scroll or resize, due before this timer. */
const afterRepositioning = (page: Page) => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 100)));

test.describe('Prompt selector on a page that scrolls', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`stays open when the page scrolls and when the window resizes (${theme})`, async ({ context, storage }) => {
      await seedLibrary(storage, {
        prompts: [
          createPromptSeed({ id: 'translate', title: 'Translate a text', content: 'Translate {{text}} into French.' }),
          createPromptSeed({ id: 'review', title: 'Review a diff', content: 'Review this diff like a senior developer.' }),
          createPromptSeed({ id: 'summarize', title: 'Summarize a meeting', content: 'Summarize the transcript below.' })
        ],
        settings: { theme }
      });
      const page = await openPlatform(context, 'claude');
      // A conversation longer than the window, as on the live site
      await page.addStyleTag({ content: 'main { min-height: 1600px; }' });
      await page.setViewportSize({ width: 900, height: 600 });
      const selector = promptSelector(page);
      await openPromptSelector(page);
      await expect(page.locator('#mpm-prompt-selector')).toHaveAttribute('data-theme', theme);

      await page.mouse.move(8, 300);
      await page.mouse.wheel(0, 120);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await afterRepositioning(page);
      await expect(selector).toBeVisible();

      await page.setViewportSize({ width: 820, height: 600 });
      await afterRepositioning(page);
      await expect(selector).toBeVisible();

      // Still usable: a Prompt with Variables opens its variables step in it
      await promptRow(page, 'translate').click();
      await expect(selector.getByRole('button', { name: /Insert into the chat/ })).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/selector-after-scroll-${theme}.png` });
    });
  }
});

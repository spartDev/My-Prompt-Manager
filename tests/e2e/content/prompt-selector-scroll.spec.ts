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
import { openPlatform } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/prompt-selector-scroll';

/** Lets the selector's repositioning run: it waits 16 ms after a scroll or resize, a timer due before this one. */
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
      const selector = page.locator('.prompt-library-selector');
      await page.locator('.prompt-library-integrated-icon').click();
      await expect(selector).toBeVisible();
      await expect(selector).toHaveClass(new RegExp(`${theme}-theme`));

      await page.mouse.move(8, 300);
      await page.mouse.wheel(0, 120);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await afterRepositioning(page);
      await expect(selector).toBeVisible();

      await page.setViewportSize({ width: 820, height: 600 });
      await afterRepositioning(page);
      await expect(selector).toBeVisible();

      // Still usable: a Prompt with Variables opens its form in it
      await selector.locator('.prompt-item[data-prompt-id="translate"]').click();
      await expect(selector.getByRole('button', { name: 'Insert as is' })).toBeVisible();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/selector-after-scroll-${theme}.png` });
    });
  }
});

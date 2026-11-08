/**
 * E2E: the Section transition (My-Prompt-Manager-g7p, Atelier 1C)
 *
 * Arriving on a Section from the tab bar slides it 26px in from the side of its tab with a fade,
 * over 450ms on the Section curve; the popup opens on its first Section at once. The tab pressed
 * keeps the keyboard, and pressing the active tab still scrolls its Section back to the top.
 * Under prefers-reduced-motion the slide is near instant. Captures light/dark screenshots of a
 * Section sliding in as visual proof (test-results/section-transition/).
 */

import type { Page } from '@playwright/test';

import { EASE, MOTION } from '../../../src/theme/motion';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { SECTION_HEADINGS, type Section, tabNavigation } from '../utils/navigation';
import { createPromptSeed, createUsageHistory, seedLibrary, seedUsageHistory } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/section-transition';

const seconds = (ms: number): string => `${ms / 1000}s`;

const prompts = Array.from({ length: 12 }, (_, index) =>
  createPromptSeed({
    id: `section-prompt-${index}`,
    title: `Prompt ${index + 1}`,
    content: `Content of prompt ${index + 1}.`
  })
);

const openPopup = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts, settings: { theme } });
  await page.setViewportSize({ width: 400, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await expect(page.getByTestId('prompt-card').first()).toBeVisible();
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

const goTo = async (page: Page, section: Section) => {
  await tabNavigation.getTab(page, section).click();
  await expect(page.getByRole('heading', { name: SECTION_HEADINGS[section], level: 1 })).toBeVisible();
};

/** Holds the Section early in its slide (the curve covers most of the way in its first half), for a
 * screenshot, then lets it end */
const screenshotSliding = async (page: Page, path: string) => {
  await page.evaluate((at) => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.animationName.startsWith('section-from-')) {
        animation.pause();
        animation.currentTime = at;
      }
    }
  }, MOTION.sectionIn / 8);
  await page.screenshot({ path });
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.playState === 'paused') animation.finish();
    }
  });
};

// Along the tab bar and back: every Section is arrived on at least once
const JOURNEY: Array<[Section, 'section-from-right' | 'section-from-left']> = [
  ['categories', 'section-from-right'],
  ['analytics', 'section-from-right'],
  ['settings', 'section-from-right'],
  ['analytics', 'section-from-left'],
  ['library', 'section-from-left']
];

test.describe('Section transition', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`each Section slides in from the side of its tab and keeps the keyboard on it (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);
      const section = page.getByTestId('section');
      // The popup opens on the Library at once
      await expect(section).toHaveCSS('animation-name', 'none');

      for (const [target, keyframes] of JOURNEY) {
        await goTo(page, target);
        await expect(section).toHaveCSS('animation-name', keyframes);
        await expect(section).toHaveCSS('animation-duration', seconds(MOTION.sectionIn));
        await expect(section).toHaveCSS('animation-timing-function', EASE.section);
        await expect(tabNavigation.getTab(page, target)).toBeFocused();
        if (target === 'settings' || target === 'library') {
          await screenshotSliding(page, `${SCREENSHOT_DIR}/${target}-sliding-in-${theme}.png`);
        }
      }

      // Arrived, the Section is back in the flow, with no offset and no transform
      await expect(section).toHaveCSS('position', 'static');
      await expect(section).toHaveCSS('transform', 'none');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-arrived-${theme}.png` });
    });
  }

  test('a dialog opened while the Section slides in covers the whole popup', async ({ page, storage, extensionId }) => {
    await seedUsageHistory(storage, createUsageHistory(5, { promptIds: [prompts[0].id] }));
    await openPopup(page, storage, extensionId, 'light');
    // Held early in its slide, as when Clear history is pressed during the 450ms of the entrance
    await page.evaluate((at) => {
      document.addEventListener('animationstart', (event) => {
        if (!event.animationName.startsWith('section-from-') || !(event.target instanceof HTMLElement)) return;
        for (const animation of event.target.getAnimations()) {
          animation.pause();
          animation.currentTime = at;
        }
      });
    }, MOTION.sectionIn / 8);
    await goTo(page, 'analytics');
    await expect(page.getByTestId('section')).toHaveCSS('opacity', /^0\.\d+$/);

    await page.getByRole('button', { name: 'Clear history' }).click();

    // Its backdrop fills the popup, over the tab bar, not the Section alone, and the dialog is centered in it
    const backdrop = page.getByRole('dialog', { name: 'Clear usage history?' }).locator('xpath=..');
    const viewport = page.viewportSize();
    expect(await backdrop.boundingBox()).toEqual({ x: 0, y: 0, width: viewport?.width, height: viewport?.height });
  });

  test('a Section sliding in from the right never makes the popup scroll sideways', async ({ page, storage, extensionId }) => {
    await openPopup(page, storage, extensionId, 'light');
    await page.evaluate((at) => {
      document.addEventListener('animationstart', (event) => {
        if (!event.animationName.startsWith('section-from-') || !(event.target instanceof HTMLElement)) return;
        for (const animation of event.target.getAnimations()) {
          animation.pause();
          animation.currentTime = at;
        }
      });
    }, MOTION.sectionIn / 8);

    await goTo(page, 'settings');

    await expect(page.getByTestId('section')).toHaveCSS('opacity', /^0\.\d+$/);
    const overflow = await page.evaluate(() => {
      const root = document.scrollingElement ?? document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBe(0);
  });

  test('pressing the active tab still scrolls its Section back to the top', async ({ page, storage, extensionId }) => {
    await openPopup(page, storage, extensionId, 'light');
    await goTo(page, 'settings');
    await goTo(page, 'library');
    const scroller = page.locator('[data-scroll-container]');
    await scroller.evaluate((element) => { element.scrollTop = 200; });
    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    await tabNavigation.getTab(page, 'library').click();

    await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0);
  });

  test('under prefers-reduced-motion a Section arrives near instantly', async ({ page, storage, extensionId }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPopup(page, storage, extensionId, 'light');

    for (const target of ['categories', 'analytics', 'settings', 'library'] as const) {
      await goTo(page, target);
      await expect(page.getByTestId('section')).toHaveCSS('animation-duration', '0.001s');
    }
  });
});

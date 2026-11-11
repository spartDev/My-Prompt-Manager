/**
 * E2E: the motion of the Prompt editor in the side panel (My-Prompt-Manager-cvx)
 *
 * The editor rises from the bottom edge of the side panel over a Library that stays where it is
 * and recedes under the scrim, for a new Prompt and for an edit, as in the popup
 * (tests/e2e/library/editor-motion.spec.ts). The editor takes the keyboard as it opens, while the
 * sheet is still below the panel: that focus must not scroll the panel, or the whole app jumps up
 * at the first frame and the sheet seems to have risen already. Captures light/dark screenshots
 * of the sheet halfway up as visual proof (test-results/sidepanel-editor-motion/).
 */

import type { Page } from '@playwright/test';

import { MOTION } from '../../../src/theme/motion';
import type { Category } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/sidepanel-editor-motion';
const PANEL = { width: 420, height: 900 };
const RISING = ['sheet-in', 'recede-in', 'scrim-in'];

const categories: Category[] = [{ id: 'writing', name: 'Rédaction', color: '#2563EB' }];
const prompt = createPromptSeed({
  id: 'meeting',
  title: 'Résumé de réunion',
  content: 'Résume la transcription ci-dessous en 5 points clés.',
  category: 'Rédaction'
});

const openSidePanel = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts: [prompt], categories, settings: { theme, interfaceMode: 'sidepanel' }, interfaceMode: 'sidepanel' });
  await page.setViewportSize(PANEL);
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
  await expect(page.getByTestId('prompt-card').first()).toBeVisible();
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

/** Holds the editor's rising animations at `at` ms, then says where everything stands */
const holdRising = async (page: Page, at: number) => {
  await page.evaluate(([time, names]) => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && names.includes(animation.animationName)) {
        animation.pause();
        animation.currentTime = time;
      }
    }
  }, [at, RISING] as const);
  return page.evaluate(() => {
    const top = (testId: string) => document.querySelector(`[data-testid="${testId}"]`)?.getBoundingClientRect().top;
    return {
      // What scrolled: the side panel's root, and the page itself
      rootScrollTop: document.getElementById('root')?.scrollTop,
      pageScrollY: window.scrollY,
      appTop: document.getElementById('root')?.firstElementChild?.getBoundingClientRect().top,
      beneathTop: top('editor-beneath'),
      sheetTop: top('editor-sheet')
    };
  });
};

const release = async (page: Page) => {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.playState === 'paused') animation.finish();
    }
  });
};

test.describe('Prompt editor motion in the side panel', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const opening of ['new', 'edit'] as const) {
      test(`the sheet rises from the bottom edge over a Library that stays in place, ${opening === 'new' ? 'for a new Prompt' : 'for an edit'} (${theme})`, async ({ page, storage, extensionId }) => {
        await openSidePanel(page, storage, extensionId, theme);
        await (opening === 'new'
          ? page.getByTestId('new-prompt-button')
          : page.getByRole('button', { name: `Edit ${prompt.title}` })
        ).click();
        await expect(page.getByTestId('editor-sheet')).toBeVisible();

        // First frame: the sheet waits just below the panel, and nothing has scrolled
        const start = await holdRising(page, 0);
        expect(start.rootScrollTop).toBe(0);
        expect(start.pageScrollY).toBe(0);
        expect(start.appTop).toBe(0);
        expect(start.beneathTop).toBe(0);
        expect(start.sheetTop).toBe(PANEL.height);

        // Halfway up: still nothing scrolled, the Library receding in place behind the sheet
        const middle = await holdRising(page, MOTION.sheetIn / 2);
        expect(middle.rootScrollTop).toBe(0);
        expect(middle.pageScrollY).toBe(0);
        expect(middle.appTop).toBe(0);
        expect(middle.beneathTop).toBe(0);
        expect(middle.sheetTop).toBeGreaterThan(0);
        expect(middle.sheetTop).toBeLessThan(PANEL.height);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/editor-sheet-rising-${opening}-${theme}.png` });

        // Up: the Title has the keyboard, and the panel is as it was
        await release(page);
        await expect(page.getByLabel('Title', { exact: true })).toBeFocused();
        expect(await page.evaluate(() => document.getElementById('root')?.scrollTop)).toBe(0);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/editor-sheet-${opening}-${theme}.png` });
      });
    }
  }
});

/**
 * E2E: one Section header for every Section but the Library (My-Prompt-Manager-eha)
 *
 * Settings, Categories and Analytics show the same header: an Eyebrow in text-tertiary over a 27px
 * extrabold title, no icon square, at the same place. Captures light/dark screenshots as visual
 * proof (test-results/section-headers/).
 */

import type { Page } from '@playwright/test';

import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/section-headers';

const EXPECTED = {
  light: { primary: 'rgb(29, 21, 48)', tertiary: 'rgb(111, 103, 135)', app: 'rgb(244, 241, 250)' },
  dark: { primary: 'rgb(241, 237, 249)', tertiary: 'rgb(163, 154, 187)', app: 'rgb(18, 14, 27)' }
} as const;

const SECTIONS = [
  { tab: 'tab-settings', title: 'Settings', eyebrow: /^My Prompt Manager \d+\.\d+\.\d+$/ },
  { tab: 'tab-categories', title: 'Categories', eyebrow: /^\d+ categor(y|ies)$/ },
  { tab: 'tab-analytics', title: 'Analytics', eyebrow: /^Last 30 days$/ }
] as const;

const openPopup = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark') => {
  await seedLibrary(storage, {
    prompts: [createPromptSeed({ id: 'prompt-1', title: 'Résumé', content: 'Résume la transcription ci-dessous.' })],
    // A Category of the user's own, so that the Eyebrow of Categories counts them
    categories: [{ id: 'work', name: 'Work', color: '#2563EB' }],
    settings: { theme }
  });
  await page.setViewportSize({ width: 400, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

test.describe('Section headers after Settings', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`Settings, Categories and Analytics share one Section header: Eyebrow over a 27px title, no icon (${theme})`, async ({ page, storage, extensionId }) => {
      await openPopup(page, storage, extensionId, theme);

      const titleTops: number[] = [];
      for (const section of SECTIONS) {
        await page.getByTestId(section.tab).click();
        const header = page.getByRole('banner');
        const title = header.getByRole('heading', { level: 1, name: section.title, exact: true });
        await expect(title).toBeVisible();
        // Wait for the Section's arrival slide to end before measuring where the title sits
        await page.getByTestId('section').evaluate(async (element) => { await Promise.all(element.getAnimations().map(async (animation) => animation.finished)); });

        await expect(header).toHaveCSS('background-color', colors.app);
        await expect(title).toHaveCSS('font-size', '27px');
        await expect(title).toHaveCSS('font-weight', '800');
        await expect(title).toHaveCSS('color', colors.primary);
        const eyebrow = header.getByText(section.eyebrow);
        await expect(eyebrow).toHaveCSS('font-size', '12.5px');
        await expect(eyebrow).toHaveCSS('color', colors.tertiary);
        await expect(header.getByRole('img')).toHaveCount(0);

        const box = await title.boundingBox();
        expect(box, `${section.title} title box`).not.toBeNull();
        titleTops.push(Math.round(box?.y ?? 0));
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${section.title.toLowerCase()}-${theme}.png` });
      }

      expect(new Set(titleTops).size, `title tops ${titleTops.join(', ')}`).toBe(1);
    });
  }
});

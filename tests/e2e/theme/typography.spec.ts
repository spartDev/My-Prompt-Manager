/**
 * E2E: Schibsted Grotesk, self-hosted, is the font of the popup, side panel and Analytics page
 * (My-Prompt-Manager-9ax)
 *
 * Each surface computes the font stack on body, loads the one variable woff2 from the extension
 * and makes no request to another host. Captures light/dark screenshots of the popup as visual
 * proof (test-results/typography/).
 */

import type { Page } from '@playwright/test';

import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/typography';
const FONT_STACK = '"Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif';

const SURFACES = [
  { name: 'popup', path: 'src/popup.html' },
  { name: 'side panel', path: 'src/sidepanel.html' },
  { name: 'Analytics page', path: 'src/analytics.html' }
] as const;

const seed = async (storage: ExtensionStorage, theme: 'light' | 'dark') => {
  await seedLibrary(storage, {
    prompts: [createPromptSeed({ id: 'prompt-1', title: 'Résumé', content: 'Résume la transcription ci-dessous.' })],
    settings: { theme }
  });
};

/** Every request the page makes outside the extension itself */
const recordRemoteRequests = (page: Page): string[] => {
  const remote: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('chrome-extension://')) {
      remote.push(request.url());
    }
  });
  return remote;
};

const expectSchibstedGrotesk = async (page: Page) => {
  await expect(page.locator('body')).toHaveCSS('font-family', FONT_STACK);

  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    // check() is also true for a family no @font-face declares, so the loaded faces are read too
    await document.fonts.load('400 16px "Schibsted Grotesk"');
    await document.fonts.load('800 16px "Schibsted Grotesk"');
    const faces = [...document.fonts].filter((face) => face.family.replaceAll('"', '') === 'Schibsted Grotesk');
    return {
      check400: document.fonts.check('400 16px "Schibsted Grotesk"'),
      check800: document.fonts.check('800 16px "Schibsted Grotesk"'),
      statuses: faces.map((face) => face.status),
      weights: faces.map((face) => face.weight)
    };
  });

  expect(fonts.check400).toBe(true);
  expect(fonts.check800).toBe(true);
  expect(fonts.statuses).toEqual(['loaded']);
  expect(fonts.weights).toEqual(['400 900']);
};

test.describe('Typography: Schibsted Grotesk', () => {
  for (const surface of SURFACES) {
    test(`the ${surface.name} renders in the self-hosted Schibsted Grotesk and requests no remote host`, async ({ page, storage, extensionId }) => {
      await seed(storage, 'light');
      const remote = recordRemoteRequests(page);
      const fontResponse = page.waitForResponse((response) => response.url().endsWith('/fonts/SchibstedGrotesk-latin.woff2'));

      await page.goto(`chrome-extension://${extensionId}/${surface.path}`);

      const response = await fontResponse;
      expect(response.url()).toBe(`chrome-extension://${extensionId}/fonts/SchibstedGrotesk-latin.woff2`);
      expect(response.ok()).toBe(true);
      await expectSchibstedGrotesk(page);
      expect(remote).toEqual([]);
    });
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`the popup Library and a Section header render in Schibsted Grotesk (${theme})`, async ({ page, storage, extensionId }) => {
      await seed(storage, theme);
      await page.setViewportSize({ width: 400, height: 600 });
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await expect(page.getByText('Résumé', { exact: true })).toBeVisible();

      await expectSchibstedGrotesk(page);
      // Buttons and fields inherit the body font through Tailwind's preflight
      await expect(page.getByRole('button').first()).toHaveCSS('font-family', FONT_STACK);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/library-${theme}.png` });

      await page.getByTestId('tab-settings').click();
      const title = page.getByRole('banner').getByRole('heading', { level: 1, name: 'Settings', exact: true });
      await expect(title).toHaveCSS('font-family', FONT_STACK);
      await expect(title).toHaveCSS('font-weight', '800');
      await page.getByTestId('section').evaluate(async (element) => { await Promise.all(element.getAnimations().map(async (animation) => animation.finished)); });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/settings-${theme}.png` });
    });
  }
});

/**
 * E2E: the Prompts button sits fully inside a Platform's composer, on the row of its own buttons.
 *
 * Each stand-in copies the layout of the live composer that clipped or pushed the button, read on
 * the live site (its sizes, overflow and rounded edges), and the button is placed by the
 * Platform's anchor chain as on the live site. Screenshots light and dark (test-results/composer-fit/).
 *
 * - Gemini (My-Prompt-Manager-atu, read on 2026-11-17): the field is a grid with `overflow: hidden`
 *   inside a composer with rounded ends; the microphone's container (.mic-button-container) is 3rem
 *   wide, as wide as the microphone. A button put next to the microphone overflowed past the rounded
 *   right edge, which clipped it. The stand-in fixes the width of the wrapper around that container
 *   too; live, the wrapper grows with its content.
 */

import type { BrowserContext, Page } from '@playwright/test';

import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { promptSelector } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/composer-fit';
/** The element the content script places, and the button in it */
const ICON_ROOT = '[data-prompt-library-icon]';
const ICON_BUTTON = '.prompt-library-integrated-icon';
/** Half a CSS pixel of rounding each side */
const TOLERANCE = 1;

type Theme = 'light' | 'dark';

interface ComposerCase {
  platform: string;
  url: string;
  html: (theme: Theme) => string;
  /** The element whose box clips the composer's content */
  composer: string;
  /** The Platform's button the Prompts button must sit next to, on its row */
  neighbour: string;
}

const GEMINI_COLORS = {
  light: { page: '#f0f4f9', composer: '#ffffff', text: '#1f1f1f', border: '#c4c7c5' },
  dark: { page: '#131314', composer: '#1e1f20', text: '#e3e3e3', border: '#444746' },
};

/** Gemini's composer, as it was laid out on the live site on 2026-11-17 */
const geminiComposer = (theme: Theme): string => {
  const colors = GEMINI_COLORS[theme];
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Gemini</title>
    <style>
      body { margin: 0; padding: 48px 32px; background: ${colors.page}; color: ${colors.text}; font-family: sans-serif; }
      input-area-v2 { display: flex; width: 660px; border-radius: 32px; background: ${colors.composer}; border: 1px solid ${colors.border}; }
      fieldset { display: block; width: 100%; border: 0; margin: 0; padding: 0; min-width: 0; }
      .text-input-field {
        display: grid; position: relative; overflow: hidden; padding: 12px; gap: 8px;
        grid-template-areas: "leading-actions text-input trailing-actions";
        grid-template-columns: 36px minmax(0, 1fr) auto;
        align-items: center;
      }
      .leading-actions-wrapper { grid-area: leading-actions; }
      .text-input-main { grid-area: text-input; min-width: 0; }
      rich-textarea { display: block; }
      .ql-editor { min-height: 24px; padding: 8px 0; outline: none; white-space: pre-wrap; }
      .trailing-actions-wrapper { grid-area: trailing-actions; display: flex; align-items: center; }
      .input-buttons-wrapper-bottom, .mic-button-container, speech-dictation-mic-button { display: flex; width: 48px; position: relative; }
      button.platform { height: 32px; min-width: 32px; border: 0; border-radius: 16px; background: transparent; color: inherit; font: inherit; }
      .mic { width: 48px; }
    </style>
  </head>
  <body>
    <input-area-v2>
      <fieldset class="input-area-fieldset">
        <div class="text-input-field">
          <div class="leading-actions-wrapper"><button type="button" class="platform" aria-label="Open the upload menu">+</button></div>
          <div class="text-input-main">
            <rich-textarea><div class="ql-editor" contenteditable="true" role="textbox" data-placeholder="Ask Gemini"></div></rich-textarea>
          </div>
          <div class="trailing-actions-wrapper with-model-picker">
            <div class="model-picker-container"><button type="button" class="platform">Pro</button></div>
            <div class="input-buttons-wrapper-bottom">
              <div class="mic-button-container">
                <speech-dictation-mic-button><button type="button" class="platform mic" aria-label="Microphone">Mic</button></speech-dictation-mic-button>
              </div>
            </div>
          </div>
        </div>
      </fieldset>
    </input-area-v2>
  </body>
</html>`;
};

const CASES: ComposerCase[] = [
  {
    platform: 'gemini',
    url: 'https://gemini.google.com/',
    html: geminiComposer,
    composer: '.text-input-field',
    neighbour: 'speech-dictation-mic-button',
  },
];

const seed = async (storage: ExtensionStorage, theme: Theme): Promise<void> => {
  await seedLibrary(storage, {
    prompts: [
      createPromptSeed({
        id: 'fit-prompt',
        title: 'Fit Prompt',
        content: 'Fitted content.',
        category: DEFAULT_CATEGORY,
      }),
    ],
    settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup', theme },
  });
};

const openComposer = async (context: BrowserContext, url: string, html: string): Promise<Page> => {
  await context.route(`${new URL(url).origin}/**`, async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
    } else {
      await route.abort();
    }
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page;
};

test.describe('The Prompts button fits in the composer', () => {
  for (const { platform, url, html, composer, neighbour } of CASES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`PROOF: on ${platform}, the button sits inside the composer next to its own buttons (${theme})`, async ({
        context,
        storage,
      }) => {
        await seed(storage, theme);
        const page = await openComposer(context, url, html(theme));

        const icon = page.locator(ICON_ROOT);
        await expect(icon).toHaveCount(1);
        await expect(icon).toHaveAttribute('data-mpm-placement', 'toolbar');
        await expect(icon).toHaveAttribute('data-mpm-anchor', '0');

        const button = page.locator(ICON_BUTTON);
        await expect(button).toBeVisible();
        await page.mouse.move(0, 0);

        const composerBox = await page.locator(composer).boundingBox();
        const buttonBox = await button.boundingBox();
        const neighbourBox = await page.locator(neighbour).boundingBox();
        expect(composerBox && buttonBox && neighbourBox).toBeTruthy();
        if (!composerBox || !buttonBox || !neighbourBox) {
          return;
        }

        // Fully inside the box that clips the composer's content
        expect(buttonBox.x).toBeGreaterThanOrEqual(composerBox.x - TOLERANCE);
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(composerBox.x + composerBox.width + TOLERANCE);
        expect(buttonBox.y).toBeGreaterThanOrEqual(composerBox.y - TOLERANCE);
        expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(composerBox.y + composerBox.height + TOLERANCE);
        // Before its neighbour, on the same row
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(neighbourBox.x + TOLERANCE);
        expect(Math.abs(buttonBox.y + buttonBox.height / 2 - (neighbourBox.y + neighbourBox.height / 2))).toBeLessThanOrEqual(2);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${platform}-${theme}.png`,
          clip: { x: 0, y: 0, width: composerBox.x + composerBox.width + 32, height: composerBox.y + composerBox.height + 48 },
          animations: 'disabled',
        });

        // The button placed there is live: it opens the Prompt selector
        await button.click();
        await expect(promptSelector(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(promptSelector(page)).toHaveCount(0);
      });
    }
  }
});

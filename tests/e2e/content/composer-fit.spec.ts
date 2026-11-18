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
 * - Mistral (My-Prompt-Manager-spc, read on 2026-11-17, signed in with an empty draft, signed out
 *   with an empty draft and with text): each button of the action row sits alone in a block <div>. A button put before the voice button, in its <div>,
 *   stacked above it and pushed it below the row.
 * - Microsoft 365 Copilot at copilot.cloud.microsoft (My-Prompt-Manager-14v, read on 2026-11-18,
 *   signed in with a work account and an empty draft): the composer is a grid of three columns,
 *   the "+" (in a block <div> of its own), the field and the actions with the dictation button. A
 *   button put after the "+", in its <div>, went to a second line under it and widened the first
 *   column, which pushed the field right. The case also checks that the field starts where it does
 *   without the button.
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
  /** The field, when the button must leave its start where it is without the button */
  field?: string;
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

const MISTRAL_COLORS = {
  light: { page: '#fbfaf8', composer: '#ffffff', text: '#1f1f1f', border: '#e2e0dc' },
  dark: { page: '#18181b', composer: '#27272a', text: '#f4f4f5', border: '#3f3f46' },
};

/** Mistral's composer, as it was laid out on the live site on 2026-11-17 with an empty draft */
const mistralComposer = (theme: Theme): string => {
  const colors = MISTRAL_COLORS[theme];
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Le Chat</title>
    <style>
      body { margin: 0; padding: 48px 32px; background: ${colors.page}; color: ${colors.text}; font-family: sans-serif; }
      form { width: 736px; }
      .card { display: flex; flex-direction: column; overflow: hidden; padding: 12px; border-radius: 16px; background: ${colors.composer}; border: 1px solid ${colors.border}; }
      .input-row { display: flex; align-items: center; gap: 4px; min-width: 0; }
      .editor-box { flex-grow: 1; min-width: 0; }
      .ProseMirror { min-height: 24px; padding: 4px 0; outline: none; white-space: pre-wrap; }
      .actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      button.platform { display: flex; align-items: center; justify-content: center; height: 32px; min-width: 32px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; }
      button.platform.voice { width: 32px; background: ${colors.text}; color: ${colors.composer}; }
    </style>
  </head>
  <body>
    <form>
      <div class="card">
        <div class="input-row">
          <div><button type="button" class="platform" aria-label="Open settings menu">+</button></div>
          <div class="editor-box"><div class="ProseMirror" contenteditable="true"><p><br></p></div></div>
          <div class="actions">
            <div><button type="button" class="platform" aria-label="Choose model">Fast</button></div>
            <div><button type="button" class="platform voice" aria-label="Voice Mode">V</button></div>
          </div>
        </div>
      </div>
    </form>
  </body>
</html>`;
};

const M365COPILOT_COLORS = {
  light: { page: '#fafafa', composer: '#ffffff', text: '#242424', border: '#d1d1d1' },
  dark: { page: '#1f1f1f', composer: '#292929', text: '#ffffff', border: '#525252' },
};

/** Microsoft 365 Copilot's composer at copilot.cloud.microsoft, as it was laid out on the live site on 2026-11-18 with an empty draft */
const m365copilotComposer = (theme: Theme): string => {
  const colors = M365COPILOT_COLORS[theme];
  return /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Microsoft 365 Copilot</title>
    <style>
      body { margin: 0; padding: 48px 32px; background: ${colors.page}; color: ${colors.text}; font-family: sans-serif; }
      .fai-BebopLiteChatInput { display: flex; flex-direction: column; width: 768px; }
      .fai-BebopLiteChatInput__inputWrapper {
        display: grid; position: relative; padding: 6px 10px; border-radius: 30px; background: ${colors.composer}; border: 1px solid ${colors.border};
        grid-template-areas: "attachments attachments attachments" "contentBefore input actions";
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
      }
      .fai-BebopLiteChatInput__attachments { grid-area: attachments; }
      .fai-EditorInput { grid-area: input; display: grid; padding: 0 8px; }
      [data-lexical-editor] { display: block; min-height: 27px; line-height: 27px; outline: none; white-space: pre-wrap; }
      .fai-BebopLiteChatInput__capabilities { position: absolute; }
      .fai-BebopLiteChatInput__contentBefore { grid-area: contentBefore; display: flex; padding: 6px; }
      .fai-BebopLiteChatInput__actions { grid-area: actions; display: flex; align-items: center; padding: 6px 4px; }
      button.platform { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: 4px; background: transparent; color: inherit; font: inherit; }
    </style>
  </head>
  <body>
    <div class="fai-BebopLiteChatInput">
      <div class="fai-BebopLiteChatInput__inputWrapper">
        <div class="fai-BebopLiteChatInput__attachments"></div>
        <span class="fai-EditorInput"><span data-lexical-editor="true" contenteditable="true" role="textbox" aria-label="Message Copilot"><p><br></p></span></span>
        <div class="fai-BebopLiteChatInput__capabilities"><div></div></div>
        <div class="fai-BebopLiteChatInput__contentBefore">
          <svg width="0" height="0" style="display: none"></svg>
          <div><button type="button" class="platform" data-testid="PlusMenuButton" aria-label="Add and manage sources">+</button></div>
        </div>
        <span class="fai-BebopLiteChatInput__actions"><button type="button" class="platform" aria-label="Start dictation">Mic</button></span>
      </div>
    </div>
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
  {
    platform: 'mistral',
    url: 'https://chat.mistral.ai/chat',
    html: mistralComposer,
    composer: '.card',
    neighbour: 'button[aria-label="Voice Mode"]',
  },
  {
    platform: 'm365copilot',
    url: 'https://copilot.cloud.microsoft/chat',
    html: m365copilotComposer,
    composer: '.fai-BebopLiteChatInput__inputWrapper',
    neighbour: 'button[aria-label="Start dictation"]',
    field: '[data-lexical-editor]',
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
  for (const { platform, url, html, composer, neighbour, field } of CASES) {
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
        if (field) {
          // The field starts where it does without the button: the button does not push it
          const fieldStarts = await page.evaluate(([fieldSelector, iconSelector]) => {
            const fieldElement = document.querySelector(fieldSelector) as HTMLElement;
            const iconElement = document.querySelector(iconSelector) as HTMLElement;
            const withButton = fieldElement.getBoundingClientRect().left;
            iconElement.style.display = 'none';
            const withoutButton = fieldElement.getBoundingClientRect().left;
            iconElement.style.display = '';
            return { withButton, withoutButton };
          }, [field, ICON_ROOT] as const);
          expect(Math.abs(fieldStarts.withButton - fieldStarts.withoutButton)).toBeLessThanOrEqual(TOLERANCE);
        }

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

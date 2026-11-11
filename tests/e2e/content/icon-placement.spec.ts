/**
 * E2E: where the Library icon lands on a Platform, and that it comes back (My-Prompt-Manager-tuh.1)
 *
 * Two stand-ins for claude.ai, served by route interception so the real content script runs on
 * the real hostname:
 * - a composer with Claude's toolbar: the icon lands in the toolbar; when the page replaces the
 *   toolbar node, as a React re-render does while the editor stays, the icon is placed again,
 *   once, and still opens the Prompt selector.
 * - an editor alone, as after a redesign moved the toolbar: the icon is anchored inside the
 *   editor's bottom-end corner, follows the page's scroll, and opens the Prompt selector.
 *   Screenshots light and dark (test-results/icon-placement/).
 *
 * The anchored overlay has two tiers. This Chromium has CSS Anchor Positioning and no switch turns
 * it off any more (the Blink feature shipped and its flag is gone), so the Floating UI tier is
 * proven by src/content/core/__tests__/anchored-overlay.test.ts alone.
 */

import type { BrowserContext, Page } from '@playwright/test';

import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { promptSelector } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/icon-placement';
const PLATFORM_URL = 'https://claude.ai/';
/** The element the content script places: the Prompts button itself */
const ICON_ROOT = '[data-prompt-library-icon]';
const ICON_BUTTON = '.prompt-library-integrated-icon';
const EDITOR = '.ProseMirror';
/** The stand-in's toolbar, marked for the test: the content script finds its anchors by test id */
const TOOLBAR = '[data-e2e="toolbar"]';
/** INSIDE_CORNER_INSET of src/content/core/anchored-overlay.ts: the icon's distance to the editor's edges */
const INSET = 6;
/** Half a CSS pixel of rounding each side */
const TOLERANCE = 2;

type Theme = 'light' | 'dark';

const head = () => /* html */ `
  <head>
    <meta charset="utf-8" />
    <title>Claude</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 32px; background: #faf9f5; color: #1f2933; }
      .dark body { background: #262624; color: #e4e7eb; }
      .composer { width: 560px; margin: 0; padding: 12px; border: 1px solid #cbd2d9; border-radius: 12px; }
      .dark .composer { border-color: #4a4a46; }
      ${EDITOR} { min-height: 96px; padding: 8px; white-space: pre-wrap; outline: none; }
      ${TOOLBAR} { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
      ${TOOLBAR} button { height: 32px; min-width: 32px; border: none; background: transparent; color: inherit; border-radius: 8px; }
      .spacer { height: 1600px; }
    </style>
  </head>`;

/**
 * Claude's composer as its anchor chain knows it (tests/fixtures/composers/claude.html): the
 * editor, then a toolbar with the attach button, the dictation group the icon goes before, and the
 * send button. The toolbar is rendered from a <template>, so a re-render builds a fresh node
 * without the extension's icon, as React does.
 */
const composerWithToolbar = (theme: Theme) => /* html */ `
<!DOCTYPE html>
<html lang="en" class="${theme}">
  ${head()}
  <body>
    <div class="composer">
      <div class="${EDITOR.slice(1)}" contenteditable="true" role="textbox" data-testid="chat-input" aria-label="Write your prompt to Claude"></div>
      <div id="toolbar-slot"></div>
    </div>
    <template id="toolbar">
      <div data-e2e="toolbar">
        <button type="button" data-testid="chat-input-attach" aria-label="Add files, connectors, and more"><svg width="18" height="18" viewBox="0 0 20 20"><path d="M3 3h14v14H3z" fill="currentColor"/></svg></button>
        <div data-testid="composer-dictate"><button type="button" aria-label="Dictate"><svg width="18" height="18" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="currentColor"/></svg></button></div>
        <button type="button" data-testid="chat-input-send" aria-label="Send message"><svg width="18" height="18" viewBox="0 0 20 20"><path d="M10 3l6 14H4z" fill="currentColor"/></svg></button>
      </div>
    </template>
    <script>
      const renderToolbar = () => {
        const template = document.getElementById('toolbar');
        document.getElementById('toolbar-slot').replaceChildren(template.content.cloneNode(true));
      };
      renderToolbar();
      window.rerenderToolbar = renderToolbar;
    </script>
  </body>
</html>`;

/** The editor alone, below a tall page: no toolbar the strategy knows */
const editorAlone = (theme: Theme) => /* html */ `
<!DOCTYPE html>
<html lang="en" class="${theme}">
  ${head()}
  <body>
    <main>
      <fieldset class="composer">
        <div class="${EDITOR.slice(1)}" contenteditable="true" role="textbox" aria-label="Write your prompt to Claude"></div>
      </fieldset>
      <div class="spacer"></div>
    </main>
  </body>
</html>`;

const seed = async (storage: ExtensionStorage): Promise<void> => {
  await seedLibrary(storage, {
    prompts: [
      createPromptSeed({
        id: 'placement-prompt',
        title: 'Placement Prompt',
        content: 'Placed content.',
        category: DEFAULT_CATEGORY,
      }),
    ],
    settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup' },
  });
};

const openPlatform = async (context: BrowserContext, html: string): Promise<Page> => {
  await context.route('https://claude.ai/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
    } else {
      await route.abort();
    }
  });
  const page = await context.newPage();
  await page.goto(PLATFORM_URL, { waitUntil: 'domcontentloaded' });
  return page;
};

/** The icon's box sits inside the editor's box, INSET from its end and bottom edges */
const expectInsideBottomEnd = async (page: Page): Promise<void> => {
  await expect
    .poll(
      async () => {
        const editor = await page.locator(EDITOR).boundingBox();
        const icon = await page.locator(ICON_ROOT).boundingBox();
        if (!editor || !icon) {
          return null;
        }
        return {
          endGap: editor.x + editor.width - (icon.x + icon.width),
          bottomGap: editor.y + editor.height - (icon.y + icon.height),
          inside: icon.x >= editor.x && icon.y >= editor.y,
        };
      },
      { message: 'the icon is anchored inside the editor, bottom-end' },
    )
    .toEqual(
      expect.objectContaining({
        inside: true,
        endGap: expect.closeTo(INSET, 0),
        bottomGap: expect.closeTo(INSET, 0),
      }),
    );
  // closeTo(INSET, 0) is ± 0.5: widen to the rounding tolerance when the first check passes within it
  const editor = await page.locator(EDITOR).boundingBox();
  const icon = await page.locator(ICON_ROOT).boundingBox();
  expect(editor && icon).toBeTruthy();
  if (editor && icon) {
    expect(Math.abs(editor.x + editor.width - (icon.x + icon.width) - INSET)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(editor.y + editor.height - (icon.y + icon.height) - INSET)).toBeLessThanOrEqual(TOLERANCE);
  }
};

const expectSelectorOpens = async (page: Page): Promise<void> => {
  await page.locator(ICON_BUTTON).click();
  const selector = promptSelector(page);
  await expect(selector).toBeVisible();
  await expect(selector.getByRole('option').first()).toContainText('Placement Prompt');
  await page.keyboard.press('Escape');
  await expect(selector).toHaveCount(0);
};

test.describe('Icon placement on a Platform', () => {
  test('the icon lands in the toolbar, and is placed again after the Platform re-renders the toolbar', async ({
    context,
    storage,
  }) => {
    await seed(storage);
    const page = await openPlatform(context, composerWithToolbar('light'));

    const toolbarIcon = page.locator(`${TOOLBAR} ${ICON_ROOT}`);
    await expect(toolbarIcon).toHaveCount(1);
    await expect(toolbarIcon).toHaveAttribute('data-mpm-placement', 'toolbar');
    await expect(page.locator(ICON_ROOT)).toHaveCount(1);

    // The Platform rebuilds its toolbar: the node that held the icon is gone, the editor is the same
    await page.evaluate(() => {
      (window as Window & { rerenderToolbar?: () => void }).rerenderToolbar?.();
    });
    await expect(page.locator(`${TOOLBAR} ${ICON_ROOT}`)).toHaveCount(1);
    await expect(page.locator(ICON_ROOT)).toHaveCount(1);
    await expect(page.locator(`${TOOLBAR} ${ICON_ROOT}`)).toHaveAttribute('data-mpm-placement', 'toolbar');

    // The icon placed again is live: it still opens the Prompt selector
    await expectSelectorOpens(page);

    // And again, a second re-render is handled the same way
    await page.evaluate(() => {
      (window as Window & { rerenderToolbar?: () => void }).rerenderToolbar?.();
    });
    await expect(page.locator(`${TOOLBAR} ${ICON_ROOT}`)).toHaveCount(1);
    await expect(page.locator(ICON_ROOT)).toHaveCount(1);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`PROOF: without a toolbar the icon is anchored inside the editor's bottom-end corner and follows the scroll (${theme})`, async ({
      context,
      storage,
    }) => {
      await seed(storage);
      const page = await openPlatform(context, editorAlone(theme));

      const icon = page.locator(ICON_ROOT);
      await expect(icon).toHaveCount(1);
      await expect(icon).toHaveAttribute('data-mpm-placement', 'overlay');
      await expect(icon).toHaveAttribute('data-positioning-method', 'css-anchor');
      await expectInsideBottomEnd(page);

      // Alone on the editor, the Prompts button is its badge only, in the extension's look (its theme
      // is the extension's, light here, whatever the page's): no border, the accent-subtle pill
      const button = page.locator(ICON_BUTTON);
      await page.mouse.move(0, 0);
      await expect(button).toHaveCSS('border-style', 'none');
      await expect(button).toHaveCSS('background-color', 'rgb(241, 235, 253)');
      await expect(button).toHaveCSS('width', '32px');
      await expect(button).toHaveCSS('height', '32px');
      await expect(button.locator('.prompt-library-pill-label')).toBeHidden();

      const composer = await page.locator('.composer').boundingBox();
      expect(composer).toBeTruthy();
      if (composer) {
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/overlay-${theme}.png`,
          clip: { x: 0, y: 0, width: composer.x + composer.width + 32, height: composer.y + composer.height + 32 },
          animations: 'disabled',
        });
      }

      // The page scrolls: the icon stays on the editor
      await page.mouse.wheel(0, 120);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await expectInsideBottomEnd(page);

      await expectSelectorOpens(page);
    });
  }
});

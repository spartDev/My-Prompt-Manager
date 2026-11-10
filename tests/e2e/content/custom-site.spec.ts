/**
 * E2E: the content script on a custom site (My-Prompt-Manager-aqe)
 *
 * A page that is none of the built-in Platforms is added as a custom site from Settings > Site
 * Integration; the background injects the content script into the open tab, the floating icon
 * appears, and choosing a Prompt in the selector inserts its text Verbatim.
 *
 * Playwright cannot accept Chrome's prompt for an optional host permission, so this spec loads the
 * test-only build of tests/e2e/fixtures/custom-site-build.ts: a copy of dist/ whose manifest lists
 * the test origin in host_permissions, which Chrome grants on load. Everything else runs as built.
 *
 * Also takes, light and dark, the custom-site screenshots el4.7 never took (test-results/custom-site/):
 * the selector with a keyboard-selected Prompt, the Variable form, the icon at rest, on hover and
 * with its focus ring.
 */

import type { BrowserContext, Page } from '@playwright/test';

import type { CustomSite } from '../../../src/types';
import { DEFAULT_CATEGORY } from '../../../src/types';
import { CUSTOM_SITE_EXTENSION_PATH, CUSTOM_SITE_HOSTNAME, CUSTOM_SITE_URL } from '../fixtures/custom-site-build';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { promptSelector } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

test.use({ extensionPath: CUSTOM_SITE_EXTENSION_PATH });

const SCREENSHOT_DIR = 'test-results/custom-site';
const ICON = '.prompt-library-icon-base';
// The page's heading, input and floating icon: the icon is 32px, too small to judge on the whole page
const ICON_AREA = { x: 0, y: 0, width: 800, height: 300 };

// The hover background and focus ring el4.7 gave the floating icon (src/content/utils/styles.ts)
// The Prompts button follows the extension's theme, like the Prompt selector it opens
const PILL = {
  light: { rest: 'rgb(241, 235, 253)', text: 'rgb(91, 33, 182)', hover: 'rgb(237, 229, 255)', accent: 'rgb(109, 40, 217)' },
  dark: { rest: 'rgb(47, 35, 80)', text: 'rgb(196, 181, 253)', hover: 'rgb(56, 41, 106)', accent: 'rgb(132, 75, 242)' },
};

// The dark screenshots are of a dark page, with the extension's theme set to dark
const pageBody = (theme: 'light' | 'dark') => /* html */ `
<!DOCTYPE html>
<html lang="en" class="${theme}">
  <head>
    <meta charset="utf-8" />
    <title>Team notes</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 32px; background: #f6f7f9; color: #1f2933; }
      .dark body { background: #16181d; color: #e4e7eb; }
      .dark textarea { background: #1f2329; color: #e4e7eb; border-color: #3e4c59; }
      main { max-width: 640px; }
      textarea { display: block; width: 100%; box-sizing: border-box; min-height: 140px; padding: 12px; font: inherit; border: 1px solid #cbd2d9; border-radius: 8px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Team notes</h1>
      <label for="notes">Message</label>
      <textarea id="notes"></textarea>
    </main>
  </body>
</html>
`;

// Verbatim: markup, entities, quotes, indentation, trailing spaces and blank lines stay as stored
const verbatim = createPromptSeed({
  id: 'verbatim',
  title: 'Release checklist',
  content: '<b>Ship</b> & "verify" the build:\n  1. tag v2.0\n  2. run `npm test`  \n\nDone <script>alert(1)</script>',
  category: DEFAULT_CATEGORY,
  createdAt: Date.now() - 120_000,
});

const translate = createPromptSeed({
  id: 'translate',
  title: 'Translate a text',
  content: 'Translate {{text}} into {{language}}.',
  category: DEFAULT_CATEGORY,
  createdAt: Date.now() - 60_000,
});

const summarize = createPromptSeed({
  id: 'summarize',
  title: 'Summarize the thread',
  content: 'Summarize the thread so far in five bullet points.',
  category: DEFAULT_CATEGORY,
  createdAt: Date.now(),
});

const customSite: CustomSite = {
  hostname: CUSTOM_SITE_HOSTNAME,
  displayName: 'Team notes',
  enabled: true,
  dateAdded: 1_760_000_000_000,
};

const openCustomSite = async (context: BrowserContext, theme: 'light' | 'dark' = 'light'): Promise<Page> => {
  await context.route(`${CUSTOM_SITE_URL}**`, async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: pageBody(theme) });
    } else {
      await route.abort();
    }
  });
  const target = await context.newPage();
  await target.setViewportSize({ width: 800, height: 760 });
  await target.goto(CUSTOM_SITE_URL);
  return target;
};

const seedWithCustomSite = async (storage: ExtensionStorage, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts: [verbatim, translate, summarize], settings: { theme } });
  await storage.seed({ promptLibrarySettings: { enabledSites: [], customSites: [customSite] } });
};

test.describe('Content script on a custom site', () => {
  test('a page added as a custom site in Settings gets the floating icon, and a chosen Prompt is inserted Verbatim', async ({
    context,
    storage,
    extensionId,
  }) => {
    await seedLibrary(storage, { prompts: [verbatim, translate, summarize] });

    // The page is open before it is a custom site: no content script yet
    const target = await openCustomSite(context);
    await expect(target.locator('#notes')).toBeVisible();
    await expect(target.locator(ICON)).toHaveCount(0);

    // Settings > AI sites > Add a custom site > Manual Configuration
    const settings = await context.newPage();
    await settings.setViewportSize({ width: 400, height: 600 });
    await settings.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await settings.getByTestId('tab-settings').click();
    const section = settings.getByRole('region', { name: 'AI sites' });
    await section.getByRole('button', { name: /Add a custom site/ }).click();
    await section.getByRole('button', { name: /Manual Configuration/ }).click();
    await section.getByLabel('Website URL *').fill(CUSTOM_SITE_HOSTNAME);
    await section.getByRole('button', { name: 'Add Site', exact: true }).click();
    await expect(section.getByText(CUSTOM_SITE_HOSTNAME).first()).toBeVisible();

    const stored = await storage.get<{ promptLibrarySettings?: { customSites?: CustomSite[] } }>('promptLibrarySettings');
    expect(stored.promptLibrarySettings?.customSites?.map((site) => [site.hostname, site.enabled])).toEqual([[CUSTOM_SITE_HOSTNAME, true]]);

    // Adding it injects the content script into the open tab
    await target.bringToFront();
    const icon = target.locator(ICON);
    await expect(icon).toHaveCount(1);
    await expect(icon).toBeVisible();

    await icon.click();
    const selector = promptSelector(target);
    await expect(selector).toBeVisible();
    await selector.getByRole('option').filter({ hasText: 'Release checklist' }).click();

    await expect(selector).toHaveCount(0);
    await expect(target.locator('#notes')).toHaveValue(verbatim.content);
  });

  for (const theme of ['light', 'dark'] as const) {
    // My-Prompt-Manager-nvr: the button must not keep Chrome's default button look (grey background,
    // bevelled border) on a page with no button styles of its own. Since My-Prompt-Manager-q9j it is the
    // Prompts button: laid over the page, where its place was chosen for a 32px button, it is its badge alone
    test(`PROOF: the Prompts button has no default button look, and keeps its hover background and focus ring (${theme})`, async ({
      context,
      storage,
    }) => {
      await seedWithCustomSite(storage, theme);
      const target = await openCustomSite(context, theme);

      const icon = target.locator(ICON);
      await expect(icon).toBeVisible();
      await expect(icon).toHaveClass(theme === 'dark' ? /dark-theme/ : /^(?!.*dark-theme)/);
      await target.mouse.move(0, 0);

      // At rest: the accent-subtle pill, no border, the badge alone
      await expect(icon).toHaveCSS('background-color', PILL[theme].rest);
      await expect(icon).toHaveCSS('color', PILL[theme].text);
      await expect(icon).toHaveCSS('border-style', 'none');
      await expect(icon).toHaveCSS('border-width', '0px');
      await expect(icon).toHaveCSS('height', '32px');
      await expect(icon).toHaveCSS('width', '32px');
      await expect(icon.locator('.prompt-library-pill-label')).toBeHidden();
      await expect(icon).toHaveAccessibleName(/^Prompts/);
      await target.screenshot({ path: `${SCREENSHOT_DIR}/icon-rest-${theme}.png`, clip: ICON_AREA, animations: 'disabled' });

      await icon.hover();
      await expect(icon).toHaveCSS('background-color', PILL[theme].hover);
      await expect(icon).toHaveCSS('border-style', 'none');
      await target.screenshot({ path: `${SCREENSHOT_DIR}/icon-hover-${theme}.png`, clip: ICON_AREA, animations: 'disabled' });

      // Keyboard focus, so :focus-visible draws the ring
      await target.mouse.move(0, 0);
      await target.locator('#notes').focus();
      await target.keyboard.press('Tab');
      await expect(icon).toBeFocused();
      await expect(icon).toHaveCSS('outline', `${PILL[theme].accent} solid 2px`);
      await expect(icon).toHaveCSS('background-color', PILL[theme].rest);
      await target.screenshot({ path: `${SCREENSHOT_DIR}/icon-focus-${theme}.png`, clip: ICON_AREA, animations: 'disabled' });
    });

    test(`PROOF: selector with a keyboard-selected Prompt, Variable form (${theme})`, async ({ context, storage }) => {
      await seedWithCustomSite(storage, theme);
      const target = await openCustomSite(context, theme);

      const icon = target.locator(ICON);
      await expect(icon).toBeVisible();

      await target.locator('#notes').focus();
      await target.keyboard.press('Tab');
      await expect(icon).toBeFocused();
      await target.keyboard.press('Enter');
      const selector = promptSelector(target);
      await expect(selector).toBeVisible();
      await expect(target.locator('#mpm-prompt-selector')).toHaveAttribute('data-theme', theme);
      await target.keyboard.press('ArrowDown');
      await expect(selector.getByRole('option', { selected: true })).toHaveCount(1);
      await target.screenshot({ path: `${SCREENSHOT_DIR}/selector-keyboard-${theme}.png`, animations: 'disabled' });

      await selector.getByRole('option').filter({ hasText: 'Translate a text' }).click();
      const text = selector.getByRole('textbox', { name: 'text', exact: true });
      await expect(text).toBeFocused();
      await text.fill('the release notes');
      await target.screenshot({ path: `${SCREENSHOT_DIR}/variable-form-${theme}.png`, animations: 'disabled' });

      await selector.getByRole('textbox', { name: 'language', exact: true }).fill('French');
      await selector.getByRole('textbox', { name: 'language', exact: true }).press('Enter');
      await expect(target.locator('#notes')).toHaveValue('Translate the release notes into French.');
    });
  }
});

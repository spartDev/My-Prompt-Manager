/**
 * E2E: a user repairs the icon placement of a Platform whose toolbar changed (My-Prompt-Manager-tuh.3,
 * design §6), in the real extension: content script, service worker and Settings.
 *
 * A stand-in for claude.ai, served by route interception, renders Claude's toolbar with its test
 * ids renamed, as a redesign would: the anchor chain finds nothing and the icon falls to the
 * Anchored overlay. The Claude row in Settings then says so and offers Place the icon, which opens
 * the Element picker on the Claude tab; a click on the send button stores it as Claude's override
 * and the icon moves before it. When the page renders the toolbar with the test ids the chain
 * knows (a release fixed the chain), the icon goes back to its anchor and the override is dropped.
 * Screenshots of the Settings row light and dark (test-results/icon-placement-repair/).
 */

import type { BrowserContext, Locator, Page } from '@playwright/test';

import type { IconPlacementRepairs } from '../../../src/services/iconPlacementRepairs';
import { DEFAULT_SETTINGS } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/icon-placement-repair';
const ICON_ROOT = '[data-prompt-library-icon]';
const SEND = '[data-e2e="send"]';

const EXPECTED = {
  light: { warningSubtle: 'rgb(254, 243, 199)', warningBorder: 'rgb(245, 223, 166)', warningText: 'rgb(146, 64, 14)', card: 'rgb(255, 255, 255)', secondary: 'rgb(92, 83, 112)' },
  dark: { warningSubtle: 'rgb(51, 39, 15)', warningBorder: 'rgb(90, 69, 21)', warningText: 'rgb(252, 211, 77)', card: 'rgb(35, 28, 52)', secondary: 'rgb(188, 179, 208)' }
} as const;

/**
 * Claude's composer (tests/fixtures/composers/claude.html), its toolbar rendered from a template
 * with a prefix on the test ids the chain anchors on: 'renamed-' is the redesign, '' the original.
 */
const claudePage = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Claude</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 32px; background: #faf9f5; }
      .composer { width: 560px; padding: 12px; border: 1px solid #cbd2d9; border-radius: 12px; }
      .ProseMirror { min-height: 96px; padding: 8px; outline: none; }
      .toolbar { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
      .toolbar button { height: 32px; min-width: 32px; border: none; background: #ece9e1; border-radius: 8px; }
    </style>
  </head>
  <body>
    <div class="composer">
      <div class="ProseMirror" contenteditable="true" role="textbox" data-testid="chat-input" aria-label="Write your prompt to Claude"></div>
      <div id="toolbar-slot"></div>
    </div>
    <script>
      window.renderToolbar = (prefix) => {
        document.getElementById('toolbar-slot').innerHTML =
          '<div class="toolbar">' +
          '<button type="button" data-testid="' + prefix + 'chat-input-attach" aria-label="Add files"></button>' +
          '<div data-testid="' + prefix + 'composer-dictate"><button type="button" aria-label="Dictate"></button></div>' +
          '<button type="button" data-e2e="send" data-testid="chat-input-send" aria-label="Send message">' +
          '<svg width="18" height="18" viewBox="0 0 20 20"><path d="M10 3l6 14H4z" fill="currentColor"/></svg></button>' +
          '</div>';
      };
      // ?original: a tab on the variant of the UI the chain knows
      window.renderToolbar(new URLSearchParams(location.search).has('original') ? '' : 'renamed-');
    </script>
  </body>
</html>`;

const openClaude = async (context: BrowserContext, url = 'https://claude.ai/new'): Promise<Page> => {
  await context.route('https://claude.ai/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: claudePage });
    } else {
      await route.abort();
    }
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page;
};

const repairsOf = async (storage: ExtensionStorage): Promise<IconPlacementRepairs> =>
  (await storage.get<{ iconPlacementRepairs?: IconPlacementRepairs }>('iconPlacementRepairs')).iconPlacementRepairs ?? {};

const claudeRow = (settings: Page): Locator =>
  settings.getByTestId('site-row').filter({ has: settings.getByRole('switch', { name: 'Claude', exact: true }) });

const screenshotRow = async (row: Locator, name: string): Promise<void> => {
  await row.scrollIntoViewIfNeeded();
  await row.page().mouse.move(0, 0);
  // The button clicked keeps the focus, and its ring, once the window has the focus back
  await row.page().evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); });
  await row.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, animations: 'disabled' });
};

test.describe('Repairing the icon placement of a Platform from Settings', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`PROOF: the toolbar changed, the row offers Place the icon, the pick places it, and the fixed chain drops the pick (${theme})`, async ({
      context,
      storage,
      extensionId
    }) => {
      await seedLibrary(storage, { settings: { ...DEFAULT_SETTINGS, theme, interfaceMode: 'popup' } });
      await storage.seed({ promptLibrarySettings: { enabledSites: ['claude.ai'], customSites: [] } });

      // 1. The redesign: no anchor of the chain is found, the icon is on the Anchored overlay
      const claude = await openClaude(context);
      const icon = claude.locator(ICON_ROOT);
      await expect(icon).toHaveAttribute('data-mpm-placement', 'overlay');
      await expect.poll(() => repairsOf(storage)).toEqual({ 'claude.ai': { status: 'overlay' } });

      // 2. Settings says so on the Claude row
      const settings = await context.newPage();
      await settings.setViewportSize({ width: 400, height: 600 });
      await settings.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await settings.getByTestId('tab-settings').click();
      const row = claudeRow(settings);
      const notice = row.getByTestId('site-placement');
      await expect(notice).toHaveAttribute('data-status', 'overlay');
      await expect(notice).toContainText("Claude's toolbar changed: the icon sits in the corner of the input field.");
      const banner = notice.locator('> div');
      await expect(banner).toHaveCSS('background-color', colors.warningSubtle);
      await expect(banner).toHaveCSS('border-top-color', colors.warningBorder);
      await expect(notice.locator('p')).toHaveCSS('color', colors.warningText);
      const place = row.getByRole('button', { name: 'Place the icon' });
      await expect(place).toHaveCSS('background-color', colors.card);
      await expect(place).toHaveCSS('color', colors.secondary);
      await expect(place).toHaveCSS('height', '34px');
      await screenshotRow(row, `row-overlay-${theme}`);

      // 3. Place the icon: the picker opens on the Claude tab; the user clicks the send button's icon
      await place.click();
      await claude.bringToFront();
      const sendBox = await claude.locator(SEND).boundingBox();
      expect(sendBox).toBeTruthy();
      if (!sendBox) {
        return;
      }
      await expect(claude.locator('#mpm-element-picker-overlay')).toHaveCount(1);
      // The picker highlights what is under the pointer, then takes it on click
      await claude.mouse.move(sendBox.x + sendBox.width / 2, sendBox.y + sendBox.height / 2);
      await claude.mouse.click(sendBox.x + sendBox.width / 2, sendBox.y + sendBox.height / 2);

      // The service worker stores the pick; the icon moves before the send button, in the toolbar
      await expect(icon).toHaveAttribute('data-mpm-placement', 'override');
      await expect.poll(() => claude.locator(ICON_ROOT).evaluate((element) => element.nextElementSibling?.getAttribute('data-e2e'))).toBe('send');
      await expect.poll(async () => (await repairsOf(storage))['claude.ai']?.status).toBe('override');
      expect((await repairsOf(storage))['claude.ai']?.override).toMatchObject({ mode: 'custom', placement: 'before' });
      await claude.screenshot({ path: `${SCREENSHOT_DIR}/claude-override-${theme}.png`, clip: { x: 0, y: 0, width: 640, height: 240 } });

      // The row follows: the icon sits where the user placed it
      await settings.bringToFront();
      await expect(notice).toHaveAttribute('data-status', 'override');
      await expect(notice).toContainText('The icon sits where you placed it');
      await expect(row.getByRole('button', { name: 'Place again' })).toBeVisible();
      await screenshotRow(row, `row-override-${theme}`);

      // 4. A release fixed the chain: the toolbar renders with the test ids it knows
      await claude.evaluate(() => { (window as Window & { renderToolbar?: (prefix: string) => void }).renderToolbar?.(''); });
      await expect(icon).toHaveAttribute('data-mpm-placement', 'toolbar');
      await expect(icon).toHaveAttribute('data-mpm-anchor', '0');
      await expect.poll(() => repairsOf(storage)).toEqual({});
      await expect(notice).toHaveCount(0);
    });
  }

  test('a pick holds while another tab of the Platform shows the toolbar the chain knows', async ({ context, storage, extensionId }) => {
    await seedLibrary(storage, { settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup' } });
    await storage.seed({ promptLibrarySettings: { enabledSites: ['claude.ai'], customSites: [] } });

    // A tab still on the variant of the UI the chain knows, then one where the toolbar changed. The
    // latter is the first tab of the window, the one Place the icon picks in when none is in front.
    const claude = await context.newPage();
    const other = await openClaude(context, 'https://claude.ai/new?original');
    await expect(other.locator(ICON_ROOT)).toHaveAttribute('data-mpm-placement', 'toolbar');
    await claude.goto('https://claude.ai/new', { waitUntil: 'domcontentloaded' });
    const icon = claude.locator(ICON_ROOT);
    await expect(icon).toHaveAttribute('data-mpm-placement', 'overlay');
    await expect.poll(() => repairsOf(storage)).toEqual({ 'claude.ai': { status: 'overlay' } });

    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${extensionId}/src/popup.html`);
    await settings.getByTestId('tab-settings').click();
    await claudeRow(settings).getByRole('button', { name: 'Place the icon' }).click();
    await claude.bringToFront();
    await expect(claude.locator('#mpm-element-picker-overlay')).toHaveCount(1);
    const sendBox = await claude.locator(SEND).boundingBox();
    expect(sendBox).toBeTruthy();
    if (!sendBox) {
      return;
    }
    await claude.mouse.move(sendBox.x + sendBox.width / 2, sendBox.y + sendBox.height / 2);
    await claude.mouse.click(sendBox.x + sendBox.width / 2, sendBox.y + sendBox.height / 2);

    // The pick is placed and kept: the other tab, whose icon is in its toolbar, does not drop it
    await expect(icon).toHaveAttribute('data-mpm-placement', 'override');
    await expect.poll(async () => (await repairsOf(storage))['claude.ai']?.status).toBe('override');
    await claude.waitForTimeout(500);
    expect((await repairsOf(storage))['claude.ai']).toMatchObject({ status: 'override', override: { mode: 'custom', placement: 'before' } });
    await expect(other.locator(ICON_ROOT)).toHaveAttribute('data-mpm-placement', 'toolbar');

    // The other tab re-renders its toolbar, once then twice: each time it places the icon in its
    // toolbar again and tells the service worker so, which keeps the pick the first tab needs
    for (const placement of [1, 2]) {
      const before = await other.locator(ICON_ROOT).elementHandle();
      await other.evaluate(() => { (window as Window & { renderToolbar?: (prefix: string) => void }).renderToolbar?.(''); });
      await expect.poll(() => before?.evaluate((element) => element.isConnected), { message: `placement ${placement} of the other tab` }).toBe(false);
      await expect(other.locator(ICON_ROOT)).toHaveAttribute('data-mpm-placement', 'toolbar');
      await claude.waitForTimeout(500);
      expect((await repairsOf(storage))['claude.ai']).toMatchObject({ status: 'override', override: { mode: 'custom', placement: 'before' } });
      await expect(icon).toHaveAttribute('data-mpm-placement', 'override');
    }

    await settings.bringToFront();
    await expect(claudeRow(settings).getByTestId('site-placement')).toHaveAttribute('data-status', 'override');
    await expect(claudeRow(settings).getByRole('button', { name: 'Place again' })).toBeVisible();
  });
});

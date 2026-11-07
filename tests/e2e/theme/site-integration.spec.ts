/**
 * E2E: the AI sites group of Settings on the color tokens (My-Prompt-Manager-el4.5.3, My-Prompt-Manager-7kd)
 *
 * One row per site in one card: logo, name, domain and switch. A site switched off keeps its logo, greyed
 * and dimmed. Custom sites follow the Platforms, with Export and Remove in a ⋯ menu; the last row adds one.
 * Also captures light/dark screenshots as visual proof (test-results/site-integration/).
 */

import type { Locator, Page } from '@playwright/test';

import type { CustomSite } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/site-integration';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const ERROR_BORDER = 'rgb(220, 38, 38)';

const EXPECTED = {
  light: {
    app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', border: 'rgb(236, 230, 245)', divider: 'rgb(240, 235, 248)', muted: 'rgb(241, 237, 248)',
    primary: 'rgb(29, 21, 48)', secondary: 'rgb(92, 83, 112)', tertiary: 'rgb(111, 103, 135)', success: 'rgb(6, 95, 70)',
    accentSubtle: 'rgb(241, 235, 253)', accentText: 'rgb(91, 33, 182)', dangerText: 'rgb(153, 27, 27)',
    raised: 'rgb(248, 246, 252)', strong: 'rgb(220, 212, 234)', faint: 'rgb(181, 173, 200)', accent: 'rgb(109, 40, 217)',
    subtle: 'rgb(244, 241, 250)', input: 'rgb(143, 135, 165)', dangerSubtle: 'rgb(253, 236, 236)', dangerBorder: 'rgb(246, 207, 207)',
    backdrop: 'rgba(42, 33, 64, 0.45)'
  },
  dark: {
    app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', border: 'rgb(53, 44, 76)', divider: 'rgb(47, 39, 68)', muted: 'rgb(46, 38, 69)',
    primary: 'rgb(241, 237, 249)', secondary: 'rgb(188, 179, 208)', tertiary: 'rgb(163, 154, 187)', success: 'rgb(110, 231, 183)',
    accentSubtle: 'rgb(47, 35, 80)', accentText: 'rgb(196, 181, 253)', dangerText: 'rgb(252, 165, 165)',
    raised: 'rgb(27, 21, 40)', strong: 'rgb(65, 55, 90)', faint: 'rgb(125, 116, 149)', accent: 'rgb(132, 75, 242)',
    subtle: 'rgb(43, 35, 64)', input: 'rgb(118, 108, 142)', dangerSubtle: 'rgb(58, 21, 24)', dangerBorder: 'rgb(94, 34, 40)',
    backdrop: 'rgba(7, 5, 12, 0.7)'
  }
} as const;

const customSites: CustomSite[] = [
  {
    hostname: 'notion.so',
    displayName: 'Notion',
    enabled: true,
    dateAdded: 1_760_000_000_000,
    positioning: { mode: 'custom', selector: '#composer', placement: 'after', offset: { x: 4, y: 0 }, zIndex: 1000, description: 'Next to the send button' }
  },
  { hostname: 'wiki.example.com', displayName: 'Wiki interne', enabled: false, dateAdded: 1_760_000_100_000 }
];

interface SiteSettings {
  enabledSites?: string[];
  customSites?: CustomSite[];
}

/** The popup is 400 x 500; the side panel is at least 320 px wide (docs/DESIGN_GUIDELINES.md) */
const SURFACES = {
  popup: { width: 400, height: 500 },
  sidepanel: { width: 320, height: 700 }
} as const;

const openSiteIntegration = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  theme: 'light' | 'dark',
  sites: SiteSettings = {},
  surface: keyof typeof SURFACES = 'popup'
) => {
  await seedLibrary(storage, { settings: { theme } });
  await storage.seed({ promptLibrarySettings: { enabledSites: sites.enabledSites ?? ['chatgpt.com'], customSites: sites.customSites ?? [] } });
  await page.setViewportSize(SURFACES[surface]);
  await page.goto(`chrome-extension://${extensionId}/src/${surface}.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
  await page.getByTestId('tab-settings').click();
  const section = page.getByRole('region', { name: 'AI sites' });
  await expect(section).toBeVisible();
  return section;
};

const openAddMethod = async (section: Locator, method: 'Manual Configuration' | 'Import Configuration') => {
  await section.getByRole('button', { name: /Add a custom site/ }).click();
  // The chooser opens under the mouse: move it off, or the first option shows its hover
  await section.page().mouse.move(0, 0);
  return section.getByRole('button', { name: new RegExp(method) });
};

const siteRow = (section: Locator, name: string) => section.getByTestId('site-row').filter({ has: section.page().getByRole('switch', { name, exact: true }) });

/** Fails when part of the element sticks out of the card, where the card's edge or the viewport clips it */
const expectInside = async (element: Locator, card: Locator) => {
  const [inner, outer] = await Promise.all([element.boundingBox(), card.boundingBox()]);
  expect(inner, 'element box').not.toBeNull();
  expect(outer, 'card box').not.toBeNull();
  if (!inner || !outer) {return;}
  expect(inner.x, 'left edge').toBeGreaterThanOrEqual(outer.x);
  expect(inner.x + inner.width, 'right edge').toBeLessThanOrEqual(outer.x + outer.width);
};

/** The color painted behind an element: its own background, else the first opaque one above it */
const backdropOf = (locator: Locator) =>
  locator.evaluate((element, transparent) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      if (color !== transparent) {return color;}
    }
    return transparent;
  }, TRANSPARENT);

test.describe('Site integration Settings on the tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`the Platforms are rows of one card on bg-app, one switched off shows its logo greyed and dimmed (${theme})`, async ({ page, storage, extensionId }) => {
      const section = await openSiteIntegration(page, storage, extensionId, theme);

      await expect(section.getByRole('heading', { level: 2, name: 'AI sites' })).toHaveCSS('color', colors.secondary);
      const card = section.locator('> div').first();
      await expect(card).toHaveCSS('background-color', colors.card);
      await expect(card).toHaveCSS('border-top-color', colors.border);
      expect(await backdropOf(card.locator('..'))).toBe(colors.app);
      await expect(section.getByTestId('site-row')).toHaveCount(6);
      // In the order of Atelier 1C, Copilot showing the M365 domain its switch also turns on
      await expect(section.getByTestId('site-row').locator('span[id]')).toHaveText(['Claude', 'ChatGPT', 'Google Gemini', 'Mistral AI', 'Perplexity', 'Microsoft Copilot']);
      await expect(section.getByText('copilot.microsoft.com · m365.cloud.microsoft')).toBeVisible();

      const chatgpt = siteRow(section, 'ChatGPT');
      await expect(chatgpt.getByText('chatgpt.com', { exact: true })).toHaveCSS('color', colors.tertiary);
      await expect(chatgpt.getByRole('switch')).toHaveCSS('background-color', colors.accent);
      await expect(chatgpt.getByTestId('site-logo')).toHaveCSS('opacity', '1');
      await expect(chatgpt.getByTestId('site-logo')).toHaveCSS('width', '30px');

      const claude = siteRow(section, 'Claude');
      await expect(claude.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
      await expect(claude.getByRole('switch')).toHaveCSS('background-color', colors.input);
      const logo = claude.getByTestId('site-logo');
      await expect(logo).toHaveCSS('filter', 'grayscale(1)');
      await expect(logo).toHaveCSS('opacity', '0.5');

      await claude.getByRole('switch').click();
      await expect(logo).toHaveCSS('opacity', '1');
      await expect.poll(async () => ((await storage.get<{ promptLibrarySettings?: { enabledSites?: string[] } }>('promptLibrarySettings')).promptLibrarySettings?.enabledSites ?? []).includes('claude.ai')).toBe(true);

      await card.evaluate(element => { element.scrollIntoView({ block: 'start' }); });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/site-list-${theme}.png` });
    });

    test(`a custom site is a row after the Platforms, with Export and Remove in its menu, and the last row adds one (${theme})`, async ({ page, storage, extensionId }) => {
      const section = await openSiteIntegration(page, storage, extensionId, theme, { customSites });

      const notion = siteRow(section, 'Notion');
      await expect(notion.getByText('notion.so', { exact: true })).toHaveCSS('color', colors.tertiary);
      await expect(notion.getByTestId('site-logo')).toHaveCSS('background-color', colors.accentSubtle);
      await expect(notion.getByTestId('site-logo')).toHaveCSS('color', colors.accentText);
      await expect(siteRow(section, 'Wiki interne').getByTestId('site-logo')).toHaveCSS('opacity', '0.5');

      const addSite = section.getByRole('button', { name: /Add a custom site/ });
      await expect(addSite).toHaveCSS('color', colors.accentText);
      await expect(addSite).toBeEnabled();

      await notion.getByRole('button', { name: 'More actions for Notion' }).click();
      await expect(page.getByRole('menuitem', { name: 'Export configuration' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Remove' })).toHaveCSS('color', colors.dangerText);
      await addSite.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/custom-sites-${theme}.png` });

      await page.getByRole('menuitem', { name: 'Remove' }).click();
      await expect(siteRow(section, 'Notion')).toHaveCount(0);
      await expect.poll(async () => ((await storage.get<{ promptLibrarySettings?: { customSites?: CustomSite[] } }>('promptLibrarySettings')).promptLibrarySettings?.customSites ?? []).map(site => site.hostname)).toEqual(['wiki.example.com']);
    });

    test(`Add a custom site is turned off, and says why, while the current site is already integrated (${theme})`, async ({ page, storage, extensionId }) => {
      // The active tab is this popup page: a custom site on its hostname makes the current site integrated
      const section = await openSiteIntegration(page, storage, extensionId, theme, {
        customSites: [{ hostname: extensionId, displayName: 'Popup', enabled: true, dateAdded: 1_760_000_000_000 }]
      });

      const addSite = section.getByRole('button', { name: /Add a custom site/ });
      await expect(addSite).toBeDisabled();
      await expect(addSite).toHaveCSS('color', colors.tertiary);
      await expect(addSite.getByText(`Current site (${extensionId}) is already integrated`)).toBeVisible();
    });

    test(`adding a site goes through a dashed chooser to a form of cards with fields on bg-subtle and an error in danger (${theme})`, async ({ page, storage, extensionId }) => {
      const section = await openSiteIntegration(page, storage, extensionId, theme);
      const manual = await openAddMethod(section, 'Manual Configuration');

      const chooser = section.getByText('Choose a method to continue').locator('..');
      await expect(chooser).toHaveCSS('background-color', colors.raised);
      await expect(chooser).toHaveCSS('border-top-color', colors.strong);
      await expect(manual).toHaveCSS('background-color', colors.card);
      await expect(manual).toHaveCSS('border-top-color', colors.border);
      await expect(manual.locator('span').first()).toHaveCSS('background-color', colors.accentSubtle);
      await expect(manual.locator('span').first()).toHaveCSS('color', colors.accentText);
      await expect(section.getByRole('button', { name: 'Cancel' })).toHaveCSS('color', colors.secondary);
      await chooser.evaluate(panel => { panel.scrollIntoView({ block: 'center' }); });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/add-method-${theme}.png` });

      await manual.click();
      const form = section.getByText('Configure your custom site integration').locator('../..');
      await expect(form).toHaveCSS('background-color', colors.raised);
      await expect(form).toHaveCSS('border-top-color', colors.strong);
      const basics = section.getByRole('heading', { name: 'Basic Information' });
      await expect(basics).toHaveCSS('color', colors.secondary);
      await expect(basics.locator('..')).toHaveCSS('background-color', colors.card);
      await expect(basics.locator('..')).toHaveCSS('border-top-color', colors.border);

      const url = section.getByLabel('Website URL *');
      await expect(url).toHaveCSS('background-color', colors.subtle);
      await expect(url).toHaveCSS('border-top-color', colors.input);
      await expect(url).toHaveCSS('color', colors.primary);
      await expect(section.getByText('Website URL *')).toHaveCSS('color', colors.secondary);

      const pick = section.getByRole('button', { name: 'Pick Element' });
      await expect(pick).toHaveCSS('background-color', colors.card);
      await expect(pick).toHaveCSS('border-top-color', colors.strong);
      await expect(pick).toHaveCSS('color', colors.secondary);
      await expect(section.getByRole('button', { name: 'Add Site' })).toHaveCSS('background-color', colors.accent);

      await url.fill('chatgpt.com');
      await section.getByRole('button', { name: 'Add Site' }).click();
      await expect(section.getByText('This site is already added')).toHaveCSS('color', colors.dangerText);
      await expect(url).toHaveCSS('border-top-color', ERROR_BORDER);

      await form.evaluate(panel => { panel.scrollIntoView({ block: 'start' }); });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/add-site-form-${theme}.png` });
    });

    test(`the import drawer is a dashed panel with the code field on a card, and a bad code shows a danger box (${theme})`, async ({ page, storage, extensionId }) => {
      const section = await openSiteIntegration(page, storage, extensionId, theme);
      await (await openAddMethod(section, 'Import Configuration')).click();

      const drawer = page.locator('#custom-site-import-drawer');
      await expect(drawer).toHaveCSS('background-color', colors.raised);
      await expect(drawer).toHaveCSS('border-top-style', 'dashed');
      await expect(drawer).toHaveCSS('border-top-color', colors.strong);
      await expect(drawer.getByRole('heading', { name: 'Import Configuration' })).toHaveCSS('color', colors.primary);
      await expect(drawer.getByText('Reuse an existing setup by pasting a configuration code')).toHaveCSS('color', colors.tertiary);

      const codeCard = drawer.getByRole('heading', { name: 'Configuration Code' }).locator('../..');
      await expect(codeCard).toHaveCSS('background-color', colors.card);
      await expect(codeCard).toHaveCSS('border-top-color', colors.border);
      const code = drawer.getByLabel('Encoded configuration string');
      await expect(code).toHaveCSS('background-color', colors.subtle);
      await expect(code).toHaveCSS('border-top-color', colors.input);
      await expect(code).toHaveCSS('color', colors.primary);
      await expect(drawer.getByRole('button', { name: 'Preview Configuration' })).toHaveCSS('background-color', colors.accent);

      await code.fill('not-a-configuration-code');
      await drawer.getByRole('button', { name: 'Clear' }).waitFor();
      await expect(drawer.getByRole('button', { name: 'Clear' })).toHaveCSS('color', colors.tertiary);
      await drawer.getByRole('button', { name: 'Preview Configuration' }).click();
      const error = drawer.getByText('Invalid configuration code. Please check the value and try again.');
      await expect(error).toHaveCSS('color', colors.dangerText);
      await expect(error.locator('..')).toHaveCSS('background-color', colors.dangerSubtle);
      await expect(error.locator('..')).toHaveCSS('border-top-color', colors.dangerBorder);

      await error.evaluate(box => { box.scrollIntoView({ block: 'center' }); });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/import-drawer-${theme}.png` });
    });
  }

  test('in a 320 px side panel, a custom site row and the Add Custom Site form stay inside their cards', async ({ page, storage, extensionId }) => {
    const section = await openSiteIntegration(page, storage, extensionId, 'light', { customSites }, 'sidepanel');

    const notion = siteRow(section, 'Notion');
    for (const control of [notion.getByRole('button', { name: 'More actions for Notion' }), notion.getByRole('switch')]) {
      await expectInside(control, notion);
    }

    await section.getByRole('button', { name: /Add a custom site/ }).click();
    await page.mouse.move(0, 0);
    const chooser = section.getByText('Choose a method to continue').locator('..');
    for (const method of [/Manual Configuration/, /Import Configuration/]) {
      await expectInside(section.getByRole('button', { name: method }), chooser);
    }

    await section.getByRole('button', { name: /Manual Configuration/ }).click();
    const basics = section.getByRole('heading', { name: 'Basic Information' }).locator('..');
    await expectInside(section.getByLabel('Website URL *'), basics);
    await expectInside(section.getByLabel('Display Name'), basics);
    const positioning = section.getByRole('heading', { name: 'Custom Positioning' }).locator('../..');
    await expectInside(section.getByRole('heading', { name: 'Custom Positioning' }), positioning);
    await expectInside(section.getByRole('button', { name: 'Pick Element' }), positioning);
    await positioning.evaluate(card => { card.scrollIntoView({ block: 'center' }); });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/add-site-form-sidepanel-light.png` });
  });

  test.describe('through the clipboard', () => {
    // A headed run shares the system clipboard, so these never run alongside each other
    test.describe.configure({ mode: 'default' });

    for (const theme of ['light', 'dark'] as const) {
      const colors = EXPECTED[theme];

      test(`the configuration preview opens on bg-backdrop, with its cards on bg-raised and a duplicate in danger (${theme})`, async ({ page, storage, extensionId }) => {
        const section = await openSiteIntegration(page, storage, extensionId, theme, { customSites: customSites.slice(0, 1) });

        // Export Notion, then import its code back: the preview reports it as a duplicate
        await siteRow(section, 'Notion').getByRole('button', { name: 'More actions for Notion' }).click();
        await page.getByRole('menuitem', { name: 'Export configuration' }).click();
        await expect(page.getByText('Configuration copied', { exact: true })).toBeVisible();
        await section.getByRole('button', { name: /Add a custom site/ }).click();
        await page.mouse.move(0, 0);
        await section.getByRole('button', { name: /Import Configuration/ }).click();
        await section.getByLabel('Encoded configuration string').focus();
        await page.keyboard.press('ControlOrMeta+V');
        await section.getByRole('button', { name: 'Preview Configuration' }).click();

        const dialog = page.getByRole('dialog', { name: 'Review Configuration' });
        await expect(dialog.locator('> div').first()).toHaveCSS('background-color', colors.backdrop);
        const panel = dialog.locator('> div').last();
        await expect(panel).toHaveCSS('background-color', colors.raised);
        await expect(panel).toHaveCSS('border-top-color', colors.border);
        await expect(panel.locator('> div').first()).toHaveCSS('background-color', colors.card);
        await expect(dialog.getByRole('heading', { name: 'Review Configuration' })).toHaveCSS('color', colors.primary);
        await expect(dialog.getByRole('button', { name: 'Close preview' })).toHaveCSS('color', colors.tertiary);

        const siteInformation = dialog.getByRole('heading', { name: 'Site Information' });
        await expect(siteInformation).toHaveCSS('color', colors.secondary);
        await expect(siteInformation.locator('..')).toHaveCSS('background-color', colors.card);
        await expect(siteInformation.locator('..')).toHaveCSS('border-top-color', colors.border);
        await expect(dialog.getByText('Hostname', { exact: true })).toHaveCSS('color', colors.tertiary);
        await expect(dialog.getByText('notion.so', { exact: true })).toHaveCSS('color', colors.primary);

        const duplicate = dialog.getByText(/already exists for this hostname/);
        await expect(duplicate).toHaveCSS('color', colors.dangerText);
        await expect(duplicate.locator('..')).toHaveCSS('background-color', colors.dangerSubtle);
        await expect(duplicate.locator('..')).toHaveCSS('border-top-color', colors.dangerBorder);

        const cancel = dialog.getByRole('button', { name: 'Cancel' });
        await expect(cancel).toHaveCSS('background-color', colors.card);
        await expect(cancel).toHaveCSS('border-top-color', colors.strong);
        await expect(cancel).toHaveCSS('color', colors.secondary);
        await expect(dialog.getByRole('button', { name: 'Replace & Import' })).toHaveCSS('background-color', colors.accent);

        // A modal: the keyboard starts on Close and wraps over Cancel and Replace & Import; Escape gives it
        // back to Preview Configuration (My-Prompt-Manager-xaz)
        const close = dialog.getByRole('button', { name: 'Close preview' });
        const replace = dialog.getByRole('button', { name: 'Replace & Import' });
        await expect(close).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(cancel).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(replace).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(close).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(replace).toBeFocused();

        await duplicate.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SCREENSHOT_DIR}/configuration-preview-${theme}.png` });

        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(section.getByRole('button', { name: 'Preview Configuration' })).toBeFocused();
      });
    }
  });
});

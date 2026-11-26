/**
 * E2E: what a pick on a Custom site keeps, and what its configuration code holds (My-Prompt-Manager-je37).
 *
 * The stand-in page is opened at an address with a path, a query and a fragment. Its chat box is a
 * textarea that behaves as a React-controlled one does, its text content kept equal to what is typed,
 * and the page copies the draft into a `data-draft` attribute; the textarea's id and its section's
 * id are session ids. The user types a draft, adds the page as a Custom site and picks the textarea
 * with the Element picker, in the real extension: Settings, the service worker and the content
 * script. What is stored, and the configuration code Export copies, hold none of it, and the button
 * is placed by the pick on another page of the site.
 *
 * Then a Custom site stored by a release before the change, its fingerprint holding the page's
 * address and the draft: it still places its button, stays stored as it was, and its configuration
 * code holds neither.
 *
 * Playwright cannot accept Chrome's prompt for an optional host permission: this spec loads the
 * test-only build of tests/e2e/fixtures/custom-site-build.ts, as custom-site.spec.ts does. The tab
 * Pick Element looks for is the active tab of the Settings window, which is Settings itself here: the
 * spec points that one query at the stand-in's tab. Token-shaped values and the e-mail address are
 * built from parts.
 */

import type { BrowserContext, Page } from '@playwright/test';
import lzString from 'lz-string';

import type { CustomSite, ElementFingerprint } from '../../../src/types';
import { CUSTOM_SITE_EXTENSION_PATH, CUSTOM_SITE_HOSTNAME, CUSTOM_SITE_URL } from '../fixtures/custom-site-build';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

test.use({ extensionPath: CUSTOM_SITE_EXTENSION_PATH });

// lz-string is a CommonJS module: Playwright's loader gives its functions on the default export only
const { decompressFromEncodedURIComponent } = lzString;

const DRAFT = 'Draft: merger closes Friday';
const TOKEN = ['tk', '9f8e7d6c5b4a3f2e'].join('');
const EMAIL = ['jane.doe', 'example.org'].join('@');
const SESSION = ['e5f6a7b8', '1c2d', '4e5f', '8a9b', '0c1d2e3f4a5b'].join('-');
const PATH = 'workspace/notes/42';
const QUERY = `invite=${TOKEN}&email=${encodeURIComponent(EMAIL)}`;
const FRAGMENT = 'reply-to-7c1d';
const PAGE_URL = `${CUSTOM_SITE_URL}${PATH}?${QUERY}#${FRAGMENT}`;

/** What neither the stored site nor its configuration code may hold */
const PRIVATE = [PAGE_URL, `/${PATH}`, QUERY, TOKEN, EMAIL, encodeURIComponent(EMAIL), FRAGMENT, DRAFT, 'merger', SESSION];

const pageBody = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Team notes</title>
    <style>
      body { font-family: sans-serif; margin: 0; padding: 32px; background: #f6f7f9; }
      textarea { display: block; width: 560px; min-height: 120px; padding: 12px; font: inherit; }
    </style>
  </head>
  <body>
    <main>
      <h1>Team notes</h1>
      <section id="${SESSION}">
        <div class="composer">
          <textarea id="${SESSION}-input" name="message" class="composer-box" placeholder="Write a note"></textarea>
        </div>
      </section>
    </main>
    <script>
      // As a React-controlled textarea, whose default value (its text content) React keeps equal to
      // what is typed, and as a page that copies the draft into an attribute
      const field = document.querySelector('textarea');
      field.addEventListener('input', () => {
        field.defaultValue = field.value;
        field.dataset.draft = field.value;
      });
    </script>
  </body>
</html>
`;

const note = createPromptSeed({ id: 'note', title: 'Meeting notes', content: 'Summarize the meeting in five bullets.' });

const openStandIn = async (context: BrowserContext, url: string): Promise<Page> => {
  await context.route(`${CUSTOM_SITE_URL}**`, async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: pageBody });
    } else {
      await route.abort();
    }
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto(url);
  return page;
};

const storedSites = async (storage: ExtensionStorage): Promise<CustomSite[]> =>
  (await storage.get<{ promptLibrarySettings?: { customSites?: CustomSite[] } }>('promptLibrarySettings')).promptLibrarySettings?.customSites ?? [];

const expectNoneOf = (where: string, serialized: string) => {
  for (const value of PRIVATE) {
    expect(serialized, `${where} holds "${value}"`).not.toContain(value);
  }
};

const openSettings = async (context: BrowserContext, extensionId: string): Promise<Page> => {
  const settings = await context.newPage();
  await settings.setViewportSize({ width: 400, height: 700 });
  await settings.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await settings.getByTestId('tab-settings').click();
  return settings;
};

/** Exports the site from its row's menu and returns the configuration code Export copied */
const exportCode = async (settings: Page, displayName: string): Promise<string> => {
  await settings.evaluate(() => {
    const copied: string[] = [];
    (window as Window & { copiedCodes?: string[] }).copiedCodes = copied;
    navigator.clipboard.writeText = async (text: string) => { copied.push(text); };
  });
  await settings.getByRole('button', { name: `More actions for ${displayName}` }).click();
  await settings.getByRole('menuitem', { name: 'Export configuration' }).click();
  await expect.poll(() => settings.evaluate(() => (window as Window & { copiedCodes?: string[] }).copiedCodes?.length ?? 0)).toBe(1);
  return settings.evaluate(() => (window as Window & { copiedCodes?: string[] }).copiedCodes?.[0] ?? '');
};

/** The Prompts button stands by the textarea: the custom positioning anchors on it */
const expectPlacedByTheTextarea = async (page: Page) => {
  await expect(page.locator('.prompt-library-icon-base')).toHaveAttribute('data-mpm-placement', 'custom');
  await expect(page.locator('textarea')).toHaveAttribute('data-mpm-anchor-name', /.+/);
};

test.describe('A pick on a Custom site keeps nothing of the page address nor of the draft (je37)', () => {
  test('AC1, AC2: picked with a draft typed, at an address with a query and a fragment', async ({ context, storage, extensionId }) => {
    await seedLibrary(storage, { prompts: [note], settings: { interfaceMode: 'sidepanel' } });

    // The user types a draft: the page mirrors it into the textarea's text content and data-draft
    const target = await openStandIn(context, PAGE_URL);
    const field = target.locator('textarea');
    await field.fill(DRAFT);
    await expect(field).toHaveAttribute('data-draft', DRAFT);
    expect(await field.evaluate((element) => element.textContent)).toBe(DRAFT);

    // Settings > AI sites > Add a custom site > Manual Configuration > Pick Element
    const settings = await openSettings(context, extensionId);
    const section = settings.getByRole('region', { name: 'AI sites' });
    await section.getByRole('button', { name: /Add a custom site/ }).click();
    await section.getByRole('button', { name: /Manual Configuration/ }).click();
    await section.getByLabel('Website URL *').fill(CUSTOM_SITE_HOSTNAME);
    // The active tab of this window is Settings: Pick Element must find the stand-in's tab instead
    await settings.evaluate((host) => {
      const query = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = ((info: chrome.tabs.QueryInfo) =>
        info.active && info.currentWindow ? query({ url: `https://${host}/*` }) : query(info)) as typeof chrome.tabs.query;
    }, CUSTOM_SITE_HOSTNAME);
    await section.getByRole('button', { name: 'Pick Element' }).click();

    // The picker opens in the page: the user clicks the textarea
    await expect(target.locator('#mpm-element-picker-overlay')).toHaveCount(1);
    await target.bringToFront();
    const box = await field.boundingBox();
    expect(box).toBeTruthy();
    if (!box) {
      return;
    }
    await target.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await target.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(target.locator('#mpm-element-picker-overlay')).toHaveCount(0);

    // The form has the pick: the site is added with it
    await settings.bringToFront();
    await expect(section.getByRole('combobox', { name: 'Placement' })).toBeVisible();
    await section.getByRole('button', { name: 'Add Site', exact: true }).click();
    await expect.poll(async () => (await storedSites(storage)).length).toBe(1);

    // AC1: what is stored holds neither the address, its query, its fragment, the draft nor the session ids
    const [site] = await storedSites(storage);
    expectNoneOf('the stored Custom site', JSON.stringify(site));
    const fingerprint = site.positioning?.fingerprint as ElementFingerprint;
    expect(fingerprint.meta).not.toHaveProperty('url');
    expect(fingerprint.content).toEqual({});
    expect(fingerprint.primary).toEqual({ name: 'message' });
    expect(fingerprint.secondary).toMatchObject({ tagName: 'textarea', placeholder: 'Write a note' });
    expect(site.positioning?.selector).toBe('textarea.composer-box');

    // AC2: nor does its configuration code
    const code = await exportCode(settings, site.displayName);
    const payload = decompressFromEncodedURIComponent(code) ?? '';
    expect(payload).toContain(CUSTOM_SITE_HOSTNAME);
    expectNoneOf('the configuration code', payload);

    // The pick places the button, on another page of the site, its chat box empty
    await target.goto(`${CUSTOM_SITE_URL}workspace/notes/43`);
    await expectPlacedByTheTextarea(target);
  });

  test('AC3: a Custom site stored before the change still places its button, stays as stored, and exports neither', async ({ context, storage, extensionId }) => {
    // As 2.0.0 stored a pick of this textarea, made at PAGE_URL with the draft typed
    const pickedBefore: CustomSite = {
      hostname: CUSTOM_SITE_HOSTNAME,
      displayName: 'Team notes',
      enabled: true,
      dateAdded: 1_760_000_000_000,
      positioning: {
        mode: 'custom',
        placement: 'before',
        selector: `#${SESSION}-input`,
        offset: { x: 0, y: 0 },
        zIndex: 1000,
        fingerprint: {
          primary: { id: `${SESSION}-input`, name: 'message' },
          secondary: { tagName: 'textarea', placeholder: 'Write a note' },
          content: { textContent: DRAFT, textHash: 'icuibp' },
          context: { parentTagName: 'div', siblingIndex: 0, siblingCount: 1, depth: 4 },
          attributes: { 'data-draft': DRAFT },
          classPatterns: ['composer-box'],
          meta: { generatedAt: 1_760_000_000_000, url: PAGE_URL, confidence: 'high' }
        }
      }
    };
    await seedLibrary(storage, { prompts: [note] });
    await storage.seed({ promptLibrarySettings: { enabledSites: [], customSites: [pickedBefore] } });

    const target = await openStandIn(context, `${CUSTOM_SITE_URL}workspace/notes/43`);
    await expectPlacedByTheTextarea(target);

    // The stored pick is read as it is: its address and text stay on the device, where nothing reads the address
    expect(await storedSites(storage)).toEqual([pickedBefore]);

    // Its configuration code holds neither, nor the selector naming the session id: the fingerprint places the button
    const settings = await openSettings(context, extensionId);
    const code = await exportCode(settings, pickedBefore.displayName);
    const payload = decompressFromEncodedURIComponent(code) ?? '';
    expect(payload).toContain(CUSTOM_SITE_HOSTNAME);
    expectNoneOf('the configuration code', payload);
    const exported = JSON.parse(payload) as { p?: { s?: string; fp?: ElementFingerprint } };
    expect(exported.p?.s).toBe('');
    expect(exported.p?.fp?.primary).toEqual({ name: 'message' });
  });
});

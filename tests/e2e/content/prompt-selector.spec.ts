/**
 * E2E: the Prompt selector on Platforms, after the Atelier 1C redesign (My-Prompt-Manager-q9j.1, q9j.2)
 *
 * Runs the built extension's content script on a stand-in page of each of the seven Platforms.
 * Proves the flow by mouse and by keyboard alone, that a key pressed in the selector never reaches
 * the Platform, that the selector's styles are shut in its shadow root, and that it survives a
 * strict Content Security Policy. Captures light and dark screenshots (test-results/prompt-selector/).
 */

import type { Page } from '@playwright/test';

import { DEFAULT_SETTINGS, type Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { listedTitles, openPlatform, openPromptSelector, PLATFORM_FIELD, PLATFORM_FIXTURES, type PlatformFixture, promptRow, promptSelector, promptsButton } from '../fixtures/platform-pages';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/prompt-selector';
const HOUR = 3_600_000;
const now = Date.now();

const categories = [
  createCategorySeed({ name: 'Writing', color: '#2563EB' }),
  createCategorySeed({ name: 'Code', color: '#0F766E' }),
  createCategorySeed({ name: 'Research', color: '#DC2626' }),
];

// Storage order: the Pinned Prompt is last, so "first in the list" proves the partition
const prompts: Prompt[] = [
  createPromptSeed({ id: 'review', title: 'Review a diff', content: 'Review this diff like a senior developer.', category: 'Code', usageCount: 2, lastUsedAt: now - 2 * HOUR }),
  createPromptSeed({ id: 'notes', title: 'Meeting notes to decisions', content: 'Turn these notes into decisions and owners.', category: 'Writing', usageCount: 1, lastUsedAt: now - HOUR }),
  createPromptSeed({ id: 'translate', title: 'Translate a text', content: 'Translate {{text}} into {{language}}. Keep the tone of {{text}}.', category: 'Writing' }),
  createPromptSeed({ id: 'release', title: 'Release notes draft', content: 'Write user-facing release notes from this changelog.', category: 'Writing', pinned: true }),
];

const seed = async (storage: ExtensionStorage, theme: 'light' | 'dark' = 'light') => {
  await seedLibrary(storage, { prompts, categories, settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup', theme } });
};

const field = (page: Page, platform: PlatformFixture) => page.locator(PLATFORM_FIELD[platform]);

const fieldText = (page: Page, platform: PlatformFixture) =>
  field(page, platform).evaluate((element) => (element instanceof HTMLTextAreaElement ? element.value : (element.textContent ?? '')));

const enterKeys = (page: Page) => page.evaluate(() => (window as unknown as { __enterKeys: number }).__enterKeys);

const selectedTab = (page: Page) => promptSelector(page).getByRole('tab', { selected: true });

test.describe('Prompt selector on each Platform', () => {
  for (const platform of PLATFORM_FIXTURES) {
    test(`${platform}: opens from the Prompts button, closes three ways, inserts by mouse`, async ({ context, storage }) => {
      await seed(storage);
      const page = await openPlatform(context, platform);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      // One Prompts button, which says whether the selector is open
      await openPromptSelector(page);
      await expect(promptsButton(page)).toHaveText('Prompts');
      await expect(promptsButton(page)).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => listedTitles(page)).toEqual(['Release notes draft', 'Review a diff', 'Meeting notes to decisions', 'Translate a text']);

      // Escape closes and gives the focus back to the input field
      await page.keyboard.press('Escape');
      await expect(promptSelector(page)).toBeHidden();
      await expect(promptsButton(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(field(page, platform)).toBeFocused();

      // A click outside closes
      await openPromptSelector(page);
      await page.mouse.click(700, 500);
      await expect(promptSelector(page)).toBeHidden();

      // A second click on the button closes
      await openPromptSelector(page);
      await promptsButton(page).click();
      await expect(promptSelector(page)).toBeHidden();

      // A click on a Prompt inserts it, once the selector has closed
      await openPromptSelector(page);
      await promptRow(page, 'review').click();
      await expect(promptSelector(page)).toBeHidden();
      await expect.poll(() => fieldText(page, platform)).toBe('Review this diff like a senior developer.');
      expect(errors).toEqual([]);
    });

    test(`${platform}: the whole flow by keyboard alone, and no key reaches the Platform`, async ({ context, storage }) => {
      await seed(storage);
      const page = await openPlatform(context, platform);
      await expect(promptsButton(page)).toHaveCount(1);

      // Open from the button with the keyboard
      await promptsButton(page).focus();
      await page.keyboard.press('Enter');
      await expect(promptSelector(page)).toBeVisible();

      // Arrows move the selection and change tab; Enter on an empty list does nothing
      await page.keyboard.press('ArrowDown');
      await expect(promptRow(page, 'review')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('ArrowRight');
      await expect(selectedTab(page)).toHaveText('Pinned');
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowRight');
      }
      await expect(selectedTab(page)).toHaveText('Research');
      await page.keyboard.press('Enter');
      await expect(promptSelector(page)).toBeVisible();

      // Back to Writing, down to the Prompt with Variables, Enter opens the variables step
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      await expect(selectedTab(page)).toHaveText('Writing');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await expect(promptRow(page, 'translate')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Enter');

      const text = promptSelector(page).getByRole('textbox', { name: 'text' });
      await expect(text.first()).toBeFocused();
      await page.keyboard.type('this letter');
      await page.keyboard.press('Tab');
      await expect(promptSelector(page).getByRole('textbox', { name: 'language' })).toBeFocused();
      await page.keyboard.type('French');
      await page.keyboard.press('Enter');

      await expect(promptSelector(page)).toBeHidden();
      await expect.poll(() => fieldText(page, platform)).toBe('Translate this letter into French. Keep the tone of this letter.');
      expect(await enterKeys(page)).toBe(0);
    });
  }
});

test.describe('Prompt selector: tabs, search and Variables', () => {
  test('tabs are All, Pinned, Recent, then every Category, and All is shown at each opening', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude');
    await openPromptSelector(page);

    await expect(promptSelector(page).getByRole('tab')).toHaveText(['All', 'Pinned', 'Recent', 'Uncategorized', 'Writing', 'Code', 'Research']);
    await expect(selectedTab(page)).toHaveText('All');

    await promptSelector(page).getByRole('tab', { name: 'Pinned' }).click();
    await expect.poll(() => listedTitles(page)).toEqual(['Release notes draft']);

    // Recent: the Prompts inserted, latest first; one never inserted is not there
    await promptSelector(page).getByRole('tab', { name: 'Recent' }).click();
    await expect.poll(() => listedTitles(page)).toEqual(['Meeting notes to decisions', 'Review a diff']);

    await promptSelector(page).getByRole('tab', { name: 'Research' }).click();
    await expect(promptSelector(page)).toContainText('Nothing in this category yet.');

    await page.keyboard.press('Escape');
    await openPromptSelector(page);
    await expect(selectedTab(page)).toHaveText('All');
  });

  test('a row shows the title, the Category and the number of Variables', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude');
    await openPromptSelector(page);

    await expect(promptRow(page, 'translate')).toContainText('Translate a text');
    await expect(promptRow(page, 'translate')).toContainText('Writing');
    await expect(promptRow(page, 'translate')).toContainText('2 variables');
    await expect(promptRow(page, 'review')).not.toContainText('variable');
    // The dot takes the Category's color
    await expect(promptRow(page, 'review').locator('.mpm-dot')).toHaveCSS('background-color', 'rgb(15, 118, 110)');
  });

  test('typing in the list searches the whole Library; Escape leaves the search, then closes', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude');
    await openPromptSelector(page);
    await promptSelector(page).getByRole('tab', { name: 'Code' }).click();

    await page.keyboard.type('notes');
    const search = promptSelector(page).getByRole('combobox', { name: 'Search prompts' });
    await expect(search).toHaveValue('notes');
    await expect(search).toBeFocused();
    await expect.poll(() => listedTitles(page)).toEqual(['Release notes draft', 'Meeting notes to decisions']);
    await expect(promptSelector(page).getByRole('tab', { selected: true })).toHaveCount(0);

    await search.fill('zzz');
    await expect(promptSelector(page)).toContainText('No matching prompts.');

    await page.keyboard.press('Escape');
    await expect(search).toBeHidden();
    await expect(selectedTab(page)).toHaveText('Code');
    await expect.poll(() => listedTitles(page)).toEqual(['Review a diff']);

    await page.keyboard.press('Escape');
    await expect(promptSelector(page)).toBeHidden();
  });

  test('the hover moves the selection, and the selected row stays in view', async ({ context, storage }) => {
    const many = Array.from({ length: 14 }, (_, i) => createPromptSeed({ id: `p${String(i)}`, title: `Prompt ${String(i)}`, content: `Content ${String(i)}`, category: 'Writing' }));
    await seedLibrary(storage, { prompts: many, categories, settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup' } });
    const page = await openPlatform(context, 'claude');
    await openPromptSelector(page);

    await promptRow(page, 'p2').hover();
    await expect(promptRow(page, 'p2')).toHaveAttribute('aria-selected', 'true');

    for (let i = 0; i < 11; i++) {
      await page.keyboard.press('ArrowDown');
    }
    await expect(promptRow(page, 'p13')).toHaveAttribute('aria-selected', 'true');
    await expect(promptRow(page, 'p13')).toBeInViewport({ ratio: 1 });
    await expect(promptSelector(page).getByRole('listbox')).toHaveAttribute('aria-activedescendant', await promptRow(page, 'p13').getAttribute('id') ?? '');
  });

  test('a Variable left empty stays as written; Escape in the variables step goes back to the list', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'chatgpt');
    await openPromptSelector(page);
    await promptRow(page, 'translate').click();

    const dialog = promptSelector(page);
    await expect(dialog.getByRole('heading', { name: 'Translate a text' })).toBeVisible();
    // The Variable written twice has two fields that share one value
    await dialog.getByRole('textbox', { name: 'text' }).first().fill('my email');
    await expect(dialog.getByRole('textbox', { name: 'text' }).nth(1)).toHaveValue('my email');

    await page.keyboard.press('Escape');
    await expect(promptRow(page, 'translate')).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Enter');
    await dialog.getByRole('textbox', { name: 'text' }).first().fill('my email');
    await dialog.getByRole('button', { name: /Insert into the chat/ }).click();

    await expect(dialog).toBeHidden();
    await expect(page.locator('#composer-state')).toHaveText('Translate my email into {{language}}. Keep the tone of my email.');
  });
});

test.describe('Prompt selector in a third-party page', () => {
  test('opens above the input field when there is room, below when there is none', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude');
    await page.setViewportSize({ width: 1000, height: 800 });

    // The stand-in input field is at the top of the page: no room above. The popover goes under the
    // Prompts button, which sits right below the field, so it never covers the button that closes it
    await openPromptSelector(page);
    await expect(promptSelector(page)).toHaveAttribute('data-side', 'below');
    const fieldBox = await field(page, 'claude').boundingBox();
    const buttonBox = await promptsButton(page).boundingBox();
    // Polled: the opening animation scales the popover for 420ms
    await expect.poll(async () => Math.round((await promptSelector(page).boundingBox())?.y ?? 0)).toBe(Math.round((buttonBox?.y ?? 0) + (buttonBox?.height ?? 0) + 10));
    await expect.poll(async () => Math.round((await promptSelector(page).boundingBox())?.x ?? 0)).toBe(Math.round(fieldBox?.x ?? 0));
    await expect.poll(async () => (await promptSelector(page).boundingBox())?.width).toBe(360);
    await page.keyboard.press('Escape');
    await expect(promptSelector(page)).toBeHidden();

    await page.addStyleTag({ content: 'main { margin-top: 520px; }' });
    await openPromptSelector(page);
    await expect(promptSelector(page)).toHaveAttribute('data-side', 'above');
    const lowered = await field(page, 'claude').boundingBox();
    await expect.poll(async () => {
      const above = await promptSelector(page).boundingBox();
      return Math.round((above?.y ?? 0) + (above?.height ?? 0));
    }).toBe(Math.round((lowered?.y ?? 0) - 10));
  });

  test('is never wider than the window', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude');
    await page.setViewportSize({ width: 320, height: 700 });
    await openPromptSelector(page);

    await expect.poll(async () => (await promptSelector(page).boundingBox())?.width).toBe(300);
    await expect.poll(async () => (await promptSelector(page).boundingBox())?.x).toBe(10);
  });

  test('no style leaks between the selector and the page, under a strict Content Security Policy', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude', {
      headers: { 'Content-Security-Policy': "default-src 'none'; style-src 'self'; script-src 'unsafe-inline'; font-src 'none'; connect-src 'none'" },
    });
    // A page that restyles every element it can reach
    await page.evaluate(() => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('div, span, button, input, h2 { font-family: serif !important; letter-spacing: 4px !important; border: 3px solid red !important; text-transform: uppercase !important; }');
      document.adoptedStyleSheets = [sheet];
    });
    await openPromptSelector(page);

    // The page's rules stop at the shadow root
    const dialog = promptSelector(page);
    await expect(dialog).toHaveCSS('border-top-width', '1px');
    await expect(dialog).toHaveCSS('border-radius', '22px');
    await expect(dialog).toHaveCSS('letter-spacing', 'normal');
    await expect(dialog.getByRole('heading')).toHaveCSS('text-transform', 'none');
    await expect(promptRow(page, 'review').locator('.mpm-row-title')).toHaveCSS('letter-spacing', 'normal');

    // The extension's font is loaded from the package despite font-src and connect-src
    await expect(dialog).toHaveCSS('font-family', /MPM Schibsted Grotesk/);
    await expect.poll(() => page.evaluate(() => document.fonts.check('700 13px "MPM Schibsted Grotesk"'))).toBe(true);

    // The selector's rules are not in the page: its only style element is inside the shadow root
    const leaked = await page.evaluate(() => [...document.querySelectorAll('style')].filter((style) => style.textContent?.includes('mpm-')).length);
    expect(leaked).toBe(0);
    await expect(page.locator('#mpm-prompt-selector')).toHaveCSS('pointer-events', 'none');
  });

  test('closes without an error when the Platform replaces its input field', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude');
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openPromptSelector(page);

    await page.evaluate(() => {
      const old = document.querySelector('.ProseMirror');
      const fresh = old?.cloneNode(true);
      if (old && fresh) {
        old.replaceWith(fresh);
      }
    });

    await expect(promptSelector(page)).toBeHidden();
    await expect(promptsButton(page)).toHaveAttribute('aria-expanded', 'false');
    expect(errors).toEqual([]);
  });

  test('animations follow the motion table, and nearly vanish under reduced motion', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude');
    await openPromptSelector(page);

    const dialog = promptSelector(page);
    await expect(dialog).toHaveCSS('animation-duration', '0.42s');
    await expect(dialog).toHaveCSS('animation-timing-function', 'cubic-bezier(0.34, 1.56, 0.64, 1)');
    await expect(dialog).toHaveCSS('transform-origin', /^0px /);
    await expect(promptRow(page, 'review')).toHaveCSS('animation-duration', '0.35s');

    await promptRow(page, 'translate').click();
    await expect(dialog.locator('.mpm-fill')).toHaveCSS('animation-duration', '0.4s');
    await expect(dialog.locator('.mpm-fill')).toHaveCSS('animation-timing-function', 'cubic-bezier(0.32, 0.72, 0, 1)');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(dialog).toHaveCSS('animation-duration', '0.001s');
    await expect(dialog.locator('.mpm-fill')).toHaveCSS('animation-duration', '0.001s');
  });
});

test.describe('Prompt selector: visual proof', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`PROOF: list and variables step (${theme} mode)`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPlatform(context, 'claude');
      await page.setViewportSize({ width: 900, height: 700 });
      await page.addStyleTag({ content: `main { margin-top: 440px; } ${theme === 'dark' ? 'body { background: #1f1e1d; color: #eee; }' : ''}` });
      await openPromptSelector(page);
      await expect(page.locator('#mpm-prompt-selector')).toHaveAttribute('data-theme', theme);
      await expect.poll(() => page.evaluate(() => document.fonts.check('700 13px "MPM Schibsted Grotesk"'))).toBe(true);

      await page.keyboard.press('ArrowDown');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/list-${theme}.png`, animations: 'disabled' });

      await promptRow(page, 'translate').click();
      await promptSelector(page).getByRole('textbox', { name: 'text' }).first().fill('this letter');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/variables-${theme}.png`, animations: 'disabled' });
    });
  }
});

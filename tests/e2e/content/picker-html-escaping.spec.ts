/**
 * E2E Acceptance: the injected prompt picker shows special characters literally (My-Prompt-Manager-02r)
 *
 * Regression: "Decisions & Owners" used to render as "Decisions &amp; Owners" because text was
 * HTML-escaped and then set via textContent. Runs the built extension's content script on a
 * mocked Claude page and captures light/dark screenshots as proof (test-results/picker-escaping/).
 */

import type { BrowserContext, Page } from '@playwright/test';

import { DEFAULT_SETTINGS, type Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const MOCK_HOST = 'https://claude.ai/';
const SCREENSHOT_DIR = 'test-results/picker-escaping';
const MOCK_BODY = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Claude Mock</title>
    <style>
      body { font-family: sans-serif; padding: 24px; }
      .flex { display: flex; gap: 8px; align-items: center; }
      .ProseMirror { min-height: 120px; border: 1px solid #ddd; padding: 12px; }
    </style>
  </head>
  <body>
    <main>
      <div class="flex gap-2 items-center">
        <div class="ProseMirror" contenteditable="true" role="textbox">Start writing here…</div>
      </div>
    </main>
  </body>
</html>
`;

const TITLE = 'Decisions & Owners';
const CONTENT = `List each decision & its owner. Use "quotes", 'apostrophes' and a/b paths as-is.`;
const CATEGORY = 'R&D';

const prompts: Prompt[] = [
  createPromptSeed({ id: 'decisions', title: TITLE, content: CONTENT, category: CATEGORY }),
];

const seed = async (storage: ExtensionStorage, theme: 'light' | 'dark') => {
  await seedLibrary(storage, {
    prompts,
    settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup', theme },
  });
};

const openPicker = async (context: BrowserContext): Promise<Page> => {
  await context.route('https://claude.ai/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: MOCK_BODY });
    } else {
      await route.abort();
    }
  });

  const targetPage = await context.newPage();
  await targetPage.setViewportSize({ width: 900, height: 700 });
  await targetPage.goto(MOCK_HOST, { waitUntil: 'domcontentloaded' });

  const toolbarButton = targetPage.locator('.prompt-library-integrated-icon');
  await expect(toolbarButton).toHaveCount(1);
  await toolbarButton.click();
  await expect(targetPage.locator('.prompt-library-selector')).toBeVisible();
  return targetPage;
};

test.describe('Prompt picker special characters', () => {
  test('AT2: a prompt titled "Decisions & Owners" shows exactly that text in the picker', async ({ context, storage }) => {
    await seed(storage, 'light');
    const page = await openPicker(context);

    const item = page.locator('.prompt-library-selector .prompt-list .prompt-item').first();
    await expect(item.locator('.prompt-title')).toHaveText(TITLE);
    await expect(item.locator('.prompt-category')).toHaveText(CATEGORY);
    await expect(item.locator('.prompt-preview')).toHaveText(CONTENT);

    // Search results go through the same rendering path
    await page.locator('.prompt-library-selector .search-input').fill('decisions');
    await expect(
      page.locator('.prompt-library-selector .prompt-list .prompt-title'),
    ).toHaveText([TITLE]);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`PROOF: prompt picker screenshot with special characters (${theme} mode)`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPicker(context);

      const selector = page.locator('.prompt-library-selector');
      await expect(selector).toHaveClass(new RegExp(`${theme}-theme`));
      await expect(selector.locator('.prompt-title').first()).toHaveText(TITLE);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/picker${theme === 'dark' ? '-dark' : ''}.png`, animations: 'disabled' });
    });
  }
});

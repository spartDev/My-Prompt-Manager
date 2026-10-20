/**
 * E2E Acceptance: Prompt Variables (My-Prompt-Manager-bbl)
 *
 * A Prompt with {{name}} Variables shows an "N variables" chip in the Library, and picking it in
 * the prompt selector on an AI platform opens a form to fill them in before insertion.
 * Also captures light/dark screenshots of the chip and the form (test-results/prompt-variables/).
 */

import type { BrowserContext, Page } from '@playwright/test';

import { DEFAULT_CATEGORY } from '../../../src/types';
import { test, expect, type ExtensionStorage } from '../fixtures/extension';
import { seedLibrary, createPromptSeed } from '../utils/storage';

const SIDEPANEL_URL = 'src/sidepanel.html';
const SCREENSHOT_DIR = 'test-results/prompt-variables';
const MOCK_HOST = 'https://claude.ai/';
const MOCK_BODY = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Claude Mock</title>
    <style>
      body { font-family: sans-serif; padding: 24px; }
      .flex { display: flex; gap: 8px; align-items: center; }
      .ProseMirror { min-height: 120px; width: 520px; border: 1px solid #ddd; padding: 12px; }
    </style>
  </head>
  <body>
    <main>
      <div class="flex gap-2 items-center">
        <div class="ProseMirror" contenteditable="true" role="textbox"></div>
      </div>
    </main>
  </body>
</html>
`;

const translate = createPromptSeed({
  id: 'translate',
  title: 'Translate a text',
  content: 'Translate {{text}} into {{ language }}. Use a formal {{language}} register.',
  category: DEFAULT_CATEGORY,
  usageCount: 3,
});

const plain = createPromptSeed({
  id: 'plain',
  title: 'Plain prompt',
  content: 'Summarize the conversation so far.',
  category: DEFAULT_CATEGORY,
  createdAt: Date.now() - 60_000,
});

const seed = async (storage: ExtensionStorage, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts: [translate, plain], settings: { theme } });
};

const openMockPlatform = async (context: BrowserContext): Promise<Page> => {
  await context.route('https://claude.ai/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: MOCK_BODY });
    } else {
      await route.abort();
    }
  });
  const target = await context.newPage();
  await target.setViewportSize({ width: 900, height: 700 });
  await target.goto(MOCK_HOST, { waitUntil: 'domcontentloaded' });
  return target;
};

const openSelectorAndPick = async (target: Page, title: string) => {
  const icon = target.locator('.prompt-library-integrated-icon');
  await expect(icon).toHaveCount(1);
  await icon.click();
  const selector = target.locator('.prompt-library-selector');
  await expect(selector).toBeVisible();
  await selector.locator('.prompt-item').filter({ hasText: title }).click();
  return selector;
};

test.describe('Prompt Variables', () => {
  test('AT5: the Library card shows the variable count only for prompts with variables', async ({ page, storage, extensionId }) => {
    await seed(storage, 'light');
    await page.setViewportSize({ width: 400, height: 760 });
    await page.goto(`chrome-extension://${extensionId}/${SIDEPANEL_URL}`);

    await expect(page.getByTestId('prompt-card')).toHaveCount(2);
    const translateCard = page.getByTestId('prompt-card').filter({ hasText: 'Translate a text' });
    await expect(translateCard.getByTestId('prompt-variables-chip')).toHaveText('2 variables');
    const plainCard = page.getByTestId('prompt-card').filter({ hasText: 'Plain prompt' });
    await expect(plainCard.getByTestId('prompt-variables-chip')).toHaveCount(0);
  });

  test('AT5: picking a prompt with variables opens the form, and filling it inserts the filled text', async ({ context, storage }) => {
    await seed(storage, 'light');
    const target = await openMockPlatform(context);

    const selector = await openSelectorAndPick(target, 'Translate a text');

    const form = selector.getByRole('form', { name: 'Fill in variables' });
    await expect(form).toBeVisible();
    await expect(form.getByLabel('text', { exact: true })).toBeFocused();
    await expect(form.getByLabel('language', { exact: true })).toBeVisible();

    await form.getByLabel('text', { exact: true }).fill('the release notes');
    await form.getByLabel('language', { exact: true }).fill('French');
    await form.getByLabel('language', { exact: true }).press('Enter');

    await expect(selector).toHaveCount(0);
    await expect(target.locator('.ProseMirror')).toHaveText(
      'Translate the release notes into French. Use a formal French register.'
    );
  });

  test('AT5: Escape in the form inserts the raw text', async ({ context, storage }) => {
    await seed(storage, 'light');
    const target = await openMockPlatform(context);

    const selector = await openSelectorAndPick(target, 'Translate a text');
    await expect(selector.getByRole('form', { name: 'Fill in variables' })).toBeVisible();
    await target.keyboard.press('Escape');

    await expect(selector).toHaveCount(0);
    await expect(target.locator('.ProseMirror')).toHaveText(translate.content);
  });

  test('AT5: a prompt without variables is inserted directly', async ({ context, storage }) => {
    await seed(storage, 'light');
    const target = await openMockPlatform(context);

    const selector = await openSelectorAndPick(target, 'Plain prompt');

    await expect(selector).toHaveCount(0);
    await expect(target.locator('.ProseMirror')).toHaveText(plain.content);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`PROOF: variables chip in the Library (${theme} mode)`, async ({ page, storage, extensionId }) => {
      await seed(storage, theme);
      await page.setViewportSize({ width: 400, height: 760 });
      await page.goto(`chrome-extension://${extensionId}/${SIDEPANEL_URL}`);

      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      await expect(page.getByTestId('prompt-variables-chip')).toHaveText('2 variables');

      await page.screenshot({ path: `${SCREENSHOT_DIR}/chip-${theme}.png` });
    });

    test(`PROOF: variable fill-in form in the prompt selector (${theme} mode)`, async ({ context, storage }) => {
      await seed(storage, theme);
      const target = await openMockPlatform(context);

      const selector = await openSelectorAndPick(target, 'Translate a text');
      await expect(selector).toHaveClass(new RegExp(`${theme}-theme`));
      const form = selector.getByRole('form', { name: 'Fill in variables' });
      await form.getByLabel('text', { exact: true }).fill('the release notes');

      await target.screenshot({ path: `${SCREENSHOT_DIR}/form-${theme}.png` });
    });
  }
});

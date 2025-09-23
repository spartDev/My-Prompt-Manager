import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary, createPromptSeed } from '../utils/storage';

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

test.describe('Content script injector', () => {
  test('injects toolbar and opens prompt selector on supported host', async ({ context, storage }) => {
    const prompt = createPromptSeed({
      id: 'injection-test-prompt',
      title: 'Injected Prompt',
      content: 'Injected content for E2E verification.',
      category: DEFAULT_CATEGORY,
    });

    await seedLibrary(storage, {
      prompts: [prompt],
      settings: {
        ...DEFAULT_SETTINGS,
        interfaceMode: 'popup',
      },
    });

    await context.route('https://claude.ai/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: MOCK_BODY,
        });
      } else {
        await route.abort();
      }
    });

    const targetPage = await context.newPage();
    await targetPage.goto(MOCK_HOST, { waitUntil: 'domcontentloaded' });

    const toolbarButton = targetPage.locator('.prompt-library-integrated-icon');
    await expect(toolbarButton).toHaveCount(1);
    await toolbarButton.first().click();

    const selector = targetPage.locator('.prompt-library-selector');
    await expect(selector).toBeVisible();
    await expect(selector.locator('.prompt-item').first()).toContainText('Injected Prompt');
  });
});

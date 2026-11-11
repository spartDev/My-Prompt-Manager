import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { openPlatform, PLATFORM_FIXTURES, promptsButton } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

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

    const selector = targetPage.locator('#mpm-prompt-selector').getByRole('dialog');
    await expect(selector).toBeVisible();
    await expect(selector.getByRole('option').first()).toContainText('Injected Prompt');
  });
});

test.describe('Prompts button placement on each Platform', () => {
  for (const platform of PLATFORM_FIXTURES) {
    test(`${platform}: the button sits in the composer's toolbar, at the first anchor of the Platform's chain`, async ({ context, storage }) => {
      await seedLibrary(storage, { prompts: [], settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup' } });
      const page = await openPlatform(context, platform);

      const button = promptsButton(page);
      await expect(button).toHaveAttribute('data-mpm-placement', 'toolbar');
      await expect(button).toHaveAttribute('data-mpm-anchor', '0');
      // The stand-in marks its toolbar: the button is in it, not laid over the page from <body>
      expect(await button.evaluate((element) => element.closest('[data-e2e="toolbar"]') !== null)).toBe(true);
      await expect(button).toHaveText('Prompts');
    });
  }
});

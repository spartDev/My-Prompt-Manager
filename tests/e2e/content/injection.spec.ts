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

/**
 * ChatGPT's settings pages, reconstructed (the live pages need sign-in): the sidebar's Search
 * settings box that ticket My-Prompt-Manager-6m8 describes, and a textarea that is made up, a
 * second field the extension must not take. The page moves between its settings and its composer
 * without reloading, as ChatGPT does.
 */
const CHATGPT_SETTINGS_APP = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ChatGPT</title>
    <style>
      body { font-family: sans-serif; margin: 24px; }
      input, textarea, .field { display: block; width: 480px; min-height: 32px; margin: 8px 0; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <template id="settings">
      <nav aria-label="Settings"><input type="text" placeholder="Search settings" aria-label="Search settings"></nav>
      <main><h1>Appearance</h1><textarea placeholder="Message style"></textarea></main>
    </template>
    <template id="composer">
      <form>
        <div class="field" id="prompt-textarea" contenteditable="true" role="textbox"><p><br></p></div>
        <div data-e2e="toolbar"><button type="button" aria-label="Dictate">Mic</button></div>
      </form>
    </template>
    <script>
      const render = () => {
        const view = location.pathname.startsWith('/settings') ? 'settings' : 'composer';
        document.getElementById('app').replaceChildren(document.getElementById(view).content.cloneNode(true));
      };
      window.goTo = (path) => { history.pushState({}, '', path); render(); };
      render();
    </script>
  </body>
</html>`;

test.describe('No Prompts button on a ChatGPT page without a composer', () => {
  test('on chatgpt.com/settings/* no button is placed; back on a conversation it is', async ({ context, storage }) => {
    await seedLibrary(storage, { prompts: [], settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup' } });
    await context.route('https://chatgpt.com/**', async (route) => {
      if (route.request().resourceType() === 'document') {
        await route.fulfill({ status: 200, contentType: 'text/html', body: CHATGPT_SETTINGS_APP });
      } else {
        await route.abort();
      }
    });
    const page = await context.newPage();
    await page.goto('https://chatgpt.com/settings/appearance', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('textbox', { name: 'Search settings' })).toBeVisible();

    // Long enough for the content script to have looked for an input field more than once
    await page.waitForTimeout(2000);
    await expect(promptsButton(page)).toHaveCount(0);

    // The same content script, still running: on a conversation, the composer gets its button
    await page.evaluate(() => (window as unknown as { goTo: (path: string) => void }).goTo('/c/6741a2b0-1234'));
    await expect(promptsButton(page)).toHaveCount(1);
    await expect(promptsButton(page)).toHaveAttribute('data-mpm-placement', 'toolbar');

    // Back to the settings: the composer and its button are gone, and the Search box gets none
    await page.evaluate(() => (window as unknown as { goTo: (path: string) => void }).goTo('/settings/general'));
    await page.waitForTimeout(2000);
    await expect(promptsButton(page)).toHaveCount(0);
  });
});

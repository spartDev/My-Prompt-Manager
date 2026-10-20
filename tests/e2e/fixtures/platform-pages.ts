import fs from 'node:fs';
import path from 'node:path';

import type { BrowserContext, Page } from '@playwright/test';

import { expect } from './extension';

/**
 * Stand-in input areas for two Platforms, served on each Platform's own hostname by route
 * interception. The manifest's content_scripts match that hostname, so the extension's real
 * content script runs on these pages exactly as it does on the live site; only the page is
 * a fixture.
 *
 * - chatgpt.com: a React 19 controlled <textarea>, so Insertion goes through the ChatGPT
 *   strategy and React's own change tracking. React's state is rendered into
 *   #composer-state, so a test can check what React received, not only the DOM value.
 * - claude.ai: a contenteditable editor without an editor library, so Insertion goes
 *   through the Claude strategy's execCommand('insertText'). It is styled
 *   `white-space: pre-wrap`, as ProseMirror is, so spaces stay as typed.
 */
export type PlatformFixture = 'chatgpt' | 'claude';

/** React 19 ships CommonJS only; the page loads these through a minimal require(). */
const REACT_SCRIPTS: Record<string, { module: string; file: string }> = {
  '/__e2e__/react.js': { module: 'react', file: 'react/cjs/react.production.js' },
  '/__e2e__/scheduler.js': { module: 'scheduler', file: 'scheduler/cjs/scheduler.production.js' },
  '/__e2e__/react-dom.js': { module: 'react-dom', file: 'react-dom/cjs/react-dom.production.js' },
  '/__e2e__/react-dom-client.js': {
    module: 'react-dom/client',
    file: 'react-dom/cjs/react-dom-client.production.js',
  },
};

const CHATGPT_REACT_HTML = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ChatGPT</title>
    <style>
      body { font-family: sans-serif; margin: 24px; }
      textarea { width: 480px; min-height: 120px; }
    </style>
  </head>
  <body>
    <main id="root"></main>
    <script>
      const factories = {};
      const cache = {};
      window.__define = (name, factory) => { factories[name] = factory; };
      window.__require = (name) => {
        if (!cache[name]) {
          cache[name] = { exports: {} };
          factories[name](cache[name], cache[name].exports, window.__require);
        }
        return cache[name].exports;
      };
    </script>
    ${Object.keys(REACT_SCRIPTS).map((src) => `<script src="${src}"></script>`).join('\n    ')}
    <script>
      const React = window.__require('react');
      const { createRoot } = window.__require('react-dom/client');

      function Composer() {
        const [text, setText] = React.useState('');
        return React.createElement(
          React.Fragment,
          null,
          React.createElement('textarea', {
            id: 'prompt-textarea',
            placeholder: 'Message ChatGPT',
            value: text,
            onChange: (event) => setText(event.target.value),
          }),
          React.createElement('output', { id: 'composer-state' }, text)
        );
      }

      createRoot(document.getElementById('root')).render(React.createElement(Composer));
    </script>
  </body>
</html>
`;

const CLAUDE_EDITOR_HTML = /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Claude</title>
    <style>
      body { font-family: sans-serif; margin: 24px; }
      .ProseMirror { width: 480px; min-height: 120px; padding: 8px; border: 1px solid #ccc; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <main>
      <div class="ProseMirror" contenteditable="true" role="textbox" aria-label="Write your prompt to Claude"></div>
    </main>
  </body>
</html>
`;

const FIXTURES: Record<PlatformFixture, { url: string; html: string }> = {
  chatgpt: { url: 'https://chatgpt.com/', html: CHATGPT_REACT_HTML },
  claude: { url: 'https://claude.ai/', html: CLAUDE_EDITOR_HTML },
};

const readReactScript = ({ module, file }: { module: string; file: string }): string => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'node_modules', file), 'utf8');
  return `window.__define(${JSON.stringify(module)}, function (module, exports, require) {\n${source}\n});`;
};

/**
 * Serves the Platform's stand-in page (and nothing else: other requests are aborted).
 * Returns the URL to open.
 */
export async function routePlatform(context: BrowserContext, platform: PlatformFixture): Promise<string> {
  const { url, html } = FIXTURES[platform];

  await context.route(`${url}**`, async (route) => {
    const request = route.request();
    if (request.resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html });
      return;
    }

    const script = REACT_SCRIPTS[new URL(request.url()).pathname];
    if (script) {
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: readReactScript(script) });
      return;
    }

    await route.abort();
  });

  return url;
}

/** Opens the Platform's stand-in page in a new tab. */
export async function openPlatform(context: BrowserContext, platform: PlatformFixture): Promise<Page> {
  const url = await routePlatform(context, platform);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page;
}

/**
 * Chooses a Prompt as a user does: opens the Prompt selector from the extension's icon in
 * the input area and clicks the Prompt. Waits for the selector to close.
 *
 * A Prompt with Variables opens the fill-in form instead of inserting: `insertAsIs` then
 * chooses "Insert as is", the user's way to insert the text exactly as stored.
 *
 * After an Insertion the content script closes "the open selector" only once the use has
 * been reported to the service worker, which can land after a test (far faster than a
 * person) has already reopened it; the selector is then reopened.
 */
export async function choosePrompt(
  page: Page,
  promptId: string,
  options: { insertAsIs?: boolean } = {}
): Promise<void> {
  const selector = page.locator('.prompt-library-selector');

  await expect(async () => {
    await page.locator('.prompt-library-integrated-icon').click({ timeout: 5_000 });
    await selector.locator(`.prompt-item[data-prompt-id="${promptId}"]`).click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  if (options.insertAsIs) {
    await selector.getByRole('button', { name: 'Insert as is' }).click();
  }
  await expect(selector).toBeHidden();
}

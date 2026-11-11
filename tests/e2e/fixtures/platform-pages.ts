import fs from 'node:fs';
import path from 'node:path';

import type { BrowserContext, Page } from '@playwright/test';

import { expect } from './extension';

/**
 * Stand-in input areas for the seven Platforms, served on each Platform's own hostname by route
 * interception. The manifest's content_scripts match that hostname, so the extension's real
 * content script runs on these pages exactly as it does on the live site; only the page is
 * a fixture. Each page has the input field and the action bar the Platform's strategy looks for,
 * so the Prompts button is placed as on the live site. The input field is the first control Tab
 * reaches: the keyboard-only flows start there (insertion-flow.ts).
 *
 * - chatgpt.com: a React 19 controlled <textarea>, so Insertion goes through the ChatGPT
 *   strategy and React's own change tracking. React's state is rendered into
 *   #composer-state, so a test can check what React received, not only the DOM value.
 * - claude.ai: a contenteditable editor without an editor library, so Insertion goes
 *   through the Claude strategy's execCommand('insertText'). It is styled
 *   `white-space: pre-wrap`, as ProseMirror is, so spaces stay as typed.
 * - chat.mistral.ai, gemini.google.com, www.perplexity.ai, m365.cloud.microsoft: a contenteditable
 *   without an editor library, with the attributes each strategy selects on, so Insertion goes
 *   through that strategy's execCommand path.
 * - copilot.microsoft.com: a plain <textarea>, filled through the native value setter.
 *
 * Two more pages stand in for the editors the live ChatGPT and Mistral composers are today
 * (seen on 2026-11-11): a ProseMirror editor, which holds one <p> per line and reads a line
 * break written straight into its DOM as a space. See PARAGRAPH_EDITOR.
 *
 * One more stands in for Perplexity's live composer, a Lexical editor that takes text as a paste
 * and inserts a second time the text an `input` event carries. See LEXICAL_EDITOR.
 *
 * Every page counts the Enter keys that reach it, other than on a button, in
 * `window.__enterKeys`: the live sites send the message on Enter, so a test can prove a key
 * pressed in the Prompt selector never got that far.
 */
export type PlatformFixture = 'chatgpt' | 'claude' | 'mistral' | 'gemini' | 'perplexity' | 'copilot' | 'm365copilot';

export const PLATFORM_FIXTURES: readonly PlatformFixture[] = ['claude', 'chatgpt', 'mistral', 'gemini', 'perplexity', 'copilot', 'm365copilot'];

/**
 * Counts the Enter keys that reach the page, as the live sites' send-on-Enter listeners would see them.
 * A custom site's page takes it too (custom-site.spec.ts).
 */
export const ENTER_COUNTER = /* html */ `
    <script>
      window.__enterKeys = 0;
      document.addEventListener('keydown', (event) => {
        // Enter on a button presses that button; the live sites send on Enter typed in the input field or the page
        if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) { window.__enterKeys += 1; }
      });
    </script>`;

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
    <div class="ms-auto flex items-center gap-1.5" style="display: flex; gap: 6px; margin-top: 8px;"><button type="button">Voice</button></div>${ENTER_COUNTER}
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
      <div class="relative flex-1 flex items-center gap-2 shrink min-w-0" style="display: flex; gap: 8px; margin-top: 8px;">
        <div class="flex shrink"><button type="button">Tools</button></div>
      </div>
    </main>${ENTER_COUNTER}
  </body>
</html>
`;

/** A page with a plain input field and the action bar a Platform's strategy looks for. */
const plainPage = (title: string, field: string, bar: string): string => /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: sans-serif; margin: 24px; }
      .field { display: block; width: 480px; min-height: 120px; padding: 8px; border: 1px solid #ccc; white-space: pre-wrap; }
      .bar { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    </style>
  </head>
  <body>
    <main>
      ${field}
      ${bar}
    </main>${ENTER_COUNTER}
  </body>
</html>
`;

const MISTRAL_HTML = plainPage(
  'Le Chat',
  '<div class="field" contenteditable="true" aria-label="Ask Le Chat"></div>',
  '<div class="bar flex w-full max-w-full items-center justify-start gap-3"><button type="button">Tools</button><div class="flex ms-auto"><button type="button">Send</button></div></div>'
);

const GEMINI_HTML = plainPage(
  'Gemini',
  '<rich-textarea><div class="field ql-editor" contenteditable="true" role="textbox" data-placeholder="Ask Gemini"></div></rich-textarea>',
  '<div class="bar input-buttons-wrapper-bottom"><button type="button">Mic</button></div>'
);

const PERPLEXITY_HTML = plainPage(
  'Perplexity',
  '<div class="field" id="ask-input" contenteditable="true" role="textbox" aria-label="Ask anything"></div>',
  '<div class="bar flex items-center justify-self-end col-start-3 row-start-2"><button type="button">Voice</button></div>'
);

const COPILOT_HTML = plainPage(
  'Microsoft Copilot',
  '<textarea class="field" id="userInput" data-testid="composer-input" placeholder="Message Copilot"></textarea>',
  '<div class="bar"><div class="relative"><button type="button" data-testid="audio-call-button" aria-label="Talk to Copilot">Mic</button></div></div>'
);

const M365COPILOT_HTML = plainPage(
  'Microsoft 365 Copilot',
  '<span class="field" id="m365-chat-editor-target-element" data-lexical-editor="true" contenteditable="true" role="combobox" aria-label="Message Copilot"></span>',
  '<div class="bar fai-ChatInput__actions"><button type="button">Mic</button></div>'
);

/**
 * What a ProseMirror editor does with text it did not build itself: after each input it reads its
 * DOM back, and a line break found inside a text node is white space, so it becomes a space.
 * Lines typed, pasted or inserted through the browser's editing command arrive as paragraphs and
 * are left alone. The editor starts with the empty paragraph ProseMirror keeps.
 */
const PARAGRAPH_EDITOR = /* html */ `
    <script>
      document.execCommand('defaultParagraphSeparator', false, 'p');
      const editor = document.querySelector('.ProseMirror');
      editor.addEventListener('input', () => {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.nodeValue.includes('\\n')) { node.nodeValue = node.nodeValue.replace(/\\n/g, ' '); }
        }
      });
    </script>`;

const paragraphEditorPage = (title: string, field: string, bar: string): string =>
  plainPage(title, field, bar).replace('</body>', `${PARAGRAPH_EDITOR}\n  </body>`);

const CHATGPT_EDITOR_HTML = paragraphEditorPage(
  'ChatGPT',
  '<div class="field ProseMirror" id="prompt-textarea" contenteditable="true" role="textbox" aria-label="Chat with ChatGPT"><p><br></p></div>',
  '<div class="bar ms-auto flex items-center gap-1.5"><button type="button">Voice</button></div>'
);

const MISTRAL_EDITOR_HTML = paragraphEditorPage(
  'Le Chat',
  '<div class="field ProseMirror" contenteditable="true" aria-label="Ask Le Chat"><p><br></p></div>',
  '<div class="bar flex w-full max-w-full items-center justify-start gap-3"><button type="button">Tools</button><div class="flex ms-auto"><button type="button">Send</button></div></div>'
);

/**
 * What Perplexity's Lexical composer does with what an Insertion can send it (seen on the live
 * site on 2026-11-11). The editor keeps its own text and draws it: one <span> per line that has
 * text, one <br> between two lines, and a last <br> that keeps an empty last line open.
 * - A paste goes over the selection the editor knows of. It learns of a selection from the
 *   `selectionchange` event, and only one that runs from the start of its paragraph to its end
 *   covers the line breaks that end the field; any other paste lands after the text.
 * - Text from the editing command arrives with its line breaks dropped.
 * - An `input` event that carries text inserts that text again, after what the field holds.
 * - A Backspace key removes the last character.
 */
const LEXICAL_EDITOR = /* html */ `
    <script>
      const editor = document.querySelector('#ask-input');
      let text = '';
      let allSelected = false;
      const draw = () => {
        const paragraph = document.createElement('p');
        if (text === '') {
          paragraph.append(document.createElement('br'));
        } else {
          const lines = text.split('\\n');
          lines.forEach((line, index) => {
            if (line !== '') {
              const span = document.createElement('span');
              span.textContent = line;
              paragraph.append(span);
            }
            if (index < lines.length - 1) { paragraph.append(document.createElement('br')); }
          });
          if (lines.length > 1 && lines[lines.length - 1] === '') { paragraph.append(document.createElement('br')); }
        }
        editor.replaceChildren(paragraph);
        allSelected = false;
      };
      document.addEventListener('selectionchange', () => {
        const selection = document.getSelection();
        const paragraph = editor.querySelector('p');
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        allSelected = range !== null && paragraph !== null
          && range.startContainer === paragraph && range.startOffset === 0
          && range.endContainer === paragraph && range.endOffset === paragraph.childNodes.length;
      });
      editor.addEventListener('paste', (event) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData('text/plain');
        text = allSelected ? pasted : text + pasted;
        draw();
      });
      editor.addEventListener('beforeinput', (event) => {
        event.preventDefault();
        if (event.inputType === 'insertText' && event.data) {
          const typed = event.data.replace(/\\n/g, '');
          text = allSelected ? typed : text + typed;
          draw();
        }
      });
      editor.addEventListener('input', (event) => {
        if (typeof event.data === 'string' && event.data !== '') {
          text += event.data;
          draw();
        }
      });
      editor.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace') {
          event.preventDefault();
          text = text.slice(0, -1);
          draw();
        }
      });
      draw();
    </script>`;

const PERPLEXITY_EDITOR_HTML = plainPage(
  'Perplexity',
  '<div class="field" id="ask-input" data-lexical-editor="true" contenteditable="true" role="textbox" aria-label="Ask anything"></div>',
  '<div class="bar flex items-center justify-self-end col-start-3 row-start-2"><button type="button">Voice</button></div>'
).replace('</body>', `${LEXICAL_EDITOR}\n  </body>`);

/**
 * The stand-ins for the live composers that are rich text editors: ProseMirror on ChatGPT and
 * Mistral (see PARAGRAPH_EDITOR), Lexical on Perplexity (see LEXICAL_EDITOR).
 */
export type EditorFixture = 'chatgpt-editor' | 'mistral-editor' | 'perplexity-editor';

export const EDITOR_FIXTURES: readonly EditorFixture[] = ['chatgpt-editor', 'mistral-editor'];

/** The input field of each stand-in page. */
export const PLATFORM_FIELD: Record<PlatformFixture, string> = {
  chatgpt: '#prompt-textarea',
  claude: '.ProseMirror',
  mistral: '.field',
  gemini: '.ql-editor',
  perplexity: '#ask-input',
  copilot: '#userInput',
  m365copilot: '#m365-chat-editor-target-element',
};

const FIXTURES: Record<PlatformFixture | EditorFixture, { url: string; html: string }> = {
  'chatgpt-editor': { url: 'https://chatgpt.com/', html: CHATGPT_EDITOR_HTML },
  'mistral-editor': { url: 'https://chat.mistral.ai/', html: MISTRAL_EDITOR_HTML },
  'perplexity-editor': { url: 'https://www.perplexity.ai/', html: PERPLEXITY_EDITOR_HTML },
  chatgpt: { url: 'https://chatgpt.com/', html: CHATGPT_REACT_HTML },
  claude: { url: 'https://claude.ai/', html: CLAUDE_EDITOR_HTML },
  mistral: { url: 'https://chat.mistral.ai/', html: MISTRAL_HTML },
  gemini: { url: 'https://gemini.google.com/', html: GEMINI_HTML },
  perplexity: { url: 'https://www.perplexity.ai/', html: PERPLEXITY_HTML },
  copilot: { url: 'https://copilot.microsoft.com/', html: COPILOT_HTML },
  m365copilot: { url: 'https://m365.cloud.microsoft/', html: M365COPILOT_HTML },
};

const readReactScript = ({ module, file }: { module: string; file: string }): string => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'node_modules', file), 'utf8');
  return `window.__define(${JSON.stringify(module)}, function (module, exports, require) {\n${source}\n});`;
};

/**
 * Serves the Platform's stand-in page (and nothing else: other requests are aborted).
 * Returns the URL to open.
 */
export async function routePlatform(
  context: BrowserContext,
  platform: PlatformFixture | EditorFixture,
  options: { headers?: Record<string, string> } = {}
): Promise<string> {
  const { url, html } = FIXTURES[platform];

  await context.route(`${url}**`, async (route) => {
    const request = route.request();
    if (request.resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html, headers: options.headers });
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
export async function openPlatform(
  context: BrowserContext,
  platform: PlatformFixture | EditorFixture,
  options: { headers?: Record<string, string> } = {}
): Promise<Page> {
  const url = await routePlatform(context, platform, options);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return page;
}

/** How many Enter keys have reached the page (see ENTER_COUNTER). */
export const enterKeys = (page: Page) => page.evaluate(() => (window as unknown as { __enterKeys: number }).__enterKeys);

/** The Prompts button the extension adds to the Platform's input area. */
export const promptsButton = (page: Page) => page.locator('.prompt-library-pill');

/** The Prompt selector: a dialog in the extension's shadow root, which Playwright's locators pierce. */
export const promptSelector = (page: Page) => page.locator('#mpm-prompt-selector').getByRole('dialog');

/** The row of a Prompt in the open Prompt selector. */
export const promptRow = (page: Page, promptId: string) =>
  promptSelector(page).locator(`[role="option"][data-prompt-id="${promptId}"]`);

/** The titles the open Prompt selector lists, in order. */
export const listedTitles = (page: Page) => promptSelector(page).locator('.mpm-row-title').allTextContents();

/** Opens the Prompt selector from the Prompts button and waits for it. */
export async function openPromptSelector(page: Page): Promise<void> {
  await expect(promptsButton(page)).toHaveCount(1);
  await promptsButton(page).click();
  await expect(promptSelector(page)).toBeVisible();
}

/**
 * Chooses a Prompt as a user does: opens the Prompt selector from the Prompts button in
 * the input area and clicks the Prompt. Waits for the selector to close.
 *
 * A Prompt with Variables opens the variables step instead of inserting: `insertAsIs` then
 * inserts without filling anything in, the user's way to insert the text exactly as stored.
 */
export async function choosePrompt(
  page: Page,
  promptId: string,
  options: { insertAsIs?: boolean } = {}
): Promise<void> {
  await openPromptSelector(page);
  await promptRow(page, promptId).click();
  if (options.insertAsIs) {
    await promptSelector(page).getByRole('button', { name: /Insert into the chat/ }).click();
  }
  await expect(promptSelector(page)).toBeHidden();
}

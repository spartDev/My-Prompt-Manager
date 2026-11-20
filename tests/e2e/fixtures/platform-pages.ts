import fs from 'node:fs';
import path from 'node:path';

import type { BrowserContext, Page } from '@playwright/test';

import { expect } from './extension';

/**
 * Stand-in input areas for the seven Platforms, served on each Platform's own hostname by route
 * interception. The manifest's content_scripts match that hostname, so the extension's real
 * content script runs on these pages exactly as it does on the live site; only the page is
 * a fixture. Each page has the input field and the Toolbar, inside the composer element, that the
 * Platform's anchor chain (src/config/platforms.ts) looks for,
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
 * One more stands in for Perplexity's live composer, a Lexical editor: a real one, from the lexical
 * package at the version perplexity.ai serves. See lexicalEditor. Another runs the same editor in
 * the composer of copilot.cloud.microsoft, a Lexical editor too, with Copilot's own slash menu
 * written by hand (COPILOT_SLASH_MENU).
 *
 * The two pages of that composer are served at m365.cloud.microsoft: 2.0.0 does not run at
 * copilot.cloud.microsoft (ticket My-Prompt-Manager-totf), and M365 Copilot's selectors and anchor
 * chain take its composer on either host. Ticket My-Prompt-Manager-j74b serves them there again.
 *
 * And one keeps the Fluent composer m365.cloud.microsoft served before it redirected a work account
 * to copilot.cloud.microsoft, so the content script is proven to run on that host still.
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

/** A CommonJS module of node_modules a stand-in page loads, served at its path on the Platform's host. */
type ModuleScript = { module: string; file: string };

/** React 19 ships CommonJS only; the page loads these through a minimal require() (moduleScripts). */
const REACT_SCRIPTS: Record<string, ModuleScript> = {
  '/__e2e__/react.js': { module: 'react', file: 'react/cjs/react.production.js' },
  '/__e2e__/scheduler.js': { module: 'scheduler', file: 'scheduler/cjs/scheduler.production.js' },
  '/__e2e__/react-dom.js': { module: 'react-dom', file: 'react-dom/cjs/react-dom.production.js' },
  '/__e2e__/react-dom-client.js': {
    module: 'react-dom/client',
    file: 'react-dom/cjs/react-dom-client.production.js',
  },
};

/**
 * The lexical package and the @lexical/plain-text editor, with what they require, in the production
 * build, at the version pinned in package.json (0.41.0, what perplexity.ai serves).
 */
const LEXICAL_SCRIPTS: Record<string, ModuleScript> = {
  '/__e2e__/lexical.js': { module: 'lexical', file: 'lexical/Lexical.prod.js' },
  '/__e2e__/lexical-plain-text.js': { module: '@lexical/plain-text', file: '@lexical/plain-text/LexicalPlainText.prod.js' },
  '/__e2e__/lexical-clipboard.js': { module: '@lexical/clipboard', file: '@lexical/clipboard/LexicalClipboard.prod.js' },
  '/__e2e__/lexical-dragon.js': { module: '@lexical/dragon', file: '@lexical/dragon/LexicalDragon.prod.js' },
  '/__e2e__/lexical-extension.js': { module: '@lexical/extension', file: '@lexical/extension/LexicalExtension.prod.js' },
  '/__e2e__/lexical-html.js': { module: '@lexical/html', file: '@lexical/html/LexicalHtml.prod.js' },
  '/__e2e__/lexical-list.js': { module: '@lexical/list', file: '@lexical/list/LexicalList.prod.js' },
  '/__e2e__/lexical-selection.js': { module: '@lexical/selection', file: '@lexical/selection/LexicalSelection.prod.js' },
  '/__e2e__/lexical-utils.js': { module: '@lexical/utils', file: '@lexical/utils/LexicalUtils.prod.js' },
  '/__e2e__/preact-signals-core.js': { module: '@preact/signals-core', file: '@preact/signals-core/dist/signals-core.js' },
};

const MODULE_SCRIPTS: Record<string, ModuleScript> = { ...REACT_SCRIPTS, ...LEXICAL_SCRIPTS };

/**
 * The minimal require() a page loads CommonJS modules through, and the script tags of `scripts`:
 * each defines its module, required by the page's own script after them.
 */
const moduleScripts = (scripts: Record<string, ModuleScript>): string => /* html */ `
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
    ${Object.keys(scripts).map((src) => `<script src="${src}"></script>`).join('\n    ')}`;

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
    <form>
      <main id="root"></main>
      <div data-e2e="toolbar" style="display: flex; gap: 6px; margin-top: 8px;"><button type="button" aria-label="Dictate">Mic</button><button type="button" aria-label="Start Voice">Voice</button></div>
    </form>${ENTER_COUNTER}${moduleScripts(REACT_SCRIPTS)}
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
      <div>
        <div class="ProseMirror" contenteditable="true" role="textbox" data-testid="chat-input" aria-label="Write your prompt to Claude"></div>
        <div data-e2e="toolbar" style="display: flex; gap: 8px; margin-top: 8px;">
          <button type="button" data-testid="chat-input-attach" aria-label="Add files, connectors, and more">+</button>
          <div data-testid="composer-dictate"><button type="button" aria-label="Dictate">Mic</button></div>
          <button type="button" data-testid="chat-input-send" aria-label="Send message">Send</button>
        </div>
      </div>
    </main>${ENTER_COUNTER}
  </body>
</html>
`;

/**
 * A page with a plain input field and the Toolbar a Platform's anchor chain looks for, both in the
 * element the Platform's anchor chain takes for its composer (src/config/platforms.ts). The Toolbar is
 * marked data-e2e="toolbar", so a test can tell the button is in it.
 */
const plainPage = (title: string, field: string, bar: string, composer = 'form'): string => /* html */ `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: sans-serif; margin: 24px; }
      .field { display: block; width: 480px; min-height: 120px; padding: 8px; border: 1px solid #ccc; white-space: pre-wrap; }
      .bar { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
      fieldset { border: 0; margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <main>
      <${composer}>
        ${field}
        ${bar}
      </${composer.split(' ')[0]}>
    </main>${ENTER_COUNTER}
  </body>
</html>
`;

/** Mistral's action row: each button in a <div> of its own, as on the live composer (2026-11-17) */
const MISTRAL_BAR =
  '<div class="bar" data-e2e="toolbar"><div><button type="button">Fast</button></div><div><button type="button" aria-label="Voice Mode">Voice</button></div></div>';

const MISTRAL_HTML = plainPage(
  'Le Chat',
  '<div class="field" contenteditable="true" aria-label="Ask Le Chat"></div>',
  MISTRAL_BAR
);

const GEMINI_HTML = plainPage(
  'Gemini',
  '<rich-textarea><div class="field ql-editor" contenteditable="true" role="textbox" data-placeholder="Ask Gemini"></div></rich-textarea>',
  '<div class="bar trailing-actions-wrapper" data-e2e="toolbar"><div class="input-buttons-wrapper-bottom"><speech-dictation-mic-button><button type="button" aria-label="Dictate">Mic</button></speech-dictation-mic-button></div></div>',
  'fieldset class="input-area-fieldset"'
);

const PERPLEXITY_HTML = plainPage(
  'Perplexity',
  '<div class="field" id="ask-input" contenteditable="true" role="textbox" aria-label="Ask anything"></div>',
  '<div class="bar" data-e2e="toolbar"><div data-testid="ask-input-mode-toggle-indicator"></div><button type="button" aria-haspopup="menu" aria-label="Model">Model</button><button type="button" aria-label="Dictation">Mic</button></div>',
  'div'
);

const COPILOT_HTML = plainPage(
  'Microsoft Copilot',
  '<textarea class="field" id="userInput" data-testid="composer-input" placeholder="Message Copilot"></textarea>',
  '<div class="bar" data-e2e="toolbar"><div><button type="button" data-testid="audio-call-button" aria-label="Talk to Copilot">Mic</button></div></div>'
);

/** The Fluent composer m365.cloud.microsoft served before its redirect (reconstructed on 2026-11-11) */
const M365COPILOT_FLUENT_HTML = plainPage(
  'Microsoft 365 Copilot',
  '<span class="field" id="m365-chat-editor-target-element" data-lexical-editor="true" contenteditable="true" role="combobox" aria-label="Message Copilot"></span>',
  '<div class="bar fai-ChatInput__actions" data-e2e="toolbar"><button type="button">Mic</button></div>',
  'div class="fai-ChatInput"'
);

/**
 * The composer of Microsoft 365 Copilot where m365.cloud.microsoft and copilot.microsoft.com send a
 * work account, copilot.cloud.microsoft, as read on the live page on 2026-11-15 (ticket
 * My-Prompt-Manager-axv): the editor, a span in a span, in the composer div, which also holds the
 * plus menu in a div beside an svg, and the dictation button in a span, Fluent's actions
 * (.fai-BebopLiteChatInput__actions, read on 2026-11-18, ticket My-Prompt-Manager-14v). No send
 * button while the field is empty. The actions are the bar a test finds the Prompts button in.
 */
const M365COPILOT_FIELD =
  '<span><span class="field" data-lexical-editor="true" contenteditable="true" role="textbox" aria-label="Message Copilot"></span><span></span></span>';
const M365COPILOT_BAR =
  '<div><svg width="0" height="0"></svg><div><button type="button" data-testid="PlusMenuButton" aria-label="Add and manage sources">+</button></div></div>' +
  '<span class="bar fai-BebopLiteChatInput__actions" data-e2e="toolbar"><button type="button" aria-label="Start dictation">Mic</button></span>';

/** Its editor without the editor library, its toolbar on the page from the start */
const M365COPILOT_HTML = plainPage('Microsoft 365 Copilot', M365COPILOT_FIELD, M365COPILOT_BAR, 'div');

/**
 * The live page renders the plus menu and the dictation button after the editor (live check,
 * 2026-11-15): this stand-in takes them out before the content script runs, and puts them back a
 * moment after the Prompts button shows, noting in `window.__placementBeforeToolbar` where the
 * button was until then. Meanwhile the composer holds what the live page first shows, a shell
 * whose "+" is `chat-input-attach-button`, with no plus menu and no dictation button (live check,
 * 2026-11-16). On a loaded machine the real toolbar came 44 s later: `window.__toolbarDelay`, set
 * before the page loads, says after how many milliseconds it comes (500 otherwise).
 */
const LATE_TOOLBAR = /* html */ `
    <script>
      const composer = document.querySelector('[data-lexical-editor]').parentElement.parentElement;
      const late = Array.from(composer.children).slice(1);
      for (const element of late) { element.remove(); }
      const shell = document.createElement('div');
      shell.innerHTML = '<button type="button" data-testid="chat-input-attach-button" aria-label="Add">+</button>';
      composer.append(shell);
      const render = () => {
        window.__placementBeforeToolbar = document.querySelector('[data-mpm-placement]')?.getAttribute('data-mpm-placement') ?? null;
        shell.remove();
        composer.append(...late);
      };
      const waitForButton = new MutationObserver(() => {
        if (document.querySelector('[data-mpm-placement]')) {
          waitForButton.disconnect();
          window.setTimeout(render, window.__toolbarDelay ?? 500);
        }
      });
      waitForButton.observe(document.body, { childList: true, subtree: true, attributes: true });
    </script>`;

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

const paragraphEditorPage = (title: string, field: string, bar: string, composer?: string): string =>
  plainPage(title, field, bar, composer).replace('</body>', `${PARAGRAPH_EDITOR}\n  </body>`);

const CHATGPT_EDITOR_HTML = paragraphEditorPage(
  'ChatGPT',
  '<div class="field ProseMirror" id="prompt-textarea" contenteditable="true" role="textbox" aria-label="Chat with ChatGPT"><p><br></p></div>',
  '<div class="bar" data-e2e="toolbar"><button type="button" aria-label="Dictate">Mic</button><button type="button" aria-label="Start Voice">Voice</button></div>',
  'fieldset'
);

const MISTRAL_EDITOR_HTML = paragraphEditorPage(
  'Le Chat',
  '<div class="field ProseMirror" contenteditable="true" aria-label="Ask Le Chat"><p><br></p></div>',
  MISTRAL_BAR
);

/**
 * The Lexical composer of Perplexity and of Microsoft 365 Copilot: a real Lexical editor, from the
 * lexical package at the version perplexity.ai serves (0.41, My-Prompt-Manager-9o0), with
 * @lexical/plain-text, mounted on the page's field. Plain text, as the live editors lay pasted text
 * out: one paragraph, its lines one <span> each with a <br> between two (seen on 2026-11-11), where
 * the rich text editor makes a paragraph per line. Everything the editor does with a paste, the
 * editing command, an `input` or `beforeinput` event, a Backspace or a DOM change made behind its
 * back is Lexical's own (My-Prompt-Manager-hai).
 *
 * `platform` is the script of what the Platform adds to the editor, run before the editor is made:
 * it may push node classes onto `nodes` and set `registerPlatform(editor)`.
 */
const lexicalEditor = (field: string, platform = ''): string => /* html */ `${moduleScripts(LEXICAL_SCRIPTS)}
    <script>
      {
        const { $createParagraphNode, $getRoot, createEditor } = window.__require('lexical');
        const { registerPlainText } = window.__require('@lexical/plain-text');
        const root = document.querySelector(${JSON.stringify(field)});
        const nodes = [];
        let registerPlatform = () => {};
        ${platform}
        const editor = createEditor({ namespace: 'stand-in', nodes, onError: (error) => { throw error; } });
        editor.setRootElement(root);
        registerPlainText(editor);
        registerPlatform(editor);
        editor.update(() => {
          if ($getRoot().isEmpty()) { $getRoot().append($createParagraphNode()); }
        });
      }
    </script>`;

/**
 * Copilot's own slash menu, seen on the live page on 2026-11-15: a slash opens a list of recent
 * files. While it is open the editor's paragraph ends with two text spans hidden from assistive
 * technology, an empty one and one holding a zero-width space and a zero-width non-joiner, the
 * caret staying at the end of the slashes' text (read on the live page on 2026-11-16):
 * `<span data-lexical-text>//</span><span aria-hidden data-lexical-text></span><span aria-hidden
 * data-lexical-text>U+200B U+200C</span>`. Here they are text nodes of the editor's, of a type of
 * their own, as Copilot's are. The menu closes once the slash is gone. The stand-in also takes the
 * worst a menu may do: while it is open, the keys and the text typed stop at the editor. And while
 * it is open the editor puts back a // the browser's editing command deletes (read live on
 * 2026-11-16): Copilot's own doing, which Lexical 0.41 alone does not do with a deletion inside a
 * text. A deleteContentBackward beforeinput, Lexical handles itself, as Backspace.
 */
const COPILOT_SLASH_MENU = /* js */ `
        const { TextNode } = window.__require('lexical');
        class HiddenMarkNode extends TextNode {
          static getType() { return 'copilot-hidden-mark'; }
          static clone(node) { return new HiddenMarkNode(node.__text, node.__key); }
          static importJSON(json) { return new HiddenMarkNode(json.text); }
          createDOM(config, editor) {
            const span = super.createDOM(config, editor);
            span.setAttribute('aria-hidden', 'true');
            return span;
          }
        }
        nodes.push(HiddenMarkNode);
        let menu = null;
        for (const type of ['keydown', 'beforeinput', 'input']) {
          root.addEventListener(type, (event) => { if (menu) { event.stopPropagation(); } });
        }
        // While the menu is open, the editor does not take a deletion the browser made behind its
        // back (the editing command): it draws its own text again, the caret where it was (read live
        // on 2026-11-16). Its state is kept here, before Lexical hears of the change, and set back
        // once Lexical has taken it
        let copilotEditor = null;
        let beforeDeletion = null;
        root.addEventListener('input', (event) => {
          if (menu && copilotEditor && event.inputType.startsWith('delete')) { beforeDeletion = copilotEditor.getEditorState(); }
        });
        registerPlatform = (editor) => {
          copilotEditor = editor;
          root.addEventListener('input', () => {
            if (beforeDeletion) {
              const state = beforeDeletion;
              beforeDeletion = null;
              editor.setEditorState(state);
            }
          });
          editor.registerUpdateListener(({ editorState }) => {
            const slash = editorState.read(() => $getRoot().getAllTextNodes()
              .some((node) => !(node instanceof HiddenMarkNode) && node.getTextContent().includes('/')));
            if (slash && !menu) {
              menu = document.createElement('div');
              menu.setAttribute('role', 'listbox');
              menu.setAttribute('data-e2e', 'slash-menu');
              menu.textContent = 'Opened by you';
              document.body.append(menu);
              // A state set back after a deletion (above) holds its marks already: the menu opens
              // again, and the paragraph keeps its one pair
              editor.update(() => {
                const paragraph = $getRoot().getLastChild();
                if (paragraph && !paragraph.getChildren().some((node) => node instanceof HiddenMarkNode)) {
                  paragraph.append(new HiddenMarkNode(''), new HiddenMarkNode('\\u200B\\u200C'));
                }
              });
            } else if (!slash && menu) {
              menu.remove();
              menu = null;
              editor.update(() => {
                for (const node of $getRoot().getAllTextNodes()) { if (node instanceof HiddenMarkNode) { node.remove(); } }
              });
            }
          });
        };`;

const PERPLEXITY_EDITOR_HTML = plainPage(
  'Perplexity',
  '<div class="field" id="ask-input" data-lexical-editor="true" contenteditable="true" role="textbox" aria-label="Ask anything"></div>',
  '<div class="bar" data-e2e="toolbar"><div data-testid="ask-input-mode-toggle-indicator"></div><button type="button" aria-haspopup="menu" aria-label="Model">Model</button><button type="button" aria-label="Dictation">Mic</button></div>',
  'div'
).replace('</body>', `${lexicalEditor('#ask-input')}\n  </body>`);

/**
 * Microsoft 365 Copilot where a work account lands, copilot.cloud.microsoft: its composer
 * (M365COPILOT_FIELD), its toolbar rendered after the editor and the Prompts button
 * (LATE_TOOLBAR), the same Lexical editor as Perplexity's (lexicalEditor), and Copilot's own slash
 * menu (COPILOT_SLASH_MENU). Served at m365.cloud.microsoft (see the header).
 */
const M365COPILOT_EDITOR_HTML = plainPage('Microsoft 365 Copilot', M365COPILOT_FIELD, M365COPILOT_BAR, 'div')
  .replace('</body>', `${lexicalEditor('[data-lexical-editor]', COPILOT_SLASH_MENU)}${LATE_TOOLBAR}\n  </body>`);

/**
 * The stand-ins for the live composers that are rich text editors: ProseMirror on ChatGPT and
 * Mistral (see PARAGRAPH_EDITOR), Lexical on Perplexity and on Microsoft 365 Copilot (see lexicalEditor).
 */
export type EditorFixture = 'chatgpt-editor' | 'mistral-editor' | 'perplexity-editor' | 'm365copilot-editor' | 'm365copilot-fluent';

export const EDITOR_FIXTURES: readonly EditorFixture[] = ['chatgpt-editor', 'mistral-editor'];

/** Every stand-in page: the seven Platforms, the rich text editors four of them have live, and the composer M365 Copilot had at m365.cloud.microsoft. */
export const ALL_FIXTURES: readonly (PlatformFixture | EditorFixture)[] = [...PLATFORM_FIXTURES, ...EDITOR_FIXTURES, 'perplexity-editor', 'm365copilot-editor', 'm365copilot-fluent'];

/** The input field of each stand-in page. */
export const PLATFORM_FIELD: Record<PlatformFixture | EditorFixture, string> = {
  'chatgpt-editor': '#prompt-textarea',
  'mistral-editor': '.field',
  'perplexity-editor': '#ask-input',
  'm365copilot-editor': '[data-lexical-editor]',
  'm365copilot-fluent': '#m365-chat-editor-target-element',
  chatgpt: '#prompt-textarea',
  claude: '.ProseMirror',
  mistral: '.field',
  gemini: '.ql-editor',
  perplexity: '#ask-input',
  copilot: '#userInput',
  m365copilot: '[data-lexical-editor]',
};

const FIXTURES: Record<PlatformFixture | EditorFixture, { url: string; html: string }> = {
  'chatgpt-editor': { url: 'https://chatgpt.com/', html: CHATGPT_EDITOR_HTML },
  'mistral-editor': { url: 'https://chat.mistral.ai/', html: MISTRAL_EDITOR_HTML },
  'perplexity-editor': { url: 'https://www.perplexity.ai/', html: PERPLEXITY_EDITOR_HTML },
  // The composer of copilot.cloud.microsoft, where 2.0.0 does not run (see the header)
  'm365copilot-editor': { url: 'https://m365.cloud.microsoft/', html: M365COPILOT_EDITOR_HTML },
  'm365copilot-fluent': { url: 'https://m365.cloud.microsoft/', html: M365COPILOT_FLUENT_HTML },
  chatgpt: { url: 'https://chatgpt.com/', html: CHATGPT_REACT_HTML },
  claude: { url: 'https://claude.ai/', html: CLAUDE_EDITOR_HTML },
  mistral: { url: 'https://chat.mistral.ai/', html: MISTRAL_HTML },
  gemini: { url: 'https://gemini.google.com/', html: GEMINI_HTML },
  perplexity: { url: 'https://www.perplexity.ai/', html: PERPLEXITY_HTML },
  copilot: { url: 'https://copilot.microsoft.com/', html: COPILOT_HTML },
  m365copilot: { url: 'https://m365.cloud.microsoft/', html: M365COPILOT_HTML },
};

const readModuleScript = ({ module, file }: ModuleScript): string => {
  const source = fs.readFileSync(path.resolve(process.cwd(), 'node_modules', file), 'utf8');
  return `window.__define(${JSON.stringify(module)}, function (module, exports, require) {\n${source}\n});`;
};

/**
 * Serves the Platform's stand-in page (and nothing else: other requests are aborted), at its
 * Platform's host or at `options.url`. Returns the URL to open.
 */
export async function routePlatform(
  context: BrowserContext,
  platform: PlatformFixture | EditorFixture,
  options: { headers?: Record<string, string>; url?: string } = {}
): Promise<string> {
  const { html } = FIXTURES[platform];
  const url = options.url ?? FIXTURES[platform].url;

  await context.route(`${url}**`, async (route) => {
    const request = route.request();
    if (request.resourceType() === 'document') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: html, headers: options.headers });
      return;
    }

    const script = MODULE_SCRIPTS[new URL(request.url()).pathname];
    if (script) {
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: readModuleScript(script) });
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
  options: { headers?: Record<string, string>; url?: string } = {}
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

/**
 * How long an opening of the Prompt selector may take. The first one in a page also loads React
 * and reads the Library: four to six times a later opening when the CPU is short (180 ms against
 * 79, 4.5 s against 0.75 s at 40 times slower), which went past the 10 s of an assertion on a
 * loaded machine (PR #576, 2026-11-16).
 */
const OPENING_TIMEOUT = 30_000;

/** Waits for the Prompt selector to show, as long as an opening may take (OPENING_TIMEOUT). */
export async function expectSelectorOpen(page: Page): Promise<void> {
  await expect(promptSelector(page)).toBeVisible({ timeout: OPENING_TIMEOUT });
}

/** Opens the Prompt selector from the Prompts button and waits for it. */
export async function openPromptSelector(page: Page): Promise<void> {
  await expect(promptsButton(page)).toHaveCount(1);
  await promptsButton(page).click();
  await expectSelectorOpen(page);
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

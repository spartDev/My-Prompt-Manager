/**
 * On a built-in Platform, the input field the Prompts button goes on is a textarea or an editable
 * element: the catch-all selectors (DefaultStrategy's `input[type="text"]`, ChatGPT's
 * `[class*="input"]`) put it on a search box, or on a sidebar row, on pages without a composer
 * (seen live on 2026-11-18, ticket My-Prompt-Manager-b24). A custom site keeps every catch-all.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatformManager } from '../platform-manager';

vi.mock('../../utils/storage', () => ({
  getSettings: vi.fn().mockResolvedValue({ customSites: [], debugMode: false })
}));

/**
 * A row of ChatGPT's sidebar, reconstructed from the live page: its `[&_input]:pointer-events-auto`
 * class matches ChatGPT's `[class*="input"]`. The conversation id and title are made up.
 */
const CHATGPT_SIDEBAR = /* html */ `
  <nav>
    <div class="flex flex-col" role="list" tabindex="-1">
      <div class="touch-pan-y" role="listitem">
        <div class="contents">
          <div data-sidebar-archive-chatgpt-id="00000000-0000-0000-0000-000000000000" aria-label="A conversation"
            class="group relative cursor-interaction text-sm pointer-events-none isolate [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto sidebar-item">
            <div class="flex h-full w-full items-center text-sm"><a href="/c/00000000">A conversation</a></div>
          </div>
        </div>
      </div>
    </div>
  </nav>`;

/** The search box of ChatGPT's pages, its wrappers as on the live page */
function chatgptSearchBox(id: string, placeholder: string): string {
  return /* html */ `
    <div class="no-drag flex items-center gap-2 border border-primary-outline rounded-full min-w-0 flex-1">
      <input id="${id}" class="min-w-0 flex-1 bg-transparent text-default outline-none select-text placeholder:text-tertiary"
        autocomplete="off" placeholder="${placeholder}" type="text" value="">
    </div>`;
}

/** chatgpt.com/gpts: the Search GPTs box above the GPT store */
const CHATGPT_GPTS = /* html */ `
  ${CHATGPT_SIDEBAR}
  <main>
    <div class="contents"><div class="bg-surface top-0">
      <div class="mx-auto flex w-full items-center gap-2 pb-2">${chatgptSearchBox('gpt-search', 'Search GPTs')}</div>
    </div></div>
    <h1>GPTs</h1>
  </main>`;

/** chatgpt.com/library: the Search library box in the toolbar */
const CHATGPT_LIBRARY = /* html */ `
  ${CHATGPT_SIDEBAR}
  <main>
    <div class="actions-hHaS5d"><div class="toolbar-wpnXAF"><div class="search-gLCdCn" data-fixed-width="true">
      ${chatgptSearchBox('library-search-_r_jl_', 'Search library')}
    </div></div></div>
    <h1>Library</h1>
  </main>`;

/** chatgpt.com/gpts/mine: no field at all, only the sidebar */
const CHATGPT_GPTS_MINE = /* html */ `
  ${CHATGPT_SIDEBAR}
  <main><h1>My GPTs</h1><a href="/gpts/editor">Create a GPT</a></main>`;

/** gemini.google.com/customize/connectors (where /apps leads): the search bar of the header, in French */
const GEMINI_CONNECTORS = /* html */ `
  <main>
    <header class="page-header">
      <div class="header-actions">
        <gem-search-bar role="search" class="search-bar">
          <div class="search-container">
            <input type="text" class="search-input gds-body-m" placeholder="Rechercher">
          </div>
        </gem-search-bar>
      </div>
    </header>
  </main>`;

function composer(name: string): string {
  return readFileSync(resolve(__dirname, `../../../../tests/fixtures/composers/${name}.html`), 'utf8');
}

const realLocation = window.location;

/** A PlatformManager on this host, at this path */
async function managerAt(hostname: string, pathname: string): Promise<PlatformManager> {
  Object.defineProperty(window, 'location', {
    value: { hostname, pathname, href: `https://${hostname}${pathname}` },
    writable: true,
    configurable: true
  });
  const manager = new PlatformManager();
  await manager.initializeStrategies();
  return manager;
}

/** The elements of the page that the manager's selectors match */
function matchedFields(manager: PlatformManager): Element[] {
  return manager.getAllSelectors().flatMap((selector) => Array.from(document.querySelectorAll(selector)));
}

describe('the input fields of a built-in Platform', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', { value: realLocation, writable: true, configurable: true });
  });

  it.each([
    ['chatgpt.com', '/gpts', CHATGPT_GPTS],
    ['chatgpt.com', '/library', CHATGPT_LIBRARY],
    ['chatgpt.com', '/gpts/mine', CHATGPT_GPTS_MINE],
    ['gemini.google.com', '/customize/connectors', GEMINI_CONNECTORS]
  ])('on %s%s nothing is matched: neither the search box nor a sidebar row', async (hostname, pathname, page) => {
    document.body.innerHTML = page;
    const manager = await managerAt(hostname, pathname);

    expect(matchedFields(manager)).toEqual([]);
  });

  it.each([
    ['chatgpt.com', '/', `${CHATGPT_SIDEBAR}${composer('chatgpt')}`, '[contenteditable="true"]'],
    ['chatgpt.com', '/images', `${CHATGPT_SIDEBAR}${composer('chatgpt')}`, '[contenteditable="true"]'],
    ['claude.ai', '/new', composer('claude'), '[contenteditable="true"]'],
    ['gemini.google.com', '/app', composer('gemini'), '.ql-editor'],
    ['chat.mistral.ai', '/work', composer('mistral'), '[contenteditable="true"]'],
    ['www.perplexity.ai', '/', composer('perplexity'), '[contenteditable="true"]'],
    ['copilot.microsoft.com', '/', composer('copilot'), 'textarea'],
    // The composer read at copilot.cloud.microsoft, where 2.0.0 does not run (ticket My-Prompt-Manager-totf)
    ['m365.cloud.microsoft', '/chat', composer('m365copilot'), '[data-lexical-editor]']
  ])('on %s%s the composer is the first field matched', async (hostname, pathname, page, editorSelector) => {
    document.body.innerHTML = page;
    const editor = document.querySelector(editorSelector);
    const manager = await managerAt(hostname, pathname);

    expect(editor).not.toBeNull();
    expect(matchedFields(manager)[0]).toBe(editor);
  });

  it('on a site that is not a built-in Platform, a text box is still matched', async () => {
    document.body.innerHTML = '<form><input type="text" placeholder="Ask anything"></form>';
    const field = document.querySelector('input');
    const manager = await managerAt('chat.example.com', '/');

    expect(matchedFields(manager)).toContain(field);
  });
});

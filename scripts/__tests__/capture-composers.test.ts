import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SUPPORTED_PLATFORMS } from '../../src/config/platforms';
import { resolveIconPlacement } from '../../src/content/core/icon-placement';
import { parseCaptureArgs, rulesFor } from '../capture-composers';
import { classNamesOf, composerFixture, EDITOR_MARKER, sanitizeComposer, sanitizeRulesOf, serializeComposer } from '../composers/sanitize';

const FIXTURES = path.resolve(__dirname, '../../tests/fixtures/composers');

/** Puts live-like markup in the page and returns its first element, the composer */
function composerOf(html: string): Element {
  document.body.innerHTML = html;
  return document.body.firstElementChild as Element;
}

describe('sanitizeComposer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the structure and what the selectors read, and removes what the user wrote and how the page looks', () => {
    const composer = composerOf(`
      <form class="w-full" style="color:red" action="https://chatgpt.com/backend">
        <div class="flex"><div class="grow">
          <div ${EDITOR_MARKER} contenteditable="true" role="textbox" id="prompt-textarea" class="ProseMirror" aria-label="Ask"><p>my secret draft</p></div>
        </div></div>
        <!-- a comment -->
        <div data-testid="composer-trailing-actions" id=":r1a:">
          <button type="button" aria-label="Dictate" title="Dictate" class="btn"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M0 0h24"></path></svg>Dictate</button>
          <a href="https://chatgpt.com/c/123" aria-label="Open thomas@example.com's workspace"><img src="https://cdn/avatar.png" alt="Thomas"></a>
          <script>track()</script>
        </div>
      </form>`);

    sanitizeComposer(composer, rulesFor(SUPPORTED_PLATFORMS.chatgpt));

    expect(serializeComposer(composer)).toBe([
      '<form>',
      '  <div contenteditable="true" role="textbox" class="ProseMirror"><p></p></div>',
      '  <div data-testid="composer-trailing-actions">',
      '    <button type="button" aria-label="Dictate">',
      '      <svg></svg>',
      '    </button>',
      '    <a></a>',
      '  </div>',
      '</form>'
    ].join('\n'));
  });

  it('keeps only the attributes the selectors read: nothing that names the user', () => {
    const composer = composerOf(`
      <form data-user-id="12345" data-account-name="Alice">
        <button type="button" aria-label="Alice's profile" data-user-id="12345"></button>
        <button type="button" aria-label="Start dictation" aria-haspopup="menu"></button>
      </form>`);

    sanitizeComposer(composer, sanitizeRulesOf(['form', 'button[aria-label*="dictation" i]']));

    expect(serializeComposer(composer)).toBe([
      '<form>',
      '  <button type="button"></button>',
      '  <button type="button" aria-label="Start dictation"></button>',
      '</form>'
    ].join('\n'));
  });

  it('keeps an attribute a selector names without a value, but not its value', () => {
    const composer = composerOf('<div><span data-lexical-editor="alice-draft" contenteditable="true"></span></div>');

    sanitizeComposer(composer, sanitizeRulesOf(['[data-lexical-editor]']));

    expect(serializeComposer(composer)).toBe('<div>\n  <span data-lexical-editor contenteditable="true"></span>\n</div>');
  });

  it('reads every kind of attribute condition, ids included', () => {
    const rules = sanitizeRulesOf(['span[id="m365-chat-editor-target-element"]', '#userInput', 'textarea[placeholder^="Ask"]', 'div[data-x$=\'end\']']);
    const composer = composerOf(
      '<div><span id="m365-chat-editor-target-element"></span><span id="radix-12"></span><textarea id="userInput" placeholder="Ask anything"></textarea>'
      + '<textarea placeholder="Alice, ask anything"></textarea><div data-x="the-end"></div></div>'
    );

    sanitizeComposer(composer, rules);

    expect(serializeComposer(composer)).toBe([
      '<div>',
      '  <span id="m365-chat-editor-target-element"></span>',
      '  <span></span>',
      '  <textarea id="userInput" placeholder="Ask anything"></textarea>',
      '  <textarea></textarea>',
      '  <div data-x="the-end"></div>',
      '</div>'
    ].join('\n'));
  });

  it('never folds the composer itself, so its selector still finds it', () => {
    const composer = composerOf('<div><div data-testid="toolbar"><button aria-label="Send"></button></div></div>');

    sanitizeComposer(composer, sanitizeRulesOf(['button[aria-label="Send"]']));

    expect(serializeComposer(composer)).toBe([
      '<div>',
      '  <div data-testid="toolbar">',
      '    <button aria-label="Send"></button>',
      '  </div>',
      '</div>'
    ].join('\n'));
  });

  it.each(Object.keys(SUPPORTED_PLATFORMS))('leaves the %s fixture as it is: its chain resolves just the same once sanitized again', (platformId) => {
    // Parsed, not cut with a pattern: the header comment is a node the composer is not part of
    const composer = composerOf(readFileSync(path.join(FIXTURES, `${platformId}.html`), 'utf8'));
    const editor = composer.querySelector('[contenteditable="true"], textarea') as HTMLElement;
    editor.setAttribute(EDITOR_MARKER, '');

    sanitizeComposer(composer, rulesFor(SUPPORTED_PLATFORMS[platformId]));
    const fixture = composerFixture(composer, { platformName: 'X', url: 'https://x/', date: '2026-11-15', composerFound: true });
    document.body.innerHTML = fixture;
    const captured = document.querySelector<HTMLElement>('[contenteditable="true"], textarea') as HTMLElement;

    expect(fixture).not.toContain(EDITOR_MARKER);
    expect(resolveIconPlacement(captured, SUPPORTED_PLATFORMS[platformId].iconPlacement)?.index).toBe(0);
  });

  it('keeps the class names the chain names, and only those', () => {
    const composer = composerOf('<div class="fai-ChatInput ___hashed1 x9"><div class="fai-ChatInput__actions flex"><button type="submit"></button></div></div>');

    sanitizeComposer(composer, sanitizeRulesOf(['.fai-ChatInput', '.fai-ChatInput__actions', 'button[type="submit"]']));

    expect(serializeComposer(composer)).toBe([
      '<div class="fai-ChatInput">',
      '  <div class="fai-ChatInput__actions">',
      '    <button type="submit"></button>',
      '  </div>',
      '</div>'
    ].join('\n'));
  });

  it('reads the class names of selectors, not their attribute values', () => {
    expect(classNamesOf(['.fai-ChatInput', 'div.ms-auto > button[aria-label="v1.2"]'])).toEqual(['fai-ChatInput', 'ms-auto']);
  });

  it('says in the header when the composer selector found nothing', () => {
    const composer = composerOf('<div></div>');

    expect(composerFixture(composer, { platformName: 'Claude', url: 'https://claude.ai/new', date: '2026-11-15', composerFound: false }))
      .toContain('The composer selector of its chain found nothing');
  });
});

describe('parseCaptureArgs', () => {
  it('captures every Platform from the signed-in Chrome profile into the committed fixtures by default', () => {
    const options = parseCaptureArgs([], {});

    expect(options).toMatchObject({ only: [], urls: {}, channel: 'chrome', headless: false, login: false, runTests: true });
    expect(options.out).toBe(FIXTURES);
  });

  it('reads a stand-in run', () => {
    const options = parseCaptureArgs(
      ['--only', 'claude,chatgpt', '--url', 'claude=http://127.0.0.1:8080/c.html?a=b', '--out', '/tmp/fx', '--headless', '--channel', 'chromium', '--no-test', '--settle', '0'],
      { COMPOSERS_PROFILE: '/tmp/profile' }
    );

    expect(options).toMatchObject({
      only: ['claude', 'chatgpt'],
      urls: { claude: 'http://127.0.0.1:8080/c.html?a=b' },
      out: '/tmp/fx',
      profile: '/tmp/profile',
      channel: 'chromium',
      headless: true,
      runTests: false,
      settle: 0
    });
  });

  it.each([
    [['--only', 'bard'], 'Unknown platform bard'],
    [['--url', 'claude'], '--url takes <platform>=<url>'],
    [['--out'], '--out needs a value'],
    [['--timeout', 'soon'], '--timeout takes milliseconds'],
    [['--fast'], 'Unknown option --fast']
  ])('refuses %j', (argv, message) => {
    expect(() => parseCaptureArgs(argv, {})).toThrow(message);
  });
});

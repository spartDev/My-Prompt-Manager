import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SUPPORTED_PLATFORMS } from '../../src/config/platforms';
import { resolveIconPlacement } from '../../src/content/core/icon-placement';
import { headerUrl, parseCaptureArgs, rulesFor } from '../capture-composers';
import { composerFixturePath } from '../composers/fixtures';
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
      '  <div>',
      '    <button type="button" aria-label="dictate">',
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
      '  <button type="button" aria-label="dictation"></button>',
      '</form>'
    ].join('\n'));
  });

  it('writes the selector\'s value, not the page\'s: what the user typed in a placeholder is gone, the selector still matches', () => {
    const composer = composerOf('<form><textarea placeholder="Message Alice"></textarea></form>');

    sanitizeComposer(composer, rulesFor(SUPPORTED_PLATFORMS.chatgpt));

    expect(serializeComposer(composer)).toBe('<form>\n  <textarea placeholder="Message"></textarea>\n</form>');
    expect(composer.querySelector('textarea[placeholder*="Message"]')).not.toBeNull();
  });

  it('writes a value that meets every condition the live one met', () => {
    const composer = composerOf('<div><button aria-label="Send message to Alice"></button></div>');

    sanitizeComposer(composer, sanitizeRulesOf(['[aria-label^="Send"]', '[aria-label*="message"]']));

    expect(serializeComposer(composer)).toBe('<div>\n  <button aria-label="Send message"></button>\n</div>');
  });

  it.each([
    ['an e-mail', '<div><button data-testid="alice@example.com"></button></div>', ['[data-testid*="@"]']],
    ['an address', '<div><button data-testid="https://example.com/u/alice"></button></div>', ['[data-testid^="https:"]']]
  ] as const)('drops a kept value that looks like %s, even one a selector writes', (_case, html, selectors) => {
    const composer = composerOf(html);

    sanitizeComposer(composer, sanitizeRulesOf(selectors));

    expect(serializeComposer(composer)).toBe('<div>\n  <button></button>\n</div>');
  });

  it.each([
    ['a test id no selector names', '<div><b data-testid="user-menu-alice-smith"></b></div>', '<div>\n  <b></b>\n</div>'],
    ['a role that is not an ARIA role', '<div><b role="alice"></b><b role="switch alice"></b></div>', '<div>\n  <b></b>\n  <b role="switch"></b>\n</div>'],
    ['a type that is no button or input type', '<div><button type="alice"></button></div>', '<div>\n  <button></button>\n</div>'],
    ['a contenteditable that is not true, false or plaintext-only', '<div><b contenteditable="alice"></b></div>', '<div>\n  <b></b>\n</div>'],
    ['an editor class no selector names', `<div><div ${EDITOR_MARKER} contenteditable="true" class="ProseMirror user-alice-smith"></div></div>`, '<div>\n  <div contenteditable="true" class="ProseMirror"></div>\n</div>']
  ] as const)('drops %s', (_case, html, expected) => {
    const composer = composerOf(html);

    sanitizeComposer(composer, rulesFor(SUPPORTED_PLATFORMS.claude));

    expect(serializeComposer(composer)).toBe(expected);
  });

  it('joins a prefix first and a suffix last when no one value meets every condition', () => {
    const composer = composerOf('<div><button aria-label="Send the message"></button></div>');

    sanitizeComposer(composer, sanitizeRulesOf(['[aria-label$="message"]', '[aria-label^="Send"]']));

    expect(serializeComposer(composer)).toBe('<div>\n  <button aria-label="Send message"></button>\n</div>');
  });

  it('keeps an attribute a selector names both bare and with a value, whatever its value', () => {
    const composer = composerOf('<div><span data-mode="alice-draft"></span><span data-mode="compact"></span></div>');

    sanitizeComposer(composer, sanitizeRulesOf(['[data-mode]', '[data-mode="compact"]']));

    expect(serializeComposer(composer)).toBe('<div>\n  <span data-mode></span>\n  <span data-mode="compact"></span>\n</div>');
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
      '  <textarea id="userInput" placeholder="Ask"></textarea>',
      '  <textarea></textarea>',
      '  <div data-x="end"></div>',
      '</div>'
    ].join('\n'));
  });

  it('never folds the composer itself, so its selector still finds it', () => {
    const composer = composerOf('<div><div data-testid="toolbar"><button aria-label="Send"></button></div></div>');

    sanitizeComposer(composer, sanitizeRulesOf(['button[aria-label="Send"]']));

    // The test id no selector names is dropped, its wrapper folded; the composer, as bare, stays
    expect(serializeComposer(composer)).toBe('<div>\n  <button aria-label="Send"></button>\n</div>');
  });

  it.each(Object.keys(SUPPORTED_PLATFORMS))('the committed %s fixture is what the sanitizer writes: sanitized again, it is unchanged and its chain resolves', (platformId) => {
    // Parsed, not cut with a pattern: the header comment is a node the composer is not part of
    const composer = composerOf(readFileSync(path.join(FIXTURES, `${platformId}.html`), 'utf8'));
    const committed = serializeComposer(composer);
    const editor = composer.querySelector('[contenteditable="true"], textarea') as HTMLElement;
    editor.setAttribute(EDITOR_MARKER, '');

    sanitizeComposer(composer, rulesFor(SUPPORTED_PLATFORMS[platformId]));
    expect(serializeComposer(composer).replace(/\n\s*/g, '')).toBe(committed.replace(/\n\s*/g, ''));
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

describe('headerUrl', () => {
  it('names a local stand-in file without its home path, and a web address as it is', () => {
    expect(headerUrl('file:///Users/alice/stand-ins/claude.html')).toBe('file://<stand-in>/claude.html');
    expect(headerUrl('http://127.0.0.1:8080/claude.html')).toBe('http://127.0.0.1:8080/claude.html');
    expect(headerUrl('https://claude.ai/new')).toBe('https://claude.ai/new');
  });

  it('names a web address by its protocol, host and path only: no user name, password, query or fragment', () => {
    const url = new URL('https://chat.example.com/c/123');
    url.username = 'alice';
    url.password = 'x';
    url.search = '?token=abc';
    url.hash = '#x';

    expect(headerUrl(url.href)).toBe('https://chat.example.com/c/123');
  });

  it('names an address it cannot parse as a stand-in, not as it is', () => {
    expect(headerUrl('not a url?token=abc')).toBe('<stand-in>');
  });
});

describe('composerFixturePath', () => {
  const committed = '/repo/tests/fixtures/composers';

  it('reads the committed fixtures outside a capture', () => {
    expect(composerFixturePath('claude', committed, {})).toBe('/repo/tests/fixtures/composers/claude.html');
  });

  it('reads what this run captured, and the committed fixture for any other Platform, even with an older file in the folder', () => {
    const env = { COMPOSER_FIXTURES: '/tmp/fx', COMPOSER_CAPTURED: 'chatgpt' };

    expect(composerFixturePath('chatgpt', committed, env)).toBe('/tmp/fx/chatgpt.html');
    expect(composerFixturePath('claude', committed, env)).toBe('/repo/tests/fixtures/composers/claude.html');
  });
});

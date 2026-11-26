/**
 * @vitest-environment node
 *
 * The rules of what a pick keeps of an element (My-Prompt-Manager-je37). Token-shaped values and the
 * e-mail address are built from parts, so no such string is written whole.
 */
import { describe, expect, it } from 'vitest';

import { isIdentifierShaped, keepsAttribute, keepsIdentifier, keepsLabel, MAX_SELECTOR_LENGTH, selectorKeepsOnlyKeptValues } from '../pickedValues';

const EMAIL = ['jane.doe', 'example.org'].join('@');
const UUID = ['e5f6a7b8', '1c2d', '4e5f', '8a9b', '0c1d2e3f4a5b'].join('-');
const JWT = [['eyJhbGciOiJIUzI1', 'NiJ9'].join(''), ['eyJzdWIiOiIx', 'MjM0NTY3ODkwIn0'].join(''), 'SflKxwRJSMeKKF2QT4fw'].join('.');

describe('isIdentifierShaped', () => {
  it.each([
    'prompt-textarea',
    'chatInput',
    'PromptTextarea',
    'send_button',
    'mat-input-0',
    'conversation-turn-3',
    'composer_v2',
    'h2',
    'q',
    'ID',
    'gb-main'
  ])('keeps %s, written by the page to name an element', (value) => {
    expect(isIdentifierShaped(value)).toBe(true);
  });

  it.each([
    ['an e-mail address', EMAIL],
    ['a UUID', UUID],
    ['a JWT', JWT],
    ['a hex token', ['a8f3c2e1', 'b7d94e06'].join('')],
    ['a token that mixes capitals and lowercase letters', ['Xkf', 'QmZvBnLp'].join('')],
    ['a base64 token', ['dGhpcyBp', 'cyBh'].join('')],
    ['a user id', 'user-90210731'],
    ['a number alone', '4815162342'],
    ['text with a space', 'message body'],
    ['an address', 'https://notes.example.com/chat'],
    ['an id React generates', ':r1:'],
    ['a value that starts with a digit', '2fa-field'],
    ['a value over 48 characters', `composer-${'field-'.repeat(8)}end`],
    ['a part over 24 letters', `composer-${'a'.repeat(25)}`],
    ['an empty value', '']
  ])('refuses %s', (_name, value) => {
    expect(isIdentifierShaped(value)).toBe(false);
  });
});

describe('keepsIdentifier and keepsLabel', () => {
  it('refuses an identifier with a sensitive word, and a missing one', () => {
    expect(keepsIdentifier('session-panel')).toBe(false);
    expect(keepsIdentifier('rapid-input')).toBe(false); // holds "api": the pattern is unanchored
    expect(keepsIdentifier(null)).toBe(false);
    expect(keepsIdentifier(undefined)).toBe(false);
    expect(keepsIdentifier('composer')).toBe(true);
  });

  it("keeps a label in the page's own words, unless it holds a sensitive word", () => {
    expect(keepsLabel('Write a message')).toBe(true);
    expect(keepsLabel('Enter your password')).toBe(false);
    expect(keepsLabel('')).toBe(false);
    expect(keepsLabel(null)).toBe(false);
  });
});

describe('keepsAttribute', () => {
  it.each([
    ['data-testid', 'chat-input'],
    ['data-qa', 'composer-field'],
    ['data-cy', 'send'],
    ['data-id', 'checkout-submit'],
    ['data-lexical-editor', 'true'],
    ['data-gramm', 'false'],
    ['data-v-7ba5bd90', ''],
    ['aria-multiline', 'true'],
    ['aria-haspopup', 'menu'],
    ['aria-describedby', 'composer-hint composer-count'],
    ['aria-controls', 'mentions-list']
  ])('keeps %s="%s"', (name, value) => {
    expect(keepsAttribute(name, value)).toBe(true);
  });

  it.each([
    ['a draft copied into data-draft', 'data-draft', 'hello'],
    ['a draft copied into data-value', 'data-value', 'Draft: merger closes Friday'],
    ['a JWT in data-state', 'data-state', JWT],
    ['a token in data-id', 'data-id', ['a8f3c2e1', 'b7d94e06'].join('')],
    ['an e-mail address in a test id', 'data-testid', EMAIL],
    ['a sensitive name used as a switch', 'data-token', 'true'],
    ['a name the old rule left out', 'data-sensitive', 'true'],
    ['aria-label, kept with the labels', 'aria-label', 'true'],
    ['an ARIA attribute holding text', 'aria-valuetext', 'Draft saved'],
    ['an ARIA reference to a token', 'aria-controls', UUID],
    ["Angular's copy of a model", 'ng-reflect-model', 'hello'],
    ['an attribute of no kept kind', 'title', 'Message']
  ])('refuses %s', (_name, name, value) => {
    expect(keepsAttribute(name, value)).toBe(false);
  });
});

describe('selectorKeepsOnlyKeptValues', () => {
  it.each([
    '#prompt-textarea',
    'textarea[data-testid="chat-input"]',
    'div[data-lexical-editor="true"]',
    'textarea.composer.box',
    '#chat > div:nth-of-type(2) > textarea',
    'main > div > div:nth-child(3)',
    'textarea[data-v-7ba5bd90=""]',
    'textarea[placeholder="Ask #1 question"][data-testid="send"]'
  ])('keeps %s, which a pick makes now', (selector) => {
    expect(selectorKeepsOnlyKeptValues(selector)).toBe(true);
  });

  it.each([
    ['a draft in data-draft', 'input[data-draft="hello"]'],
    ['a draft holding a sensitive word', 'input[data-draft="session notes"]'],
    ['a token in data-id', `textarea[data-id='${['a8f3c2e1', 'b7d94e06'].join('')}']`],
    ['a session id on an ancestor', `#${UUID} > div > div > textarea`],
    ['a user id as the id', '#user-90210731'],
    ['an escaped e-mail address as the id', `#${EMAIL.replace(/[.@]/g, (character) => `\\${character}`)}`],
    ['a hex-escaped id', '#\\32 fa-field'],
    ['a value without quotes', 'input[data-draft=hello]'],
    // Review of je37: an attribute selector the rule cannot read is refused, not let through
    ['an attribute with a namespace, which the rule does not read', 'input[*|data-draft="x"]'],
    ['an attribute with no closing bracket', 'input[data-draft="x"']
  ])('refuses %s, which a pick could store before je37', (_name, selector) => {
    expect(selectorKeepsOnlyKeptValues(selector)).toBe(false);
  });

  it('reads a hex escape as CSS does', () => {
    expect(selectorKeepsOnlyKeptValues('#\\63 omposer')).toBe(true);
  });

  // Review of je37: String.fromCodePoint threw a RangeError past U+10FFFF
  it.each([
    ['past U+10FFFF', '#\\FFFFFF'],
    ['of zero', '#\\0 composer'],
    ['of a surrogate', '#\\D800 composer']
  ])('reads an escape %s as U+FFFD, and refuses the id, without throwing', (_name, selector) => {
    expect(() => selectorKeepsOnlyKeptValues(selector)).not.toThrow();
    expect(selectorKeepsOnlyKeptValues(selector)).toBe(false);
  });

  // Review of je37: a run of `[` made the expression backtrack, 14.5 s to decode 32,000 of them.
  // Each case runs in a millisecond; before the fix, the first one outlasted the test's timeout
  const RUN_LENGTH = 32_000;
  const runOf = (unit: string): string => unit.repeat(Math.ceil(RUN_LENGTH / unit.length)).slice(0, RUN_LENGTH);

  it.each(['[', '[a="', '[a='])(`refuses at once a run of %s ${RUN_LENGTH.toLocaleString('en-US')} characters long`, (unit) => {
    const selector = runOf(unit);

    expect(selector).toHaveLength(RUN_LENGTH);
    expect(selectorKeepsOnlyKeptValues(selector)).toBe(false);
  });

  it(`reads a selector up to ${String(MAX_SELECTOR_LENGTH)} characters, the longest a configuration code accepts, and refuses a longer one unread`, () => {
    const longest = `textarea.${'x'.repeat(MAX_SELECTOR_LENGTH - 'textarea.'.length)}`;

    expect(longest).toHaveLength(MAX_SELECTOR_LENGTH);
    expect(selectorKeepsOnlyKeptValues(longest)).toBe(true);
    expect(selectorKeepsOnlyKeptValues(`${longest}x`)).toBe(false);
  });
});

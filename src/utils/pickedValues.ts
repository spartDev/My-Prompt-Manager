/**
 * What the Element picker keeps of the element a user picks: the names the page's authors gave it,
 * never what the page holds for the user (docs/ELEMENT_PICKER_SECURITY.md, section 3). The
 * fingerprint (src/content/utils/element-fingerprint.ts) and the fallback selector (generateSelector
 * in src/content/modules/element-picker.ts) keep a value only through these rules, and a Custom
 * site's configuration code applies them again, in and out (sanitizePositioning in
 * src/utils/configurationSecurity.ts), to what a pick stored before them (ticket My-Prompt-Manager-je37).
 *
 * The content script and the extension's pages both import this module: its chunk is listed in the
 * `web_accessible_resources` of manifest.json, which `npm run build` checks.
 */

/** A value holding one of these words is not kept, whatever its shape */
export const SENSITIVE_PATTERNS = /password|secret|token|key|credential|private|ssn|credit|card|cvv|pin|bank|account|session|auth|api|csrf|nonce/i;

const MAX_IDENTIFIER_LENGTH = 48;
const MAX_IDENTIFIER_PART_LENGTH = 24;
/** A letter, then letters, digits, `-` and `_`: no space, dot, colon, `@`, `/`, `=` or `+` */
const IDENTIFIER_CHARACTERS = /^[A-Za-z][A-Za-z0-9_-]*$/;
/**
 * A part of an identifier, between two `-` or `_`: a lowercase word, or words in camelCase (each one
 * after the first a capital and at least two lowercase letters), or two to five capitals, followed by
 * up to three digits; or a number of up to three digits. A random token mixes letters and digits, or
 * capitals and lowercase letters, in a way no such part does.
 */
const IDENTIFIER_PART = /^(?:(?:[a-z]+|[A-Z][a-z]*)(?:[A-Z][a-z]{2,})*|[A-Z]{2,5})[0-9]{0,3}$|^[0-9]{1,3}$/;

/**
 * Whether a value is shaped as an identifier a page's authors write to name an element
 * (`prompt-textarea`, `chatInput`, `send_button`, `mat-input-0`): up to 48 characters, a letter
 * then letters, digits, `-` and `_`, each part between them as IDENTIFIER_PART says, up to 24
 * characters. Refused, among others: an e-mail address, an address, a JWT, a UUID, a hex or base64
 * token, a number of four digits or more, and any text with a space.
 */
export function isIdentifierShaped(value: string): boolean {
  if (value.length > MAX_IDENTIFIER_LENGTH || !IDENTIFIER_CHARACTERS.test(value)) {
    return false;
  }
  return value.split(/[-_]/).every((part) => part.length <= MAX_IDENTIFIER_PART_LENGTH && IDENTIFIER_PART.test(part));
}

/** An identifier a pick keeps (an `id`, a test id, a `name`): shaped as one, with no sensitive word */
export function keepsIdentifier(value: string | null | undefined): value is string {
  return typeof value === 'string' && isIdentifierShaped(value) && !SENSITIVE_PATTERNS.test(value);
}

/** A label a pick keeps (`aria-label`, `placeholder`): the page's own words, with no sensitive word */
export function keepsLabel(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !SENSITIVE_PATTERNS.test(value);
}

/** The `data-` attributes whose value names the element: test ids and their like */
const IDENTIFIER_ATTRIBUTES: ReadonlySet<string> = new Set([
  'data-testid',
  'data-test-id',
  'data-test',
  'data-qa',
  'data-cy',
  'data-e2e',
  'data-automation-id',
  'data-automationid',
  'data-id',
  'data-role',
  'data-component'
]);

/** The values of a `data-` attribute used as a switch */
const SWITCH_VALUES: ReadonlySet<string> = new Set(['', 'true', 'false']);

/** `data-` attribute names a pick never keeps, whatever their value */
const EXCLUDED_DATA_NAMES = /^data-(?:sensitive|private|password|token|key|secret)/i;

/** The ARIA attributes whose value is a list of element ids */
const ARIA_ID_REFERENCES: ReadonlySet<string> = new Set([
  'aria-activedescendant',
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-labelledby',
  'aria-owns'
]);

/** The values the ARIA specification defines for its token attributes (aria-expanded, aria-haspopup…) */
const ARIA_TOKENS: ReadonlySet<string> = new Set([
  'true', 'false', 'mixed', 'undefined', 'none', 'inline', 'list', 'both', 'menu', 'listbox', 'tree',
  'grid', 'dialog', 'polite', 'assertive', 'off', 'horizontal', 'vertical', 'ascending', 'descending',
  'other', 'page', 'step', 'location', 'date', 'time', 'grammar', 'spelling', 'additions', 'removals',
  'text', 'all'
]);

/**
 * Whether a pick keeps this attribute: in the fingerprint's other attributes, and in the selector's
 * `[data-x="value"]`. Kept: a `data-` attribute used as a switch (its value empty, `true` or `false`),
 * or one of IDENTIFIER_ATTRIBUTES whose value is an identifier a pick keeps; an `aria-` attribute
 * other than `aria-label` (kept with the identifiers) whose value is an ARIA token, or, for one that
 * names other elements, ids a pick keeps. Nothing else: an attribute where the page may copy a draft
 * (`data-draft`, `data-value`), hold a record's id or a token (`data-state`), or a framework's state
 * (`ng-reflect-*`) is not kept.
 */
export function keepsAttribute(name: string, value: string): boolean {
  const lowered = name.toLowerCase();
  if (SENSITIVE_PATTERNS.test(lowered)) {
    return false;
  }
  if (lowered.startsWith('data-')) {
    if (EXCLUDED_DATA_NAMES.test(lowered)) {
      return false;
    }
    return SWITCH_VALUES.has(value) || (IDENTIFIER_ATTRIBUTES.has(lowered) && keepsIdentifier(value));
  }
  if (lowered.startsWith('aria-') && lowered !== 'aria-label') {
    if (ARIA_ID_REFERENCES.has(lowered)) {
      const ids = value.trim().split(/\s+/);
      return ids.every((id) => keepsIdentifier(id));
    }
    return ARIA_TOKENS.has(value);
  }
  return false;
}

/**
 * The longest selector read: a configuration code refuses a longer one (`isSelectorSafe` in
 * src/utils/configurationSecurity.ts), so no input of any length reaches the expressions below
 */
export const MAX_SELECTOR_LENGTH = 300;

/** A CSS escape: a hex code point and the space that may end it, or one escaped character */
const CSS_ESCAPE = /\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\\([^\r\n\f0-9a-fA-F])/g;

/** The highest code point, and the first and the last surrogate */
const MAX_CODE_POINT = 0x10ffff;
const FIRST_SURROGATE = 0xd800;
const LAST_SURROGATE = 0xdfff;
const REPLACEMENT_CHARACTER = 0xfffd;

/** A hex escape's character, as CSS reads it: U+FFFD for zero, a surrogate, or past U+10FFFF */
const escapedCharacter = (hex: string): string => {
  const codePoint = Number.parseInt(hex, 16);
  const replaced = codePoint === 0 || codePoint > MAX_CODE_POINT || (codePoint >= FIRST_SURROGATE && codePoint <= LAST_SURROGATE);
  return String.fromCodePoint(replaced ? REPLACEMENT_CHARACTER : codePoint);
};

const unescapeCss = (value: string): string =>
  value.replace(CSS_ESCAPE, (_match, hex: string | undefined, character: string | undefined) =>
    hex !== undefined ? escapedCharacter(hex) : (character ?? ''));

/**
 * An attribute selector, `[name]` or `[name<op>value]`, its value quoted or not. Neither the name nor
 * a value without quotes holds `[`, so that a run of `[` is read once
 */
const ATTRIBUTE_SELECTOR = /\[\s*([^\s~|^$*!=[\]]+)\s*(?:[~|^$*]?=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s[\]"']+))\s*(?:[iIsS]\s*)?)?\]/g;

/** An id selector, `#name`, its name with CSS escapes */
const ID_SELECTOR = /#((?:\\[0-9a-fA-F]{1,6}[ \t\n\r\f]?|\\[^\r\n\f0-9a-fA-F]|[^\s>+~.#:[\](),*'"\\])+)/g;

/** Whether a pick keeps this attribute's value, as the fingerprint keeps it */
function keepsSelectorAttribute(name: string, value: string): boolean {
  switch (name.toLowerCase()) {
    case 'id':
    case 'name':
      return keepsIdentifier(value);
    case 'aria-label':
    case 'placeholder':
      return keepsLabel(value);
    case 'type':
    case 'role':
      return true;
    default:
      return keepsAttribute(name, value);
  }
}

/**
 * Whether every id and every attribute value a CSS selector names is one a pick keeps. A selector
 * that a pick stored before these rules may name the page's values: an id that is a token, the draft
 * a page copied into `data-draft`. Classes and tags are not looked at. It fails closed: a selector
 * longer than MAX_SELECTOR_LENGTH, or with a `[` that ATTRIBUTE_SELECTOR does not read (a namespace,
 * `[*|data-draft="x"]`), gives false.
 */
export function selectorKeepsOnlyKeptValues(selector: string): boolean {
  if (selector.length > MAX_SELECTOR_LENGTH) {
    return false;
  }
  for (const match of selector.matchAll(ATTRIBUTE_SELECTOR)) {
    const [, name, doubleQuoted, singleQuoted, bare] = match;
    const value = doubleQuoted ?? singleQuoted ?? bare;
    if (value === undefined ? SENSITIVE_PATTERNS.test(name) : !keepsSelectorAttribute(name, unescapeCss(value))) {
      return false;
    }
  }
  // An attribute's value is not an id: `[placeholder="Ask #1"]` names no id `1`
  const withoutAttributes = selector.replace(ATTRIBUTE_SELECTOR, ' ');
  // A `[` left is an attribute selector the expression does not read, whose value is not checked
  if (withoutAttributes.includes('[')) {
    return false;
  }
  for (const match of withoutAttributes.matchAll(ID_SELECTOR)) {
    if (!keepsIdentifier(unescapeCss(match[1]))) {
      return false;
    }
  }
  return true;
}

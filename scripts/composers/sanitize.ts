/**
 * Turns a Platform's live composer into a fixture of tests/fixtures/composers: the structure, and
 * of the attributes only an allowlist: what an element is (contenteditable, role, type), with a
 * value the web platform defines, and what the Platform's own selectors read (sanitizeRulesOf),
 * test ids and class names included. Text, comments, links, media and SVG content go, and so does
 * any attribute nobody reads. An attribute a selector reads by its value gets a value written from
 * the selector, never the page's, so a fixture holds nothing the user wrote and nothing that names
 * them (data-user-id, `placeholder="Message Alice"`, `data-testid="user-menu-alice"`), and any
 * value still kept that looks like an address or an e-mail is dropped as well.
 *
 * DOM code with no Node or browser global, so `npm run composers:capture` runs it on jsdom and
 * the unit tests on happy-dom.
 */

/** Set on the editor in the page before its composer is read, so the sanitizer knows which element it is */
export const EDITOR_MARKER = 'data-mpm-capture-editor';

/** Elements dropped with their content: they carry no composer structure */
const DROPPED_ELEMENTS = new Set(['script', 'style', 'link', 'noscript', 'template', 'iframe', 'img', 'picture', 'video', 'canvas']);

/** The generic wrappers folded into their one child; anything else (form, fieldset, custom elements) stays */
const FOLDED_TAGS = new Set(['div', 'span']);

const VOID_ELEMENTS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']);

/**
 * What an element is, kept only with a value of the web platform's own: a page cannot put a name
 * in them. Test ids are not among them: those a chain needs are named by its selectors, and so
 * written from them, like any attribute a selector reads.
 */
const ENUMERATED_ATTRIBUTES: Readonly<Record<string, ReadonlySet<string>>> = {
  contenteditable: new Set(['', 'true', 'false', 'plaintext-only']),
  // WAI-ARIA 1.2 roles
  role: new Set([
    'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption', 'cell', 'checkbox',
    'code', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'deletion', 'dialog', 'directory',
    'document', 'emphasis', 'feed', 'figure', 'form', 'generic', 'grid', 'gridcell', 'group', 'heading', 'img', 'insertion',
    'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
    'menuitemradio', 'meter', 'navigation', 'none', 'note', 'option', 'paragraph', 'presentation', 'progressbar', 'radio',
    'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider',
    'spinbutton', 'status', 'strong', 'subscript', 'superscript', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term',
    'textbox', 'time', 'timer', 'toolbar', 'tree', 'treegrid', 'treeitem'
  ]),
  // The types of a button and of an input
  type: new Set([
    'button', 'submit', 'reset', 'text', 'search', 'email', 'url', 'tel', 'password', 'number', 'checkbox', 'radio', 'file',
    'hidden', 'image', 'range', 'color', 'date', 'datetime-local', 'month', 'week', 'time'
  ])
};

/** The value kept for an enumerated attribute: its tokens the web platform defines, or null */
function enumeratedValue(name: string, value: string): string | null {
  const allowed = ENUMERATED_ATTRIBUTES[name];
  const normalized = value.trim().toLowerCase();
  if (allowed.has(normalized)) {
    return normalized;
  }
  // A role may list fallbacks: `role="switch checkbox"`
  if (name === 'role') {
    const tokens = normalized.split(/\s+/).filter((token) => allowed.has(token));
    return tokens.length > 0 ? tokens.join(' ') : null;
  }
  return null;
}

/** A value that may carry an address or an e-mail, whatever attribute it is in */
const looksPersonal = (value: string): boolean => /https?:|@|\/\//i.test(value);

/** A value condition of an attribute selector: `[aria-label*="dictate" i]` */
interface ValueCondition {
  operator: string;
  value: string;
  ignoreCase: boolean;
}

/** How the selectors read one attribute */
interface AttributeRule {
  /** A selector names it with no value (`[data-lexical-editor]`): kept, with an empty value */
  bare: boolean;
  /** The values selectors look for in it */
  conditions: ValueCondition[];
}

/**
 * What a sanitized composer keeps, read from the selectors a Platform finds its editor and its
 * anchors by: everything else is dropped (an allowlist). An attribute whose value meets one of its
 * conditions is written with the selector's value, the least that still meets them (`Message` for
 * `[placeholder*="Message"]`), never the page's; one named without a value keeps an empty value.
 */
export interface SanitizeRules {
  classes: ReadonlySet<string>;
  attributes: ReadonlyMap<string, AttributeRule>;
}

/**
 * The class names a Platform's chain names (`.fai-ChatInput`): kept wherever they are, since the
 * chain would not resolve on the fixture without them. Every other class is a look.
 */
export function classNamesOf(selectors: readonly string[]): string[] {
  return [...new Set(selectors.flatMap((selector) => Array.from(selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g), (match) => match[1])))];
}

/** A quoted value may hold an escaped character, an escaped quote included: `[aria-label="say \"hi\""]` */
const ATTRIBUTE_SELECTOR = /\[\s*([\w-]+)\s*(?:([*^$~|]?=)\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\]\s]+))\s*([iIsS])?\s*)?\]/g;

/** The code point CSS reads a hex escape as: U+FFFD for zero, a surrogate, or a value above U+10FFFF */
const escapedCodePoint = (hex: string): string => {
  const codePoint = parseInt(hex, 16);
  const valid = codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff);
  return String.fromCodePoint(valid ? codePoint : 0xfffd);
};

/**
 * A quoted selector value as CSS reads it: a hex escape (`\26 `) is its code point, ended by one
 * CSS whitespace (space, tab, line feed, form feed, carriage return, or CR LF), never by a
 * no-break space; any other escaped character is itself
 */
const unescapeCss = (value: string): string =>
  value.replace(/\\(?:([0-9a-fA-F]{1,6})(?:\r\n|[ \t\n\f\r])?|(.))/g, (_escape, hex: string | undefined, char: string | undefined) =>
    hex ? escapedCodePoint(hex) : (char ?? ''));
const ID_SELECTOR = /#(-?[_a-zA-Z][\w-]*)/g;

/** The rules for a Platform, from its editor selectors and its anchor chain */
export function sanitizeRulesOf(selectors: readonly string[]): SanitizeRules {
  const attributes = new Map<string, AttributeRule>();
  const condition = (name: string, found?: ValueCondition) => {
    const rule = attributes.get(name) ?? { bare: false, conditions: [] };
    if (found) {
      rule.conditions.push(found);
    } else {
      rule.bare = true;
    }
    attributes.set(name, rule);
  };
  for (const selector of selectors) {
    for (const [, name, operator, double, single, bare, flag] of selector.matchAll(ATTRIBUTE_SELECTOR)) {
      const quoted = double ?? single;
      const value = quoted === undefined ? bare : unescapeCss(quoted);
      condition(name.toLowerCase(), operator && value !== undefined ? { operator, value, ignoreCase: flag?.toLowerCase() === 'i' } : undefined);
    }
    // An id in a selector (#userInput) is a condition on the id attribute
    for (const [, id] of selector.replace(ATTRIBUTE_SELECTOR, '').matchAll(ID_SELECTOR)) {
      condition('id', { operator: '=', value: id, ignoreCase: false });
    }
  }
  return { classes: new Set(classNamesOf(selectors)), attributes };
}

function meets(actual: string, { operator, value, ignoreCase }: ValueCondition): boolean {
  const have = ignoreCase ? actual.toLowerCase() : actual;
  const want = ignoreCase ? value.toLowerCase() : value;
  switch (operator) {
    case '=': return have === want;
    case '*=': return want !== '' && have.includes(want);
    case '^=': return want !== '' && have.startsWith(want);
    case '$=': return want !== '' && have.endsWith(want);
    case '~=': return have.split(/\s+/).includes(want);
    case '|=': return have === want || have.startsWith(`${want}-`);
    default: return false;
  }
}

/**
 * The value written for an attribute: of the selector values the live one meets, the first that
 * meets all those conditions by itself, else them joined (`^="Send"` and `$="message"`). Null when
 * the live value meets none, or when no written value meets them all.
 */
function selectorValue(actual: string, conditions: readonly ValueCondition[]): string | null {
  const met = conditions.filter((condition) => meets(actual, condition));
  if (met.length === 0) {
    return null;
  }
  // Joined by a space, a prefix first and a suffix last, the rest in selector order: `^="Send"` and
  // `$="message"` give "Send message"; `*="en-US"`, `|="en"` and `~="foo"` give "en-US en foo".
  // Tried first, so a value the sanitizer wrote before stays as it was.
  const joined = (priority: Readonly<Record<string, number>>, separator: string) =>
    [...met].sort((a, b) => (priority[a.operator] ?? 1) - (priority[b.operator] ?? 1)).map(({ value }) => value).join(separator);
  const BY_PREFIX = { '^=': 0, '$=': 2 };
  // Then with a language prefix ahead of the rest, by a space and by a hyphen: `|=en` and `*=US`
  // give "en-US"; a ^= prefix still goes ahead of it
  const BY_LANGUAGE = { '^=': 0, '|=': 0.5, '$=': 2 };
  const candidates = [...met.map(({ value }) => value), joined(BY_PREFIX, ' '), joined(BY_LANGUAGE, ' '), joined(BY_LANGUAGE, '-')];
  return candidates.find((candidate) => met.every((condition) => meets(candidate, condition))) ?? null;
}

function sanitizeAttributes(element: Element, rules: SanitizeRules): void {
  for (const { name, value } of Array.from(element.attributes)) {
    const lower = name.toLowerCase();
    if (lower === EDITOR_MARKER) {
      continue;
    }
    let kept: string | null;
    if (lower in ENUMERATED_ATTRIBUTES) {
      kept = enumeratedValue(lower, value);
    } else if (lower === 'class') {
      // Only the class names a selector names (.ProseMirror, .fai-ChatInput): every other is a look
      kept = value.split(/\s+/).filter((token) => rules.classes.has(token)).join(' ') || null;
    } else {
      const rule = rules.attributes.get(lower);
      kept = rule ? selectorValue(value, rule.conditions) ?? (rule.bare ? '' : null) : null;
    }
    if (kept === null || looksPersonal(kept)) {
      element.removeAttribute(name);
    } else if (kept !== value) {
      element.setAttribute(name, kept);
    }
  }
}

/** Removes text, comments, dropped elements and attributes, and SVG content, below and on this element */
function strip(node: Node, isInsideSvg: boolean, rules: SanitizeRules): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== 1) {
      // Text, comments, processing instructions: what the user wrote and what the page says
      child.remove();
      continue;
    }
    const element = child as Element;
    const tag = element.tagName.toLowerCase();
    if (DROPPED_ELEMENTS.has(tag) || isInsideSvg) {
      element.remove();
      continue;
    }
    sanitizeAttributes(element, rules);
    strip(element, tag === 'svg', rules);
  }
}

/** Folds each attribute-less div or span with exactly one child into that child, deepest first */
function fold(element: Element, isRoot: boolean): void {
  for (const child of Array.from(element.children)) {
    fold(child, false);
  }
  const only = element.children.length === 1 ? element.firstElementChild : null;
  if (!isRoot && only && element.attributes.length === 0 && FOLDED_TAGS.has(element.tagName.toLowerCase())) {
    element.replaceWith(only);
  }
}

/**
 * Sanitizes a composer in place: the root (the element the chain's composer selector found) is
 * kept as it is, even when it could fold, so the selector still finds it.
 *
 * @param rules - What the Platform's selectors read (sanitizeRulesOf); with none, only
 *   contenteditable, role and type stay
 */
export function sanitizeComposer(root: Element, rules: SanitizeRules = sanitizeRulesOf([])): void {
  sanitizeAttributes(root, rules);
  strip(root, root.tagName.toLowerCase() === 'svg', rules);
  fold(root, true);
}

const escapeAttribute = (value: string): string => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function openTag(element: Element): string {
  const attributes = Array.from(element.attributes)
    .filter(({ name }) => name !== EDITOR_MARKER)
    .map(({ name, value }) => (value === '' ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`))
    .join('');
  return `<${element.tagName.toLowerCase()}${attributes}>`;
}

/** One line: the element and everything in it */
function inline(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (VOID_ELEMENTS.has(tag)) {
    return openTag(element);
  }
  return `${openTag(element)}${Array.from(element.children).map(inline).join('')}</${tag}>`;
}

/**
 * The sanitized composer as fixture markup: one element per line, indented by two spaces, except
 * the editor and the elements with no element in them, each kept on one line.
 */
export function serializeComposer(element: Element, depth = 0): string {
  const indent = '  '.repeat(depth);
  if (element.hasAttribute(EDITOR_MARKER) || element.children.length === 0) {
    return `${indent}${inline(element)}`;
  }
  const tag = element.tagName.toLowerCase();
  const children = Array.from(element.children).map((child) => serializeComposer(child, depth + 1));
  return [`${indent}${openTag(element)}`, ...children, `${indent}</${tag}>`].join('\n');
}

export interface FixtureHeader {
  platformName: string;
  url: string;
  /** YYYY-MM-DD */
  date: string;
  /** False when the chain's composer selector found nothing and an ancestor of the editor was captured instead */
  composerFound: boolean;
}

/** A fixture file: the header that says where and when it was captured, then the composer */
export function composerFixture(root: Element, header: FixtureHeader): string {
  const origin = header.composerFound
    ? ''
    : '\n  The composer selector of its chain found nothing: this is an ancestor of the editor instead.';
  return [
    '<!--',
    `  ${header.platformName} composer, captured from ${header.url} on ${header.date} by npm run composers:capture.${origin}`,
    '  Sanitized: text, links, media and SVG content removed; of the attributes, only contenteditable, role',
    '  and type of the web platform\'s values, and what the Platform\'s selectors read, with the selector\'s value;',
    '  wrappers with no attribute and one child folded into that child.',
    '-->',
    serializeComposer(root),
    ''
  ].join('\n');
}

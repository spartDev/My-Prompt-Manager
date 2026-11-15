/**
 * Turns a Platform's live composer into a fixture of tests/fixtures/composers: the structure, and
 * of the attributes only an allowlist: what an element is (contenteditable, role, type), its test
 * ids, and what the Platform's own selectors read (sanitizeRulesOf). Text, comments, links, media
 * and SVG content go, and so does any attribute nobody reads, so a fixture holds nothing the user
 * wrote and nothing that names them (data-user-id, an ARIA label with their name).
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
 * Attributes kept with any value: what an element is (contenteditable, role, type) and the test
 * ids a Platform writes for its own tests. None carries what the user wrote or who they are.
 */
const STRUCTURAL_ATTRIBUTES = new Set(['contenteditable', 'role', 'type', 'data-testid']);

/** A value condition of an attribute selector: `[aria-label*="dictate" i]` */
interface ValueCondition {
  operator: string;
  value: string;
  ignoreCase: boolean;
}

/**
 * What a sanitized composer keeps, read from the selectors a Platform finds its editor and its
 * anchors by: everything else is dropped (an allowlist). An attribute a selector names with a value
 * keeps its value only where it meets one of those conditions; one named without a value keeps its
 * name with an empty value.
 */
export interface SanitizeRules {
  classes: ReadonlySet<string>;
  attributes: ReadonlyMap<string, readonly ValueCondition[]>;
}

/**
 * The class names a Platform's chain names (`.fai-ChatInput`): kept wherever they are, since the
 * chain would not resolve on the fixture without them. Every other class is a look.
 */
export function classNamesOf(selectors: readonly string[]): string[] {
  return [...new Set(selectors.flatMap((selector) => Array.from(selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g), (match) => match[1])))];
}

const ATTRIBUTE_SELECTOR = /\[\s*([\w-]+)\s*(?:([*^$~|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*([iIsS])?\s*)?\]/g;
const ID_SELECTOR = /#(-?[_a-zA-Z][\w-]*)/g;

/** The rules for a Platform, from its editor selectors and its anchor chain */
export function sanitizeRulesOf(selectors: readonly string[]): SanitizeRules {
  const attributes = new Map<string, ValueCondition[]>();
  const condition = (name: string, found?: ValueCondition) => {
    const conditions = attributes.get(name) ?? [];
    if (found) {
      conditions.push(found);
    }
    attributes.set(name, conditions);
  };
  for (const selector of selectors) {
    for (const [, name, operator, double, single, bare, flag] of selector.matchAll(ATTRIBUTE_SELECTOR)) {
      const value = double ?? single ?? bare;
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

function sanitizeAttributes(element: Element, isEditor: boolean, rules: SanitizeRules): void {
  for (const { name, value } of Array.from(element.attributes)) {
    const lower = name.toLowerCase();
    if (lower === EDITOR_MARKER || STRUCTURAL_ATTRIBUTES.has(lower)) {
      continue;
    }
    if (lower === 'class') {
      // The editor keeps its classes: some Platforms find it by them (.ProseMirror)
      const kept = isEditor ? value : value.split(/\s+/).filter((token) => rules.classes.has(token)).join(' ');
      if (kept) {
        element.setAttribute(name, kept);
      } else {
        element.removeAttribute(name);
      }
      continue;
    }
    const conditions = rules.attributes.get(lower);
    if (conditions === undefined) {
      element.removeAttribute(name);
    } else if (conditions.length === 0) {
      element.setAttribute(name, '');
    } else if (!conditions.some((condition) => meets(value, condition))) {
      element.removeAttribute(name);
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
    sanitizeAttributes(element, element.hasAttribute(EDITOR_MARKER), rules);
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
 * @param rules - What the Platform's selectors read (sanitizeRulesOf); with none, only the
 *   structural attributes stay
 */
export function sanitizeComposer(root: Element, rules: SanitizeRules = sanitizeRulesOf([])): void {
  sanitizeAttributes(root, root.hasAttribute(EDITOR_MARKER), rules);
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
    '  Sanitized: text, links, media and SVG content removed; of the attributes, only contenteditable, role,',
    '  type, test ids and what the Platform\'s selectors read are kept; wrappers with no attribute and one',
    '  child folded into that child.',
    '-->',
    serializeComposer(root),
    ''
  ].join('\n');
}

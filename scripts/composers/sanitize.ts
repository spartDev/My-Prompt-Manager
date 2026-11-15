/**
 * Turns a Platform's live composer into a fixture of tests/fixtures/composers: the structure and
 * the attributes an anchor chain can name (test ids, ARIA labels, roles, types, custom elements,
 * the class names the chain itself names),
 * without what the user wrote or anything that identifies them.
 *
 * DOM code with no Node or browser global, so `npm run composers:capture` runs it on jsdom and
 * the unit tests on happy-dom.
 */

/** Set on the editor in the page before its composer is read, so the sanitizer knows which element it is */
export const EDITOR_MARKER = 'data-mpm-capture-editor';

/** Elements dropped with their content: they carry no composer structure */
const DROPPED_ELEMENTS = new Set(['script', 'style', 'link', 'noscript', 'template', 'iframe', 'img', 'picture', 'video', 'canvas']);

/** Attributes dropped everywhere: looks, links, values, and texts that may name the user */
const DROPPED_ATTRIBUTES = new Set(['style', 'href', 'src', 'srcset', 'alt', 'title', 'value', 'nonce', 'integrity', 'action']);

/** The attributes an SVG keeps: what a chain may name it by */
const SVG_ATTRIBUTES = /^(aria-|data-testid$|role$)/;

/** The generic wrappers folded into their one child; anything else (form, fieldset, custom elements) stays */
const FOLDED_TAGS = new Set(['div', 'span']);

const VOID_ELEMENTS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']);

/** An id written by a framework (React's :r1:, Radix's radix-…) rather than chosen by the Platform */
const isGeneratedId = (id: string): boolean =>
  id.includes(':') || /\d{4,}/.test(id) || /^(radix|headlessui|mui|react)/i.test(id) || /^[a-z]*[-_]?[0-9a-f]{8,}$/i.test(id);

/** A value that may carry an address or an e-mail, whatever attribute it is in */
const looksPersonal = (value: string): boolean => /https?:|@|\/\//i.test(value);

/**
 * The class names a Platform's chain names (`.fai-ChatInput`): kept wherever they are, since the
 * chain would not resolve on the fixture without them. Every other class is a look.
 */
export function classNamesOf(selectors: readonly string[]): string[] {
  return [...new Set(selectors.flatMap((selector) => Array.from(selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g), (match) => match[1])))];
}

function sanitizeAttributes(element: Element, isEditor: boolean, keptClasses: ReadonlySet<string>): void {
  const isSvg = element.tagName.toLowerCase() === 'svg' || element.closest('svg') !== null;
  for (const { name, value } of Array.from(element.attributes)) {
    const lower = name.toLowerCase();
    if (lower === 'class' && !isEditor && !isSvg) {
      const kept = value.split(/\s+/).filter((token) => keptClasses.has(token));
      if (kept.length > 0) {
        element.setAttribute(name, kept.join(' '));
        continue;
      }
    }
    const drop =
      lower === EDITOR_MARKER ? false
      : isSvg ? !SVG_ATTRIBUTES.test(lower)
      : lower === 'class' ? !isEditor
      : lower === 'id' ? isGeneratedId(value)
      : lower.startsWith('on') || DROPPED_ATTRIBUTES.has(lower) || looksPersonal(value);
    if (drop) {
      element.removeAttribute(name);
    }
  }
}

/** Removes text, comments, dropped elements and attributes, and SVG content, below and on this element */
function strip(node: Node, isInsideSvg: boolean, keptClasses: ReadonlySet<string>): void {
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
    sanitizeAttributes(element, element.hasAttribute(EDITOR_MARKER), keptClasses);
    strip(element, tag === 'svg', keptClasses);
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
 * @param keptClasses - The class names the Platform's chain names (classNamesOf)
 */
export function sanitizeComposer(root: Element, keptClasses: readonly string[] = []): void {
  const kept = new Set(keptClasses);
  sanitizeAttributes(root, root.hasAttribute(EDITOR_MARKER), kept);
  strip(root, root.tagName.toLowerCase() === 'svg', kept);
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
    '  Sanitized: text, classes (but the editor\'s), generated ids, styles, links and SVG content removed;',
    '  wrappers with no attribute and one child folded into that child.',
    '-->',
    serializeComposer(root),
    ''
  ].join('\n');
}

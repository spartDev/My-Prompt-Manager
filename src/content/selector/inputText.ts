/**
 * The plain text of a Platform's input field, and the `//` that opens the Prompt selector from it.
 *
 * Plain TypeScript, loaded with the content script (ADR-002): it reads what the field holds
 * (so an Insertion can be undone), tells whether the user just typed `//` where it opens the
 * selector, removes those two characters, remembers where the caret is (so an Insertion goes
 * there once the selector has closed), and puts the caret at the end of the field.
 *
 * An input field is a <textarea>, an <input>, or a contenteditable element. The text of a
 * contenteditable is read block by block: one line per paragraph, so rich content comes back as
 * plain text.
 */

/** Keys that do nothing on their own: pressing one is not the user going on to something else. */
export const MODIFIER_KEYS: ReadonlySet<string> = new Set([
  'Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn', 'FnLock', 'Hyper', 'Super', 'Symbol', 'SymbolLock'
]);

/** The two characters that open the Prompt selector when typed in the input field. */
export const SELECTOR_TRIGGER = '//';

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION', 'FIGURE', 'FOOTER',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION',
  'TABLE', 'TR', 'UL'
]);

const isTextControl = (element: Element): element is HTMLTextAreaElement | HTMLInputElement =>
  element.tagName === 'TEXTAREA' || element.tagName === 'INPUT';

const isBlock = (node: Node | null): boolean =>
  node !== null && node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as Element).tagName);

/** The node after `node` in its parent, skipping what holds no content (comments, empty text). */
const nextContent = (node: Node): Node | null => {
  let next = node.nextSibling;
  while (next && (next.nodeType === Node.COMMENT_NODE || (next.nodeType === Node.TEXT_NODE && next.nodeValue === ''))) {
    next = next.nextSibling;
  }
  return next;
};

/**
 * The text under `root`, one line per block. A <br> breaks the line, except the one an editor
 * leaves at the end of a block to keep it open (an empty paragraph is `<p><br></p>`).
 */
export function plainTextOf(root: Node): string {
  const lines: string[] = [''];
  // A block has just ended: what comes next starts a new line
  let blockEnded = false;

  const startContent = (): void => {
    if (blockEnded) {
      lines.push('');
      blockEnded = false;
    }
  };

  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.nodeValue ?? '';
        // Indentation of the markup between two blocks is not text of the field
        const betweenBlocks = text.trim() === '' && (isBlock(child.previousSibling) || isBlock(child.nextSibling));
        if (text !== '' && !betweenBlocks) {
          startContent();
          lines[lines.length - 1] += text;
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element;
        if (element.tagName === 'BR') {
          if (nextContent(element) !== null) {
            startContent();
            lines.push('');
          }
        } else if (BLOCK_TAGS.has(element.tagName)) {
          if (blockEnded) {
            lines.push('');
            blockEnded = false;
          } else if (lines[lines.length - 1] !== '') {
            lines.push('');
          }
          walk(element);
          blockEnded = true;
        } else {
          walk(element);
        }
      }
    }
  };

  walk(root);
  return lines.join('\n');
}

/** The plain text the input field holds now. */
export function readInputText(field: HTMLElement): string {
  return isTextControl(field) ? field.value : plainTextOf(field);
}

/**
 * The plain text between the start of the field and the caret, or null when there is no caret in
 * the field (nothing is focused there, or text is selected).
 */
export function textBeforeCaret(field: HTMLElement): string | null {
  if (isTextControl(field)) {
    const { selectionStart, selectionEnd } = field;
    return selectionStart === null || selectionStart !== selectionEnd ? null : field.value.slice(0, selectionStart);
  }

  const selection = field.ownerDocument.getSelection();
  if (!selection?.isCollapsed || !selection.focusNode || !field.contains(selection.focusNode)) {
    return null;
  }
  const range = field.ownerDocument.createRange();
  range.setStart(field, 0);
  range.setEnd(selection.focusNode, selection.focusOffset);
  return plainTextOf(range.cloneContents());
}

/**
 * The plain text a contenteditable field holds before and after `range`, a caret or a selection in
 * it: what an Insertion there must leave as it is. Null when it cannot be told from the markup.
 *
 * Both are measured from the end of the field. The text up to a point cannot be read on its own:
 * a <br> that ends it reads as the break that keeps a line open, not as a line.
 */
export function textAround(field: HTMLElement, range: Range): { before: string; after: string } | null {
  const whole = plainTextOf(field);
  const textFrom = (container: Node, offset: number): string => {
    const rest = field.ownerDocument.createRange();
    rest.selectNodeContents(field);
    rest.setStart(container, offset);
    return plainTextOf(rest.cloneContents());
  };
  const fromStart = textFrom(range.startContainer, range.startOffset);
  const after = textFrom(range.endContainer, range.endOffset);
  if (!whole.endsWith(fromStart) || !fromStart.endsWith(after)) {
    return null;
  }
  return { before: whole.slice(0, whole.length - fromStart.length), after };
}

/**
 * Whether the text before the caret ends with a `//` that opens the Prompt selector: at the very
 * start of the field, or right after a space or a line break. The `//` of `https://` opens nothing.
 */
export function endsWithSelectorTrigger(before: string): boolean {
  if (!before.endsWith(SELECTOR_TRIGGER)) {
    return false;
  }
  const preceding = before.charAt(before.length - SELECTOR_TRIGGER.length - 1);
  return preceding === '' || /\s/.test(preceding);
}

/**
 * Removes the `//` just typed before the caret, as two presses of Backspace would: the rest of the
 * field is not rewritten, and the Platform's editor hears of it through its usual input events.
 * When the editing command is missing or refused, the two characters are taken out of their text
 * node. Returns whether they are gone: the selector does not open over a `//` it could not remove.
 */
export function removeTypedTrigger(field: HTMLElement): boolean {
  const before = textBeforeCaret(field);
  if (before === null || !before.endsWith(SELECTOR_TRIGGER)) {
    return false;
  }
  const document = field.ownerDocument;
  const canExec = typeof document.execCommand === 'function';

  if (isTextControl(field)) {
    const caret = field.selectionStart ?? 0;
    const start = caret - SELECTOR_TRIGGER.length;
    const original = field.value;
    // The field as it must be afterwards: the same text, without the two characters
    const expected = original.slice(0, start) + original.slice(caret);
    field.setSelectionRange(start, caret);
    if (!(canExec && document.execCommand('delete')) && field.value === original) {
      // No editing command here: remove the range, then tell the page as typing would
      field.setRangeText('', start, caret, 'end');
      field.setSelectionRange(start, start);
      field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    }
    // A page whose own handler put the // back, or changed the rest of the draft, did not take it
    return field.value === expected;
  }

  const selection = document.getSelection();
  if (!selection) {
    return false;
  }
  // The field as it must be afterwards: the same text, without the two characters. An editor
  // whose own handler puts the // back, or changes the rest of the draft, did not take the removal.
  // Two things the removal itself changes are not differences: the browser turns a space left
  // at the end of a line into a non-breaking one, and the one line break before a // that ended
  // the field becomes the break that keeps the last line open, which is not read as a line
  const spaces = (text: string): string => text.replace(/\u00a0/g, ' ');
  const original = plainTextOf(field);
  const expected = spaces(original.slice(0, before.length - SELECTOR_TRIGGER.length) + original.slice(before.length));
  // Only a // with nothing after it can leave such a break: elsewhere a missing line is a change
  const endedField = original.length === before.length;
  const removed = (): boolean => {
    const now = spaces(plainTextOf(field));
    return now === expected || (endedField && expected.endsWith('\n') && now === expected.slice(0, -1));
  };

  if (canExec && typeof selection.modify === 'function') {
    for (let i = 0; i < SELECTOR_TRIGGER.length; i++) {
      selection.modify('extend', 'backward', 'character');
    }
    if (selection.toString() === SELECTOR_TRIGGER && document.execCommand('delete')) {
      return removed();
    }
    if (!selection.isCollapsed) {
      selection.collapseToEnd();
    }
  }

  // The editing command is missing or was refused: take the two characters out of their text
  // node, then tell the page as typing would
  const node = selection.focusNode;
  const offset = selection.focusOffset;
  const start = offset - SELECTOR_TRIGGER.length;
  if (node?.nodeType !== Node.TEXT_NODE || start < 0 || (node.nodeValue ?? '').slice(start, offset) !== SELECTOR_TRIGGER) {
    return false;
  }
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, offset);
  range.deleteContents();
  selection.collapse(node, start);
  field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
  return removed();
}

/**
 * Where an Insertion puts the Prompt in an input field: the caret or the selection the field had,
 * as offsets in the value of a <textarea> or an <input>, as a range in a contenteditable. Null
 * when the field has no caret: the Prompt then goes after what the field holds.
 */
export type InsertionPoint = { start: number; end: number; direction?: 'forward' | 'backward' | 'none' } | Range | null;

/** The caret or the selection of the input field now, to be put back with `selectInsertionPoint`. */
export function insertionPointOf(field: HTMLElement): InsertionPoint {
  if (isTextControl(field)) {
    try {
      const { selectionStart, selectionEnd, selectionDirection } = field;
      // The direction too: it says at which end of a selection the caret is
      return selectionStart === null
        ? null
        : { start: selectionStart, end: selectionEnd ?? selectionStart, direction: selectionDirection ?? undefined };
    } catch {
      // An <input> of a type without a text selection
      return null;
    }
  }
  const selection = field.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  // A copy: the page's selection moves on (into the Prompt selector), the copy stays in the field
  return field.contains(range.startContainer) && field.contains(range.endContainer) ? range.cloneRange() : null;
}

/**
 * Makes `point` the caret or the selection of the input field again, without moving the focus.
 * With no point, or one the Platform has since removed from the field, the caret goes after the
 * last character of the field.
 */
export function selectInsertionPoint(field: HTMLElement, point: InsertionPoint): void {
  if (isTextControl(field)) {
    const end = field.value.length;
    const { start, end: until, direction } = point && !(point instanceof Range) ? point : { start: end, end, direction: undefined };
    try {
      field.setSelectionRange(Math.min(start, end), Math.min(until, end), direction);
    } catch {
      // An <input> of a type without a text selection
    }
    return;
  }
  const selection = field.ownerDocument.getSelection();
  if (!selection) {
    return;
  }
  let range: Range;
  if (point instanceof Range && field.contains(point.startContainer) && field.contains(point.endContainer)) {
    range = point;
  } else {
    range = field.ownerDocument.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Puts the focus in the input field, with the caret after its last character. */
export function focusAtEnd(field: HTMLElement): void {
  field.focus({ preventScroll: true });
  if (isTextControl(field)) {
    try {
      field.setSelectionRange(field.value.length, field.value.length);
    } catch {
      // An <input> of a type without a text selection (email, number): the focus is enough
    }
    return;
  }
  const selection = field.ownerDocument.getSelection();
  if (!selection) {
    return;
  }
  const range = field.ownerDocument.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

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

/**
 * Characters an editor puts in its markup that the user neither typed nor sees, such as the
 * zero-width space Lexical keeps beside the caret: not text of the field for the `//`. Not the
 * zero-width joiner and non-joiner (U+200C, U+200D): the user writes those (Persian and Indic
 * scripts, emoji), so two slashes they separate are not a `//`.
 */
const INVISIBLE = /[\u200B\u2060\uFEFF]/g;

const visible = (text: string): string => text.replace(INVISIBLE, '');

/**
 * Zero-width characters, the joiners included, in an element of the field hidden from assistive
 * technology: the marks a Platform's own menu leaves there, not the user's text. M365 Copilot's
 * slash menu ends the paragraph with `<span aria-hidden="true">` holding U+200B U+200C while it is
 * open. A joiner the user writes sits in the editor's ordinary text: an editable hidden span that
 * holds only joiners between two slashes is taken for such marks, as one holding U+200B is.
 */
const HIDDEN_MARKS = /[\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Whether `node` is, or is inside, an element hidden from assistive technology, below `root`: what
 * is around the root itself is not looked at
 */
const isHidden = (node: Node, root: Node): boolean => {
  for (let current: Node | null = node; current && current !== root; current = current.parentNode) {
    if (current.nodeType === Node.ELEMENT_NODE && (current as Element).getAttribute('aria-hidden') === 'true') {
      return true;
    }
  }
  return false;
};

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
 * `hiddenMarks: false` leaves out the zero-width characters of elements hidden from assistive
 * technology (HIDDEN_MARKS), as the `//` is read.
 */
export function plainTextOf(root: Node, { hiddenMarks = true }: { hiddenMarks?: boolean } = {}): string {
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
        const raw = child.nodeValue ?? '';
        const text = hiddenMarks || !isHidden(child, root) ? raw : raw.replace(HIDDEN_MARKS, '');
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
 * The plain text between the start of the field and the caret, as the `//` is read: without the
 * zero-width marks of elements hidden from assistive technology (HIDDEN_MARKS). Null when there is
 * no caret in the field (nothing is focused there, or text is selected).
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
  return plainTextOf(range.cloneContents(), { hiddenMarks: false });
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
  const seen = visible(before);
  if (!seen.endsWith(SELECTOR_TRIGGER)) {
    return false;
  }
  const preceding = seen.charAt(seen.length - SELECTOR_TRIGGER.length - 1);
  return preceding === '' || /\s/.test(preceding);
}

/**
 * True when the selection holds text only: no element without text (an image, an icon drawn by
 * the page, a chip the user cannot edit that holds only a zero-width space) that deleting it
 * would take with the slashes. An editor's own span around a zero-width space holds text. The
 * page's elements are judged, not a copy of the selection: a copy holds an empty piece of the
 * element the selection starts at the end of (bold text before the slashes).
 */
function holdsOnlyText(selection: Selection, field: HTMLElement): boolean {
  if (selection.rangeCount === 0) {
    return false;
  }
  const range = selection.getRangeAt(0);
  const root = range.commonAncestorContainer;
  const scope = root.nodeType === Node.ELEMENT_NODE ? (root as Element) : root.parentElement;
  return Array.from(scope?.querySelectorAll('*') ?? []).every((element) => {
    // A chip the user cannot edit holds no text when all it holds is invisible. A text node of
    // Lexical holds text even when empty, as one the slash menu of M365 Copilot leaves
    if (element.getAttribute('data-lexical-text') === 'true' && !element.closest('[contenteditable="false"]')) {
      return true;
    }
    // read as the // is: hidden, its joiners are marks too
    const raw = element.textContent ?? '';
    const chipText = isHidden(element, field) ? raw.replace(HIDDEN_MARKS, '') : visible(raw);
    const text = element.closest('[contenteditable="false"]') ? chipText : raw;
    return text !== '' || !range.intersectsNode(element);
  });
}

/**
 * Reads whether the `//` before the caret of a contenteditable field is gone, the rest kept: the
 * field as it must be afterwards is its text now without the two characters. An editor whose own
 * handler puts the // back, or changes the rest of the draft, did not take the removal. Two things
 * the removal itself changes are not differences: the browser turns a space left at the end of a
 * line into a non-breaking one, and the one line break before a // that ended the field becomes the
 * break that keeps the last line open, which is not read as a line. Neither is a character the user
 * does not see, which an editor may add or drop as it pleases.
 *
 * @param before - The text before the caret, read now, ending with the //
 */
function removalCheck(field: HTMLElement, before: string): () => boolean {
  const spaces = (text: string): string => text.replace(/\u00a0/g, ' ');
  const original = visible(plainTextOf(field, { hiddenMarks: false }));
  const typed = visible(before);
  const expected = spaces(original.slice(0, typed.length - SELECTOR_TRIGGER.length) + original.slice(typed.length));
  // Only a // with nothing after it can leave such a break: elsewhere a missing line is a change
  const endedField = original.length === typed.length;
  return () => {
    const now = spaces(visible(plainTextOf(field, { hiddenMarks: false })));
    return now === expected || (endedField && expected.endsWith('\n') && now === expected.slice(0, -1));
  };
}

/**
 * Asks the editor of a contenteditable field to delete the `//` before the caret itself, as two
 * presses of Backspace do: one beforeinput event of `deleteContentBackward` per slash. An editor
 * that writes its own DOM (Lexical) handles such an event and cancels it, and it may put back what
 * the browser's editing command deletes behind its back, as Microsoft 365 Copilot's does while its
 * slash menu is open (read live on 2026-11-16).
 *
 * Null when this is not for the editor to do, and removeTypedTrigger removes the // instead: the
 * caret is not right after the two slashes in one text node, or the editor did not cancel the first
 * event. Otherwise resolves, once the editor has drawn its change, to whether the // is gone and
 * the rest of the field kept.
 */
export function deleteTypedTriggerByEditor(field: HTMLElement): Promise<boolean> | null {
  const before = textBeforeCaret(field);
  const selection = field.ownerDocument.getSelection();
  const node = selection?.focusNode;
  const offset = selection?.focusOffset ?? 0;
  // In a text control the caret is in no text node of the page
  if (before === null || node?.nodeType !== Node.TEXT_NODE
    || (node.nodeValue ?? '').slice(offset - SELECTOR_TRIGGER.length, offset) !== SELECTOR_TRIGGER) {
    return null;
  }
  const removed = removalCheck(field, before);
  const backspace = (): boolean => {
    // At the caret, as the browser sends it: an editor that draws at once has replaced the node
    // the first event went to
    const at = selection?.focusNode?.parentElement;
    const target = at && field.contains(at) ? at : field;
    const event = new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true, composed: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  if (!backspace()) {
    return null;
  }
  backspace();
  // An editor draws a change once its update is done: after the events, before the next task
  return new Promise((resolve) => {
    field.ownerDocument.defaultView?.setTimeout(() => { resolve(removed()); }, 0) ?? resolve(removed());
  });
}

/**
 * Removes the `//` just typed before the caret, as two presses of Backspace would: the rest of the
 * field is not rewritten, and the Platform's editor hears of it through its usual input events.
 * When the editing command is missing or refused, the two characters are taken out of their text
 * node (only a // with no character the user does not see between or after its slashes:
 * otherwise the selector stays closed and the field as it was). The marks a Platform's menu leaves
 * after the slashes in hidden elements (HIDDEN_MARKS) go with them only by the editing command.
 * Returns whether they are gone: the selector does not open over a `//` it could not remove.
 */
export function removeTypedTrigger(field: HTMLElement): boolean {
  const before = textBeforeCaret(field);
  if (before === null || !visible(before).endsWith(SELECTOR_TRIGGER)) {
    return false;
  }
  const document = field.ownerDocument;
  const canExec = typeof document.execCommand === 'function';

  if (isTextControl(field)) {
    if (!before.endsWith(SELECTOR_TRIGGER)) {
      return false;
    }
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
  const removed = removalCheck(field, before);

  if (canExec && typeof selection.modify === 'function') {
    // Back over the two slashes, and over a character the user does not see between them or
    // after them (Lexical's zero-width space)
    // The selection is read as the // is: the marks of a hidden element are not text
    // A selection wholly inside a hidden element is cloned without it: its marks are judged on the page
    const selected = (): string => {
      if (selection.rangeCount === 0) {
        return '';
      }
      const range = selection.getRangeAt(0);
      const text = plainTextOf(range.cloneContents(), { hiddenMarks: false });
      return visible(isHidden(range.commonAncestorContainer, field) ? text.replace(HIDDEN_MARKS, '') : text);
    };
    for (let i = 0; i < SELECTOR_TRIGGER.length + 4 && selected().length < SELECTOR_TRIGGER.length; i++) {
      selection.modify('extend', 'backward', 'character');
    }
    // A selection that took in an element without text (an image) is not deleted
    if (selected() === SELECTOR_TRIGGER && holdsOnlyText(selection, field) && document.execCommand('delete')) {
      // Chrome deletes on the page at once and sends no beforeinput for the editing command, so
      // the editor hears only input. An editor that puts its own DOM back later (from a mutation
      // observer, after this read) is not seen here: the live check covers Copilot
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

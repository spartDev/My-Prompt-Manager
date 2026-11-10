/**
 * The plain text of a Platform's input field, and the `//` that opens the Prompt selector from it.
 *
 * Plain TypeScript, loaded with the content script (ADR-002): it reads what the field holds
 * (so an Insertion can be undone), tells whether the user just typed `//` where it opens the
 * selector, removes those two characters, and puts the caret at the end of the field.
 *
 * An input field is a <textarea>, an <input>, or a contenteditable element. The text of a
 * contenteditable is read block by block: one line per paragraph, so rich content comes back as
 * plain text.
 */

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
  // Spaces and line breaks are left out of the comparison: once the // is gone the editor may lay
  // its lines out again (a <br> before the // becomes the one that keeps the last line open)
  const characters = (text: string): string => text.replace(/\s+/g, '');
  const original = plainTextOf(field);
  const expected = characters(original.slice(0, before.length - SELECTOR_TRIGGER.length) + original.slice(before.length));
  const removed = (): boolean => characters(plainTextOf(field)) === expected;

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

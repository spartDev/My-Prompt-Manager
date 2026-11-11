import type { Locator, Page } from '@playwright/test';

import { expect } from './extension';
import { enterKeys, promptRow, promptSelector } from './platform-pages';

/**
 * What a user does around an Insertion since My-Prompt-Manager-q9j.3, as one flow that runs on any
 * page the content script is on (a Platform's stand-in page or a custom site): open the Prompt
 * selector by typing `//`, insert, undo, and be told when the Prompt could not be inserted.
 */

const host = (page: Page) => page.locator('#mpm-prompt-selector');

/** The confirmation shown above the input field after an Insertion. */
export const insertionPill = (page: Page) => host(page).getByRole('status');

/** Its Undo button. */
export const undoButton = (page: Page) => insertionPill(page).getByRole('button', { name: 'Undo' });

/** The sweep drawn over the input field after an Insertion. */
export const insertionSweep = (page: Page) => host(page).locator('.mpm-sweep');

/** The plain text the input field holds: the value of a textarea, the text of a contenteditable. */
export const fieldText = (field: Locator) =>
  field.evaluate((element) => (element instanceof HTMLTextAreaElement ? element.value : (element.textContent ?? '')));

/** Whether the caret is in the field, after its last character, with nothing selected. */
export const caretAtEnd = (field: Locator) =>
  field.evaluate((element) => {
    if (element instanceof HTMLTextAreaElement) {
      return element.selectionStart === element.value.length && element.selectionEnd === element.value.length;
    }
    const selection = document.getSelection();
    if (!selection?.isCollapsed || !selection.focusNode || !element.contains(selection.focusNode)) {
      return false;
    }
    const range = document.createRange();
    range.setStart(element, 0);
    range.setEnd(selection.focusNode, selection.focusOffset);
    return range.toString().length === (element.textContent ?? '').length;
  });

export interface InsertionFlow {
  /** The input field of the page. */
  field: Locator;
  /** A Prompt without Variables that the selector lists. */
  prompt: { id: string; title: string; content: string };
  /** How many times the Prompt has been inserted, as the Library has it now. */
  usageCount: () => Promise<number>;
}

/**
 * Runs the whole flow and asserts each step. The field must be empty and the Prompt selector
 * closed when it starts; it ends with a failed Insertion, so the field has been replaced.
 */
export async function expectInsertionFlow(page: Page, { field, prompt, usageCount }: InsertionFlow): Promise<void> {
  const selector = promptSelector(page);
  const pill = insertionPill(page);
  const usesBefore = await usageCount();
  const draft = 'Draft https:// ';

  // The // of a URL opens nothing, and stays in the field
  await field.click();
  await page.keyboard.type('Draft https://');
  await page.waitForTimeout(400);
  await expect(selector).toBeHidden();
  expect(await fieldText(field)).toBe('Draft https://');

  // // after a space opens the selector: the two characters go, the text before them stays
  await page.keyboard.type(' //');
  await expect(selector).toBeVisible();
  await expect.poll(() => fieldText(field)).toBe(draft);

  // Escape closes; // at the very start of an empty field opens too
  await page.keyboard.press('Escape');
  await expect(selector).toBeHidden();
  await expect(field).toBeFocused();
  expect(await fieldText(field)).toBe(draft);

  // Open again by //, choose the Prompt
  await page.keyboard.type('//');
  await expect(selector).toBeVisible();
  await expect.poll(() => fieldText(field)).toBe(draft);
  await promptRow(page, prompt.id).click();

  // The selector closes first, then the text arrives, the focus is in the field with the caret
  // at the end, and the confirmation names the Prompt and offers Undo
  await expect(selector).toBeHidden();
  await expect.poll(() => fieldText(field)).toBe(prompt.content);
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAttribute('data-kind', 'inserted');
  await expect(pill).toContainText(`Inserted “${prompt.title}”`);
  await expect(undoButton(page)).toBeVisible();
  await expect(field).toBeFocused();
  expect(await caretAtEnd(field)).toBe(true);
  await expect(insertionSweep(page)).toHaveCount(1);
  await expect(insertionSweep(page)).toHaveCSS('animation-duration', '1.1s');
  await expect.poll(usageCount).toBe(usesBefore + 1);

  // Undo puts back exactly the text the field held before, and does not uncount the use
  await undoButton(page).click();
  await expect(pill).toBeHidden();
  await expect.poll(() => fieldText(field)).toBe(draft);
  await expect(field).toBeFocused();
  expect(await caretAtEnd(field)).toBe(true);
  expect(await usageCount()).toBe(usesBefore + 1);

  // Insert again; the confirmation leaves as soon as the user types
  await page.keyboard.type('//');
  await expect(selector).toBeVisible();
  await promptRow(page, prompt.id).click();
  await expect(pill).toBeVisible();
  await expect.poll(() => fieldText(field)).toBe(prompt.content);
  await page.keyboard.type('!');
  await expect(pill).toBeHidden();
  expect(await fieldText(field)).toBe(`${prompt.content}!`);
  await expect.poll(usageCount).toBe(usesBefore + 2);

  // A failed Insertion: the page replaces its input field while the selector closes (a Platform
  // re-rendering its composer). The user is told, with no Undo and no sweep, and no use is counted
  await page.keyboard.type(' //');
  await expect(selector).toBeVisible();
  await field.evaluate((element) => {
    document.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.id === 'mpm-prompt-selector') {
        element.replaceWith(element.cloneNode(true));
      }
    }, { capture: true, once: true });
  });
  await promptRow(page, prompt.id).click();
  await expect(selector).toBeHidden();
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAttribute('data-kind', 'failed');
  await expect(pill).toHaveText(`Couldn't insert “${prompt.title}”`);
  await expect(undoButton(page)).toHaveCount(0);
  await expect(insertionSweep(page)).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(await usageCount()).toBe(usesBefore + 2);
}

/** More Tab presses than any of the pages needs to go from its input field to the confirmation. */
const TAB_LIMIT = 10;

/**
 * Presses Tab until the confirmation's Undo button has the focus, as a user who has only the
 * keyboard does: through the page's own controls, since the confirmation is last in the tab order.
 * Returns how many presses it took. Fails when the confirmation has left meanwhile, or when Tab
 * never gets there.
 */
export async function tabToUndo(page: Page): Promise<number> {
  const undo = undoButton(page);
  for (let presses = 1; presses <= TAB_LIMIT; presses++) {
    await page.keyboard.press('Tab');
    if ((await undo.count()) === 0) {
      throw new Error(`The confirmation left before Tab reached Undo (${String(presses)} presses)`);
    }
    if (await undo.evaluate((button) => button.matches(':focus'))) {
      return presses;
    }
  }
  throw new Error(`Tab pressed ${String(TAB_LIMIT)} times without reaching Undo`);
}

export interface KeyboardInsertionFlow {
  /** The input field of the page, empty, and the first control Tab reaches. */
  field: Locator;
  /** The first Prompt the selector lists, without Variables. */
  prompt: { id: string; content: string };
}

/**
 * An Insertion and its Undo with no pointer at all, on any page the content script is on and that
 * counts its Enter keys (ENTER_COUNTER): Tab to the input field, a draft, `//`, Enter on the first
 * Prompt, then Tab to Undo and Enter. No Enter reaches the page, which would send the message.
 */
export async function expectKeyboardInsertionFlow(page: Page, { field, prompt }: KeyboardInsertionFlow): Promise<void> {
  const selector = promptSelector(page);
  const pill = insertionPill(page);

  // Tab from the top of the page reaches the input field, which holds text before the Insertion
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  await page.keyboard.type('Keep this  text ');
  const before = await fieldText(field);
  expect(before).toBe('Keep this  text ');

  // // then Enter: the first Prompt of the list is inserted
  await page.keyboard.type('//');
  await expect(selector).toBeVisible();
  await expect(promptRow(page, prompt.id)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(selector).toBeHidden();
  await expect.poll(() => fieldText(field)).toBe(prompt.content);
  await expect(pill).toBeVisible();
  expect(await enterKeys(page)).toBe(0);

  // Undo: Tab goes on through the page's own controls to the confirmation, and Enter presses Undo
  await tabToUndo(page);
  await page.keyboard.press('Enter');
  await expect(pill).toBeHidden();
  await expect.poll(() => fieldText(field)).toBe(before);
  await expect(field).toBeFocused();
  expect(await enterKeys(page)).toBe(0);
}

/**
 * E2E: an Insertion puts the Prompt where the caret is (My-Prompt-Manager-7k4; CONTEXT.md, Insertion)
 *
 * Runs the built extension's content script on the stand-in page of each of the seven Platforms,
 * and on the stand-ins of the rich text editors three of them have live (ProseMirror on ChatGPT
 * and Mistral, Lexical on Perplexity). On each, with a real caret in a real browser:
 * - the Prompt goes where the caret is, and the text before and after it stays;
 * - the caret ends right after the Prompt;
 * - selected text is replaced by the Prompt;
 * - Undo puts back the text the field held.
 * The selector is opened by typing `//` and from the Prompts button: either way the focus leaves
 * the field while the user chooses, and the Prompt still goes where the caret was.
 */

import type { Page } from '@playwright/test';

import { DEFAULT_CATEGORY } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { fieldText, insertionPill, undoButton } from '../fixtures/insertion-flow';
import { ALL_FIXTURES, choosePrompt, openPlatform, PLATFORM_FIELD, promptRow, promptSelector, promptsButton } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const ROLE = { id: 'role', title: 'Reviewer role', content: 'as a senior reviewer, ' };

/** The plain text between the start of the field and the caret, or null when text is selected or the caret is elsewhere. */
const textBeforeCaret = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => {
    if (element instanceof HTMLTextAreaElement) {
      return element.selectionStart === element.selectionEnd ? element.value.slice(0, element.selectionStart) : null;
    }
    const selection = document.getSelection();
    if (!selection?.isCollapsed || !selection.focusNode || !element.contains(selection.focusNode)) {
      return null;
    }
    const range = document.createRange();
    range.setStart(element, 0);
    range.setEnd(selection.focusNode, selection.focusOffset);
    return range.toString();
  });

test.describe('An Insertion puts the Prompt where the caret is', () => {
  for (const fixture of ALL_FIXTURES) {
    test(`${fixture}: the text before and after the caret stays, a selection is replaced, Undo puts the draft back`, async ({ context, storage }) => {
      await seedLibrary(storage, { prompts: [createPromptSeed({ category: DEFAULT_CATEGORY, ...ROLE })] });
      const page = await openPlatform(context, fixture);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await expect(promptsButton(page)).toHaveCount(1);
      const selector = PLATFORM_FIELD[fixture];
      const field = page.locator(selector);
      const pill = insertionPill(page);

      // A draft, and the caret put back inside it: between "Review " and "this diff"
      await field.click();
      await page.keyboard.type('Review this diff');
      for (let index = 0; index < 'this diff'.length; index++) {
        await page.keyboard.press('ArrowLeft');
      }
      expect(await textBeforeCaret(page, selector)).toBe('Review ');

      // Opened by typing //: the Prompt goes where the caret is, and the caret ends after it
      await page.keyboard.type('//');
      await expect(promptSelector(page)).toBeVisible();
      await expect.poll(() => fieldText(field)).toBe('Review this diff');
      await promptRow(page, ROLE.id).click();
      await expect(promptSelector(page)).toBeHidden();
      await expect.poll(() => fieldText(field), { message: 'the Prompt between the text before and the text after' })
        .toBe(`Review ${ROLE.content}this diff`);
      await expect(pill).toHaveAttribute('data-kind', 'inserted');
      await expect(field).toBeFocused();
      expect(await textBeforeCaret(page, selector)).toBe(`Review ${ROLE.content}`);

      // Undo puts back the text the field held
      await undoButton(page).click();
      await expect(pill).toBeHidden();
      await expect.poll(() => fieldText(field), { message: 'the draft, after Undo' }).toBe('Review this diff');
      await expect(field).toBeFocused();

      // Opened from the Prompts button, with "diff" selected: the Prompt takes its place
      for (let index = 0; index < 'diff'.length; index++) {
        await page.keyboard.press('Shift+ArrowLeft');
      }
      await choosePrompt(page, ROLE.id);
      await expect.poll(() => fieldText(field), { message: 'the Prompt in place of the selected text' })
        .toBe(`Review this ${ROLE.content}`);
      await undoButton(page).click();
      await expect.poll(() => fieldText(field)).toBe('Review this diff');

      // Opened from the Prompts button, the caret at the very start: the Prompt goes before the
      // draft, and what the user types next goes right after the Prompt
      for (let index = 0; index < 'Review this diff'.length; index++) {
        await page.keyboard.press('ArrowLeft');
      }
      expect(await textBeforeCaret(page, selector)).toBe('');
      await choosePrompt(page, ROLE.id);
      await expect.poll(() => fieldText(field), { message: 'the Prompt before the draft' })
        .toBe(`${ROLE.content}Review this diff`);
      await expect(field).toBeFocused();
      await page.keyboard.type('please ');
      expect(await fieldText(field)).toBe(`${ROLE.content}please Review this diff`);

      expect(errors).toEqual([]);
    });
  }
});

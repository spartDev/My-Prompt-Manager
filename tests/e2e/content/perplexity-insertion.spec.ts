/**
 * On Perplexity a Prompt is inserted once, with its line breaks (Verbatim, CONTEXT.md).
 *
 * Perplexity's live composer is a Lexical editor. On 2026-11-11 a Prompt reached it twice in one
 * line: once from the editing command, its line breaks dropped, and once more from the `input`
 * event the Insertion sent with the text (My-Prompt-Manager-e66). These run the real content
 * script on a stand-in that mounts a real Lexical editor, at the version the live site serves
 * (fixtures/platform-pages.ts, lexicalEditor).
 *
 * The // typed in the empty field opens the Prompt selector, and keeps it, and a key typed right
 * after the // is not lost: the // taken out of its text node, the live editor took that emptied
 * text out of the field 20 ms later, with the focus from the selector's search field and with a
 * key typed meanwhile. The editor is now asked to delete the // itself, as Backspace asks it
 * (My-Prompt-Manager-9o0).
 */
import { DEFAULT_CATEGORY } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { undoButton } from '../fixtures/insertion-flow';
import { choosePrompt, enterKeys, openPlatform, promptSelector, promptsButton } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const REVIEW = {
  id: 'review',
  title: 'Review a pull request',
  content: '  You are a senior engineer reviewing a pull request.\nEnd with a one-line verdict.\n\nDiff:\n',
};

const ONE_LINE = { id: 'one-line', title: 'One line', content: 'Summarise this in one sentence.' };

/** What the editor shows: a line per <br>, the last <br> being the one that keeps an empty last line open. */
const readEditor = () => {
  const paragraph = document.querySelector('#ask-input p') as HTMLElement;
  const nodes = Array.from(paragraph.childNodes);
  const lines = [''];
  nodes.forEach((node, index) => {
    if (node.nodeName === 'BR') {
      if (index < nodes.length - 1) { lines.push(''); }
    } else {
      lines[lines.length - 1] += node.textContent ?? '';
    }
  });
  return lines.join('\n');
};

test.describe('On Perplexity a Prompt is inserted once, with its line breaks', () => {
  test.beforeEach(async ({ storage }) => {
    await seedLibrary(storage, {
      prompts: [REVIEW, ONE_LINE].map((sample) => createPromptSeed({ category: DEFAULT_CATEGORY, ...sample })),
    });
  });

  test('the Prompt is in the field once, line for line, and the next Insertion goes after it', async ({ context }) => {
    const page = await openPlatform(context, 'perplexity-editor');

    await choosePrompt(page, REVIEW.id);

    await expect.poll(() => page.evaluate(readEditor), { message: 'the Prompt, once' }).toBe(REVIEW.content);

    // The next one goes where the first left the caret, on the empty last line, once too
    await choosePrompt(page, ONE_LINE.id);

    await expect.poll(() => page.evaluate(readEditor)).toBe(REVIEW.content + ONE_LINE.content);
    expect(await enterKeys(page)).toBe(0);
  });

  test('Undo puts back a draft of several lines, and an empty field', async ({ context }) => {
    const page = await openPlatform(context, 'perplexity-editor');
    const field = page.locator('#ask-input');

    // Nothing in the field: Undo empties it again
    await choosePrompt(page, REVIEW.id);
    await expect.poll(() => page.evaluate(readEditor)).toBe(REVIEW.content);
    await undoButton(page).click();
    await expect.poll(() => page.evaluate(readEditor), { message: 'empty again' }).toBe('');

    // A draft of two lines: the editor takes it as a paste, as a user would bring it
    await field.focus();
    await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', 'my draft\nsecond line');
      document.querySelector('#ask-input')?.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    });
    await expect.poll(() => page.evaluate(readEditor)).toBe('my draft\nsecond line');

    await choosePrompt(page, ONE_LINE.id);
    await expect.poll(() => page.evaluate(readEditor)).toBe(`my draft\nsecond line${ONE_LINE.content}`);
    await undoButton(page).click();

    await expect.poll(() => page.evaluate(readEditor), { message: 'the draft, line for line' }).toBe('my draft\nsecond line');
  });

  test('// typed in the empty field opens the selector, the // gone, and what is typed next goes in its search field', async ({ context }) => {
    const page = await openPlatform(context, 'perplexity-editor');
    // Opened once before, as a user would have: the next opening is quick, quicker than the
    // editor's 20 ms update (the first one loads React)
    await promptsButton(page).click();
    await expect(promptSelector(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(promptSelector(page)).toHaveCount(0);
    await page.locator('#ask-input').click();

    await page.keyboard.type('//');

    await expect(promptSelector(page)).toBeVisible();
    // No text is left in the field for an update of the editor's own to take out later
    await expect(page.locator('#ask-input span')).toHaveCount(0);
    await page.waitForTimeout(100);
    expect(await page.evaluate(readEditor)).toBe('');
    const focused = () => page.evaluate(() => {
      const host = document.activeElement;
      return { host: host?.id, inside: host?.shadowRoot?.activeElement?.getAttribute('aria-label') ?? null };
    });
    expect(await focused()).toEqual({ host: 'mpm-prompt-selector', inside: 'Search prompts' });

    await page.keyboard.type('line');

    await expect(promptSelector(page).getByRole('combobox', { name: 'Search prompts' })).toHaveValue('line');
    expect(await page.evaluate(readEditor)).toBe('');
    await expect(promptSelector(page)).toBeVisible();
  });

  test('a character typed right after the // in the empty field is kept', async ({ context }) => {
    const page = await openPlatform(context, 'perplexity-editor');
    await page.locator('#ask-input').click();
    // A t typed the moment the // is out of the field, as the editor shows it: sent by the page in
    // the next task, the soonest a key could come, so that it lands within the 20 ms an emptied
    // text would stay in the field, every time. Being the page's, it does not drop the opening
    await page.evaluate(() => {
      const editor = document.querySelector('#ask-input') as HTMLElement;
      const observer = new MutationObserver(() => {
        if (editor.textContent === '') {
          observer.disconnect();
          window.setTimeout(() => {
            editor.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 't', bubbles: true, cancelable: true }));
          }, 0);
        }
      });
      observer.observe(editor, { childList: true, subtree: true, characterData: true });
    });

    await page.keyboard.type('//');

    await expect(promptSelector(page)).toBeVisible();
    await page.waitForTimeout(100);
    expect(await page.evaluate(readEditor)).toBe('t');
  });
});

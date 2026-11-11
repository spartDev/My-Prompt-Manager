/**
 * On Perplexity a Prompt is inserted once, with its line breaks (Verbatim, CONTEXT.md).
 *
 * Perplexity's live composer is a Lexical editor. On 2026-11-11 a Prompt reached it twice in one
 * line: once from the editing command, its line breaks dropped, and once more from the `input`
 * event the Insertion sent with the text (My-Prompt-Manager-e66). These run the real content
 * script on a stand-in that treats a paste, the editing command, an `input` event and a Backspace
 * as the live editor does (fixtures/platform-pages.ts, LEXICAL_EDITOR).
 */
import { DEFAULT_CATEGORY } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { undoButton } from '../fixtures/insertion-flow';
import { choosePrompt, enterKeys, openPlatform } from '../fixtures/platform-pages';
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

  test('the Prompt is in the field once, line for line, and the next Insertion replaces it', async ({ context }) => {
    const page = await openPlatform(context, 'perplexity-editor');

    await choosePrompt(page, REVIEW.id);

    await expect.poll(() => page.evaluate(readEditor), { message: 'the Prompt, once' }).toBe(REVIEW.content);

    // The line break that ends the Prompt does not stay under the next one
    await choosePrompt(page, ONE_LINE.id);

    await expect.poll(() => page.evaluate(readEditor)).toBe(ONE_LINE.content);
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
    await expect.poll(() => page.evaluate(readEditor)).toBe(ONE_LINE.content);
    await undoButton(page).click();

    await expect.poll(() => page.evaluate(readEditor), { message: 'the draft, line for line' }).toBe('my draft\nsecond line');
  });
});

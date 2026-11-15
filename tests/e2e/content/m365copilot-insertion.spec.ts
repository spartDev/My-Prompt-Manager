/**
 * Microsoft 365 Copilot where a work account lands: copilot.cloud.microsoft.
 *
 * On 2026-11-15 copilot.microsoft.com and m365.cloud.microsoft/chat both redirected a work account
 * to copilot.cloud.microsoft/chat, where the extension did not run (My-Prompt-Manager-axv). These
 * run the real content script, on a page served at that host, so they fail if the manifest leaves
 * the host out. Its composer is a Lexical editor: the stand-in treats a paste, the editing command,
 * an `input` event and a Backspace as Perplexity's Lexical editor does (fixtures/platform-pages.ts,
 * lexicalEditor), so a Prompt written twice shows. That this editor behaves the same was not seen
 * on the live page: the live check of the ticket, signed in, proves it.
 */
import { DEFAULT_CATEGORY } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { undoButton } from '../fixtures/insertion-flow';
import { choosePrompt, enterKeys, openPlatform, promptsButton } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const REVIEW = {
  id: 'review',
  title: 'Review a pull request',
  content: '  You are a senior engineer reviewing a pull request.\nEnd with a one-line verdict.\n\nDiff:\n',
};

/** What the editor shows: a line per <br>, the last <br> being the one that keeps an empty last line open. */
const readEditor = () => {
  const paragraph = document.querySelector('[data-lexical-editor] p') as HTMLElement;
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

test.describe('Microsoft 365 Copilot at copilot.cloud.microsoft', () => {
  test.beforeEach(async ({ storage }) => {
    await seedLibrary(storage, {
      prompts: [createPromptSeed({ category: DEFAULT_CATEGORY, ...REVIEW })],
    });
  });

  test('the Prompts button sits in the toolbar, right after the plus menu', async ({ context }) => {
    const page = await openPlatform(context, 'm365copilot-editor');

    const button = promptsButton(page);
    await expect(button).toHaveAttribute('data-mpm-placement', 'toolbar');
    await expect(button).toHaveAttribute('data-mpm-anchor', '0');
    expect(await button.evaluate((element) => element.previousElementSibling?.getAttribute('data-testid'))).toBe('PlusMenuButton');
  });

  test('a Prompt is inserted once, line for line, without sending, and Undo empties the field again', async ({ context }) => {
    const page = await openPlatform(context, 'm365copilot-editor');

    await choosePrompt(page, REVIEW.id);

    await expect.poll(() => page.evaluate(readEditor), { message: 'the Prompt, once' }).toBe(REVIEW.content);
    expect(await enterKeys(page)).toBe(0);

    await undoButton(page).click();
    await expect.poll(() => page.evaluate(readEditor), { message: 'empty again' }).toBe('');
  });
});

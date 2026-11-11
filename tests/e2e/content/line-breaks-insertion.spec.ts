/**
 * A Prompt keeps its line breaks in a Platform's rich text editor (Verbatim, CONTEXT.md).
 *
 * The live composers of ChatGPT and Mistral are ProseMirror editors: one <p> per line, and a
 * line break written straight into the DOM is read back as a space. On 2026-11-11 a Prompt with a
 * blank line reached both as a single paragraph (My-Prompt-Manager-3vd). These run the real
 * content script on stand-ins that treat their DOM the same way (fixtures/platform-pages.ts,
 * PARAGRAPH_EDITOR): only a real browser turns execCommand('insertText') into paragraphs.
 */
import { DEFAULT_CATEGORY } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { choosePrompt, EDITOR_FIXTURES, openPlatform } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const REVIEW = {
  id: 'review',
  title: 'Review a pull request',
  content: '  You are a senior engineer reviewing a pull request.\nEnd with a one-line verdict.\n\nDiff:\n',
};

const ONE_LINE = { id: 'one-line', title: 'One line', content: 'Summarise this in one sentence.' };

/** The editor's lines, one per paragraph, and whether any line break is left inside a text node. */
const readEditor = () => {
  const editor = document.querySelector('.ProseMirror') as HTMLElement;
  return {
    lines: Array.from(editor.children).map((block) => block.textContent ?? ''),
    blocks: Array.from(editor.children).map((block) => block.tagName),
    rawLineBreak: (editor.textContent ?? '').includes('\n'),
  };
};

test.describe('A Prompt keeps its line breaks in a rich text editor', () => {
  for (const fixture of EDITOR_FIXTURES) {
    test(`${fixture}: each line of the Prompt is a paragraph of the editor`, async ({ context, storage }) => {
      await seedLibrary(storage, {
        prompts: [REVIEW, ONE_LINE].map((sample) => createPromptSeed({ category: DEFAULT_CATEGORY, ...sample })),
      });
      const page = await openPlatform(context, fixture);

      await choosePrompt(page, REVIEW.id);

      await expect
        .poll(async () => (await page.evaluate(readEditor)).lines.join('\n'), { message: 'the Prompt, line for line' })
        .toBe(REVIEW.content);
      const editor = await page.evaluate(readEditor);
      expect(editor.lines).toEqual([
        '  You are a senior engineer reviewing a pull request.',
        'End with a one-line verdict.',
        '',
        'Diff:',
        '',
      ]);
      expect(editor.blocks).toEqual(['P', 'P', 'P', 'P', 'P']);
      expect(editor.rawLineBreak).toBe(false);

      // A second Insertion replaces the five paragraphs, it does not add to them
      await choosePrompt(page, ONE_LINE.id);

      await expect.poll(async () => (await page.evaluate(readEditor)).lines).toEqual([ONE_LINE.content]);
    });
  }
});

/**
 * Insertion is Verbatim (ADR-001, CONTEXT.md): a Prompt reaches the Platform's input exactly
 * as it is stored, and the Prompt selector shows Prompt text as text.
 *
 * These run the extension's real content script on stand-in Platform pages (see
 * fixtures/platform-pages.ts), because only a real browser does what Insertion relies on:
 * execCommand('insertText') in a contenteditable, React's change tracking on a controlled
 * textarea, and a content script running in its own isolated world.
 */
import type { Prompt } from '../../../src/types';
import { DEFAULT_CATEGORY } from '../../../src/types';
import { extractVariables } from '../../../src/utils/promptVariables';
import { expect, test } from '../fixtures/extension';
import { choosePrompt, openPlatform, routePlatform } from '../fixtures/platform-pages';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const MARKUP =
  'Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true, return data: JSON';

/** A Prompt saved before the 20,000-character limit: it is delivered whole, never shortened. */
const LEGACY_LONG = `${'Legacy Prompt saved before the size limit. '.repeat(700).slice(0, 29_994)}<end/>`;

/** Each is one line: see the contenteditable test for why line breaks are checked on the textarea only. */
const SAMPLES = [
  { id: 'markup', title: 'Markup', content: MARKUP },
  {
    id: 'attribute-like',
    title: 'Attribute-like text',
    content: '<img src=x onerror=alert(1)> <a href="javascript:alert(1)">link</a> javascript:alert(1) {{braces}} ${name} &amp; &lt;b&gt;',
  },
  {
    id: 'unicode',
    title: 'Unicode',
    // Joiners, direction marks, tag-character flags and combining marks are ordinary writing, not Hidden characters
    content:
      'Emoji \u{1F469}\u{200D}\u{1F4BB} \u{1F44D}\u{1F3FD} \u{2764}\u{FE0F} \u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}, ' +
      'Hebrew \u{05E9}\u{05DC}\u{05D5}\u{05DD}\u{200F}, Arabic \u{0645}\u{0631}\u{062D}\u{0628}\u{0627}, ' +
      'Persian \u{0645}\u{06CC}\u{200C}\u{062E}\u{0648}\u{0627}\u{0647}\u{0645}, combining e\u{0301} n\u{0303}',
  },
  { id: 'spaces', title: 'Spaces', content: '   three leading, two  inner and three trailing spaces   ' },
  { id: 'legacy-long', title: 'Legacy, 30,000 characters', content: LEGACY_LONG },
];

const LINE_BREAKS = {
  id: 'line-breaks',
  title: 'Line breaks',
  content: '\n\nTwo leading line breaks,\n\tthen a tab,\n\nand two trailing line breaks\n\n',
};

/** `{{braces}}` is a Variable: the fill-in form opens and "Insert as is" must still deliver the exact text. */
const hasVariables = (content: string): boolean => extractVariables(content).length > 0;

const toSeed = (sample: { id: string; title: string; content: string; category?: string }): Prompt =>
  createPromptSeed({ category: DEFAULT_CATEGORY, ...sample });

test.describe('Insertion is verbatim', () => {
  test('a React-controlled textarea receives each Prompt exactly as stored', async ({ context, storage }) => {
    const samples = [...SAMPLES, LINE_BREAKS];
    await seedLibrary(storage, { prompts: samples.map(toSeed) });
    expect(LEGACY_LONG).toHaveLength(30_000);

    const page = await openPlatform(context, 'chatgpt');
    const textarea = page.locator('#prompt-textarea');
    const reactState = page.locator('#composer-state');

    for (const sample of samples) {
      await choosePrompt(page, sample.id, { insertAsIs: hasVariables(sample.content) });
      await expect.poll(() => textarea.inputValue(), { message: `${sample.id}: textarea value` }).toBe(sample.content);
      await expect.poll(() => reactState.textContent(), { message: `${sample.id}: React state` }).toBe(sample.content);
    }

    // Each use is counted, which rewrites the prompts key: the text is still exactly as stored
    await expect.poll(async () => (await storage.getPrompts()).map((prompt) => prompt.usageCount)).toEqual(samples.map(() => 1));
    expect((await storage.getPrompts()).map((prompt) => prompt.content)).toEqual(samples.map((sample) => sample.content));
  });

  test('a contenteditable editor receives each Prompt exactly as stored, as text', async ({ context, storage }) => {
    // execCommand('insertText') turns a line break into a new paragraph (<div>), which is how a
    // contenteditable holds lines; that is the editor's markup, not a change to the text, so
    // these samples are single lines and the textarea test covers line breaks.
    await seedLibrary(storage, { prompts: SAMPLES.map(toSeed) });

    const page = await openPlatform(context, 'claude');
    const editor = page.locator('.ProseMirror');

    for (const sample of SAMPLES) {
      await choosePrompt(page, sample.id, { insertAsIs: hasVariables(sample.content) });
      await expect.poll(() => editor.textContent(), { message: `${sample.id}: editor text` }).toBe(sample.content);
      expect(await editor.evaluate((element) => element.childElementCount), `${sample.id}: elements made from the text`).toBe(0);
    }
  });

  test('the Prompt selector shows titles, categories and previews as text, never as markup', async ({ context, storage }) => {
    const prompts = [
      toSeed({ id: 'img', title: '<img src=x onerror=alert(1)>', content: '<img src=x onerror=alert(1)>' }),
      toSeed({ id: 'script', title: '<script>alert(1)</script>', content: '<script>alert(1)</script>' }),
      toSeed({ id: 'svg', title: '"><svg onload=alert(1)>', content: '"><svg onload=alert(1)>' }),
      // A restored Prompt keeps its id; / and & in it are not escaped, so it can still be chosen
      toSeed({ id: 'restored/a&b', title: 'Q&A &amp; <b>bold</b>', content: MARKUP, category: '<i>Work</i>' }),
    ];
    await seedLibrary(storage, { prompts });

    const url = await routePlatform(context, 'claude');
    const page = await context.newPage();
    const dialogs: string[] = [];
    const errors: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await page.locator('.prompt-library-integrated-icon').click();
    const selector = page.locator('.prompt-library-selector');
    const items = selector.locator('.prompt-item');
    await expect(items).toHaveCount(prompts.length);

    for (const [index, prompt] of prompts.entries()) {
      const item = items.nth(index);
      const preview = prompt.content.length > 100 ? `${prompt.content.slice(0, 100)}...` : prompt.content;
      expect(await item.getAttribute('data-prompt-id')).toBe(prompt.id);
      expect(await item.locator('.prompt-title').textContent()).toBe(prompt.title);
      expect(await item.locator('.prompt-category').textContent()).toBe(prompt.category);
      expect(await item.locator('.prompt-preview').textContent()).toBe(preview);
    }

    // Nothing was built from Prompt text: the list holds only the selector's own <div>s and no handler attributes
    const tags = await selector.locator('.prompt-list').evaluate((list) => Array.from(list.querySelectorAll('*'), (element) => element.tagName));
    expect(tags).toEqual(prompts.flatMap(() => ['DIV', 'DIV', 'DIV', 'DIV']));
    const handlers = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*')).flatMap((element) =>
        element.getAttributeNames().filter((name) => name.toLowerCase().startsWith('on'))
      )
    );
    expect(handlers).toEqual([]);

    await items.filter({ hasText: 'Q&A &amp; <b>bold</b>' }).click();
    await expect(selector).toBeHidden();
    await expect.poll(() => page.locator('.ProseMirror').textContent()).toBe(MARKUP);

    expect(dialogs).toEqual([]);
    expect(errors).toEqual([]);
  });
});

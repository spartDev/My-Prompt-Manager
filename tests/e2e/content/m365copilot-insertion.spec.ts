/**
 * Microsoft 365 Copilot where a work account lands: copilot.cloud.microsoft.
 *
 * On 2026-11-15 copilot.microsoft.com and m365.cloud.microsoft/chat both redirected a work account
 * to copilot.cloud.microsoft/chat, where the extension did not run (My-Prompt-Manager-axv). These
 * run the real content script, on a page served at that host, so they fail if the manifest leaves
 * the host out. Its composer is a Lexical editor: the stand-in mounts a real one, as Perplexity's
 * does, so a Prompt written twice shows, with Copilot's own slash menu written by hand
 * (fixtures/platform-pages.ts, lexicalEditor and COPILOT_SLASH_MENU).
 */
import { DEFAULT_CATEGORY } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { undoButton } from '../fixtures/insertion-flow';
import { choosePrompt, enterKeys, expectSelectorOpen, openPlatform, PLATFORM_FIELD, promptRow, promptSelector, promptsButton } from '../fixtures/platform-pages';
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

  test('the Prompts button goes into the toolbar rendered after the editor, right after the plus menu', async ({ context }) => {
    const page = await openPlatform(context, 'm365copilot-editor');

    // The stand-in renders its toolbar after its editor, as the live page does, once the button
    // shows: the button waits on the editor, then moves into the toolbar
    const button = promptsButton(page);
    await expect(button).toHaveAttribute('data-mpm-placement', 'toolbar');
    expect(await page.evaluate(() => (window as Window & { __placementBeforeToolbar?: string | null }).__placementBeforeToolbar)).toBe('overlay');
    await expect(button).toHaveAttribute('data-mpm-anchor', '0');
    expect(await button.evaluate((element) => element.previousElementSibling?.getAttribute('data-testid'))).toBe('PlusMenuButton');
  });

  test('the Prompts button still goes into the toolbar when Copilot renders it long after the grace period', async ({ context }) => {
    // Past the grace period (IconPlacementController.TOOLBAR_GRACE_MS, 5 s): the button is left on
    // the overlay and the overlay is reported, then the toolbar shows
    await context.addInitScript(() => { (window as Window & { __toolbarDelay?: number }).__toolbarDelay = 7_000; });
    const page = await openPlatform(context, 'm365copilot-editor');

    const button = promptsButton(page);
    await expect(button).toHaveAttribute('data-mpm-placement', 'overlay');
    await expect(button).toHaveAttribute('data-mpm-placement', 'toolbar', { timeout: 20_000 });
    expect(await page.evaluate(() => (window as Window & { __placementBeforeToolbar?: string | null }).__placementBeforeToolbar)).toBe('overlay');
    await expect(button).toHaveAttribute('data-mpm-anchor', '0');
    expect(await button.evaluate((element) => element.previousElementSibling?.getAttribute('data-testid'))).toBe('PlusMenuButton');
  });

  test('typing // in one go opens the Prompt selector next to Copilot\'s own slash menu, which closes with the //', async ({ context }) => {
    const page = await openPlatform(context, 'm365copilot-editor');
    await expect(promptsButton(page)).toHaveAttribute('data-mpm-placement', 'toolbar');

    await page.locator(PLATFORM_FIELD['m365copilot-editor']).click();
    await page.keyboard.type('//');

    await expectSelectorOpen(page);
    await expect.poll(() => page.evaluate(readEditor), { message: 'the // is gone' }).toBe('');
    await expect(page.locator('[data-e2e="slash-menu"]')).toHaveCount(0);
    // With the menu closed, the paragraph holds none of its hidden spans
    await expect(page.locator('[data-lexical-editor] [aria-hidden="true"]')).toHaveCount(0);
  });

  test('a // typed inside the draft goes, and the draft around it stays as it was', async ({ context }) => {
    const page = await openPlatform(context, 'm365copilot-editor');
    await expect(promptsButton(page)).toHaveAttribute('data-mpm-placement', 'toolbar');

    await page.locator(PLATFORM_FIELD['m365copilot-editor']).click();
    await page.keyboard.type('Hi there');
    for (let step = 0; step < 5; step++) {
      await page.keyboard.press('ArrowLeft');
    }
    await page.keyboard.type('//');

    await expectSelectorOpen(page);
    await expect.poll(() => page.evaluate(readEditor), { message: 'the // is gone, the rest kept' }).toBe('Hi there');
  });

  test('typing // opens the Prompt selector next to Copilot\'s own slash menu, which closes with the //', async ({ context }) => {
    const page = await openPlatform(context, 'm365copilot-editor');
    await expect(promptsButton(page)).toHaveAttribute('data-mpm-placement', 'toolbar');

    await page.locator(PLATFORM_FIELD['m365copilot-editor']).click();
    await page.keyboard.type('/');
    // The first slash opens Copilot's menu, which then keeps the keys typed to itself
    await expect(page.locator('[data-e2e="slash-menu"]')).toHaveCount(1);
    // The extension has read the field after the first slash (a timer set after its own runs after
    // it): the second slash is heard on its own, as when the user pauses between the two
    await page.evaluate(() => new Promise((resolve) => { setTimeout(resolve, 0); }));
    await page.keyboard.type('/');

    await expectSelectorOpen(page);
    await expect.poll(() => page.evaluate(readEditor), { message: 'the // is gone' }).toBe('');
    await expect(page.locator('[data-e2e="slash-menu"]')).toHaveCount(0);

    await promptRow(page, REVIEW.id).click();
    await expect(promptSelector(page)).toBeHidden();
    await expect.poll(() => page.evaluate(readEditor), { message: 'the Prompt, once' }).toBe(REVIEW.content);
  });

  test('the stand-in, as Copilot: with its menu open, a slash the editing command deletes comes back, with one pair of hidden marks', async ({ context }) => {
    // What the AC2 proof of My-Prompt-Manager-hai stands on: the // is put back, and the state set
    // back does not add a second pair of marks to the paragraph
    const page = await openPlatform(context, 'm365copilot-editor');
    const marks = page.locator('[data-lexical-editor] [aria-hidden="true"]');
    const text = () => page.locator('[data-lexical-editor] [data-lexical-text]:not([aria-hidden])').allTextContents().then((parts) => parts.join(''));
    await page.locator(PLATFORM_FIELD['m365copilot-editor']).click();
    await page.keyboard.type('Hi there');
    for (let step = 0; step < 5; step++) {
      await page.keyboard.press('ArrowLeft');
    }
    await page.keyboard.type('/');
    await expect(page.locator('[data-e2e="slash-menu"]')).toHaveCount(1);
    await expect(marks).toHaveCount(2);

    // What the field shows once the editing command has deleted, before the stand-in puts it back:
    // read at the input event, in the capture phase, ahead of the editor's own listeners
    const deleted = await page.evaluate(() => {
      let seen: string | null = null;
      const record = (event: Event): void => {
        if ((event as InputEvent).inputType.startsWith('delete')) {
          seen = Array.from(document.querySelectorAll('[data-lexical-editor] [data-lexical-text]:not([aria-hidden])'))
            .map((span) => span.textContent ?? '').join('');
        }
      };
      document.addEventListener('input', record, true);
      document.getSelection()?.modify('extend', 'backward', 'character');
      document.execCommand('delete');
      document.removeEventListener('input', record, true);
      return seen;
    });
    expect(deleted, 'the editing command deleted the slash').toBe('Hi there');

    await expect.poll(text, { message: 'the slash is back' }).toBe('Hi /there');
    await expect(page.locator('[data-e2e="slash-menu"]')).toHaveCount(1);
    await expect(marks).toHaveCount(2);

    // Backspace, which the editor takes itself, removes the slash: the menu closes, its marks go
    await page.keyboard.press('Backspace');
    await expect.poll(text).toBe('Hi there');
    await expect(page.locator('[data-e2e="slash-menu"]')).toHaveCount(0);
    await expect(marks).toHaveCount(0);
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

/**
 * Admission (ADR-001, CONTEXT.md): Prompt text is checked once, when it enters the Library,
 * by any route. Hidden characters are removed and nothing else is changed; from then on the
 * text is Verbatim. These drive the side panel's real form and read back what chrome.storage
 * holds through the extension's service worker.
 */
import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { choosePrompt, openPlatform } from '../fixtures/platform-pages';
import { LibraryPage } from '../pages/LibraryPage';
import { PromptFormPage } from '../pages/PromptFormPage';
import { extensionNavigation } from '../utils/navigation';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SIDE_PANEL = {
  settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' as const },
  interfaceMode: 'sidepanel' as const,
};

/** Text as a user types or pastes it: Hidden characters are marked, so the admitted text is the rest, unchanged. */
type Typed = (string | { hidden: string })[];
const typed = (parts: Typed): string => parts.map((part) => (typeof part === 'string' ? part : part.hidden)).join('');
const admitted = (parts: Typed): string => parts.filter((part): part is string => typeof part === 'string').join('');

const CONTENT: Typed = [
  '\n  <task>Summarize the metadata:',
  { hidden: '\u{200B}' },
  ' use <example>text</example> tags;',
  { hidden: '\u{202E}' },
  ' if count=5 and onboarding = true, return data: JSON</task>\n',
  'Hidden instructions ',
  // "Ignore" written in Unicode tag characters
  { hidden: '\u{E0049}\u{E0067}\u{E006E}\u{E006F}\u{E0072}\u{E0065}' },
  'are removed; the joiners in \u{1F469}\u{200D}\u{1F4BB} and \u{0645}\u{06CC}\u{200C}\u{062E}\u{0648}\u{0627}\u{0647}\u{0645} ',
  'and the mark in \u{05E9}\u{05DC}\u{05D5}\u{05DD}\u{200F} are kept.\t\n',
];

test.describe('Admission', () => {
  test('typed text is admitted once: Hidden characters go, everything else stays through an edit and into the chat', async ({
    context,
    storage,
    extensionId,
  }) => {
    await seedLibrary(storage, SIDE_PANEL);
    const sidePanel = await extensionNavigation.openSidepanel(context, extensionId);
    const library = new LibraryPage(sidePanel);
    const form = new PromptFormPage(sidePanel);

    await library.expectLibraryLoaded();
    await library.clickAddNewPrompt();
    await form.createPrompt({ title: '  Summarize <example>\u{200B} tags  ', content: typed(CONTENT) });

    // Stored: Hidden characters removed, title trimmed, content otherwise exactly as typed
    const [created] = await storage.getPrompts();
    expect(created.title).toBe('Summarize <example> tags');
    expect(created.content).toBe(admitted(CONTENT));

    // Editing the title sends the content through Admission again: admitted text comes back unchanged
    await library.editPrompt(created.title);
    await form.expectEditMode();
    expect(await form.getContentInput().inputValue()).toBe(admitted(CONTENT));
    await sidePanel.getByLabel('Title', { exact: true }).fill('Summarize <example> tags, edited\u{2066}');
    await form.saveChanges();

    const [edited] = await storage.getPrompts();
    expect(edited).toMatchObject({
      id: created.id,
      title: 'Summarize <example> tags, edited',
      content: admitted(CONTENT),
    });

    // The chat receives the stored text, unchanged
    const chat = await openPlatform(context, 'chatgpt');
    await choosePrompt(chat, created.id);
    await expect.poll(() => chat.locator('#prompt-textarea').inputValue()).toBe(admitted(CONTENT));
    await expect.poll(() => chat.locator('#composer-state').textContent()).toBe(admitted(CONTENT));
  });

  test.describe('through the clipboard', () => {
    // A headed run shares the system clipboard, so these never run alongside each other
    test.describe.configure({ mode: 'default' });

    test('a Share code round trip keeps the Prompt verbatim', async ({ context, storage, extensionId }) => {
      const original = createPromptSeed({
        id: 'shared-prompt',
        title: 'Summarize <example> tags',
        content:
          '\n  <context>Summarize the metadata: use <example>text</example> tags; if count=5 and onboarding = true, return data: JSON</context>\n' +
          '\tKeep \u{1F469}\u{200D}\u{1F4BB} and \u{0645}\u{06CC}\u{200C}\u{062E}\u{0648}\u{0627}\u{0647}\u{0645} {{braces}}  \n',
        category: DEFAULT_CATEGORY,
      });
      await seedLibrary(storage, { ...SIDE_PANEL, prompts: [original] });
      const sidePanel = await extensionNavigation.openSidepanel(context, extensionId);
      const library = new LibraryPage(sidePanel);

      await library.expectPromptVisible(original.title);
      await sidePanel.getByRole('button', { name: `Share ${original.title}` }).click();
      await expect(sidePanel.getByText('Share link copied to clipboard!')).toBeVisible();

      // Paste the code into Import, as the person receiving it does
      await library.clickAddNewPrompt();
      await sidePanel.getByRole('button', { name: 'Import shared prompt' }).click();
      await sidePanel.getByLabel('Sharing Code *').focus();
      await sidePanel.keyboard.press('ControlOrMeta+V');
      await expect(sidePanel.getByText('Valid sharing code detected')).toBeVisible();
      await sidePanel.getByRole('button', { name: 'Import Prompt' }).click();
      await expect(sidePanel.getByText('Prompt created successfully').first()).toBeVisible();

      const imported = (await storage.getPrompts()).find((prompt) => prompt.id !== original.id);
      expect(imported).toMatchObject({
        title: original.title,
        content: original.content,
        category: original.category,
      });
    });

    test('a 25,000-character paste into Add Prompt is kept whole and refused, never cut to the limit', async ({
      context,
      storage,
      extensionId,
    }) => {
      await seedLibrary(storage, SIDE_PANEL);
      const sidePanel = await extensionNavigation.openSidepanel(context, extensionId);
      const library = new LibraryPage(sidePanel);
      const form = new PromptFormPage(sidePanel);
      const pasted = `${'Pasted text. '.repeat(2_000).slice(0, 24_994)}<end/>`;
      expect(pasted).toHaveLength(25_000);

      await library.expectLibraryLoaded();
      await library.clickAddNewPrompt();
      await sidePanel.evaluate((text) => navigator.clipboard.writeText(text), pasted);
      await form.getContentInput().focus();
      await sidePanel.keyboard.press('ControlOrMeta+V');

      // The browser does not cut the paste at 20,000 characters: the field holds all of it
      await expect.poll(() => form.getContentInput().inputValue()).toBe(pasted);

      await form.fillTitle('Too long');
      await form.getSaveButton().click();
      await expect(sidePanel.getByText('Content cannot exceed 20,000 characters')).toBeVisible();
      expect(await storage.getPrompts()).toEqual([]);
    });
  });
});

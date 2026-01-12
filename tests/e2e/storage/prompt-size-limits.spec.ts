/**
 * E2E tests for MAX_PROMPT_SIZE fix (commit 1e499f0)
 *
 * Bug summary:
 * 1. MAX_PROMPT_SIZE was 10KB but should be 50KB to support 20K character prompts
 *    (20K chars × 2 bytes/char + overhead)
 * 2. updatePrompt() was missing size validation that savePrompt() had, causing
 *    inconsistent behavior where editing worked but adding the same content failed
 *
 * These tests verify:
 * - Large prompts near the 20K character limit can be saved
 * - Large prompts can be updated with large content
 * - Both save and update behave consistently for the same content
 */
import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { LibraryPage } from '../pages/LibraryPage';
import { PromptFormPage } from '../pages/PromptFormPage';
import { seedLibrary, createPromptSeed } from '../utils/storage';

test.describe('Prompt size limits (MAX_PROMPT_SIZE fix)', () => {
  // Generate a large content string near the 20K character limit
  // Using 19,000 characters to stay safely under the 20K limit
  const generateLargeContent = (charCount: number): string => {
    // Use a mix of characters including some multi-byte UTF-8 characters
    // to simulate real-world content
    const baseText = 'This is a test prompt with various content. ';
    const unicodeText = 'Some unicode: café, naïve, résumé. ';
    const combined = baseText + unicodeText;
    const repeatCount = Math.ceil(charCount / combined.length);
    return combined.repeat(repeatCount).slice(0, charCount);
  };

  const LARGE_CONTENT_19K = generateLargeContent(19000);
  const LARGE_CONTENT_18K = generateLargeContent(18000);

  test.describe('Adding large prompts', () => {
    test('can add a prompt with ~19K characters (near 20K limit)', async ({
      context,
      storage,
      extensionId,
    }) => {
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
        interfaceMode: 'sidepanel',
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      const libraryPage = new LibraryPage(sidepanelPage);
      const promptFormPage = new PromptFormPage(sidepanelPage);

      await libraryPage.expectLibraryLoaded();
      await libraryPage.clickAddNewPrompt();
      await promptFormPage.expectCreateMode();

      // Create a prompt with ~19K characters
      await promptFormPage.createPrompt({
        title: 'Large Prompt Test',
        content: LARGE_CONTENT_19K,
      });

      // Verify the prompt was saved successfully
      await libraryPage.expectPromptVisible('Large Prompt Test');
      await libraryPage.expectPromptCount(1);

      // Verify the content was stored correctly
      const prompts = await storage.getPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].title).toBe('Large Prompt Test');
      expect(prompts[0].content).toBe(LARGE_CONTENT_19K);
      expect(prompts[0].content.length).toBe(19000);
    });

    test('can add a prompt with multi-byte UTF-8 characters', async ({
      context,
      storage,
      extensionId,
    }) => {
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
        interfaceMode: 'sidepanel',
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      const libraryPage = new LibraryPage(sidepanelPage);
      const promptFormPage = new PromptFormPage(sidepanelPage);

      // Create content with lots of multi-byte characters (emojis use 4 bytes each)
      // 5000 emojis × 4 bytes = 20KB but only 5000 characters
      // This tests that we're checking character count, not byte count for the 20K limit
      const emojiContent = '🎉'.repeat(5000) + ' Test content with emojis';

      await libraryPage.expectLibraryLoaded();
      await libraryPage.clickAddNewPrompt();
      await promptFormPage.createPrompt({
        title: 'Emoji Prompt',
        content: emojiContent,
      });

      await libraryPage.expectPromptVisible('Emoji Prompt');

      const prompts = await storage.getPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].content).toBe(emojiContent);
    });
  });

  test.describe('Updating prompts to large content', () => {
    test('can update a prompt to have ~19K characters', async ({
      context,
      storage,
      extensionId,
    }) => {
      // Seed with a small prompt
      const smallPrompt = createPromptSeed({
        id: 'small-prompt',
        title: 'Small Prompt',
        content: 'This is a small prompt.',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [smallPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
        interfaceMode: 'sidepanel',
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      const libraryPage = new LibraryPage(sidepanelPage);
      const promptFormPage = new PromptFormPage(sidepanelPage);

      await libraryPage.expectLibraryLoaded();
      await libraryPage.expectPromptVisible('Small Prompt');

      // Edit the prompt to have large content
      await libraryPage.editPrompt('Small Prompt');
      await promptFormPage.expectEditMode();

      // Update only the content (not the title) to avoid label mismatch issue
      // between AddPromptForm ("Title (optional)") and EditPromptForm ("Title")
      await promptFormPage.editPrompt({
        content: LARGE_CONTENT_19K,
      });

      // Verify the prompt was updated successfully (title unchanged)
      await libraryPage.expectPromptVisible('Small Prompt');

      const prompts = await storage.getPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].title).toBe('Small Prompt');
      expect(prompts[0].content).toBe(LARGE_CONTENT_19K);
      expect(prompts[0].content.length).toBe(19000);
    });

    test('save and update behave consistently for same large content', async ({
      context,
      storage,
      extensionId,
    }) => {
      // This test specifically verifies the fix for the inconsistency bug
      // where savePrompt() had size validation but updatePrompt() did not

      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
        interfaceMode: 'sidepanel',
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      const libraryPage = new LibraryPage(sidepanelPage);
      const promptFormPage = new PromptFormPage(sidepanelPage);

      await libraryPage.expectLibraryLoaded();

      // Step 1: Create a prompt with large content (tests savePrompt)
      await libraryPage.clickAddNewPrompt();
      await promptFormPage.createPrompt({
        title: 'Consistency Test 1',
        content: LARGE_CONTENT_18K,
      });

      await libraryPage.expectPromptVisible('Consistency Test 1');

      // Step 2: Create another prompt with small content
      await libraryPage.clickAddNewPrompt();
      await promptFormPage.createPrompt({
        title: 'Consistency Test 2',
        content: 'Small content initially.',
      });

      await libraryPage.expectPromptVisible('Consistency Test 2');

      // Step 3: Update the second prompt to have the same large content (tests updatePrompt)
      await libraryPage.editPrompt('Consistency Test 2');
      await promptFormPage.editPrompt({
        content: LARGE_CONTENT_18K,
      });

      // Verify both prompts exist with the same large content
      const prompts = await storage.getPrompts();
      expect(prompts).toHaveLength(2);

      // Verify both prompts have the same large content
      const prompt1Content = prompts.find(p => p.title === 'Consistency Test 1')?.content;
      const prompt2Content = prompts.find(p => p.title === 'Consistency Test 2')?.content;

      expect(prompt1Content).toBe(LARGE_CONTENT_18K);
      expect(prompt2Content).toBe(LARGE_CONTENT_18K);

      // Both should have successfully saved the same large content
      expect(prompt1Content?.length).toBe(prompt2Content?.length);
    });
  });

  test.describe('Edge cases', () => {
    test('can update large prompt multiple times', async ({
      context,
      storage,
      extensionId,
    }) => {
      const largePrompt = createPromptSeed({
        id: 'large-prompt',
        title: 'Large Prompt',
        content: LARGE_CONTENT_18K,
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [largePrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'sidepanel',
        },
        interfaceMode: 'sidepanel',
      });

      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      const libraryPage = new LibraryPage(sidepanelPage);
      const promptFormPage = new PromptFormPage(sidepanelPage);

      await libraryPage.expectLibraryLoaded();

      // Update the large prompt to slightly different large content
      const updatedContent = 'UPDATED: ' + LARGE_CONTENT_18K.slice(9);

      await libraryPage.editPrompt('Large Prompt');
      await promptFormPage.editPrompt({
        content: updatedContent,
      });

      await libraryPage.expectPromptVisible('Large Prompt');

      const prompts = await storage.getPrompts();
      expect(prompts[0].content).toBe(updatedContent);
      expect(prompts[0].content.length).toBe(18000);
    });
  });
});

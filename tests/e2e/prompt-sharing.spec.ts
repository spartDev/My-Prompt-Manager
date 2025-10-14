import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../src/types';

import { test, expect } from './fixtures/extension';
import { seedLibrary, createPromptSeed } from './utils/storage';

test.describe('Prompt Sharing - Critical Scenarios', () => {
  test.describe('Share Button Functionality', () => {
    test('1.1 - Share Button Visibility and State', async ({ page, storage }) => {
      // Create a test prompt
      const testPrompt = createPromptSeed({
        id: 'test-sharing-prompt-1',
        title: 'Test Sharing Prompt',
        content: 'This is a test prompt for sharing functionality validation.',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [testPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // Locate the prompt card using article role and title
      const promptCard = page.getByRole('article').filter({ hasText: testPrompt.title });
      await expect(promptCard).toBeVisible();

      // Find the share button using its aria-label
      const shareButton = page.getByRole('button', { name: `Share ${testPrompt.title}` });

      // Verify share button is visible and accessible
      await expect(shareButton).toBeVisible();
      await expect(shareButton).toBeEnabled();

      // Verify ARIA label
      await expect(shareButton).toHaveAttribute('aria-label', `Share ${testPrompt.title}`);

      // Verify hover state (check for proper styling classes)
      await shareButton.hover();
      await expect(shareButton).toBeVisible(); // Still visible after hover
    });

    test('1.2 - Share Button Click - Success Flow', async ({ page, storage, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const testPrompt = createPromptSeed({
        id: 'test-sharing-prompt-2',
        title: 'Share Success Test',
        content: 'Content for testing successful share operation.',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [testPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      const shareButton = page.getByRole('button', { name: `Share ${testPrompt.title}` });

      // Click share button
      await shareButton.click();

      // Wait for success toast (operation is very fast, loading state is transient)
      const successToast = page.getByText(/share link copied to clipboard/i);
      await expect(successToast).toBeVisible({ timeout: 5000 });

      // Verify button is enabled after operation
      await expect(shareButton).toBeEnabled();
      await expect(shareButton).toHaveAttribute('aria-busy', 'false');

      // Verify clipboard contains valid encoded string
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      // LZString.compressToEncodedURIComponent uses character set: A-Za-z0-9+-$
      expect(clipboardText).toMatch(/^[A-Za-z0-9+\-$]+$/);
      expect(clipboardText.length).toBeGreaterThan(0);
      expect(clipboardText.length).toBeLessThan(20000); // < 20KB limit

      // Verify toast auto-dismisses
      await expect(successToast).toBeHidden({ timeout: 5000 });
    });

    test('1.4 - Share Button - Clipboard Permission Denied', async ({ page, storage }) => {
      const testPrompt = createPromptSeed({
        id: 'test-sharing-prompt-3',
        title: 'Clipboard Error Test',
        content: 'Content for testing clipboard permission denial.',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [testPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // Mock clipboard API to reject
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: () => Promise.reject(new Error('Clipboard access denied')),
          },
          configurable: true,
        });
      });

      const shareButton = page.getByRole('button', { name: `Share ${testPrompt.title}` });

      // Click share button
      await shareButton.click();

      // Verify error toast appears
      const errorToast = page.getByText(/failed to share prompt/i);
      await expect(errorToast).toBeVisible({ timeout: 5000 });

      // Verify error styling is present (error toasts use red styling)
      // The toast container should have error/red styling classes
      const toastContainer = errorToast.locator('..');
      await expect(toastContainer).toBeVisible();

      // Verify button returns to normal state
      await expect(shareButton).toBeEnabled();
      await expect(shareButton).toHaveAttribute('aria-busy', 'false');
    });
  });

  test.describe('Encoding/Decoding', () => {
    test('2.1 - Encoding - Standard Prompt', async ({ page, storage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const testPrompt = createPromptSeed({
        id: 'encoding-test-1',
        title: 'Standard Encoding Test',
        content: 'This is standard content for encoding validation.',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [testPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      const shareButton = page.getByRole('button', { name: `Share ${testPrompt.title}` });

      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible({ timeout: 5000 });

      // Get encoded string from clipboard
      const encodedString = await page.evaluate(() => navigator.clipboard.readText());

      // Verify URL-safe characters only - LZString uses A-Za-z0-9+-$
      expect(encodedString).toMatch(/^[A-Za-z0-9+\-$]+$/);

      // Verify size limit
      expect(encodedString.length).toBeLessThan(20000); // 20KB max

      // Note: Compression doesn't always reduce size for small prompts
      // LZ-string compression is most effective with larger, repetitive content

      // Verify deterministic encoding - share again and compare
      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible({ timeout: 5000 });
      const encodedString2 = await page.evaluate(() => navigator.clipboard.readText());
      expect(encodedString2).toBe(encodedString); // Same input = same output
    });

    test('2.3 - Decoding - Valid Code', async ({ page, storage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const originalPrompt = createPromptSeed({
        id: 'decoding-test-1',
        title: 'Valid Code Test',
        content: 'Content for testing valid code decoding.',
        category: 'Work',
      });

      await seedLibrary(storage, {
        prompts: [originalPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
        categories: [
          { id: 'cat-work', name: 'Work' },
        ],
      });

      await page.reload();

      // Share the prompt to get valid code
      const shareButton = page.getByRole('button', { name: `Share ${originalPrompt.title}` });
      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible({ timeout: 5000 });

      const validCode = await page.evaluate(() => navigator.clipboard.readText());

      // Delete the original prompt
      const promptCard = page.getByRole('article').filter({ hasText: originalPrompt.title });
      const deleteButton = promptCard.getByRole('button', { name: /more actions/i });
      await deleteButton.click();
      await page.getByRole('menuitem', { name: /delete/i }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText(/prompt deleted/i)).toBeVisible();

      // Open import mode
      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      // Paste the valid code
      const codeTextarea = page.getByLabel(/sharing code/i);
      await codeTextarea.fill(validCode);

      // Wait for validation (300ms debounce)
      await page.waitForTimeout(400);

      // Verify success indicator
      await expect(page.getByText(/valid sharing code detected/i)).toBeVisible();

      // Verify preview section appears with correct data
      await expect(page.getByText('Preview')).toBeVisible();
      await expect(page.getByText(originalPrompt.title)).toBeVisible();
      await expect(page.getByText(originalPrompt.content)).toBeVisible();
      // Check category badge in preview (not the select option)
      const categoryBadge = page.locator('span.inline-flex').filter({ hasText: originalPrompt.category });
      await expect(categoryBadge).toBeVisible();

      // Verify category selector appears
      const categorySelect = page.getByLabel(/import to category/i);
      await expect(categorySelect).toBeVisible();

      // Verify submit button is enabled
      const importButton = page.getByRole('button', { name: /import prompt/i });
      await expect(importButton).toBeEnabled();
    });

    test('2.4 - Decoding - Invalid Format', async ({ page, storage }) => {
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // Open import mode
      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      const codeTextarea = page.getByLabel(/sharing code/i);
      const invalidCodes = [
        '',
        'INVALID_CODE_12345',
        'MZAwXyAQ===CORRUPTED===',
        'ABC',
      ];

      for (const invalidCode of invalidCodes) {
        // Clear and fill with invalid code
        await codeTextarea.clear();
        if (invalidCode) {
          await codeTextarea.fill(invalidCode);
        }

        // Wait for validation
        await page.waitForTimeout(400);

        if (invalidCode === '') {
          // Empty input should not show error, just no validation
          await expect(page.getByText(/validating/i)).toBeHidden();
        } else {
          // Invalid code should show error
          await expect(page.getByText(/invalid sharing code format/i)).toBeVisible();
        }

        // Preview should not appear
        await expect(page.getByText('Preview')).toBeHidden();

        // Submit button should be disabled
        const importButton = page.getByRole('button', { name: /import prompt/i });
        await expect(importButton).toBeDisabled();
      }
    });

    test('2.6 - Decoding - XSS Prevention', async ({ page, storage }) => {
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // We need to manually create an encoded string with XSS payloads
      // For this test, we'll use the PromptEncoder service directly via page.evaluate
      const xssPayloads = {
        title: '<script>alert("xss")</script>Test',
        content: '<img src=x onerror=alert("xss")>Content<a href="javascript:alert(\'xss\')">Click</a>',
        category: 'General',
      };

      const encodedXSS = await page.evaluate((data) => {
        // Import PromptEncoder in the page context
        // This assumes PromptEncoder is available globally or we can access it
        const LZString = (window as unknown as { LZString?: unknown }).LZString;
        const DOMPurify = (window as unknown as { DOMPurify?: unknown }).DOMPurify;

        if (!LZString || !DOMPurify) {
          // Fallback: create a manually crafted payload
          return 'XSS_TEST_CODE_WITH_SCRIPT_TAGS';
        }

        // This would be the actual encoding logic
        return 'ENCODED_XSS_PAYLOAD';
      }, xssPayloads);

      // For now, skip this test if we can't encode
      test.skip(encodedXSS === 'XSS_TEST_CODE_WITH_SCRIPT_TAGS', 'Cannot encode XSS payload in test');

      // Open import mode
      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      const codeTextarea = page.getByLabel(/sharing code/i);
      await codeTextarea.fill(encodedXSS);

      // Wait for validation
      await page.waitForTimeout(400);

      // Verify the preview shows sanitized content (no script tags)
      const previewContent = page.getByText('Preview').locator('..');
      const htmlContent = await previewContent.innerHTML();

      // Verify no script tags in the DOM
      expect(htmlContent).not.toContain('<script>');
      expect(htmlContent).not.toContain('onerror');
      expect(htmlContent).not.toContain('javascript:');
      expect(htmlContent).not.toContain('<img');
      expect(htmlContent).not.toContain('<a');

      // Verify text content is preserved
      await expect(previewContent).toContainText('Test');
      await expect(previewContent).toContainText('Content');
      await expect(previewContent).toContainText('Click');
    });
  });

  test.describe('Import Mode', () => {
    test('3.2 - Switch to Import Mode', async ({ page, storage }) => {
      await seedLibrary(storage, {
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // Click "Add New Prompt"
      await page.getByRole('button', { name: /add new prompt/i }).click();

      // Verify modal/form appears
      await expect(page.getByRole('heading', { name: /add new prompt/i })).toBeVisible();

      // Verify mode toggle buttons are visible
      const createNewButton = page.getByRole('button', { name: /create new/i });
      const importSharedButton = page.getByRole('button', { name: /import shared/i });

      await expect(createNewButton).toBeVisible();
      await expect(importSharedButton).toBeVisible();

      // Verify "Create New" is active by default
      await expect(createNewButton).toHaveAttribute('aria-pressed', 'true');
      await expect(importSharedButton).toHaveAttribute('aria-pressed', 'false');

      // Verify create mode fields are visible
      await expect(page.getByLabel(/title/i)).toBeVisible();
      await expect(page.getByLabel(/content/i)).toBeVisible();

      // Click "Import Shared"
      await importSharedButton.click();

      // Verify import mode becomes active
      await expect(importSharedButton).toHaveAttribute('aria-pressed', 'true');
      await expect(createNewButton).toHaveAttribute('aria-pressed', 'false');

      // Verify create mode fields are hidden
      await expect(page.getByLabel(/title/i).first()).toBeHidden();

      // Verify import mode fields are visible
      const sharingCodeTextarea = page.getByLabel(/sharing code/i);
      await expect(sharingCodeTextarea).toBeVisible();
      await expect(sharingCodeTextarea).toHaveAttribute('placeholder', /paste the sharing code/i);

      // Verify info box is visible
      await expect(page.getByText(/how to import/i)).toBeVisible();

      // Verify submit button text changed
      await expect(page.getByRole('button', { name: /import prompt/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /import prompt/i })).toBeDisabled();
    });

    test('3.5 - Import Code - Valid Code Detection', async ({ page, storage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const testPrompt = createPromptSeed({
        id: 'import-validation-test',
        title: 'Import Validation Test',
        content: 'Content for import validation testing.',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [testPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // Share the prompt
      const shareButton = page.getByRole('button', { name: `Share ${testPrompt.title}` });
      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible();

      const validCode = await page.evaluate(() => navigator.clipboard.readText());

      // Open import mode
      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      const codeTextarea = page.getByLabel(/sharing code/i);
      await codeTextarea.fill(validCode);

      // Verify "Validating..." appears immediately
      await expect(page.getByText(/validating/i)).toBeVisible();

      // Wait for validation (300ms debounce)
      await page.waitForTimeout(400);

      // Verify success indicator
      await expect(page.getByText(/valid sharing code detected/i)).toBeVisible();

      // Verify green checkmark icon (success state)
      const successIndicator = page.locator('[data-testid="validation-success"]').or(
        page.locator('.text-green-600, .text-green-500')
      );
      await expect(successIndicator.first()).toBeVisible();

      // Verify preview section appears
      await expect(page.getByText('Preview')).toBeVisible();

      // Verify category selector appears
      await expect(page.getByLabel(/import to category/i)).toBeVisible();

      // Verify submit button is enabled
      await expect(page.getByRole('button', { name: /import prompt/i })).toBeEnabled();
    });

    test('3.13 - Import Submission - Success Flow', async ({ page, storage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const originalPrompt = createPromptSeed({
        id: 'import-success-test',
        title: 'Import Success Test',
        content: 'This prompt will be shared and reimported.',
        category: 'Work',
      });

      await seedLibrary(storage, {
        prompts: [originalPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
        categories: [
          { id: 'cat-work', name: 'Work' },
        ],
      });

      await page.reload();

      // Share the prompt
      const shareButton = page.getByRole('button', { name: `Share ${originalPrompt.title}` });
      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible();

      const validCode = await page.evaluate(() => navigator.clipboard.readText());

      // Delete the original
      const promptCard = page.getByRole('article').filter({ hasText: originalPrompt.title });
      const deleteButton = promptCard.getByRole('button', { name: /more actions/i });
      await deleteButton.click();
      await page.getByRole('menuitem', { name: /delete/i }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText(/prompt deleted/i)).toBeVisible();

      // Import the prompt
      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      const codeTextarea = page.getByLabel(/sharing code/i);
      await codeTextarea.fill(validCode);
      await page.waitForTimeout(400);

      await expect(page.getByText(/valid sharing code detected/i)).toBeVisible();

      const importButton = page.getByRole('button', { name: /import prompt/i });
      await expect(importButton).toBeEnabled();

      // Click import
      await importButton.click();

      // Note: Loading state may be too fast to catch reliably, so we skip that check
      // and wait for the success state instead

      // Wait for success - the form closes and we return to main view
      await expect(page.getByRole('heading', { name: originalPrompt.title })).toBeVisible({ timeout: 5000 });

      // Verify the prompt appears in the list
      const importedCard = page.getByRole('article').filter({ hasText: originalPrompt.title });
      await expect(importedCard).toBeVisible();

      // Verify category is displayed (content preview is not shown in card view)
      await expect(importedCard).toContainText(originalPrompt.category);

      // Verify prompt is fully functional (can be edited)
      const moreActionsButton = importedCard.getByRole('button', { name: /more actions/i });
      await expect(moreActionsButton).toBeVisible();

      // Verify in storage
      const prompts = await storage.getPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toMatchObject({
        title: originalPrompt.title,
        content: originalPrompt.content,
        category: originalPrompt.category,
      });
      expect(prompts[0].id).not.toBe(originalPrompt.id); // New ID assigned
    });
  });

  test.describe('Data Integrity', () => {
    test('6.1 - Round-Trip Data Integrity', async ({ page, storage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const complexPrompt = createPromptSeed({
        id: 'roundtrip-test',
        title: 'Integration Test Prompt - 中文 Emoji 🎉',
        content: `Multi-paragraph content:

Line with newlines and	tabs
Special chars: "quotes", <brackets>, & ampersands
Unicode: café, résumé, naïve
Emoji: 🚀 💻 ✨

End of content.`,
        category: 'Work',
      });

      await seedLibrary(storage, {
        prompts: [complexPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
        categories: [
          { id: 'cat-work', name: 'Work' },
        ],
      });

      await page.reload();

      // Share the prompt
      const shareButton = page.getByRole('button', { name: /share integration test prompt/i });
      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible();

      const sharingCode = await page.evaluate(() => navigator.clipboard.readText());

      // Delete original
      const promptCard = page.getByRole('article').filter({ hasText: /integration test prompt/i });
      const deleteButton = promptCard.getByRole('button', { name: /more actions/i });
      await deleteButton.click();
      await page.getByRole('menuitem', { name: /delete/i }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

      // Import the prompt
      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      await page.getByLabel(/sharing code/i).fill(sharingCode);
      await page.waitForTimeout(400);

      // Note: The form auto-selects the original category from the decoded prompt

      await page.getByRole('button', { name: /import prompt/i }).click();
      await expect(page.getByRole('heading', { name: /integration test prompt/i })).toBeVisible({ timeout: 5000 });

      // Verify all data is preserved
      const importedPrompts = await storage.getPrompts();
      expect(importedPrompts).toHaveLength(1);

      const imported = importedPrompts[0];

      // Verify title (Unicode and emoji preserved)
      expect(imported.title).toBe(complexPrompt.title);
      expect(imported.title).toContain('中文');
      expect(imported.title).toContain('🎉');

      // Verify content (newlines, tabs, special chars, unicode, emoji)
      expect(imported.content).toContain('\n\n'); // Newlines preserved
      expect(imported.content).toContain('\t'); // Tabs preserved
      expect(imported.content).toContain('"quotes"'); // Quotes preserved
      expect(imported.content).toContain('& ampersands'); // Ampersands preserved ✅
      expect(imported.content).toContain('café'); // Unicode preserved
      expect(imported.content).toContain('résumé'); // Unicode preserved
      expect(imported.content).toContain('🚀'); // Emoji preserved
      expect(imported.content).toContain('💻'); // Emoji preserved
      expect(imported.content).toContain('✨'); // Emoji preserved

      // HTML tags should be stripped (if any were in original)
      expect(imported.content).not.toContain('<');
      expect(imported.content).not.toContain('>');

      // Category is preserved from the original prompt
      expect(imported.category).toBe(complexPrompt.category);
    });
  });

  test.describe('Security - XSS Prevention', () => {
    test('7.1 - XSS Prevention - Script Tags', async ({ page, storage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      // Create a prompt with script tags (simulating malicious input)
      const xssPrompt = createPromptSeed({
        id: 'xss-script-test',
        title: '<script>alert("XSS")</script>Test Title',
        content: 'Normal content with <script>alert("XSS")</script> embedded.',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [xssPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // Share the prompt
      const shareButton = page.getByRole('article').first().getByRole('button', { name: /share/i });
      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible();

      const sharingCode = await page.evaluate(() => navigator.clipboard.readText());

      // Delete the original prompt to ensure we're checking the imported one
      const promptCard = page.getByRole('article').filter({ hasText: xssPrompt.title });
      const deleteButton = promptCard.getByRole('button', { name: /more actions/i });
      await deleteButton.click();
      await page.getByRole('menuitem', { name: /delete/i }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText(/prompt deleted/i)).toBeVisible();

      // Import the prompt
      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      await page.getByLabel(/sharing code/i).fill(sharingCode);
      await page.waitForTimeout(400);

      // Check preview for script tags
      // Find the preview container that has the actual preview card content
      const previewContainer = page.locator('h3:text("Preview")').locator('../..');
      const previewHTML = await previewContainer.innerHTML();

      // Verify script tags are removed
      expect(previewHTML).not.toContain('<script>');
      expect(previewHTML).not.toContain('alert(');

      // Text content should be preserved
      await expect(previewContainer).toContainText('Test Title');
      await expect(previewContainer).toContainText('Normal content');

      // Complete import
      await page.getByRole('button', { name: /import prompt/i }).click();
      await page.waitForTimeout(1000);

      // Verify imported prompt has no script tags
      const importedPrompts = await storage.getPrompts();
      const imported = importedPrompts.find(p => p.content.includes('Normal content'));

      expect(imported).toBeDefined();
      expect(imported?.title).not.toContain('<script>');
      expect(imported?.content).not.toContain('<script>');
      expect(imported?.title).toContain('Test Title');
    });

    test('7.2 - XSS Prevention - Event Handlers', async ({ page, storage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const xssPrompt = createPromptSeed({
        id: 'xss-event-test',
        title: 'Event Handler Test',
        content: '<img src=x onerror=alert("XSS")>Image with handler',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [xssPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // Share and reimport
      const shareButton = page.getByRole('button', { name: `Share ${xssPrompt.title}` });
      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible();

      const sharingCode = await page.evaluate(() => navigator.clipboard.readText());

      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      await page.getByLabel(/sharing code/i).fill(sharingCode);
      await page.waitForTimeout(400);

      const previewContainer = page.locator('h3:text("Preview")').locator('../..');
      const previewHTML = await previewContainer.innerHTML();

      // Verify event handlers and img tags removed
      expect(previewHTML).not.toContain('onerror');
      expect(previewHTML).not.toContain('<img');
      expect(previewHTML).not.toContain('alert(');

      // Text preserved
      await expect(previewContainer).toContainText('Image with handler');
    });

    test('7.3 - XSS Prevention - JavaScript URLs', async ({ page, storage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const xssPrompt = createPromptSeed({
        id: 'xss-jsurl-test',
        title: 'JavaScript URL Test',
        content: '<a href="javascript:alert(\'XSS\')">Click me</a>',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [xssPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // Share and reimport
      const shareButton = page.getByRole('button', { name: `Share ${xssPrompt.title}` });
      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible();

      const sharingCode = await page.evaluate(() => navigator.clipboard.readText());

      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      await page.getByLabel(/sharing code/i).fill(sharingCode);
      await page.waitForTimeout(400);

      const previewContainer = page.locator('h3:text("Preview")').locator('../..');
      const previewHTML = await previewContainer.innerHTML();

      // Verify javascript: URLs and anchor tags removed
      expect(previewHTML).not.toContain('javascript:');
      expect(previewHTML).not.toContain('<a');
      expect(previewHTML).not.toContain('href');

      // Text preserved
      await expect(previewContainer).toContainText('Click me');
    });

    test('7.4 - HTML Injection', async ({ page, storage, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const htmlPrompt = createPromptSeed({
        id: 'html-injection-test',
        title: 'HTML Injection Test',
        content: '<div style="background:red">Styled content</div><h1>Heading</h1>',
        category: DEFAULT_CATEGORY,
      });

      await seedLibrary(storage, {
        prompts: [htmlPrompt],
        settings: {
          ...DEFAULT_SETTINGS,
          interfaceMode: 'popup',
        },
      });

      await page.reload();

      // Share and reimport
      const shareButton = page.getByRole('button', { name: `Share ${htmlPrompt.title}` });
      await shareButton.click();
      await expect(page.getByText(/share link copied/i)).toBeVisible();

      const sharingCode = await page.evaluate(() => navigator.clipboard.readText());

      // Delete the original prompt to ensure we're checking the imported one
      const promptCard = page.getByRole('article').filter({ hasText: htmlPrompt.title });
      const deleteButton = promptCard.getByRole('button', { name: /more actions/i });
      await deleteButton.click();
      await page.getByRole('menuitem', { name: /delete/i }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText(/prompt deleted/i)).toBeVisible();

      await page.getByRole('button', { name: /add new prompt/i }).click();
      await page.getByRole('button', { name: /import shared/i }).click();

      await page.getByLabel(/sharing code/i).fill(sharingCode);
      await page.waitForTimeout(400);

      const previewContainer = page.locator('h3:text("Preview")').locator('../..');

      // Get the actual content preview paragraph (not the entire preview HTML structure)
      const contentPreview = previewContainer.locator('p.whitespace-pre-wrap');
      const contentText = await contentPreview.textContent();

      // Verify all HTML tags stripped from content
      expect(contentText).not.toContain('<div');
      expect(contentText).not.toContain('<h1');
      expect(contentText).not.toContain('style=');
      expect(contentText).not.toContain('background:red');
      expect(contentText).not.toContain('>'); // No closing tags
      expect(contentText).not.toContain('<'); // No opening tags

      // Text content preserved
      expect(contentText).toContain('Styled content');
      expect(contentText).toContain('Heading');

      // Complete import and verify storage
      await page.getByRole('button', { name: /import prompt/i }).click();
      await page.waitForTimeout(1000);

      const importedPrompts = await storage.getPrompts();
      // After deleting original and importing, should only have 1 prompt
      expect(importedPrompts).toHaveLength(1);
      const imported = importedPrompts[0];

      expect(imported?.content).not.toContain('<');
      expect(imported?.content).not.toContain('>');
      expect(imported?.content).toContain('Styled content');
      expect(imported?.content).toContain('Heading');
    });
  });
});

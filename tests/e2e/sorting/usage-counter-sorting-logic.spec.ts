/**
 * E2E Tests: Usage Counter & Smart Sorting - Cross-Context Sync and Data Migration
 *
 * Tests cross-context sorting synchronization and legacy data migration.
 *
 * @see docs/TEST_PLAN_USAGE_COUNTER_SMART_SORTING.md
 */

import { DEFAULT_CATEGORY } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { seedLibrary, createPromptSeed } from '../utils/storage';

test.describe('Usage Counter & Smart Sorting - Logic', () => {

  // Scenario 2.5: Sort State Syncs Between Contexts (CROSS-CONTEXT TEST)
  test.describe('Cross-Context Sorting', () => {
    test('sort state syncs from popup to sidepanel', async ({ context, storage, extensionId }) => {
      // Verify sort state persists when switching contexts

      // Seed data
      const prompts = [
        createPromptSeed({ id: 'p1', title: 'Low', usageCount: 5 }),
        createPromptSeed({ id: 'p2', title: 'High', usageCount: 10 })
      ];
      await seedLibrary(storage, { prompts });

      // Open popup and set sort
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await popupPage.waitForLoadState('domcontentloaded');

      // Select "Most Used" and toggle to ascending
      let sortButton = popupPage.getByRole('button', { name: /Sort order:/i });
      await sortButton.click();
      await popupPage.getByRole('menuitem', { name: /Most Used/i }).click();

      sortButton = popupPage.getByRole('button', { name: /Sort order: Most Used/i });
      await expect(sortButton).toBeVisible();
      await sortButton.click();
      await popupPage.getByRole('menuitem', { name: /Most Used/i }).click();

      // Verify ascending in popup
      const popupPromptHeadings = popupPage.locator('article h3');
      await expect(popupPromptHeadings).toHaveText(['Low', 'High']);

      // Verify button shows "Least Used"
      sortButton = popupPage.getByRole('button', { name: /Sort order: Least Used/i });
      await expect(sortButton).toBeVisible();

      await popupPage.close();

      // Open sidepanel
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
      await sidepanelPage.waitForLoadState('domcontentloaded');

      // Verify sort persisted
      await expect(sidepanelPage.getByRole('button', { name: /Sort order: Least Used/i })).toBeVisible();

      await expect(sidepanelPage.locator('article h3')).toHaveText(['Low', 'High']); // Still ascending

      // Verify storage has correct values
      const settings = await storage.getSettings();
      expect(settings?.sortOrder).toBe('usageCount');
    });

    test('sort state syncs from sidepanel to popup', async ({ context, storage, extensionId }) => {
      // Verify sort state persists when switching contexts (reverse direction)

      // Seed data
      const prompts = [
        createPromptSeed({ id: 'p1', title: 'Low', usageCount: 5 }),
        createPromptSeed({ id: 'p2', title: 'High', usageCount: 10 })
      ];
      await seedLibrary(storage, { prompts });

      // Open sidepanel and set sort
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
      await sidepanelPage.waitForLoadState('domcontentloaded');

      // Select "Recently Used"
      await sidepanelPage.getByRole('button', { name: /Sort order:/i }).click();
      await sidepanelPage.getByRole('menuitem', { name: /Recently Used/i }).click();

      // Verify sort was applied
      const sortButton = sidepanelPage.getByRole('button', { name: /Sort order: Recently Used/i });
      await expect(sortButton).toBeVisible();

      await sidepanelPage.close();

      // Open popup
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await popupPage.waitForLoadState('domcontentloaded');

      // Verify sort persisted
      await expect(popupPage.getByRole('button', { name: /Sort order: Recently Used/i })).toBeVisible();

      // Verify storage has correct values
      const settings = await storage.getSettings();
      expect(settings?.sortOrder).toBe('lastUsedAt');
    });
  });

  // ============================================================================
  // Section 3: Data Migration
  // ============================================================================

  // Define contexts for parameterized testing
  const CONTEXTS = [
    { name: 'popup', url: 'src/popup.html' },
    { name: 'sidepanel', url: 'src/sidepanel.html' }
  ] as const;

  test.describe('Data Migration', () => {
    // Scenario 3.1: Existing Prompts Migrated Automatically
    // Tests that old-format prompts (without usageCount/lastUsedAt) are automatically migrated
    for (const context of CONTEXTS) {
      test.describe(`${context.name} context`, () => {
        test('migrates legacy prompts automatically', async ({ page, storage, extensionId }) => {
          // Seed old-format prompts WITHOUT usageCount/lastUsedAt fields
          // Use storage.seed() with raw data to bypass createPromptSeed's defaults
          await storage.seed({
            prompts: [
              {
                id: 'old-prompt-1',
                title: 'Old Prompt',
                content: 'Content without usage fields',
                category: DEFAULT_CATEGORY,
                createdAt: 1700000000000,
                updatedAt: 1700000000000
                // NO usageCount or lastUsedAt - simulating old data format
              }
            ] as any // Type assertion needed because we're intentionally omitting fields
          });

          // Navigate to UI - this triggers migration via normalizePrompt when getPrompts() is called
          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Wait for prompts to render
          await expect(page.locator('article[aria-labelledby^="prompt-title-"]').first()).toBeVisible();

          // Verify migration happened by checking storage state
          const prompts = await storage.getPrompts();
          expect(prompts).toHaveLength(1);

          const migratedPrompt = prompts[0];
          expect(migratedPrompt.id).toBe('old-prompt-1');
          expect(migratedPrompt.usageCount).toBe(0); // Migrated to default value
          expect(migratedPrompt.lastUsedAt).toBe(1700000000000); // Defaults to createdAt when usageCount === 0

          // Verify prompt displays correctly in UI
          await expect(page.getByText('Old Prompt')).toBeVisible();
        });

        // Scenario 3.2: Partial Migration (Mixed Old and New Prompts)
        // Tests that mixed old/new format prompts are handled correctly
        test('handles mixed old and new prompts', async ({ page, storage, extensionId }) => {
          // Seed mixed data: old format + new format
          await storage.seed({
            prompts: [
              // Old format (no usage fields)
              {
                id: 'old-1',
                title: 'Old Prompt',
                content: 'Content',
                category: DEFAULT_CATEGORY,
                createdAt: 1700000000000,
                updatedAt: 1700000000000
              },
              // New format (with usage fields)
              {
                id: 'new-1',
                title: 'New Prompt',
                content: 'Content',
                category: DEFAULT_CATEGORY,
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
                usageCount: 5,
                lastUsedAt: 1700100000000
              }
            ] as any
          });

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Wait for prompts to render
          await expect(page.locator('article[aria-labelledby^="prompt-title-"]').first()).toBeVisible();

          // Verify both prompts migrated/preserved correctly
          const prompts = await storage.getPrompts();
          expect(prompts).toHaveLength(2);

          const oldPrompt = prompts.find(p => p.id === 'old-1');
          const newPrompt = prompts.find(p => p.id === 'new-1');

          // Old prompt should be migrated
          expect(oldPrompt?.usageCount).toBe(0);
          expect(oldPrompt?.lastUsedAt).toBe(1700000000000); // Defaults to createdAt

          // New prompt should keep existing values
          expect(newPrompt?.usageCount).toBe(5);
          expect(newPrompt?.lastUsedAt).toBe(1700100000000);

          // Verify both display in UI
          await expect(page.getByText('Old Prompt')).toBeVisible();
          await expect(page.getByText('New Prompt')).toBeVisible();
        });

        // Scenario 3.3: Migration Recovers from Corrupted Data
        // Tests that normalizePrompt corrects invalid data (NaN, negative, floats, invalid timestamps)
        test('recovers from corrupted data', async ({ page, storage, extensionId }) => {
          // Seed prompts with invalid data
          await storage.seed({
            prompts: [
              {
                id: 'corrupt-1',
                title: 'Invalid Usage Count',
                content: 'Content',
                category: DEFAULT_CATEGORY,
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
                usageCount: NaN, // Invalid - should normalize to 0
                lastUsedAt: -1    // Invalid - should default to createdAt
              },
              {
                id: 'corrupt-2',
                title: 'Float Usage Count',
                content: 'Content',
                category: DEFAULT_CATEGORY,
                createdAt: 1700000000000,
                updatedAt: 1700010000000,
                usageCount: 5.7,  // Should floor to 5
                lastUsedAt: null as any  // Invalid - should default to updatedAt (usageCount > 0)
              },
              {
                id: 'corrupt-3',
                title: 'Negative Usage',
                content: 'Content',
                category: DEFAULT_CATEGORY,
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
                usageCount: -10,  // Should normalize to 0
                lastUsedAt: 1700000000000
              }
            ] as any
          });

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Wait for prompts to render
          await expect(page.locator('article[aria-labelledby^="prompt-title-"]').first()).toBeVisible();

          // Verify migration normalized corrupted data
          const prompts = await storage.getPrompts();
          expect(prompts).toHaveLength(3);

          const corrupt1 = prompts.find(p => p.id === 'corrupt-1');
          expect(corrupt1?.usageCount).toBe(0); // NaN normalized to 0
          expect(corrupt1?.lastUsedAt).toBeGreaterThan(0);
          expect(corrupt1?.lastUsedAt).toBe(corrupt1?.createdAt); // Defaults to createdAt when usageCount === 0

          const corrupt2 = prompts.find(p => p.id === 'corrupt-2');
          expect(corrupt2?.usageCount).toBe(5); // Floored from 5.7
          expect(corrupt2?.lastUsedAt).toBe(corrupt2?.updatedAt); // Defaults to updatedAt when usageCount > 0

          const corrupt3 = prompts.find(p => p.id === 'corrupt-3');
          expect(corrupt3?.usageCount).toBe(0); // Negative normalized to 0
          expect(corrupt3?.lastUsedAt).toBe(1700000000000); // Valid timestamp preserved

          // Verify all prompts display correctly despite previous corruption
          await expect(page.getByText('Invalid Usage Count')).toBeVisible();
          await expect(page.getByText('Float Usage Count')).toBeVisible();
          await expect(page.getByText('Negative Usage')).toBeVisible();

          // Verify sorting works after migration/recovery
          await page.getByRole('button', { name: /Sort order:/i }).click();
          await page.getByRole('menuitem', { name: /Most Used/i }).click();
          const sortedHeadings = page.locator('article h3');
          await expect(sortedHeadings.first()).toHaveText('Float Usage Count');

          const titles = await sortedHeadings.allTextContents();
          expect(titles[0]).toBe('Float Usage Count'); // usageCount: 5
          // The other two prompts (usageCount: 0) will follow in some order
          expect(titles.slice(1)).toContain('Invalid Usage Count');
          expect(titles.slice(1)).toContain('Negative Usage');
        });
      });
    }
  });
});

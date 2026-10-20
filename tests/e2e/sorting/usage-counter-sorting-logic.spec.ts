/**
 * E2E Tests: Usage Counter & Smart Sorting - Cross-Context Sync and Data Migration
 *
 * Tests cross-context sorting synchronization and legacy data migration.
 *
 * @see docs/TEST_PLAN_USAGE_COUNTER_SMART_SORTING.md
 */

import { DEFAULT_CATEGORY } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { LibraryPage } from '../pages/LibraryPage';
import { getCurrentSortLabel, getSortedPromptTitles, selectSortOption } from '../utils/sort-helpers';
import { seedLibrary, createPromptSeed } from '../utils/storage';

test.describe('Usage Counter & Smart Sorting - Logic', () => {

  // Scenario 2.5: Sort State Syncs Between Contexts (CROSS-CONTEXT TEST)
  // The sort is a Settings preference: the one chosen in one context is the order shown in the other
  test.describe('Cross-Context Sorting', () => {
    test('sort chosen in popup is used by sidepanel', async ({ context, storage, extensionId }) => {
      // Seed data: "Low" was updated last, so the default sort (Recently Updated) lists it first
      const now = Date.now();
      const prompts = [
        createPromptSeed({ id: 'p1', title: 'Low', usageCount: 5, createdAt: now - 10000, updatedAt: now - 1000 }),
        createPromptSeed({ id: 'p2', title: 'High', usageCount: 10, createdAt: now - 10000, updatedAt: now - 2000 })
      ];
      await seedLibrary(storage, { prompts });

      // Open popup and choose the sort in Settings
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await popupPage.waitForLoadState('domcontentloaded');

      const popupPromptHeadings = popupPage.getByTestId('prompt-card').getByRole('heading');
      await expect(popupPromptHeadings).toHaveText(['Low', 'High']);

      await selectSortOption(popupPage, 'Number of Uses');

      // Verify most used first in popup
      await expect(popupPromptHeadings).toHaveText(['High', 'Low']);

      // The setting is stored asynchronously: wait for it, or closing the page can cut the write short
      await expect.poll(async () => (await storage.getSettings())?.sortOrder).toBe('usageCount');

      await popupPage.close();

      // Open sidepanel
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
      await sidepanelPage.waitForLoadState('domcontentloaded');

      // Verify the sidepanel lists prompts in the same order
      await expect(sidepanelPage.getByTestId('prompt-card').getByRole('heading')).toHaveText(['High', 'Low']);

      // Verify the sidepanel's Settings shows the same sort
      expect(await getCurrentSortLabel(sidepanelPage)).toBe('Number of Uses');

      // Verify storage has correct values (each sort has one direction)
      const settings = await storage.getSettings();
      expect(settings?.sortOrder).toBe('usageCount');
      expect(settings?.sortDirection).toBe('desc');
    });

    test('sort chosen in sidepanel is used by popup', async ({ context, storage, extensionId }) => {
      // Seed data: "Used Earlier" was updated last (listed first by default), "Used Just Now" was used last
      const now = Date.now();
      const prompts = [
        createPromptSeed({ id: 'p1', title: 'Used Earlier', usageCount: 5, createdAt: now - 1000000, updatedAt: now - 1000, lastUsedAt: now - 500000 }),
        createPromptSeed({ id: 'p2', title: 'Used Just Now', usageCount: 1, createdAt: now - 1000000, updatedAt: now - 2000, lastUsedAt: now })
      ];
      await seedLibrary(storage, { prompts });

      // Open sidepanel and choose the sort in Settings
      const sidepanelPage = await context.newPage();
      await sidepanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
      await sidepanelPage.waitForLoadState('domcontentloaded');

      const sidepanelPromptHeadings = sidepanelPage.getByTestId('prompt-card').getByRole('heading');
      await expect(sidepanelPromptHeadings).toHaveText(['Used Earlier', 'Used Just Now']);

      await selectSortOption(sidepanelPage, 'Recently Used');

      // Verify sort was applied
      await expect(sidepanelPromptHeadings).toHaveText(['Used Just Now', 'Used Earlier']);

      // The setting is stored asynchronously: wait for it, or closing the page can cut the write short
      await expect.poll(async () => (await storage.getSettings())?.sortOrder).toBe('lastUsedAt');

      await sidepanelPage.close();

      // Open popup
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/src/popup.html`);
      await popupPage.waitForLoadState('domcontentloaded');

      // Verify the popup lists prompts in the same order
      await expect(popupPage.getByTestId('prompt-card').getByRole('heading')).toHaveText(['Used Just Now', 'Used Earlier']);

      // Verify the popup's Settings shows the same sort
      expect(await getCurrentSortLabel(popupPage)).toBe('Recently Used');

      // Verify storage has correct values
      const settings = await storage.getSettings();
      expect(settings?.sortOrder).toBe('lastUsedAt');
      expect(settings?.sortDirection).toBe('desc');
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
    // Scenario 3.1: Legacy Prompts Are Read, Not Rewritten
    // Old-format prompts (without usageCount/lastUsedAt) get their usage fields filled in memory by
    // the shared reader (readPrompts). Reading never writes (ADR-001), so opening the UI leaves
    // storage exactly as it was; the filled-in values show up as sort behaviour.
    for (const context of CONTEXTS) {
      test.describe(`${context.name} context`, () => {
        test('shows legacy prompts without rewriting storage', async ({ page, storage, extensionId }) => {
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
          const seeded = await storage.getPrompts();

          // Navigate to UI - prompts are read through the shared reader, which fills in missing usage fields in memory
          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Wait for prompts to render
          await expect(page.locator('article[aria-labelledby^="prompt-title-"]').first()).toBeVisible();

          // Verify prompt displays correctly in UI
          await expect(page.getByText('Old Prompt')).toBeVisible();

          // Reading never writes: storage is exactly what was seeded
          expect(await storage.getPrompts()).toEqual(seeded);
        });

        // Scenario 3.2: Partial Migration (Mixed Old and New Prompts)
        // Mixed old/new format prompts are handled correctly: the legacy prompt counts as unused
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
          const seeded = await storage.getPrompts();

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Wait for prompts to render
          await expect(page.locator('article[aria-labelledby^="prompt-title-"]').first()).toBeVisible();

          // Verify both display in UI
          await expect(page.getByText('Old Prompt')).toBeVisible();
          await expect(page.getByText('New Prompt')).toBeVisible();

          // The legacy prompt counts as unused (usageCount 0), so it sorts after the one used 5 times
          await selectSortOption(page, 'Number of Uses');
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(['New Prompt', 'Old Prompt']);

          // ...and is left out of Most Used
          await new LibraryPage(page).selectLibraryFilter('Most Used');
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(['New Prompt']);

          // Neither reading nor sorting rewrote the prompts
          expect(await storage.getPrompts()).toEqual(seeded);
        });

        // Scenario 3.3: Corrupted Usage Data Is Read Sanely
        // Invalid usage values (NaN, negative, fractional, invalid timestamps) are normalized by the
        // shared reader when read, without rewriting storage. The numeric rules themselves are unit
        // tested in src/services/__tests__/promptAdmission.test.ts; this checks them end to end.
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
                usageCount: NaN, // Invalid - should read as 0
                lastUsedAt: -1    // Invalid - should default to createdAt
              },
              {
                id: 'corrupt-2',
                title: 'Float Usage Count',
                content: 'Content',
                category: DEFAULT_CATEGORY,
                createdAt: 1700000000000,
                updatedAt: 1700010000000,
                usageCount: 5.7,  // Should read as 5 (floored)
                lastUsedAt: null as any  // Invalid - should default to updatedAt (usageCount > 0)
              },
              {
                id: 'corrupt-3',
                title: 'Negative Usage',
                content: 'Content',
                category: DEFAULT_CATEGORY,
                createdAt: 1700000000000,
                updatedAt: 1700000000000,
                usageCount: -10,  // Should read as 0
                lastUsedAt: 1700000000000
              }
            ] as any
          });
          const seeded = await storage.getPrompts();

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Wait for prompts to render
          await expect(page.locator('article[aria-labelledby^="prompt-title-"]').first()).toBeVisible();

          // Verify all prompts display correctly despite the corruption
          await expect(page.getByText('Invalid Usage Count')).toBeVisible();
          await expect(page.getByText('Float Usage Count')).toBeVisible();
          await expect(page.getByText('Negative Usage')).toBeVisible();

          // Verify sorting works on the normalized values
          await selectSortOption(page, 'Number of Uses');
          await expect.poll(async () => (await getSortedPromptTitles(page))[0]).toBe('Float Usage Count');

          const titles = await getSortedPromptTitles(page);
          expect(titles[0]).toBe('Float Usage Count'); // usageCount: 5
          // The other two prompts (usageCount: 0) will follow in some order
          expect(titles.slice(1)).toContain('Invalid Usage Count');
          expect(titles.slice(1)).toContain('Negative Usage');

          // Most Used lists only the prompt with a valid usage count
          await new LibraryPage(page).selectLibraryFilter('Most Used');
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(['Float Usage Count']);

          // Reading never writes: the corrupted values are still exactly as seeded
          expect(await storage.getPrompts()).toEqual(seeded);
        });
      });
    }
  });
});

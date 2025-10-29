/**
 * E2E Tests: Usage Counter & Smart Sorting - Section 1: UI Display and Visual Elements
 *
 * Tests scenarios 1.1 and 1.2 from the test plan, covering both popup and sidepanel contexts.
 *
 * @see docs/TEST_PLAN_USAGE_COUNTER_SMART_SORTING.md
 */

import { DEFAULT_CATEGORY } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { getSortedPromptTitles, selectSortOption, navigateToContext } from '../utils/sort-helpers';
import { seedLibrary, createPromptSeed } from '../utils/storage';

// Define contexts for parameterized testing - ensures both popup and sidepanel are tested
const CONTEXTS = [
  { name: 'popup', url: 'src/popup.html' },
  { name: 'sidepanel', url: 'src/sidepanel.html' }
] as const;

test.describe('Usage Counter & Smart Sorting - UI Display', () => {

  test.describe('Sort Dropdown UI', () => {
    // Scenario 1.1: Sort Dropdown Shows New Options
    // Tests that the new sort options (Most Used, Recently Used) are visible and correctly ordered
    for (const context of CONTEXTS) {
      test.describe(`${context.name} context`, () => {
        test('displays Most Used and Recently Used options', async ({ page, storage, extensionId }) => {
          // Seed minimal data - just one prompt to enable the UI
          const prompts = [
            createPromptSeed({
              id: 'p1',
              title: 'Test Prompt',
              content: 'Content',
              category: DEFAULT_CATEGORY
            })
          ];
          await seedLibrary(storage, { prompts });

          // Navigate to correct context (popup or sidepanel)
          await page.goto(`chrome-extension://${extensionId}/${context.url}`);

          // Wait for page to load
          await page.waitForLoadState('domcontentloaded');

          // Open the sort dropdown
          const sortButton = page.getByRole('button', { name: /Sort order:/i });
          await expect(sortButton).toBeVisible();
          await sortButton.click();

          // Verify "Most Used" option is visible
          const mostUsedOption = page.getByRole('menuitem', { name: /Most Used/i });
          await expect(mostUsedOption).toBeVisible();

          // Verify "Recently Used" option is visible
          const recentlyUsedOption = page.getByRole('menuitem', { name: /Recently Used/i });
          await expect(recentlyUsedOption).toBeVisible();

          // Verify both options have icons (StarIcon and HistoryIcon respectively)
          const mostUsedIcon = mostUsedOption.locator('svg').first();
          await expect(mostUsedIcon).toBeVisible();

          const recentlyUsedIcon = recentlyUsedOption.locator('svg').first();
          await expect(recentlyUsedIcon).toBeVisible();

          // Verify correct order of options (Most Used should appear before Recently Used)
          const allMenuItems = page.getByRole('menuitem');
          const menuItemTexts = await allMenuItems.allTextContents();

          // Find indices of our new options
          const mostUsedIndex = menuItemTexts.findIndex(text => /Most Used/i.test(text));
          const recentlyUsedIndex = menuItemTexts.findIndex(text => /Recently Used/i.test(text));

          // Verify both were found and Most Used comes before Recently Used
          expect(mostUsedIndex).toBeGreaterThanOrEqual(0);
          expect(recentlyUsedIndex).toBeGreaterThanOrEqual(0);
          expect(mostUsedIndex).toBeLessThan(recentlyUsedIndex);
        });
      });
    }
  });

  test.describe('Active Sort Indicator', () => {
    // Scenario 1.2: Active Sort Indicator Shows Correct State
    // Tests that the sort button displays the correct indicator when usageCount sort is active
    for (const context of CONTEXTS) {
      test.describe(`${context.name} context`, () => {
        test('shows active sort indicator for Most Used', async ({ page, storage, extensionId }) => {
          // Seed data - Note: Component doesn't load sortOrder from settings yet
          await seedLibrary(storage, {
            prompts: [
              createPromptSeed({
                id: 'p1',
                title: 'Test Prompt',
                content: 'Content',
                category: DEFAULT_CATEGORY,
                usageCount: 5,
                lastUsedAt: Date.now()
              })
            ]
          });

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Select "Most Used" from the dropdown to activate it
          const sortButton = page.getByRole('button', { name: /Sort order:/i });
          await expect(sortButton).toBeVisible();
          await sortButton.click();

          // Select "Most Used" option
          const mostUsedOption = page.getByRole('menuitem', { name: /Most Used/i });
          await mostUsedOption.click();

          // Now verify button is accessible with correct aria-label
          const updatedSortButton = page.getByRole('button', { name: /Sort order: Most Used/i });
          await expect(updatedSortButton).toBeVisible();
          await expect(updatedSortButton).toHaveAttribute('aria-label', /Sort order: Most Used/i);

          // Verify button has title attribute for tooltip
          const titleAttr = await updatedSortButton.getAttribute('title');
          expect(titleAttr).toMatch(/Sort: Most Used/i);

          // Verify badge indicator is visible (shows sort type icon)
          const badge = updatedSortButton.locator('.rounded-full').first();
          await expect(badge).toBeVisible();

          // Verify badge contains an icon (StarIcon for usageCount)
          const badgeIcon = badge.locator('svg');
          await expect(badgeIcon).toBeVisible();

          // Verify badge has purple styling
          const badgeClasses = await badge.getAttribute('class');
          expect(badgeClasses).toMatch(/bg-purple/);

          // Open dropdown again to verify active menu item state
          await updatedSortButton.click();

          // Verify "Most Used" menu item has active styling
          const mostUsedItem = page.getByRole('menuitem', { name: /Most Used/i });
          await expect(mostUsedItem).toBeVisible();

          // Check for purple background indicating active state
          const itemClasses = await mostUsedItem.getAttribute('class');
          expect(itemClasses).toMatch(/bg-purple-50|dark:bg-purple-900/);

          // Verify checkmark icon is present in active item (CheckIcon has fill="currentColor")
          const checkIcon = mostUsedItem.locator('svg[fill="currentColor"]');
          await expect(checkIcon).toBeVisible();

          // Verify direction indicator shows descending arrow (↓)
          const itemText = await mostUsedItem.textContent();
          expect(itemText).toContain('↓');
        });

        test('shows correct aria-label when toggled to ascending', async ({ page, storage, extensionId }) => {
          // Seed test data
          await seedLibrary(storage, {
            prompts: [
              createPromptSeed({
                id: 'p1',
                title: 'Low Usage',
                content: 'Content',
                usageCount: 2
              }),
              createPromptSeed({
                id: 'p2',
                title: 'High Usage',
                content: 'Content',
                usageCount: 10
              })
            ]
          });

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Select "Most Used" from dropdown
          let sortButton = page.getByRole('button', { name: /Sort order:/i });
          await sortButton.click();
          await page.getByRole('menuitem', { name: /Most Used/i }).click();

          // Verify initial state shows "Most Used" (descending)
          sortButton = page.getByRole('button', { name: /Sort order: Most Used/i });
          await expect(sortButton).toBeVisible();

          // Open dropdown and toggle to ascending by clicking "Most Used" again
          await sortButton.click();
          await page.getByRole('menuitem', { name: /Most Used/i }).click();

          // After toggle, should show "Least Used" (ascending)
          sortButton = page.getByRole('button', { name: /Sort order: Least Used/i });
          await expect(sortButton).toBeVisible();
          await expect(sortButton).toHaveAttribute('aria-label', /Sort order: Least Used/i);

          // Verify title tooltip also updated
          const titleAttr = await sortButton.getAttribute('title');
          expect(titleAttr).toMatch(/Sort: Least Used/i);

          // Open dropdown again to verify direction indicator changed
          await sortButton.click();
          const mostUsedItem = page.getByRole('menuitem', { name: /Most Used/i });
          const itemText = await mostUsedItem.textContent();
          expect(itemText).toContain('↑'); // Should show ascending arrow
        });

        test('shows active indicator for Recently Used sort', async ({ page, storage, extensionId }) => {
          // Seed test data
          const now = Date.now();
          await seedLibrary(storage, {
            prompts: [
              createPromptSeed({
                id: 'p1',
                title: 'Test Prompt',
                content: 'Content',
                usageCount: 3,
                lastUsedAt: now
              })
            ]
          });

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Select "Recently Used" from dropdown
          let sortButton = page.getByRole('button', { name: /Sort order:/i });
          await sortButton.click();
          await page.getByRole('menuitem', { name: /Recently Used/i }).click();

          // Verify button shows "Recently Used"
          sortButton = page.getByRole('button', { name: /Sort order: Recently Used/i });
          await expect(sortButton).toBeVisible();
          await expect(sortButton).toHaveAttribute('aria-label', /Sort order: Recently Used/i);

          // Verify badge is visible with icon (HistoryIcon for lastUsedAt)
          const badge = sortButton.locator('.rounded-full').first();
          await expect(badge).toBeVisible();
          const badgeIcon = badge.locator('svg');
          await expect(badgeIcon).toBeVisible();

          // Open dropdown to verify active state
          await sortButton.click();

          const recentlyUsedItem = page.getByRole('menuitem', { name: /Recently Used/i });
          await expect(recentlyUsedItem).toBeVisible();

          // Verify active styling
          const itemClasses = await recentlyUsedItem.getAttribute('class');
          expect(itemClasses).toMatch(/bg-purple-50|dark:bg-purple-900/);

          // Verify checkmark is present (CheckIcon has fill="currentColor")
          const checkIcon = recentlyUsedItem.locator('svg[fill="currentColor"]');
          await expect(checkIcon).toBeVisible();
        });
      });
    }
  });

  test.describe('Sorting Behavior', () => {
    // Scenario 2.1: Sort by "Most Used" (Descending)
    // Tests that prompts are correctly sorted by usageCount in descending order
    for (const context of CONTEXTS) {
      test.describe(`${context.name} context`, () => {
        test('sorts by Most Used descending', async ({ page, storage, extensionId }) => {
          // Seed data with varied usage counts
          const now = Date.now();
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Low Usage', content: 'A', usageCount: 2, lastUsedAt: now }),
            createPromptSeed({ id: 'p2', title: 'High Usage', content: 'B', usageCount: 10, lastUsedAt: now }),
            createPromptSeed({ id: 'p3', title: 'Medium Usage', content: 'C', usageCount: 5, lastUsedAt: now }),
            createPromptSeed({ id: 'p4', title: 'Never Used', content: 'D', usageCount: 0, lastUsedAt: now })
          ];
          await seedLibrary(storage, { prompts });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Select "Most Used" from dropdown
          await selectSortOption(page, 'Most Used');

          // Verify prompts are sorted in descending order by usageCount
          const promptTitles = await getSortedPromptTitles(page);
          expect(promptTitles).toEqual([
            'High Usage',    // usageCount: 10
            'Medium Usage',  // usageCount: 5
            'Low Usage',     // usageCount: 2
            'Never Used'     // usageCount: 0
          ]);
        });

        // Scenario 2.2: Sort by "Recently Used" (Descending)
        // Tests that prompts are correctly sorted by lastUsedAt timestamp in descending order
        test('sorts by Recently Used descending', async ({ page, storage, extensionId }) => {
          // Seed data with varied timestamps
          // Note: usageCount > 0 is required so lastUsedAt is properly set (per createPromptSeed logic)
          // IMPORTANT: createdAt must be older than lastUsedAt (normalizePrompt enforces lastUsedAt >= createdAt)
          const now = Date.now();
          const baseCreatedAt = now - 1000000000; // Created ~11 days ago
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Used Yesterday', content: 'A', usageCount: 1, createdAt: baseCreatedAt, updatedAt: now - 1000, lastUsedAt: now - 86400000 }),
            createPromptSeed({ id: 'p2', title: 'Used Just Now', content: 'B', usageCount: 1, createdAt: baseCreatedAt, updatedAt: now - 2000, lastUsedAt: now }),
            createPromptSeed({ id: 'p3', title: 'Used Last Week', content: 'C', usageCount: 1, createdAt: baseCreatedAt, updatedAt: now - 3000, lastUsedAt: now - 604800000 }),
            createPromptSeed({ id: 'p4', title: 'Used 1 Hour Ago', content: 'D', usageCount: 1, createdAt: baseCreatedAt, updatedAt: now - 4000, lastUsedAt: now - 3600000 })
          ];
          await seedLibrary(storage, { prompts });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Select "Recently Used" from dropdown
          await selectSortOption(page, 'Recently Used');

          // Verify prompts are sorted by lastUsedAt descending (most recent first)
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual([
            'Used Just Now',    // now
            'Used 1 Hour Ago',  // now - 3600000
            'Used Yesterday',   // now - 86400000
            'Used Last Week'    // now - 604800000
          ]);
        });

        // Scenario 2.3: Toggle Sort Direction (Most Used ↔ Least Used)
        // Tests that clicking the same sort option toggles between ascending and descending
        test('toggles sort direction between Most Used and Least Used', async ({ page, storage, extensionId }) => {
          // Seed data
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Low', usageCount: 1 }),
            createPromptSeed({ id: 'p2', title: 'High', usageCount: 10 }),
            createPromptSeed({ id: 'p3', title: 'Medium', usageCount: 5 })
          ];
          await seedLibrary(storage, { prompts });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Select "Most Used" from dropdown (defaults to descending)
          await selectSortOption(page, 'Most Used');

          // Verify initial descending order
          let promptTitles = await getSortedPromptTitles(page);
          expect(promptTitles).toEqual(['High', 'Medium', 'Low']);

          // Verify button label shows "Most Used"
          let sortButton = page.getByRole('button', { name: /Sort order: Most Used/i });
          await expect(sortButton).toBeVisible();

          // Toggle to ascending by clicking "Most Used" again
          await selectSortOption(page, 'Most Used');

          // Verify ascending order
          promptTitles = await getSortedPromptTitles(page);
          expect(promptTitles).toEqual(['Low', 'Medium', 'High']);

          // Verify button label changed to "Least Used"
          sortButton = page.getByRole('button', { name: /Sort order: Least Used/i });
          await expect(sortButton).toBeVisible();

          // Verify direction indicator changed in dropdown
          await sortButton.click();
          const mostUsedItem = page.getByRole('menuitem', { name: /Most Used/i });
          const itemText = await mostUsedItem.textContent();
          expect(itemText).toContain('↑'); // Should show ascending arrow
        });

        // Scenario 2.4: Sort Direction Persists Across Sessions
        // Tests that sort direction persists when closing and reopening the extension UI
        test('sort direction persists across sessions', async ({ page, storage, extensionId, context: browserContext }) => {
          // Verify sort state persists across page reloads

          // Seed data
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Low', usageCount: 5 }),
            createPromptSeed({ id: 'p2', title: 'High', usageCount: 10 })
          ];
          await seedLibrary(storage, { prompts });

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Select "Most Used" (defaults to descending)
          let sortButton = page.getByRole('button', { name: /Sort order:/i });
          await sortButton.click();
          await page.getByRole('menuitem', { name: /Most Used/i }).click();

          const promptHeadings = page.locator('article h3');
          await expect(promptHeadings).toHaveText(['High', 'Low']);

          // Toggle to ascending
          sortButton = page.getByRole('button', { name: /Sort order: Most Used/i });
          await expect(sortButton).toBeVisible();
          await sortButton.click();
          await page.getByRole('menuitem', { name: /Most Used/i }).click();

          await expect(promptHeadings).toHaveText(['Low', 'High']);

          // Verify persistence to storage
          const settings = await storage.getSettings();
          expect(settings?.sortOrder).toBe('usageCount');

          // Close and reopen page
          await page.close();
          const newPage = await browserContext.newPage();
          await newPage.goto(`chrome-extension://${extensionId}/${context.url}`);
          await newPage.waitForLoadState('domcontentloaded');

          // Verify sort direction persisted
          const newTitles = await newPage.locator('article h3').allTextContents();
          expect(newTitles).toEqual(['Low', 'High']); // Should still be ascending

          // Verify button label shows "Least Used"
          const newSortButton = newPage.getByRole('button', { name: /Sort order: Least Used/i });
          await expect(newSortButton).toBeVisible();
        });
      });
    }
  });

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
      let titles = await popupPromptHeadings.allTextContents();
      expect(titles).toEqual(['Low', 'High']);

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

      titles = await sidepanelPage.locator('article h3').allTextContents();
      expect(titles).toEqual(['Low', 'High']); // Still ascending

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

  // ============================================================================
  // Section 5: Edge Cases
  // ============================================================================

  test.describe('Edge Cases', () => {
    // Scenario 5.1: Empty Library State
    // Tests that sort dropdown works correctly even when no prompts exist
    for (const context of CONTEXTS) {
      test.describe(`${context.name} context`, () => {
        test('handles empty library', async ({ page, storage, extensionId }) => {
          // Seed empty library
          await seedLibrary(storage, { prompts: [] });

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          // Verify empty state message is displayed first
          await expect(page.getByText(/You're ready to go/i)).toBeVisible();
          await expect(page.getByRole('button', { name: /Create your first prompt/i })).toBeVisible();

          // Verify sort dropdown still renders and works
          const sortButton = page.getByRole('button', { name: /Sort order:/i });
          await expect(sortButton).toBeVisible();
          await sortButton.click();

          // Verify all sort options are visible and clickable
          await expect(page.getByRole('menuitem', { name: /Most Used/i })).toBeVisible();
          await expect(page.getByRole('menuitem', { name: /Recently Used/i })).toBeVisible();
          await expect(page.getByRole('menuitem', { name: /Recently Updated/i })).toBeVisible();
          await expect(page.getByRole('menuitem', { name: /Recently Created/i })).toBeVisible();
          await expect(page.getByRole('menuitem', { name: /Alphabetical/i })).toBeVisible();

          // Click an option to ensure no crashes occur
          await page.getByRole('menuitem', { name: /Most Used/i }).click();

          // Verify no errors and dropdown closed
          await expect(page.getByRole('menuitem', { name: /Most Used/i })).toBeHidden();

          // Verify empty state message is still visible after dropdown closes
          await expect(page.getByText(/You're ready to go/i)).toBeVisible();
        });

        // Scenario 5.2: Single Prompt Library
        // Tests that sort operations work correctly with only one prompt
        test('handles single prompt library', async ({ page, storage, extensionId }) => {
          // Seed library with one prompt
          await seedLibrary(storage, {
            prompts: [createPromptSeed({ id: 'single', title: 'Only Prompt', usageCount: 5 })]
          });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Verify single prompt is displayed
          await expect(page.getByText('Only Prompt')).toBeVisible();

          // Count article elements
          const promptCards = await page.locator('article[aria-labelledby^="prompt-title-"]').count();
          expect(promptCards).toBe(1);

          // Select "Most Used" sort
          await selectSortOption(page, 'Most Used');

          // Verify still one prompt, no errors
          expect(await page.locator('article[aria-labelledby^="prompt-title-"]').count()).toBe(1);
          await expect(page.getByText('Only Prompt')).toBeVisible();

          // Toggle to ascending (Least Used)
          const sortButton = page.getByRole('button', { name: /Sort order: Most Used/i });
          await expect(sortButton).toBeVisible();
          await selectSortOption(page, 'Most Used');

          // Verify still one prompt after toggle
          expect(await page.locator('article[aria-labelledby^="prompt-title-"]').count()).toBe(1);
          await expect(page.getByText('Only Prompt')).toBeVisible();

          // Verify button label changed to "Least Used"
          await expect(page.getByRole('button', { name: /Sort order: Least Used/i })).toBeVisible();
        });

        // Scenario 5.3: Multiple Prompts with Same Usage Count (Stable Sort)
        // Tests that tied prompts maintain stable order with secondary sort by createdAt
        test('handles tied usage counts with stable sort', async ({ page, storage, extensionId }) => {
          // Seed prompts with tied usage counts
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Alpha', usageCount: 5, createdAt: 1700000000 }),
            createPromptSeed({ id: 'p2', title: 'Beta', usageCount: 5, createdAt: 1700000001 }),
            createPromptSeed({ id: 'p3', title: 'Gamma', usageCount: 5, createdAt: 1700000002 }),
            createPromptSeed({ id: 'p4', title: 'Delta', usageCount: 3, createdAt: 1700000003 })
          ];
          await seedLibrary(storage, { prompts });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Select "Most Used" sort
          await selectSortOption(page, 'Most Used');

          // Verify primary sort (usageCount) and secondary sort (createdAt)
          const promptTitles = await getSortedPromptTitles(page);
          expect(promptTitles).toEqual([
            'Alpha',  // usageCount: 5, createdAt: 1700000000
            'Beta',   // usageCount: 5, createdAt: 1700000001
            'Gamma',  // usageCount: 5, createdAt: 1700000002
            'Delta'   // usageCount: 3, createdAt: 1700000003
          ]);

          // Verify stable sort by switching to another sort and back
          await selectSortOption(page, 'Recently Updated');

          // Switch back to Most Used
          await selectSortOption(page, 'Most Used');

          // Verify order is still the same (stable sort)
          const retitles = await getSortedPromptTitles(page);
          expect(retitles).toEqual(promptTitles); // Order should be identical
        });

        // Scenario 5.4: Prompts with Zero Usage Count
        // Tests that prompts with zero usage count are displayed correctly and sorted to the end
        test('handles zero usage count', async ({ page, storage, extensionId }) => {
          // Seed prompts with zero and non-zero usage counts
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Never Used 1', usageCount: 0 }),
            createPromptSeed({ id: 'p2', title: 'Used Once', usageCount: 1 }),
            createPromptSeed({ id: 'p3', title: 'Never Used 2', usageCount: 0 })
          ];
          await seedLibrary(storage, { prompts });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Select "Most Used" sort
          await selectSortOption(page, 'Most Used');

          // Verify sorting: used prompt first, zero-usage prompts at end
          const promptTitles = await getSortedPromptTitles(page);
          expect(promptTitles[0]).toBe('Used Once'); // usageCount: 1 comes first

          // Zero-usage prompts should be at the end (order between them may vary)
          expect(promptTitles.slice(1)).toContain('Never Used 1');
          expect(promptTitles.slice(1)).toContain('Never Used 2');

          // Verify all prompts are visible (not hidden)
          await expect(page.getByText('Never Used 1')).toBeVisible();
          await expect(page.getByText('Never Used 2')).toBeVisible();
          await expect(page.getByText('Used Once')).toBeVisible();

          // Verify count
          const promptCards = await page.locator('article[aria-labelledby^="prompt-title-"]').count();
          expect(promptCards).toBe(3);
        });
      });
    }

    // Scenario 5.5: Performance: Large Library Sorting
    // Tests that sorting operations complete efficiently with 1000 prompts
    test.describe('Performance', () => {
      for (const context of CONTEXTS) {
        test.describe(`${context.name} context`, () => {
          test('sorts large library efficiently', async ({ page, storage, extensionId }) => {
            // Generate large library of 1000 prompts with random usage counts
            const prompts = Array.from({ length: 1000 }, (_, i) =>
              createPromptSeed({
                id: `prompt-${i}`,
                title: `Prompt ${i}`,
                content: `Content for prompt ${i}`,
                usageCount: Math.floor(Math.random() * 100),
                lastUsedAt: Date.now() - Math.floor(Math.random() * 86400000 * 30) // Random within last 30 days
              })
            );
            await seedLibrary(storage, { prompts });

            await navigateToContext(page, extensionId, context.name);
            await page.waitForLoadState('domcontentloaded');

            // Wait for initial render
            await expect(page.locator('article[aria-labelledby^="prompt-title-"]').first()).toBeVisible();

            // Measure sort performance
            const startTime = performance.now();

            // Perform sort operation
            await selectSortOption(page, 'Most Used');

            // Wait for re-render
            await expect(page.locator('article[aria-labelledby^="prompt-title-"]').first()).toBeVisible();

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Verify performance target: <500ms for E2E test (includes Playwright overhead)
            expect(duration).toBeLessThan(500);

            // Verify sort correctness by checking first 10 prompts
            const titles = await getSortedPromptTitles(page);
            const promptsData = await storage.getPrompts();

            // Get usage counts for first 10 titles
            const firstTenUsageCounts = titles.slice(0, 10).map(title => {
              const prompt = promptsData.find(p => p.title === title);
              return prompt?.usageCount ?? 0;
            });

            // Verify descending order
            for (let i = 0; i < firstTenUsageCounts.length - 1; i++) {
              expect(firstTenUsageCounts[i]).toBeGreaterThanOrEqual(firstTenUsageCounts[i + 1]);
            }

            // Verify UI remains responsive (no frozen state)
            const sortButton = page.getByRole('button', { name: /Sort order: Most Used/i });
            await expect(sortButton).toBeVisible();
            await expect(sortButton).toBeEnabled();
          });
        });
      }
    });
  });
});

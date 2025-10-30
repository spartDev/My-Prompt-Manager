/**
 * E2E Tests: Usage Counter & Smart Sorting - UI Display and Sorting Behavior
 *
 * Tests UI display scenarios and sorting behavior, covering both popup and sidepanel contexts.
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
});

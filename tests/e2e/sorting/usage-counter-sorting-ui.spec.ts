/**
 * E2E Tests: Usage Counter & Smart Sorting - UI Display and Sorting Behavior
 *
 * Tests the Library sort (a Settings preference, "Sort prompts by") and the "Most Used" Library
 * filter, covering both popup and sidepanel contexts.
 *
 * @see docs/TEST_PLAN_USAGE_COUNTER_SMART_SORTING.md
 */

import { DEFAULT_CATEGORY } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { LibraryPage } from '../pages/LibraryPage';
import { tabNavigation } from '../utils/navigation';
import { getSortedPromptTitles, selectSortOption, navigateToContext, getCurrentSortLabel } from '../utils/sort-helpers';
import { seedLibrary, createPromptSeed } from '../utils/storage';

// Define contexts for parameterized testing - ensures both popup and sidepanel are tested
const CONTEXTS = [
  { name: 'popup', url: 'src/popup.html' },
  { name: 'sidepanel', url: 'src/sidepanel.html' }
] as const;

// The sort options offered in Settings, in display order
const SORT_OPTION_LABELS = [
  'Recently Updated',
  'Recently Used',
  'Recently Created',
  'Number of Uses',
  'Alphabetical (A→Z)'
];

test.describe('Usage Counter & Smart Sorting - UI Display', () => {

  test.describe('Sort Setting UI', () => {
    // Scenario 1.1: Settings Offers the Sort Options
    // Tests that "Sort prompts by" lists the five sorts in order, with Recently Updated chosen by default
    for (const context of CONTEXTS) {
      test.describe(`${context.name} context`, () => {
        test('lists the sort options with Recently Updated chosen by default', async ({ page, storage, extensionId }) => {
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
          await page.waitForLoadState('domcontentloaded');
          await expect(page.getByTestId('prompt-card')).toHaveCount(1);

          // The Library itself has no sort control any more
          await expect(page.getByRole('button', { name: /Sort order:/i })).toHaveCount(0);

          // The sort lives in Settings
          await tabNavigation.switchTo(page, 'settings');
          const sortSelect = page.getByLabel('Sort prompts by');
          await expect(sortSelect).toBeVisible();

          // Verify the five options, in order (no direction choice: each sort has one direction)
          await expect(sortSelect.getByRole('option')).toHaveText(SORT_OPTION_LABELS);

          // Verify the default choice
          await expect(sortSelect).toHaveValue('updatedAt');
          await expect(sortSelect.locator('option:checked')).toHaveText('Recently Updated');
        });

        // Scenario 1.2: Choosing a Sort Saves It With Its Natural Direction
        // Tests that each choice is stored as { sortOrder, sortDirection } with that sort's one direction
        test('saves each sort with its one direction', async ({ page, storage, extensionId }) => {
          await seedLibrary(storage, {
            prompts: [createPromptSeed({ id: 'p1', title: 'Test Prompt', content: 'Content' })]
          });

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');
          await tabNavigation.switchTo(page, 'settings');

          const sortSelect = page.getByLabel('Sort prompts by');
          const expectedSettings = [
            { label: 'Number of Uses', sortOrder: 'usageCount', sortDirection: 'desc' },
            { label: 'Alphabetical (A→Z)', sortOrder: 'title', sortDirection: 'asc' },
            { label: 'Recently Used', sortOrder: 'lastUsedAt', sortDirection: 'desc' },
            { label: 'Recently Created', sortOrder: 'createdAt', sortDirection: 'desc' },
            { label: 'Recently Updated', sortOrder: 'updatedAt', sortDirection: 'desc' }
          ] as const;

          for (const { label, sortOrder, sortDirection } of expectedSettings) {
            await sortSelect.selectOption({ label });
            await expect(sortSelect.locator('option:checked')).toHaveText(label);

            // The choice is written to settings storage asynchronously
            await expect
              .poll(async () => {
                const settings = await storage.getSettings();
                return { sortOrder: settings?.sortOrder, sortDirection: settings?.sortDirection };
              })
              .toEqual({ sortOrder, sortDirection });
          }
        });
      });
    }
  });

  test.describe('Most Used Filter', () => {
    // Scenario 1.3: Most Used Ranks by Number of Uses
    // Tests that the "Most Used" pill lists only used prompts, most used first, with no priority for pinned ones
    for (const context of CONTEXTS) {
      test.describe(`${context.name} context`, () => {
        test('ranks used prompts by usage and leaves out never-used ones', async ({ page, storage, extensionId }) => {
          const now = Date.now();
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Low Usage', content: 'A', usageCount: 2, lastUsedAt: now }),
            createPromptSeed({ id: 'p2', title: 'High Usage', content: 'B', usageCount: 10, lastUsedAt: now }),
            createPromptSeed({ id: 'p3', title: 'Medium Usage', content: 'C', usageCount: 5, lastUsedAt: now }),
            createPromptSeed({ id: 'p4', title: 'Never Used', content: 'D', usageCount: 0 }),
            // Pinned Prompts come first in the other filters, but not in Most Used
            createPromptSeed({ id: 'p5', title: 'Pinned Rarely Used', content: 'E', usageCount: 1, lastUsedAt: now, pinned: true })
          ];
          await seedLibrary(storage, { prompts });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');
          const libraryPage = new LibraryPage(page);

          // "All" is active on open and lists every prompt, pinned first
          await expect(libraryPage.getLibraryFilterPill('All')).toHaveAttribute('aria-checked', 'true');
          await expect(page.getByTestId('prompt-card')).toHaveCount(5);
          await expect.poll(async () => (await getSortedPromptTitles(page))[0]).toBe('Pinned Rarely Used');

          // Choose the "Most Used" pill
          await libraryPage.selectLibraryFilter('Most Used');

          // Verify prompts are ranked by usageCount, most used first; the never-used prompt is left out
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual([
            'High Usage',         // usageCount: 10
            'Medium Usage',       // usageCount: 5
            'Low Usage',          // usageCount: 2
            'Pinned Rarely Used'  // usageCount: 1 (pinned, no priority here)
          ]);
          await expect(libraryPage.getPromptCard('Never Used')).toBeHidden();
        });

        // Scenario 1.4: Most Used Ignores the Settings Sort
        // Tests that the "Most Used" ranking does not follow the sort chosen in Settings
        test('ignores the sort chosen in Settings', async ({ page, storage, extensionId }) => {
          const now = Date.now();
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Alpha', content: 'A', usageCount: 1, lastUsedAt: now }),
            createPromptSeed({ id: 'p2', title: 'Bravo', content: 'B', usageCount: 7, lastUsedAt: now }),
            createPromptSeed({ id: 'p3', title: 'Charlie', content: 'C', usageCount: 3, lastUsedAt: now })
          ];
          await seedLibrary(storage, { prompts });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Choose the Alphabetical sort in Settings: "All" follows it
          await selectSortOption(page, 'Alphabetical (A→Z)');
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(['Alpha', 'Bravo', 'Charlie']);

          // "Most Used" still ranks by number of uses
          await new LibraryPage(page).selectLibraryFilter('Most Used');
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(['Bravo', 'Charlie', 'Alpha']);
        });
      });
    }
  });

  test.describe('Sorting Behavior', () => {
    // Scenario 2.1: Sort by "Number of Uses"
    // Tests that prompts are listed by usageCount, most used first, once chosen in Settings
    for (const context of CONTEXTS) {
      test.describe(`${context.name} context`, () => {
        test('sorts by Number of Uses, most used first', async ({ page, storage, extensionId }) => {
          // Seed data with varied usage counts. updatedAt is set so the default sort
          // (Recently Updated) gives a different order.
          const now = Date.now();
          const baseCreatedAt = now - 1000000000;
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Low Usage', content: 'A', usageCount: 2, createdAt: baseCreatedAt, updatedAt: now - 1000, lastUsedAt: now }),
            createPromptSeed({ id: 'p2', title: 'High Usage', content: 'B', usageCount: 10, createdAt: baseCreatedAt, updatedAt: now - 4000, lastUsedAt: now }),
            createPromptSeed({ id: 'p3', title: 'Medium Usage', content: 'C', usageCount: 5, createdAt: baseCreatedAt, updatedAt: now - 3000, lastUsedAt: now }),
            createPromptSeed({ id: 'p4', title: 'Never Used', content: 'D', usageCount: 0, createdAt: baseCreatedAt, updatedAt: now - 2000 })
          ];
          await seedLibrary(storage, { prompts });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Default sort: Recently Updated
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual([
            'Low Usage', 'Never Used', 'Medium Usage', 'High Usage'
          ]);

          // Choose "Number of Uses" in Settings
          await selectSortOption(page, 'Number of Uses');

          // Verify prompts are sorted in descending order by usageCount; never-used ones stay listed
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual([
            'High Usage',    // usageCount: 10
            'Medium Usage',  // usageCount: 5
            'Low Usage',     // usageCount: 2
            'Never Used'     // usageCount: 0
          ]);
        });

        // Scenario 2.2: Sort by "Recently Used"
        // Tests that prompts are correctly sorted by lastUsedAt timestamp in descending order
        test('sorts by Recently Used, most recent first', async ({ page, storage, extensionId }) => {
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

          // Choose "Recently Used" in Settings
          await selectSortOption(page, 'Recently Used');

          // Verify prompts are sorted by lastUsedAt descending (most recent first)
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual([
            'Used Just Now',    // now
            'Used 1 Hour Ago',  // now - 3600000
            'Used Yesterday',   // now - 86400000
            'Used Last Week'    // now - 604800000
          ]);
        });

        // Scenario 2.3: A Stored Reversed Direction Is Ignored
        // Earlier versions could store an ascending "Least Used" sort. Each sort now has one direction,
        // so the Library still lists the most used first.
        test('ignores a stored ascending direction', async ({ page, storage, extensionId }) => {
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Low', usageCount: 1 }),
            createPromptSeed({ id: 'p2', title: 'High', usageCount: 10 }),
            createPromptSeed({ id: 'p3', title: 'Medium', usageCount: 5 })
          ];
          await seedLibrary(storage, {
            prompts,
            settings: { sortOrder: 'usageCount', sortDirection: 'asc' }
          });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Verify descending order despite the stored 'asc'
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(['High', 'Medium', 'Low']);

          // Settings shows the stored sort
          expect(await getCurrentSortLabel(page)).toBe('Number of Uses');

          // Coming back to the Library keeps the same order
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(['High', 'Medium', 'Low']);
        });

        // Scenario 2.4: The Chosen Sort Persists Across Sessions
        // Tests that the sort chosen in Settings persists across a reload and a new page
        test('chosen sort persists across sessions', async ({ page, storage, extensionId, context: browserContext }) => {
          // Seed data: "Low" was updated last, so the default sort lists it first
          const now = Date.now();
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Low', usageCount: 5, createdAt: now - 10000, updatedAt: now - 1000 }),
            createPromptSeed({ id: 'p2', title: 'High', usageCount: 10, createdAt: now - 10000, updatedAt: now - 2000 })
          ];
          await seedLibrary(storage, { prompts });

          await page.goto(`chrome-extension://${extensionId}/${context.url}`);
          await page.waitForLoadState('domcontentloaded');

          const promptHeadings = page.getByTestId('prompt-card').getByRole('heading');
          await expect(promptHeadings).toHaveText(['Low', 'High']);

          // Choose "Number of Uses" in Settings
          await selectSortOption(page, 'Number of Uses');
          await expect(promptHeadings).toHaveText(['High', 'Low']);

          // Verify persistence to storage, with the sort's one direction. Wait for the write to land:
          // closing the page first can cut it short.
          await expect
            .poll(async () => {
              const settings = await storage.getSettings();
              return { sortOrder: settings?.sortOrder, sortDirection: settings?.sortDirection };
            })
            .toEqual({ sortOrder: 'usageCount', sortDirection: 'desc' });

          // Reload: the Library reads the sort again
          await page.reload();
          await page.waitForLoadState('domcontentloaded');
          await expect(page.getByTestId('prompt-card').getByRole('heading')).toHaveText(['High', 'Low']);

          // Close and reopen page
          await page.close();
          const newPage = await browserContext.newPage();
          await newPage.goto(`chrome-extension://${extensionId}/${context.url}`);
          await newPage.waitForLoadState('domcontentloaded');

          // Verify the sort persisted
          await expect(newPage.getByTestId('prompt-card').getByRole('heading')).toHaveText(['High', 'Low']);

          // Verify Settings shows "Number of Uses"
          expect(await getCurrentSortLabel(newPage)).toBe('Number of Uses');
        });
      });
    }
  });
});

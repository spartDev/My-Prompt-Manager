/**
 * E2E Tests: Usage Counter & Smart Sorting - Edge Cases and Performance
 *
 * Tests edge cases and performance characteristics of sorting.
 *
 * @see docs/TEST_PLAN_USAGE_COUNTER_SMART_SORTING.md
 */

import { test, expect } from '../fixtures/extension';
import { LibraryPage } from '../pages/LibraryPage';
import { tabNavigation } from '../utils/navigation';
import { getSortedPromptTitles, selectSortOption, navigateToContext } from '../utils/sort-helpers';
import { seedLibrary, createPromptSeed } from '../utils/storage';

// Define contexts for parameterized testing
const CONTEXTS = [
  { name: 'popup', url: 'src/popup.html' },
  { name: 'sidepanel', url: 'src/sidepanel.html' }
] as const;

test.describe('Usage Counter & Smart Sorting - Edge Cases', () => {

  // ============================================================================
  // Section 5: Edge Cases
  // ============================================================================

  test.describe('Edge Cases', () => {
    // Scenario 5.1: Empty Library State
    // Tests that the sort setting and the Library filter work correctly even when no prompts exist
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

          // Verify the Library filter still renders: only the fixed pills, no Category holds a Prompt
          const libraryPage = new LibraryPage(page);
          await expect(page.getByRole('radiogroup', { name: 'Library filter' }).getByRole('radio')).toHaveText(['All', 'Pinned', 'Most Used']);

          // Choose "Most Used" to ensure no crashes occur: the empty library keeps its own empty state
          await libraryPage.selectLibraryFilter('Most Used');
          await expect(page.getByText(/You're ready to go/i)).toBeVisible();
          await libraryPage.selectLibraryFilter('All');

          // Verify the sort setting renders and works
          await tabNavigation.switchTo(page, 'settings');
          const sortSelect = page.getByLabel('Sort prompts by');
          await expect(sortSelect.getByRole('option')).toHaveText([
            'Recently Updated',
            'Recently Used',
            'Recently Created',
            'Number of Uses',
            'Alphabetical (A→Z)'
          ]);

          // Choose a sort to ensure no crashes occur
          await sortSelect.selectOption({ label: 'Number of Uses' });
          await expect.poll(async () => (await storage.getSettings())?.sortOrder).toBe('usageCount');

          // Verify empty state message is still visible back in the Library
          await tabNavigation.switchTo(page, 'library');
          await expect(page.getByText(/You're ready to go/i)).toBeVisible();
        });

        // Scenario 5.2: Single Prompt Library
        // Tests that sort and filter operations work correctly with only one prompt
        test('handles single prompt library', async ({ page, storage, extensionId }) => {
          // Seed library with one prompt
          await seedLibrary(storage, {
            prompts: [createPromptSeed({ id: 'single', title: 'Only Prompt', usageCount: 5 })]
          });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Verify single prompt is displayed
          await expect(page.getByText('Only Prompt')).toBeVisible();
          const promptCards = page.getByTestId('prompt-card');
          await expect(promptCards).toHaveCount(1);

          // Choose the "Number of Uses" sort
          await selectSortOption(page, 'Number of Uses');

          // Verify still one prompt, no errors
          await expect(promptCards).toHaveCount(1);
          await expect(page.getByText('Only Prompt')).toBeVisible();

          // Choose another sort
          await selectSortOption(page, 'Alphabetical (A→Z)');

          // Verify still one prompt after the change
          await expect(promptCards).toHaveCount(1);
          await expect(page.getByText('Only Prompt')).toBeVisible();

          // The used prompt is the only one in Most Used
          await new LibraryPage(page).selectLibraryFilter('Most Used');
          await expect(promptCards).toHaveCount(1);
          await expect(page.getByText('Only Prompt')).toBeVisible();
        });

        // Scenario 5.3: Multiple Prompts with Same Usage Count
        // Tests that tied prompts keep a stable order in the "Number of Uses" sort,
        // and that "Most Used" breaks ties by most recent use
        test('handles tied usage counts', async ({ page, storage, extensionId }) => {
          // Seed prompts with tied usage counts
          const now = Date.now();
          const prompts = [
            createPromptSeed({ id: 'p1', title: 'Alpha', usageCount: 5, createdAt: 1700000000, lastUsedAt: now - 3000 }),
            createPromptSeed({ id: 'p2', title: 'Beta', usageCount: 5, createdAt: 1700000001, lastUsedAt: now - 1000 }),
            createPromptSeed({ id: 'p3', title: 'Gamma', usageCount: 5, createdAt: 1700000002, lastUsedAt: now - 2000 }),
            createPromptSeed({ id: 'p4', title: 'Delta', usageCount: 3, createdAt: 1700000003, lastUsedAt: now })
          ];
          await seedLibrary(storage, { prompts });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');

          // Choose the "Number of Uses" sort
          await selectSortOption(page, 'Number of Uses');

          // Verify primary sort (usageCount); tied prompts keep their stored order (stable sort)
          const expectedTitles = [
            'Alpha',  // usageCount: 5, createdAt: 1700000000
            'Beta',   // usageCount: 5, createdAt: 1700000001
            'Gamma',  // usageCount: 5, createdAt: 1700000002
            'Delta'   // usageCount: 3, createdAt: 1700000003
          ];
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(expectedTitles);

          // Verify stable sort by switching to another sort and back
          await selectSortOption(page, 'Recently Updated');
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(['Delta', 'Gamma', 'Beta', 'Alpha']);

          // Switch back to Number of Uses
          await selectSortOption(page, 'Number of Uses');

          // Verify order is still the same (stable sort)
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(expectedTitles);

          // "Most Used" breaks ties by most recent use
          await new LibraryPage(page).selectLibraryFilter('Most Used');
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual([
            'Beta',   // usageCount: 5, used 1s ago
            'Gamma',  // usageCount: 5, used 2s ago
            'Alpha',  // usageCount: 5, used 3s ago
            'Delta'   // usageCount: 3
          ]);
        });

        // Scenario 5.4: Prompts with Zero Usage Count
        // Tests that prompts with zero usage count are listed last by "Number of Uses" and left out of "Most Used"
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

          // Choose the "Number of Uses" sort
          await selectSortOption(page, 'Number of Uses');

          // Verify sorting: used prompt first, zero-usage prompts at end
          await expect.poll(async () => (await getSortedPromptTitles(page))[0]).toBe('Used Once'); // usageCount: 1 comes first
          const promptTitles = await getSortedPromptTitles(page);

          // Zero-usage prompts should be at the end (order between them may vary)
          expect(promptTitles.slice(1)).toContain('Never Used 1');
          expect(promptTitles.slice(1)).toContain('Never Used 2');

          // Verify all prompts are visible (not hidden)
          await expect(page.getByText('Never Used 1')).toBeVisible();
          await expect(page.getByText('Never Used 2')).toBeVisible();
          await expect(page.getByText('Used Once')).toBeVisible();

          // Verify count
          await expect(page.getByTestId('prompt-card')).toHaveCount(3);

          // "Most Used" lists only the used prompt
          await new LibraryPage(page).selectLibraryFilter('Most Used');
          await expect.poll(async () => getSortedPromptTitles(page)).toEqual(['Used Once']);
        });

        // Scenario 5.5: No Prompt Used Yet
        // Tests that "Most Used" explains itself when no prompt has been used
        test('shows an empty Most Used when no prompt has been used', async ({ page, storage, extensionId }) => {
          await seedLibrary(storage, {
            prompts: [
              createPromptSeed({ id: 'p1', title: 'Never Used 1', usageCount: 0 }),
              createPromptSeed({ id: 'p2', title: 'Never Used 2', usageCount: 0 })
            ]
          });

          await navigateToContext(page, extensionId, context.name);
          await page.waitForLoadState('domcontentloaded');
          await expect(page.getByTestId('prompt-card')).toHaveCount(2);

          await new LibraryPage(page).selectLibraryFilter('Most Used');

          await expect(page.getByRole('heading', { name: 'No prompts used yet' })).toBeVisible();
          await expect(page.getByTestId('prompt-card')).toHaveCount(0);
        });
      });
    }

    // Scenario 5.6: Performance: Large Library Sorting
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
            const usedCount = prompts.filter(prompt => (prompt.usageCount ?? 0) > 0).length;

            await navigateToContext(page, extensionId, context.name);
            await page.waitForLoadState('domcontentloaded');

            // Wait for initial render
            const promptCards = page.getByTestId('prompt-card');
            await expect(promptCards).toHaveCount(1000);

            // Measure ranking performance: "Most Used" re-ranks the whole library in place
            const libraryPage = new LibraryPage(page);
            const startTime = performance.now();

            await libraryPage.selectLibraryFilter('Most Used');

            // Wait for re-render (never-used prompts drop out of the list)
            await expect(promptCards).toHaveCount(usedCount);

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Verify performance target: <1500ms for E2E test (includes Playwright overhead + CI variance)
            // Local runs typically complete in <300ms, CI environments may be slower (observed up to 1180ms)
            // Increased threshold to account for CI environment variability while still catching regressions
            expect(duration).toBeLessThan(1500);

            const promptsData = await storage.getPrompts();
            const usageOf = (title: string) => promptsData.find(p => p.title === title)?.usageCount ?? 0;

            // Verify ranking correctness by checking first 10 prompts
            const rankedUsageCounts = (await getSortedPromptTitles(page)).slice(0, 10).map(usageOf);
            for (let i = 0; i < rankedUsageCounts.length - 1; i++) {
              expect(rankedUsageCounts[i]).toBeGreaterThanOrEqual(rankedUsageCounts[i + 1]);
            }

            // Verify UI remains responsive (no frozen state)
            await expect(libraryPage.getLibraryFilterPill('Most Used')).toHaveAttribute('aria-checked', 'true');
            await expect(libraryPage.getLibraryFilterPill('All')).toBeEnabled();

            // The "Number of Uses" sort from Settings orders the whole library the same way
            await libraryPage.selectLibraryFilter('All');
            await selectSortOption(page, 'Number of Uses');
            await expect(promptCards).toHaveCount(1000);
            await expect.poll(async () => {
              const usageCounts = (await getSortedPromptTitles(page)).map(usageOf);
              return usageCounts.every((count, i) => i === 0 || usageCounts[i - 1] >= count);
            }).toBe(true);
          });
        });
      }
    });
  });
});

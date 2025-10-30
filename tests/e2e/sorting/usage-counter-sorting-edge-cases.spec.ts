/**
 * E2E Tests: Usage Counter & Smart Sorting - Edge Cases and Performance
 *
 * Tests edge cases and performance characteristics of sorting.
 *
 * @see docs/TEST_PLAN_USAGE_COUNTER_SMART_SORTING.md
 */

import { test, expect } from '../fixtures/extension';
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

            // Verify performance target: <750ms for E2E test (includes Playwright overhead + CI variance)
            // Local runs typically complete in <300ms, CI environments may be slower
            expect(duration).toBeLessThan(750);

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

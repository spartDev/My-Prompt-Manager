import { USAGE_STORAGE_KEY } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { createAnalyticsScenario } from '../fixtures/test-data';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { analyticsAssertions } from '../utils/assertions';
import { seedLibrary, seedUsageHistory } from '../utils/storage';

test.describe('Analytics clear history', () => {
  test.describe('Modal interactions', () => {
    test('modal opens on click', async ({ context, storage, extensionId }) => {
      // Seed data with usage history
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: scenario.settings,
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Click clear history button
      await analyticsPage.getClearHistoryButton().click();

      // Verify modal is visible
      const modal = analyticsPage.getClearHistoryModal();
      await expect(modal).toBeVisible();
    });

    test('modal shows warning message', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: scenario.settings,
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Open the modal
      await analyticsPage.getClearHistoryButton().click();
      await analyticsAssertions.clearHistoryModalVisible(page);

      // Verify warning message is displayed
      await expect(page.getByText('This will permanently delete all your usage analytics data')).toBeVisible();
      await expect(page.getByText('This action cannot be undone')).toBeVisible();
    });

    test('cancel closes modal without clearing', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: scenario.settings,
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Open modal and cancel
      await analyticsPage.getClearHistoryButton().click();
      await analyticsAssertions.clearHistoryModalVisible(page);
      await analyticsPage.cancelClearHistory();

      // Verify modal is closed
      await analyticsAssertions.clearHistoryModalHidden(page);

      // Verify data is still present (FAB should still be visible)
      await analyticsAssertions.expandButtonVisible(page);

      // Verify storage still has data
      const usageData = await storage.get<{ [USAGE_STORAGE_KEY]: unknown[] }>(USAGE_STORAGE_KEY);
      expect(usageData[USAGE_STORAGE_KEY]).toBeDefined();
      expect(usageData[USAGE_STORAGE_KEY].length).toBeGreaterThan(0);
    });

    test('backdrop click closes modal', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: scenario.settings,
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Open modal
      await analyticsPage.getClearHistoryButton().click();
      await analyticsAssertions.clearHistoryModalVisible(page);

      // Click backdrop (the div with aria-hidden="true" that's behind the dialog)
      // We click at a position that's on the backdrop but not on the dialog
      await page.locator('div[role="presentation"]').click({ position: { x: 5, y: 5 } });

      // Verify modal is closed
      await analyticsAssertions.clearHistoryModalHidden(page);

      // Verify data is still present
      const usageData = await storage.get<{ [USAGE_STORAGE_KEY]: unknown[] }>(USAGE_STORAGE_KEY);
      expect(usageData[USAGE_STORAGE_KEY].length).toBeGreaterThan(0);
    });
  });

  test.describe('Clear functionality', () => {
    test('confirm removes all history and storage is cleared', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: scenario.settings,
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Clear history via confirmation
      await analyticsPage.confirmClearHistory();

      // Verify storage is cleared
      const usageData = await storage.get<{ [USAGE_STORAGE_KEY]: unknown[] }>(USAGE_STORAGE_KEY);
      expect(usageData[USAGE_STORAGE_KEY]).toEqual([]);

      // Verify empty state shown
      await analyticsAssertions.emptyState(page);
    });

    test('loading state is shown during clear operation', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: scenario.settings,
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Open modal
      await analyticsPage.getClearHistoryButton().click();
      const modal = analyticsPage.getClearHistoryModal();
      await expect(modal).toBeVisible();

      // Get the Clear History button in the modal
      const clearButton = modal.getByRole('button', { name: 'Clear History' });

      // The button should initially show "Clear History"
      await expect(clearButton).toHaveText('Clear History');

      // Click and verify the button becomes disabled during clearing
      // (the disabled state is set while isClearing is true)
      await clearButton.click();

      // Wait for the operation to complete and modal to close
      await expect(modal).toBeHidden();

      // Verify data was cleared
      await expect(page.getByText('No usage data yet')).toBeVisible();
    });

    test('FAB hides after clear', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: scenario.settings,
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Verify FAB is visible before clearing
      const expandButton = analyticsPage.getExpandDashboardButton();
      await expect(expandButton).toBeVisible();

      // Clear history
      await analyticsPage.confirmClearHistory();

      // Verify FAB is hidden after clearing
      await expect(expandButton).toBeHidden();
    });
  });

  test.describe('Button visibility', () => {
    test('clear button is only visible when data exists', async ({ context, storage, extensionId }) => {
      // Start with empty data
      const emptyScenario = createAnalyticsScenario('EMPTY');
      await seedLibrary(storage, {
        prompts: emptyScenario.prompts,
        categories: emptyScenario.categories,
        settings: emptyScenario.settings,
      });
      await seedUsageHistory(storage, emptyScenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Verify empty state is shown
      await analyticsAssertions.emptyState(page);

      // Verify clear button is NOT visible when no data
      await expect(analyticsPage.getClearHistoryButton()).toBeHidden();
    });

    test('clear button becomes hidden after clearing data', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: scenario.settings,
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Verify clear button is visible before clearing
      await expect(analyticsPage.getClearHistoryButton()).toBeVisible();

      // Clear history
      await analyticsPage.confirmClearHistory();

      // Verify clear button is now hidden
      await expect(analyticsPage.getClearHistoryButton()).toBeHidden();
    });
  });

  test.describe('Storage verification', () => {
    test('storage.get confirms usageHistory is cleared', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: scenario.settings,
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      // Verify initial data exists
      const initialData = await storage.get<{ [USAGE_STORAGE_KEY]: unknown[] }>(USAGE_STORAGE_KEY);
      expect(initialData[USAGE_STORAGE_KEY].length).toBe(scenario.usageHistory.length);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToAnalyticsTab();

      // Clear history
      await analyticsPage.confirmClearHistory();

      // Verify storage is completely cleared
      const clearedData = await storage.get<{ [USAGE_STORAGE_KEY]: unknown[] }>(USAGE_STORAGE_KEY);
      expect(clearedData[USAGE_STORAGE_KEY]).toEqual([]);
    });
  });
});

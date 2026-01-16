import { DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import { ANALYTICS_FIXTURES } from '../fixtures/test-data';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { analyticsAssertions } from '../utils/assertions';
import { seedLibrary, seedUsageHistory } from '../utils/storage';
import { analyticsWorkflows } from '../utils/workflows';

test.describe('Analytics dashboard', () => {
  test.describe('Dashboard rendering', () => {
    test('renders dashboard with all sections', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Verify dashboard header
      await expect(analyticsPage.getDashboardHeader()).toBeVisible();

      // Verify all sections
      await expect(analyticsPage.getUsageTrendSection()).toBeVisible();
      await expect(analyticsPage.getBreakdownSection()).toBeVisible();
      await expect(analyticsPage.getPromptsSection()).toBeVisible();
    });
  });

  test.describe('Empty state', () => {
    test('shows empty state when no usage data exists', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.EMPTY;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      // No usage history seeded

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.navigateToAnalyticsTab(page);

      // Verify empty state is shown
      await analyticsAssertions.emptyState(page);

      // Verify empty state container is visible
      await expect(analyticsPage.getEmptyState()).toBeVisible();
    });
  });

  test.describe('Charts rendering', () => {
    test('renders usage trend chart section', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Verify usage trend chart section is visible
      await expect(analyticsPage.getUsageTrendSection()).toBeVisible();
    });

    test('renders platform breakdown pie chart section', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.MULTI_PLATFORM;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Verify breakdown section (contains platform pie chart and day of week chart)
      await expect(analyticsPage.getBreakdownSection()).toBeVisible();
    });

    test('renders day of week chart section', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Verify breakdown section which contains day of week data
      await expect(analyticsPage.getBreakdownSection()).toBeVisible();
    });
  });

  test.describe('Tab functionality', () => {
    test('Most Used tab is selected by default', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Verify Most Used tab is selected by default
      await expect(analyticsPage.getTab('Most Used')).toHaveAttribute('aria-selected', 'true');
    });

    test('can switch to Recently Used tab', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Switch to Recently Used tab
      await analyticsPage.switchTab('Recently Used');
      await expect(analyticsPage.getTab('Recently Used')).toHaveAttribute('aria-selected', 'true');

      // Verify tab panel is visible
      await expect(analyticsPage.getTabPanel()).toBeVisible();
    });

    test('can switch to Forgotten tab', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Switch to Forgotten tab
      await analyticsPage.switchTab('Forgotten');
      await expect(analyticsPage.getTab('Forgotten')).toHaveAttribute('aria-selected', 'true');

      // Verify tab panel is visible
      await expect(analyticsPage.getTabPanel()).toBeVisible();
    });

    test('can switch between all tabs', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Start with Most Used (default)
      await expect(analyticsPage.getTab('Most Used')).toHaveAttribute('aria-selected', 'true');

      // Switch to Recently Used
      await analyticsPage.switchTab('Recently Used');
      await expect(analyticsPage.getTab('Recently Used')).toHaveAttribute('aria-selected', 'true');

      // Switch to Forgotten
      await analyticsPage.switchTab('Forgotten');
      await expect(analyticsPage.getTab('Forgotten')).toHaveAttribute('aria-selected', 'true');

      // Switch back to Most Used
      await analyticsPage.switchTab('Most Used');
      await expect(analyticsPage.getTab('Most Used')).toHaveAttribute('aria-selected', 'true');
    });
  });

  test.describe('Back navigation', () => {
    test('back button returns to Analytics tab', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Verify we are on the dashboard
      await expect(analyticsPage.getDashboardHeader()).toBeVisible();

      // Click back button
      await expect(analyticsPage.getBackButton()).toBeVisible();
      await analyticsPage.navigateBack();

      // Verify we are back on the Analytics tab
      await expect(analyticsPage.getAnalyticsHeader()).toBeVisible();
    });

    test('back button is visible on dashboard', async ({ context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      const analyticsPage = new AnalyticsPage(page);
      await analyticsWorkflows.openAnalyticsDashboard(page);

      // Verify back button is visible
      await expect(analyticsPage.getBackButton()).toBeVisible();
    });
  });
});

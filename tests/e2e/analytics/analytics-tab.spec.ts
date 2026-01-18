import { DEFAULT_SETTINGS } from '../../../src/types';
import { test, expect } from '../fixtures/extension';
import {
  CATEGORY_FIXTURES,
  createAnalyticsScenario,
} from '../fixtures/test-data';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { analyticsAssertions } from '../utils/assertions';
import {
  seedLibrary,
  seedUsageHistory,
  createPromptSeed,
  createUsageEventSeed,
} from '../utils/storage';
import { analyticsWorkflows } from '../utils/workflows';

test.describe('Analytics Tab', () => {
  test.describe('Rendering', () => {
    test('renders analytics tab with header', async ({ context, storage, extensionId }) => {
      // Seed with some usage data
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      // Navigate to analytics tab
      await analyticsWorkflows.navigateToAnalyticsTab(page);

      // Verify analytics tab is loaded
      await analyticsAssertions.tabLoaded(page);

      // Verify header is visible
      const analyticsPage = new AnalyticsPage(page);
      await expect(analyticsPage.getAnalyticsHeader()).toBeVisible();
    });
  });

  test.describe('Empty State', () => {
    test('displays empty state when no usage data exists', async ({
      context,
      storage,
      extensionId,
    }) => {
      // Seed with prompts but no usage history
      const prompt = createPromptSeed({
        id: 'empty-state-prompt-1',
        title: 'Unused Prompt',
        content: 'This prompt has never been used',
        category: 'Uncategorized',
      });

      await seedLibrary(storage, {
        prompts: [prompt],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      // No usage history seeded - this creates the empty state

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // Verify empty state message
      await analyticsAssertions.emptyState(page);

      // Verify empty state container is visible
      const analyticsPage = new AnalyticsPage(page);
      await expect(analyticsPage.getEmptyState()).toBeVisible();
    });

    test('displays empty state with no prompts and no usage', async ({
      context,
      storage,
      extensionId,
    }) => {
      // Seed with completely empty state
      await seedLibrary(storage, {
        prompts: [],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);
      await analyticsAssertions.emptyState(page);
    });
  });

  test.describe('Summary Cards', () => {
    test('displays total uses summary card with correct count', async ({
      context,
      storage,
      extensionId,
    }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // Verify total uses (VARIED_USAGE has 8 usage events)
      await analyticsAssertions.totalUses(page, 8);
    });

    test('displays top platform summary card', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // VARIED_USAGE has Claude and ChatGPT as most used platforms
      // Claude appears 4 times, ChatGPT appears 2 times
      await analyticsAssertions.topPlatform(page, 'Claude');
    });

    test('displays top category summary card', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // VARIED_USAGE has Work as the most used category
      await analyticsAssertions.topCategory(page, 'Work');
    });

    test('displays all summary cards for multi-platform usage', async ({
      context,
      storage,
      extensionId,
    }) => {
      const scenario = createAnalyticsScenario('MULTI_PLATFORM');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // Verify summary section is present with expected cards
      const analyticsPage = new AnalyticsPage(page);
      const totalUsesCard = analyticsPage.getSummaryCard('Total Uses');
      const topPlatformCard = analyticsPage.getSummaryCard('Top Platform');
      const topCategoryCard = analyticsPage.getSummaryCard('Top Category');

      await expect(totalUsesCard).toBeVisible();
      await expect(topPlatformCard).toBeVisible();
      await expect(topCategoryCard).toBeVisible();
    });
  });

  test.describe('Top Prompts List', () => {
    test('displays top prompts sorted by usage count', async ({
      context,
      storage,
      extensionId,
    }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // Verify prompts appear in top list
      // 'Work Email Template' has the most uses (4) in VARIED_USAGE
      await analyticsAssertions.promptInTopList(page, 'Work Email Template');
    });

    test('displays correct number of prompts in top list', async ({
      context,
      storage,
      extensionId,
    }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // VARIED_USAGE has 4 prompts used
      await analyticsAssertions.topPromptsCount(page, 4);
    });

    test('displays trophy icons for top prompts', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // Verify trophy icons are visible for top 3 prompts
      await analyticsAssertions.trophyIconsVisible(page);
    });

    test('shows top prompts section with single usage event', async ({
      context,
      storage,
      extensionId,
    }) => {
      const prompt = createPromptSeed({
        id: 'single-usage-prompt',
        title: 'Single Use Prompt',
        content: 'A prompt used only once',
        category: 'Uncategorized',
      });

      const usageEvent = createUsageEventSeed({
        promptId: 'single-usage-prompt',
        timestamp: Date.now() - 3600000,
        platform: 'claude',
        categoryId: null,
      });

      await seedLibrary(storage, {
        prompts: [prompt],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, [usageEvent]);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // Verify the single prompt appears in top list
      await analyticsAssertions.promptInTopList(page, 'Single Use Prompt');
      await analyticsAssertions.topPromptsCount(page, 1);
    });
  });

  test.describe('FAB Visibility', () => {
    test('shows FAB "View Full Dashboard" button in sidepanel with usage data', async ({
      context,
      storage,
      extensionId,
    }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // FAB should be visible in sidepanel when there's data
      await analyticsAssertions.expandButtonVisible(page);
    });

    test('hides FAB in popup mode', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // FAB should be hidden in popup mode
      await analyticsAssertions.expandButtonHidden(page);
    });

    test('hides FAB when no usage data exists (sidepanel)', async ({
      context,
      storage,
      extensionId,
    }) => {
      await seedLibrary(storage, {
        prompts: [],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      // No usage history seeded

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // FAB should be hidden when there's no data (empty state)
      await analyticsAssertions.expandButtonHidden(page);
    });

    test('hides FAB when no usage data exists (popup)', async ({
      context,
      storage,
      extensionId,
    }) => {
      await seedLibrary(storage, {
        prompts: [],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup' },
      });

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/popup.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // FAB should be hidden when there's no data
      await analyticsAssertions.expandButtonHidden(page);
    });
  });

  test.describe('Back Navigation', () => {
    test('navigates back to library from analytics tab', async ({
      context,
      storage,
      extensionId,
    }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      // Navigate to analytics tab
      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // Click back button
      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateBack();

      // Verify we're back on the library page
      await expect(page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
    });

    test('back button is visible in analytics tab', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // Verify back button is visible
      const analyticsPage = new AnalyticsPage(page);
      await expect(analyticsPage.getBackButton()).toBeVisible();
    });

    test('preserves library state after returning from analytics', async ({
      context,
      storage,
      extensionId,
    }) => {
      const prompt = createPromptSeed({
        id: 'persist-prompt-1',
        title: 'Persistent Prompt',
        content: 'This prompt should still be visible after navigation',
        category: 'Work',
      });

      const usageEvent = createUsageEventSeed({
        promptId: 'persist-prompt-1',
        timestamp: Date.now() - 3600000,
        platform: 'claude',
        categoryId: 'work-cat-id',
      });

      await seedLibrary(storage, {
        prompts: [prompt],
        categories: CATEGORY_FIXTURES.BASIC,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, [usageEvent]);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, {
        waitUntil: 'domcontentloaded',
      });

      // Verify prompt is visible initially
      await expect(page.getByRole('heading', { name: 'Persistent Prompt' })).toBeVisible();

      // Navigate to analytics and back
      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateBack();

      // Verify prompt is still visible
      await expect(page.getByRole('heading', { name: 'Persistent Prompt' })).toBeVisible();
    });
  });
});

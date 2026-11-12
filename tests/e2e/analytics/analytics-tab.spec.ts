import { DEFAULT_SETTINGS } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import {
  CATEGORY_FIXTURES,
  createAnalyticsScenario,
} from '../fixtures/test-data';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { analyticsAssertions } from '../utils/assertions';
import {
  createPromptSeed,
  createUsageEventSeed,
  seedLibrary,
  seedUsageHistory,
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

  test.describe('Without usage', () => {
    test('keeps the hero at 0 over its ghost bars, and offers to tidy up the Prompts never used', async ({
      context,
      storage,
      extensionId,
    }) => {
      await seedLibrary(storage, {
        prompts: [createPromptSeed({ id: 'never-used-1', title: 'Unused Prompt', content: 'This prompt has never been used' })],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);
      await analyticsAssertions.tabEmptyState(page);

      const analyticsPage = new AnalyticsPage(page);
      await analyticsAssertions.totalUses(page, 0);
      await expect(analyticsPage.getWeekdayBars()).toHaveCount(0);
      await expect(page.getByTestId('stats-ghost-bar')).toHaveCount(7);
      await expect(analyticsPage.getTidyUp()).toContainText('1 prompt never used');
    });

    test('shows no Tidy up with an empty Library', async ({ context, storage, extensionId }) => {
      await seedLibrary(storage, {
        prompts: [],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabEmptyState(page);
      await expect(new AnalyticsPage(page).getTidyUp()).toBeHidden();
    });
  });

  test.describe('Hero and cards', () => {
    test('count the Insertions of the last 30 days and name the top Platform and Category', async ({
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
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      await analyticsWorkflows.navigateToAnalyticsTab(page);
      await analyticsAssertions.tabLoaded(page);

      // VARIED_USAGE: 8 Insertions, 4 of them on Claude, most in Work
      await analyticsAssertions.totalUses(page, 8);
      await analyticsAssertions.topPlatform(page, 'Claude');
      await analyticsAssertions.topCategory(page, 'Work');

      const analyticsPage = new AnalyticsPage(page);
      await expect(analyticsPage.getWeekdayBars()).toHaveText([/Mon$/, /Tue$/, /Wed$/, /Thu$/, /Fri$/, /Sat$/, /Sun$/]);
      await expect(analyticsPage.getHero().getByRole('img')).toHaveAttribute('aria-label', /^Prompts used per weekday: Monday \d+, .* is the busiest\.$/);
      await expect(analyticsPage.getHeroSubtitle()).toHaveText(/^\w+day is your busiest day\.$/);
    });

    test("hovering a bar shows that weekday's count", async ({ context, storage, extensionId }) => {
      // Two Insertions on the Wednesday of last week
      const wednesday = new Date();
      wednesday.setDate(wednesday.getDate() - ((wednesday.getDay() + 4) % 7) - 7);
      wednesday.setHours(12, 0, 0, 0);
      await seedLibrary(storage, {
        prompts: [createPromptSeed({ id: 'p1', title: 'Weekly Report', content: 'Write the weekly report', usageCount: 2 })],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, [
        createUsageEventSeed({ promptId: 'p1', timestamp: wednesday.getTime(), platform: 'claude', categoryId: null }),
        createUsageEventSeed({ promptId: 'p1', timestamp: wednesday.getTime() + 60_000, platform: 'claude', categoryId: null }),
      ]);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      await analyticsWorkflows.navigateToAnalyticsTab(page);

      const analyticsPage = new AnalyticsPage(page);
      await expect(analyticsPage.getHeroSubtitle()).toHaveText('Wednesday is your busiest day.');
      await analyticsPage.getWeekdayBars().nth(2).hover();
      await expect(analyticsPage.getHeroSubtitle()).toHaveText('2 on Wednesdays');
    });

    test('under reduced motion the total shows its value at once', async ({ context, storage, extensionId }) => {
      const scenario = createAnalyticsScenario('VARIED_USAGE');
      await seedLibrary(storage, {
        prompts: scenario.prompts,
        categories: scenario.categories,
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, scenario.usageHistory);

      const page = await context.newPage();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      await analyticsWorkflows.navigateToAnalyticsTab(page);

      const analyticsPage = new AnalyticsPage(page);
      await expect(analyticsPage.getHeroTotal()).toHaveText('8', { timeout: 200 });
      const barAnimation = await analyticsPage.getWeekdayBars().first().locator('.animate-bar-grow')
        .evaluate(element => getComputedStyle(element).animationDuration);
      expect(barAnimation).toBe('0.001s');
    });
  });

  test.describe('Most used', () => {
    test('ranks the three Prompts used most in the last 30 days, and offers View all', async ({
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
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });

      await analyticsWorkflows.navigateToAnalyticsTab(page);

      // VARIED_USAGE uses 4 Prompts; 'Work Email Template' most
      const analyticsPage = new AnalyticsPage(page);
      await expect(analyticsPage.getMostUsedRows()).toHaveCount(3);
      await expect(analyticsPage.getMostUsedRows().first()).toContainText('Work Email Template');
      await expect(analyticsPage.getMostUsedCard().getByRole('button', { name: 'View all' })).toBeVisible();
    });

    test('a row opens its Prompt in the editor', async ({ context, storage, extensionId }) => {
      await seedLibrary(storage, {
        prompts: [createPromptSeed({ id: 'single-usage-prompt', title: 'Single Use Prompt', content: 'A prompt used only once', usageCount: 1 })],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });
      await seedUsageHistory(storage, [
        createUsageEventSeed({ promptId: 'single-usage-prompt', timestamp: Date.now() - 3600000, platform: 'claude', categoryId: null }),
      ]);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      await analyticsWorkflows.navigateToAnalyticsTab(page);

      await analyticsAssertions.mostUsedTitles(page, ['Single Use Prompt']);
      await expect(new AnalyticsPage(page).getMostUsedCard().getByRole('button', { name: 'View all' })).toBeHidden();

      await page.getByRole('button', { name: 'Single Use Prompt, 1 use. Open' }).click();
      await expect(page.getByRole('heading', { name: 'Edit prompt', exact: true })).toBeVisible();
      await expect(page.getByLabel('Title')).toHaveValue('Single Use Prompt');
    });
  });

  test.describe('Tidy up', () => {
    test('Review opens the Library on the Prompts never used, and its chip returns to All', async ({
      context,
      storage,
      extensionId,
    }) => {
      await seedLibrary(storage, {
        prompts: [
          createPromptSeed({ id: 'used', title: 'Used Prompt', content: 'Used every day', usageCount: 3 }),
          createPromptSeed({ id: 'unused-1', title: 'Forgotten Draft', content: 'Never sent anywhere' }),
          createPromptSeed({ id: 'unused-2', title: 'Old Idea', content: 'Still waiting for its turn' }),
        ],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      await analyticsWorkflows.navigateToAnalyticsTab(page);

      const tidyUp = new AnalyticsPage(page).getTidyUp();
      await expect(tidyUp).toContainText('2 prompts never used');
      await tidyUp.getByRole('button', { name: 'Review the 2 prompts never used' }).click();

      await expect(page.getByRole('radio', { name: 'Never used' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('prompt-card')).toHaveCount(2);
      await expect(page.getByTestId('prompt-card').filter({ hasText: 'Used Prompt' })).toHaveCount(0);

      await page.getByRole('button', { name: 'Clear the Never used filter' }).click();
      await expect(page.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('radio', { name: 'Never used' })).toHaveCount(0);
      await expect(page.getByTestId('prompt-card')).toHaveCount(3);
    });

    test('Review opens the Library on the Prompts of the Duplicate pairs', async ({ context, storage, extensionId }) => {
      await seedLibrary(storage, {
        prompts: [
          createPromptSeed({ id: 'email-1', title: 'Email Drafts', content: 'Write a concise email to {{recipient}}.', usageCount: 2 }),
          createPromptSeed({ id: 'email-2', title: 'Email Drafts', content: 'Write a concise email to {{recipient}}.', usageCount: 1 }),
          createPromptSeed({ id: 'other', title: 'Release Notes', content: 'Summarise these commits as release notes', usageCount: 1 }),
        ],
        categories: [],
        settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
      });

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
      await analyticsWorkflows.navigateToAnalyticsTab(page);

      const tidyUp = new AnalyticsPage(page).getTidyUp();
      await expect(tidyUp).toContainText('1 duplicate pair');
      await expect(tidyUp).not.toContainText('never used');
      await tidyUp.getByRole('button', { name: 'Review the 1 duplicate pair' }).click();

      await expect(page.getByRole('radio', { name: 'Possible duplicates' })).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('prompt-card')).toHaveCount(2);
      await expect(page.getByTestId('prompt-card').filter({ hasText: 'Release Notes' })).toHaveCount(0);
    });
  });

  test.describe('Full Dashboard button Visibility', () => {
    test('shows Full Dashboard button "View Full Dashboard" button in sidepanel with usage data', async ({
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

      // Full Dashboard button should be visible in sidepanel when there's data
      await analyticsAssertions.expandButtonVisible(page);
    });

    test('hides Full Dashboard button in popup mode', async ({ context, storage, extensionId }) => {
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

      // Full Dashboard button should be hidden in popup mode
      await analyticsAssertions.expandButtonHidden(page);
    });

    test('hides Full Dashboard button when no usage data exists (sidepanel)', async ({
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

      // Full Dashboard button should be hidden when there's no data (empty state)
      await analyticsAssertions.expandButtonHidden(page);
    });

    test('hides Full Dashboard button when no usage data exists (popup)', async ({
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

      // Full Dashboard button should be hidden when there's no data
      await analyticsAssertions.expandButtonHidden(page);
    });
  });

  test.describe('Tab Navigation', () => {
    test('navigates to library from analytics via the Library tab', async ({
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

      // Switch to the Library tab
      const analyticsPage = new AnalyticsPage(page);
      await analyticsPage.navigateToLibrary();

      // Verify we're back on the library page
      await expect(page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
    });

    test('analytics section has no back button and its tab is selected', async ({ context, storage, extensionId }) => {
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

      // Sections are switched via the tab bar, so there is no back button
      const analyticsPage = new AnalyticsPage(page);
      await expect(analyticsPage.getBackButton()).toHaveCount(0);
      await expect(analyticsPage.getSectionTab('analytics')).toHaveAttribute('aria-selected', 'true');
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
      await analyticsPage.navigateToLibrary();

      // Verify prompt is still visible
      await expect(page.getByRole('heading', { name: 'Persistent Prompt' })).toBeVisible();
    });
  });
});

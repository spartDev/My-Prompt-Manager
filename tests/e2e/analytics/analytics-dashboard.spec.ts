/**
 * E2E: the full-page Analytics view (My-Prompt-Manager-160), opened from the Analytics tab. It shows
 * the tab's design at the width of a page, and Review in Tidy up opens the side panel of the window on
 * the Library filter, whatever the interface mode.
 */

import type { BrowserContext, Page } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { ANALYTICS_FIXTURES } from '../fixtures/test-data';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { analyticsAssertions } from '../utils/assertions';
import { createPromptSeed, seedLibrary, seedUsageHistory } from '../utils/storage';
import { analyticsWorkflows } from '../utils/workflows';

const SCREENSHOT_DIR = 'test-results/analytics-dashboard';

/**
 * What the real side panel shows. Playwright does not list the side panel among the pages, so it is
 * read over the DevTools protocol: its target is attached to and asked for its text.
 */
const sidePanelText = async (context: BrowserContext, page: Page): Promise<string | null> => {
  const cdp = await context.newCDPSession(page);
  try {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const panel = targetInfos.find(target => target.type === 'page' && target.url.endsWith('/src/sidepanel.html'));
    if (!panel) {
      return null;
    }
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: panel.targetId, flatten: false });
    const answer = new Promise<string>(resolve => {
      cdp.on('Target.receivedMessageFromTarget', event => {
        const message = JSON.parse(event.message) as { id?: number; result?: { result?: { value?: string } } };
        if (event.sessionId === sessionId && message.id === 1) {
          resolve(message.result?.result?.value ?? '');
        }
      });
    });
    await cdp.send('Target.sendMessageToTarget', {
      sessionId,
      message: JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: 'document.body.innerText', returnByValue: true } })
    });
    return await answer;
  } finally {
    await cdp.detach();
  }
};

test.describe('Full-page Analytics view', () => {
  test('opens from the tab with the hero, the stat cards, Most used, the rankings and the charts', async ({ context, storage, extensionId }) => {
    const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
    await seedLibrary(storage, {
      prompts: scenario.prompts,
      categories: scenario.categories,
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' }
    });
    await seedUsageHistory(storage, scenario.usageHistory);

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
    const dashboardPage = await analyticsWorkflows.openAnalyticsDashboard(page);
    const analytics = new AnalyticsPage(dashboardPage);

    await analyticsAssertions.dashboardLoaded(dashboardPage);
    await expect(dashboardPage.getByText('Last 30 days', { exact: true })).toBeVisible();
    await expect(analytics.getHero()).toBeVisible();
    await expect(analytics.getHeroTotal()).toHaveText(String(scenario.usageHistory.length));
    await expect(analytics.getWeekdayBars()).toHaveCount(7);
    await expect(analytics.getStatCard('Top platform')).toBeVisible();
    await expect(analytics.getStatCard('Top category')).toBeVisible();
    await expect(analytics.getMostUsedCard()).toBeVisible();
    await expect(analytics.getRankedCard('Platforms')).toBeVisible();
    await expect(analytics.getRankedCard('Categories')).toBeVisible();
    await expect(analytics.getChartCard('Daily use')).toBeVisible();
    await expect(analytics.getChartCard('Time of day')).toBeVisible();
  });

  test('Most used ranks the Prompts in rows that are read, with no Recently Used or Forgotten tab', async ({ page, storage, extensionId }) => {
    const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
    await seedLibrary(storage, { prompts: scenario.prompts, categories: scenario.categories });
    await seedUsageHistory(storage, scenario.usageHistory);
    await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
    const analytics = new AnalyticsPage(page);

    const rows = analytics.getMostUsedRows();
    await expect(rows.first()).toBeVisible();
    const counts = await rows.locator('.sr-only').allTextContents();
    const uses = counts.map(text => Number.parseInt(text, 10));
    expect(uses.length).toBeGreaterThan(1);
    expect(uses, 'most used first').toEqual([...uses].sort((a, b) => b - a));
    // Each row says its Category and when it was last used
    await expect(rows.first()).toContainText(/ · (Just now|\d+[mhd] ago)/);

    await expect(analytics.getMostUsedCard().getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByText(/forgotten|recently used/i)).toHaveCount(0);
  });

  test('with no usage yet, the tab offers no way to the full-page view', async ({ context, storage, extensionId }) => {
    const scenario = ANALYTICS_FIXTURES.EMPTY;
    await seedLibrary(storage, {
      prompts: scenario.prompts,
      categories: scenario.categories,
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' }
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
    const analytics = new AnalyticsPage(page);
    await analyticsWorkflows.navigateToAnalyticsTab(page);

    await analyticsAssertions.tabEmptyState(page);
    await expect(analytics.getExpandDashboardButton()).toBeHidden();
  });

  test('with no usage yet, the full-page view shows the hero at zero and Tidy up', async ({ page, storage, extensionId }) => {
    await seedLibrary(storage, { prompts: [createPromptSeed({ id: 'idle', title: 'Never inserted' })], categories: ANALYTICS_FIXTURES.EMPTY.categories });
    await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
    const analytics = new AnalyticsPage(page);

    await expect(analytics.getHeroSubtitle()).toHaveText('No Prompts used yet.');
    await expect(analytics.getTidyUp()).toContainText('1 prompt never used');
    await expect(analytics.getMostUsedCard()).toHaveCount(0);
    await expect(analytics.getChartCard('Daily use')).toHaveCount(0);
  });

  for (const interfaceMode of ['sidepanel', 'popup'] as const) {
    test(`Review opens the side panel on the Never used Prompts (interface mode: ${interfaceMode})`, async ({ page, context, storage, extensionId }) => {
      const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
      const used = scenario.prompts.map(prompt => ({ ...prompt, usageCount: 1 }));
      const idle = createPromptSeed({ id: 'idle', title: 'Quarterly Review Draft', content: 'Nothing like the others', category: 'Work' });
      await seedLibrary(storage, { prompts: [...used, idle], categories: scenario.categories });
      await storage.seed({ interfaceMode });
      await seedUsageHistory(storage, scenario.usageHistory);
      await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
      const analytics = new AnalyticsPage(page);

      expect(await sidePanelText(context, page), 'no side panel before Review').toBeNull();
      await analytics.getReviewButton(/never used/).click();

      // The side panel of the window opens on the Library, filtered to the one Prompt never inserted
      await expect.poll(() => sidePanelText(context, page), 'the side panel lists the Never used Prompt').toContain('Quarterly Review Draft');
      const panel = await sidePanelText(context, page);
      expect(panel).toContain('Never used');
      expect(panel, 'a used Prompt is filtered out').not.toContain(used[0].title);
      await expect(page.getByRole('alert')).toHaveCount(0);
      // The review was taken: none waits for another opening
      expect(await page.evaluate(() => chrome.storage.session.get('pendingLibraryReview'))).toEqual({});
    });
  }

  test('Review opens the side panel on the Duplicate pairs', async ({ page, context, storage, extensionId }) => {
    const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
    const used = scenario.prompts.map(prompt => ({ ...prompt, usageCount: 1 }));
    const twin = { title: 'Standup Summary', content: 'Summarize what the team did yesterday and what blocks it today.', category: 'Work', usageCount: 1 };
    await seedLibrary(storage, {
      prompts: [...used, createPromptSeed({ id: 'twin-1', ...twin }), createPromptSeed({ id: 'twin-2', ...twin })],
      categories: scenario.categories
    });
    await seedUsageHistory(storage, scenario.usageHistory);
    await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
    const analytics = new AnalyticsPage(page);

    await expect(analytics.getTidyUp()).toContainText('1 duplicate pair');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/tidy-up.png` });
    await analytics.getReviewButton(/duplicate pair/).click();

    await expect.poll(() => sidePanelText(context, page)).toContain('Standup Summary');
    const panel = await sidePanelText(context, page);
    expect(panel).toContain('Possible duplicates');
    expect(panel, 'a Prompt in no Duplicate pair is filtered out').not.toContain(used[0].title);
  });

  test('the back button closes the full-page view', async ({ context, storage, extensionId }) => {
    const scenario = ANALYTICS_FIXTURES.VARIED_USAGE;
    await seedLibrary(storage, {
      prompts: scenario.prompts,
      categories: scenario.categories,
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' }
    });
    await seedUsageHistory(storage, scenario.usageHistory);

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
    const dashboardPage = await analyticsWorkflows.openAnalyticsDashboard(page);
    const analytics = new AnalyticsPage(dashboardPage);

    await expect(analytics.getBackButton()).toBeVisible();
    await Promise.all([dashboardPage.waitForEvent('close'), analytics.navigateBack()]);
    expect(dashboardPage.isClosed()).toBe(true);
  });
});

/**
 * E2E: the cards and charts of the full-page Analytics view (My-Prompt-Manager-160)
 *
 * The page is the Analytics tab's design at the width of a page: it fits a 360 px window and a
 * 1440 px screen with no horizontal scroll, its charts stay inside their cards, the Categories card
 * ranks each Category with its own color, and Daily use ends on today's local day, the Insertions
 * just after midnight included (My-Prompt-Manager-qqj). Also captures light/dark screenshots, narrow
 * and wide, as visual proof (test-results/analytics-charts/).
 */

import type { Page } from '@playwright/test';

import { DEFAULT_CATEGORY_COLOR } from '../../../src/theme/categoryChip';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createUsageEventSeed } from '../fixtures/test-data';
import { createCategorySeed, createPromptSeed, seedLibrary, seedUsageHistory } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/analytics-charts';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const LONG_NAME = 'Customer Support Escalations';

// Tall enough to show every card in one screenshot
const WIDE = { width: 1440, height: 1200 };
const NARROW = { width: 360, height: 800 };

const categories = [
  createCategorySeed({ name: 'Work', color: '#9333EA' }), // Purple
  createCategorySeed({ name: 'Development', color: '#0F766E' }), // Teal
  createCategorySeed({ name: 'Personal', color: '#C2410C' }), // Orange
  createCategorySeed({ name: LONG_NAME, color: '#DB2777' }) // Pink
];

const prompts = [
  createPromptSeed({ id: 'prompt-work', title: 'Work Email', category: 'Work', usageCount: 4 }),
  createPromptSeed({ id: 'prompt-dev', title: 'Code Review', category: 'Development', usageCount: 3 }),
  createPromptSeed({ id: 'prompt-personal', title: 'Recipe Finder', category: 'Personal', usageCount: 2 }),
  createPromptSeed({ id: 'prompt-support', title: 'Escalation Reply', category: LONG_NAME, usageCount: 1 }),
  // Its Category no longer exists
  createPromptSeed({ id: 'prompt-orphan', title: 'Old Checklist', category: 'Archived', usageCount: 1 }),
  createPromptSeed({ id: 'prompt-idle', title: 'Quarterly Review Draft', category: 'Work', usageCount: 0 })
];

/** Work 4 uses (3 of them today just after local midnight), Development 3, Personal 2, the long-named Category 1, Archived 1 */
const TODAY_USES = 3;
const usageHistory = () => {
  const now = Date.now();
  const justAfterMidnight = new Date(now).setHours(0, 30, 0, 0);
  const use = (promptId: string, timestamp: number, platform = 'claude') => createUsageEventSeed({ promptId, timestamp, platform });

  return [
    ...Array.from({ length: TODAY_USES }, (_, index) => use('prompt-work', justAfterMidnight + index * MINUTE)),
    use('prompt-work', now - 1 * DAY),
    use('prompt-dev', now - 1 * DAY, 'chatgpt'),
    use('prompt-dev', now - 2 * DAY, 'chatgpt'),
    use('prompt-dev', now - 2 * DAY - MINUTE),
    use('prompt-personal', now - 3 * DAY, 'gemini'),
    use('prompt-personal', now - 3 * DAY - MINUTE),
    use('prompt-support', now - 5 * DAY),
    use('prompt-orphan', now - 6 * DAY)
  ];
};

const openDashboard = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  theme: 'light' | 'dark',
  viewport = WIDE
) => {
  await seedLibrary(storage, { prompts, categories, settings: { theme } });
  await seedUsageHistory(storage, usageHistory());
  await page.setViewportSize(viewport);
  await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
  await expect(page.getByTestId('stats-hero')).toBeVisible();
};

/** The color a #RRGGBB Category color is painted with */
const rgbOf = (hex: string) => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

/** Lets the entry animations finish (the rank bars take the longest), so the bars are at full size */
const settle = async (page: Page) => {
  await expect(page.getByTestId('daily-use-chart').getByTestId('chart-pill').first()).toBeVisible();
  await page.waitForTimeout(1800);
};

/** Nothing is wider than the window: neither the page nor its scroll container scrolls sideways */
const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main');
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0
    };
  });
  expect(overflow).toEqual({ page: 0, main: 0 });
};

test.describe('Full-page Analytics cards and charts', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`the page fits a wide screen in a grid, and each chart stays inside its card (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);
      await expectNoHorizontalScroll(page);

      // Most used at the left of Top platform, Top category and Tidy up
      const [mostUsed, tidyUp, hero] = await Promise.all([
        page.getByRole('region', { name: 'Most used' }).boundingBox(),
        page.getByTestId('tidy-up').boundingBox(),
        page.getByTestId('stats-hero').boundingBox()
      ]);
      if (!mostUsed || !tidyUp || !hero) { throw new Error('a card is not drawn'); }
      expect(mostUsed.x + mostUsed.width, 'Most used left of Tidy up').toBeLessThanOrEqual(tidyUp.x);
      expect(hero.width, 'the content keeps to a 1100px column').toBeLessThanOrEqual(1100);

      for (const id of ['daily-use', 'time-of-day']) {
        const card = page.getByTestId(id);
        const [cardBox, chartBox] = await Promise.all([card.boundingBox(), card.getByRole('img').boundingBox()]);
        if (!cardBox || !chartBox) { throw new Error(`${id} is not drawn`); }
        expect(chartBox.x, `${id} chart inside its card`).toBeGreaterThanOrEqual(cardBox.x);
        expect(chartBox.x + chartBox.width, `${id} chart inside its card`).toBeLessThanOrEqual(cardBox.x + cardBox.width);
      }

      await settle(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-wide-${theme}.png` });
    });

    test(`the page fits a 360 px window in one column, in the tab's order (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme, NARROW);
      await expectNoHorizontalScroll(page);

      const tops = await Promise.all([
        page.getByTestId('stats-hero'),
        page.getByRole('heading', { name: 'Top platform' }),
        page.getByRole('region', { name: 'Most used' }),
        page.getByTestId('tidy-up'),
        page.getByRole('region', { name: 'Platforms' }),
        page.getByRole('region', { name: 'Categories' }),
        page.getByTestId('daily-use'),
        page.getByTestId('time-of-day')
      ].map(async locator => (await locator.evaluate(element => element.getBoundingClientRect().top))));
      expect(tops, 'one column, each card under the one before').toEqual([...tops].sort((a, b) => a - b));

      await settle(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-narrow-${theme}.png` });
      await page.getByTestId('time-of-day').scrollIntoViewIfNeeded();
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-narrow-bottom-${theme}.png` });
    });

    test(`the Categories card ranks each Category with its own color, the default Category color once the Category no longer exists (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);

      const card = page.getByRole('region', { name: 'Categories' });
      const rows = card.getByTestId('ranked-row');
      await expect(rows).toHaveCount(5);
      await expect(rows.nth(0)).toContainText('Work');
      await expect(rows.nth(0)).toContainText('4 uses');
      await expect(rows.nth(1)).toContainText('Development');
      await expect(rows.nth(2)).toContainText('Personal');

      // A stored Category shows its color as a dot; "Archived" is no longer stored and takes the default Category color
      const dots = await card.locator('li span[style*="background-color"]').evaluateAll(spans => spans.map(span => getComputedStyle(span).backgroundColor));
      const storedColor = (name: string) => categories.find(category => category.name === name)?.color ?? '';
      expect(dots).toEqual([...['Work', 'Development', 'Personal', LONG_NAME].map(storedColor), DEFAULT_CATEGORY_COLOR].map(rgbOf));

      // A long name is cut with an ellipsis inside its row
      const longRow = rows.filter({ hasText: LONG_NAME });
      const [rowBox, cardBox] = await Promise.all([longRow.boundingBox(), card.boundingBox()]);
      if (!rowBox || !cardBox) { throw new Error('the long row is not drawn'); }
      expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);

      await settle(page);
      await card.screenshot({ path: `${SCREENSHOT_DIR}/categories-${theme}.png` });
    });

    test(`the Platforms card ranks the Platforms, the first one being Top platform (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);

      const rows = page.getByRole('region', { name: 'Platforms' }).getByTestId('ranked-row');
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText('Claude');
      await expect(rows.nth(0)).toContainText('8 uses');
      await expect(rows.nth(1)).toContainText('ChatGPT');
      await expect(rows.nth(2)).toContainText('Gemini');
      // The bar of a row is sized against the first
      const widths = await rows.locator('.animate-rank-fill').evaluateAll(bars => bars.map(bar => (bar as HTMLElement).style.width));
      expect(widths).toEqual(['100%', '25%', '13%']);
    });

    test(`Daily use ends on today, with the Insertions just after local midnight, and says so without a pointer (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);
      await settle(page);

      const card = page.getByTestId('daily-use');
      await expect(card).toContainText('Used on 6 of the last 30 days.');
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      await expect(card.getByRole('img')).toHaveAccessibleName(
        `Prompts used per day over the last 30 days: 11 in all. The busiest day is ${today}, with ${String(TODAY_USES)}.`
      );

      await card.getByTestId('chart-bar').last().hover();
      const tooltip = card.getByTestId('chart-tooltip');
      await expect(tooltip).toHaveText(`${today} ${String(TODAY_USES)} uses`);
      const [tooltipBox, cardBox] = await Promise.all([tooltip.boundingBox(), card.boundingBox()]);
      if (!tooltipBox || !cardBox) { throw new Error('the tooltip is not drawn'); }
      expect(tooltipBox.x + tooltipBox.width, 'the tooltip of the last day stays inside its card').toBeLessThanOrEqual(cardBox.x + cardBox.width);
      await card.screenshot({ path: `${SCREENSHOT_DIR}/daily-use-tooltip-${theme}.png` });
    });

    test(`Time of day names the busiest time and every count (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);

      const card = page.getByTestId('time-of-day');
      await expect(card.getByRole('img')).toHaveAccessibleName(/^Prompts used per time of day: Morning \d+, Afternoon \d+, Evening \d+, Night \d+\. \w+ is the busiest\.$/);
      await expect(card).toContainText(/is your busiest time\./);
      await expect(card.getByTestId('chart-pill')).toHaveCount(4);
      await expect(card.getByTestId('chart-axis-label')).toHaveText(['Morning', 'Afternoon', 'Evening', 'Night']);
    });
  }
});

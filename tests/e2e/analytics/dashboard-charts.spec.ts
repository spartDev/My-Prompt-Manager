/**
 * E2E: the full dashboard's charts are readable at 1280 px (My-Prompt-Manager-nvg)
 *
 * The Y axis tick labels of the Usage trend, Day of Week, Time of Day and Categories charts lie fully
 * inside their chart (the SVG clips what overflows it, and the SVG sits inside its card), and the
 * Categories chart names each Category, truncating a long name with an ellipsis and showing it in full
 * in the Tooltip. The Usage trend ends on today's local day, the insertions just after midnight
 * included (My-Prompt-Manager-qqj). Also captures light/dark screenshots as visual proof
 * (test-results/analytics-charts/).
 */

import type { Locator, Page } from '@playwright/test';

import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { CATEGORY_FIXTURES, createUsageEventSeed } from '../fixtures/test-data';
import { createCategorySeed, createPromptSeed, seedLibrary, seedUsageHistory } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/analytics-charts';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const LONG_NAME = 'Customer Support Escalations';

const categories = [...CATEGORY_FIXTURES.COMPREHENSIVE, createCategorySeed({ name: LONG_NAME, color: '#EC4899' })];

const prompts = [
  createPromptSeed({ id: 'prompt-work', title: 'Work Email', category: 'Work' }),
  createPromptSeed({ id: 'prompt-dev', title: 'Code Review', category: 'Development' }),
  createPromptSeed({ id: 'prompt-personal', title: 'Recipe Finder', category: 'Personal' }),
  createPromptSeed({ id: 'prompt-support', title: 'Escalation Reply', category: LONG_NAME })
];

/** Work 4 uses (3 of them today just after local midnight), Development 3, Personal 2, the long-named Category 1 */
const TODAY_USES = 3;
const usageHistory = () => {
  const now = Date.now();
  const justAfterMidnight = new Date(now).setHours(0, 30, 0, 0);
  const use = (promptId: string, timestamp: number) => createUsageEventSeed({ promptId, timestamp });

  return [
    ...Array.from({ length: TODAY_USES }, (_, index) => use('prompt-work', justAfterMidnight + index * MINUTE)),
    use('prompt-work', now - 1 * DAY),
    use('prompt-dev', now - 1 * DAY),
    use('prompt-dev', now - 2 * DAY),
    use('prompt-dev', now - 2 * DAY - MINUTE),
    use('prompt-personal', now - 3 * DAY),
    use('prompt-personal', now - 3 * DAY - MINUTE),
    use('prompt-support', now - 5 * DAY)
  ];
};

const openDashboard = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark') => {
  await seedLibrary(storage, { prompts, categories, settings: { theme } });
  await seedUsageHistory(storage, usageHistory());
  // Tall enough to show every chart in one screenshot
  await page.setViewportSize({ width: 1280, height: 1250 });
  await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

/** The card around a chart: the Usage trend's, or a breakdown card found by its heading */
const chartCard = (page: Page, title: string) =>
  title === 'Usage Trend'
    ? page.getByRole('region', { name: 'Usage trend' }).locator('div').first()
    : page.getByRole('region', { name: 'Usage breakdown' }).locator('div').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).last();

const yTicksOf = (card: Locator) => card.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value');

/** Lets the recharts entry animations (1.5 s, reduced motion not honored) finish, so the bars are at full size */
const settleCharts = async (page: Page) => {
  await expect(page.locator('.recharts-pie-sector').first()).toBeVisible();
  await page.waitForTimeout(1600);
};

test.describe('Analytics dashboard charts', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`the Y axis tick labels lie inside their chart (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);

      for (const title of ['Usage Trend', 'Day of Week', 'Time of Day', 'Categories']) {
        const card = chartCard(page, title);
        const ticks = yTicksOf(card);
        await expect(ticks.first(), `${title} draws its Y axis`).toBeVisible();

        const [cardBox, chartBox] = await Promise.all([card.boundingBox(), card.locator('svg.recharts-surface').first().boundingBox()]);
        expect(cardBox, `${title} card box`).not.toBeNull();
        expect(chartBox, `${title} chart box`).not.toBeNull();
        if (!cardBox || !chartBox) { return; }
        expect(chartBox.x, `${title} chart inside its card`).toBeGreaterThanOrEqual(cardBox.x);
        expect(chartBox.x + chartBox.width, `${title} chart inside its card`).toBeLessThanOrEqual(cardBox.x + cardBox.width);

        for (const tick of await ticks.all()) {
          const label = await tick.textContent();
          const box = await tick.boundingBox();
          expect(box, `${title} tick ${String(label)} box`).not.toBeNull();
          if (!box) { return; }
          expect(box.x, `${title} tick ${String(label)} starts inside the chart`).toBeGreaterThanOrEqual(chartBox.x);
          expect(box.x + box.width, `${title} tick ${String(label)} ends inside the chart`).toBeLessThanOrEqual(chartBox.x + chartBox.width);
        }
      }
    });

    test(`the Categories chart names each Category, a long name truncated with an ellipsis and in full in its Tooltip (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);

      const card = chartCard(page, 'Categories');
      const ticks = yTicksOf(card);
      await expect(ticks).toHaveCount(4);
      await expect(ticks.nth(0)).toHaveText('Work');
      await expect(ticks.nth(1)).toHaveText('Development');
      await expect(ticks.nth(2)).toHaveText('Personal');
      const truncated = (await ticks.nth(3).textContent()) ?? '';
      expect(truncated, 'long name truncated with an ellipsis').toMatch(/^Customer .*…$/);
      expect(truncated.length, 'long name truncated').toBeLessThan(LONG_NAME.length);

      await settleCharts(page);
      await card.locator('.recharts-bar-rectangle path').nth(3).hover();
      await expect(card.locator('.recharts-tooltip-label')).toHaveText(LONG_NAME);
      await expect(card.locator('.recharts-tooltip-item')).toHaveText('Uses : 1');
      await card.screenshot({ path: `${SCREENSHOT_DIR}/categories-tooltip-${theme}.png` });
    });

    test(`the Usage trend ends on today, with the insertions just after local midnight (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);
      await settleCharts(page);

      const card = chartCard(page, 'Usage Trend');
      const surface = card.locator('svg.recharts-surface').first();
      const width = (await surface.boundingBox())?.width ?? 0;
      await surface.hover({ position: { x: width - 12, y: 120 } });
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      await expect(card.locator('.recharts-tooltip-label')).toHaveText(today);
      await expect(card.locator('.recharts-tooltip-item')).toHaveText(`Uses : ${String(TODAY_USES)}`);

      await card.screenshot({ path: `${SCREENSHOT_DIR}/usage-trend-${theme}.png` });
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-${theme}.png` });
    });
  }
});

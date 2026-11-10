/**
 * E2E: an Analytics chart's Tooltip closes when the pointer leaves the chart (recharts#7876)
 *
 * Recharts 3 handles a mousemove on the next animation frame and does not cancel that frame on mouseleave. When the
 * last move and the leave land in the same frame, the leave closes the Tooltip, then the pending move opens it again,
 * and it stays open until the chart is hovered again.
 */

import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures/extension';
import { ANALYTICS_FIXTURES } from '../fixtures/test-data';
import { seedLibrary, seedUsageHistory } from '../utils/storage';

const CHARTS: Array<[name: string, chart: (page: Page) => Locator]> = [
  ['Daily use', page => page.getByTestId('daily-use').locator('.recharts-wrapper')],
  ['Time of day', page => page.getByTestId('time-of-day').locator('.recharts-wrapper')]
];

const tooltipShown = (chart: Locator) =>
  chart.evaluate(wrapper => {
    const tooltip = wrapper.querySelector('.recharts-tooltip-wrapper');
    return tooltip !== null && getComputedStyle(tooltip).visibility === 'visible';
  });

const twoFrames = (page: Page) =>
  page.evaluate(() => new Promise<void>(resolve => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(); }); }); }));

/** A move inside the chart, at 40% of its width */
const moveInside = (chart: Locator) =>
  chart.evaluate(wrapper => {
    const box = wrapper.getBoundingClientRect();
    wrapper.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: box.left + box.width * 0.4, clientY: box.top + box.height / 2 }));
  });

/** In one task, as when the pointer crosses the chart's edge within one frame: a last move inside, then the leave */
const moveInsideThenLeave = (chart: Locator) =>
  chart.evaluate(wrapper => {
    const box = wrapper.getBoundingClientRect();
    wrapper.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: box.left + box.width * 0.4, clientY: box.top + box.height / 2 }));
    wrapper.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, clientX: box.right + 100, clientY: box.top }));
    wrapper.dispatchEvent(new MouseEvent('mouseleave', { clientX: box.right + 100, clientY: box.top }));
  });

test.describe('Analytics chart Tooltips', () => {
  for (const [name, chartOf] of CHARTS) {
    test(`the ${name} Tooltip stays closed when the pointer leaves in the frame it last moved in`, async ({ page, storage, extensionId }) => {
      const { prompts, categories, usageHistory } = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, { prompts, categories });
      await seedUsageHistory(storage, usageHistory);
      await page.setViewportSize({ width: 1280, height: 1200 });
      await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
      const chart = chartOf(page);

      // Hovering opens the Tooltip (retried until the chart is drawn)
      await expect.poll(async () => {
        await moveInside(chart);
        await twoFrames(page);
        return tooltipShown(chart);
      }).toBe(true);

      await moveInsideThenLeave(chart);

      await twoFrames(page);
      expect.soft(await tooltipShown(chart), 'Tooltip two frames after the leave').toBe(false);
      // The Tooltip must not come back later either: nothing re-renders the chart without a new pointer event
      await page.waitForTimeout(500);
      expect(await tooltipShown(chart), 'Tooltip 500 ms after the leave').toBe(false);
    });
  }
});

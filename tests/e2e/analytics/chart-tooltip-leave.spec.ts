/**
 * E2E: an Analytics chart's tooltip closes when the pointer leaves the chart
 *
 * Recharts 3 handled a mousemove on the next animation frame and did not cancel that frame on mouseleave: when the
 * last move and the leave landed in the same frame, the tooltip came back and stayed open until the next hover
 * (recharts#7876). The charts are hand-built since My-Prompt-Manager-qbi; this spec keeps that case covered.
 */

import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures/extension';
import { ANALYTICS_FIXTURES } from '../fixtures/test-data';
import { seedLibrary, seedUsageHistory } from '../utils/storage';

const CHARTS: Array<[name: string, card: (page: Page) => Locator]> = [
  ['Daily use', page => page.getByTestId('daily-use')],
  ['Time of day', page => page.getByTestId('time-of-day')]
];

const tooltipShown = (card: Locator) => card.getByTestId('chart-tooltip').isVisible();

const twoFrames = (page: Page) =>
  page.evaluate(() => new Promise<void>(resolve => { requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(); }); }); }));

/** The pointer enters the bar at 40% of the chart's width */
const moveInside = (card: Locator) =>
  card.getByRole('img').evaluate(chart => {
    const bars = chart.querySelectorAll('[data-testid="chart-bar"]');
    const bar = bars[Math.floor(bars.length * 0.4)];
    bar.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
  });

/** In one task, as when the pointer crosses the chart's edge within one frame: it enters a bar, then leaves the chart */
const moveInsideThenLeave = (card: Locator) =>
  card.getByRole('img').evaluate(chart => {
    const bars = chart.querySelectorAll('[data-testid="chart-bar"]');
    const bar = bars[Math.floor(bars.length * 0.4)];
    bar.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: document.body }));
    bar.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
  });

test.describe('Analytics chart tooltips', () => {
  for (const [name, cardOf] of CHARTS) {
    test(`the ${name} tooltip stays closed when the pointer leaves in the frame it last moved in`, async ({ page, storage, extensionId }) => {
      const { prompts, categories, usageHistory } = ANALYTICS_FIXTURES.VARIED_USAGE;
      await seedLibrary(storage, { prompts, categories });
      await seedUsageHistory(storage, usageHistory);
      await page.setViewportSize({ width: 1280, height: 1200 });
      await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
      const card = cardOf(page);

      // Hovering opens the tooltip (retried until the chart is drawn)
      await expect.poll(async () => {
        await moveInside(card);
        await twoFrames(page);
        return tooltipShown(card);
      }).toBe(true);

      await moveInsideThenLeave(card);

      await twoFrames(page);
      expect.soft(await tooltipShown(card), 'tooltip two frames after the leave').toBe(false);
      // The tooltip must not come back later either: nothing re-renders the chart without a new pointer event
      await page.waitForTimeout(500);
      expect(await tooltipShown(card), 'tooltip 500 ms after the leave').toBe(false);
    });
  }
});

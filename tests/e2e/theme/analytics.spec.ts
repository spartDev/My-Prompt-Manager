/**
 * E2E: Analytics on the color tokens (My-Prompt-Manager-el4.6)
 *
 * The Analytics tab (Atelier 1C: the bg-inverse hero, the cards, Most used and the Tidy up callout)
 * and the full-page view, which has the same design at the width of a page, take the surfaces, text
 * and borders of the tokens, and the full-page charts draw their bars in the accent of the current
 * mode. Also captures light/dark screenshots as visual proof
 * (test-results/analytics/).
 */

import type { Locator, Page } from '@playwright/test';

import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { ANALYTICS_FIXTURES, createUsageEventSeed } from '../fixtures/test-data';
import { seedLibrary, seedUsageHistory } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/analytics';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const ON_ACCENT = 'rgb(255, 255, 255)';
/** The hero's label and the busiest bar, the same in both modes (Atelier 1C) */
const ON_INVERSE = 'rgb(201, 191, 230)';
const INVERSE_MARK = 'rgb(167, 139, 250)';
const DANGER = 'rgb(220, 38, 38)';

const EXPECTED = {
  light: {
    app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', border: 'rgb(236, 230, 245)', subtle: 'rgb(244, 241, 250)',
    primary: 'rgb(29, 21, 48)', secondary: 'rgb(92, 83, 112)', tertiary: 'rgb(111, 103, 135)',
    accentSubtle: 'rgb(241, 235, 253)', accentText: 'rgb(91, 33, 182)', dangerText: 'rgb(153, 27, 27)', accent: 'rgb(109, 40, 217)',
    accentBorder: 'rgb(196, 181, 253)', muted: 'rgb(241, 237, 248)', raised: 'rgb(248, 246, 252)', divider: 'rgb(240, 235, 248)',
    accentSelected: 'rgb(237, 229, 255)', accentStrong: 'rgb(76, 29, 149)',
    strong: 'rgb(220, 212, 234)', dangerSubtle: 'rgb(253, 236, 236)', backdrop: 'rgba(42, 33, 64, 0.45)',
    inverse: 'rgb(29, 21, 48)', onInverseMuted: 'rgb(169, 156, 201)', barHover: 'rgb(255, 255, 255)',
    callout: 'rgb(255, 248, 230)', calloutText: 'rgb(120, 53, 15)', warningBorder: 'rgb(245, 223, 166)', warningText: 'rgb(146, 64, 14)'
  },
  dark: {
    app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', border: 'rgb(53, 44, 76)', subtle: 'rgb(43, 35, 64)',
    primary: 'rgb(241, 237, 249)', secondary: 'rgb(188, 179, 208)', tertiary: 'rgb(163, 154, 187)',
    accentSubtle: 'rgb(47, 35, 80)', accentText: 'rgb(196, 181, 253)', dangerText: 'rgb(252, 165, 165)', accent: 'rgb(132, 75, 242)',
    accentBorder: 'rgb(109, 79, 196)', muted: 'rgb(46, 38, 69)', raised: 'rgb(27, 21, 40)', divider: 'rgb(47, 39, 68)',
    accentSelected: 'rgb(56, 41, 106)', accentStrong: 'rgb(221, 211, 254)',
    strong: 'rgb(65, 55, 90)', dangerSubtle: 'rgb(58, 21, 24)', backdrop: 'rgba(7, 5, 12, 0.7)',
    inverse: 'rgb(74, 61, 107)', onInverseMuted: 'rgb(201, 191, 230)', barHover: 'rgb(35, 28, 52)',
    callout: 'rgb(43, 33, 14)', calloutText: 'rgb(253, 230, 138)', warningBorder: 'rgb(90, 69, 21)', warningText: 'rgb(252, 211, 77)'
  }
} as const;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Four Prompts used 4, 3, 2 and 1 times on four different days: four ranked rows, one busiest day */
const usageHistory = () => {
  const now = Date.now();
  const uses = (promptId: string, count: number, daysAgo: number) =>
    Array.from({ length: count }, (_, index) =>
      createUsageEventSeed({ promptId, timestamp: now - daysAgo * DAY - (index + 1) * MINUTE, platform: index % 2 ? 'chatgpt' : 'claude' }));

  return [
    ...uses('prompt-work-1', 4, 0),
    ...uses('prompt-dev-1', 3, 1),
    ...uses('prompt-personal-1', 2, 2),
    ...uses('prompt-work-2', 1, 3)
  ];
};

/** The popup is 400 x 500; the side panel is at least 320 px wide (docs/DESIGN_GUIDELINES.md) */
const SURFACES = {
  popup: { width: 400, height: 500 },
  sidepanel: { width: 320, height: 700 }
} as const;

const seed = async (storage: ExtensionStorage, theme: 'light' | 'dark', withUsage = true) => {
  const { prompts, categories } = ANALYTICS_FIXTURES.VARIED_USAGE;
  await seedLibrary(storage, { prompts, categories, settings: { theme } });
  if (withUsage) {
    await seedUsageHistory(storage, usageHistory());
  }
};

const openDashboard = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark', withUsage = true) => {
  await seed(storage, theme, withUsage);
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

/** Lets the entry animations finish (the rank bars take the longest), so a screenshot shows the page drawn */
const settleCharts = async (page: Page) => {
  await expect(page.getByTestId('daily-use-chart').locator('.recharts-bar-rectangle').first()).toBeVisible();
  await page.waitForTimeout(1800);
};

/** The fill each bar is painted with */
const fillsOf = (bars: Locator) => bars.evaluateAll(paths => paths.map(path => getComputedStyle(path).fill));

const openAnalyticsTab = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  theme: 'light' | 'dark',
  { surface = 'popup', withUsage = true }: { surface?: keyof typeof SURFACES; withUsage?: boolean } = {}
) => {
  await seed(storage, theme, withUsage);
  await page.setViewportSize(SURFACES[surface]);
  await page.goto(`chrome-extension://${extensionId}/src/${surface}.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
  await page.getByTestId('tab-analytics').click();
};

/** The color painted behind an element: its own background, else the first opaque one above it */
const backdropOf = (locator: Locator) =>
  locator.evaluate((element, transparent) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      if (color !== transparent) {return color;}
    }
    return transparent;
  }, TRANSPARENT);

test.describe('Analytics on the tokens', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`the Analytics tab draws the Atelier 1C hero, cards, Most used and Tidy up on the tokens (${theme})`, async ({ page, storage, extensionId }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openAnalyticsTab(page, storage, extensionId, theme);

      const hero = page.getByTestId('stats-hero');
      expect(await backdropOf(hero.locator('..'))).toBe(colors.app);
      await expect(hero).toHaveCSS('background-color', colors.inverse);
      await expect(hero).toHaveCSS('border-top-left-radius', '24px');
      await expect(hero.getByRole('heading', { name: 'Prompts used' })).toHaveCSS('color', ON_INVERSE);
      await expect(page.getByTestId('stats-total')).toHaveText('10');
      await expect(page.getByTestId('stats-total')).toHaveCSS('color', ON_ACCENT);
      await expect(page.getByTestId('stats-hero-subtitle')).toHaveCSS('color', ON_INVERSE);

      // The busiest bar is violet and its label white; the others are translucent with a muted label
      const bars = page.getByTestId('stats-bar');
      const pills = bars.locator('.animate-bar-grow');
      const busiest = await page.getByTestId('stats-hero-subtitle').textContent();
      const busiestIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        .findIndex(name => busiest?.startsWith(name));
      expect(busiestIndex).toBeGreaterThanOrEqual(0);
      await expect(pills.nth(busiestIndex)).toHaveCSS('background-color', INVERSE_MARK);
      await expect(bars.nth(busiestIndex).locator(':scope > span')).toHaveCSS('color', ON_ACCENT);
      const quiet = (busiestIndex + 1) % 7;
      await expect(pills.nth(quiet)).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.22)');
      await expect(bars.nth(quiet).locator(':scope > span')).toHaveCSS('color', colors.onInverseMuted);
      // rounded-full: Tailwind 4 writes calc(infinity * 1px), which Chromium clamps to a huge length
      // whose value changes between versions (1.67772e+07px, 3.35544e+07px…)
      await expect(pills.first()).toHaveCSS('border-top-left-radius', /^(9999|\d+(\.\d+)?e\+\d+)px$/);

      for (const label of ['Top platform', 'Top category'] as const) {
        const card = page.locator('div').filter({ has: page.getByRole('heading', { name: label, exact: true }) }).last();
        await expect(card).toHaveCSS('background-color', colors.card);
        await expect(card).toHaveCSS('border-top-color', colors.border);
        await expect(card).toHaveCSS('border-top-left-radius', '20px');
        await expect(card.getByRole('heading', { name: label })).toHaveCSS('color', colors.tertiary);
      }

      const mostUsed = page.getByRole('region', { name: 'Most used' });
      await expect(mostUsed).toHaveCSS('background-color', colors.card);
      const rows = mostUsed.getByTestId('most-used-row');
      await expect(rows).toHaveCount(3);
      await expect(rows.first()).toContainText('Work Email Template');
      const rank = rows.first().locator('span').first();
      await expect(rank).toHaveCSS('background-color', colors.accentSelected);
      await expect(rank).toHaveCSS('color', colors.accentText);
      await expect(rows.nth(1).locator('span').first()).toHaveCSS('background-color', colors.subtle);
      await expect(rows.first().locator('.animate-rank-fill')).toHaveCSS('background-color', colors.accent);
      await expect(rows.first().locator('.animate-rank-fill').locator('..')).toHaveCSS('background-color', colors.accentSubtle);

      const tidyUp = page.getByTestId('tidy-up');
      await expect(tidyUp).toHaveCSS('background-color', colors.callout);
      await expect(tidyUp).toHaveCSS('border-top-color', colors.warningBorder);
      await expect(tidyUp.getByRole('heading', { name: 'Tidy up' })).toHaveCSS('color', colors.calloutText);
      const reviewButton = tidyUp.getByRole('button', { name: /^Review the/ }).first();
      await expect(reviewButton).toHaveCSS('background-color', colors.card);
      await expect(reviewButton).toHaveCSS('color', colors.warningText);

      await expect(page.getByRole('button', { name: 'Clear history' })).toHaveCSS('color', colors.tertiary);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/tab-${theme}.png` });
      await tidyUp.evaluate(section => { section.scrollIntoView({ block: 'end' }); });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/tab-bottom-${theme}.png` });

      // A hovered bar turns to the bar-hover color and shows its count
      await bars.nth(quiet).hover();
      await expect(pills.nth(quiet)).toHaveCSS('background-color', colors.barHover);
      await expect(page.getByTestId('stats-hero-subtitle')).toHaveText(/^\d+ on \w+days$/);
    });

    test(`clearing the history asks in a bg-card dialog on bg-backdrop, with a secondary Cancel and a danger confirm (${theme})`, async ({ page, storage, extensionId }) => {
      await openAnalyticsTab(page, storage, extensionId, theme);
      await page.getByRole('button', { name: 'Clear history' }).click();

      const dialog = page.getByRole('dialog', { name: 'Clear Usage History?' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('..')).toHaveCSS('background-color', colors.backdrop);
      await expect(dialog).toHaveCSS('background-color', colors.card);
      await expect(dialog.getByRole('heading', { name: 'Clear Usage History?' })).toHaveCSS('color', colors.primary);
      await expect(dialog.getByText(/permanently delete/)).toHaveCSS('color', colors.secondary);
      const icon = dialog.getByTestId('clear-history-icon');
      await expect(icon).toHaveCSS('background-color', colors.dangerSubtle);
      await expect(icon.locator('svg')).toHaveCSS('color', colors.dangerText);

      const cancel = dialog.getByRole('button', { name: 'Cancel' });
      await expect(cancel).toHaveCSS('background-color', colors.card);
      await expect(cancel).toHaveCSS('color', colors.secondary);
      await expect(cancel).toHaveCSS('border-top-color', colors.strong);
      const confirm = dialog.getByRole('button', { name: 'Clear History' });
      await expect(confirm).toHaveCSS('background-color', DANGER);
      await expect(confirm).toHaveCSS('color', ON_ACCENT);

      await expect(cancel).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(confirm).toBeFocused();
      await page.screenshot({ path: `${SCREENSHOT_DIR}/clear-dialog-${theme}.png`, animations: 'disabled' });

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Clear history' })).toBeFocused();
    });

    test(`with no usage yet, the hero shows no Prompts used and Tidy up still shows (${theme})`, async ({ page, storage, extensionId }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openAnalyticsTab(page, storage, extensionId, theme, { withUsage: false });

      await expect(page.getByTestId('stats-hero')).toHaveCSS('background-color', colors.inverse);
      await expect(page.getByTestId('stats-total')).toHaveText('0');
      await expect(page.getByTestId('stats-hero-subtitle')).toHaveText('No Prompts used yet.');
      await expect(page.getByTestId('stats-bar')).toHaveCount(7);
      await expect(page.getByRole('region', { name: 'Most used' })).toBeHidden();
      await expect(page.getByTestId('tidy-up')).toHaveCSS('background-color', colors.callout);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/tab-empty-${theme}.png` });
    });

    test(`in a 320 px side panel, Full Dashboard is a primary accent button that fits the header (${theme})`, async ({ page, storage, extensionId }) => {
      await openAnalyticsTab(page, storage, extensionId, theme, { surface: 'sidepanel' });

      const fullDashboard = page.getByRole('button', { name: 'View full analytics dashboard' });
      await expect(fullDashboard).toHaveCSS('background-color', colors.accent);
      await expect(fullDashboard).toHaveCSS('color', ON_ACCENT);
      await expect(fullDashboard).toHaveCSS('background-image', 'none');
      const box = await fullDashboard.boundingBox();
      expect(box, 'Full Dashboard box').not.toBeNull();
      expect((box?.x ?? 0) + (box?.width ?? 0), 'right edge in the panel').toBeLessThanOrEqual(SURFACES.sidepanel.width);

      await expect(page.getByTestId('stats-hero')).toHaveCSS('background-color', colors.inverse);
      // Polled: the Section is still sliding in from the side of its tab when the hero first shows
      await expect.poll(async () => {
        const hero = await page.getByTestId('stats-hero').boundingBox();
        return (hero?.x ?? 0) + (hero?.width ?? 0);
      }, 'hero inside the panel').toBeLessThanOrEqual(SURFACES.sidepanel.width);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/sidepanel-${theme}.png` });
    });

    test(`the full-page view draws the tab's hero, cards and rankings on the tokens, and its charts in the accent of the mode (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);

      // The Section header of the tab: Eyebrow over a 27px title, seamless on bg-app
      const header = page.getByRole('banner');
      await expect(header).toHaveCSS('background-color', colors.app);
      await expect(header).toHaveCSS('border-bottom-color', TRANSPARENT);
      await expect(header.getByRole('heading', { level: 1, name: 'Analytics' })).toHaveCSS('color', colors.primary);
      await expect(header.getByRole('heading', { level: 1, name: 'Analytics' })).toHaveCSS('font-size', '27px');
      await expect(header.getByText('Last 30 days', { exact: true })).toHaveCSS('color', colors.tertiary);
      await expect(header.getByRole('button', { name: 'Go back' })).toHaveCSS('color', colors.secondary);

      const hero = page.getByTestId('stats-hero');
      await expect(hero).toHaveCSS('background-color', colors.inverse);
      await expect(hero).toHaveCSS('border-top-left-radius', '24px');
      await expect(hero.getByRole('heading', { name: 'Prompts used' })).toHaveCSS('color', ON_INVERSE);
      await expect(page.getByTestId('stats-total')).toHaveCSS('color', ON_ACCENT);
      // Wide: the total is larger than in the tab
      await expect(page.getByTestId('stats-total')).toHaveCSS('font-size', '64px');

      for (const label of ['Top platform', 'Top category'] as const) {
        const card = page.locator('div').filter({ has: page.getByRole('heading', { name: label, exact: true }) }).last();
        await expect(card).toHaveCSS('background-color', colors.card);
        await expect(card).toHaveCSS('border-top-color', colors.border);
        await expect(card).toHaveCSS('border-top-left-radius', '20px');
      }

      const mostUsed = page.getByRole('region', { name: 'Most used' });
      await expect(mostUsed).toHaveCSS('background-color', colors.card);
      const rows = mostUsed.getByTestId('most-used-row');
      await expect(rows).toHaveCount(4);
      await expect(rows.first()).toContainText('Work Email Template');
      await expect(rows.first().locator('span').first()).toHaveCSS('background-color', colors.accentSelected);
      await expect(rows.nth(1).locator('span').first()).toHaveCSS('background-color', colors.subtle);
      await expect(rows.first().locator('.animate-rank-fill')).toHaveCSS('background-color', colors.accent);
      await expect(rows.first().getByText(/ago$|Just now$/)).toHaveCSS('color', colors.tertiary);

      for (const title of ['Platforms', 'Categories']) {
        const card = page.getByRole('region', { name: title });
        await expect(card).toHaveCSS('background-color', colors.card);
        await expect(card).toHaveCSS('border-top-color', colors.border);
        await expect(card).toHaveCSS('border-top-left-radius', '20px');
        await expect(card.getByRole('heading', { name: title })).toHaveCSS('color', colors.primary);
        await expect(card.locator('.animate-rank-fill').first()).toHaveCSS('background-color', colors.accent);
        await expect(card.locator('.animate-rank-fill').first().locator('..')).toHaveCSS('background-color', colors.accentSubtle);
      }

      const tidyUp = page.getByTestId('tidy-up');
      await expect(tidyUp).toHaveCSS('background-color', colors.callout);
      await expect(tidyUp).toHaveCSS('border-top-color', colors.warningBorder);

      // The charts: pill bars in the accent of the mode, tertiary axis labels, no raw color
      for (const id of ['daily-use', 'time-of-day']) {
        const card = page.getByTestId(id);
        await expect(card).toHaveCSS('background-color', colors.card);
        await expect(card.getByRole('heading')).toHaveCSS('color', colors.primary);
        await expect(card.locator('.recharts-cartesian-axis-tick-value').first()).toHaveCSS('fill', colors.tertiary);
        // Recharts draws the bars once their entry animation starts, and redraws them when the chart gets its width
        await expect.poll(async () => [...new Set(await fillsOf(card.locator('.recharts-bar-rectangle path')))], `${id} bars`).toEqual([colors.accent]);
      }

      await settleCharts(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-${theme}.png` });

      // The tooltip is the hero's dark pill, over a muted band behind the hovered bar
      const daily = page.getByTestId('daily-use');
      const surface = daily.locator('svg.recharts-surface').first();
      const width = (await surface.boundingBox())?.width ?? 0;
      await surface.hover({ position: { x: width - 10, y: 80 } });
      const tooltip = daily.getByTestId('chart-tooltip');
      await expect(tooltip).toHaveText(/^\w{3} \d+ \d+ uses?$/);
      await expect(tooltip).toHaveCSS('background-color', colors.inverse);
      await expect(tooltip).toHaveCSS('color', ON_ACCENT);
      await expect(tooltip.locator('span')).toHaveCSS('color', ON_INVERSE);
      await expect(daily.locator('.recharts-tooltip-cursor')).toHaveCSS('fill', colors.muted);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-tooltip-${theme}.png` });

      // Scrolled, the content passes under the header: its line shows
      await page.setViewportSize({ width: 1280, height: 500 });
      await page.getByTestId('time-of-day').evaluate(section => { section.scrollIntoView({ block: 'end' }); });
      await expect(header).toHaveCSS('border-bottom-color', colors.strong);
    });

    test(`with no usage yet, the full-page view shows the hero at zero and Tidy up on the tokens (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme, false);

      await expect(page.getByTestId('stats-hero')).toHaveCSS('background-color', colors.inverse);
      await expect(page.getByTestId('stats-hero-subtitle')).toHaveText('No Prompts used yet.');
      await expect(page.getByTestId('tidy-up')).toHaveCSS('background-color', colors.callout);
      await expect(page.getByRole('region', { name: 'Most used' })).toHaveCount(0);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-empty-${theme}.png` });
    });
  }
});

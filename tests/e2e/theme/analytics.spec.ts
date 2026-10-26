/**
 * E2E: Analytics on the color tokens (My-Prompt-Manager-el4.6)
 *
 * The Analytics tab and the full dashboard take the surfaces, text and borders of the tokens, the
 * charts draw their primary color from the accent of the current mode, and the gold, silver and
 * bronze medals keep their colors. Also captures light/dark screenshots as visual proof
 * (test-results/analytics/).
 */

import type { Locator, Page } from '@playwright/test';

import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { ANALYTICS_FIXTURES, createUsageEventSeed } from '../fixtures/test-data';
import { seedLibrary, seedUsageHistory } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/analytics';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const ON_ACCENT = 'rgb(255, 255, 255)';
const DANGER = 'rgb(220, 38, 38)';

const EXPECTED = {
  light: {
    app: 'rgb(244, 241, 250)', card: 'rgb(255, 255, 255)', border: 'rgb(236, 230, 245)', subtle: 'rgb(244, 241, 250)',
    primary: 'rgb(29, 21, 48)', secondary: 'rgb(92, 83, 112)', tertiary: 'rgb(111, 103, 135)',
    accentSubtle: 'rgb(241, 235, 253)', accentText: 'rgb(91, 33, 182)', dangerText: 'rgb(153, 27, 27)', accent: 'rgb(109, 40, 217)',
    accentBorder: 'rgb(196, 181, 253)', muted: 'rgb(241, 237, 248)', raised: 'rgb(248, 246, 252)', divider: 'rgb(240, 235, 248)',
    accentSelected: 'rgb(237, 229, 255)', accentStrong: 'rgb(76, 29, 149)',
    strong: 'rgb(220, 212, 234)', dangerSubtle: 'rgb(253, 236, 236)', backdrop: 'rgba(42, 33, 64, 0.45)'
  },
  dark: {
    app: 'rgb(18, 14, 27)', card: 'rgb(35, 28, 52)', border: 'rgb(53, 44, 76)', subtle: 'rgb(43, 35, 64)',
    primary: 'rgb(241, 237, 249)', secondary: 'rgb(188, 179, 208)', tertiary: 'rgb(163, 154, 187)',
    accentSubtle: 'rgb(47, 35, 80)', accentText: 'rgb(196, 181, 253)', dangerText: 'rgb(252, 165, 165)', accent: 'rgb(132, 75, 242)',
    accentBorder: 'rgb(109, 79, 196)', muted: 'rgb(46, 38, 69)', raised: 'rgb(27, 21, 40)', divider: 'rgb(47, 39, 68)',
    accentSelected: 'rgb(56, 41, 106)', accentStrong: 'rgb(221, 211, 254)',
    strong: 'rgb(65, 55, 90)', dangerSubtle: 'rgb(58, 21, 24)', backdrop: 'rgba(7, 5, 12, 0.7)'
  }
} as const;

/** The medals as Tailwind drew them before the tokens (yellow-400 to orange-500...): the same in both modes */
const MEDALS = {
  gold: 'linear-gradient(to right bottom, oklch(0.852 0.199 91.936) 0%, oklch(0.705 0.213 47.604) 100%)',
  silver: 'linear-gradient(to right bottom, oklch(0.872 0.01 258.338) 0%, oklch(0.707 0.022 261.325) 100%)',
  bronze: 'linear-gradient(to right bottom, oklch(0.666 0.179 58.318) 0%, oklch(0.555 0.163 48.998) 100%)'
} as const;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/** Four Prompts used 4, 3, 2 and 1 times on four different days: three medals, one numbered rank, one peak day */
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
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`chrome-extension://${extensionId}/src/analytics.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

/** A chart card of the dashboard's breakdown, found by its heading */
const chartCard = (page: Page, title: string) =>
  page.getByRole('region', { name: 'Usage breakdown' }).locator('div').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).last();

/** Lets the recharts entry animations (1.5 s, reduced motion not honored) finish, so a screenshot shows the drawn charts */
const settleCharts = async (page: Page) => {
  await expect(page.locator('.recharts-pie-sector').first()).toBeVisible();
  await page.waitForTimeout(1600);
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

    test(`the Analytics tab shows opaque cards on bg-app, accent-subtle icon squares and the three medals (${theme})`, async ({ page, storage, extensionId }) => {
      await openAnalyticsTab(page, storage, extensionId, theme);

      const summary = page.getByRole('region', { name: 'Usage summary' });
      await expect(summary.getByRole('heading', { name: 'Summary' })).toHaveCSS('color', colors.tertiary);
      expect(await backdropOf(summary)).toBe(colors.app);

      const totalUses = summary.getByRole('article', { name: /^Total Uses/ });
      await expect(totalUses).toHaveCSS('background-color', colors.card);
      await expect(totalUses).toHaveCSS('border-top-color', colors.border);
      await expect(totalUses).toHaveCSS('backdrop-filter', 'none');
      await expect(totalUses.getByText('Total Uses')).toHaveCSS('color', colors.tertiary);
      await expect(totalUses.getByText('10', { exact: true })).toHaveCSS('color', colors.primary);
      await expect(totalUses.getByText('prompts inserted')).toHaveCSS('color', colors.tertiary);
      const iconSquare = totalUses.getByTestId('summary-icon');
      await expect(iconSquare).toHaveCSS('background-color', colors.accentSubtle);
      await expect(iconSquare.locator('svg')).toHaveCSS('color', colors.accentText);

      const topPrompts = page.getByRole('region', { name: 'Top prompts' });
      await expect(topPrompts.getByRole('heading', { name: 'Top Prompts' })).toHaveCSS('color', colors.tertiary);
      const items = topPrompts.getByRole('listitem');
      await expect(items).toHaveCount(4);
      const first = items.first();
      await expect(first).toHaveCSS('background-color', colors.card);
      await expect(first).toHaveCSS('border-top-color', colors.border);
      await expect(first).toHaveCSS('backdrop-filter', 'none');
      await expect(first.getByRole('heading', { name: 'Work Email Template' })).toHaveCSS('color', colors.primary);
      await expect(first.getByText('4 uses')).toHaveCSS('color', colors.accentText);
      await expect(first.getByText(/ago$/)).toHaveCSS('color', colors.tertiary);

      const ranks = topPrompts.getByTestId('rank-badge');
      await expect(ranks.nth(0)).toHaveCSS('background-image', MEDALS.gold);
      await expect(ranks.nth(1)).toHaveCSS('background-image', MEDALS.silver);
      await expect(ranks.nth(2)).toHaveCSS('background-image', MEDALS.bronze);
      await expect(ranks.nth(0)).toHaveCSS('color', ON_ACCENT);
      await expect(ranks.nth(3)).toHaveCSS('background-color', colors.subtle);
      await expect(ranks.nth(3)).toHaveCSS('color', colors.tertiary);

      await expect(page.getByRole('button', { name: 'Clear history' })).toHaveCSS('color', colors.dangerText);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/tab-${theme}.png` });
      await topPrompts.evaluate(section => { section.scrollIntoView({ block: 'start' }); });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/tab-top-prompts-${theme}.png` });
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

      await page.screenshot({ path: `${SCREENSHOT_DIR}/clear-dialog-${theme}.png` });
    });

    test(`with no usage yet, the empty state shows an accent-subtle icon circle on bg-app (${theme})`, async ({ page, storage, extensionId }) => {
      await openAnalyticsTab(page, storage, extensionId, theme, { withUsage: false });

      const empty = page.getByRole('region', { name: 'Empty analytics' });
      expect(await backdropOf(empty)).toBe(colors.app);
      const circle = empty.getByTestId('empty-analytics-icon');
      await expect(circle).toHaveCSS('background-color', colors.accentSubtle);
      await expect(circle.locator('svg')).toHaveCSS('color', colors.accentText);
      await expect(empty.getByRole('heading', { name: 'No usage data yet' })).toHaveCSS('color', colors.primary);
      await expect(empty.getByText(/Start using your prompts/)).toHaveCSS('color', colors.tertiary);

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

      const totalUses = page.getByRole('article', { name: /^Total Uses/ });
      await expect(totalUses).toHaveCSS('background-color', colors.card);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/sidepanel-${theme}.png` });
    });

    test(`the dashboard charts draw the accent of the mode, on token grid lines, axes and tooltip (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);

      const trend = page.getByRole('region', { name: 'Usage trend' });
      await expect(trend.locator('.recharts-line-curve')).toHaveCSS('stroke', colors.accent);
      await expect(trend.locator('.recharts-cartesian-grid-horizontal line').first()).toHaveCSS('stroke', colors.border);
      await expect(trend.locator('.recharts-cartesian-axis-tick-value').first()).toHaveCSS('fill', colors.tertiary);

      // One peak day (4 uses today) in the accent, the other days in accent/border
      const dayBars = chartCard(page, 'Day of Week').locator('.recharts-bar-rectangle path');
      // Recharts draws the bars once their entry animation starts, and redraws them when the chart gets its width
      await expect.poll(async () => {
        const fills = await fillsOf(dayBars);
        return { peakDays: fills.filter(fill => fill === colors.accent).length, otherDays: [...new Set(fills.filter(fill => fill !== colors.accent))] };
      }).toEqual({ peakDays: 1, otherDays: [colors.accentBorder] });

      await expect.poll(() => fillsOf(chartCard(page, 'Time of Day').locator('.recharts-bar-rectangle path')), 'peak time of day in the accent')
        .toContain(colors.accent);

      await expect(chartCard(page, 'Platforms').locator('.recharts-legend-item-text span').first()).toHaveCSS('color', colors.secondary);

      // Tooltip of the trend line: a bg-card box with a token border
      await trend.locator('.recharts-surface').hover({ position: { x: 600, y: 120 } });
      const tooltip = trend.locator('.recharts-default-tooltip');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveCSS('background-color', colors.card);
      await expect(tooltip).toHaveCSS('border-top-color', colors.border);
      await expect(tooltip.locator('.recharts-tooltip-label')).toHaveCSS('color', colors.primary);
      await expect(tooltip.locator('.recharts-tooltip-item')).toHaveCSS('color', colors.accentText);

      // The hover band behind a bar
      await dayBars.first().hover();
      await expect(chartCard(page, 'Day of Week').locator('.recharts-tooltip-cursor')).toHaveCSS('fill', colors.muted);
    });

    test(`the dashboard is seamless on bg-app: its header line shows once the page scrolls, charts sit in cards, the chosen tab is accent-selected (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme);

      const header = page.getByRole('banner');
      await expect(header).toHaveCSS('background-color', colors.app);
      await expect(header).toHaveCSS('backdrop-filter', 'none');
      await expect(header).toHaveCSS('border-bottom-color', TRANSPARENT);
      await expect(header.getByRole('heading', { name: 'Analytics Dashboard' })).toHaveCSS('color', colors.primary);
      await expect(header.getByText('Last 30 days of usage')).toHaveCSS('color', colors.tertiary);
      await expect(header.getByRole('button', { name: 'Go back' })).toHaveCSS('color', colors.secondary);
      const icon = header.getByTestId('dashboard-icon');
      await expect(icon).toHaveCSS('background-color', colors.accentSubtle);
      await expect(icon.locator('svg')).toHaveCSS('color', colors.accentText);

      const summary = page.getByRole('region', { name: 'Usage summary' });
      expect(await backdropOf(summary)).toBe(colors.app);
      await expect(summary.getByRole('heading', { name: 'Summary' })).toHaveCSS('color', colors.tertiary);
      await expect(summary.getByRole('article', { name: /^Peak Day/ })).toHaveCSS('background-color', colors.card);

      const platforms = chartCard(page, 'Platforms');
      await expect(platforms).toHaveCSS('background-color', colors.card);
      await expect(platforms).toHaveCSS('border-top-color', colors.border);
      await expect(platforms.getByRole('heading', { name: 'Platforms' })).toHaveCSS('color', colors.primary);
      await expect(page.getByRole('region', { name: 'Usage trend' }).locator('div').first()).toHaveCSS('background-color', colors.card);

      const prompts = page.getByRole('region', { name: 'Prompt usage details' });
      await expect(prompts.locator('div').first()).toHaveCSS('background-color', colors.card);
      const tablist = prompts.getByRole('tablist', { name: 'Prompt tabs' });
      await expect(tablist.locator('..')).toHaveCSS('border-bottom-color', colors.divider);
      const mostUsed = tablist.getByRole('tab', { name: 'Most Used' });
      await expect(mostUsed).toHaveAttribute('aria-selected', 'true');
      await expect(mostUsed).toHaveCSS('background-color', colors.accentSelected);
      await expect(mostUsed).toHaveCSS('color', colors.accentStrong);
      await expect(mostUsed).toHaveCSS('font-weight', '600');
      const forgotten = tablist.getByRole('tab', { name: 'Forgotten' });
      await expect(forgotten).toHaveCSS('background-color', TRANSPARENT);
      await expect(forgotten).toHaveCSS('color', colors.tertiary);

      const rows = prompts.getByRole('tabpanel', { name: 'Most Used' }).getByRole('listitem');
      await expect(rows).toHaveCount(4);
      const first = rows.first();
      await expect(first).toHaveCSS('background-color', colors.raised);
      await expect(first.getByRole('heading', { name: 'Work Email Template' })).toHaveCSS('color', colors.primary);
      await expect(first.getByText('4 uses')).toHaveCSS('color', colors.accentText);
      await expect(first.getByText(/ago$/)).toHaveCSS('color', colors.tertiary);
      const ranks = prompts.getByRole('tabpanel', { name: 'Most Used' }).getByTestId('rank-badge');
      await expect(ranks.nth(0)).toHaveCSS('background-image', MEDALS.gold);
      await expect(ranks.nth(1)).toHaveCSS('background-image', MEDALS.silver);
      await expect(ranks.nth(2)).toHaveCSS('background-image', MEDALS.bronze);
      await expect(ranks.nth(3)).toHaveCSS('background-color', colors.subtle);
      await expect(ranks.nth(3)).toHaveCSS('color', colors.tertiary);

      await settleCharts(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-${theme}.png` });

      // Scrolled, the content passes under the header: its line shows
      await prompts.evaluate(section => { section.scrollIntoView({ block: 'end' }); });
      await expect(header).toHaveCSS('border-bottom-color', colors.strong);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/dashboard-prompts-${theme}.png` });
    });

    test(`with no usage yet, the dashboard shows the same empty state on bg-app (${theme})`, async ({ page, storage, extensionId }) => {
      await openDashboard(page, storage, extensionId, theme, false);

      const empty = page.getByRole('region', { name: 'Empty analytics' });
      expect(await backdropOf(empty)).toBe(colors.app);
      const circle = empty.getByTestId('empty-analytics-icon');
      await expect(circle).toHaveCSS('background-color', colors.accentSubtle);
      await expect(circle.locator('svg')).toHaveCSS('color', colors.accentText);
      await expect(empty.getByRole('heading', { name: 'No usage data yet' })).toHaveCSS('color', colors.primary);
      await expect(empty.getByText(/Start using your prompts/)).toHaveCSS('color', colors.tertiary);
    });
  }
});

/**
 * E2E: the Welcome for keyboard and screen-reader users, in the real extension (My-Prompt-Manager-ojz.10).
 *
 * - AC1: axe (@axe-core/playwright, tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa) finds no
 *   violation on each of the three steps, light and dark, in the popup (400 x 500) and the side panel
 *   (320 x 600), nor on the Library the Welcome leaves for, with its Notification: 13 combinations, each
 *   count logged ("[axe] …") and written to test-results/welcome/axe-*.json. The same walk measures the
 *   progress dots: each a target of 24 x 24px at least, none overlapping another (WCAG 2.5.8).
 * - AC2: with the keyboard alone (Tab, Shift+Tab, Enter, Space, the arrows; no mouse), from the opening
 *   to the Library with Packs added, then a Prompt copied to the clipboard: the first use is within
 *   reach without a mouse. Every stop of the Welcome's Tab cycle is inside it and shows its focus
 *   outline. Enter on a focused Pack toggles it and does not press the primary button.
 * - AC3: after each step change the live region holds "Step N of 3" and the step's title has the
 *   keyboard; the dots, the Packs, Skip and close have the names and states of the spec, read from
 *   Chrome's own accessibility tree (what a screen reader is given), as is the typing demo, hidden with
 *   its whole sentence given instead.
 * - The Library behind is inert: while the Welcome shows, nothing of the Library is in the document,
 *   even over a Library that holds Prompts (Debug mode), and the keyboard never leaves the Welcome.
 * - In a short side panel (320 x 500, 320 x 420) the Packs' grid scrolls: while Packs remain below
 *   (Writing, selected and counted in "Add 9 prompts"), the grid's bottom edge fades out and a line
 *   shows along it; the Pack reached with the keyboard scrolls into view and the cue moves to the top.
 *   Where the Packs fit, no cue. Light and dark screenshots in WELCOME_A11Y_SCREENSHOTS
 *   (test-results/welcome-a11y when unset).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { SITE_SETTINGS_KEY } from '../../../src/services/siteSettings';
import { DEFAULT_SETTINGS } from '../../../src/types';
import { PACKS } from '../../../src/welcome/packs';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';
import { createPromptSeed } from '../utils/storage';

const OUTPUT_DIR = 'test-results/welcome';
const SCREENSHOTS_DIR = process.env.WELCOME_A11Y_SCREENSHOTS ?? 'test-results/welcome-a11y';

/** The rules of WCAG 2.0, 2.1 and 2.2 at levels A and AA that axe checks */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** How far the Packs' grid fades out at an edge with Packs beyond it (src/popup.css) */
const FADE_PX = 16;

/** WCAG 2.5.8: the least a target measures each way */
const MIN_TARGET_PX = 24;

const SURFACES = {
  popup: { file: 'popup', width: 400, height: 500 },
  sidepanel: { file: 'sidepanel', width: 320, height: 600 }
} as const;

type Surface = keyof typeof SURFACES;
type Theme = 'light' | 'dark';

const STEP_TITLES = ['Your best prompts, one tap away', 'Leave blanks, fill them later', 'Start with a pack'] as const;

const DEFAULTS = PACKS.filter((pack) => pack.defaultSelected);
const promptsOf = (ids: readonly string[]): number =>
  PACKS.filter((pack) => ids.includes(pack.id)).reduce((count, pack) => count + pack.prompts.length, 0);

const open = async (page: Page, extensionId: string, file: string, width: number, height: number): Promise<void> => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
};

const openSurface = (page: Page, extensionId: string, surface: Surface): Promise<void> => {
  const { file, width, height } = SURFACES[surface];
  return open(page, extensionId, file, width, height);
};

const welcome = (page: Page) => page.getByTestId('welcome');
const primary = (page: Page) => page.getByTestId('welcome-primary');
const announcer = (page: Page) => welcome(page).getByRole('status');

/** Resolves once every finite animation of the page has ended: axe reads colors as they finally are */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });

const expectTheme = async (page: Page, theme: Theme): Promise<void> => {
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  } else {
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  }
};

interface AxeCount {
  combination: string;
  violations: number;
  rules: { id: string; impact: string | null | undefined; nodes: string[] }[];
}

/** Runs axe on the page with the WCAG tags, logs the count and returns it with what failed */
const audit = async (page: Page, combination: string): Promise<AxeCount> => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const count: AxeCount = {
    combination,
    violations: violations.length,
    rules: violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.map((node) => node.target.join(' ')) }))
  };
  console.log(`[axe] ${combination}: ${String(count.violations)} violations${count.violations > 0 ? ` ${JSON.stringify(count.rules)}` : ''}`);
  test.info().annotations.push({ type: 'axe', description: `${combination}: ${String(count.violations)} violations` });
  return count;
};

const writeReport = async (counts: readonly AxeCount[]): Promise<void> => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  for (const count of counts) {
    const file = path.join(OUTPUT_DIR, `axe-${count.combination.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`);
    await fs.writeFile(file, `${JSON.stringify(count, null, 2)}\n`);
  }
};

/** The boxes of the progress dots, the buttons a click on which leads to their step */
const dotBoxes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="group"][aria-label="Steps"] button')].map((dot) => {
      const { left, right, top, bottom, width, height } = dot.getBoundingClientRect();
      return { name: dot.getAttribute('aria-label') ?? '', left, right, top, bottom, width, height };
    })
  );

/** What has the keyboard: its name, whether it is in the Welcome, and its focus outline */
const focused = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) {
      return null;
    }
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      name: (element.getAttribute('aria-label') ?? element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      pressed: element.getAttribute('aria-pressed'),
      insideWelcome: element.closest('[data-testid="welcome"]') !== null,
      outline: { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
    };
  });

type Focused = NonNullable<Awaited<ReturnType<typeof focused>>>;

/** Presses Tab until the control named `name` has the keyboard */
const tabTo = async (page: Page, name: string | RegExp, max = 40): Promise<Focused> => {
  for (let press = 0; press < max; press++) {
    await page.keyboard.press('Tab');
    const now = await focused(page);
    if (now && (typeof name === 'string' ? now.name === name : name.test(now.name))) {
      return now;
    }
  }
  throw new Error(`Tab never reached ${String(name)} in ${String(max)} presses`);
};

/**
 * The Tab cycle from where the keyboard is: each control Tab stops at, in order, until the first one
 * comes back. The page's own end (the keyboard on no element of it) is passed over
 */
const tabCycle = async (page: Page, max = 30): Promise<Focused[]> => {
  const stops: Focused[] = [];
  for (let press = 0; press < max; press++) {
    await page.keyboard.press('Tab');
    const now = await focused(page);
    if (!now) {
      continue;
    }
    if (stops.length > 0 && now.name === stops[0].name && now.tag === stops[0].tag) {
      return stops;
    }
    stops.push(now);
  }
  throw new Error(`The Tab cycle did not come back in ${String(max)} presses: ${JSON.stringify(stops.map((stop) => stop.name))}`);
};

/** After a step change: "Step N of 3" in the live region, and the keyboard on that step's title */
const expectStepChanged = async (page: Page, step: 0 | 1 | 2): Promise<void> => {
  await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
  await expect(announcer(page)).toHaveText(`Step ${String(step + 1)} of 3`);
  await expect(page.getByRole('heading', { level: 1, name: STEP_TITLES[step] })).toBeFocused();
};

/** Chrome's own accessibility tree, the one a screen reader reads: its nodes not ignored */
const accessibilityTree = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as {
    nodes: {
      ignored: boolean;
      role?: { value?: string };
      name?: { value?: string };
      properties?: { name: string; value: { value?: unknown } }[];
    }[];
  };
  await cdp.detach();
  return nodes
    .filter((node) => !node.ignored)
    .map((node) => ({
      role: String(node.role?.value ?? ''),
      name: String(node.name?.value ?? ''),
      properties: Object.fromEntries((node.properties ?? []).map((property) => [property.name, property.value.value]))
    }));
};

/** The scroll cue of the Packs' grid as drawn: each edge's fade and line */
const packsCue = (page: Page) =>
  page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('[data-testid="welcome-packs"]');
    const edges = grid?.parentElement;
    if (!grid || !edges) {
      return null;
    }
    const style = getComputedStyle(grid);
    // How opaque a line is: 0 for none, 1 for its whole color
    const alpha = (color: string): number => {
      if (color === '' || color === 'transparent') {
        return 0;
      }
      const parts = /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/.exec(color);
      return parts ? Number(parts[1]) : 1;
    };
    return {
      overflows: grid.scrollHeight > grid.clientHeight,
      scrollTop: grid.scrollTop,
      fadeTop: parseFloat(style.getPropertyValue('--welcome-packs-fade-top')) || 0,
      fadeBottom: parseFloat(style.getPropertyValue('--welcome-packs-fade-bottom')) || 0,
      lineTop: alpha(getComputedStyle(edges, '::before').backgroundColor),
      lineBottom: alpha(getComputedStyle(edges, '::after').backgroundColor)
    };
  });

/**
 * Where a Pack is in the grid's view: how much of it shows (1 whole, 0 none), and the room above its
 * name and below its count there
 */
const placeOf = (page: Page, name: string) =>
  page.evaluate((packName) => {
    const grid = document.querySelector('[data-testid="welcome-packs"]');
    const pack = [...(grid?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.startsWith(packName));
    const text = pack?.querySelector('[data-pack-dot] + span');
    if (!grid || !pack || !text) {
      return null;
    }
    const view = grid.getBoundingClientRect();
    const box = pack.getBoundingClientRect();
    const words = text.getBoundingClientRect();
    const shown = Math.max(0, Math.min(box.bottom, view.bottom) - Math.max(box.top, view.top));
    return { shown: shown / box.height, textAbove: words.top - view.top, textBelow: view.bottom - words.bottom };
  }, name);

const shownOf = async (page: Page, name: string): Promise<number> => (await placeOf(page, name))?.shown ?? -1;

test.describe('The Welcome for keyboard and screen-reader users', () => {
  for (const surface of ['popup', 'sidepanel'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      const { width, height } = SURFACES[surface];

      test(`AC1: axe finds no violation on any of the three steps, ${theme}, ${surface} ${String(width)} x ${String(height)}; every dot a target of 24 x 24px`, async ({ page, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await openSurface(page, extensionId, surface);
        await expectTheme(page, theme);

        const counts: AxeCount[] = [];
        for (const step of [0, 1, 2] as const) {
          await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
          await animationsDone(page);
          counts.push(await audit(page, `step ${String(step + 1)}, ${theme}, ${surface} ${String(width)}x${String(height)}`));

          const dots = await dotBoxes(page);
          expect(dots.map((dot) => dot.name)).toEqual(['Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3']);
          test.info().annotations.push({ type: 'dots', description: `step ${String(step + 1)}: ${dots.map((dot) => `${dot.width.toFixed(1)}x${dot.height.toFixed(1)}`).join(', ')}` });
          for (const [index, dot] of dots.entries()) {
            expect.soft(dot.width, `${dot.name}: width`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
            expect.soft(dot.height, `${dot.name}: height`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
            const next = dots[index + 1];
            if (next) {
              expect.soft(dot.right, `${dot.name} does not overlap ${next.name}`).toBeLessThanOrEqual(next.left);
            }
          }
          if (step < 2) {
            await primary(page).click();
          }
        }
        await writeReport(counts);

        for (const count of counts) {
          expect.soft(count.rules, count.combination).toEqual([]);
        }
      });
    }
  }

  test('AC1: axe finds no violation on the Library the Welcome leaves for, with its Notification (light, popup 400 x 500)', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
    await openSurface(page, extensionId, 'popup');
    await expect(primary(page)).toHaveText(/^Add \d+ prompts$/);

    await primary(page).click();

    await expect(welcome(page)).toHaveCount(0);
    // The Notification still there when axe reads it: hovered, it keeps its time
    await page.getByTestId('toast').hover();
    await animationsDone(page);
    const count = await audit(page, 'Library at the exit with its Notification, light, popup 400x500');
    await expect(page.getByTestId('toast')).toBeVisible();
    await writeReport([count]);

    expect(count.rules).toEqual([]);
  });

  test('AC2: with the keyboard alone, from the opening to the Library with Packs added, then a Prompt copied', async ({ context, page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openSurface(page, extensionId, 'popup');
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '0');
    await animationsDone(page);

    // Step 1: Tab goes round the Welcome's controls only, each with its focus outline
    const cycle = await tabCycle(page);
    expect(cycle.map((stop) => stop.name)).toEqual(['Skip', 'Close', 'Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3', 'Next']);
    for (const stop of cycle) {
      expect(stop.insideWelcome, `${stop.name}: in the Welcome`).toBe(true);
      expect(stop.outline.style, `${stop.name}: focus outline`).not.toBe('none');
      expect(stop.outline.width, `${stop.name}: focus outline width`).toBeGreaterThanOrEqual(2);
    }

    // Space on Next, then the arrows both ways
    await tabTo(page, 'Next');
    await page.keyboard.press('Space');
    await expectStepChanged(page, 1);
    await page.keyboard.press('ArrowLeft');
    await expectStepChanged(page, 0);
    await page.keyboard.press('ArrowRight');
    await expectStepChanged(page, 1);

    // A dot, from the keyboard: Enter on "Step 3 of 3"
    await tabTo(page, 'Step 3 of 3');
    await page.keyboard.press('Enter');
    await expectStepChanged(page, 2);

    // Step 3: Tab and Shift+Tab move between the Packs; Space and Enter toggle one
    const packs = page.getByRole('group', { name: 'Packs' });
    await tabTo(page, /^Engineering /);
    await page.keyboard.press('Shift+Tab');
    expect((await focused(page))?.name).toMatch(/^Product /);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(packs.getByRole('button', { name: /^Engineering / })).toHaveAttribute('aria-pressed', 'true');

    const withHiring = [...DEFAULTS.map((pack) => pack.id), 'engineering', 'hiring'];
    await tabTo(page, /^Hiring /);
    await page.keyboard.press('Enter');
    // Enter on a Pack toggles it; the primary button is not pressed: still step 3, nothing added
    await expect(packs.getByRole('button', { name: /^Hiring / })).toHaveAttribute('aria-pressed', 'true');
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
    await expect(primary(page)).toHaveText(`Add ${String(promptsOf(withHiring))} prompts`);
    expect(await storage.getPrompts()).toEqual([]);
    const hiring = await focused(page);
    expect(hiring?.name).toMatch(/^Hiring /);
    expect(hiring?.outline.style, 'a focused Pack: focus outline').not.toBe('none');

    // The primary button, from the keyboard
    await tabTo(page, `Add ${String(promptsOf(withHiring))} prompts`);
    await page.keyboard.press('Enter');

    await expect(welcome(page)).toHaveCount(0);
    await expect(page.getByTestId('prompt-card')).toHaveCount(promptsOf(withHiring));
    await expect(page.getByTestId('toast')).toContainText(`${String(promptsOf(withHiring))} prompts added`);

    // The first use: a Prompt copied, with the keyboard
    const copy = await tabTo(page, /^Copy content of .+ to clipboard$/, 60);
    const title = copy.name.replace(/^Copy content of /, '').replace(/ to clipboard$/, '');
    const content = PACKS.flatMap((pack) => pack.prompts).find((prompt) => prompt.title === title)?.content;
    expect(content, `${title} is a Prompt of the Packs`).toBeDefined();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(content);
  });

  for (const surface of ['popup', 'sidepanel'] as const) {
    test(`AC3: names and states for a screen reader, read from Chrome's accessibility tree, and each step change announced with the keyboard on its title (${surface})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
      await openSurface(page, extensionId, surface);
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', '0');
      const closeName = surface === 'sidepanel' ? 'Close side panel' : 'Close';

      for (const step of [0, 1, 2] as const) {
        if (step > 0) {
          await expectStepChanged(page, step);
        }
        const tree = await accessibilityTree(page);
        const buttons = tree.filter((node) => node.role === 'button');
        const names = buttons.map((node) => node.name);
        test.info().annotations.push({ type: `step ${String(step + 1)} buttons`, description: JSON.stringify(buttons.map(({ name, properties }) => ({ name, pressed: properties.pressed }))) });

        // Skip until the last step, close always, by name
        expect(names.includes('Skip'), 'Skip').toBe(step !== 2);
        expect(names, closeName).toContain(closeName);
        // The dots: "Step N of 3", the current one marked (aria-current, which Chrome's tree leaves out)
        expect(names.filter((name) => /^Step \d of 3$/.test(name))).toEqual(['Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3']);
        for (const dot of [0, 1, 2]) {
          const current = page.getByRole('button', { name: `Step ${String(dot + 1)} of 3` });
          if (dot === step) {
            await expect(current).toHaveAttribute('aria-current', 'step');
          } else {
            await expect(current).not.toHaveAttribute('aria-current');
          }
        }
        // The live region: polite, whole, "Step N of 3"
        const status = tree.find((node) => node.role === 'status');
        expect(status?.properties.live).toBe('polite');
        expect(status?.properties.atomic).toBe(true);
        await expect(announcer(page)).toHaveText(`Step ${String(step + 1)} of 3`);

        if (step === 1) {
          // The typing is hidden; the whole sentence is given, once
          const sentences = tree.filter((node) => node.role === 'StaticText' && node.name.includes('Write a follow-up email to'));
          expect(sentences.map((node) => node.name)).toEqual(['Write a follow-up email to Claire, Head of Sales and end with one clear next step.']);
        }
        if (step === 2) {
          // The Packs: toggle buttons named by their name and count, pressed as selected
          const packs = buttons.filter((node) => PACKS.some((pack) => node.name.startsWith(`${pack.name} `)));
          expect(packs.map(({ name, properties }) => ({ name, pressed: properties.pressed }))).toEqual(
            PACKS.map((pack) => ({ name: `${pack.name} ${String(pack.prompts.length)} prompts`, pressed: pack.defaultSelected ? 'true' : 'false' }))
          );
        }
        if (step < 2) {
          await primary(page).click();
        }
      }

      // Back, Skip, a dot: each announced, each giving the keyboard to its title
      await page.getByRole('button', { name: 'Back' }).click();
      await expectStepChanged(page, 1);
      await page.getByRole('button', { name: 'Skip' }).click();
      await expectStepChanged(page, 2);
      await page.getByRole('button', { name: 'Step 1 of 3' }).click();
      await expectStepChanged(page, 0);
    });
  }

  test('the Library behind is inert: nothing of it is in the document while the Welcome shows, over a Library with Prompts (Debug mode), and the keyboard never leaves the Welcome', async ({ page, storage, extensionId }) => {
    await storage.seed({
      prompts: [createPromptSeed({ id: 'p1', title: 'Draft email', content: 'Write a follow-up email to {{name}}.' })],
      [WELCOME_KEY]: { status: 'done' },
      [SITE_SETTINGS_KEY]: { enabledSites: [], customSites: [], debugMode: true }
    });
    await openSurface(page, extensionId, 'popup');
    await expect(welcome(page)).toHaveAttribute('data-welcome-step', '0');

    for (const step of [0, 1, 2] as const) {
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByTestId('section')).toHaveCount(0);
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await expect(page.getByRole('tab')).toHaveCount(0);
      await expect(page.getByRole('search')).toHaveCount(0);
      await expect(page.getByTestId('prompt-card')).toHaveCount(0);
      await expect(page.getByText('Draft email')).toHaveCount(0);
      const cycle = await tabCycle(page);
      expect(cycle.length).toBeGreaterThan(0);
      for (const stop of cycle) {
        expect(stop.insideWelcome, `step ${String(step + 1)}: ${stop.name} in the Welcome`).toBe(true);
      }
      if (step < 2) {
        await page.keyboard.press('ArrowRight');
      }
    }
  });

  test('where the Packs fit, the grid shows no scroll cue (popup 400 x 500, side panel 320 x 600)', async ({ page, storage, extensionId }) => {
    await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
    for (const surface of ['popup', 'sidepanel'] as const) {
      await openSurface(page, extensionId, surface);
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
      await animationsDone(page);

      expect(await packsCue(page), surface).toEqual({ overflows: false, scrollTop: 0, fadeTop: 0, fadeBottom: 0, lineTop: 0, lineBottom: 0 });
    }
  });

  for (const height of [500, 420] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`a short side panel, 320 x ${String(height)}, ${theme}: while Packs remain below, the grid's edge fades out with a line along it; the Pack reached with the keyboard scrolls into view`, async ({ page, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await open(page, extensionId, 'sidepanel', 320, height);
        await expectTheme(page, theme);
        await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
        await animationsDone(page);
        await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
        const name = (what: string) => path.join(SCREENSHOTS_DIR, `sidepanel-320x${String(height)}-step3-${what}-${theme}.png`);
        // The pointer off the controls, so none shows its hover
        await page.mouse.move(160, 4);

        // Writing, selected and counted in the primary button, is not wholly in view: the bottom edge says so
        await expect(primary(page)).toHaveText(`Add ${String(promptsOf(DEFAULTS.map((pack) => pack.id)))} prompts`);
        await expect(page.getByRole('button', { name: /^Writing / })).toHaveAttribute('aria-pressed', 'true');
        expect(await shownOf(page, 'Writing')).toBeLessThan(1);
        const atTop = await packsCue(page);
        test.info().annotations.push({ type: 'cue at the top', description: JSON.stringify(atTop) });
        expect(atTop).toEqual({ overflows: true, scrollTop: 0, fadeTop: 0, fadeBottom: FADE_PX, lineTop: 0, lineBottom: 1 });
        // Not animations: 'disabled', which cancels the scroll-driven animations that draw the cue
        await page.screenshot({ path: name('cue') });

        // The keyboard on Writing: the grid scrolls it wholly into view, its name and count clear of both
        // fades; the cue shows at the top, where Product and Engineering now are. (At 320 x 420 the view is
        // barely one Pack high: the scroll padding cannot fit, and the top fade covers Writing's top padding)
        await tabTo(page, /^Writing /);
        await expect.poll(() => shownOf(page, 'Writing')).toBe(1);
        // The scroll timeline draws the cue at the next frame
        await expect.poll(() => packsCue(page)).toMatchObject({ overflows: true, fadeTop: FADE_PX, lineTop: 1 });
        const scrolled = await packsCue(page);
        const writing = await placeOf(page, 'Writing');
        test.info().annotations.push({ type: 'cue scrolled', description: JSON.stringify({ ...scrolled, writing }) });
        expect(scrolled?.scrollTop).toBeGreaterThan(0);
        expect(writing?.textAbove, "Writing's name below the top fade").toBeGreaterThanOrEqual(scrolled?.fadeTop ?? Infinity);
        expect(writing?.textBelow, "Writing's count above the bottom fade").toBeGreaterThanOrEqual(scrolled?.fadeBottom ?? Infinity);
        await page.screenshot({ path: name('scrolled') });
      });
    }
  }
});

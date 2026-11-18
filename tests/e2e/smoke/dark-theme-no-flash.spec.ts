/**
 * E2E: opening the extension in dark mode must not flash light controls (My-Prompt-Manager-9zd).
 *
 * useTheme applies the `dark` class after settings load. Controls with `transition-all`
 * used to animate their background light → dark for 200ms. An init script snapshots the
 * running transitions at the exact moment `dark` lands on <html>. The Library and the Welcome mount
 * once the launch decision is known (src/hooks/useLaunchScreen.ts), which may land after the `dark`
 * class: a control not mounted yet then mounts dark. The snapshot records which controls were
 * mounted when `dark` landed, and the colors each one that was not had when it mounted, which must
 * be its dark colors (My-Prompt-Manager-ojz.11): so the check never passes having checked nothing.
 */

import type { Page } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

/** What the init script saw of a control: mounted when `dark` landed or later, and how it looked */
type ControlCheck = {
  /** In the page when `dark` landed on <html> */
  mountedWhenDark: boolean;
  /** The transitions changing a value at that moment, for a control mounted then */
  transitions: string[];
  /** Its colors when it mounted, for a control mounted after `dark` landed */
  colorsAtMount?: string;
};
type DarkSnapshot = { controls?: Record<string, ControlCheck>; error?: string };

const LIBRARY_TARGETS: Record<string, string> = {
  search: 'input[placeholder="Search your prompts"]',
  activeTab: '[role="tab"][aria-selected="true"]',
  activeFilter: '[role="radio"][aria-checked="true"]',
};

/** The Welcome's controls whose colors change with the theme and that transition their colors */
const WELCOME_TARGETS: Record<string, string> = {
  primary: '[data-testid="welcome-primary"]',
  back: 'div:has(> [data-testid="welcome-primary"]) > button:not([data-testid])',
  inactiveDot: '[role="group"][aria-label="Steps"] button:not([aria-current]) > span',
  skip: '[data-testid="welcome"] header button:not([aria-label])',
  close: '[data-testid="welcome"] header button[aria-label]',
};

/**
 * Opens the page and checks each target: mounted when `dark` landed, nothing of it animating then;
 * mounted later, already in the colors it keeps; and nothing animating once the switch is over
 */
const expectNoLightFlash = async (page: Page, url: string, targets: Record<string, string>): Promise<void> => {
  await page.addInitScript((targets: Record<string, string>) => {
    /** The transitions of an element that change a value: only those are visible to the user
        (Chromium may run no-op scrollbar-color transitions with identical keyframes) */
    const changing = (el: Element): string[] =>
      el.getAnimations()
        .filter((a) => {
          const frames = (a.effect as KeyframeEffect).getKeyframes();
          const values = (f: ComputedKeyframe) => JSON.stringify({ ...f, offset: 0, computedOffset: 0, easing: '', composite: '' });
          return frames.length > 1 && values(frames[0]) !== values(frames[frames.length - 1]);
        })
        .map(a => (a as CSSTransition).transitionProperty);
    const colorsOf = (el: Element): string => {
      const style = getComputedStyle(el);
      return JSON.stringify([style.backgroundColor, style.color, style.borderTopColor]);
    };
    const win = window as unknown as { __darkSnapshot: DarkSnapshot };

    new MutationObserver((_records, observer) => {
      if (!document.documentElement.classList.contains('dark')) {return;}
      observer.disconnect();
      const snapshot: DarkSnapshot = {};
      try {
        const controls: Record<string, ControlCheck> = {};
        for (const [name, selector] of Object.entries(targets)) {
          const el = document.querySelector(selector);
          controls[name] = el ? { mountedWhenDark: true, transitions: changing(el) } : { mountedWhenDark: false, transitions: [] };
        }
        snapshot.controls = controls;
        // A control not mounted yet: its colors as it mounts, in the same task, before any frame
        const pending = Object.keys(targets).filter(name => !controls[name].mountedWhenDark);
        if (pending.length > 0) {
          new MutationObserver((_mutations, mountObserver) => {
            for (const name of pending) {
              const el = document.querySelector(targets[name]);
              if (el && controls[name].colorsAtMount === undefined) {
                controls[name].colorsAtMount = colorsOf(el);
              }
            }
            if (pending.every(name => controls[name].colorsAtMount !== undefined)) {mountObserver.disconnect();}
          }).observe(document, { childList: true, subtree: true });
        }
      } catch (err) {
        snapshot.error = String(err);
      }
      win.__darkSnapshot = snapshot;
    // Init scripts run before <html> exists, so observe the whole document
    }).observe(document, { attributes: true, attributeFilter: ['class'], subtree: true });
  }, targets);

  await page.goto(url);
  await expect(page.locator('html')).toHaveClass(/dark/);

  // Once transitions are re-enabled, every control is there and nothing of it is animating
  await expect(page.locator('html')).not.toHaveClass(/theme-switching/);
  for (const selector of Object.values(targets)) {
    await expect(page.locator(selector).first()).toBeAttached();
  }
  const after = await page.evaluate((targets: Record<string, string>) =>
    Object.fromEntries(Object.entries(targets).map(([name, selector]) => {
      const el = document.querySelector(selector);
      const changing = el?.getAnimations().filter((a) => {
        const frames = (a.effect as KeyframeEffect).getKeyframes();
        const values = (f: ComputedKeyframe) => JSON.stringify({ ...f, offset: 0, computedOffset: 0, easing: '', composite: '' });
        return frames.length > 1 && values(frames[0]) !== values(frames[frames.length - 1]);
      });
      const style = el ? getComputedStyle(el) : null;
      return [name, {
        running: changing?.map(a => {
          const frames = (a.effect as KeyframeEffect).getKeyframes();
          return `${(a as CSSTransition).transitionProperty}: ${JSON.stringify(frames[0])} -> ${JSON.stringify(frames[frames.length - 1])}`;
        }) ?? ['<missing>'],
        colors: style ? JSON.stringify([style.backgroundColor, style.color, style.borderTopColor]) : '<missing>'
      }];
    })), targets);

  const snapshot = await page.evaluate(() => (window as unknown as { __darkSnapshot?: DarkSnapshot }).__darkSnapshot);
  expect(snapshot).toBeDefined();
  expect(snapshot?.error).toBeUndefined();
  const controls = snapshot?.controls ?? {};
  expect(Object.keys(controls).sort()).toEqual(Object.keys(targets).sort());

  // Which controls the check at the switch saw, and which it saw mount later: shown in the report
  const mounted = Object.fromEntries(Object.entries(controls).map(([name, check]) => [name, check.mountedWhenDark]));
  test.info().annotations.push({ type: 'mounted when dark landed', description: JSON.stringify(mounted) });

  for (const [name, check] of Object.entries(controls)) {
    if (check.mountedWhenDark) {
      expect(check.transitions, `${name}, mounted when dark landed: nothing animating`).toEqual([]);
    } else {
      expect(check.colorsAtMount, `${name}, mounted after dark landed: its colors as it mounted`).toBe(after[name].colors);
    }
    expect(after[name].running, `${name}, once the switch is over: nothing animating`).toEqual([]);
  }
};

test.describe('Dark theme on open', () => {
  for (const url of ['src/popup.html', 'src/sidepanel.html']) {
    test(`controls are already dark when the dark class is applied (${url})`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, {
        prompts: [createPromptSeed({ id: 'p', title: 'Prompt', content: 'Content' })],
        settings: { theme: 'dark' },
      });

      await expectNoLightFlash(page, `chrome-extension://${extensionId}/${url}`, LIBRARY_TARGETS);
    });

    // My-Prompt-Manager-ojz.11: the Welcome's primary button turns from ink to the accent in dark
    test(`the Welcome's controls are already dark when the dark class is applied (${url})`, async ({ page, storage, extensionId }) => {
      // At step 2, so that Back is there too
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 1 }, settings: { ...DEFAULT_SETTINGS, theme: 'dark' } });

      await expectNoLightFlash(page, `chrome-extension://${extensionId}/${url}`, WELCOME_TARGETS);
      await expect(page.getByTestId('welcome')).toHaveAttribute('data-welcome-step', '1');
    });
  }
});

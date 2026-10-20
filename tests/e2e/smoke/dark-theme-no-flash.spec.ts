/**
 * E2E: opening the extension in dark mode must not flash light controls (My-Prompt-Manager-9zd).
 *
 * useTheme applies the `dark` class after settings load. Controls with `transition-all`
 * used to animate their background light → dark for 200ms. An init script snapshots the
 * running transitions at the exact moment `dark` lands on <html>.
 */

import { test, expect } from '../fixtures/extension';
import { seedLibrary, createPromptSeed } from '../utils/storage';

type DarkSnapshot = { runningTransitions?: Record<string, string[]>; error?: string };

const TARGETS: Record<string, string> = {
  search: 'input[placeholder="Search your prompts..."]',
  activeTab: '[role="tab"][aria-selected="true"]',
  filterButton: 'button[aria-label^="Filter by category"]',
};

test.describe('Dark theme on open', () => {
  for (const url of ['src/popup.html', 'src/sidepanel.html']) {
    test(`controls are already dark when the dark class is applied (${url})`, async ({ page, storage, extensionId }) => {
      await seedLibrary(storage, {
        prompts: [createPromptSeed({ id: 'p', title: 'Prompt', content: 'Content' })],
        settings: { theme: 'dark' },
      });

      await page.addInitScript((targets: Record<string, string>) => {
        new MutationObserver((_records, observer) => {
          if (!document.documentElement.classList.contains('dark')) {return;}
          observer.disconnect();
          const snapshot: DarkSnapshot = {};
          try {
            const runningTransitions: Record<string, string[]> = {};
            for (const [name, selector] of Object.entries(targets)) {
              const el = document.querySelector(selector);
              // Only transitions that actually change a value are visible to the user
              // (Chromium may run no-op scrollbar-color transitions with identical keyframes)
              runningTransitions[name] = el
                ? el.getAnimations()
                    .filter((a) => {
                      const frames = (a.effect as KeyframeEffect).getKeyframes();
                      const values = (f: ComputedKeyframe) => JSON.stringify({ ...f, offset: 0, computedOffset: 0, easing: '', composite: '' });
                      return frames.length > 1 && values(frames[0]) !== values(frames[frames.length - 1]);
                    })
                    .map(a => (a as CSSTransition).transitionProperty)
                : ['<missing>'];
            }
            snapshot.runningTransitions = runningTransitions;
          } catch (err) {
            snapshot.error = String(err);
          }
          (window as unknown as { __darkSnapshot: DarkSnapshot }).__darkSnapshot = snapshot;
        // Init scripts run before <html> exists, so observe the whole document
        }).observe(document, { attributes: true, attributeFilter: ['class'], subtree: true });
      }, TARGETS);

      await page.goto(`chrome-extension://${extensionId}/${url}`);
      await expect(page.locator('html')).toHaveClass(/dark/);

      const snapshot = await page.evaluate(() => (window as unknown as { __darkSnapshot?: DarkSnapshot }).__darkSnapshot);
      expect(snapshot).toBeDefined();
      expect(snapshot?.error).toBeUndefined();
      expect(snapshot?.runningTransitions).toEqual({ search: [], activeTab: [], filterButton: [] });

      // Once transitions are re-enabled, nothing starts animating either
      await expect(page.locator('html')).not.toHaveClass(/theme-switching/);
      const runningAfter = await page.evaluate((targets: Record<string, string>) =>
        Object.fromEntries(Object.entries(targets).map(([name, selector]) => {
          const el = document.querySelector(selector);
          const changing = el?.getAnimations().filter((a) => {
            const frames = (a.effect as KeyframeEffect).getKeyframes();
            const values = (f: ComputedKeyframe) => JSON.stringify({ ...f, offset: 0, computedOffset: 0, easing: '', composite: '' });
            return frames.length > 1 && values(frames[0]) !== values(frames[frames.length - 1]);
          });
          return [name, changing?.map(a => {
            const frames = (a.effect as KeyframeEffect).getKeyframes();
            return `${(a as CSSTransition).transitionProperty}: ${JSON.stringify(frames[0])} -> ${JSON.stringify(frames[frames.length - 1])}`;
          }) ?? ['<missing>']];
        })), TARGETS);
      expect(runningAfter).toEqual({ search: [], activeTab: [], filterButton: [] });
    });
  }
});

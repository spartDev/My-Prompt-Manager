/**
 * E2E: What's new over the Library, in the real extension (My-Prompt-Manager-d1g.11)
 *
 * The spec runs on the copy of the build at 2.0.0, a Release that has Release notes, whatever the
 * manifest's version (fixtures/whats-new-build.ts), as after the update of an existing user from
 * 1.9.0. (Debug mode no longer shows What's new at once: the Welcome comes first,
 * My-Prompt-Manager-ojz.2.) In the
 * popup (400 x 500) and the side panel (360 x 720), light and dark: the sheet rises over a seeded
 * Library with the pill "New in 2.0.0", and after Got it and its exit, the Library is back, the
 * Release marked seen.
 *
 * Proof screenshots, after the entry animation has ended (motion left on, as the other proof specs):
 * whats-new-{popup,sidepanel}-{light,dark}.png and library-after-close-{popup,sidepanel}-{light,dark}.png.
 * They go to test-results/whats-new/; scripts/pr-assets.sh <topic> test-results/whats-new/*.png
 * pushes them for a pull request. Give each pull request its own topic (whats-new-<pr number>):
 * pr-assets/whats-new already holds the images of #575, which a second push there would replace.
 *
 * A sheet with only Critical fixes is not shot: the registry has no such Release, and making one
 * would take a change to product code.
 */

import type { Page } from '@playwright/test';

import type { Category } from '../../../src/types';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { RELEASE_NOTES } from '../../../src/whatsNew/releaseNotes';
import { WHATS_NEW_KEY } from '../../../src/whatsNew/storage';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { WHATS_NEW_UPDATE_EXTENSION_PATH, WHATS_NEW_UPDATE_VERSION } from '../fixtures/whats-new-build';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/whats-new';

/** The notes of the Release the build is updated to */
const notes200 = RELEASE_NOTES.find((notes) => notes.version === '2.0.0') ?? { items: [] };

/** The popup is 400 x 500; the side panel is as wide as the user makes it, 360 here */
const SURFACES = {
  popup: { width: 400, height: 500 },
  sidepanel: { width: 360, height: 720 }
} as const;

const categories: Category[] = [
  { id: 'writing', name: 'Writing', color: '#2563EB' },
  { id: 'code', name: 'Code', color: '#0F766E' },
  { id: 'research', name: 'Research', color: '#D97706' }
];

const prompts = [
  createPromptSeed({ id: 'launch-email', title: 'Launch email', content: 'Write a launch email for {{audience}} in a {{tone}} voice.', category: 'Writing', pinned: true }),
  createPromptSeed({ id: 'code-review', title: 'Code review', content: 'Review this diff for correctness, readability and security.', category: 'Code', usageCount: 12 }),
  createPromptSeed({ id: 'summary', title: 'Summarise a paper', content: 'Summarise this paper in five bullet points for a busy reader.', category: 'Research', usageCount: 4 }),
  createPromptSeed({ id: 'tests', title: 'Write unit tests', content: 'Write unit tests for this function, covering the edge cases.', category: 'Code' }),
  createPromptSeed({ id: 'rewrite', title: 'Plain English', content: 'Rewrite this paragraph in plain English, keeping every fact.', category: 'Writing' })
];

/**
 * Resolves once every finite animation of the page has finished: the sheet and its backdrop have
 * arrived, or left. One on a scroll timeline (the scroll edge of the Library header) or an endless one never
 * finishes, and is left out
 */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)));
  });

/** The opening after the update of an existing user from 1.9.0: a Library, the Welcome done */
const openAfterUpdate = async (
  page: Page,
  storage: ExtensionStorage,
  extensionId: string,
  theme: 'light' | 'dark',
  surface: keyof typeof SURFACES
): Promise<void> => {
  await seedLibrary(storage, { categories, prompts, settings: { theme } });
  await storage.seed({ [WHATS_NEW_KEY]: { installedVersion: '1.9.0' }, [WELCOME_KEY]: { status: 'done' } });
  // The motion is part of the result: whatever the machine's own setting
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize(SURFACES[surface]);
  await page.goto(`chrome-extension://${extensionId}/src/${surface}.html`);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

test.describe("What's new", () => {
  test.use({ extensionPath: WHATS_NEW_UPDATE_EXTENSION_PATH });

  for (const theme of ['light', 'dark'] as const) {
    for (const surface of ['popup', 'sidepanel'] as const) {
      test(`PROOF: after the update to ${WHATS_NEW_UPDATE_VERSION}, its notes over the Library, then Got it gives the Library back (${surface}, ${theme})`, async ({ page, storage, extensionId }) => {
        await openAfterUpdate(page, storage, extensionId, theme, surface);

        const sheet = page.getByRole('dialog', { name: 'What’s new' });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByText('New in 2.0.0', { exact: true })).toBeVisible();
        await expect(sheet.locator('[data-whats-new-grid] > li')).toHaveCount(notes200.items.length);
        await expect(sheet.getByText('Fill-in variables')).toBeVisible();
        await expect(sheet.getByRole('button', { name: 'Got it' })).toBeFocused();
        await animationsDone(page);
        // The pointer off the tiles, so no tile shows its hover
        await page.mouse.move(SURFACES[surface].width - 4, 4);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/whats-new-${surface}-${theme}.png`, animations: 'disabled' });

        await sheet.getByRole('button', { name: 'Got it' }).click();
        await expect(sheet).toHaveCount(0);
        await expect(page.getByTestId('whats-new-backdrop')).toHaveCount(0);
        await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
        await expect(page.getByTestId('prompt-card').filter({ hasText: 'Launch email' })).toBeVisible();
        await animationsDone(page);
        await page.mouse.move(SURFACES[surface].width - 4, 4);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/library-after-close-${surface}-${theme}.png`, animations: 'disabled' });

        // Got it marks the Release seen
        await expect
          .poll(async () => (await storage.get<{ whatsNew?: { lastSeenVersion?: string } }>(WHATS_NEW_KEY)).whatsNew?.lastSeenVersion)
          .toBe(WHATS_NEW_UPDATE_VERSION);
      });
    }
  }
});

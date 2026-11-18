/**
 * E2E: the content of the Welcome's three steps in the real extension (My-Prompt-Manager-ojz.8).
 *
 * - AC5: step 3, with its four Packs in two columns and the Platform pills, fits the 400 x 500 popup
 *   and the narrowest side panel, 320 x 600: the primary button wholly in the viewport, and nothing of
 *   the step to scroll to (every Pack and every pill in view). Steps 1 and 2 fit there too.
 * - More Packs than fit scroll inside the Packs' grid: the pills, the dots and the primary button stay
 *   in view. Packs are compiled in, so the test adds copies of the Pack toggles to the grid's DOM.
 * - Step 2: the blank fills letter by letter in real time, and the card keeps its height while it
 *   does, so the title and the text under it never move.
 * - AC6: light screenshots of the three steps in the popup (400 x 500), the side panel (360 x 720)
 *   and the narrowest side panel (320 x 600), in WELCOME_STEPS_SCREENSHOTS (test-results/welcome-steps
 *   when unset).
 *
 * Each test seeds a pending Welcome over an empty Library.
 */
import fs from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';

const SCREENSHOTS_DIR = process.env.WELCOME_STEPS_SCREENSHOTS ?? 'test-results/welcome-steps';

const SURFACES = {
  popup: { file: 'popup', width: 400, height: 500 },
  sidepanel: { file: 'sidepanel', width: 360, height: 720 },
  narrowSidepanel: { file: 'sidepanel', width: 320, height: 600 }
} as const;

type Surface = keyof typeof SURFACES;

const open = async (page: Page, extensionId: string, surface: Surface): Promise<void> => {
  const { file, width, height } = SURFACES[surface];
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
};

const welcome = (page: Page) => page.getByTestId('welcome');
const primary = (page: Page) => page.getByTestId('welcome-primary');

/** Resolves once every finite animation of the page has ended */
const animationsDone = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline instanceof DocumentTimeline && animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });

/** Whether a box lies wholly inside the viewport */
const expectInView = async (page: Page, locator: Locator, what: string): Promise<void> => {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box, what).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.y, `${what}: top`).toBeGreaterThanOrEqual(0);
    expect(box.x, `${what}: left`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${what}: bottom`).toBeLessThanOrEqual(viewport.height);
    expect(box.x + box.width, `${what}: right`).toBeLessThanOrEqual(viewport.width);
  }
};

/** How far the page, the step's scroll area and the Packs' grid can scroll: 0 when all they hold is in view */
const scrollRoom = (page: Page) =>
  page.evaluate(() => {
    const room = (element: Element | null): number => (element ? element.scrollHeight - element.clientHeight : 0);
    return {
      page: room(document.scrollingElement),
      step: room(document.querySelector('[data-testid="welcome-step"]')?.parentElement ?? null),
      packs: room(document.querySelector('[data-testid="welcome-packs"]'))
    };
  });

test.describe('The Welcome steps in the real extension', () => {
  for (const surface of ['popup', 'narrowSidepanel'] as const) {
    const { width, height } = SURFACES[surface];

    test(`AC5: step 3 fits ${String(width)} x ${String(height)}, the primary button wholly in view with nothing to scroll (${surface})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
      await open(page, extensionId, surface);
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
      await animationsDone(page);

      await expectInView(page, primary(page), 'the primary button');
      await expect(primary(page)).toHaveText(/^Add \d+ prompts$/);
      const packs = page.getByRole('group', { name: 'Packs' }).getByRole('button');
      await expect(packs).toHaveCount(4);
      for (const pack of await packs.all()) {
        await expectInView(page, pack, `the Pack ${(await pack.textContent()) ?? ''}`);
      }
      const pills = page.getByRole('list', { name: 'Works on' }).getByRole('listitem');
      await expect(pills).toHaveCount(6);
      for (const pill of await pills.all()) {
        await expectInView(page, pill, `the pill ${(await pill.textContent()) ?? ''}`);
      }
      await expectInView(page, page.getByRole('heading', { level: 1, name: 'Start with a pack' }), 'the title');
      expect(await scrollRoom(page)).toEqual({ page: 0, step: 0, packs: 0 });

      // Two columns: the first two Packs side by side
      const [first, second] = await Promise.all([packs.nth(0).boundingBox(), packs.nth(1).boundingBox()]);
      expect(first?.y).toBe(second?.y);
      expect((first?.x ?? 0) + (first?.width ?? 0)).toBeLessThan(second?.x ?? 0);
    });

    test(`steps 1 and 2 fit ${String(width)} x ${String(height)} too, nothing to scroll (${surface})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
      await open(page, extensionId, surface);

      for (const step of [0, 1] as const) {
        await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
        await animationsDone(page);
        await expectInView(page, primary(page), `step ${String(step + 1)}: the primary button`);
        await expectInView(page, page.getByRole('heading', { level: 1 }), `step ${String(step + 1)}: the title`);
        expect(await scrollRoom(page), `step ${String(step + 1)}`).toEqual({ page: 0, step: 0, packs: 0 });
        if (step === 0) {
          // The three cards whole, tilts included: none cut by the sides of the step
          const sides = await page.evaluate(() => {
            const area = document.querySelector('[data-testid="welcome-step"]')?.parentElement?.getBoundingClientRect();
            const cards = [...document.querySelectorAll('[data-welcome-card]')].map((card) => card.getBoundingClientRect());
            return { left: area?.left ?? 0, right: area?.right ?? 0, cards: cards.map((card) => ({ left: card.left, right: card.right })) };
          });
          expect(sides.cards).toHaveLength(3);
          for (const card of sides.cards) {
            expect(card.left, 'a card: left').toBeGreaterThanOrEqual(sides.left);
            expect(card.right, 'a card: right').toBeLessThanOrEqual(sides.right);
          }
        }
        await primary(page).click();
      }
    });

    test(`more Packs than fit scroll inside their grid; the pills and the primary button stay in view (${surface})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 } });
      await open(page, extensionId, surface);
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
      await animationsDone(page);

      // Twelve more Packs: copies of the four toggles, added to the grid as later Releases would offer them
      await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="welcome-packs"]');
        const toggles = [...(grid?.children ?? [])];
        for (let copy = 0; copy < 3; copy++) {
          for (const toggle of toggles) {
            grid?.append(toggle.cloneNode(true));
          }
        }
      });
      await expect(page.getByRole('group', { name: 'Packs' }).getByRole('button')).toHaveCount(16);

      const room = await scrollRoom(page);
      expect(room.packs, 'the grid scrolls').toBeGreaterThan(0);
      expect(room.step, 'the step itself does not').toBe(0);
      expect(room.page, 'nor the page').toBe(0);
      await expectInView(page, primary(page), 'the primary button');
      await expectInView(page, page.getByRole('list', { name: 'Works on' }), 'the pills');
      await expectInView(page, page.getByRole('group', { name: 'Steps' }), 'the dots');
      await expectInView(page, page.getByRole('heading', { level: 1, name: 'Start with a pack' }), 'the title');
    });
  }

  for (const surface of ['popup', 'narrowSidepanel'] as const) {
    test(`step 2: the blank fills letter by letter in real time, and the card keeps its height while it does (${surface})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 1 } });
      await open(page, extensionId, surface);
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', '1');
      // The font in, so a late swap does not move what is measured
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const blank = page.getByTestId('welcome-blank');
      const title = page.getByRole('heading', { level: 1, name: 'Leave blanks, fill them later' });
      // Where the card's sentence and the title are, at each change of the blank, over a whole cycle
      const samples = await page.evaluate(
        () =>
          new Promise<Array<{ text: string; cardHeight: number; titleTop: number }>>((resolve) => {
            const blankElement = document.querySelector('[data-testid="welcome-blank"]');
            const titleElement = document.querySelector('[data-welcome-title]');
            const card = blankElement?.closest('p')?.parentElement;
            const seen: Array<{ text: string; cardHeight: number; titleTop: number }> = [];
            const sample = (): void => {
              seen.push({
                text: blankElement?.textContent ?? '',
                cardHeight: card?.getBoundingClientRect().height ?? -1,
                titleTop: titleElement?.getBoundingClientRect().top ?? -1
              });
            };
            sample();
            const observer = new MutationObserver(sample);
            if (blankElement) {
              observer.observe(blankElement, { childList: true, characterData: true, subtree: true });
            }
            // One cycle: 21 letters at 85ms, the hold, and the start of the next
            setTimeout(() => {
              observer.disconnect();
              resolve(seen);
            }, 3600);
          })
      );

      const texts = samples.map((sample) => sample.text);
      expect(texts).toContain('Claire, Head of Sales');
      expect(texts).toContain('Claire');
      expect(new Set(samples.map((sample) => sample.cardHeight)).size, `card heights ${JSON.stringify(samples.map((sample) => sample.cardHeight))}`).toBe(1);
      expect(new Set(samples.map((sample) => sample.titleTop)).size, 'title positions').toBe(1);
      await expect(title).toBeVisible();
      await expect(blank).toBeVisible();
    });
  }

  for (const surface of ['popup', 'sidepanel', 'narrowSidepanel'] as const) {
    test(`AC6: PROOF, light screenshots of the three steps (${surface})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 } });
      await open(page, extensionId, surface);
      await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
      const { width, height } = SURFACES[surface];

      for (const step of [0, 1, 2] as const) {
        await expect(welcome(page)).toHaveAttribute('data-welcome-step', String(step));
        await animationsDone(page);
        if (step === 1) {
          // The blank whole, as the mockup shows it
          await expect(page.getByTestId('welcome-blank')).toHaveText('Claire, Head of Sales');
        }
        await expectInView(page, primary(page), `step ${String(step + 1)}: the primary button`);
        // The pointer off the controls, so none shows its hover
        await page.mouse.move(width / 2, 4);
        await page.screenshot({
          path: `${SCREENSHOTS_DIR}/steps-${surface}-${String(width)}x${String(height)}-step${String(step + 1)}-light.png`,
          animations: 'disabled'
        });
        if (step < 2) {
          await primary(page).click();
        }
      }
    });
  }
});

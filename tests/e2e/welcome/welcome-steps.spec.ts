/**
 * E2E: the content of the Welcome's three steps in the real extension (My-Prompt-Manager-ojz.8).
 *
 * - AC5: step 3, with its four Packs in two columns and the Platform pills, fits the 400 x 500 popup
 *   and the narrowest side panel, 320 x 600: the primary button wholly in the viewport, and nothing of
 *   the step to scroll to (every Pack and every pill in view). Steps 1 and 2 fit there too.
 * - AC2 of My-Prompt-Manager-ojz.19: step 3's caption "Type // in the chat on" and the pills after it
 *   whole and in view, the primary button in view, in the popup (400 x 500) and a side panel of
 *   360 x 600, light and dark, with a screenshot of each in WELCOME_STEPS_SCREENSHOTS (the short side
 *   panels, with the Packs' scroll cue, are in welcome-a11y.spec.ts).
 * - More Packs than fit scroll inside the Packs' grid: the pills, the dots and the primary button stay
 *   in view. Packs are compiled in, so the test adds copies of the Pack toggles to the grid's DOM.
 * - Step 2: the blank fills letter by letter in real time, and the card keeps its height while it
 *   does, so the title and the text under it never move.
 * - Step 2's card casts its shadow whole: the step's area clips sideways at the screen's edge, past
 *   the reach of the shadow. Step 3's Packs line up with the title and the pills, and a focused
 *   Pack's outline is drawn whole, clipped neither by the grid nor by the step's area
 *   (My-Prompt-Manager-ojz.11).
 * - AC6, and AC3 of My-Prompt-Manager-ojz.11: light and dark screenshots of the three steps in the
 *   popup (400 x 500), the side panel (360 x 720) and the narrowest side panel (320 x 600), and of
 *   step 3's Packs with the first one focused, in WELCOME_STEPS_SCREENSHOTS (test-results/welcome-steps
 *   when unset).
 *
 * Each test seeds a pending Welcome over an empty Library.
 */
import fs from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import { DEFAULT_SETTINGS } from '../../../src/types';
import { WELCOME_KEY } from '../../../src/welcome/storage';
import { expect, test } from '../fixtures/extension';
import { PLATFORMS_CAPTION as CAPTION, expectPlatformsRowWhole } from '../utils/welcomePlatforms';

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
      const pills = page.getByRole('list', { name: CAPTION }).getByRole('listitem');
      await expect(pills).toHaveCount(6);
      for (const pill of await pills.all()) {
        await expectInView(page, pill, `the pill ${(await pill.textContent()) ?? ''}`);
      }
      // The caption before them, whole (My-Prompt-Manager-ojz.19)
      await expectPlatformsRowWhole(page, surface);
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
      // The list takes no box of its own: its row, with the caption, is what shows
      await expectInView(page, page.getByTestId('welcome-platforms'), 'the caption and the pills');
      await expectInView(page, page.getByRole('group', { name: 'Steps' }), 'the dots');
      await expectInView(page, page.getByRole('heading', { level: 1, name: 'Start with a pack' }), 'the title');
    });

    test(`step 2's card shadow fades out before the step's clip; step 3's Packs line up with the title and the pills, their focus outline whole (${surface})`, async ({ page, storage, extensionId }) => {
      await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 1 } });
      await open(page, extensionId, surface);
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', '1');
      await animationsDone(page);

      // A shadow reaches past the card's sides by its blur, plus its spread and its offset (0 18px 36px -22px: 14px)
      const shadow = await page.evaluate(() => {
        const card = document.querySelector('[data-testid="welcome-blank"]')?.closest('.shadow-welcome-demo');
        const clip = document.querySelector('[data-testid="welcome-step"]')?.parentElement;
        if (!card || !clip) {
          return null;
        }
        const reach = Math.max(
          ...[...getComputedStyle(card).boxShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px (-?[\d.]+)px/g)].map(([, x, , blur, spread]) =>
            Math.max(0, Number(blur) + Number(spread) + Math.abs(Number(x)))
          )
        );
        const [cardBox, clipBox] = [card.getBoundingClientRect(), clip.getBoundingClientRect()];
        return { reach, left: cardBox.left - clipBox.left, right: clipBox.right - cardBox.right };
      });
      expect(shadow).not.toBeNull();
      expect(shadow?.reach, 'the card casts a shadow').toBeGreaterThan(0);
      expect(shadow?.left, 'room for the shadow on the left').toBeGreaterThanOrEqual(shadow?.reach ?? Infinity);
      expect(shadow?.right, 'room for the shadow on the right').toBeGreaterThanOrEqual(shadow?.reach ?? Infinity);

      await primary(page).click();
      await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
      await animationsDone(page);

      const layout = await page.evaluate(() => {
        const box = (element: Element | null | undefined) => {
          const rect = element?.getBoundingClientRect();
          return { left: rect?.left ?? NaN, right: rect?.right ?? NaN, top: rect?.top ?? NaN, bottom: rect?.bottom ?? NaN };
        };
        const grid = document.querySelector('[data-testid="welcome-packs"]');
        const packs = [...(grid?.querySelectorAll('button') ?? [])];
        // Each Pack focused in turn: its outline drawn past its box by its width and its offset
        const outlines = packs.map((pack) => {
          pack.focus();
          const style = getComputedStyle(pack);
          const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
          const rect = box(pack);
          return { ring, left: rect.left - ring, right: rect.right + ring, top: rect.top - ring, bottom: rect.bottom + ring };
        });
        (document.activeElement as HTMLElement | null)?.blur();
        return {
          title: box(document.querySelector('[data-welcome-title]')),
          pills: box(document.querySelector('[data-testid="welcome-platforms"]')),
          grid: box(grid),
          clip: box(document.querySelector('[data-testid="welcome-step"]')?.parentElement),
          packs: packs.map(box),
          outlines
        };
      });

      expect(layout.packs).toHaveLength(4);
      expect(Math.min(...layout.packs.map((pack) => pack.left)), 'the Packs start where the title starts').toBeCloseTo(layout.title.left, 0);
      expect(Math.max(...layout.packs.map((pack) => pack.right)), 'the Packs end where the title ends').toBeCloseTo(layout.title.right, 0);
      expect(layout.pills.left, 'the pills span the title too').toBeCloseTo(layout.title.left, 0);
      expect(layout.pills.right).toBeCloseTo(layout.title.right, 0);
      for (const [index, outline] of layout.outlines.entries()) {
        const what = `Pack ${String(index + 1)} focused`;
        expect(outline.ring, `${what}: its outline drawn`).toBeGreaterThan(0);
        // The grid and the step's area clip what lies past their sides
        for (const [name, clip] of [['the grid', layout.grid], ["the step's area", layout.clip]] as const) {
          expect(outline.left, `${what}: left, inside ${name}`).toBeGreaterThanOrEqual(clip.left);
          expect(outline.right, `${what}: right, inside ${name}`).toBeLessThanOrEqual(clip.right);
          expect(outline.top, `${what}: top, inside ${name}`).toBeGreaterThanOrEqual(clip.top);
          expect(outline.bottom, `${what}: bottom, inside ${name}`).toBeLessThanOrEqual(clip.bottom);
        }
      }
    });
  }

  // AC2 of My-Prompt-Manager-ojz.19: the caption "Type // in the chat on" before the pills fits. The
  // short side panels (320 x 500, 320 x 420), where the Packs' grid scrolls with its cue, are measured
  // with that cue in tests/e2e/welcome/welcome-a11y.spec.ts
  for (const { file, width, height } of [
    { file: 'popup', width: 400, height: 500 },
    { file: 'sidepanel', width: 360, height: 600 }
  ] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`step 3's caption and pills whole, the primary button in view, ${file} ${String(width)} x ${String(height)}, ${theme}`, async ({ page, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 2 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.setViewportSize({ width, height });
        await page.goto(`chrome-extension://${extensionId}/src/${file}.html`);
        if (theme === 'dark') {
          await expect(page.locator('html')).toHaveClass(/\bdark\b/);
        } else {
          await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
        }
        await expect(welcome(page)).toHaveAttribute('data-welcome-step', '2');
        await animationsDone(page);

        const layout = await expectPlatformsRowWhole(page, `${file} ${String(width)} x ${String(height)} ${theme}`);
        test.info().annotations.push({ type: 'platforms row', description: JSON.stringify({ lines: layout.lines, row: layout.row, caption: layout.caption, primary: layout.primary }) });
        // Where the Packs fit, nothing to scroll: every Pack in view with the row
        expect(await scrollRoom(page)).toEqual({ page: 0, step: 0, packs: 0 });

        await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
        await page.mouse.move(width / 2, 4);
        await page.screenshot({ path: `${SCREENSHOTS_DIR}/${file}-${String(width)}x${String(height)}-step3-caption-${theme}.png`, animations: 'disabled' });
      });
    }
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

  // Light (My-Prompt-Manager-ojz.8 AC6) and dark (My-Prompt-Manager-ojz.11 AC3)
  for (const theme of ['light', 'dark'] as const) {
    for (const surface of ['popup', 'sidepanel', 'narrowSidepanel'] as const) {
      test(`PROOF, ${theme} screenshots of the three steps (${surface})`, async ({ page, storage, extensionId }) => {
        await storage.seed({ [WELCOME_KEY]: { status: 'pending', step: 0 }, settings: { ...DEFAULT_SETTINGS, theme } });
        await open(page, extensionId, surface);
        if (theme === 'dark') {
          await expect(page.locator('html')).toHaveClass(/\bdark\b/);
        } else {
          await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
        }
        await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
        const { width, height } = SURFACES[surface];
        const name = (what: string) => `${SCREENSHOTS_DIR}/steps-${surface}-${String(width)}x${String(height)}-${what}-${theme}.png`;

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
          await page.screenshot({ path: name(`step${String(step + 1)}`), animations: 'disabled' });
          if (step < 2) {
            await primary(page).click();
          }
        }

        // The Packs, the first one focused from the keyboard: its outline whole, the Packs lined up with the pills
        const packs = page.getByRole('group', { name: 'Packs' });
        await packs.getByRole('button').first().focus();
        const box = await packs.boundingBox();
        if (box) {
          await page.screenshot({
            path: name('step3-packs-focused'),
            animations: 'disabled',
            clip: { x: 0, y: Math.max(0, box.y - 12), width, height: Math.min(height - Math.max(0, box.y - 12), box.height + 64) }
          });
        }
      });
    }
  }
});

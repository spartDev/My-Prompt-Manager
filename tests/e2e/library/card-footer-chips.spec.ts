/**
 * E2E: the chips of a Prompt card's footer never collide (My-Prompt-Manager-n4bu)
 *
 * In a side panel 320px wide, the first card of the Library a new user sees after the Welcome had its
 * Category cut to two letters with no ellipsis, and its "2 variables" chip drawn over "Never used".
 * At each width a side panel takes (320 to 480) and in the popup (400 x 500), light and dark, every
 * card's footer is read from the page:
 * - the Category chip, the Variables chip, the use count, Copy and Share overlap none of the others,
 *   and all stay inside the card's padding;
 * - each piece of text is whole, or cut with an ellipsis that shows: the box that cuts it is a block
 *   container with `text-overflow: ellipsis` (a flex container never draws one), wide enough for its
 *   first letter and the ellipsis;
 * - at 480px, where every Category has 6rem and more beside the rest, every footer stays on one line.
 * Screenshots of the side panel at 320 x 600, light and dark, in CARD_CHIPS_SCREENSHOTS
 * (test-results/card-footer-chips when unset), named for scripts/pr-assets.sh: the first card (the
 * 50-character Category), and the Product Pack's first Prompt as the Welcome's exit leaves it.
 */

import path from 'node:path';

import type { Page } from '@playwright/test';

import type { Category, Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = process.env.CARD_CHIPS_SCREENSHOTS ?? 'test-results/card-footer-chips';

/** A Category name of the 50 characters a name may have */
const LONG_CATEGORY = 'Customer research, interviews and usability tests';

const categories: Category[] = [
  { id: 'research', name: LONG_CATEGORY, color: '#7C3AED' },
  { id: 'product', name: 'Product', color: '#2563EB' },
  { id: 'eng', name: 'Engineering', color: '#047857' },
];

const now = Date.now();

/** Newest first: the Library lists by last update, so the long Category is the first card */
const prompts: Prompt[] = [
  createPromptSeed({
    id: 'long-category',
    title: 'Interview guide for a discovery call',
    content: 'Write an interview guide about {{topic}} for {{persona}}, with ten open questions.',
    category: LONG_CATEGORY,
    updatedAt: now,
  }),
  // The first Prompt of the Welcome's Product Pack, as the exit leaves it: 2 Variables, never used
  createPromptSeed({
    id: 'product-prd',
    title: 'PRD from a rough idea',
    content: 'Act as a senior product manager.\n\nIdea: {{idea}}\nTarget users: {{target_users}}',
    category: 'Product',
    updatedAt: now - 1000,
  }),
  createPromptSeed({
    id: 'many-uses',
    title: 'Code review checklist',
    content: 'Review {{a}} {{b}} {{c}} {{d}} {{e}} {{f}} {{g}} {{h}} {{i}} {{j}} {{k}} {{l}}.',
    category: 'Engineering',
    usageCount: 1234,
    updatedAt: now - 2000,
  }),
  createPromptSeed({
    id: 'no-variables',
    title: 'Release notes',
    content: 'Turn these merged pull requests into release notes.',
    category: LONG_CATEGORY,
    usageCount: 18,
    updatedAt: now - 3000,
  }),
];

const SIDE_PANEL_WIDTHS = [320, 360, 400, 480] as const;

/** One piece of a card's footer as the page lays it out */
interface FooterPiece {
  name: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** The text the piece shows, when it shows one */
  text: string | null;
  /** How the text fits: whole, cut with an ellipsis that shows, or cut without one */
  fit: 'whole' | 'ellipsis' | 'cut' | null;
  /** Why a cut text has no ellipsis that shows */
  why: string | null;
}

interface CardFooter {
  title: string;
  /** The card's box less its border and padding */
  content: { left: number; right: number };
  pieces: FooterPiece[];
}

/** Reads every card's footer: its pieces' boxes, and how each text fits in the box that cuts it */
const readFooters = (page: Page): Promise<CardFooter[]> =>
  page.getByTestId('prompt-card').evaluateAll((cards) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    const widthOf = (text: string, element: Element): number => {
      if (context === null) {
        return 0;
      }
      context.font = getComputedStyle(element).font;
      return context.measureText(text).width;
    };

    const contentBox = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const inset = (side: 'Left' | 'Right') =>
        Number.parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) +
        Number.parseFloat(style.getPropertyValue(`padding-${side.toLowerCase()}`));
      return { left: box.left + inset('Left'), right: box.right - inset('Right') };
    };

    /** How a text node fits: the nearest ancestor that clips it decides, and draws the ellipsis or not */
    const fitOf = (piece: Element): Pick<FooterPiece, 'text' | 'fit' | 'why'> => {
      const walker = document.createTreeWalker(piece, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node !== null && (node.textContent ?? '').trim() === '') {
        node = walker.nextNode();
      }
      if (node === null) {
        return { text: null, fit: null, why: null };
      }
      const text = node.textContent ?? '';
      const range = document.createRange();
      range.selectNodeContents(node);
      const laidOut = range.getBoundingClientRect();
      let clipper: Element | null = node.parentElement;
      while (clipper !== null && clipper !== piece.parentElement) {
        if (getComputedStyle(clipper).overflowX !== 'visible') {
          break;
        }
        clipper = clipper.parentElement;
      }
      if (clipper === null || clipper === piece.parentElement) {
        return { text, fit: 'whole', why: null };
      }
      const room = contentBox(clipper);
      if (laidOut.left >= room.left - 0.5 && laidOut.right <= room.right + 0.5) {
        return { text, fit: 'whole', why: null };
      }
      const style = getComputedStyle(clipper);
      const firstLetterAndEllipsis = widthOf(`${Array.from(text)[0] ?? ''}…`, clipper);
      const reasons: string[] = [];
      if (style.textOverflow !== 'ellipsis') {
        reasons.push(`text-overflow is ${style.textOverflow}`);
      }
      if (/flex|grid/.test(style.display)) {
        reasons.push(`its box is ${style.display}, which draws no ellipsis`);
      }
      if (style.whiteSpace !== 'nowrap') {
        reasons.push(`white-space is ${style.whiteSpace}`);
      }
      if (room.right - room.left < firstLetterAndEllipsis - 0.5) {
        reasons.push(
          `${(room.right - room.left).toFixed(1)}px of room, under the ${firstLetterAndEllipsis.toFixed(1)}px of a letter and the ellipsis`
        );
      }
      return reasons.length === 0
        ? { text, fit: 'ellipsis', why: null }
        : { text, fit: 'cut', why: reasons.join('; ') };
    };

    return cards.map((card) => {
      const named = (name: string, element: Element | null): FooterPiece[] => {
        if (element === null) {
          return [];
        }
        const box = element.getBoundingClientRect();
        return [{ name, left: box.left, right: box.right, top: box.top, bottom: box.bottom, ...fitOf(element) }];
      };
      const footer = card.querySelector('[data-testid="prompt-card-footer"]');
      const usage = Array.from(footer?.querySelectorAll('span') ?? []).find((span) =>
        /^(Never used|\d+ uses?)$/.test((span.textContent ?? '').trim())
      );
      return {
        title: card.querySelector('h3')?.getAttribute('aria-label') ?? '',
        content: contentBox(card),
        pieces: [
          ...named('Category', card.querySelector('[title^="Category: "]')),
          ...named('Variables', card.querySelector('[data-testid="prompt-variables-chip"]')),
          ...named('use count', usage ?? null),
          ...named('Copy', card.querySelector('button[aria-label^="Copy content of"]')),
          ...named('Share', card.querySelector('button[aria-label^="Share "]')),
        ],
      };
    });
  });

/** Every overlap, piece outside the card's padding and text cut with no ellipsis, as sentences */
const problemsOf = (footers: CardFooter[]): string[] =>
  footers.flatMap(({ title, content, pieces }) => {
    const problems: string[] = [];
    for (const piece of pieces) {
      if (piece.left < content.left - 0.5 || piece.right > content.right + 0.5) {
        problems.push(
          `${title}: ${piece.name} [${piece.left.toFixed(1)}, ${piece.right.toFixed(1)}] leaves the card's padding [${content.left.toFixed(1)}, ${content.right.toFixed(1)}]`
        );
      }
      if (piece.fit === 'cut') {
        problems.push(`${title}: ${piece.name} "${piece.text ?? ''}" is cut with no ellipsis (${piece.why ?? ''})`);
      }
    }
    pieces.forEach((a, index) => {
      for (const b of pieces.slice(index + 1)) {
        const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (across > 0.5 && down > 0.5) {
          problems.push(`${title}: ${a.name} and ${b.name} overlap by ${across.toFixed(1)}px`);
        }
      }
    });
    return problems;
  });

const seed = (storage: ExtensionStorage, theme: 'light' | 'dark') =>
  seedLibrary(storage, { prompts, categories, settings: { theme } });

const openLibrary = async (page: Page, extensionId: string, surface: 'sidepanel' | 'popup', width: number, height: number) => {
  await page.setViewportSize({ width, height });
  await page.goto(`chrome-extension://${extensionId}/src/${surface}.html`);
  await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
  await expect(page.getByTestId('prompt-card').first()).toContainText('Interview guide for a discovery call');
  // The cards rise in: read them at rest, and with the font they are drawn in. Scroll-driven
  // animations (the scroll lines) stay running with no input, and are left out
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.timeline === document.timeline)
      .every((animation) => animation.playState !== 'running')
  );
};

test.describe('Prompt card footer chips', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of SIDE_PANEL_WIDTHS) {
      test(`side panel ${String(width)} x 600 (${theme}): no chip overlaps another, each whole or cut with an ellipsis`, async ({ page, storage, extensionId }) => {
        await seed(storage, theme);
        await openLibrary(page, extensionId, 'sidepanel', width, 600);
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);

        const footers = await readFooters(page);
        test.info().annotations.push({ type: 'footers', description: JSON.stringify(footers) });
        if (width === 320) {
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `library-chips-sidepanel-320-${theme}.png`),
            animations: 'disabled',
          });
        }

        // The first card shows its Category, Variables and Never used, then Copy and Share
        const first = footers[0];
        expect(first.pieces.map((piece) => piece.name)).toEqual(['Category', 'Variables', 'use count', 'Copy', 'Share']);
        expect(first.pieces.map((piece) => piece.text)).toEqual([LONG_CATEGORY, '2 variables', 'Never used', null, null]);
        expect(problemsOf(footers)).toEqual([]);

        // The Welcome's own case: the Product Pack's first Prompt, as the exit leaves it
        if (width === 320) {
          await page.getByTestId('prompt-card').nth(1).scrollIntoViewIfNeeded();
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `library-chips-pack-card-sidepanel-320-${theme}.png`),
            animations: 'disabled',
          });
        }

        // A footer wraps only for want of room: 480px leaves every Category 6rem and more beside the rest
        if (width === 480) {
          expect(footers.map(({ title }) => title)).toEqual(prompts.map(({ title }) => title));
          for (const { title, pieces } of footers) {
            const middles = pieces.map((piece) => (piece.top + piece.bottom) / 2);
            expect(Math.max(...middles) - Math.min(...middles), `${title}: one line`).toBeLessThan(1);
          }
        }
      });
    }

    test(`popup 400 x 500 (${theme}): no chip overlaps another, each whole or cut with an ellipsis`, async ({ page, storage, extensionId }) => {
      await seed(storage, theme);
      await openLibrary(page, extensionId, 'popup', 400, 500);

      const footers = await readFooters(page);
      test.info().annotations.push({ type: 'footers', description: JSON.stringify(footers) });
      expect(problemsOf(footers)).toEqual([]);
    });
  }
});

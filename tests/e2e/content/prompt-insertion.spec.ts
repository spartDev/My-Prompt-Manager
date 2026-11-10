/**
 * E2E: around an Insertion on Platforms (My-Prompt-Manager-q9j.3)
 *
 * Runs the built extension's content script on a stand-in page of each of the seven Platforms.
 * Proves that typing `//` opens the Prompt selector (and that the `//` of a URL does not), that
 * an Insertion is confirmed by a pill with Undo and a sweep over the input field, that Undo puts
 * back exactly the text the field held, that the pill leaves when the user types, and that a
 * failed Insertion is said. The same flow runs on a custom site in custom-site.spec.ts.
 * Captures light and dark screenshots (test-results/prompt-insertion/).
 */

import type { Page } from '@playwright/test';

import { DEFAULT_SETTINGS, type Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { expectInsertionFlow, fieldText, insertionPill, insertionSweep, undoButton } from '../fixtures/insertion-flow';
import { openPlatform, PLATFORM_FIELD, PLATFORM_FIXTURES, type PlatformFixture, promptRow, promptSelector, promptsButton } from '../fixtures/platform-pages';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/prompt-insertion';

const categories = [createCategorySeed({ name: 'Writing', color: '#2563EB' })];

const review = createPromptSeed({ id: 'review', title: 'Review a diff', content: 'Review this diff like a senior developer.', category: 'Writing' });
const multiline = createPromptSeed({ id: 'notes', title: 'Meeting notes to decisions', content: 'Turn these notes into:\n- decisions\n- owners', category: 'Writing' });
const prompts: Prompt[] = [review, multiline];

const seed = async (storage: ExtensionStorage, theme: 'light' | 'dark' = 'light') => {
  await seedLibrary(storage, { prompts, categories, settings: { ...DEFAULT_SETTINGS, interfaceMode: 'popup', theme } });
};

const field = (page: Page, platform: PlatformFixture) => page.locator(PLATFORM_FIELD[platform]);

const enterKeys = (page: Page) => page.evaluate(() => (window as unknown as { __enterKeys: number }).__enterKeys);

/**
 * Opens the selector by typing // in the field, and inserts a Prompt with the mouse. `typed` is
 * ' //' when the field already holds text: // right after a word opens nothing.
 */
const insertByTyping = async (page: Page, platform: PlatformFixture, promptId: string, typed = '//') => {
  await field(page, platform).click();
  await page.keyboard.type(typed);
  await expect(promptSelector(page)).toBeVisible();
  await promptRow(page, promptId).click();
  await expect(insertionPill(page)).toBeVisible();
};

test.describe('Insertion on each Platform', () => {
  for (const platform of PLATFORM_FIXTURES) {
    test(`${platform}: // opens the selector, the Insertion is confirmed and undone, a failure is said`, async ({ context, storage }) => {
      await seed(storage);
      const page = await openPlatform(context, platform);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await expect(promptsButton(page)).toHaveCount(1);

      await expectInsertionFlow(page, {
        field: field(page, platform),
        prompt: review,
        usageCount: async () => (await storage.getPrompts()).find((prompt) => prompt.id === review.id)?.usageCount ?? 0,
      });

      expect(errors).toEqual([]);
    });

    test(`${platform}: by keyboard alone, and Undo restores several lines`, async ({ context, storage }) => {
      await seed(storage);
      const page = await openPlatform(context, platform);
      await expect(promptsButton(page)).toHaveCount(1);
      const input = field(page, platform);

      // The field holds text before the Insertion
      await input.click();
      await page.keyboard.type('Keep this  text ');
      const before = await fieldText(input);
      expect(before).toBe('Keep this  text ');

      // // then Enter: the first Prompt of the list is inserted, and no Enter reaches the Platform
      await page.keyboard.type('//');
      await expect(promptSelector(page)).toBeVisible();
      await expect(promptRow(page, 'review')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Enter');
      await expect(promptSelector(page)).toBeHidden();
      await expect.poll(() => fieldText(input)).toBe(review.content);
      await expect(insertionPill(page)).toBeVisible();
      expect(await enterKeys(page)).toBe(0);

      // Undo by keyboard: the button takes the focus and Enter presses it
      await undoButton(page).focus();
      await page.keyboard.press('Enter');
      await expect(insertionPill(page)).toBeHidden();
      await expect.poll(() => fieldText(input)).toBe(before);
      await expect(input).toBeFocused();
      expect(await enterKeys(page)).toBe(0);
    });
  }
});

test.describe('Insertion confirmation: time and motion', () => {
  test('the pill stays 2.8s, longer while it is hovered, and the sweep is drawn in the shadow root over the field', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude');
    // Room above the input field for the pill
    await page.addStyleTag({ content: 'main { margin-top: 120px; }' });
    await expect(promptsButton(page)).toHaveCount(1);
    const input = field(page, 'claude');

    await insertByTyping(page, 'claude', 'review');
    const shown = Date.now();
    const pill = insertionPill(page);

    // The pill is a status, above the field on its right; the sweep covers the field exactly
    await pill.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    const fieldBox = await input.boundingBox();
    const pillBox = await pill.boundingBox();
    const sweepBox = await insertionSweep(page).boundingBox();
    expect(fieldBox && pillBox && sweepBox).toBeTruthy();
    if (fieldBox && pillBox && sweepBox) {
      expect(Math.abs(pillBox.x + pillBox.width - (fieldBox.x + fieldBox.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(pillBox.y + pillBox.height - (fieldBox.y - 10))).toBeLessThanOrEqual(1);
      expect(Math.abs(sweepBox.x - fieldBox.x) + Math.abs(sweepBox.y - fieldBox.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(sweepBox.width - fieldBox.width) + Math.abs(sweepBox.height - fieldBox.height)).toBeLessThanOrEqual(1);
    }
    await expect(insertionSweep(page)).toHaveCSS('pointer-events', 'none');
    await expect(insertionSweep(page)).toHaveAttribute('aria-hidden', 'true');
    expect(await page.evaluate(() => document.querySelector('.mpm-sweep, .mpm-inserted'))).toBeNull();

    // It leaves by itself, not before 2.8s
    await expect(pill).toBeHidden({ timeout: 5000 });
    expect(Date.now() - shown).toBeGreaterThanOrEqual(2800);

    // Hovered, it stays; it leaves 2.8s after the pointer has gone
    await insertByTyping(page, 'claude', 'review', ' //');
    await pill.hover();
    await page.waitForTimeout(3600);
    await expect(pill).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(pill).toBeHidden({ timeout: 5000 });

    // Focused, it stays
    await insertByTyping(page, 'claude', 'review', ' //');
    await undoButton(page).focus();
    await page.waitForTimeout(3600);
    await expect(pill).toBeVisible();
  });

  test('under reduced motion there is no sweep, and the pill still confirms', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'claude');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(promptsButton(page)).toHaveCount(1);

    await insertByTyping(page, 'claude', 'review');

    await expect(insertionPill(page)).toContainText('Inserted “Review a diff”');
    await expect(insertionPill(page)).toHaveCSS('animation-duration', '0.001s');
    await expect(insertionSweep(page)).toHaveCount(0);

    // The field is at the top of the window, with no room above it: the pill goes below.
    // Measured once its entry has run: even at 1ms it starts 14px higher
    await insertionPill(page).evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
    const fieldBox = await field(page, 'claude').boundingBox();
    const pillBox = await insertionPill(page).boundingBox();
    expect(fieldBox && pillBox).toBeTruthy();
    if (fieldBox && pillBox) {
      expect(fieldBox.y).toBeLessThan(48);
      expect(Math.abs(pillBox.y - (fieldBox.y + fieldBox.height + 10))).toBeLessThanOrEqual(1);
    }
  });

  test('a Prompt of several lines is inserted, then undone back to an empty field', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'copilot');
    await expect(promptsButton(page)).toHaveCount(1);
    const input = field(page, 'copilot');

    await insertByTyping(page, 'copilot', 'notes');
    await expect(input).toHaveValue(multiline.content);

    await undoButton(page).click();
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
  });
});

test.describe('// on a new line', () => {
  for (const platform of ['claude', 'gemini', 'copilot'] as const) {
    test(`${platform}: // typed at the start of a second line opens the selector and is removed`, async ({ context, storage }) => {
      await seed(storage);
      const page = await openPlatform(context, platform);
      await expect(promptsButton(page)).toHaveCount(1);
      const input = field(page, platform);

      await input.click();
      await page.keyboard.type('First line');
      await page.keyboard.press('Shift+Enter');
      await page.keyboard.type('//');

      await expect(promptSelector(page)).toBeVisible();
      expect((await fieldText(input)).replace(/\s+$/, '')).toBe('First line');
      expect(await fieldText(input)).not.toContain('//');
    });
  }
});

test.describe('// in a field that collapses spaces', () => {
  // The stand-in fields keep spaces as typed (white-space: pre-wrap), as ProseMirror does. Without
  // it Chrome turns the space left at the end of the line into a non-breaking one when the // goes
  test('mistral: // after a space opens the selector in a contenteditable with white-space: normal', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'mistral');
    await page.addStyleTag({ content: '.field { white-space: normal; }' });
    await expect(promptsButton(page)).toHaveCount(1);
    const input = field(page, 'mistral');

    await input.click();
    await page.keyboard.type('Hello //');

    await expect(promptSelector(page)).toBeVisible();
    expect((await fieldText(input)).replace(/\u00a0/g, ' ')).toBe('Hello ');
  });
});

test.describe('Insertion on a React-controlled field', () => {
  test('chatgpt: React hears the // being removed, the Insertion and the Undo', async ({ context, storage }) => {
    await seed(storage);
    const page = await openPlatform(context, 'chatgpt');
    await expect(promptsButton(page)).toHaveCount(1);
    // What React's own state holds, not only the DOM value
    const state = page.locator('#composer-state');

    await field(page, 'chatgpt').click();
    await page.keyboard.type('Hello //');
    await expect(promptSelector(page)).toBeVisible();
    await expect(state).toHaveText('Hello ', { useInnerText: false });

    await promptRow(page, 'review').click();
    await expect(insertionPill(page)).toBeVisible();
    await expect(state).toHaveText(review.content);

    await undoButton(page).click();
    await expect(field(page, 'chatgpt')).toHaveValue('Hello ');
    expect(await state.evaluate((element) => element.textContent)).toBe('Hello ');
  });
});

test.describe('Insertion confirmation: visual proof', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`PROOF: pill, sweep and failure (${theme} mode)`, async ({ context, storage }) => {
      await seed(storage, theme);
      const page = await openPlatform(context, 'claude');
      await page.setViewportSize({ width: 900, height: 420 });
      await page.addStyleTag({
        content: `main { margin-top: 120px; } .ProseMirror { border-radius: 18px; } ${theme === 'dark' ? 'body { background: #1f1e1d; color: #eee; } .ProseMirror { border-color: #555; }' : ''}`,
      });
      await expect(promptsButton(page)).toHaveCount(1);

      await insertByTyping(page, 'claude', 'review');
      await expect(page.locator('#mpm-prompt-selector')).toHaveAttribute('data-theme', theme);
      await expect.poll(() => page.evaluate(() => document.fonts.check('600 12px "MPM Schibsted Grotesk"'))).toBe(true);
      // The pointer holds the pill, and the sweep is stopped early in its run, while it is at its strongest
      await insertionPill(page).hover({ position: { x: 20, y: 17 } });
      await insertionSweep(page).evaluate((element) => {
        for (const animation of element.getAnimations()) {
          animation.pause();
          animation.currentTime = 110;
        }
      });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/inserted-${theme}.png` });

      await undoButton(page).focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/undo-focused-${theme}.png` });

      // A failed Insertion
      await undoButton(page).click();
      const input = field(page, 'claude');
      await input.click();
      await page.keyboard.type('//');
      await expect(promptSelector(page)).toBeVisible();
      await input.evaluate((element) => {
        document.addEventListener('click', (event) => {
          if (event.target instanceof Element && event.target.id === 'mpm-prompt-selector') {
            element.replaceWith(element.cloneNode(true));
          }
        }, { capture: true, once: true });
      });
      await promptRow(page, 'review').click();
      await expect(insertionPill(page)).toHaveAttribute('data-kind', 'failed');
      await insertionPill(page).hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/failed-${theme}.png` });
    });
  }
});

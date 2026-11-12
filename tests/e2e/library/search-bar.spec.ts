/**
 * E2E: the search of the Library as the Atelier 1C pill (My-Prompt-Manager-ech)
 *
 * The pill at rest, focused, empty and filled; Cmd/Ctrl+K from another Section; Escape; the list
 * heading of a search; the first match marked; a search that finds nothing, then Create it. Also
 * captures light/dark screenshots as visual proof (test-results/search-bar/).
 */

import type { Page } from '@playwright/test';

import type { Category, Prompt } from '../../../src/types';
import { type ExtensionStorage, expect, test } from '../fixtures/extension';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SCREENSHOT_DIR = 'test-results/search-bar';

const EXPECTED = {
  light: {
    card: 'rgb(255, 255, 255)', border: 'rgb(236, 230, 245)', accent: 'rgb(109, 40, 217)', halo: 'rgba(109, 40, 217, 0.12)',
    ink: 'rgb(29, 21, 48)', grey: 'rgb(111, 103, 135)', badge: 'rgb(244, 241, 250)', clear: 'rgb(241, 235, 253)',
    clearMark: 'rgb(91, 33, 182)', highlight: 'rgb(253, 230, 138)', dashed: 'rgb(220, 212, 234)'
  },
  dark: {
    card: 'rgb(35, 28, 52)', border: 'rgb(53, 44, 76)', accent: 'rgb(132, 75, 242)', halo: 'rgba(132, 75, 242, 0.12)',
    ink: 'rgb(241, 237, 249)', grey: 'rgb(163, 154, 187)', badge: 'rgb(43, 35, 64)', clear: 'rgb(47, 35, 80)',
    clearMark: 'rgb(196, 181, 253)', highlight: 'rgb(90, 69, 21)', dashed: 'rgb(65, 55, 90)'
  }
} as const;

const categories: Category[] = [
  { id: 'writing', name: 'Writing', color: '#2563EB' },
  { id: 'code', name: 'Code', color: '#0F766E' }
];

const prompts: Prompt[] = [
  createPromptSeed({ id: 'p1', title: 'Follow-up email after a demo', content: 'Write a concise email to {{recipient}}.', category: 'Writing', pinned: true, updatedAt: 5000 }),
  createPromptSeed({ id: 'p2', title: 'Code review checklist', content: 'Review this diff. Email the summary to the team.', category: 'Code', updatedAt: 4000 }),
  createPromptSeed({ id: 'p3', title: 'Blog outline', content: 'Outline a blog post about {{topic}}.', category: 'Writing', updatedAt: 3000 }),
  createPromptSeed({ id: 'p4', title: 'Bug report', content: 'Describe the bug, then the steps.', category: 'Code', updatedAt: 2000 })
];

const open = async (page: Page, storage: ExtensionStorage, extensionId: string, theme: 'light' | 'dark' = 'light') => {
  await seedLibrary(storage, { prompts, categories, settings: { theme } });
  await page.setViewportSize({ width: 400, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
};

/** A screenshot once the pop and the rises have ended, so the proof shows the settled screen */
const capture = async (page: Page, name: string) => {
  // Only the pop and the rises: the header line follows the scroll with an animation that never ends
  await page.waitForFunction(() => document.getAnimations().every(animation =>
    !(animation instanceof CSSAnimation) || !['pop', 'card-rise', 'card-rise-again'].includes(animation.animationName) || animation.playState !== 'running'
  ));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
};

const titles = (page: Page) => page.getByTestId('prompt-card').getByRole('heading', { level: 3 }).evaluateAll(
  headings => headings.map(heading => heading.getAttribute('aria-label'))
);

test.describe('Library search bar', () => {
  for (const theme of ['light', 'dark'] as const) {
    const colors = EXPECTED[theme];

    test(`the pill at rest, focused, empty and filled (${theme})`, async ({ page, storage, extensionId }) => {
      await open(page, storage, extensionId, theme);
      const pill = page.getByTestId('search-bar');
      const field = page.getByRole('searchbox', { name: 'Search prompts' });
      const badge = page.getByTestId('search-shortcut');
      const clear = page.getByRole('button', { name: 'Clear search' });

      // Anatomy: a 44px pill, 16px from each side, the field in 14.5px
      const box = await pill.boundingBox();
      expect(box?.height).toBe(44);
      expect(box?.x).toBe(16);
      expect(box?.width).toBe(400 - 32);
      // rounded-full: a radius larger than any pill, so its ends are half circles
      expect(parseFloat(await pill.evaluate(element => getComputedStyle(element).borderTopLeftRadius))).toBeGreaterThanOrEqual(999);
      // 1.5px as written; Chrome draws and reports whole device pixels, so 1px on a screen of density 1
      await expect(pill).toHaveCSS('border-top-width', /^1(\.5)?px$/);
      await expect(pill).toHaveClass(/border-\[1\.5px\]/);
      await expect(field).toHaveAttribute('type', 'search');
      await expect(field).toHaveAttribute('placeholder', 'Search your prompts');
      await expect(field).toHaveCSS('font-size', '14.5px');
      await expect(field).toHaveCSS('color', colors.ink);

      // At rest
      await expect(pill).toHaveCSS('background-color', colors.card);
      await expect(pill).toHaveCSS('border-top-color', colors.border);
      await expect(badge).toHaveCSS('background-color', colors.badge);
      await expect(badge).toHaveCSS('color', colors.grey);
      await expect(badge).toHaveCSS('height', '24px');
      await expect(clear).toHaveCount(0);
      await capture(page, `rest-${theme}`);

      // Focused: the accent border and the halo stand for the outline of the field
      await field.focus();
      await expect(pill).toHaveCSS('border-top-color', colors.accent);
      await expect.poll(() => pill.evaluate(element => getComputedStyle(element).boxShadow)).toContain(`${colors.halo} 0px 0px 0px 4px`);
      await expect(field).toHaveCSS('outline-style', 'none');
      await capture(page, `focus-${theme}`);

      // Filled: the clear button takes the place of the badge
      await field.fill('email');
      await expect(badge).toHaveCount(0);
      await expect(clear).toHaveCSS('background-color', colors.clear);
      await expect(clear).toHaveCSS('color', colors.clearMark);
      // Its laid-out size: the box on screen is still growing while it pops in
      await expect(clear).toHaveCSS('width', '28px');
      await expect(clear).toHaveCSS('height', '28px');

      // The list of a search: one heading, the number found, the first match marked
      await expect(page.getByTestId('list-header')).toContainText('Results');
      await expect(page.getByTestId('search-status')).toHaveText('2 results');
      const mark = page.getByTestId('prompt-card').first().locator('mark').first();
      await expect(mark).toHaveText('email');
      await expect(mark).toHaveCSS('background-color', colors.highlight);
      await expect(mark).toHaveCSS('color', colors.ink);
      await capture(page, `filled-${theme}`);

      // Nothing found
      await field.fill('Quarterly review');
      const empty = page.getByRole('region', { name: 'No search results' });
      await expect(empty).toContainText('Nothing called “Quarterly review” yet');
      await expect(empty).toHaveCSS('border-top-style', 'dashed');
      await expect(empty).toHaveCSS('border-top-color', colors.dashed);
      await expect(empty).toHaveCSS('border-top-left-radius', '18px');
      await expect(empty.getByRole('button', { name: 'Create it' })).toHaveCSS('background-color', colors.accent);
      await expect(empty.getByRole('button', { name: 'Create it' })).toHaveCSS('opacity', '1');
      await capture(page, `no-results-${theme}`);
    });
  }

  test('the same search lists the same Prompts in the same order: title, content and Category, Pinned first', async ({ page, storage, extensionId }) => {
    await open(page, storage, extensionId);
    const field = page.getByRole('searchbox', { name: 'Search prompts' });

    await field.fill(' EMAIL ');
    await expect.poll(() => titles(page)).toEqual(['Follow-up email after a demo', 'Code review checklist']);

    // The name of a Category is searched too
    await field.fill('writing');
    await expect.poll(() => titles(page)).toEqual(['Follow-up email after a demo', 'Blog outline']);
  });

  test('the clear button empties the field and leaves the keyboard in it', async ({ page, storage, extensionId }) => {
    await open(page, storage, extensionId);
    const field = page.getByRole('searchbox', { name: 'Search prompts' });
    await field.fill('email');
    await expect(page.getByTestId('prompt-card')).toHaveCount(2);

    await page.getByRole('button', { name: 'Clear search' }).click();

    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
    await expect(page.getByTestId('prompt-card')).toHaveCount(prompts.length);
    await expect(page.getByTestId('search-shortcut')).toBeVisible();
  });

  test('Escape empties a filled field and keeps the keyboard in it, then lets go of an empty one', async ({ page, storage, extensionId }) => {
    await open(page, storage, extensionId);
    const field = page.getByRole('searchbox', { name: 'Search prompts' });
    await field.fill('email');

    await field.press('Escape');
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();

    await field.press('Escape');
    await expect(field).not.toBeFocused();
  });

  for (const section of ['Categories', 'Analytics', 'Settings'] as const) {
    test(`the search shortcut comes back from ${section} and puts the keyboard in the field`, async ({ page, storage, extensionId }) => {
      await open(page, storage, extensionId);
      await page.getByRole('tab', { name: section }).click();
      await expect(page.getByRole('heading', { name: section, level: 1 })).toBeVisible();

      await page.keyboard.press('ControlOrMeta+K');

      await expect(page.getByRole('tab', { name: 'Library' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('searchbox', { name: 'Search prompts' })).toBeFocused();
    });
  }

  test('the search shortcut does nothing while the editor is open', async ({ page, storage, extensionId }) => {
    await open(page, storage, extensionId);
    await page.getByRole('button', { name: 'Add new prompt' }).click();
    const title = page.getByTestId('editor-sheet').getByLabel('Title');
    await expect(title).toBeFocused();

    await page.keyboard.press('ControlOrMeta+K');

    await expect(page.getByTestId('editor-sheet')).toBeVisible();
    await expect(title).toBeFocused();
  });

  test('Create it opens the editor titled with the search, and the saved Prompt is the result', async ({ page, storage, extensionId }) => {
    await open(page, storage, extensionId);
    await page.getByRole('searchbox', { name: 'Search prompts' }).fill('  Quarterly review ');

    await page.getByRole('region', { name: 'No search results' }).getByRole('button', { name: 'Create it' }).click();

    const editor = page.getByTestId('editor-sheet');
    await expect(editor.getByLabel('Title')).toHaveValue('Quarterly review');
    await editor.getByRole('textbox', { name: /prompt|content/i }).last().fill('Summarise the quarter.');
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByTestId('editor-sheet')).toHaveCount(0);
    await expect(page.getByTestId('prompt-card')).toHaveCount(1);
    await expect.poll(() => titles(page)).toEqual(['Quarterly review']);
    await expect(page.getByTestId('prompt-card').locator('mark').first()).toHaveText('Quarterly review');
  });

  test('under a Category, Create it starts in that Category and the whole Library can be searched instead', async ({ page, storage, extensionId }) => {
    await open(page, storage, extensionId);
    await page.getByRole('radio', { name: 'Code' }).click();
    await page.getByRole('searchbox', { name: 'Search prompts' }).fill('blog');
    const empty = page.getByRole('region', { name: 'No search results' });
    await expect(empty).toContainText('Nothing in Code matches your search.');
    await expect(page.getByTestId('list-header')).toContainText('Code');

    await empty.getByRole('button', { name: 'Create it' }).click();
    const editor = page.getByTestId('editor-sheet');
    await expect(editor.getByLabel('Title')).toHaveValue('blog');
    await expect(editor.getByRole('radio', { name: 'Code' })).toBeChecked();
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByTestId('editor-sheet')).toHaveCount(0);

    await empty.getByRole('button', { name: 'Search all prompts' }).click();
    await expect.poll(() => titles(page)).toEqual(['Blog outline']);
    await expect(page.getByTestId('list-header')).toContainText('Results');
  });

  test('under reduced motion the pop and the rises are near instant', async ({ page, storage, extensionId }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, storage, extensionId);
    const field = page.getByRole('searchbox', { name: 'Search prompts' });

    await field.fill('email');
    await expect(page.getByRole('button', { name: 'Clear search' })).toHaveCSS('animation-duration', '0.001s');
    const risingCard = page.getByTestId('prompt-card').first().locator('..');
    await expect(risingCard).toHaveCSS('animation-duration', '0.001s');
    await expect(risingCard).toHaveCSS('animation-delay', '0s');
    await expect(page.getByTestId('search-bar')).toHaveCSS('transition-duration', '0.001s');

    await field.fill('zzz');
    await expect(page.getByRole('region', { name: 'No search results' })).toHaveCSS('animation-duration', '0.001s');
  });
});

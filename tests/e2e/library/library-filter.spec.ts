/**
 * E2E: the Library filter (My-Prompt-Manager-bdc)
 *
 * One row of pills replaces the Category and sort dropdowns: All, Pinned, Most Used,
 * then one pill per Category that holds a Prompt. Exactly one is active (see CONTEXT.md).
 */

import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/extension';
import { LibraryPage } from '../pages/LibraryPage';
import { tabNavigation } from '../utils/navigation';
import { getSortedPromptTitles } from '../utils/sort-helpers';
import { createCategorySeed, createPromptSeed, seedLibrary } from '../utils/storage';
import { categoryWorkflows } from '../utils/workflows';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();

const CATEGORIES = [
  createCategorySeed({ id: 'cat-work', name: 'Work', color: '#3B82F6' }),
  createCategorySeed({ id: 'cat-writing', name: 'Writing', color: '#10B981' }),
  createCategorySeed({ id: 'cat-research', name: 'Research', color: '#F59E0B' }),
  createCategorySeed({ id: 'cat-empty', name: 'Empty', color: '#EF4444' })
];

const PROMPTS = [
  createPromptSeed({ id: 'code-review', title: 'Code review', category: 'Work', usageCount: 12, lastUsedAt: NOW - HOUR, updatedAt: NOW - 5 * DAY }),
  createPromptSeed({ id: 'bug-report', title: 'Bug report', category: 'Work', pinned: true, updatedAt: NOW - DAY }),
  createPromptSeed({ id: 'blog-outline', title: 'Blog outline', category: 'Writing', usageCount: 3, updatedAt: NOW - 2 * DAY }),
  createPromptSeed({ id: 'email-reply', title: 'Email reply', category: 'Writing', usageCount: 12, lastUsedAt: NOW - 2 * HOUR, updatedAt: NOW - 3 * DAY }),
  createPromptSeed({ id: 'paper-summary', title: 'Paper summary', category: 'Research', updatedAt: NOW - 4 * DAY }),
  createPromptSeed({ id: 'meeting-notes', title: 'Meeting notes', pinned: true, usageCount: 1, updatedAt: NOW - 6 * DAY })
];

const openPopup = async (page: Page, extensionId: string): Promise<LibraryPage> => {
  await page.goto(`chrome-extension://${extensionId}/src/popup.html`);
  const library = new LibraryPage(page);
  await library.expectLibraryLoaded();
  return library;
};

const pillRow = (page: Page) => page.getByRole('radiogroup', { name: 'Library filter' });

test.describe('Library filter', () => {
  test.beforeEach(async ({ storage }) => {
    await seedLibrary(storage, { categories: CATEGORIES, prompts: PROMPTS });
  });

  test('replaces the category and sort menus with one row of pills, All active', async ({ page, extensionId }) => {
    await openPopup(page, extensionId);

    await expect(page.getByRole('button', { name: /Filter by category/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Sort order/i })).toHaveCount(0);
    // The empty Category has no pill
    await expect(pillRow(page).getByRole('radio')).toHaveText([
      'All', 'Pinned', 'Most Used', 'Uncategorized', 'Work', 'Writing', 'Research'
    ]);
    await expect(pillRow(page).getByRole('radio', { checked: true })).toHaveText('All');
    expect(await getSortedPromptTitles(page)).toEqual([
      'Bug report', 'Meeting notes', 'Blog outline', 'Email reply', 'Paper summary', 'Code review'
    ]);
  });

  test('Pinned lists only the Pinned Prompts', async ({ page, extensionId }) => {
    const library = await openPopup(page, extensionId);

    await library.selectLibraryFilter('Pinned');

    expect(await getSortedPromptTitles(page)).toEqual(['Bug report', 'Meeting notes']);
  });

  test('Most Used ranks by insertions, leaves out unused prompts and gives pinned ones no priority', async ({ page, extensionId }) => {
    const library = await openPopup(page, extensionId);

    await library.selectLibraryFilter('Most Used');

    // Code review and Email reply tie at 12: the most recently used comes first
    expect(await getSortedPromptTitles(page)).toEqual(['Code review', 'Email reply', 'Blog outline', 'Meeting notes']);
  });

  test('a Category pill lists only its Prompts, pinned first', async ({ page, extensionId }) => {
    const library = await openPopup(page, extensionId);

    await library.selectLibraryFilter('Work');

    expect(await getSortedPromptTitles(page)).toEqual(['Bug report', 'Code review']);
    await expect(library.getPromptCountSubtitle()).toHaveText('2 of 6 prompts');
  });

  test('a search looks inside the active filter, and "Search all prompts" widens it to All', async ({ page, extensionId }) => {
    const library = await openPopup(page, extensionId);
    await library.selectLibraryFilter('Work');

    await library.searchPrompts('blog');

    const noResults = page.getByRole('region', { name: 'No search results' });
    await expect(noResults).toContainText('Nothing in Work matches your search.');
    await noResults.getByRole('button', { name: 'Search all prompts' }).click();

    await expect(library.getLibraryFilterPill('All')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByPlaceholder('Search your prompts...')).toHaveValue('blog');
    expect(await getSortedPromptTitles(page)).toEqual(['Blog outline']);
  });

  test('explains an empty Pinned filter', async ({ page, storage, extensionId }) => {
    await seedLibrary(storage, { prompts: [createPromptSeed({ id: 'p', title: 'Lonely' })] });
    const library = await openPopup(page, extensionId);

    await library.selectLibraryFilter('Pinned');

    await expect(page.getByRole('heading', { name: 'No pinned prompts yet' })).toBeVisible();
  });

  test('follows the active Category when it is renamed', async ({ page, extensionId }) => {
    const library = await openPopup(page, extensionId);
    await library.selectLibraryFilter('Writing');

    await categoryWorkflows.edit(page, 'Writing', 'Drafts');

    await expect(library.getLibraryFilterPill('Drafts')).toHaveAttribute('aria-checked', 'true');
    expect(await getSortedPromptTitles(page)).toEqual(['Blog outline', 'Email reply']);
  });

  test('returns to All when the active Category no longer holds a Prompt', async ({ page, extensionId }) => {
    const library = await openPopup(page, extensionId);
    await library.selectLibraryFilter('Research');

    await categoryWorkflows.delete(page, 'Research');

    await expect(library.getLibraryFilterPill('All')).toHaveAttribute('aria-checked', 'true');
    await expect(library.getLibraryFilterPill('Research')).toHaveCount(0);
    await expect(library.getPromptCards()).toHaveCount(6);
  });

  test('keeps the chosen filter while moving between Sections', async ({ page, extensionId }) => {
    const library = await openPopup(page, extensionId);
    await library.selectLibraryFilter('Pinned');

    await tabNavigation.switchTo(page, 'analytics');
    await tabNavigation.switchTo(page, 'library');

    await expect(library.getLibraryFilterPill('Pinned')).toHaveAttribute('aria-checked', 'true');
  });

  test('arrow keys, Home and End move the selection', async ({ page, extensionId }) => {
    const library = await openPopup(page, extensionId);
    await library.getLibraryFilterPill('All').focus();

    await page.keyboard.press('ArrowRight');
    await expect(library.getLibraryFilterPill('Pinned')).toHaveAttribute('aria-checked', 'true');
    await expect(library.getLibraryFilterPill('Pinned')).toBeFocused();

    await page.keyboard.press('End');
    await expect(library.getLibraryFilterPill('Research')).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('Home');
    await expect(library.getLibraryFilterPill('All')).toHaveAttribute('aria-checked', 'true');
  });

  test('a mouse wheel scrolls the row sideways, and the active pill is scrolled into view', async ({ page, storage, extensionId }) => {
    const names = ['Marketing', 'Engineering', 'Research', 'Sales', 'Support', 'Legal', 'Finance', 'Design'];
    await seedLibrary(storage, {
      categories: names.map((name, i) => createCategorySeed({ id: `cat-${String(i)}`, name })),
      prompts: names.map((name, i) => createPromptSeed({ id: `p-${String(i)}`, title: `${name} prompt`, category: name }))
    });
    await page.setViewportSize({ width: 400, height: 600 });
    const library = await openPopup(page, extensionId);
    const row = pillRow(page);
    const scrollLeft = () => row.evaluate(el => el.scrollLeft);

    await expect(page.getByTestId('library-filter-fade-end')).toBeVisible();
    // No scrollbar shows under the pills (the global thin scrollbar must not win)
    expect(await row.evaluate(el => getComputedStyle(el).scrollbarWidth)).toBe('none');
    await row.hover();
    await page.mouse.wheel(0, 300);
    await expect.poll(scrollLeft).toBeGreaterThan(0);
    await expect(page.getByTestId('library-filter-fade-start')).toBeVisible();

    await library.getLibraryFilterPill('All').focus();
    await page.keyboard.press('End');
    const rowBox = await row.boundingBox();
    const pillBox = await library.getLibraryFilterPill('Design').boundingBox();
    expect(rowBox && pillBox && pillBox.x + pillBox.width <= rowBox.x + rowBox.width).toBe(true);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`proof screenshots in ${theme} mode`, async ({ page, storage, extensionId }, testInfo) => {
      await seedLibrary(storage, { categories: CATEGORIES, prompts: PROMPTS, settings: { theme } });
      await page.setViewportSize({ width: 400, height: 600 });
      const library = await openPopup(page, extensionId);
      if (theme === 'dark') {
        await expect(page.locator('html')).toHaveClass(/dark/);
      } else {
        await expect(page.locator('html')).not.toHaveClass(/dark/);
      }

      const shoot = async (name: string, target: Page | ReturnType<Page['locator']> = page) => {
        const path = testInfo.outputPath(`${theme}-${name}.png`);
        await target.screenshot({ path, animations: 'disabled' });
        await testInfo.attach(`${theme}-${name}`, { path, contentType: 'image/png' });
      };

      await shoot('1-all');
      await library.selectLibraryFilter('Pinned');
      await shoot('2-pinned');
      await library.selectLibraryFilter('Most Used');
      await shoot('3-most-used');
      await library.selectLibraryFilter('Work');
      await shoot('4-category');
      await library.searchPrompts('blog');
      await expect(page.getByRole('button', { name: 'Search all prompts' })).toBeVisible();
      await shoot('5-no-results');

      await tabNavigation.switchTo(page, 'settings');
      const librarySettings = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Library', exact: true }) });
      await librarySettings.scrollIntoViewIfNeeded();
      await shoot('6-settings-sort', librarySettings);
    });
  }
});

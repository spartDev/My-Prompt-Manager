import type { BrowserContext, Page } from '@playwright/test';

import { DEFAULT_CATEGORY, DEFAULT_SETTINGS } from '../../../src/types';
import { expect, test } from '../fixtures/extension';
import { LibraryPage } from '../pages/LibraryPage';
import { PromptFormPage } from '../pages/PromptFormPage';
import { SECTION_HEADINGS, type Section, tabNavigation } from '../utils/navigation';
import { createPromptSeed, seedLibrary } from '../utils/storage';

const SECTIONS: Section[] = ['library', 'categories', 'analytics', 'settings'];

const openSidepanel = async (context: BrowserContext, extensionId: string): Promise<Page> => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  return page;
};

test.describe('Bottom tab bar navigation', () => {
  test.beforeEach(async ({ storage }) => {
    await seedLibrary(storage, {
      prompts: [
        createPromptSeed({
          id: 'tab-bar-prompt-1',
          title: 'Meeting Notes Template',
          content: 'Summarize the meeting in three bullet points.',
          category: DEFAULT_CATEGORY,
        }),
        createPromptSeed({
          id: 'tab-bar-prompt-2',
          title: 'Code Review Checklist',
          content: 'Review the diff for correctness and readability.',
          category: DEFAULT_CATEGORY,
        }),
      ],
      settings: { ...DEFAULT_SETTINGS, interfaceMode: 'sidepanel' },
    });
  });

  test('shows the four section tabs on the library with Library selected', async ({ context, extensionId }) => {
    const page = await openSidepanel(context, extensionId);

    const tabBar = tabNavigation.getTabBar(page);
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('tab')).toHaveCount(4);
    await expect(tabBar.getByRole('tab')).toHaveText(['Library', 'Categories', 'Analytics', 'Settings']);

    await expect(tabNavigation.getTab(page, 'library')).toHaveAttribute('aria-selected', 'true');
    for (const section of SECTIONS.filter((s) => s !== 'library')) {
      await expect(tabNavigation.getTab(page, section)).toHaveAttribute('aria-selected', 'false');
    }

    // Library header shows the prompt count and the New button
    await expect(page.getByText('2 prompts', { exact: true })).toBeVisible();
    await expect(page.getByTestId('new-prompt-button')).toBeVisible();
  });

  test('switching tabs shows each section header', async ({ context, extensionId }) => {
    const page = await openSidepanel(context, extensionId);

    for (const section of ['categories', 'analytics', 'settings', 'library'] as const) {
      await tabNavigation.getTab(page, section).click();

      await expect(tabNavigation.getTab(page, section)).toHaveAttribute('aria-selected', 'true');
      await expect(tabNavigation.getSectionHeading(page, section)).toBeVisible();
      await expect(tabNavigation.getTabBar(page)).toBeVisible();

      // Only the active section's header is rendered
      for (const other of SECTIONS.filter((s) => s !== section)) {
        await expect(
          page.getByRole('heading', { level: 1, name: SECTION_HEADINGS[other], exact: true })
        ).toHaveCount(0);
      }
    }
  });

  test('tab bar is hidden on the add form and returns after cancel', async ({ context, extensionId }) => {
    const page = await openSidepanel(context, extensionId);
    const libraryPage = new LibraryPage(page);
    const formPage = new PromptFormPage(page);

    await libraryPage.clickAddNewPrompt();
    await formPage.expectCreateMode();
    await expect(tabNavigation.getTabBar(page)).toBeHidden();

    await formPage.cancel();

    await libraryPage.expectLibraryLoaded();
    await expect(tabNavigation.getTabBar(page)).toBeVisible();
    await expect(tabNavigation.getTab(page, 'library')).toHaveAttribute('aria-selected', 'true');
  });

  test('New button opens the add prompt form', async ({ context, extensionId }) => {
    const page = await openSidepanel(context, extensionId);

    const newButton = page.getByTestId('new-prompt-button');
    await expect(newButton).toHaveAccessibleName('Add new prompt');
    await newButton.click();

    await expect(page.getByRole('heading', { name: 'Add New Prompt' })).toBeVisible();
    await expect(page.getByLabel('Content *')).toBeVisible();
  });

  test('ArrowRight moves the selection to the next tab', async ({ context, extensionId }) => {
    const page = await openSidepanel(context, extensionId);

    const libraryTab = tabNavigation.getTab(page, 'library');
    const categoriesTab = tabNavigation.getTab(page, 'categories');

    await libraryTab.focus();
    await page.keyboard.press('ArrowRight');

    await expect(categoriesTab).toHaveAttribute('aria-selected', 'true');
    await expect(categoriesTab).toBeFocused();
    await expect(libraryTab).toHaveAttribute('aria-selected', 'false');
    await expect(tabNavigation.getSectionHeading(page, 'categories')).toBeVisible();

    // Roving tabindex: only the active tab is in the tab order
    await expect(categoriesTab).toHaveAttribute('tabindex', '0');
    await expect(libraryTab).toHaveAttribute('tabindex', '-1');
  });

  test('search query persists when switching Library -> Analytics -> Library', async ({ context, extensionId }) => {
    const page = await openSidepanel(context, extensionId);
    const libraryPage = new LibraryPage(page);

    await libraryPage.searchPrompts('Meeting');
    await libraryPage.expectPromptCount(1);
    await expect(page.getByText('1 of 2 prompts', { exact: true })).toBeVisible();

    await tabNavigation.switchTo(page, 'analytics');
    await tabNavigation.switchTo(page, 'library');

    await expect(page.getByPlaceholder('Search your prompts...')).toHaveValue('Meeting');
    await libraryPage.expectPromptCount(1);
    await libraryPage.expectPromptVisible('Meeting Notes Template');
  });
});

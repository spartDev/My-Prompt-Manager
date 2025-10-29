/**
 * Sort Helper Functions
 *
 * Reusable utilities for testing sort functionality in both popup and sidepanel contexts.
 * These helpers abstract common sorting operations to improve test maintainability and readability.
 *
 * @module tests/e2e/utils/sort-helpers
 */

import { Page } from '@playwright/test';

/**
 * Get sorted prompt titles from the page
 *
 * Extracts all visible prompt titles in their current display order.
 * Works for both popup and sidepanel contexts.
 *
 * @param page - Playwright Page object
 * @returns Array of prompt titles in display order
 *
 * @example
 * const titles = await getSortedPromptTitles(page);
 * expect(titles).toEqual(['High Usage', 'Medium Usage', 'Low Usage']);
 */
export async function getSortedPromptTitles(page: Page): Promise<string[]> {
  return page.locator('article h3').allTextContents();
}

/**
 * Select a sort option from the dropdown
 *
 * Opens the sort dropdown, clicks the specified option, and waits for re-render.
 * Works for both popup and sidepanel contexts.
 *
 * @param page - Playwright Page object
 * @param optionName - Name of the sort option (e.g., "Most Used", "Recently Used")
 *
 * @example
 * await selectSortOption(page, 'Most Used');
 * await selectSortOption(page, 'Recently Updated');
 */
export async function selectSortOption(page: Page, optionName: string): Promise<void> {
  await page.getByRole('button', { name: /Sort order:/i }).click();
  await page.getByRole('menuitem', { name: new RegExp(optionName, 'i') }).click();
  await page.waitForTimeout(100); // Allow re-render
}

/**
 * Get the current sort label from the button aria-label
 *
 * Retrieves the current sort state from the sort button's aria-label attribute.
 * Useful for verifying sort persistence and state changes.
 * Works for both popup and sidepanel contexts.
 *
 * @param page - Playwright Page object
 * @returns The aria-label text (e.g., "Sort order: Most Used")
 *
 * @example
 * const label = await getCurrentSortLabel(page);
 * expect(label).toContain('Most Used');
 */
export async function getCurrentSortLabel(page: Page): Promise<string> {
  const sortButton = page.getByRole('button', { name: /Sort order:/i });
  const ariaLabel = await sortButton.getAttribute('aria-label');
  return ariaLabel || '';
}

/**
 * Navigate to a specific context (popup or sidepanel)
 *
 * Constructs and navigates to the correct extension URL for the specified context.
 *
 * @param page - Playwright Page object
 * @param extensionId - Chrome extension ID
 * @param context - Context to navigate to ('popup' or 'sidepanel')
 *
 * @example
 * await navigateToContext(page, extensionId, 'popup');
 * await navigateToContext(page, extensionId, 'sidepanel');
 */
export async function navigateToContext(
  page: Page,
  extensionId: string,
  context: 'popup' | 'sidepanel'
): Promise<void> {
  const url = context === 'popup' ? 'src/popup.html' : 'src/sidepanel.html';
  await page.goto(`chrome-extension://${extensionId}/${url}`);
}

/**
 * Sort Helper Functions
 *
 * Reusable utilities for testing sort functionality in both popup and sidepanel contexts.
 * These helpers abstract common sorting operations to improve test maintainability and readability.
 *
 * @module tests/e2e/utils/sort-helpers
 */

import type { Page } from '@playwright/test';

import { expect } from '../fixtures/extension';

import { tabNavigation } from './navigation';

/**
 * Get sorted prompt titles from the page
 *
 * Extracts all visible prompt titles in their current display order.
 * Works for both popup and sidepanel contexts.
 * Uses data-testid for prompt cards and role for headings.
 *
 * @param page - Playwright Page object
 * @returns Array of prompt titles in display order
 *
 * @example
 * const titles = await getSortedPromptTitles(page);
 * expect(titles).toEqual(['High Usage', 'Medium Usage', 'Low Usage']);
 */
export async function getSortedPromptTitles(page: Page): Promise<string[]> {
  return page.getByTestId('prompt-card').getByRole('heading').allTextContents();
}

/**
 * Choose the Library sort in Settings, then come back to the Library
 *
 * The sort is a Settings preference ("Sort prompts by"); each sort has one direction.
 * Works for both popup and sidepanel contexts.
 *
 * @param page - Playwright Page object
 * @param optionName - Label of the sort option: "Recently Updated", "Recently Used",
 *   "Recently Created", "Number of Uses" or "Alphabetical (A→Z)"
 *
 * @example
 * await selectSortOption(page, 'Number of Uses');
 */
export async function selectSortOption(page: Page, optionName: string): Promise<void> {
  await tabNavigation.switchTo(page, 'settings');
  const select = page.getByLabel('Sort prompts by');
  await select.selectOption({ label: optionName });
  await expect(select.locator('option:checked')).toHaveText(optionName);
  await tabNavigation.switchTo(page, 'library');
}

/**
 * Get the label of the Library sort currently chosen in Settings
 *
 * Opens Settings to read it, then comes back to the Library.
 *
 * @param page - Playwright Page object
 * @returns The selected option label (e.g., "Number of Uses")
 */
export async function getCurrentSortLabel(page: Page): Promise<string> {
  await tabNavigation.switchTo(page, 'settings');
  const label = await page.getByLabel('Sort prompts by').locator('option:checked').textContent();
  await tabNavigation.switchTo(page, 'library');
  return label ?? '';
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

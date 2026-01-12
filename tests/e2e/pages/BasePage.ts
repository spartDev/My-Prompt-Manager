import type { Page, Locator } from '@playwright/test';

import { expect } from '../fixtures/extension';

/**
 * Base page class containing common functionality used across all pages
 */
export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Expect a success message to be visible
   */
  async expectSuccessMessage(message: string): Promise<void> {
    await expect(this.page.getByText(message).first()).toBeVisible();
  }

  /**
   * Expect an error message to be visible
   */
  async expectErrorMessage(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  /**
   * Expect an element to be visible
   */
  async expectElementVisible(locator: string | Locator): Promise<void> {
    const element = typeof locator === 'string' ? this.page.locator(locator) : locator;
    await expect(element).toBeVisible();
  }

  /**
   * Expect an element to be hidden
   */
  async expectElementHidden(locator: string | Locator): Promise<void> {
    const element = typeof locator === 'string' ? this.page.locator(locator) : locator;
    await expect(element).toBeHidden();
  }

  /**
   * Go back to the previous page
   */
  async goBack(): Promise<void> {
    await this.page.goBack();
  }

  /**
   * Wait for loading states to complete
   */
  async waitForLoadingComplete(): Promise<void> {
    // Wait for DOM content to load
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Get close button using data-testid attribute
   */
  protected getCloseButton(): Locator {
    return this.page.getByTestId('close-modal').first();
  }

  /**
   * Get back button using data-testid attribute
   */
  protected getBackButton(): Locator {
    return this.page.getByTestId('back-button').first();
  }

  /**
   * Generic method to close modal dialogs
   */
  async closeModal(): Promise<void> {
    const closeButton = this.getCloseButton();
    await expect(closeButton).toBeVisible();
    await closeButton.click();
  }
}
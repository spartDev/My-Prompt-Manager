import type { Page, Locator } from '@playwright/test';

/**
 * Base page class containing common functionality used across all pages
 *
 * Note: Following Page Object Model best practices, this class provides
 * locator-returning methods rather than assertion methods. Assertions
 * should be performed in test files or using utilities from assertions.ts.
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
   * Get a success message locator
   * Usage in tests: await expect(page.getSuccessMessage('Created')).toBeVisible()
   */
  getSuccessMessage(message: string): Locator {
    return this.page.getByText(message).first();
  }

  /**
   * Get an error message locator
   * Usage in tests: await expect(page.getErrorMessage('Error')).toBeVisible()
   */
  getErrorMessage(message: string): Locator {
    return this.page.getByText(message);
  }

  /**
   * Get an element locator from a string selector or pass through existing Locator
   * Usage in tests: await expect(page.getElement('.selector')).toBeVisible()
   */
  getElement(locator: string | Locator): Locator {
    return typeof locator === 'string' ? this.page.locator(locator) : locator;
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
    await closeButton.waitFor({ state: 'visible' });
    await closeButton.click();
  }
}
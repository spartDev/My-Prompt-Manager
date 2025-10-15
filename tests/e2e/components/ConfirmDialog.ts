import type { Locator, Page } from '@playwright/test';

/**
 * ConfirmDialog Component
 *
 * Represents a confirmation dialog modal used for delete/destructive actions.
 * Appears as a portal overlay on the page.
 *
 * Responsibilities:
 * - Dialog interactions (confirm, cancel)
 * - Element queries (title, message, buttons)
 * - Visibility checks
 *
 * Does NOT:
 * - Trigger the dialog to open (parent component does that)
 * - Contain assertions about what happens after confirmation (tests do that)
 */
export class ConfirmDialog {
  constructor(private readonly page: Page) {}

  // ==================
  // ELEMENT QUERIES
  // ==================

  /**
   * Get the dialog container element
   */
  get dialog(): Locator {
    return this.page.getByTestId('confirmation-dialog');
  }

  /**
   * Get the dialog title element
   */
  get title(): Locator {
    return this.page.getByTestId('confirmation-dialog-title');
  }

  /**
   * Get the dialog message element
   */
  get message(): Locator {
    return this.page.getByTestId('confirmation-dialog-message');
  }

  /**
   * Get the confirm button
   */
  get confirmButton(): Locator {
    return this.page.getByTestId('confirmation-dialog-confirm');
  }

  /**
   * Get the cancel button
   */
  get cancelButton(): Locator {
    return this.page.getByTestId('confirmation-dialog-cancel');
  }

  // ==================
  // ACTIONS
  // ==================

  /**
   * Click the confirm button
   */
  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  /**
   * Click the cancel button
   */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  /**
   * Press Escape key to cancel
   */
  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  // ==================
  // QUERIES
  // ==================

  /**
   * Check if the dialog is visible
   */
  async isVisible(): Promise<boolean> {
    return this.dialog.isVisible();
  }

  /**
   * Get the dialog title text
   */
  async getTitleText(): Promise<string> {
    return (await this.title.textContent()) || '';
  }

  /**
   * Get the dialog message text
   */
  async getMessageText(): Promise<string> {
    return (await this.message.textContent()) || '';
  }

  /**
   * Get the confirm button text
   */
  async getConfirmButtonText(): Promise<string> {
    return (await this.confirmButton.textContent()) || '';
  }

  /**
   * Get the cancel button text
   */
  async getCancelButtonText(): Promise<string> {
    return (await this.cancelButton.textContent()) || '';
  }

  /**
   * Wait for the dialog to be visible
   */
  async waitForVisible(): Promise<void> {
    await this.dialog.waitFor({ state: 'visible' });
  }

  /**
   * Wait for the dialog to be hidden
   */
  async waitForHidden(): Promise<void> {
    await this.dialog.waitFor({ state: 'hidden' });
  }
}


import { expect } from '../fixtures/extension';

import { BasePage } from './BasePage';

/**
 * Page Object Model for confirmation dialogs
 * Handles delete confirmations and other modal confirmations
 */
export class ConfirmationDialog extends BasePage {

  /**
   * Expect the confirmation dialog to be visible with specific title
   */
  async expectVisible(title: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: title })).toBeVisible();
  }

  /**
   * Confirm the action (click confirm/delete button)
   */
  async confirm(): Promise<void> {
    await this.page.getByRole('button', { name: 'Delete', exact: true }).click();
  }

  /**
   * Cancel the action
   */
  async cancel(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel' }).click();
  }

  /**
   * Expect a specific warning message
   */
  async expectMessage(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  /**
   * Expect warning about permanent deletion
   */
  async expectPermanentDeletionWarning(): Promise<void> {
    await this.expectMessage('This will permanently delete');
  }

  /**
   * Complete delete confirmation workflow
   */
  async confirmDeletion(itemType: 'Prompt' | 'Category'): Promise<void> {
    await this.expectVisible(`Delete ${itemType}`);
    await this.confirm();
    await this.expectSuccessMessage(`${itemType} deleted successfully`);
  }

  /**
   * Cancel deletion workflow
   */
  async cancelDeletion(itemType: 'Prompt' | 'Category'): Promise<void> {
    await this.expectVisible(`Delete ${itemType}`);
    await this.cancel();
  }
}
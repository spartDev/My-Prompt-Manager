import type { Locator } from '@playwright/test';

import { expect } from '../fixtures/extension';

import { BasePage } from './BasePage';

/**
 * Page Object Model for the Prompt Form (Create/Edit)
 * Handles prompt creation and editing workflows
 */
export class PromptFormPage extends BasePage {

  /**
   * Fill the prompt title field
   */
  async fillTitle(title: string): Promise<void> {
    await this.page.getByLabel('Title (optional)').fill(title);
  }

  /**
   * Fill the prompt content field
   */
  async fillContent(content: string): Promise<void> {
    await this.page.getByLabel('Content *').fill(content);
  }

  /**
   * Select a category from the dropdown
   */
  async selectCategory(category: string): Promise<void> {
    // Click the dropdown button to open it
    const categoryButton = this.page.getByLabel('Category');
    await categoryButton.click();

    // Wait for the menu to appear
    await this.page.getByRole('menu', { name: 'Select category' }).waitFor();

    // Click the desired category option
    await this.page.getByRole('menuitem', { name: category }).click();
  }

  /**
   * Save a new prompt
   */
  async savePrompt(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save Prompt' }).click();
    await expect(this.getSuccessMessage('Prompt created successfully')).toBeVisible();
  }

  /**
   * Save changes to an existing prompt
   */
  async saveChanges(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(this.getSuccessMessage('Prompt updated successfully')).toBeVisible();
  }

  /**
   * Cancel form without saving
   */
  async cancel(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel' }).click();
  }

  /**
   * Expect validation errors to be visible
   */
  async expectValidationErrors(): Promise<void> {
    // Content is required, so expect error when empty
    await expect(this.page.getByText('Content is required')).toBeVisible();
  }

  /**
   * Expect the form to be in create mode
   */
  async expectCreateMode(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Add New Prompt' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Save Prompt' })).toBeVisible();
  }

  /**
   * Expect the form to be in edit mode
   */
  async expectEditMode(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Edit Prompt' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  }

  /**
   * Get the title input field
   */
  getTitleInput(): Locator {
    return this.page.getByLabel('Title (optional)');
  }

  /**
   * Get the content textarea
   */
  getContentInput(): Locator {
    return this.page.getByLabel('Content *');
  }

  /**
   * Get the category dropdown button
   */
  getCategorySelect(): Locator {
    return this.page.getByLabel('Category');
  }

  /**
   * Get the save button (for create mode)
   */
  getSaveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save Prompt' });
  }

  /**
   * Get the save changes button (for edit mode)
   */
  getSaveChangesButton(): Locator {
    return this.page.getByRole('button', { name: 'Save Changes' });
  }

  /**
   * Expect save button to be enabled/disabled
   */
  async expectSaveButtonEnabled(enabled: boolean = true): Promise<void> {
    const button = this.getSaveButton();
    if (enabled) {
      await expect(button).toBeEnabled();
    } else {
      await expect(button).toBeDisabled();
    }
  }

  /**
   * Create a complete prompt with all fields
   */
  async createPrompt(promptData: {
    title?: string;
    content: string;
    category?: string;
  }): Promise<void> {
    if (promptData.title) {
      await this.fillTitle(promptData.title);
    }

    await this.fillContent(promptData.content);

    if (promptData.category) {
      await this.selectCategory(promptData.category);
    }

    await this.savePrompt();
  }

  /**
   * Edit an existing prompt with new data
   */
  async editPrompt(updates: {
    title?: string;
    content?: string;
    category?: string;
  }): Promise<void> {
    if (updates.title !== undefined) {
      await this.getTitleInput().clear();
      await this.fillTitle(updates.title);
    }

    if (updates.content !== undefined) {
      await this.getContentInput().clear();
      await this.fillContent(updates.content);
    }

    if (updates.category) {
      await this.selectCategory(updates.category);
    }

    await this.saveChanges();
  }

  /**
   * Expect current form values
   */
  async expectFormValues(expected: {
    title?: string;
    content?: string;
    category?: string;
  }): Promise<void> {
    if (expected.title !== undefined) {
      await expect(this.getTitleInput()).toHaveValue(expected.title);
    }

    if (expected.content !== undefined) {
      await expect(this.getContentInput()).toHaveValue(expected.content);
    }

    if (expected.category !== undefined) {
      // For the custom dropdown, check the button text content
      await expect(this.getCategorySelect()).toHaveText(expected.category);
    }
  }
}
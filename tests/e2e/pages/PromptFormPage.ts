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
    await this.page.getByLabel('Title', { exact: true }).fill(title);
  }

  /**
   * Fill the prompt content field
   */
  async fillContent(content: string): Promise<void> {
    await this.page.getByLabel('Content', { exact: true }).fill(content);
  }

  /**
   * Choose a Category among the chips
   */
  async selectCategory(category: string): Promise<void> {
    await this.getCategorySelect().getByRole('radio', { name: category, exact: true }).click();
  }

  /**
   * Save a new prompt
   */
  async savePrompt(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(this.getSuccessMessage('Prompt created')).toBeVisible();
  }

  /**
   * Save changes to an existing prompt
   */
  async saveChanges(): Promise<void> {
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(this.getSuccessMessage('Prompt saved')).toBeVisible();
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
    await expect(this.page.getByRole('heading', { name: 'New prompt', exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  }

  /**
   * Expect the form to be in edit mode
   */
  async expectEditMode(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Edit prompt', exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  }

  /**
   * Get the title input field
   */
  getTitleInput(): Locator {
    return this.page.getByLabel('Title', { exact: true });
  }

  /**
   * Get the content textarea
   */
  getContentInput(): Locator {
    return this.page.getByLabel('Content', { exact: true });
  }

  /**
   * Get the Category chips (a radio group)
   */
  getCategorySelect(): Locator {
    return this.page.getByRole('radiogroup', { name: 'Category' });
  }

  /**
   * Get the save button (for create mode)
   */
  getSaveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
  }

  /**
   * Get the save changes button (for edit mode)
   */
  getSaveChangesButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
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
      await expect(this.getCategorySelect().getByRole('radio', { name: expected.category, exact: true })).toBeChecked();
    }
  }
}
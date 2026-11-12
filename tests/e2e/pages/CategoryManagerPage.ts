import type { Locator } from '@playwright/test';

import { expect } from '../fixtures/extension';

import { BasePage } from './BasePage';

/** How the Category sheet is closed without saving */
export type SheetDismissal = 'escape' | 'backdrop' | 'close' | 'cancel';

export const SHEET_DISMISSALS: readonly SheetDismissal[] = ['escape', 'backdrop', 'close', 'cancel'];

/** How the sheet's name is submitted: its primary button (Create or Save), or Enter in the name */
export type SheetSubmission = 'button' | 'enter';

export interface CategorySheetOptions {
  /** One of the 12 Category colors, by the name of its swatch (PRESET_COLORS), e.g. 'Teal' */
  color?: string;
  submitWith?: SheetSubmission;
}

/** A value for a CSS attribute selector between double quotes */
const cssString = (value: string): string => value.replace(/["\\]/g, '\\$&');

/**
 * Page Object Model of the Categories section: the list of Categories, "Add category" below it,
 * and the Category sheet, the one place where a Category is created, renamed, recolored or deleted.
 */
export class CategoryManagerPage extends BasePage {

  // The Categories section

  /**
   * Open the Categories section via the tab bar
   */
  async openFromLibrary(): Promise<void> {
    await this.switchToSection('categories');
    await this.expectCategoryManagerOpen();
  }

  /**
   * Return to the Library section via the tab bar
   */
  async closeToLibrary(): Promise<void> {
    await this.switchToSection('library');
    await expect(this.page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  }

  /**
   * The Categories view itself, which steps back (data-stepped-back) while the sheet is open
   */
  getView(): Locator {
    return this.page.locator('.sheet-behind');
  }

  /**
   * The row of a Category, by its exact name
   */
  getCategoryRow(name: string): Locator {
    return this.page.locator(`[data-testid="category-row"][data-category-name="${cssString(name)}"]`);
  }

  /**
   * The rows of all Categories, in their order
   */
  getCategoryRows(): Locator {
    return this.page.getByTestId('category-row');
  }

  /**
   * The row of an editable Category, as the button that opens the sheet on it
   */
  getEditButton(name: string): Locator {
    return this.page.getByRole('button', { name: `Edit category ${name}`, exact: true });
  }

  /**
   * The color swatch at the start of a Category's row
   */
  getRowSwatch(name: string): Locator {
    return this.getCategoryRow(name).locator('[style*="background-color"]').first();
  }

  /**
   * The button that opens the sheet to create a Category: the dashed "Add category" below the list,
   * or "Create a category" of the empty state, shown while the Default Category is the only one
   */
  getAddCategoryButton(): Locator {
    return this.page.getByRole('button', { name: /^(Add category|Create a category)$/ });
  }

  /**
   * The empty state of the Section, shown while the Default Category is the only one
   */
  getEmptyState(): Locator {
    return this.page.getByTestId('categories-empty');
  }

  // The Category sheet

  /**
   * The open Category sheet, creating or editing
   */
  getSheet(): Locator {
    return this.page.getByRole('dialog', { name: /^(New|Edit) category$/ });
  }

  /**
   * Every Category sheet on the page, the one playing its exit included (it no longer takes input)
   */
  getSheetsOnPage(): Locator {
    return this.page.locator('[role="dialog"][aria-label="New category"], [role="dialog"][aria-label="Edit category"]');
  }

  getCreateSheet(): Locator {
    return this.page.getByRole('dialog', { name: 'New category', exact: true });
  }

  getEditSheet(): Locator {
    return this.page.getByRole('dialog', { name: 'Edit category', exact: true });
  }

  getSheetBackdrop(): Locator {
    return this.page.getByTestId('category-sheet-backdrop');
  }

  getSheetNameInput(): Locator {
    return this.getSheet().getByRole('textbox', { name: 'Category name', exact: true });
  }

  /**
   * The preview tile: the Category's initial ("?" while the name is empty) on its color
   */
  getSheetPreview(): Locator {
    return this.getSheet().getByTestId('category-sheet-preview');
  }

  /**
   * The swatch of one of the 12 Category colors, by its name (PRESET_COLORS)
   */
  getColorSwatch(colorName: string): Locator {
    return this.getSheet().getByRole('button', { name: colorName, exact: true });
  }

  /**
   * The primary button: Create in a new sheet, Save in an edit sheet
   */
  getSubmitButton(): Locator {
    return this.getSheet().getByRole('button', { name: /^(Create|Save)$/ });
  }

  getSheetCancelButton(): Locator {
    return this.getSheet().getByRole('button', { name: 'Cancel', exact: true });
  }

  getSheetCloseButton(): Locator {
    return this.getSheet().getByRole('button', { name: 'Close', exact: true });
  }

  getSheetDeleteButton(): Locator {
    return this.getSheet().getByRole('button', { name: 'Delete', exact: true });
  }

  /**
   * Why the name was refused (taken, too long), shown under the name
   */
  getSheetRefusal(): Locator {
    return this.getSheet().getByRole('alert');
  }

  /**
   * The confirmation a deletion asks for when the Notifications are off
   */
  getDeleteConfirmation(): Locator {
    return this.page.getByRole('dialog', { name: 'Delete Category' });
  }

  /**
   * The Notification on screen, if any
   */
  getNotification(): Locator {
    return this.page.getByTestId('toast');
  }

  /**
   * Open the sheet to create a Category, and wait for it to rise: empty, the focus in the name
   */
  async openCreateSheet(): Promise<void> {
    await this.getAddCategoryButton().click();
    await expect(this.getCreateSheet()).toBeVisible();
    await expect(this.getSheetNameInput()).toBeFocused();
    await expect(this.getSheetNameInput()).toHaveValue('');
    await this.waitForSheetToSettle();
  }

  /**
   * Open the sheet on a Category, and wait for it to rise: its name filled in and focused
   */
  async openEditSheet(name: string): Promise<void> {
    await this.getEditButton(name).click();
    await expect(this.getEditSheet()).toBeVisible();
    await expect(this.getSheetNameInput()).toHaveValue(name);
    await expect(this.getSheetNameInput()).toBeFocused();
    await this.waitForSheetToSettle();
  }

  async fillSheetName(name: string): Promise<void> {
    await this.getSheetNameInput().fill(name);
  }

  /**
   * Choose one of the 12 Category colors in the sheet
   */
  async chooseColor(colorName: string): Promise<void> {
    await this.getColorSwatch(colorName).click();
    await expect(this.getColorSwatch(colorName)).toHaveAttribute('aria-pressed', 'true');
  }

  async submitSheet(submitWith: SheetSubmission = 'button'): Promise<void> {
    if (submitWith === 'enter') {
      await this.getSheetNameInput().press('Enter');
    } else {
      await this.getSubmitButton().click();
    }
  }

  /**
   * Close the sheet without saving, and wait for it to leave the page
   */
  async dismissSheet(how: SheetDismissal = 'escape'): Promise<void> {
    switch (how) {
      case 'escape':
        await this.getSheetNameInput().press('Escape');
        break;
      case 'backdrop':
        // The panel covers the bottom of the backdrop: click near its top-left corner, clear of the
        // panel and of the Notification at the top center
        await this.getSheetBackdrop().click({ position: { x: 8, y: 8 } });
        break;
      case 'close':
        await this.getSheetCloseButton().click();
        break;
      case 'cancel':
        await this.getSheetCancelButton().click();
        break;
    }
    await this.expectSheetClosed();
  }

  /**
   * Wait for the sheet's entrance to end, to measure or screenshot it where it rests
   */
  async waitForSheetToSettle(): Promise<void> {
    await this.getSheet().evaluate(async element => {
      await Promise.all(element.getAnimations().map(animation => animation.finished));
    });
  }

  /**
   * The sheet has played its exit and left the page
   */
  async expectSheetClosed(): Promise<void> {
    await expect(this.getSheetsOnPage()).toHaveCount(0);
    await expect(this.getSheetBackdrop()).toHaveCount(0);
  }

  // Whole operations

  /**
   * Create a Category through the sheet; expects it created, the sheet gone and the Notification
   */
  async createCategory(name: string, { color, submitWith = 'button' }: CategorySheetOptions = {}): Promise<void> {
    await this.openCreateSheet();
    await this.fillSheetName(name);
    if (color) {
      await this.chooseColor(color);
    }
    await this.submitSheet(submitWith);

    await this.expectSheetClosed();
    await this.expectNotification('Category created', name.trim());
    await this.expectCategoryExists(name.trim());
  }

  /**
   * Rename (and maybe recolor) a Category through the sheet
   */
  async editCategory(currentName: string, newName: string, { color, submitWith = 'button' }: CategorySheetOptions = {}): Promise<void> {
    await this.openEditSheet(currentName);
    await this.fillSheetName(newName);
    if (color) {
      await this.chooseColor(color);
    }
    await this.submitSheet(submitWith);

    await this.expectSheetClosed();
    await this.expectNotification('Category saved', newName.trim());
    await this.expectCategoryExists(newName.trim());
    if (currentName !== newName.trim()) {
      await this.expectCategoryNotExists(currentName);
    }
  }

  /**
   * Give a Category another of the 12 colors through the sheet
   */
  async recolorCategory(name: string, color: string): Promise<void> {
    await this.openEditSheet(name);
    await this.chooseColor(color);
    await this.submitSheet();

    await this.expectSheetClosed();
    await this.expectNotification('Category saved', name);
  }

  /**
   * Delete a Category from its sheet, the Notifications on: it goes at once, and the Notification
   * that says so offers Undo
   */
  async deleteCategory(name: string): Promise<void> {
    await this.openEditSheet(name);
    await this.getSheetDeleteButton().click();

    await this.expectSheetClosed();
    await expect(this.getDeleteConfirmation()).toHaveCount(0);
    await this.expectNotification('Category deleted', name);
    await expect(this.getNotification().getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
    await this.expectCategoryNotExists(name);
  }

  /**
   * Delete a Category from its sheet, the Notifications off: Delete asks first. Accepted, the
   * Category goes; cancelled, the sheet stays open on it
   */
  async deleteCategoryWithConfirmation(name: string, accept: boolean = true): Promise<void> {
    await this.openEditSheet(name);
    await this.getSheetDeleteButton().click();

    const confirmation = this.getDeleteConfirmation();
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText(`Delete category "${name}"?`);

    if (accept) {
      await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(confirmation).toHaveCount(0);
      await this.expectSheetClosed();
      await this.expectCategoryNotExists(name);
    } else {
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(confirmation).toHaveCount(0);
      await expect(this.getEditSheet()).toBeVisible();
      // The sheet resumes where the confirmation leaves the focus: on the Delete that opened it
      await expect(this.getSheetDeleteButton()).toBeFocused();
    }
  }

  /**
   * Undo the deletion the Notification on screen confirms
   */
  async undoDelete(): Promise<void> {
    await this.getNotification().getByRole('button', { name: 'Undo', exact: true }).click();
  }

  // Expectations

  /**
   * Expect the Categories section to be open
   */
  async expectCategoryManagerOpen(): Promise<void> {
    await expect(this.page.getByRole('heading', { level: 1, name: 'Categories', exact: true })).toBeVisible();
    await expect(this.getSectionTab('categories')).toHaveAttribute('aria-selected', 'true');
  }

  /**
   * Expect a specific number of categories
   */
  async expectCategoryCount(count: number): Promise<void> {
    // One Category is the Default Category alone: the Section shows its empty state, under "Organize"
    if (count === 1) {
      await expect(this.getEmptyState()).toBeVisible();
      await expect(this.page.getByText('Organize', { exact: true })).toBeVisible();
      return;
    }
    const text = count === 1 ? '1 category' : `${String(count)} categories`;
    await expect(this.page.getByText(text, { exact: true }).first()).toBeVisible();
  }

  async expectCategoryExists(name: string): Promise<void> {
    await expect(this.getCategoryRow(name)).toBeVisible();
  }

  async expectCategoryNotExists(name: string): Promise<void> {
    await expect(this.getCategoryRow(name)).toHaveCount(0);
  }

  /**
   * Expect the Notification on screen to say this, with this name under it when given
   */
  async expectNotification(message: string, sub?: string): Promise<void> {
    const notification = this.getNotification();
    await expect(notification).toContainText(message);
    if (sub) {
      await expect(notification).toContainText(sub);
    }
  }

  /**
   * Expect the sheet to stay open with this refusal under the name
   */
  async expectRefusal(message: string): Promise<void> {
    await expect(this.getSheetRefusal()).toHaveText(message);
    await expect(this.getSheetNameInput()).toHaveAttribute('aria-invalid', 'true');
  }

  /**
   * Try to create a Category under a name already taken: the sheet stays open with the reason
   */
  async testDuplicateValidation(existingName: string): Promise<void> {
    await this.openCreateSheet();
    await this.fillSheetName(existingName);
    await this.submitSheet();
    await this.expectRefusal(`Category with name "${existingName}" already exists`);
    await expect(this.getCreateSheet()).toBeVisible();
  }
}

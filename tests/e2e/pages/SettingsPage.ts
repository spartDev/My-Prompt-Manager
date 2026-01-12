import type { Locator, Download } from '@playwright/test';

import { expect } from '../fixtures/extension';

import { BasePage } from './BasePage';

/**
 * Page Object Model for the Settings page
 * Handles settings configuration and data management
 */
export class SettingsPage extends BasePage {

  /**
   * Open settings from the library page
   */
  async openFromLibrary(): Promise<void> {
    await this.page.getByRole('button', { name: 'Settings' }).click();
    await this.expectSettingsOpen();
  }

  /**
   * Navigate back to library view
   */
  async navigateToLibrary(): Promise<void> {
    await this.page.getByRole('button', { name: 'Library' }).click();
    await expect(this.page.getByRole('heading', { name: 'My Prompt Manager' })).toBeVisible();
  }

  /**
   * Select a theme option
   */
  async selectTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
    await this.page.getByRole('radio', { name: theme }).click();
  }

  /**
   * Select interface mode
   */
  async selectInterfaceMode(mode: 'popup' | 'sidepanel'): Promise<void> {
    await this.page.getByRole('radio', { name: mode }).click();
  }

  /**
   * Export data and wait for download
   */
  async exportData(): Promise<Download> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;
    return download;
  }

  /**
   * Import data from file
   * Note: File inputs require special handling as they don't have accessible roles
   */
  async importData(filePath: string): Promise<void> {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await this.expectSuccessMessage('Import successful');
  }

  /**
   * Add a custom site configuration
   */
  async addCustomSite(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add Custom Site' }).click();
  }

  /**
   * Expect settings page to be open
   */
  async expectSettingsOpen(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  }

  /**
   * Expect a specific theme to be selected
   */
  async expectThemeSelected(theme: 'system' | 'light' | 'dark'): Promise<void> {
    await expect(this.page.getByRole('radio', { name: theme })).toBeChecked();
  }

  /**
   * Expect a specific interface mode to be selected
   */
  async expectInterfaceModeSelected(mode: 'popup' | 'sidepanel'): Promise<void> {
    await expect(this.page.getByRole('radio', { name: mode })).toBeChecked();
  }

  /**
   * Get the export button
   */
  getExportButton(): Locator {
    return this.page.getByRole('button', { name: 'Export' });
  }

  /**
   * Get the import button
   */
  getImportButton(): Locator {
    return this.page.getByRole('button', { name: 'Import' });
  }

  /**
   * Expect storage usage information to be displayed
   */
  async expectStorageUsageVisible(): Promise<void> {
    await expect(this.page.getByText('Storage Usage')).toBeVisible();
    await expect(this.page.getByTestId('storage-bar')).toBeVisible();
  }

  /**
   * Expect prompt and category counts in storage section
   */
  async expectDataCounts(promptCount: number, categoryCount: number): Promise<void> {
    await expect(this.page.getByText(`${String(promptCount)} prompts`)).toBeVisible();
    await expect(this.page.getByText(`${String(categoryCount)} categories`)).toBeVisible();
  }

  /**
   * Test data export functionality
   */
  async testExportFunctionality(): Promise<void> {
    const download = await this.exportData();

    // Verify download properties
    expect(download.suggestedFilename()).toContain('prompt-library-backup');
    expect(download.suggestedFilename()).toContain('.json');

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
  }

  /**
   * Clear all data (if available)
   */
  async clearAllData(confirm: boolean = true): Promise<void> {
    await this.page.getByRole('button', { name: 'Clear All Data' }).click();

    if (confirm) {
      await expect(this.page.getByText('This will permanently delete')).toBeVisible();
      await this.page.getByRole('button', { name: 'Yes, Clear All Data' }).click();
      await this.expectSuccessMessage('Data cleared successfully');
    } else {
      await this.page.getByRole('button', { name: 'Cancel' }).click();
    }
  }

  /**
   * Navigate to different settings sections if they exist
   */
  async navigateToSection(sectionName: string): Promise<void> {
    await this.page.getByRole('tab', { name: sectionName }).click();
  }

  /**
   * Expect settings to be persisted after reload
   */
  async expectSettingsPersisted(): Promise<void> {
    await this.page.reload();
    await this.expectSettingsOpen();
  }
}
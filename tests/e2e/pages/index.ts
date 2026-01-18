/**
 * Page Object Models for E2E Tests
 *
 * This module provides Page Object Models (POMs) that encapsulate
 * UI interactions and provide clean, reusable methods for testing.
 */

export { AnalyticsPage } from './AnalyticsPage';
export { BasePage } from './BasePage';
export { LibraryPage } from './LibraryPage';
export { CategoryManagerPage } from './CategoryManagerPage';
export { PromptFormPage } from './PromptFormPage';
export { SettingsPage } from './SettingsPage';
export { ConfirmationDialog } from './ConfirmationDialog';

// Re-export types for convenience
export type { Page, Locator } from '@playwright/test';
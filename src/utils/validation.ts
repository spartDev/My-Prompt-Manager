import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH, VALIDATION_MESSAGES } from '../constants/validation';
import { Prompt, Category, Settings, StorageData, UsageEvent, CustomSite } from '../types';
import { TypeGuard } from '../types/hooks';

import * as Logger from './logger';

/**
 * Field-specific validation errors
 */
export interface FieldErrors {
  title?: string;
  content?: string;
  general?: string;
}

/**
 * Options for validation logging
 */
interface ValidationLogOptions {
  component: string;
  promptId?: string;
}

/**
 * Validates prompt title and content fields according to form constraints.
 *
 * This shared validation logic is used by both AddPromptForm and EditPromptForm
 * to ensure consistent validation rules across all prompt forms.
 *
 * @param title - The prompt title to validate
 * @param content - The prompt content to validate (required field)
 * @param options - Logging context (component name and optional prompt ID)
 * @returns FieldErrors object with validation errors, or empty object if valid
 *
 * @example
 * ```ts
 * const errors = validatePromptFields(title, content, { component: 'AddPromptForm' });
 * if (Object.keys(errors).length > 0) {
 *   return errors; // Has validation errors
 * }
 * // Proceed with submission
 * ```
 */
export function validatePromptFields(
  title: string,
  content: string,
  options: ValidationLogOptions
): FieldErrors {
  const validationErrors: FieldErrors = {};

  // Content validation (required field)
  if (!content.trim()) {
    Logger.warn('Form validation failed: Content is required', {
      component: options.component,
      field: 'content',
      ...(options.promptId && { promptId: options.promptId })
    });
    validationErrors.content = VALIDATION_MESSAGES.CONTENT_REQUIRED;
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    Logger.warn('Form validation failed: Content exceeds limit', {
      component: options.component,
      field: 'content',
      length: content.length,
      limit: MAX_CONTENT_LENGTH,
      ...(options.promptId && { promptId: options.promptId })
    });
    validationErrors.content = VALIDATION_MESSAGES.CONTENT_TOO_LONG;
  }

  // Title validation (optional field, but has length limit)
  if (title.length > MAX_TITLE_LENGTH) {
    Logger.warn('Form validation failed: Title exceeds limit', {
      component: options.component,
      field: 'title',
      length: title.length,
      limit: MAX_TITLE_LENGTH,
      ...(options.promptId && { promptId: options.promptId })
    });
    validationErrors.title = VALIDATION_MESSAGES.TITLE_TOO_LONG;
  }

  return validationErrors;
}

// ============================================================================
// Type Guards for Runtime Validation
// ============================================================================
// These type guards can be used with UseStorageReturn.loadData<T>(key, validator)
// to ensure runtime type safety when loading data from storage.

/**
 * Type guard for Prompt objects.
 * Validates that a value has the required Prompt structure.
 */
export const isPrompt: TypeGuard<Prompt> = (value): value is Prompt => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.category === 'string' &&
    typeof obj.createdAt === 'number' &&
    typeof obj.updatedAt === 'number'
  );
};

/**
 * Type guard for Category objects.
 * Validates that a value has the required Category structure.
 */
export const isCategory: TypeGuard<Category> = (value): value is Category => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    (obj.color === undefined || typeof obj.color === 'string')
  );
};

/**
 * Type guard for Settings objects.
 * Validates that a value has the required Settings structure.
 */
export const isSettings: TypeGuard<Settings> = (value): value is Settings => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  const validSortOrders = ['createdAt', 'updatedAt', 'title', 'usageCount', 'lastUsedAt'];
  const validSortDirections = ['asc', 'desc'];
  const validThemes = ['light', 'dark', 'system'];
  const validInterfaceModes = ['popup', 'sidepanel'];

  return (
    typeof obj.defaultCategory === 'string' &&
    typeof obj.sortOrder === 'string' &&
    validSortOrders.includes(obj.sortOrder) &&
    typeof obj.sortDirection === 'string' &&
    validSortDirections.includes(obj.sortDirection) &&
    typeof obj.theme === 'string' &&
    validThemes.includes(obj.theme) &&
    (obj.interfaceMode === undefined ||
      (typeof obj.interfaceMode === 'string' && validInterfaceModes.includes(obj.interfaceMode)))
  );
};

/**
 * Type guard for StorageData objects.
 * Validates the complete storage structure including prompts, categories, and settings.
 */
export const isStorageData: TypeGuard<StorageData> = (value): value is StorageData => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.prompts) &&
    obj.prompts.every(isPrompt) &&
    Array.isArray(obj.categories) &&
    obj.categories.every(isCategory) &&
    isSettings(obj.settings)
  );
};

/**
 * Type guard for UsageEvent objects.
 * Validates usage analytics events.
 */
export const isUsageEvent: TypeGuard<UsageEvent> = (value): value is UsageEvent => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.promptId === 'string' &&
    typeof obj.timestamp === 'number' &&
    typeof obj.platform === 'string' &&
    (obj.categoryId === null || typeof obj.categoryId === 'string')
  );
};

/**
 * Type guard for CustomSite objects.
 * Validates custom site configuration.
 */
export const isCustomSite: TypeGuard<CustomSite> = (value): value is CustomSite => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.hostname === 'string' &&
    obj.hostname.length > 0 &&
    typeof obj.displayName === 'string' &&
    obj.displayName.length > 0 &&
    typeof obj.enabled === 'boolean' &&
    typeof obj.dateAdded === 'number'
  );
};

/**
 * Type guard for arrays of a specific type.
 * Creates a type guard for arrays where each element satisfies the provided guard.
 *
 * @example
 * ```typescript
 * const isPromptArray = isArrayOf(isPrompt);
 * const prompts = await loadData<Prompt[]>('prompts', isPromptArray);
 * ```
 */
export function isArrayOf<T>(itemGuard: TypeGuard<T>): TypeGuard<T[]> {
  return (value): value is T[] => {
    return Array.isArray(value) && value.every(itemGuard);
  };
}

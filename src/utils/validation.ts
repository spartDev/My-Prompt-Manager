import { admit } from '../services/promptAdmission';
import type { Category, CustomSite, Prompt, Settings, StorageData, UsageEvent } from '../types';
import type { TypeGuard } from '../types/hooks';

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
  /** The form has no title to generate (an edit): a blank one is refused instead of being left for later. */
  requireTitle?: boolean;
}

/**
 * Validates prompt title and content fields by asking Admission whether they would be
 * admitted (ADR-001): Hidden characters are removed and the title trimmed before the limits
 * apply, and nothing is shortened. The title is optional here, because an empty one is
 * generated on save, so only a non-empty title is judged, unless the form has no title to
 * generate (`requireTitle`, an edit).
 *
 * This shared validation logic is used by both AddPromptForm and EditPromptForm
 * to ensure consistent validation rules across all prompt forms.
 *
 * @param title - The prompt title to validate (optional field)
 * @param content - The prompt content to validate (required field)
 * @param options - Logging context (component name and optional prompt ID)
 * @returns FieldErrors object with Admission's refusal per field, or empty object if valid
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

  const admission = admit({ title: options.requireTitle || title.trim() ? title : undefined, content });
  if (admission.ok) {
    return validationErrors;
  }

  const context = {
    component: options.component,
    ...(options.promptId && { promptId: options.promptId })
  };
  const { content: contentRefusal, title: titleRefusal } = admission.errors;

  if (contentRefusal) {
    Logger.warn(`Form validation failed: ${contentRefusal.message}`, {
      ...context,
      field: 'content',
      length: contentRefusal.length,
      limit: contentRefusal.max
    });
    validationErrors.content = contentRefusal.message;
  }

  if (titleRefusal) {
    Logger.warn(`Form validation failed: ${titleRefusal.message}`, {
      ...context,
      field: 'title',
      length: titleRefusal.length,
      limit: titleRefusal.max
    });
    validationErrors.title = titleRefusal.message;
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

// ============================================================================
// Import Data Validation
// ============================================================================
// These validators are used for validating imported backup data which may have
// a more lenient structure than the full type definitions (e.g., missing IDs
// that will be generated during import).

/**
 * Validates that a value is a valid prompt for import purposes.
 * Import prompts must have id, title, content, and category strings: the same shape the
 * reader (`readPrompt`) needs, so a restore never starts and then fails halfway on a Prompt
 * it cannot read. Other fields (createdAt, usage, etc.) are filled in on import.
 *
 * This checks structure only. The text itself (whitespace, tags, Hidden characters, length)
 * is never judged or rewritten here: Admission decides, once, when each Prompt is restored.
 */
export function isValidImportPrompt(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.title === 'string' &&
    typeof p.content === 'string' &&
    typeof p.category === 'string'
  );
}

/**
 * Validates that a value is a valid category for import purposes.
 * Import categories must have a name string.
 * Other fields (id, color) may be optional or generated during import.
 */
export function isValidImportCategory(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const c = value as Record<string, unknown>;
  return typeof c.name === 'string';
}

/**
 * Finds the first invalid prompt in an array for import validation.
 * Returns undefined if all prompts are valid.
 *
 * @example
 * ```ts
 * const invalid = findInvalidImportPrompt(data.prompts);
 * if (invalid) {
 *   throw new Error('Invalid prompt structure');
 * }
 * ```
 */
export function findInvalidImportPrompt(prompts: unknown[]): unknown {
  return prompts.find(prompt => !isValidImportPrompt(prompt));
}

/**
 * Finds the first invalid category in an array for import validation.
 * Returns undefined if all categories are valid.
 *
 * @example
 * ```ts
 * const invalid = findInvalidImportCategory(data.categories);
 * if (invalid) {
 *   throw new Error('Invalid category structure');
 * }
 * ```
 */
export function findInvalidImportCategory(categories: unknown[]): unknown {
  return categories.find(category => !isValidImportCategory(category));
}

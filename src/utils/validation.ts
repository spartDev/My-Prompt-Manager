import { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH, VALIDATION_MESSAGES } from '../constants/validation';

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

/**
 * Validation constants for form inputs and data limits
 */

/**
 * Maximum length for prompt title field
 * Used in: AddPromptForm, EditPromptForm
 */
export const MAX_TITLE_LENGTH = 100;

/**
 * Maximum length for prompt content field
 * Used in: AddPromptForm, EditPromptForm
 * Updated to 20K to match backend VALIDATION_LIMITS.PROMPT_CONTENT_MAX
 */
export const MAX_CONTENT_LENGTH = 20_000;

/**
 * Maximum length for category name
 * Used in: CategoryManager
 */
export const MAX_CATEGORY_NAME_LENGTH = 50;

/**
 * Maximum length for hex color input (#RRGGBB format)
 * Used in: ColorPicker
 */
export const MAX_HEX_COLOR_LENGTH = 7;

/**
 * Validation error messages
 */
export const VALIDATION_MESSAGES = {
  TITLE_REQUIRED: 'Title is required',
  TITLE_TOO_LONG: `Title cannot exceed ${String(MAX_TITLE_LENGTH)} characters`,
  CONTENT_REQUIRED: 'Content is required',
  CONTENT_TOO_LONG: `Content cannot exceed ${MAX_CONTENT_LENGTH.toLocaleString()} characters`,
  CATEGORY_NAME_REQUIRED: 'Category name is required',
  CATEGORY_NAME_TOO_LONG: `Category name cannot exceed ${String(MAX_CATEGORY_NAME_LENGTH)} characters`,
} as const;

/**
 * Character count display helper
 */
export const formatCharacterCount = (current: number, max: number): string => {
  return `${current.toLocaleString()}/${max.toLocaleString()} characters`;
};

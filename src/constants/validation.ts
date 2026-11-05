/**
 * Validation constants for form inputs
 * (the Prompt text limits are PROMPT_LIMITS in src/services/promptAdmission.ts)
 */

/**
 * Maximum length for hex color input (#RRGGBB format)
 * Used in: ColorPicker
 */
export const MAX_HEX_COLOR_LENGTH = 7;

/**
 * Character count display helper
 */
export const formatCharacterCount = (current: number, max: number): string => {
  return `${current.toLocaleString()}/${max.toLocaleString()} characters`;
};

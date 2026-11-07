/**
 * Validation constants for form inputs
 * (the Prompt text limits are PROMPT_LIMITS in src/services/promptAdmission.ts)
 */

/**
 * Character count display helper
 */
export const formatCharacterCount = (current: number, max: number): string => {
  return `${current.toLocaleString()}/${max.toLocaleString()} characters`;
};

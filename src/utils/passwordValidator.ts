/**
 * Password Validation Utility
 *
 * Provides comprehensive password strength validation for encryption operations.
 * This module validates passwords against security best practices but does NOT
 * enforce these requirements - validation is informative only.
 *
 * @module passwordValidator
 */

import { PasswordValidationError, type PasswordValidationResult } from '../types/backup';

/**
 * Minimum recommended password length for AES-256 encryption
 * @constant {number}
 */
const MIN_PASSWORD_LENGTH = 12;

/**
 * Maximum password length to prevent DoS attacks
 * @constant {number}
 */
const MAX_PASSWORD_LENGTH = 128;

/**
 * Minimum Shannon entropy in bits for password complexity
 * Lower values allow more passwords but may be less secure
 * @constant {number}
 */
const MIN_ENTROPY_BITS = 40; // Adjusted to be less strict

/**
 * Set of common passwords and patterns to reject
 * Includes top 35+ most commonly used passwords and simple variations
 * @constant {Set<string>}
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456', '12345678', '123456789', '12345', '1234567890',
  'qwerty', 'abc123', 'password1', 'admin', 'letmein', 'welcome', 'monkey', '1234567',
  'password!', 'Aa123456', 'Password1', 'Password123', 'passw0rd', 'qwerty123',
  'iloveyou', 'princess', 'admin123', 'welcome123', 'login', 'starwars', 'sunshine',
  'master', 'hello', 'freedom', 'whatever', 'trustno1', 'dragon', 'shadow', 'football'
]);

/**
 * Calculates Shannon entropy for a password string
 *
 * Shannon entropy measures the unpredictability and randomness of a password.
 * Higher entropy indicates a more secure password that's harder to guess or crack.
 *
 * The calculation considers:
 * - Character frequency distribution
 * - Password length
 * - Overall randomness
 *
 * @param {string} password - The password to analyze
 * @returns {number} Entropy in bits (0 for empty string, higher is more secure)
 *
 * @example
 * calculateEntropy('aaaa');      // Low entropy (predictable)
 * calculateEntropy('xK9#mL2$');  // High entropy (random)
 *
 * @private
 */
const calculateEntropy = (password: string): number => {
  if (!password) {return 0;}

  const charCounts = new Map<string, number>();
  for (const char of password) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }

  let entropy = 0;
  const length = password.length;

  for (const count of charCounts.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  // Multiply by length to get total entropy in bits
  return entropy * length;
};

/**
 * Checks if password contains common patterns or sequences
 *
 * Detects and flags passwords that contain:
 * - Common passwords (from COMMON_PASSWORDS set)
 * - Base words that are common passwords (e.g., "Password123" contains "password")
 * - Sequential patterns (e.g., "abcd", "1234", "qwerty")
 * - Repeated characters (e.g., "aaa", "111")
 *
 * @param {string} password - The password to check
 * @returns {boolean} True if password contains common patterns, false otherwise
 *
 * @example
 * hasCommonPatterns('Password123');  // true (contains 'password')
 * hasCommonPatterns('abcd1234');     // true (sequential patterns)
 * hasCommonPatterns('xK9#mL2$');     // false (no patterns)
 *
 * @private
 */
const hasCommonPatterns = (password: string): boolean => {
  const lower = password.toLowerCase();

  // Remove numbers and special characters for base word checking
  const baseWord = password.replace(/[^a-zA-Z]/g, '').toLowerCase();

  // Check against common passwords list (exact match)
  if (COMMON_PASSWORDS.has(lower)) {
    return true;
  }

  // Check if base word (without numbers/symbols) is a common password
  if (baseWord.length >= 5 && COMMON_PASSWORDS.has(baseWord)) {
    return true;
  }

  // Check for simple sequences
  const sequences = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  for (const sequence of sequences) {
    // Check for 4+ character sequences (forward and backward)
    for (let i = 0; i <= sequence.length - 4; i++) {
      const substring = sequence.substring(i, i + 4);
      // eslint-disable-next-line @typescript-eslint/no-misused-spread
      if (lower.includes(substring) || lower.includes([...substring].reverse().join(''))) {
        return true;
      }
    }
  }

  // Check for repeated characters (3+ times)
  if (/(.)\1{2,}/.test(password)) {
    return true;
  }

  return false;
};

/**
 * Calculates password strength score (0-100)
 *
 * The score is based on multiple factors:
 * - Length (0-40 points): Longer passwords score higher
 * - Character variety (0-40 points): Mix of uppercase, lowercase, numbers, special chars
 * - Entropy (0-20 points): Randomness and unpredictability
 * - Penalties: Deduct 10 points per validation error
 *
 * @param {string} password - The password to score
 * @param {PasswordValidationError[]} errors - Array of validation errors found
 * @returns {number} Score from 0-100 (0 = weakest, 100 = strongest)
 *
 * @example
 * calculateScore('weak', [TOO_SHORT, NO_UPPERCASE]);  // ~15
 * calculateScore('MyStr0ng!Pass', []);                // ~85
 *
 * @private
 */
const calculateScore = (password: string, errors: PasswordValidationError[]): number => {
  let score = 0;

  // Base score for length (0-40 points)
  const lengthScore = Math.min((password.length / MIN_PASSWORD_LENGTH) * 30, 40);
  score += lengthScore;

  // Character variety (0-40 points)
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const varietyCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
  score += varietyCount * 10;

  // Entropy bonus (0-20 points)
  const entropy = calculateEntropy(password);
  const entropyScore = Math.min((entropy / 80) * 20, 20);
  score += entropyScore;

  // Penalties for errors
  const errorPenalty = errors.length * 10;
  score -= errorPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
};

/**
 * Determines password strength category based on score and length
 *
 * Categorizes password strength into four levels:
 * - weak: Score < 40 or length < 8
 * - fair: Score 40-59
 * - good: Score 60-79
 * - strong: Score 80+
 *
 * @param {number} score - Password score (0-100)
 * @param {number} length - Password length in characters
 * @returns {'weak' | 'fair' | 'good' | 'strong'} Strength category
 *
 * @example
 * getStrength(25, 6);   // 'weak' (short password)
 * getStrength(55, 12);  // 'fair'
 * getStrength(70, 14);  // 'good'
 * getStrength(90, 16);  // 'strong'
 *
 * @private
 */
const getStrength = (score: number, length: number): 'weak' | 'fair' | 'good' | 'strong' => {
  // Very short passwords (< 8) are always weak
  if (length < 8) {return 'weak';}

  if (score < 40) {return 'weak';}
  if (score < 60) {return 'fair';}
  if (score < 80) {return 'good';}
  return 'strong';
};

/**
 * Validates password strength according to security best practices
 *
 * IMPORTANT: This validation is informative only and does NOT block password use.
 * Users can choose to proceed with weak passwords - this function provides
 * guidance and feedback only.
 *
 * Validation Criteria:
 * - Length: 12-128 characters (recommended for AES-256 encryption)
 * - Character variety: Must include uppercase, lowercase, numbers, and special characters
 * - No common passwords: Checks against list of 35+ common passwords
 * - No predictable patterns: Rejects sequential or repeated characters
 * - Sufficient entropy: Minimum 40 bits of Shannon entropy
 *
 * The result includes:
 * - valid: Boolean indicating if all checks passed
 * - errors: Array of specific validation errors found
 * - strength: Category (weak/fair/good/strong)
 * - score: Numeric rating 0-100
 *
 * @param {string} password - The password to validate
 * @returns {PasswordValidationResult} Detailed validation result
 *
 * @example
 * // Strong password
 * validatePassword('MyStr0ng!Pass');
 * // → { valid: true, errors: [], strength: 'strong', score: 87 }
 *
 * @example
 * // Weak password
 * validatePassword('password123');
 * // → {
 * //   valid: false,
 * //   errors: [TOO_SHORT, NO_UPPERCASE, NO_SPECIAL_CHARS, COMMON_PASSWORD],
 * //   strength: 'weak',
 * //   score: 15
 * // }
 *
 * @public
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: PasswordValidationError[] = [];

  // Check length constraints
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(PasswordValidationError.TOO_SHORT);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(PasswordValidationError.TOO_LONG);
  }

  // Check character variety
  if (!/[A-Z]/.test(password)) {
    errors.push(PasswordValidationError.NO_UPPERCASE);
  }

  if (!/[a-z]/.test(password)) {
    errors.push(PasswordValidationError.NO_LOWERCASE);
  }

  if (!/\d/.test(password)) {
    errors.push(PasswordValidationError.NO_NUMBERS);
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push(PasswordValidationError.NO_SPECIAL_CHARS);
  }

  // Check for common passwords and patterns
  if (hasCommonPatterns(password)) {
    errors.push(PasswordValidationError.COMMON_PASSWORD);
  }

  // Check entropy
  const entropy = calculateEntropy(password);
  if (entropy < MIN_ENTROPY_BITS) {
    errors.push(PasswordValidationError.INSUFFICIENT_ENTROPY);
  }

  const score = calculateScore(password, errors);
  const strength = getStrength(score, password.length);

  return {
    valid: errors.length === 0,
    errors,
    strength,
    score
  };
};

/**
 * Gets human-readable error message for a validation error
 *
 * Converts a PasswordValidationError enum value into a user-friendly
 * message suitable for display in UI error messages or help text.
 *
 * @param {PasswordValidationError} error - The validation error type
 * @returns {string} User-friendly error message
 *
 * @example
 * getPasswordErrorMessage(PasswordValidationError.TOO_SHORT);
 * // → "Password must be at least 12 characters long"
 *
 * @example
 * getPasswordErrorMessage(PasswordValidationError.COMMON_PASSWORD);
 * // → "Password is too common or contains predictable patterns"
 *
 * @public
 */
export const getPasswordErrorMessage = (error: PasswordValidationError): string => {
  switch (error) {
    case PasswordValidationError.TOO_SHORT:
      return `Password must be at least ${MIN_PASSWORD_LENGTH.toString()} characters long`;
    case PasswordValidationError.TOO_LONG:
      return `Password must be no more than ${MAX_PASSWORD_LENGTH.toString()} characters`;
    case PasswordValidationError.NO_UPPERCASE:
      return 'Password must contain at least one uppercase letter (A-Z)';
    case PasswordValidationError.NO_LOWERCASE:
      return 'Password must contain at least one lowercase letter (a-z)';
    case PasswordValidationError.NO_NUMBERS:
      return 'Password must contain at least one number (0-9)';
    case PasswordValidationError.NO_SPECIAL_CHARS:
      return 'Password must contain at least one special character (!@#$%^&*...)';
    case PasswordValidationError.COMMON_PASSWORD:
      return 'Password is too common or contains predictable patterns';
    case PasswordValidationError.INSUFFICIENT_ENTROPY:
      return 'Password is not complex enough (add more variety)';
    default:
      return 'Password does not meet security requirements';
  }
};

/**
 * Gets all password requirements as human-readable list
 *
 * Returns a complete list of password requirements that users should
 * follow for maximum security. Useful for displaying password creation
 * help text or requirements checklist in UI.
 *
 * Requirements include:
 * - Minimum length (12 characters)
 * - Character variety (uppercase, lowercase, numbers, special characters)
 * - No common passwords or patterns
 *
 * @returns {string[]} Array of requirement descriptions
 *
 * @example
 * const requirements = getPasswordRequirements();
 * requirements.forEach(req => console.log(`• ${req}`));
 * // Output:
 * // • At least 12 characters long
 * // • Contains uppercase letters (A-Z)
 * // • Contains lowercase letters (a-z)
 * // • Contains numbers (0-9)
 * // • Contains special characters (!@#$%^&*...)
 * // • Not a common password or pattern
 *
 * @public
 */
export const getPasswordRequirements = (): string[] => {
  return [
    `At least ${MIN_PASSWORD_LENGTH.toString()} characters long`,
    'Contains uppercase letters (A-Z)',
    'Contains lowercase letters (a-z)',
    'Contains numbers (0-9)',
    'Contains special characters (!@#$%^&*...)',
    'Not a common password or pattern'
  ];
};

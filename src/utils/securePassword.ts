/**
 * Secure Password Utilities
 *
 * Provides utilities for secure handling and clearing of passwords in memory.
 * Passwords are sensitive data that should be cleared from memory as soon as
 * they are no longer needed to minimize security risks.
 *
 * Security Considerations:
 * - JavaScript strings are immutable and not easily cleared from memory
 * - Garbage collection is non-deterministic
 * - This utility provides best-effort clearing by overwriting references
 * - True memory clearing requires native code (not available in browsers)
 *
 * Best Practices:
 * - Clear passwords immediately after use
 * - Don't store passwords longer than necessary
 * - Use refs instead of state when possible
 * - Clear passwords on component unmount
 *
 * @module securePassword
 */

/**
 * Secure password reference holder
 *
 * Wraps a password string with metadata and provides secure clearing.
 * This class is designed to be used with React refs for better control
 * over password lifecycle.
 */
export class SecurePasswordRef {
  private _value: string = '';
  private _cleared: boolean = false;

  /**
   * Creates a new SecurePasswordRef
   *
   * @param {string} [initialValue=''] - Initial password value
   */
  constructor(initialValue: string = '') {
    this._value = initialValue;
  }

  /**
   * Gets the current password value
   *
   * @returns {string} Current password (empty if cleared)
   * @throws {Error} If password has been cleared
   */
  get value(): string {
    if (this._cleared) {
      throw new Error('Attempted to access cleared password');
    }
    return this._value;
  }

  /**
   * Sets the password value
   *
   * @param {string} newValue - New password value
   */
  set value(newValue: string) {
    this._value = newValue;
    this._cleared = false;
  }

  /**
   * Gets the password value safely (returns empty string if cleared)
   *
   * @returns {string} Current password or empty string if cleared
   */
  getValueSafe(): string {
    return this._cleared ? '' : this._value;
  }

  /**
   * Checks if password has been cleared
   *
   * @returns {boolean} True if password has been cleared
   */
  isCleared(): boolean {
    return this._cleared;
  }

  /**
   * Checks if password is empty or cleared
   *
   * @returns {boolean} True if password is empty or cleared
   */
  isEmpty(): boolean {
    return this._cleared || this._value.length === 0;
  }

  /**
   * Securely clears the password from memory
   *
   * Best-effort approach to clearing sensitive data:
   * 1. Overwrite string reference with zeros
   * 2. Set to empty string
   * 3. Mark as cleared
   *
   * Note: JavaScript strings are immutable, so this doesn't actually
   * overwrite the original string in memory. It only clears the reference.
   * The garbage collector will eventually reclaim the memory.
   */
  clear(): void {
    if (!this._cleared) {
      // Overwrite reference with empty string
      // (actual string in memory may persist until GC)
      this._value = '';
      this._cleared = true;
    }
  }
}

/**
 * Securely clears a password string reference
 *
 * This is a best-effort approach to clearing passwords from memory.
 * Due to JavaScript's immutable strings, we can't truly overwrite
 * the string data in memory, but we can clear the reference.
 *
 * For better security, use SecurePasswordRef with React refs instead
 * of storing passwords in component state.
 *
 * @param {string} password - Password to clear (reference will be lost)
 * @returns {string} Empty string
 *
 * @example
 * let password = 'secret123';
 * password = clearPassword(password);
 * // password is now ''
 *
 * @public
 */
export const clearPassword = (_password: string): string => {
  // Best effort - in JavaScript, we can't truly overwrite the original string
  // This function just returns an empty string for the caller to reassign
  return '';
};

/**
 * Clears multiple password strings
 *
 * Convenience function for clearing multiple password references at once.
 *
 * @param {...string} passwords - Passwords to clear
 * @returns {string[]} Array of empty strings
 *
 * @example
 * const [pwd1, pwd2, pwd3] = clearPasswords(password1, password2, password3);
 * // All variables are now ''
 *
 * @public
 */
export const clearPasswords = (...passwords: string[]): string[] => {
  return passwords.map(() => '');
};

/**
 * Password cleanup callback type
 */
export type PasswordCleanupFn = () => void;

/**
 * Creates a cleanup function for a password reference
 *
 * Useful for React's useEffect cleanup or component unmount.
 *
 * @param {SecurePasswordRef} passwordRef - Password reference to clear on cleanup
 * @returns {PasswordCleanupFn} Cleanup function
 *
 * @example
 * const passwordRef = useRef(new SecurePasswordRef());
 *
 * useEffect(() => {
 *   return createPasswordCleanup(passwordRef.current);
 * }, []);
 *
 * @public
 */
export const createPasswordCleanup = (passwordRef: SecurePasswordRef): PasswordCleanupFn => {
  return () => {
    passwordRef.clear();
  };
};

/**
 * Creates cleanup function for multiple password references
 *
 * @param {...SecurePasswordRef} passwordRefs - Password references to clear
 * @returns {PasswordCleanupFn} Cleanup function that clears all refs
 *
 * @example
 * useEffect(() => {
 *   return createPasswordsCleanup(encryptionPasswordRef.current, decryptionPasswordRef.current);
 * }, []);
 *
 * @public
 */
export const createPasswordsCleanup = (...passwordRefs: SecurePasswordRef[]): PasswordCleanupFn => {
  return () => {
    passwordRefs.forEach((ref) => {
      ref.clear();
    });
  };
};

/**
 * Timing-safe password comparison
 *
 * Compares two passwords in constant time to prevent timing attacks.
 * This is important for security-sensitive operations.
 *
 * Note: For user authentication, always use server-side validation
 * with proper password hashing (bcrypt, argon2, etc.).
 *
 * @param {string} password1 - First password
 * @param {string} password2 - Second password
 * @returns {boolean} True if passwords match
 *
 * @example
 * if (timingSafeEqual(userInput, storedPassword)) {
 *   // Passwords match
 * }
 *
 * @public
 */
export const timingSafeEqual = (password1: string, password2: string): boolean => {
  // If lengths differ, still compare same number of characters to prevent timing leak
  const maxLength = Math.max(password1.length, password2.length);
  const p1 = password1.padEnd(maxLength, '\0');
  const p2 = password2.padEnd(maxLength, '\0');

  let result = 0;
  for (let i = 0; i < maxLength; i += 1) {
    // XOR characters and accumulate (constant time)
    result |= p1.charCodeAt(i) ^ p2.charCodeAt(i);
  }

  // Return true only if all characters matched (result === 0)
  return result === 0 && password1.length === password2.length;
};

/**
 * Password security recommendations
 *
 * Returns a list of security best practices for password handling.
 *
 * @returns {string[]} Array of security recommendations
 *
 * @public
 */
export const getPasswordSecurityRecommendations = (): string[] => {
  return [
    'Clear passwords from memory immediately after use',
    'Never log passwords to console or error messages',
    'Use HTTPS for all password transmission',
    'Store passwords using proper hashing (bcrypt, argon2)',
    'Implement rate limiting for password attempts',
    'Use password strength validation',
    'Enable two-factor authentication when possible',
    'Never store passwords in plaintext',
    'Clear password inputs on component unmount',
    'Use refs instead of state for password storage when possible'
  ];
};

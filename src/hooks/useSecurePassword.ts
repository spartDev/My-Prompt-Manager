/**
 * Secure Password Hook
 *
 * React hook for secure password handling with automatic cleanup.
 * Manages password state using refs for better security and provides
 * automatic clearing on component unmount.
 *
 * Features:
 * - Secure password storage using refs instead of state
 * - Automatic cleanup on component unmount
 * - Manual clear() method for immediate clearing
 * - isEmpty() helper for validation
 * - Safe access to password value
 *
 * Usage:
 * ```tsx
 * const password = useSecurePassword();
 *
 * // Set password
 * <input value={password.value} onChange={e => password.setValue(e.target.value)} />
 *
 * // Use password
 * await encrypt(data, password.value);
 *
 * // Clear after use
 * password.clear();
 * ```
 *
 * @module useSecurePassword
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { SecurePasswordRef } from '../utils/securePassword';

/**
 * Secure password state management interface
 */
export interface UseSecurePasswordReturn {
  /** Current password value (empty string if cleared) */
  value: string;
  /** Sets the password value */
  setValue: (newValue: string) => void;
  /** Clears the password from memory */
  clear: () => void;
  /** Checks if password is empty or cleared */
  isEmpty: () => boolean;
  /** Checks if password has been cleared */
  isCleared: () => boolean;
}

/**
 * Hook options
 */
export interface UseSecurePasswordOptions {
  /** Initial password value */
  initialValue?: string;
  /** Whether to clear password on component unmount (default: true) */
  clearOnUnmount?: boolean;
}

/**
 * React hook for secure password handling
 *
 * Manages password state using a ref for better security and provides
 * automatic cleanup on component unmount to minimize password exposure
 * in memory.
 *
 * Security Features:
 * - Uses ref instead of state (avoids re-renders with sensitive data)
 * - Automatic cleanup on unmount
 * - Manual clear() for immediate clearing after use
 * - Safe isEmpty() check without exposing value
 *
 * @param {UseSecurePasswordOptions} [options] - Configuration options
 * @returns {UseSecurePasswordReturn} Password management interface
 *
 * @example
 * // Basic usage
 * function LoginForm() {
 *   const password = useSecurePassword();
 *
 *   const handleSubmit = async () => {
 *     await login(username, password.value);
 *     password.clear(); // Clear immediately after use
 *   };
 *
 *   return (
 *     <input
 *       type="password"
 *       value={password.value}
 *       onChange={(e) => password.setValue(e.target.value)}
 *     />
 *   );
 * }
 *
 * @example
 * // With initial value
 * const password = useSecurePassword({ initialValue: 'temp123' });
 *
 * @example
 * // Disable auto-clear on unmount
 * const password = useSecurePassword({ clearOnUnmount: false });
 *
 * @public
 */
export function useSecurePassword(options: UseSecurePasswordOptions = {}): UseSecurePasswordReturn {
  const { initialValue = '', clearOnUnmount = true } = options;

  // Use ref to store password (better security than state)
  const passwordRef = useRef<SecurePasswordRef>(new SecurePasswordRef(initialValue));

  // Force re-render counter (only used when password changes)
  const [, setRenderCount] = useState(0);

  /**
   * Sets the password value and triggers a re-render
   */
  const setValue = useCallback((newValue: string) => {
    passwordRef.current.value = newValue;
    // Force re-render when password changes (needed for controlled inputs)
    setRenderCount((count) => count + 1);
  }, []);

  /**
   * Clears the password from memory
   */
  const clear = useCallback(() => {
    passwordRef.current.clear();
    setRenderCount((count) => count + 1);
  }, []);

  /**
   * Checks if password is empty or cleared
   */
  const isEmpty = useCallback(() => {
    return passwordRef.current.isEmpty();
  }, []);

  /**
   * Checks if password has been cleared
   */
  const isCleared = useCallback(() => {
    return passwordRef.current.isCleared();
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    const ref = passwordRef.current;
    return () => {
      if (clearOnUnmount) {
        ref.clear();
      }
    };
  }, [clearOnUnmount]);

  return {
    value: passwordRef.current.getValueSafe(),
    setValue,
    clear,
    isEmpty,
    isCleared
  };
}

/**
 * Hook for managing multiple passwords securely
 *
 * Convenience hook for components that need multiple password fields
 * (e.g., password + confirm password, or encryption + decryption passwords).
 *
 * @param {number} count - Number of password fields to manage
 * @param {UseSecurePasswordOptions} [options] - Configuration options
 * @returns {UseSecurePasswordReturn[]} Array of password management interfaces
 *
 * @example
 * function PasswordChange() {
 *   const [currentPassword, newPassword, confirmPassword] = useSecurePasswords(3);
 *
 *   return (
 *     <>
 *       <input type="password" value={currentPassword.value}
 *         onChange={e => currentPassword.setValue(e.target.value)} />
 *       <input type="password" value={newPassword.value}
 *         onChange={e => newPassword.setValue(e.target.value)} />
 *       <input type="password" value={confirmPassword.value}
 *         onChange={e => confirmPassword.setValue(e.target.value)} />
 *     </>
 *   );
 * }
 *
 * @public
 */
export function useSecurePasswords(
  count: number,
  options: UseSecurePasswordOptions = {}
): UseSecurePasswordReturn[] {
  const passwords: UseSecurePasswordReturn[] = [];

  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    passwords.push(useSecurePassword(options));
  }

  return passwords;
}

/**
 * Hook for password with confirmation field
 *
 * Manages two password fields (password + confirm) and provides
 * validation that they match.
 *
 * @param {UseSecurePasswordOptions} [options] - Configuration options
 * @returns {object} Password management with confirmation
 * @returns {UseSecurePasswordReturn} returns.password - Primary password field
 * @returns {UseSecurePasswordReturn} returns.confirmPassword - Confirmation field
 * @returns {() => boolean} returns.passwordsMatch - Check if passwords match
 * @returns {() => void} returns.clearBoth - Clear both passwords
 *
 * @example
 * function RegisterForm() {
 *   const { password, confirmPassword, passwordsMatch, clearBoth } = usePasswordWithConfirm();
 *
 *   const handleSubmit = async () => {
 *     if (!passwordsMatch()) {
 *       alert('Passwords do not match');
 *       return;
 *     }
 *     await register(email, password.value);
 *     clearBoth(); // Clear both passwords after use
 *   };
 *
 *   return (
 *     <>
 *       <input type="password" value={password.value}
 *         onChange={e => password.setValue(e.target.value)} />
 *       <input type="password" value={confirmPassword.value}
 *         onChange={e => confirmPassword.setValue(e.target.value)} />
 *     </>
 *   );
 * }
 *
 * @public
 */
export function usePasswordWithConfirm(options: UseSecurePasswordOptions = {}) {
  const password = useSecurePassword(options);
  const confirmPassword = useSecurePassword(options);

  const passwordsMatch = useCallback(() => {
    return password.value === confirmPassword.value && password.value.length > 0;
  }, [password, confirmPassword]);

  const clearBoth = useCallback(() => {
    password.clear();
    confirmPassword.clear();
  }, [password, confirmPassword]);

  return {
    password,
    confirmPassword,
    passwordsMatch,
    clearBoth
  };
}

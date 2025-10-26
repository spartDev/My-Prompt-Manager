/**
 * Password Strength Indicator Component
 *
 * Visual password strength feedback component that displays real-time
 * password quality metrics. This is a non-blocking, informative UI component
 * that does NOT prevent users from using weak passwords.
 *
 * Display Features:
 * - Color-coded strength bar (red/yellow/blue/green)
 * - Numeric score (0-100)
 * - Strength category label (weak/fair/good/strong)
 * - Success indicator for strong passwords
 *
 * User Experience Philosophy:
 * - Provides visual feedback but does not enforce password requirements
 * - Users can proceed with any password strength
 * - Validation is informative, not restrictive
 *
 * @module PasswordStrengthIndicator
 */

import { validatePassword } from '../utils/passwordValidator';

/**
 * Props for PasswordStrengthIndicator component
 *
 * @interface PasswordStrengthIndicatorProps
 */
interface PasswordStrengthIndicatorProps {
  /** Password string to evaluate for strength (live updates) */
  password: string;
}

/**
 * Password Strength Indicator
 *
 * Displays a visual indicator of password strength with color-coded bar
 * and numeric score. Provides real-time feedback as user types.
 *
 * Strength Categories:
 * - weak (red): Score < 40 or length < 8
 * - fair (yellow): Score 40-59
 * - good (blue): Score 60-79
 * - strong (green): Score 80+
 *
 * IMPORTANT: This component is informative only and does NOT block user actions.
 * Password strength validation is handled by passwordValidator utility, but
 * enforcement is intentionally disabled per user requirements.
 *
 * @param {PasswordStrengthIndicatorProps} props - Component props
 * @returns {JSX.Element} Strength indicator UI or empty fragment if no password
 *
 * @example
 * <PasswordStrengthIndicator password={userPassword} />
 * // Shows strength bar, score, and category label
 *
 * @example
 * <PasswordStrengthIndicator password="" />
 * // Returns empty fragment (no display)
 *
 * @public
 */
export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps): JSX.Element {
  if (!password) {
    return <></>;
  }

  const validation = validatePassword(password);
  const { strength, score } = validation;

  // Color mapping for strength levels
  const strengthColors = {
    weak: 'bg-red-500',
    fair: 'bg-yellow-500',
    good: 'bg-blue-500',
    strong: 'bg-green-500'
  };

  const strengthTextColors = {
    weak: 'text-red-600 dark:text-red-400',
    fair: 'text-yellow-600 dark:text-yellow-400',
    good: 'text-blue-600 dark:text-blue-400',
    strong: 'text-green-600 dark:text-green-400'
  };

  const strengthLabels = {
    weak: 'Weak',
    fair: 'Fair',
    good: 'Good',
    strong: 'Strong'
  };

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600 dark:text-gray-400">Password strength:</span>
          <span className={`font-medium ${strengthTextColors[strength]}`}>
            {strengthLabels[strength]} ({score.toString()}/100)
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${strengthColors[strength]} transition-all duration-300`}
            style={{ width: `${score.toString()}%` }}
          />
        </div>
      </div>

      {/* Success message for strong passwords */}
      {validation.valid && (
        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>Excellent password security</span>
        </div>
      )}
    </div>
  );
}

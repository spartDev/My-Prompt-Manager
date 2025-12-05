import { FC } from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  size?: 'small' | 'medium';
}

const ToggleSwitch: FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  size = 'medium'
}) => {
  const sizeClasses = size === 'small'
    ? { container: 'w-9 h-5', knob: 'h-3 w-3', translate: 'translate-x-5' }
    : { container: 'w-11 h-6', knob: 'h-5 w-5', translate: 'translate-x-6' };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => { onChange(!checked); }}
      disabled={disabled}
      className={`
        ${sizeClasses.container}
        relative inline-flex items-center rounded-full transition-all duration-200
        focus:outline-hidden focus:ring-4 focus:ring-purple-300 dark:focus:ring-purple-800
        ${checked
          ? 'bg-linear-to-r from-purple-600 to-indigo-600 shadow-xs'
          : 'bg-gray-200 dark:bg-gray-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          ${sizeClasses.knob}
          inline-block transform rounded-full bg-white shadow-xs transition-transform duration-200
          border border-gray-300 dark:border-gray-600
          ${checked ? sizeClasses.translate : 'translate-x-[2px]'}
        `}
      />
    </button>
  );
};

export default ToggleSwitch;
import { FC, memo } from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  size?: 'small' | 'medium';
  id?: string;
  name?: string;
}

const SIZE_CLASSES = {
  small: { container: 'w-9 h-5', knob: 'h-3 w-3', translate: 'translate-x-5' },
  medium: { container: 'h-6 w-11', knob: 'h-4 w-4', translate: 'translate-x-6' }
} as const;

const ToggleSwitch: FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  size = 'medium',
  id,
  name
}) => {
  const sizeClasses = SIZE_CLASSES[size];

  return (
    <button
      type="button"
      id={id}
      name={name}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => { onChange(!checked); }}
      disabled={disabled}
      className={`
        ${sizeClasses.container}
        relative inline-flex shrink-0 items-center rounded-full transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 dark:focus:ring-offset-gray-800 dark:focus:ring-purple-800
        ${checked
          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-sm'
          : 'bg-gray-200 dark:bg-gray-700'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          ${sizeClasses.knob}
          inline-block transform rounded-full bg-white shadow-sm transition-transform duration-200
          border border-gray-300 dark:border-gray-600
          ${checked ? sizeClasses.translate : 'translate-x-1'}
        `}
      />
    </button>
  );
};

export default memo(ToggleSwitch);

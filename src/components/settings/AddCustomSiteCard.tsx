import { FC, useId } from 'react';

interface AddCustomSiteCardProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  tooltip?: string;
}

const AddCustomSiteCard: FC<AddCustomSiteCardProps> = ({
  onClick,
  disabled = false,
  className = '',
  tooltip
}) => {
  const descriptionId = useId();

  const baseClasses = `
    group relative flex h-full flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-700
    bg-white dark:bg-gray-800 p-4 text-left transition-all duration-200
    focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400/70
  `;

  const stateClasses = disabled
    ? 'cursor-not-allowed opacity-80 bg-gray-100 dark:bg-gray-800/70 border-gray-300 dark:border-gray-600'
    : 'cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-xs';

  const iconClasses = disabled
    ? 'bg-purple-100 text-purple-400 dark:bg-purple-900/30 dark:text-purple-500'
    : 'bg-purple-100 text-purple-600 group-hover:bg-purple-200 group-hover:text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 dark:group-hover:bg-purple-800/70 dark:group-hover:text-purple-200';

  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) {
          onClick();
        }
      }}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label="Add new custom site integration"
      aria-describedby={descriptionId}
      className={`${baseClasses} ${stateClasses} ${className}`}
      title={tooltip}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200 ${iconClasses}`}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Add Custom Site
          </p>
          <p id={descriptionId} className="text-xs text-gray-600 dark:text-gray-400">
            Configure a new AI platform integration
          </p>
        </div>
      </div>
    </button>
  );
};

export default AddCustomSiteCard;

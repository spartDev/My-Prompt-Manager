import { type FC, useId } from 'react';

import { cn } from '../../utils/cn';

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
    group relative flex h-full flex-col gap-3 rounded-xl border border-default
    bg-card p-4 text-left transition-all duration-200
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
  `;

  const stateClasses = disabled
    ? 'cursor-not-allowed opacity-80'
    : 'cursor-pointer hover:border-accent hover:shadow-sm';

  const iconClasses = disabled
    ? 'bg-muted text-tertiary'
    : 'bg-accent-subtle text-accent group-hover:bg-accent-selected group-hover:text-accent-strong';

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
      className={cn(baseClasses, stateClasses, className)}
      title={tooltip}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200', iconClasses)}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary">
            Add Custom Site
          </p>
          <p id={descriptionId} className="text-xs text-secondary">
            Configure a new AI platform integration
          </p>
        </div>
      </div>
    </button>
  );
};

export default AddCustomSiteCard;

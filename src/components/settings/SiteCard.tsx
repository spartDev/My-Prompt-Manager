import { type FC, type ReactNode, useCallback } from 'react';

import { getBrandColors } from '../../constants/brandColors';

import ExportButton from './ExportButton';
import ToggleSwitch from './ToggleSwitch';

interface SiteCardProps {
  hostname: string;
  name: string;
  description?: string;
  icon: ReactNode;
  isEnabled: boolean;
  isCustom?: boolean;
  onToggle: (hostname: string, enabled: boolean) => Promise<void> | void;
  onRemove?: (hostname: string) => Promise<void> | void;
  onEdit?: (hostname: string) => Promise<void> | void;
  onExport?: (hostname: string) => Promise<void> | void;
  exporting?: boolean;
  saving?: boolean;
}

const SiteCard: FC<SiteCardProps> = ({
  hostname,
  name,
  description,
  icon,
  isEnabled,
  isCustom = false,
  onToggle,
  onRemove,
  onEdit,
  onExport,
  exporting = false,
  saving = false
}) => {
  const brandColors = getBrandColors(hostname);

  const handleToggle = useCallback(
    (checked: boolean) => {
      void onToggle(hostname, checked);
    },
    [hostname, onToggle]
  );

  const handleExport = useCallback(() => {
    if (onExport) {
      void onExport(hostname);
    }
  }, [hostname, onExport]);

  const handleEdit = useCallback(() => {
    if (onEdit) {
      void onEdit(hostname);
    }
  }, [hostname, onEdit]);

  const handleRemove = useCallback(() => {
    if (onRemove) {
      void onRemove(hostname);
    }
  }, [hostname, onRemove]);
  
  return (
    <div data-testid="site-card" className={`
      relative p-4 rounded-xl border transition-all duration-200
      border-default bg-card
      ${isEnabled ? 'shadow-sm' : 'hover:shadow-sm'}
    `}>
      {/* Site Icon and Info */}
      <div className="flex items-start gap-3">
        <div data-testid="site-logo" className={`
          w-10 h-10 rounded-lg flex items-center justify-center text-lg font-semibold shrink-0 transition-all duration-200
          ${isEnabled 
            ? brandColors.enabled
            : brandColors.disabled
          }
        `}>
          {icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-primary">
              {name}
            </h4>
            {isEnabled && (
              <svg data-testid="site-enabled-mark" className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <p className="text-xs text-tertiary truncate">
            {hostname}
          </p>
          {description && (
            <p className="text-xs text-secondary mt-1">
              {description}
            </p>
          )}
        </div>

        {/* Toggle Switch */}
        <ToggleSwitch
          checked={isEnabled}
          onChange={handleToggle}
          disabled={saving}
          ariaLabel={`Enable ${name} integration`}
          size="medium"
        />
      </div>

      {/* Custom Site Actions */}
      {isCustom && (
        <div className="flex gap-1 flex-wrap mt-3 pt-3 border-t border-divider">
          {onExport && (
            <ExportButton
              onClick={handleExport}
              disabled={saving}
              loading={exporting}
            />
          )}
          {onEdit && (
            <button
              onClick={handleEdit}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-accent hover:bg-accent-subtle rounded-sm transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
          {onRemove && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-danger hover:bg-danger-subtle rounded-sm transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SiteCard;

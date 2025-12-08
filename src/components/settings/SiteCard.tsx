import { FC, ReactNode } from 'react';

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
  
  return (
    <div className={`
      relative p-4 rounded-xl border transition-all duration-200
      ${isEnabled 
        ? 'border-gray-200 dark:border-gray-700 bg-green-50/30 dark:bg-green-900/10 shadow-sm'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm'
      }
    `}>
      {/* Site Icon and Info */}
      <div className="flex items-start gap-3">
        <div className={`
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
            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
              {name}
            </h4>
            {isEnabled && (
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {hostname}
          </p>
          {description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {description}
            </p>
          )}
        </div>

        {/* Toggle Switch */}
        <ToggleSwitch
          checked={isEnabled}
          onChange={(checked) => { void onToggle(hostname, checked); }}
          disabled={saving}
          ariaLabel={`Enable ${name} integration`}
          size="medium"
        />
      </div>

      {/* Custom Site Actions */}
      {isCustom && (
        <div className="flex gap-1 flex-wrap mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {onExport && (
            <ExportButton
              onClick={() => { void onExport(hostname); }}
              disabled={saving}
              loading={exporting}
            />
          )}
          {onEdit && (
            <button
              onClick={() => { void onEdit(hostname); }}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xs transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => { void onRemove(hostname); }}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xs transition-colors"
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

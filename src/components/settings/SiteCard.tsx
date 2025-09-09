import { FC } from 'react';

interface SiteCardProps {
  hostname: string;
  name: string;
  description?: string;
  icon: string;
  isEnabled: boolean;
  isCustom?: boolean;
  onToggle: (hostname: string, enabled: boolean) => void;
  onRemove?: (hostname: string) => void;
  onEdit?: (hostname: string) => void;
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
  saving = false
}) => {
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
          w-10 h-10 rounded-lg flex items-center justify-center text-lg font-semibold flex-shrink-0 transition-all duration-200
          ${isEnabled 
            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-sm' 
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
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
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => { onToggle(hostname, e.target.checked); }}
            disabled={saving}
            className="sr-only peer"
            aria-label={`Enable ${name} integration`}
          />
          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-indigo-600"></div>
        </label>
      </div>

      {/* Custom Site Actions */}
      {isCustom && (
        <div className="flex gap-1 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          {onEdit && (
            <button
              onClick={() => { onEdit(hostname); }}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => { onRemove(hostname); }}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
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
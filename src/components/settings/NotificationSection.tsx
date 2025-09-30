import { FC, useState } from 'react';

import { ToastSettings } from '../../types/hooks';

import ToggleSwitch from './ToggleSwitch';

interface NotificationSectionProps {
  settings?: ToastSettings;
  onSettingsChange: (settings: Partial<ToastSettings>) => void;
  onTestToast: (type: 'success' | 'error' | 'info' | 'warning') => void;
}

const NotificationSection: FC<NotificationSectionProps> = ({
  settings,
  onSettingsChange,
  onTestToast
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTestTypeIndex, setCurrentTestTypeIndex] = useState(0);

  // Helper to get enabledTypes with defaults
  const getEnabledTypes = () => {
    const types = settings?.enabledTypes;
    return {
      success: types?.success ?? true,
      error: types?.error ?? true,
      info: types?.info ?? true,
      warning: types?.warning ?? true
    };
  };

  const currentEnabledTypes = getEnabledTypes();

  // Get list of enabled notification types
  const enabledTypes = (['success', 'error', 'warning', 'info'] as const).filter(
    type => currentEnabledTypes[type]
  );

  // Handle test button click - cycles through enabled types
  const handleTestClick = () => {
    if (enabledTypes.length === 0) {return;}

    const currentType = enabledTypes[currentTestTypeIndex];
    onTestToast(currentType);

    // Move to next enabled type
    setCurrentTestTypeIndex((currentTestTypeIndex + 1) % enabledTypes.length);
  };

  return (
    <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
      <button
        onClick={() => { setIsExpanded(!isExpanded); }}
        className="w-full flex items-center justify-between text-left mb-4 group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Notifications
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Customize toast notification behavior and appearance
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
        {/* Position Setting */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">
            Position
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { onSettingsChange({ position: 'top-right' }); }}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                ${(settings?.position ?? 'top-right') === 'top-right'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Top Right
                </span>
                {(settings?.position ?? 'top-right') === 'top-right' && (
                  <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="relative h-12 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                <div className="absolute top-1 right-1 w-16 h-3 bg-purple-500 rounded-sm"></div>
              </div>
            </button>

            <button
              onClick={() => { onSettingsChange({ position: 'bottom-right' }); }}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                ${settings?.position === 'bottom-right'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Bottom Right
                </span>
                {settings?.position === 'bottom-right' && (
                  <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="relative h-12 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                <div className="absolute bottom-1 right-1 w-16 h-3 bg-purple-500 rounded-sm"></div>
              </div>
            </button>
          </div>
        </div>

        {/* Notification Types */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                Notification Types
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Choose which types of notifications you want to see
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestClick}
              disabled={enabledTypes.length === 0}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                ${enabledTypes.length === 0
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                }
              `}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
              <span>Test</span>
            </button>
          </div>
          <div className="space-y-3">
            {/* Success */}
            <div className={`
              flex items-center justify-between p-3 rounded-lg border transition-all duration-200
              ${settings?.enabledTypes.success
                ? 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
              }
            `}>
              <div className="flex items-center space-x-3">
                <div className={`w-1 h-8 rounded transition-colors duration-200 ${settings?.enabledTypes.success ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                <div>
                  <div className={`text-sm font-medium transition-colors duration-200 ${settings?.enabledTypes.success ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500'}`}>Success</div>
                  <div className={`text-xs transition-colors duration-200 ${settings?.enabledTypes.success ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>Confirmation messages (2.75s)</div>
                </div>
              </div>
              <ToggleSwitch
                checked={currentEnabledTypes.success}
                onChange={(checked) => { onSettingsChange({
                  enabledTypes: {
                    ...currentEnabledTypes,
                    success: checked
                  }
                }); }}
                ariaLabel="Enable success notifications"
                size="small"
              />
            </div>

            {/* Error */}
            <div className={`
              flex items-center justify-between p-3 rounded-lg border transition-all duration-200
              ${settings?.enabledTypes.error
                ? 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
              }
            `}>
              <div className="flex items-center space-x-3">
                <div className={`w-1 h-8 rounded transition-colors duration-200 ${settings?.enabledTypes.error ? 'bg-red-500' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                <div>
                  <div className={`text-sm font-medium transition-colors duration-200 ${settings?.enabledTypes.error ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500'}`}>Error</div>
                  <div className={`text-xs transition-colors duration-200 ${settings?.enabledTypes.error ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>Error messages (7s)</div>
                </div>
              </div>
              <ToggleSwitch
                checked={currentEnabledTypes.error}
                onChange={(checked) => { onSettingsChange({
                  enabledTypes: {
                    ...currentEnabledTypes,
                    error: checked
                  }
                }); }}
                ariaLabel="Enable error notifications"
                size="small"
              />
            </div>

            {/* Warning */}
            <div className={`
              flex items-center justify-between p-3 rounded-lg border transition-all duration-200
              ${settings?.enabledTypes.warning
                ? 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
              }
            `}>
              <div className="flex items-center space-x-3">
                <div className={`w-1 h-8 rounded transition-colors duration-200 ${settings?.enabledTypes.warning ? 'bg-yellow-500' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                <div>
                  <div className={`text-sm font-medium transition-colors duration-200 ${settings?.enabledTypes.warning ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500'}`}>Warning</div>
                  <div className={`text-xs transition-colors duration-200 ${settings?.enabledTypes.warning ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>Important alerts (5s)</div>
                </div>
              </div>
              <ToggleSwitch
                checked={currentEnabledTypes.warning}
                onChange={(checked) => { onSettingsChange({
                  enabledTypes: {
                    ...currentEnabledTypes,
                    warning: checked
                  }
                }); }}
                ariaLabel="Enable warning notifications"
                size="small"
              />
            </div>

            {/* Info */}
            <div className={`
              flex items-center justify-between p-3 rounded-lg border transition-all duration-200
              ${settings?.enabledTypes.info
                ? 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'
              }
            `}>
              <div className="flex items-center space-x-3">
                <div className={`w-1 h-8 rounded transition-colors duration-200 ${settings?.enabledTypes.info ? 'bg-blue-500' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                <div>
                  <div className={`text-sm font-medium transition-colors duration-200 ${settings?.enabledTypes.info ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-500'}`}>Info</div>
                  <div className={`text-xs transition-colors duration-200 ${settings?.enabledTypes.info ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-600'}`}>Informational messages (2.75s)</div>
                </div>
              </div>
              <ToggleSwitch
                checked={currentEnabledTypes.info}
                onChange={(checked) => { onSettingsChange({
                  enabledTypes: {
                    ...currentEnabledTypes,
                    info: checked
                  }
                }); }}
                ariaLabel="Enable info notifications"
                size="small"
              />
            </div>
          </div>
        </div>
        </div>
      )}
    </section>
  );
};

export default NotificationSection;
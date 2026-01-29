import { FC, useCallback, useState } from 'react';

import { ChevronDownIcon, DebugInfoIcon, GearIcon, HelpIcon } from '../icons/SettingsIcons';

import ToggleSwitch from './ToggleSwitch';

interface AdvancedSectionProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  saving: boolean;
}

const AdvancedSection: FC<AdvancedSectionProps> = ({
  debugMode,
  onDebugModeChange,
  saving
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => { setIsExpanded(prev => !prev); }, []);

  return (
    <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between text-left mb-4 group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <GearIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Advanced
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Developer and advanced options
            </p>
          </div>
        </div>
        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Developer Options */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">
              Developer Options
            </h3>
            
            {/* Debug Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <label htmlFor="debug-mode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Debug Mode
                  </label>
                  <div className="group relative">
                    <HelpIcon className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      Enable detailed console logging for debugging
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enable console logging for development and troubleshooting
                </p>
              </div>
              
              <div className="ml-4">
                <ToggleSwitch
                  checked={debugMode}
                  onChange={onDebugModeChange}
                  disabled={saving}
                  ariaLabel="Debug mode"
                  size="small"
                />
              </div>
            </div>

            {/* Debug Mode Status */}
            {debugMode && (
              <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300">
                  <DebugInfoIcon />
                  Debug logging is now active. Check browser console for detailed information.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AdvancedSection; 
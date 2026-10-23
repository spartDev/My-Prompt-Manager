import { type FC, useCallback, useId, useState } from 'react';

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
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="border-t border-default pt-6">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between text-left mb-4 group"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div data-testid="section-icon" className="w-10 h-10 bg-accent-subtle text-accent rounded-xl flex items-center justify-center shrink-0">
            <GearIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-primary">
              Advanced
            </h2>
            <p className="text-sm text-tertiary">
              Developer and advanced options
            </p>
          </div>
        </div>
        <ChevronDownIcon className={`w-5 h-5 text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Developer Options */}
          <div className="bg-card rounded-xl p-4 border border-default">
            <h3 className="font-medium text-primary text-sm mb-3">
              Developer Options
            </h3>
            
            {/* Debug Mode Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <label htmlFor="debug-mode" className="text-sm font-medium text-secondary">
                    Debug Mode
                  </label>
                  <div className="group relative">
                    <HelpIcon className="w-4 h-4 text-tertiary cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-inverse text-on-inverse text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      Enable detailed console logging for debugging
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-(--background-color-inverse)"></div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-tertiary">
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
              <div className="mt-3 p-2 bg-accent-subtle border border-accent rounded-lg">
                <div className="flex items-center gap-2 text-xs text-accent-strong">
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
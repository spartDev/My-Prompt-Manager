import { type FC, useCallback, useId, useState } from 'react';

import { Logger, toError } from '../../utils';
import { DebugInfoIcon } from '../icons/SettingsIcons';

import { ROW_BUTTON_CLASSES } from './rowStyles';
import SettingsGroup from './SettingsGroup';
import SettingsRow from './SettingsRow';
import Switch from './Switch';

interface AdvancedSectionProps {
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  saving: boolean;
  /** Restores every setting to its default, keeping the Prompts and Categories */
  onReset: () => Promise<void>;
}

/** The Advanced group: debug logging, and resetting the settings */
const AdvancedSection: FC<AdvancedSectionProps> = ({ debugMode, onDebugModeChange, saving, onReset }) => {
  const debugLabelId = useId();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = useCallback(async () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }

    setResetting(true);
    try {
      await onReset();
      setShowResetConfirm(false);
    } catch (error) {
      Logger.error('Failed to reset settings', toError(error));
    } finally {
      setResetting(false);
    }
  }, [showResetConfirm, onReset]);

  return (
    <SettingsGroup label="Advanced">
      <SettingsRow
        label="Debug mode"
        labelId={debugLabelId}
        control={<Switch checked={debugMode} onChange={onDebugModeChange} disabled={saving} labelledBy={debugLabelId} />}
      >
        {debugMode && (
          <div className="mt-2 p-2 bg-accent-subtle border border-accent rounded-lg flex items-center gap-2 text-xs text-accent-strong">
            <DebugInfoIcon />
            Debug logging is now active. Check browser console for detailed information.
          </div>
        )}
      </SettingsRow>

      <SettingsRow
        label="Reset settings"
        control={showResetConfirm ? undefined : (
          <button type="button" onClick={() => void handleReset()} className={ROW_BUTTON_CLASSES}>
            Reset to Defaults
          </button>
        )}
      >
        {showResetConfirm && (
          <div className="mt-2 space-y-2">
            <div className="p-3 bg-warning-subtle border border-warning rounded-lg">
              <p className="text-sm text-warning">
                ⚠️ This will reset all settings to defaults but keep your prompts and categories. Continue?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={resetting}
                className="flex-1 h-10 px-4 bg-accent hover:bg-accent-hover text-on-accent text-sm font-semibold rounded-full transition-colors focus-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset Settings'}
              </button>
              <button
                type="button"
                onClick={() => { setShowResetConfirm(false); }}
                disabled={resetting}
                className="flex-1 h-10 px-4 bg-card text-secondary text-sm font-semibold border-[1.5px] border-strong rounded-full hover:bg-muted transition-colors focus-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SettingsRow>
    </SettingsGroup>
  );
};

export default AdvancedSection;

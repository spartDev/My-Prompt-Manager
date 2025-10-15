import { FC } from 'react';

import SettingsSection from './SettingsSection';
import ToggleSwitch from './ToggleSwitch';

interface PrivacySectionProps {
  analyticsEnabled: boolean;
  onAnalyticsChange: (enabled: boolean) => void;
  saving: boolean;
}

const PrivacySection: FC<PrivacySectionProps> = ({
  analyticsEnabled,
  onAnalyticsChange,
  saving
}) => {
  return (
    <SettingsSection
      icon={
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      }
      title="Privacy & Data"
      description="Control how your data is collected and used"
    >
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-purple-100 dark:border-gray-700 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <label
              htmlFor="analytics-toggle"
              className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
            >
              Enable Usage Analytics
            </label>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Track prompt usage and unlock achievements (100% local, never leaves your device)
            </p>
          </div>
          <ToggleSwitch
            checked={analyticsEnabled}
            onChange={onAnalyticsChange}
            disabled={saving}
            ariaLabel="Enable analytics"
          />
        </div>
      </div>
    </SettingsSection>
  );
};

export default PrivacySection;

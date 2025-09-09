import { FC } from 'react';

import { useThemeContext } from '../../contexts/ThemeContext';
import InterfaceModeSelector from '../InterfaceModeSelector';

import SettingsSection from './SettingsSection';

interface AppearanceSectionProps {
  interfaceMode: 'popup' | 'sidepanel';
  onInterfaceModeChange: (mode: 'popup' | 'sidepanel') => void;
  saving?: boolean;
  interfaceModeChanging?: boolean;
}

const AppearanceSection: FC<AppearanceSectionProps> = ({
  interfaceMode,
  onInterfaceModeChange,
  saving = false,
  interfaceModeChanging = false
}) => {
  const { theme, setTheme } = useThemeContext();
  const icon = (
    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  );

  return (
    <SettingsSection
      icon={icon}
      title="Appearance"
      description="Customize how the extension looks and behaves"
    >
      <div className="space-y-4">
        {/* Theme Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-3">
            Theme
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'light' as const, label: 'Light', icon: '☀️' },
              { value: 'dark' as const, label: 'Dark', icon: '🌙' },
              { value: 'system' as const, label: 'System', icon: '💻' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => { void setTheme(option.value); }}
                disabled={saving}
                className={`
                  relative p-3 rounded-lg border-2 transition-all duration-200
                  ${theme === option.value
                    ? 'border-purple-500 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-600'
                  }
                  ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="text-2xl mb-1">{option.icon}</div>
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                  {option.label}
                </div>
                {theme === option.value && (
                  <div className="absolute top-1 right-1">
                    <div className="w-4 h-4 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Interface Mode */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <InterfaceModeSelector
            value={interfaceMode}
            onChange={onInterfaceModeChange}
            disabled={saving}
            loading={interfaceModeChanging}
          />
        </div>
      </div>
    </SettingsSection>
  );
};

export default AppearanceSection;